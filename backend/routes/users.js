// mynft 页面的后端处理路由
// D:\projects\hardhat_nft_marketplace\hardhat-nft\backend\routes\users.js 
// D:\projects\hardhat_nft_marketplace\hardhat-nft\.env
// 测试用
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env'), override: true });
// 私钥地址 用来签署生成凭证
const LOCAL_CREATOR_PRIVATE_KEY =process.env.LOCAL_CREATOR_PRIVATE_KEY;

const express = require('express');
const router = express.Router();
const pool = require('../db');
// routes/users.js
const { ethers } = require('ethers');   // ✅ 单独导入 ethers
const { lazyNFT, lazyNFTAddress,provider } = require('../contracts');



// =============== ============= 
//    一 、 MyNFT 页面 初始化
// ============================= 
//  1.初始化 MyNFT 页面,提供当前用户的 NFT 列表 ok
router.get('/:address/nfts', async (req, res) => {
    const { address } = req.params;
    const { page = 1, limit = 6 } = req.query;
    const offset = (page-1)*limit;
    const result = await pool.query(`SELECT * FROM nfts WHERE is_deleted = 0 AND (current_owner=$1 OR creator_address=$1) ORDER BY token_id DESC LIMIT $2 OFFSET $3`, [address, limit, offset]);
    res.json(result.rows);
});


// =============== ============= 
//    二、 MyNFT 懒铸造
// ============================= 

// // =======最小可用版本 入库 ===========
// router.post('/:address/nfts/lazy', async (req, res) => {
//     try {
//         const { address } = req.params;
//         const { title, image_url, story, price, type, royalty_percent } = req.body;

//         const nftResult = await pool.query(
//             `INSERT INTO nfts(title,image_url,story,price,type,royalty_percent,creator_address,current_owner,contract_address,status,is_deleted)
//              VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'Pre-list',0) RETURNING *`,
//             [title, image_url, story, price, type, royalty_percent, address, address, lazyNFTAddress]
//         );

//         res.json({ nft: nftResult.rows[0] });
//     } catch (err) {
//         console.error("懒铸造 NFT 上传失败:", err);
//         res.status(500).json({ error: err.message || '服务器内部错误' });
//     }
// });



// =======真正要的 懒铸造 NFT 功能 ==================
// 要实现 懒铸造 NFT 功能，包括前端上传表单、后端存数据库、生成 voucher 凭证
// 2.创作者上传 懒铸造 NFT
// 创作者上传 → 选懒铸造 Pre-list 按钮 → 调用 POST /:address/nfts/lazy → 预览状态
// 把 Pre-list NFT 数据存进 PostgreSQL 的 nfts 表。状态是 Pre-list.同时生成 voucher 凭证并存 voucher 表


// ================ 懒铸造 NFT 接口 ========================
router.post('/:address/nfts/lazy', async (req, res) => {
    const client = await pool.connect();
    try {
        const { address } = req.params;
        const { title, image_url, story, price, type, royalty_percent } = req.body;

        console.log(`[${new Date().toISOString()}] 📩 收到懒铸造请求:`, { address, title, price, type });

        // ✅ 基础参数校验
        if (!address) throw new Error("缺少创作者地址 address");
        if (!title || !image_url || !price) throw new Error("缺少必要字段 (title, image_url, price)");
        if (isNaN(price)) throw new Error("价格必须是数字");

        // ✅ 获取新的 token_id（避免 null）
        const tokenIdResult = await client.query(`SELECT COALESCE(MAX(token_id), 0) + 1 AS next_token_id FROM nfts`);
        const tokenId = tokenIdResult.rows[0].next_token_id;

        console.log(`[${new Date().toISOString()}] 🆕 生成新的 tokenId: ${tokenId}`);

        // ✅ 插入 NFT 数据（状态 Pre-list）
        const nftResult = await client.query(
            `INSERT INTO nfts(token_id, title, image_url, story, price, type, royalty_percent, creator_address, current_owner, contract_address, status)
             VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'Pre-list') RETURNING *`,
            [tokenId, title, image_url, story, price, type, royalty_percent || 0, address, address, lazyNFTAddress]
        );
        const nft = nftResult.rows[0];

        console.log(`[${new Date().toISOString()}] ✅ NFT 已存入数据库: nft_id=${nft.nft_id}, tokenId=${nft.token_id}`);

        // ✅ 生成 Voucher（签名凭证）
        const uri = image_url; // 这里可以换成 metadata JSON URL
        const voucher = await createVoucher(nft.token_id, price, uri);

        // ✅ 存 Voucher 数据
        const voucherResult = await client.query(
            `INSERT INTO vouchers(token_id, min_price, uri, signature, creator_address, status)
             VALUES($1,$2,$3,$4,$5,'Active') RETURNING *`,
            [nft.token_id, price.toString(), uri, voucher.signature, address]
        );

        console.log(`[${new Date().toISOString()}] 📝 Voucher 已生成: tokenId=${nft.token_id}`);

        // ✅ 返回结果
        res.json({
            message: "懒铸造 NFT 成功",
            nft,
            voucher: voucherResult.rows[0]
        });

    } catch (err) {
        console.error(`[${new Date().toISOString()}] ❌ 懒铸造 NFT 失败:`, err);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});


// ================ 生成 voucher 凭证 ========================
async function createVoucher(tokenId, minPrice, uri) {
    try {
        console.log(`[${new Date().toISOString()}] 🔑 开始生成 Voucher: tokenId=${tokenId}, price=${minPrice}`);

        const creatorWallet = new ethers.Wallet(process.env.LOCAL_CREATOR_PRIVATE_KEY, provider);

        const domain = {
            name: 'LazyNFT-Voucher',
            version: '1',
            chainId: 31337, // Hardhat 本地链
            verifyingContract: lazyNFTAddress
        };

        const types = {
            NFTVoucher: [
                { name: 'tokenId', type: 'uint256' },
                { name: 'minPrice', type: 'uint256' },
                { name: 'uri', type: 'string' }
            ]
        };

        const value = {
            tokenId,
            minPrice: ethers.parseEther(minPrice.toString()), // 转 wei
            uri
        };

        const signature = await creatorWallet.signTypedData(domain, types, value);

        console.log(`[${new Date().toISOString()}] ✅ Voucher 签名完成: tokenId=${tokenId}`);
        return { tokenId, minPrice, uri, signature };

    } catch (err) {
        console.error(`[${new Date().toISOString()}] ❌ Voucher 生成失败:`, err);
        throw err;
    }
}




// =========================== Marketplace 页面交互 ============================
// 买家购买 NFT
// 买家调用 -> 查 voucher -> 调用 redeem -> 更新两个表
// router.post('/:address/nfts/:tokenId/buy', async (req, res) => {
//     const { address, tokenId } = req.params;
//     const { buyerPrivateKey } = req.body;

//     try {
//         // 取 voucher
//         const vRes = await pool.query(
//             `SELECT * FROM vouchers WHERE token_id=$1 AND status='Active'`,
//             [tokenId]
//         );
//         if (vRes.rows.length === 0) {
//             return res.status(404).json({ error: "凭证不存在或已失效" });
//         }
//         const voucher = vRes.rows[0];

//         // 链上调用
//         const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
//         const wallet = new ethers.Wallet(buyerPrivateKey, provider);
//         const lazyWithWallet = lazyNFT.connect(wallet);

//         const tx = await lazyWithWallet.redeem(
//             {
//                 tokenId: voucher.token_id,
//                 minPrice: ethers.parseEther(voucher.min_price.toString()),
//                 uri: voucher.uri
//             },
//             voucher.signature,
//             { value: ethers.parseEther(voucher.min_price.toString()) }
//         );
//         await tx.wait();

//         // 更新 nfts 表
//         await pool.query(
//             `UPDATE nfts SET status='Minted', current_owner=$1 WHERE token_id=$2`,
//             [address, tokenId]
//         );

//         // 更新 voucher 状态
//         await pool.query(
//             `UPDATE vouchers SET status='Used' WHERE token_id=$1`,
//             [tokenId]
//         );

//         res.json({ success: true, txHash: tx.hash });
//     } catch (err) {
//         console.error("购买 NFT 出错:", err);
//         res.status(500).json({ error: err.message });
//     }
// });




// =========================== 买家购买 NFT ============================
router.post('/marketplace/buy', async (req, res) => {
    const client = await pool.connect();
    try {
        const { buyerAddress, tokenId } = req.body;
        if (!buyerAddress || !tokenId) throw new Error("缺少 buyerAddress 或 tokenId");

        // 查询 voucher
        const voucherResult = await client.query(
            `SELECT * FROM vouchers WHERE token_id=$1 AND status='Active'`,
            [tokenId]
        );
        if (voucherResult.rowCount === 0) throw new Error("Voucher 不存在或已失效");
        const voucherRow = voucherResult.rows[0];

        // 链上合约实例
        const contract = new ethers.Contract(lazyNFTAddress, LazyNFT_ABI, provider);
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
            // NFT 未铸造 → redeem
            const nftVoucher = {
                tokenURI: voucherRow.uri,
                minPrice: ethers.parseEther(voucherRow.min_price.toString()),
                creator: voucherRow.creator,
                nonce: voucherRow.nonce
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
        await client.query(`UPDATE vouchers SET status='Used' WHERE token_id=$1`, [tokenId]);

        res.json({
            success: true,
            txHash: receipt.transactionHash,
            buyer: buyerAddress,
            tokenId
        });
    } catch (err) {
        console.error("购买失败:", err);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});



// =============================== 
//    二、 MyNFT主页 删除 NFT ok
// ============================= 
// 建议逻辑删除 链下，链上只要不销毁都会在的
// 删除 NFT（逻辑删除，仅链下）

router.delete('/:address/nfts/:nftId', async (req, res) => {
    try {
        const { nftId  } = req.params;

        // 更新数据库 is_deleted 标记
        await pool.query(
            `UPDATE nfts SET is_deleted = 1 WHERE nft_id = $1`,
            [nftId]
        );

        res.json({ success: true, message: 'NFT 已删除（逻辑删除）' });
    } catch (err) {
        console.error("删除 NFT 失败:", err);
        res.status(500).json({ success: false, error: err.message || '服务器内部错误' });
    }
});


module.exports = router;
