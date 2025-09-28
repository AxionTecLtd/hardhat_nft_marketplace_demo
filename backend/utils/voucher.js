// backend/utils/voucher.js 后端签名 helper
const { ethers } = require('ethers');
const { provider, lazyNFTAddress } = require('../contracts');

/**
 * create voucher using a private key on server side (for testing / hot-wallet scenarios)
 */
async function createVoucherServer(creatorPrivateKey, tokenURI, minPriceInEth, creatorAddress, nonce) {
  const wallet = new ethers.Wallet(creatorPrivateKey);
  const net = await provider.getNetwork();
  const chainId = Number(net.chainId);

  const domain = { name: "LazyNFT", version: "1", chainId, verifyingContract: lazyNFTAddress };
  const types = {
    NFTVoucher: [
      { name: "tokenURI", type: "string" },
      { name: "minPrice", type: "uint256" },
      { name: "creator", type: "address" },
      { name: "nonce", type: "uint256" }
    ]
  };

  const minPriceWei = ethers.parseEther(String(minPriceInEth));
  const voucher = {
    tokenURI,
    minPrice: minPriceWei,
    creator: creatorAddress,
    nonce: BigInt(nonce)
  };

  const signature = await wallet._signTypedData(domain, types, voucher);
  return { voucher, signature, minPriceWei: minPriceWei.toString() };
}

module.exports = { createVoucherServer };
