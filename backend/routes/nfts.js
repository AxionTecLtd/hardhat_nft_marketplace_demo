// D:\projects\hardhat_nft_marketplace\hardhat-nft\backend\routes\nfts.js
const express = require('express');
const router = express.Router();
const pool = require('../db'); // PostgreSQL pool
const { ethers } = require('ethers');
const { lazyNFT, marketplace, lazyNFTAddress, lazyNFTAbi, provider } = require('../contracts');

// --------------------------
// 调试输出
// --------------------------
console.log('lazyNFTAddress:', lazyNFTAddress);
console.log('lazyNFT:', lazyNFT);
console.log('marketplace:', marketplace);

// --------------------------
// 获取 NFT 列表
// --------------------------
router.get('/', async (req, res) => {
    const { page = 1, limit = 6 } = req.query;
    const offset = (page - 1) * limit;
    const result = await pool.query(
        `SELECT * FROM nfts WHERE is_deleted = 0 ORDER BY token_id DESC LIMIT $1 OFFSET $2`,
        [limit, offset]
    );
    res.json(result.rows);
});

// --------------------------
// 点赞
// --------------------------
router.post('/:tokenId/like', async (req, res) => {
    const { tokenId } = req.params;
    await pool.query(`UPDATE nfts SET likes = COALESCE(likes,0)+1 WHERE token_id=$1`, [tokenId]);
    res.json({ success: true });
});

// --------------------------
// 收藏
// --------------------------
router.post('/:tokenId/want', async (req, res) => {
    const { tokenId } = req.params;
    await pool.query(`UPDATE nfts SET wants = COALESCE(wants,0)+1 WHERE token_id=$1`, [tokenId]);
    res.json({ success: true });
});
// ===========================
// 买家购买 NFT
// POST /api/nfts/marketplace/buy
// ===========================
router.post('/marketplace/buy', async (req, res) => {
    const client = await pool.connect();
    try {
        const { buyerAddress, tokenId } = req.body;

        if (!buyerAddress || !tokenId) {
            return res.status(400).json({ success: false, error: "缺少 buyerAddress 或 tokenId" });
        }

        console.log(`[${new Date().toISOString()}] 📩 收到购买请求: buyer=${buyerAddress}, tokenId=${tokenId}`);

        // 查询 voucher
        const voucherResult = await client.query(
            `SELECT * FROM vouchers WHERE token_id=$1 AND status='Active'`,
            [tokenId]
        );

        if (voucherResult.rowCount === 0) {
            return res.status(404).json({ success: false, error: "Voucher 不存在或已失效" });
        }

        const voucherRow = voucherResult.rows[0];

        // 链上合约实例
        const contract = lazyNFT; // 你已经在 contracts.js 中创建好实例
        const buyerWallet = new ethers.Wallet(process.env.LOCAL_BUYER_PRIVATE_KEY, provider);
        const contractWithBuyer = contract.connect(buyerWallet);

        // 检查 NFT 是否已铸造
        let owner;
        try {
            owner = await contract.ownerOf(tokenId);
        } catch {
            owner = null; // NFT 尚未铸造
        }

        let tx;
        if (!owner) {
            // NFT 未铸造 → 调用 redeem
            const nftVoucher = {
                tokenId: voucherRow.token_id,
                minPrice: ethers.parseEther(voucherRow.min_price.toString()),
                uri: voucherRow.uri
            };
            tx = await contractWithBuyer.redeem(nftVoucher, voucherRow.signature, {
                value: ethers.parseEther(voucherRow.min_price.toString())
            });
        } else {
            // NFT 已铸造 → Marketplace buyItem
            tx = await marketplace.connect(buyerWallet).buyItem(lazyNFTAddress, tokenId, {
                value: ethers.parseEther(voucherRow.min_price.toString())
            });
        }

        const receipt = await tx.wait();

        // 更新数据库
        await client.query(
            `UPDATE nfts SET current_owner=$1, status='Sold' WHERE token_id=$2`,
            [buyerAddress, tokenId]
        );

        await client.query(
            `UPDATE vouchers SET status='Used' WHERE token_id=$1`,
            [tokenId]
        );

        res.json({
            success: true,
            txHash: receipt.transactionHash,
            buyer: buyerAddress,
            tokenId
        });

    } catch (err) {
        console.error(`[${new Date().toISOString()}] ❌ 购买失败:`, err);
        res.status(500).json({ success: false, error: err.message });
    } finally {
        client.release();
    }
});

module.exports = router;
