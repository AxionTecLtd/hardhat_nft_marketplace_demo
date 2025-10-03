// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// =====================================================
// Marketplace.sol - 二级市场交易合约 (企业级注释版)
// =====================================================
// 功能：
// 1️⃣ 二级市场 NFT 上架、购买、取消上架
// 2️⃣ 支持创作者版税 (ERC2981)
// 3️⃣ 支持平台抽成
// 4️⃣ 资金安全分账（防重入）
// 5️⃣ 完全链上记录交易
//
// 设计原则：
// - 所有资金分账在同一笔交易中完成，保证创作者、平台、卖家收益透明
// - 使用 OpenZeppelin 安全库 (ReentrancyGuard, Address, IERC721, ERC2981)
// - 上架、购买操作仅限 NFT 拥有者或批准账户
// - 企业级注释，便于审计、运维和二次开发
// =====================================================

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/common/ERC2981.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Address.sol";

interface ILazyNFT is IERC721, IERC2981 {}

contract Marketplace is ReentrancyGuard {
    using Address for address payable;

    // =========================================
    // NFT 上架信息结构体
    // =========================================
    struct Listing {
        address seller;  // 上架者地址
        uint256 price;   // 上架价格（单位 wei）
    }

    // nftContract -> tokenId -> Listing
    mapping(address => mapping(uint256 => Listing)) public listings;

    // 平台收入账户
    address public platformAddress;

    // 平台抽成比例（BPS, 1% = 100）
    uint96 public platformFeeBps = 200; // 默认 2%

    // =========================================
    // 事件定义（链上可索引，便于审计）
    // =========================================
    event ItemListed(address indexed nftContract, uint256 indexed tokenId, address seller, uint256 price);
    event ItemSold(address indexed nftContract, uint256 indexed tokenId, address buyer, uint256 price);
    event ListingCancelled(address indexed nftContract, uint256 indexed tokenId);

    // =========================================
    // 构造函数 - 初始化平台账户
    // =========================================
    constructor(address _platform) {
        require(_platform != address(0), "Invalid platform address");
        platformAddress = _platform;
    }

    // =========================================
    // 上架 NFT（仅 NFT 拥有者可调用）
    // =========================================
    function listItem(address nftContract, uint256 tokenId, uint256 price) external {
        IERC721 nft = IERC721(nftContract);

        // 校验调用者是否为 NFT 拥有者
        require(nft.ownerOf(tokenId) == msg.sender, "Not owner");

        // 校验 Marketplace 合约是否获得 NFT 授权
        require(
            nft.getApproved(tokenId) == address(this) || nft.isApprovedForAll(msg.sender, address(this)),
            "Marketplace not approved"
        );

        // 上架记录
        listings[nftContract][tokenId] = Listing(msg.sender, price);

        emit ItemListed(nftContract, tokenId, msg.sender, price);
    }

    // =========================================
    // 取消上架（仅卖家可调用）
    // =========================================
    function cancelListing(address nftContract, uint256 tokenId) external {
        Listing memory listing = listings[nftContract][tokenId];

        // 校验调用者是否为上架卖家
        require(listing.seller == msg.sender, "Not seller");

        // 删除上架记录
        delete listings[nftContract][tokenId];

        emit ListingCancelled(nftContract, tokenId);
    }

    // =========================================
    // 已经上架的 NFT 想改价
    // =========================================
    function updateListingPrice(address nftContract, uint256 tokenId, uint256 newPrice) external {
        Listing storage listing = listings[nftContract][tokenId];
        require(listing.seller == msg.sender, "Not seller");
        require(newPrice > 0, "Price must be > 0");

        listing.price = newPrice;

        emit ItemListed(nftContract, tokenId, msg.sender, newPrice); // 复用事件通知前端
    }



    // =========================================
    // 二级市场购买 NFT
    // 资金流向：
    // 1️⃣ 创作者版税（ERC2981） → 直接转给创作者
    // 2️⃣ 平台抽成 → 转给平台账户
    // 3️⃣ 剩余 → 卖家收益
    // NFT 转给买家，删除上架记录
    // =========================================
    function buyItem(address nftContract, uint256 tokenId) external payable nonReentrant {
        Listing memory listing = listings[nftContract][tokenId];

        require(listing.price > 0, "Not listed");          // NFT 必须已上架
        require(msg.value >= listing.price, "Insufficient payment"); // 买家支付金额足够

        ILazyNFT nft = ILazyNFT(nftContract);

        // -------------------------------
        // 1️⃣ 创作者版税支付
        // -------------------------------
        (address royaltyReceiver, uint256 royaltyAmount) = nft.royaltyInfo(tokenId, msg.value);
        if (royaltyAmount > 0) {
            payable(royaltyReceiver).sendValue(royaltyAmount);
        }

        // -------------------------------
        // 2️⃣ 平台抽成
        // -------------------------------
        uint256 platformFee = (msg.value * platformFeeBps) / 10000;
        if (platformFee > 0) {
            payable(platformAddress).sendValue(platformFee);
        }

        // -------------------------------
        // 3️⃣ 卖家收益
        // -------------------------------
        uint256 sellerAmount = msg.value - royaltyAmount - platformFee;
        payable(listing.seller).sendValue(sellerAmount);

        // -------------------------------
        // NFT 转移给买家
        // -------------------------------
        nft.safeTransferFrom(listing.seller, msg.sender, tokenId);

        // 删除上架记录
        delete listings[nftContract][tokenId];

        emit ItemSold(nftContract, tokenId, msg.sender, msg.value);
    }

    // =========================================
    // 查询 NFT 上架信息
    // =========================================
    function getListing(address nftContract, uint256 tokenId) external view returns (Listing memory) {
        return listings[nftContract][tokenId];
    }

    // =========================================
    // 修改平台收入账户（仅平台可调用）
    // =========================================
    function setPlatformAddress(address newAddr) external {
        require(msg.sender == platformAddress, "Only platform");
        platformAddress = newAddr;
    }

    // =========================================
    // 修改平台抽成比例（单位 BPS, 上限 10%）
    // =========================================
    function setPlatformFee(uint96 newBps) external {
        require(msg.sender == platformAddress, "Only platform");
        require(newBps <= 1000, "Fee too high"); // <= 10%
        platformFeeBps = newBps;
    }
}
