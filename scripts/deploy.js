// scripts/deploy.js
const hre = require("hardhat");

async function main() {
  // 获取部署者账户
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  // ---------------- LazyNFT ----------------
  const LazyNFT = await hre.ethers.getContractFactory("LazyNFT");
  const lazyNFT = await LazyNFT.deploy();
  await lazyNFT.waitForDeployment();
  console.log("LazyNFT deployed to:", lazyNFT.target);

  // ---------------- Marketplace ----------------
  const Marketplace = await hre.ethers.getContractFactory("Marketplace");
  const marketplace = await Marketplace.deploy();
  await marketplace.waitForDeployment();
  console.log("Marketplace deployed to:", marketplace.target);

  // 可选：打印两个合约地址
  console.log("All contracts deployed successfully!");
  console.log("LazyNFT address:", lazyNFT.target);
  console.log("Marketplace address:", marketplace.target);
}

// 捕获错误
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
