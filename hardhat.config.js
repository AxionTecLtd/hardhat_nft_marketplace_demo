require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config(); // 自动加载根目录 .env 文件

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.28",
  networks: {
    localhost: {
      url: process.env.RPC_URL || "http://127.0.0.1:8545",
      accounts: [
        process.env.LOCAL_KEY_0,
        process.env.LOCAL_KEY_1
      ].filter(Boolean),
    },
    sepolia: {
      url: process.env.SEPOLIA_URL || "",
      accounts: [
        process.env.SEPOLIA_KEY_2
      ].filter(Boolean),
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY || "",
  },
};
