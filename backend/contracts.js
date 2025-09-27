// D:\projects\hardhat_nft_marketplace\hardhat-nft\backend\contracts.js
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env'), override: true });
const { ethers } = require('ethers');

// ============================
// 选择网络配置
// ============================
// 如果存在本地网络地址，则使用本地，否则使用 Sepolia 测试网
const RPC_URL = process.env.RPC_URL || process.env.SEPOLIA_URL;
const LAZY_NFT_ADDRESS = process.env.LAZY_NFT_ADDRESS;
const MARKETPLACE_ADDRESS = process.env.MARKETPLACE_ADDRESS;

// ============================
// 调试输出，确保环境变量正确加载
// ============================
console.log('使用 RPC_URL:', RPC_URL);
console.log('LazyNFT 合约地址:', LAZY_NFT_ADDRESS);
console.log('Marketplace 合约地址:', MARKETPLACE_ADDRESS);

// ============================
// 创建 provider
// ============================
const provider = new ethers.JsonRpcProvider(RPC_URL);

// ============================
// 创建合约实例
// ============================
const lazyNFTAbi = require('../artifacts/contracts/LazyNFT.sol/LazyNFT.json').abi;
const marketplaceAbi = require('../artifacts/contracts/Marketplace.sol/Marketplace.json').abi;

const lazyNFT = new ethers.Contract(LAZY_NFT_ADDRESS, lazyNFTAbi, provider);
const marketplace = new ethers.Contract(MARKETPLACE_ADDRESS, marketplaceAbi, provider);

// ============================
// 导出对象供其他模块使用
// ============================
module.exports = {
    provider,           // ethers provider
    lazyNFT,            // LazyNFT 合约实例
    marketplace,        // Marketplace 合约实例
    lazyNFTAddress: LAZY_NFT_ADDRESS,
    marketplaceAddress: MARKETPLACE_ADDRESS,
};
