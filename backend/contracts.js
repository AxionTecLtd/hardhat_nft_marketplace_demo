// D:\projects\hardhat_nft_marketplace\hardhat-nft\backend\contracts.js
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env'), override: true });
const { ethers } = require('ethers');

// ============================
// 1.网络+合约地址配置
// ============================
// 如果存在本地网络地址，则使用本地，否则使用 Sepolia 测试网

const RPC_URL = process.env.LOCAL_RPC_URL 
// const RPC_URL = process.env.SEPOLIA_URL;  //  Sepolia 测试网
const LAZY_NFT_ADDRESS = process.env.LAZY_NFT_ADDRESS;
const MARKETPLACE_ADDRESS = process.env.MARKETPLACE_ADDRESS;

// ============================
// 调试输出，确保环境变量正确加载
// ============================
console.log('使用 RPC_URL:', RPC_URL);
console.log('LazyNFT 合约地址:', LAZY_NFT_ADDRESS);
console.log('Marketplace 合约地址:', MARKETPLACE_ADDRESS);

// ============================
// 2.新建 provider 提供类
// ============================
const provider = new ethers.JsonRpcProvider(RPC_URL);


// 3.============================
// 创建合约实例
// ============================
// 引入 合约abi
const lazyNFTAbi = require('../artifacts/contracts/LazyNFT.sol/LazyNFT.json').abi;
const marketplaceAbi = require('../artifacts/contracts/Marketplace.sol/Marketplace.json').abi;
// 新建合约实例
const lazyNFT = new ethers.Contract(LAZY_NFT_ADDRESS, lazyNFTAbi, provider);
const marketplace = new ethers.Contract(MARKETPLACE_ADDRESS, marketplaceAbi, provider);

// 私钥-创作者签名用的私钥
const LOCAL_CREATOR_PRIVATE_KEY = process.env.LOCAL_CREATOR_PRIVATE_KEY; // 测试私钥
const local_test_wallet = new ethers.Wallet(LOCAL_CREATOR_PRIVATE_KEY, provider);  // 测试用钱包实例（本地）
// 购买者私钥
const LOCAL_SELLER_PRIVATE_KEY_LIST  =  process.env.LOCAL_SELLER_PRIVATE_KEY_LIST // only for test
const local_test_seller_wallet = new ethers.Wallet(LOCAL_CREATOR_PRIVATE_KEY, provider);  // 测试用钱包实例（本地）






// =================================
// 最后，导出对象供其他模块使用
// =================================
module.exports = {
    // 网络
    provider,                                  // ethers provider
    // 合约地址
    lazyNFTAddress: LAZY_NFT_ADDRESS,          // LazyNFT 合约地址 （可用来新建合约实例）
    marketplaceAddress: MARKETPLACE_ADDRESS,   // marketplace 合约地址 （可用来新建合约实例）
    // 合约实例
    lazyNFT,                                   // LazyNFT 合约实例
    marketplace,                               // Marketplace 合约实例
    // abi
    lazyNFTAbi,
    marketplaceAbi,
    local_test_wallet,  
    
    // 测试网 可以直接替换
    LOCAL_CREATOR_PRIVATE_KEY,                  // 本地
    LOCAL_SELLER_PRIVATE_KEY_LIST,              // 购买后出售上架用的 私钥代 seller
    local_test_seller_wallet                   // local seller wallet
    


};
