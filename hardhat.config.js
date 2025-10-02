require("@nomicfoundation/hardhat-toolbox");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });

/** @type import('hardhat/config').HardhatUserConfig */
const SEPOLIA_URL = process.env.SEPOLIA_URL;
const SEPOLIA_KEY = process.env.SEPOLIA_KEY;
const SEPOLIA_KEY_2 = process.env.SEPOLIA_KEY_2;
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;

// 本地网络相关
const LOCAL_RPC_URL = process.env.LOCAL_RPC_URL;
const LOCAL_KEY_0 = process.env.LOCAL_KEY_0;
const LOCAL_KEY_1 = process.env.LOCAL_BUYER_PRIVATE_KEY;

module.exports = {
  solidity: "0.8.24",
  networks: {
    // Hardhat 本地网络
    hardhat: {
      chainId: 31337,
      accounts: [
        { privateKey: LOCAL_KEY_0 }, 
        { privateKey: LOCAL_KEY_1 }
      ]
    },

    // 连接本地节点
    localhost: {
      url: LOCAL_RPC_URL,
      accounts: [LOCAL_KEY_0, LOCAL_KEY_1],
      chainId: 31337
    },

    // Sepolia 测试网
    sepolia: {
      url: SEPOLIA_URL,
      accounts: [SEPOLIA_KEY, SEPOLIA_KEY_2],
      chainId: 11155111,
      timeout: 60000
    }
  },

  etherscan: {
    apiKey: {
      sepolia: ETHERSCAN_API_KEY
    }
  }
};
