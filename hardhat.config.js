
require("dotenv").config();
require("@nomicfoundation/hardhat-toolbox")
// 除非加上下面，否则部署时候请在根目录执行，别的地方读取不到
require("dotenv").config({ path: require("path").resolve(__dirname, ".env") });

// 调试用
// console.log("DEBUG ENV:", process.env.LOCAL_KEY_0, process.env.SEPOLIA_URL);

// 引入环境变量
const SEPOLIA_URL = process.env.SEPOLIA_URL;
const SEPOLIA_KEY = process.env.SEPOLIA_KEY;
const SEPOLIA_KEY_2 = process.env.SEPOLIA_KEY_2;
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;

const LOCAL_RPC_URL = process.env.LOCAL_RPC_URL;
const LOCAL_KEY_0 = process.env.LOCAL_KEY_0;
const LOCAL_KEY_1 = process.env.LOCAL_KEY_1;

module.exports = {
  solidity: "0.8.24",
  networks: {
    hardhat: {
      chainId: 31337
    },

    localhost: {
      url: LOCAL_RPC_URL,
      accounts: [LOCAL_KEY_0, LOCAL_KEY_1],  // ✅ 传私钥，而不是地址
      chainId: 31337
    },

    sepolia: {
      url: SEPOLIA_URL,
      accounts: [SEPOLIA_KEY, SEPOLIA_KEY_2], // ✅ 传私钥，而不是地址
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
