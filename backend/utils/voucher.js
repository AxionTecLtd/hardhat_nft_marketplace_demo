// backend/generateVoucher.js
require('dotenv').config();
const { ethers } = require('ethers');
const { lazyNFT, lazyNFTAddress } = require('./contracts');

// 示例 NFT 数据
const tokenURI = "https://example.com/nft1.json";
const minPrice = ethers.parseEther("0.01");  // 最小支付 0.01 ETH
const nonce = 1;

// 使用创建者私钥生成钱包（注意：不要泄露私钥！）
const creatorPrivateKey = process.env.CREATOR_PRIVATE_KEY;
const wallet = new ethers.Wallet(creatorPrivateKey);

// 构造 voucher
const voucher = {
    tokenURI,
    minPrice,
    creator: wallet.address,
    nonce
};

// 生成签名
async function signVoucher() {
    const domain = await lazyNFT._domain();  // ethers v6 获取 EIP712 domain
    const types = {
        NFTVoucher: [
            { name: "tokenURI", type: "string" },
            { name: "minPrice", type: "uint256" },
            { name: "creator", type: "address" },
            { name: "nonce", type: "uint256" }
        ]
    };
    const signature = await wallet._signTypedData(domain, types, voucher);
    console.log("Voucher:", voucher);
    console.log("Signature:", signature);
}

signVoucher();
