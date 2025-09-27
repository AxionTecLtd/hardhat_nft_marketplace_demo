
// D:\projects\hardhat_nft_marketplace\hardhat-nft\backend\routes\users.js
const express = require('express');
const router = express.Router();
const pool = require('../db');
// routes/users.js
const { ethers } = require('ethers');   // ✅ 单独导入 ethers
const { lazyNFT, lazyNFTAddress } = require('../contracts');

const { createVoucher } = require('../utils/voucher');

// POST /api/voucher
router.post('/', async (req, res) => {
    try {
        const { tokenURI, minPrice, nonce, creatorPrivateKey } = req.body;
        if (!tokenURI || !minPrice || !nonce || !creatorPrivateKey) {
            return res.status(400).json({ error: "缺少参数" });
        }

        const { voucher, signature } = await createVoucher(tokenURI, minPrice, nonce, creatorPrivateKey);

        res.json({ voucher, signature });
    } catch (err) {
        console.error('生成 Voucher 失败:', err);
        res.status(500).json({ error: err.message });
    }
});

// 用户 NFT 列表
router.get('/:address/nfts', async (req, res) => {
    const { address } = req.params;
    const { page = 1, limit = 6 } = req.query;
    const offset = (page-1)*limit;
    const result = await pool.query(`SELECT * FROM nfts WHERE current_owner=$1 OR creator_address=$1 ORDER BY token_id DESC LIMIT $2 OFFSET $3`, [address, limit, offset]);
    res.json(result.rows);
});

// 上传/预列 NFT
router.post('/:address/nfts', async (req, res) => {
    try {
        const { address } = req.params;
        const { title, image_url, story, price, type, royalty_percent } = req.body;

        // 临时用默认合约地址
        const contract_address = '0x0000000000000000000000000000000000000000';

        const result = await pool.query(
            `INSERT INTO nfts(title,image_url,story,price,type,royalty_percent,creator_address,current_owner,contract_address,status)
             VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'Pre-list') RETURNING *`,
            [title, image_url, story, price, type, royalty_percent, address, address, contract_address]
        );

        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});




// Mint NFT 链上
// router.post('/:address/nfts/:tokenId/mint', async (req,res) => {
//     const { address, tokenId } = req.params;
//     const { minPrice, voucherSignature, buyerPrivateKey } = req.body;
//     const wallet = new ethers.Wallet(buyerPrivateKey, lazyNFT.provider);
//     const lazyWithWallet = lazyNFT.connect(wallet);
//     const tx = await lazyWithWallet.redeem({/* voucher数据填充 */}, voucherSignature, { value: ethers.parseEther(minPrice.toString()) });
//     await tx.wait();
//     await pool.query(`UPDATE nfts SET status='Minted', current_owner=$1 WHERE token_id=$2`, [address, tokenId]);
//     res.json({ success:true, txHash: tx.hash });
// });
// Mint NFT 链上
// D:\projects\hardhat_nft_marketplace\hardhat-nft\backend\routes\users.js

router.post('/:address/nfts/:tokenId/mint', async (req,res) => {
    const { address, tokenId } = req.params;
    const { minPrice, voucherSignature, buyerPrivateKey, voucher } = req.body;

    try {
        const wallet = new ethers.Wallet(buyerPrivateKey, lazyNFT.provider);
        const lazyWithWallet = lazyNFT.connect(wallet);

        // ✅ 铸造 NFT，这一行就是你提到的
        const tx = await lazyWithWallet.redeem(voucher, voucherSignature, { 
            value: ethers.parseEther(minPrice.toString())
        });

        await tx.wait();

        await pool.query(
            `UPDATE nfts SET status='Minted', current_owner=$1 WHERE token_id=$2`,
            [address, tokenId]
        );

        res.json({ success:true, txHash: tx.hash });
    } catch (err) {
        console.error('Mint NFT 失败:', err);
        res.status(500).json({ error: err.message });
    }
});


// 删除 NFT
router.delete('/:address/nfts/:tokenId', async (req,res) => {
    const { tokenId } = req.params;
    await pool.query(`DELETE FROM nfts WHERE token_id=$1`, [tokenId]);
    res.json({ success:true });
});

module.exports = router;
