// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// ==============================
// LazyNFT.sol
// NFT 铸造合约（支持懒铸造 / Lazy Minting）
// ==============================

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/common/ERC2981.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

contract LazyNFT is ERC721URIStorage, ERC2981, EIP712, Ownable, ReentrancyGuard {
    using Counters for Counters.Counter;
    using ECDSA for bytes32;

    // ============================
    // 状态变量
    // ============================
    Counters.Counter private _tokenIds; // NFT Token 自增 ID

    // EIP-712 voucher 类型哈希（签名结构定义）
    bytes32 private constant VOUCHER_TYPEHASH = keccak256(
        "NFTVoucher(string tokenURI,uint256 minPrice,address creator,uint256 nonce)"
    );

    // 已使用的 voucher nonce，防止重放攻击
    mapping(address => mapping(uint256 => bool)) public usedNonces;

    // 冻结的 Token ID，冻结后不可转让
    mapping(uint256 => bool) public frozenTokens;

    // NFT voucher 结构（懒铸造凭证）
    struct NFTVoucher {
        string tokenURI;   // NFT metadata URI
        uint256 minPrice;  // 最低兑换价格
        address creator;   // 创作者地址
        uint256 nonce;     // 防重放 nonce
    }

    // ============================
    // 事件
    // ============================
    event Minted(address indexed creator, address indexed owner, uint256 tokenId, string tokenURI);
    event Transferred(address indexed from, address indexed to, uint256 tokenId);
    event Burned(address indexed owner, uint256 tokenId);
    event RoyaltyPaid(address indexed creator, uint256 tokenId, uint256 amount);

    // ============================
    // 构造函数
    // ============================
    constructor() ERC721("LazyNFT","LNFT") EIP712("LazyNFT","1") {}

    // ============================
    // 外部函数：公开设置版税
    // ============================
    function setTokenRoyaltyPublic(uint256 tokenId, address receiver, uint96 feeNumerator) external onlyOwner {
        _setTokenRoyalty(tokenId, receiver, feeNumerator); // OpenZeppelin ERC2981
    }

    // ============================
    // 内部函数：验证 voucher 签名
    // ============================
    function _verify(NFTVoucher calldata voucher, bytes calldata signature) public view returns (address) {
        // 1. 计算 voucher 的 structHash
        bytes32 structHash = keccak256(
            abi.encode(
                VOUCHER_TYPEHASH,
                keccak256(bytes(voucher.tokenURI)),
                voucher.minPrice,
                voucher.creator,
                voucher.nonce
            )
        );
        // 2. 使用 EIP712 域哈希
        bytes32 digest = _hashTypedDataV4(structHash);
        // 3. 恢复签名者地址
        return ECDSA.recover(digest, signature);
    }

    // ============================
    // 核心功能：懒铸造 NFT
    // ============================
    function redeem(NFTVoucher calldata voucher, bytes calldata signature) external payable nonReentrant returns (uint256) {
        // 验证签名者
        address signer = _verify(voucher, signature);
        require(signer == voucher.creator, "Invalid or unauthorized voucher");

        // 检查支付金额是否足够
        require(msg.value >= voucher.minPrice, "Insufficient funds to redeem");

        // 检查 nonce 是否已经使用
        require(!usedNonces[signer][voucher.nonce], "Voucher already used");
        usedNonces[signer][voucher.nonce] = true;

        // Mint NFT
        _tokenIds.increment();
        uint256 newId = _tokenIds.current();
        _mint(msg.sender, newId);
        _setTokenURI(newId, voucher.tokenURI);

        // 设置默认 5% 版税给创作者
        _setTokenRoyalty(newId, voucher.creator, 500);

        // 支付购买金额给创作者
        payable(voucher.creator).transfer(msg.value);

        // 触发事件
        emit Minted(voucher.creator, msg.sender, newId, voucher.tokenURI);
        emit RoyaltyPaid(voucher.creator, newId, msg.value * 500 / 10000);

        return newId;
    }

    // ============================
    // 批量铸造（仅管理员）
    // ============================
    function batchMint(address[] calldata recipients, string[] calldata uris) external onlyOwner {
        require(recipients.length == uris.length, "Array length mismatch");
        for (uint256 i = 0; i < recipients.length; i++) {
            _tokenIds.increment();
            uint256 tokenId = _tokenIds.current();
            _mint(recipients[i], tokenId);
            _setTokenURI(tokenId, uris[i]);
            emit Minted(msg.sender, recipients[i], tokenId, uris[i]);
        }
    }

    // ============================
    // 销毁 NFT
    // ============================
    function burn(uint256 tokenId) external {
        require(ownerOf(tokenId) == msg.sender, "Not token owner");
        _burn(tokenId);
        emit Burned(msg.sender, tokenId);
    }

    // ============================
    // 冻结 NFT（仅管理员）
    // ============================
    function freeze(uint256 tokenId) external onlyOwner {
        frozenTokens[tokenId] = true;
    }

    // ============================
    // 转账前检查
    // ============================
    function _beforeTokenTransfer(address from, address to, uint256 tokenId, uint256 batchSize) internal override(ERC721) {
        require(!frozenTokens[tokenId], "Token is frozen"); // 冻结的 NFT 不能转移
        if (from != address(0) && to != address(0)) {
            emit Transferred(from, to, tokenId);
        }
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
    }

    // ============================
    // 支持接口（ERC721 + ERC2981）
    // ============================
    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC721, ERC2981) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
