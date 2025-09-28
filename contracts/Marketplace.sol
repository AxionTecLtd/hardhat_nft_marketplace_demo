
// ==============================
// Marketplace.sol
// NFT 二级市场合约
// ==============================

pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Address.sol";

// NFT 接口，用于 Marketplace 调用 NFT 合约函数
interface ILazyNFT is IERC721 {
    function frozenTokens(uint256 tokenId) external view returns (bool);
    function royaltyInfo(uint256 tokenId, uint256 salePrice) external view returns (address, uint256);
}

contract Marketplace is ReentrancyGuard {
    using Address for address payable;

    // NFT 上架信息
    struct Listing {
        address seller;  // 卖家地址
        uint256 price;   // 售价
    }

    // nftContract -> tokenId -> Listing
    mapping(address => mapping(uint256 => Listing)) public listings;

    // ============================
    // 事件
    // ============================
    event ItemListed(address indexed nftContract, uint256 indexed tokenId, address seller, uint256 price);
    event ItemSold(address indexed nftContract, uint256 indexed tokenId, address buyer, uint256 price);
    event ListingCancelled(address indexed nftContract, uint256 indexed tokenId);

    // ============================
    // 上架 NFT
    // ============================
    function listItem(address nftContract, uint256 tokenId, uint256 price) external {
        ILazyNFT nft = ILazyNFT(nftContract);
        require(nft.ownerOf(tokenId) == msg.sender, "Not token owner");
        require(!nft.frozenTokens(tokenId), "Token is frozen");
        require(nft.isApprovedForAll(msg.sender, address(this)) || nft.getApproved(tokenId) == address(this), "Marketplace not approved");

        listings[nftContract][tokenId] = Listing(msg.sender, price);
        emit ItemListed(nftContract, tokenId, msg.sender, price);
    }

    // ============================
    // 购买 NFT
    // ============================
    function buyItem(address nftContract, uint256 tokenId) external payable nonReentrant {
        Listing memory listing = listings[nftContract][tokenId];
        require(listing.price > 0, "Not listed");
        require(msg.value >= listing.price, "Insufficient payment");

        ILazyNFT nft = ILazyNFT(nftContract);

        // 转 NFT 给买家
        nft.safeTransferFrom(listing.seller, msg.sender, tokenId);

        // 支付版税
        (address royaltyReceiver, uint256 royaltyAmount) = nft.royaltyInfo(tokenId, msg.value);
        if (royaltyAmount > 0) {
            payable(royaltyReceiver).sendValue(royaltyAmount);
        }

        // 剩余支付给卖家
        payable(listing.seller).sendValue(msg.value - royaltyAmount);

        // 删除上架信息
        delete listings[nftContract][tokenId];

        emit ItemSold(nftContract, tokenId, msg.sender, msg.value);
    }

    // ============================
    // 取消上架
    // ============================
    function cancelListing(address nftContract, uint256 tokenId) external {
        Listing memory listing = listings[nftContract][tokenId];
        require(listing.seller == msg.sender, "Not seller");
        delete listings[nftContract][tokenId];
        emit ListingCancelled(nftContract, tokenId);
    }

    // ============================
    // 查询上架信息
    // ============================
    function getListing(address nftContract, uint256 tokenId) external view returns (Listing memory) {
        return listings[nftContract][tokenId];
    }
}