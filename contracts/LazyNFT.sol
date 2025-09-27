// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// LazyNFT.sol


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

    Counters.Counter private _tokenIds;

    bytes32 private constant VOUCHER_TYPEHASH = keccak256(
        "NFTVoucher(string tokenURI,uint256 minPrice,address creator,uint256 nonce)"
    );

    mapping(address => mapping(uint256 => bool)) public usedNonces;
    mapping(uint256 => bool) public frozenTokens;

    struct NFTVoucher {
        string tokenURI;
        uint256 minPrice;
        address creator;
        uint256 nonce;
    }

    event Minted(address indexed creator, address indexed owner, uint256 tokenId, string tokenURI);
    event Transferred(address indexed from, address indexed to, uint256 tokenId);
    event Burned(address indexed owner, uint256 tokenId);
    event RoyaltyPaid(address indexed creator, uint256 tokenId, uint256 amount);

    constructor() ERC721("LazyNFT","LNFT") EIP712("LazyNFT","1") {}
    function setTokenRoyaltyPublic(uint256 tokenId, address receiver, uint96 feeNumerator) external onlyOwner {
    _setTokenRoyalty(tokenId, receiver, feeNumerator);
}

    function _verify(NFTVoucher calldata voucher, bytes calldata signature) public view returns (address) {
        bytes32 structHash = keccak256(
            abi.encode(
                VOUCHER_TYPEHASH,
                keccak256(bytes(voucher.tokenURI)),
                voucher.minPrice,
                voucher.creator,
                voucher.nonce
            )
        );
        bytes32 digest = _hashTypedDataV4(structHash);
        return ECDSA.recover(digest, signature);
    }

    function redeem(NFTVoucher calldata voucher, bytes calldata signature) external payable nonReentrant returns (uint256) {
        address signer = _verify(voucher, signature);
        require(signer == voucher.creator, "Invalid or unauthorized voucher");
        require(msg.value >= voucher.minPrice, "Insufficient funds to redeem");
        require(!usedNonces[signer][voucher.nonce], "Voucher already used");

        usedNonces[signer][voucher.nonce] = true;

        _tokenIds.increment();
        uint256 newId = _tokenIds.current();
        _mint(msg.sender, newId);
        _setTokenURI(newId, voucher.tokenURI);

        // 默认 5% 版税
        _setTokenRoyalty(newId, voucher.creator, 500);

        payable(voucher.creator).transfer(msg.value);

        emit Minted(voucher.creator, msg.sender, newId, voucher.tokenURI);
        emit RoyaltyPaid(voucher.creator, newId, msg.value * 500 / 10000);

        return newId;
    }

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

    function burn(uint256 tokenId) external {
        require(ownerOf(tokenId) == msg.sender, "Not token owner");
        _burn(tokenId);
        emit Burned(msg.sender, tokenId);
    }

    function freeze(uint256 tokenId) external onlyOwner {
        frozenTokens[tokenId] = true;
    }

    // v4.8.3 版本 _beforeTokenTransfer 包含 batchSize 参数
    function _beforeTokenTransfer(address from, address to, uint256 tokenId, uint256 batchSize) internal override(ERC721) {
        require(!frozenTokens[tokenId], "Token is frozen");
        if (from != address(0) && to != address(0)) {
            emit Transferred(from, to, tokenId);
        }
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
    }

    // supportsInterface override 直接使用 ERC721 和 ERC2981
    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC721, ERC2981) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
