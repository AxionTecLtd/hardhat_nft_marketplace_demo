// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// ==============================
// LazyNFT.sol
// NFT 铸造合约（精简版）
// ------------------------------
// 功能：
// 1. 懒铸造 NFT（redeem voucher）
// 2. 销毁 NFT（用户操作）
// 3. ERC2981 版税标准
// 4. 链上记录转账事件
// ------------------------------
// 设计原则：
// - 链上负责 NFT 所有权、交易记录、版税
// - 链下负责 voucher 生成、签名、交易流程管理
// ==============================

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/common/ERC2981.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/Address.sol";

contract LazyNFT is ERC721URIStorage, ERC2981, EIP712, Ownable, ReentrancyGuard {
    using Counters for Counters.Counter;
    using ECDSA for bytes32;
    using Address for address payable;

    // NFT 自增 ID
    Counters.Counter private _tokenIds;

    // Voucher 类型哈希
    bytes32 private constant VOUCHER_TYPEHASH = keccak256(
        "NFTVoucher(string tokenURI,uint256 minPrice,address creator,uint96 feeNumerator,uint256 nonce)"
    );

    // 已使用 voucher nonce 防重放
    mapping(address => mapping(uint256 => bool)) public usedNonces;

    // NFT voucher 结构
    struct NFTVoucher {
        string tokenURI;
        uint256 minPrice;
        address creator;
        uint96 feeNumerator; // 版税分子（分母为 10000）
        uint256 nonce;
    }

    // ============================
    // 事件
    // ============================
    event Minted(address indexed creator, address indexed owner, uint256 tokenId, string tokenURI);
    event Transferred(address indexed from, address indexed to, uint256 tokenId);
    event Burned(address indexed owner, uint256 tokenId);
    event RoyaltyPaid(address indexed creator, uint256 tokenId, uint256 amount);
    event RoyaltySet(address indexed creator, uint256 tokenId, uint96 feeNumerator);

    // ============================
    // 构造函数
    // ============================
    constructor() ERC721("LazyNFT","LNFT") EIP712("LazyNFT","1") {}

    // ============================
    // 管理员可设置单个 token 的版税（保留给合约拥有者）
    // ============================
    function setTokenRoyaltyPublic(uint256 tokenId, address receiver, uint96 feeNumerator) external onlyOwner {
        require(feeNumerator <= _feeDenominator(), "fee too high");
        _setTokenRoyalty(tokenId, receiver, feeNumerator);
    }

    // ============================
    // 获取当前最新 tokenId
    // ============================
    function getCurrentTokenId() external view returns (uint256) {
        return _tokenIds.current();
    }

    // ============================
    // 验证 voucher 签名
    // ============================
    function _verify(NFTVoucher calldata voucher, bytes calldata signature) public view returns (address) {
        bytes32 structHash = keccak256(
            abi.encode(
                VOUCHER_TYPEHASH,
                keccak256(bytes(voucher.tokenURI)),
                voucher.minPrice,
                voucher.creator,
                voucher.feeNumerator,
                voucher.nonce
            )
        );
        bytes32 digest = _hashTypedDataV4(structHash);
        return ECDSA.recover(digest, signature);
    }

    // ============================
    // 铸造 NFT（redeem voucher）
    // ============================
    function redeem(NFTVoucher calldata voucher, bytes calldata signature) external payable nonReentrant returns (uint256) {
        address signer = _verify(voucher, signature);
        require(signer == voucher.creator, "Invalid voucher");
        require(msg.value >= voucher.minPrice, "Insufficient funds");
        require(!usedNonces[signer][voucher.nonce], "Voucher already used");
        // fee 限制（0 ~ 10000）
        require(voucher.feeNumerator <= _feeDenominator(), "fee too high");

        usedNonces[signer][voucher.nonce] = true;

        _tokenIds.increment();
        uint256 newId = _tokenIds.current();
        _mint(msg.sender, newId);
        _setTokenURI(newId, voucher.tokenURI);

        // 使用 voucher 中创作者设置的版税
        _setTokenRoyalty(newId, voucher.creator, voucher.feeNumerator);

        // 主售支付：把收到的款项发送给创作者（如果平台另有分成/托管逻辑，可在此调整）
        payable(voucher.creator).sendValue(msg.value);

        emit Minted(voucher.creator, msg.sender, newId, voucher.tokenURI);
        emit RoyaltySet(voucher.creator, newId, voucher.feeNumerator);

        return newId;
    }

    // ============================
    // 销毁 NFT（用户操作）
    // ============================
    function burn(uint256 tokenId) external {
        require(ownerOf(tokenId) == msg.sender, "Not token owner");
        _burn(tokenId);
        emit Burned(msg.sender, tokenId);
    }

    // ============================
    // 转账前事件
    // ============================
    function _beforeTokenTransfer(address from, address to, uint256 tokenId, uint256 batchSize) internal override(ERC721) {
        if (from != address(0) && to != address(0)) {
            emit Transferred(from, to, tokenId);
        }
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
    }

    // ============================
    // 支持接口
    // ============================
    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC2981) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
