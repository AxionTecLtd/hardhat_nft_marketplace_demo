const { ethers } = require("hardhat");
const { expect } = require("chai");

describe("LazyNFT Contract", function () {
  let deployer, user1, user2;
  let lazyNFT;

  beforeEach(async () => {
    [deployer, user1, user2] = await ethers.getSigners();
    console.log("Deployer:", deployer.address);
    console.log("User1:", user1.address);
    console.log("User2:", user2.address);

    const LazyNFT = await ethers.getContractFactory("LazyNFT");
    lazyNFT = await LazyNFT.deploy();
    await lazyNFT.waitForDeployment();
    console.log("LazyNFT deployed to:", lazyNFT.target);
  });

  it("Should batch mint NFTs to multiple addresses", async () => {
    const recipients = [user1.address, user2.address];
    const uris = ["https://example.com/nft1.json", "https://example.com/nft2.json"];
    const tx = await lazyNFT.batchMint(recipients, uris);
    await tx.wait();

    console.log("Batch mint completed");
    expect(await lazyNFT.tokenURI(1)).to.equal(uris[0]);
    expect(await lazyNFT.tokenURI(2)).to.equal(uris[1]);
    console.log("Token 1 URI:", await lazyNFT.tokenURI(1));
    console.log("Token 2 URI:", await lazyNFT.tokenURI(2));
  });

  it("Should redeem lazy minted NFT with valid signature", async () => {
    const voucher = {
      tokenURI: "https://example.com/lazyNFT.json",
      minPrice: ethers.parseEther("0.01"),
      creator: deployer.address,
      nonce: 1
    };

    // EIP712 domain
    const network = await deployer.provider.getNetwork();
    const domain = {
      name: "LazyNFT",
      version: "1",
      chainId: Number(network.chainId),
      verifyingContract: lazyNFT.target
    };

    const types = {
      NFTVoucher: [
        { name: "tokenURI", type: "string" },
        { name: "minPrice", type: "uint256" },
        { name: "creator", type: "address" },
        { name: "nonce", type: "uint256" }
      ]
    };

    // 用 ethers v6 的 signTypedData
    const signature = await deployer.signTypedData(domain, types, voucher);

    // 调用 redeem
    const tx = await lazyNFT.connect(user1).redeem(voucher, signature, { value: voucher.minPrice });
    const receipt = await tx.wait();

    // 解析 Minted 事件
    const event = receipt.logs
      .map(log => {
        try {
          return lazyNFT.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find(e => e && e.name === "Minted");

    const tokenId = event.args.tokenId;
    console.log("Redeem completed. Token ID:", tokenId.toString());

    expect(await lazyNFT.tokenURI(tokenId)).to.equal(voucher.tokenURI);
  });

  it("Should burn an NFT", async () => {
    await lazyNFT.batchMint([user1.address], ["https://example.com/nft.json"]);
    await (await lazyNFT.connect(user1).burn(1)).wait();
    console.log("Token 1 burned");
    await expect(lazyNFT.ownerOf(1)).to.be.reverted;
  });

  it("Should freeze token and prevent transfer", async () => {
    await lazyNFT.batchMint([user1.address], ["https://example.com/nft.json"]);
    await (await lazyNFT.freeze(1)).wait();
    console.log("Token 1 frozen");

    await expect(
      lazyNFT.connect(user1).transferFrom(user1.address, user2.address, 1)
    ).to.be.revertedWith("Token is frozen");
  });

  it("Should correctly return royalty info", async () => {
    await lazyNFT.batchMint([user1.address], ["https://example.com/nft.json"]);

    // 设置版税
    await lazyNFT.setTokenRoyaltyPublic(1, deployer.address, 500); // 5%
    const royalty = await lazyNFT.royaltyInfo(1, ethers.parseEther("1"));

    console.log("Royalty receiver:", royalty[0]);
    console.log("Royalty amount (ETH):", ethers.formatEther(royalty[1]));
    expect(royalty[0]).to.equal(deployer.address);
  });
});
