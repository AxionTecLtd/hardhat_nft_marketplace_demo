// D:\projects\hardhat_nft_marketplace\hardhat-nft\backend\routes\nfts.js
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { ethers, lazyNFT, marketplace, lazyNFTAddress } = require('../contracts');

// 确认地址
console.log('lazyNFTAddress:', lazyNFTAddress);
console.log('lazyNFT:', lazyNFT);
console.log('marketplace:', marketplace);


// 获取 NFT 列表
router.get('/', async (req, res) => {
    const { page = 1, limit = 6 } = req.query;
    const offset = (page - 1) * limit;
    const result = await pool.query(`SELECT * FROM nfts ORDER BY token_id DESC LIMIT $1 OFFSET $2`, [limit, offset]);
    res.json(result.rows);
});

// 点赞
router.post('/:tokenId/like', async (req, res) => {
    const { tokenId } = req.params;
    await pool.query(`UPDATE nfts SET likes = COALESCE(likes,0)+1 WHERE token_id=$1`, [tokenId]);
    res.json({ success: true });
});

// 想要
router.post('/:tokenId/want', async (req, res) => {
    const { tokenId } = req.params;
    await pool.query(`UPDATE nfts SET wants = COALESCE(wants,0)+1 WHERE token_id=$1`, [tokenId]);
    res.json({ success: true });
});

// 购买
router.post('/:tokenId/buy', async (req, res) => {
    const { tokenId } = req.params;
    const { buyerPrivateKey } = req.body;
    const nft = await pool.query(`SELECT * FROM nfts WHERE token_id=$1`, [tokenId]);
    if(!nft.rows.length) return res.status(404).json({ error: 'NFT not found' });
    const nftData = nft.rows[0];
    const wallet = new ethers.Wallet(buyerPrivateKey, lazyNFT.provider);
    const marketplaceWithBuyer = marketplace.connect(wallet);
    const priceInWei = ethers.parseEther(nftData.price.toString());
    const tx = await marketplaceWithBuyer.buyItem(lazyNFTAddress, tokenId, { value: priceInWei });
    await tx.wait();
    await pool.query(`UPDATE nfts SET current_owner=$1 WHERE token_id=$2`, [wallet.address, tokenId]);
    await pool.query(`INSERT INTO transactions(token_id,buyer_address,price) VALUES($1,$2,$3)`, [tokenId, wallet.address, nftData.price]);
    res.json({ success: true, txHash: tx.hash });
});

module.exports = router;
