const express = require('express');
const router = express.Router();
const db = require('../db');

// 收藏 / 取消收藏
router.post('/want', async (req, res) => {
    const { user_address, nft_id, ip_address, user_agent } = req.body;
    if (!user_address || !nft_id) {
        return res.status(400).json({ success: false, error: '参数缺失' });
    }

    try {
        const now = new Date();
        const existing = await db.query(
            `SELECT id, status FROM xlnft_wants WHERE user_address=$1 AND nft_id=$2`,
            [user_address, nft_id]
        );

        let newStatus = 1;
        if (existing.rowCount > 0) {
            newStatus = existing.rows[0].status === 1 ? 0 : 1;
            await db.query(
                `UPDATE xlnft_wants SET status=$1, updated_at=$2, ip_address=$3, user_agent=$4 WHERE id=$5`,
                [newStatus, now, ip_address, user_agent, existing.rows[0].id]
            );
        } else {
            await db.query(
                `INSERT INTO xlnft_wants(user_address, nft_id, status, created_at, updated_at, ip_address, user_agent)
                 VALUES($1,$2,$3,$4,$5,$6,$7)`,
                [user_address, nft_id, newStatus, now, now, ip_address, user_agent]
            );
        }

        const countResult = await db.query(
            `SELECT COUNT(*) AS wants FROM xlnft_wants WHERE nft_id=$1 AND status=1`,
            [nft_id]
        );
        const wants = parseInt(countResult.rows[0].wants);

        return res.json({ success: true, status: newStatus, wants });
    } catch (err) {
        console.error('❌ 收藏失败:', err);
        return res.status(500).json({ success: false, error: '系统错误' });
    }
});

// 获取 Top Wants
router.get('/top', async (req, res) => {
    const limit = parseInt(req.query.limit) || 10;

    try {
        const result = await db.query(`
            SELECT n.nft_id, n.title, COUNT(w.id) AS wants
            FROM nfts n
            LEFT JOIN xlnft_wants w
              ON n.nft_id = w.nft_id AND w.status = 1
            WHERE n.is_deleted = 0
            GROUP BY n.nft_id, n.title
            ORDER BY wants DESC
            LIMIT $1
        `, [limit]);

        const data = result.rows.map(r => ({
            nft_id: r.nft_id,
            title: r.title,
            wants: parseInt(r.wants)
        }));

        return res.json({ success: true, data });
    } catch (err) {
        console.error('❌ 获取 Top Wants 失败:', err);
        return res.status(500).json({ success: false, error: '系统错误' });
    }
});

module.exports = router;
