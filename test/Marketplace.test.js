const { ethers } = require("hardhat");
const { expect } = require("chai");

describe("Marketplace Integration Test", function () {
  let deployer, user1, user2;
  let lazyNFT, marketplace;

  beforeEach(async () => {
    [deployer, user1, user2] = await ethers.getSigners();

    // 部署 LazyNFT
    const LazyNFT = await ethers.getContractFactory("LazyNFT");
    lazyNFT = await LazyNFT.deploy();
    await lazyNFT.waitForDeployment();

    // 部署 Marketplace
    const Marketplace = await ethers.getContractFactory("Marketplace");
    marketplace = await Marketplace.deploy();
    await marketplace.waitForDeployment();

    // batch mint NFT 给 user1
    await (await lazyNFT.batchMint([user1.address], ["https://example.com/nft1.json"])).wait();

    // 设置 NFT 1 版税 5%
    await lazyNFT.setTokenRoyaltyPublic(1, deployer.address, 500);
  });

  it("Should list an NFT for sale", async () => {
    // user1 授权 marketplace
    await lazyNFT.connect(user1).setApprovalForAll(marketplace.target, true);

    await marketplace.connect(user1).listItem(lazyNFT.target, 1, ethers.parseEther("1"));

    const listing = await marketplace.getListing(lazyNFT.target, 1);
    expect(listing.seller).to.equal(user1.address);
    expect(listing.price).to.equal(ethers.parseEther("1"));
  });

 it("Should buy an NFT and pay royalty", async () => {
    await lazyNFT.connect(user1).setApprovalForAll(marketplace.target, true);
    const price = ethers.parseEther("1");
    await marketplace.connect(user1).listItem(lazyNFT.target, 1, price);

    const deployerBalanceBefore = await ethers.provider.getBalance(deployer.address);
    const user1BalanceBefore = await ethers.provider.getBalance(user1.address);

    const tx = await marketplace.connect(user2).buyItem(lazyNFT.target, 1, { value: price });
    const receipt = await tx.wait();

    // NFT 转账
    expect(await lazyNFT.ownerOf(1)).to.equal(user2.address);

    // 版税
    const royalty = await lazyNFT.royaltyInfo(1, price);
    const royaltyAmount = royalty[1];

    const deployerBalanceAfter = await ethers.provider.getBalance(deployer.address);
    expect(deployerBalanceAfter - deployerBalanceBefore).to.equal(royaltyAmount);

    const user1BalanceAfter = await ethers.provider.getBalance(user1.address);
    expect(user1BalanceAfter - user1BalanceBefore).to.equal(price - royaltyAmount);
});


  it("Should prevent listing frozen NFT", async () => {
    await lazyNFT.freeze(1);
    await lazyNFT.connect(user1).setApprovalForAll(marketplace.target, true);

    await expect(
      marketplace.connect(user1).listItem(lazyNFT.target, 1, ethers.parseEther("1"))
    ).to.be.revertedWith("Token is frozen");
  });

  it("Should cancel a listing", async () => {
    await lazyNFT.connect(user1).setApprovalForAll(marketplace.target, true);
    await marketplace.connect(user1).listItem(lazyNFT.target, 1, ethers.parseEther("1"));

    await marketplace.connect(user1).cancelListing(lazyNFT.target, 1);

    const listing = await marketplace.getListing(lazyNFT.target, 1);
    expect(listing.price).to.equal(0);
  });

  it("Should revert if non-owner tries to cancel listing", async () => {
    await lazyNFT.connect(user1).setApprovalForAll(marketplace.target, true);
    await marketplace.connect(user1).listItem(lazyNFT.target, 1, ethers.parseEther("1"));

    await expect(
      marketplace.connect(user2).cancelListing(lazyNFT.target, 1)
    ).to.be.revertedWith("Not seller");
  });

  it("Should revert if trying to buy unlisted NFT", async () => {
    await expect(
      marketplace.connect(user2).buyItem(lazyNFT.target, 1, { value: ethers.parseEther("1") })
    ).to.be.revertedWith("Not listed");
  });

  it("Should revert if buyer pays insufficient amount", async () => {
    await lazyNFT.connect(user1).setApprovalForAll(marketplace.target, true);
    await marketplace.connect(user1).listItem(lazyNFT.target, 1, ethers.parseEther("1"));

    await expect(
      marketplace.connect(user2).buyItem(lazyNFT.target, 1, { value: ethers.parseEther("0.5") })
    ).to.be.revertedWith("Insufficient payment");
  });
});
