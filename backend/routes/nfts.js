// D:\projects\hardhat_nft_marketplace\hardhat-nft\backend\routes\nfts.js
const express = require('express');
const router = express.Router();
const pool = require('../db'); // PostgreSQL pool
const { ethers } = require('ethers');
const { lazyNFT, marketplace, provider, lazyNFTAddress, marketplaceAddress } = require('../contracts');

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
router.post('/:nft_id/like', async (req, res) => {
    const { nft_id } = req.params;
    await pool.query(`UPDATE nfts SET likes = COALESCE(likes,0)+1 WHERE token_id=$1`, [nft_id]);
    res.json({ success: true });
});

// --------------------------
// 收藏
// --------------------------
router.post('/:nft_id/want', async (req, res) => {
    const { nft_id } = req.params;
    await pool.query(`UPDATE nfts SET wants = COALESCE(wants,0)+1 WHERE token_id=$1`, [nft_id]);
    res.json({ success: true });
});


// ===========================
// 买家购买 NFT
// POST /api/nfts/marketplace/buy
// ===========================


// router.post('/marketplace/buy', async (req, res) => {
//     const client = await pool.connect();
//     try {
//         const { buyerAddress, nft_id } = req.body;
//         console.log(`[${new Date().toISOString()}] 📩 收到购买请求: buyer=${buyerAddress}, nft_id=${nft_id}`);

//         if (!buyerAddress || !nft_id) {
//             console.warn(`[${new Date().toISOString()}] ❌ 请求缺少 buyerAddress 或 nft_id`);
//             return res.status(400).json({ success: false, error: "缺少 buyerAddress 或 nft_id" });
//         }

//         // =============================
//         // 1. 查询 NFT
//         // =============================
//         const nftResult = await client.query(`SELECT * FROM nfts WHERE nft_id=$1`, [nft_id]);
//         if (nftResult.rowCount === 0) {
//             console.warn(`[${new Date().toISOString()}] ❌ NFT 不存在: nft_id=${nft_id}`);
//             return res.status(404).json({ success: false, error: "NFT 不存在" });
//         }
//         const nft = nftResult.rows[0];
//         console.log(`[${new Date().toISOString()}] ✅ NFT 信息:`, nft);

//         // =============================
//         // 2. 查询 Voucher
//         // =============================
//         const voucherResult = await client.query(
//             `SELECT * FROM vouchers WHERE nft_id=$1 AND status='Active'`,
//             [nft_id]
//         );
//         if (voucherResult.rowCount === 0) {
//             console.warn(`[${new Date().toISOString()}] ❌ Voucher 不存在或已失效: nft_id=${nft_id}`);
//             return res.status(404).json({ success: false, error: "Voucher 不存在或已失效" });
//         }
//         const voucherRow = voucherResult.rows[0];
//         console.log(`[${new Date().toISOString()}] ✅ Voucher 信息:`, voucherRow);

//         // =============================
//         // 3. 准备 buyer 钱包
//         // =============================
//         const buyerWallet = new ethers.Wallet(process.env.LOCAL_BUYER_PRIVATE_KEY, provider);
//         console.log(`[${new Date().toISOString()}] 👜 Buyer 钱包地址: ${buyerWallet.address}`);

//         let tx;
//         let tokenIdOnChain;

//         // =============================
//         // 4. 判断 NFT 是否已铸造
//         // =============================
//         if (!nft.token_id) {
//             console.log(`[${new Date().toISOString()}] 🔑 NFT 未铸造，调用 LazyNFT redeem 铸造...`);

//             const contractWithBuyer = lazyNFT.connect(buyerWallet);

//             // 构建 voucher 数据
//             const nftVoucher = {
//                 tokenURI: voucherRow.token_uri,
//                 minPrice: ethers.parseEther(voucherRow.min_price.toString()),
//                 creator: voucherRow.creator_address,
//                 nonce: Number(voucherRow.nonce)
//             };
//             console.log(`[${new Date().toISOString()}] 📄 铸造凭证数据:`, nftVoucher);


//                 const tokenIdOnChain = await new Promise((resolve, reject) => {
//                     const listener = (from, to, tokenId, event) => {
//                         if (to.toLowerCase() === buyerAddress.toLowerCase()) {
//                             lazyNFT.off("Transfer", listener);
//                             resolve(tokenId.toString());
//                         }
//                     };
//                     lazyNFT.on("Transfer", listener);

//                     setTimeout(() => {
//                         lazyNFT.off("Transfer", listener);
//                         reject(new Error("监听 Transfer 事件超时"));
//                     }, 30000);
//                 });


//             // 调用 redeem 铸造
//             tx = await contractWithBuyer.redeem(nftVoucher, voucherRow.signature, {
//                 value: ethers.parseEther(voucherRow.min_price.toString())
//             });
//             console.log(`[${new Date().toISOString()}] ⏳ 交易发送完成，等待上链: txHash=${tx.hash}`);

//             const receipt = await tx.wait();
//             console.log(`[${new Date().toISOString()}] ✅ 铸造交易完成: txHash=${tx.hash}`);






//         } else {
//             console.log(`[${new Date().toISOString()}] 🔁 NFT 已铸造，调用 Marketplace buyItem...`);

//             tokenIdOnChain = nft.token_id;
//             const contractWithBuyer = marketplace.connect(buyerWallet);

//             tx = await contractWithBuyer.buyItem(lazyNFTAddress, tokenIdOnChain, {
//                 value: ethers.parseEther(voucherRow.min_price.toString())
//             });
//             console.log(`[${new Date().toISOString()}] ⏳ Marketplace 交易发送完成: txHash=${tx.hash}`);

//             await tx.wait();
//             console.log(`[${new Date().toISOString()}] ✅ Marketplace 购买完成: tokenId=${tokenIdOnChain}`);
//         }

//         // =============================
//         // 6. 更新数据库
//         // =============================
//         await client.query(
//             `UPDATE nfts
//              SET current_owner=$1,
//                  status='Sold',
//                  token_id=COALESCE(token_id,$2),
//                  mint_time=COALESCE(mint_time,$3)
//              WHERE nft_id=$4`,
//             [buyerAddress, tokenIdOnChain, Math.floor(Date.now() / 1000), nft_id]
//         );
//         console.log(`[${new Date().toISOString()}] 📝 数据库 NFT 更新完成: nft_id=${nft_id}, tokenId=${tokenIdOnChain}`);

//         await client.query(`UPDATE vouchers SET status='Used' WHERE nft_id=$1`, [nft_id]);
//         console.log(`[${new Date().toISOString()}] 📝 Voucher 状态更新为 Used: nft_id=${nft_id}`);

//         // =============================
//         // 7. 返回结果
//         // =============================
//         res.json({
//             success: true,
//             txHash: tx?.hash || null,
//             buyer: buyerAddress,
//             nft_id,
//             token_id: tokenIdOnChain
//         });

//     } catch (err) {
//         console.error(`[${new Date().toISOString()}] ❌ 购买失败:`, err);
//         res.status(500).json({ success: false, error: err.message });
//     } finally {
//         client.release();
//     }
// });


router.post('/marketplace/buy', async (req, res) => {
    const client = await pool.connect();
    try {
        const { buyerAddress, nft_id } = req.body;
        console.log(`[${new Date().toISOString()}] 📩 收到购买请求: buyer=${buyerAddress}, nft_id=${nft_id}`);

        if (!buyerAddress || !nft_id) {
            console.warn(`[${new Date().toISOString()}] ❌ 请求缺少 buyerAddress 或 nft_id`);
            return res.status(400).json({ success: false, error: "缺少 buyerAddress 或 nft_id" });
        }

        // ============================= 查询 NFT
        const nftResult = await client.query(`SELECT * FROM nfts WHERE nft_id=$1`, [nft_id]);
        if (nftResult.rowCount === 0) {
            console.warn(`[${new Date().toISOString()}] ❌ NFT 不存在: nft_id=${nft_id}`);
            return res.status(404).json({ success: false, error: "NFT 不存在" });
        }
        const nft = nftResult.rows[0];
        console.log(`[${new Date().toISOString()}] ✅ NFT 信息:`, nft);

        // ============================= 查询 Voucher
        const voucherResult = await client.query(
            `SELECT * FROM vouchers WHERE nft_id=$1 AND status='Active'`,
            [nft_id]
        );
        if (voucherResult.rowCount === 0) {
            console.warn(`[${new Date().toISOString()}] ❌ Voucher 不存在或已失效: nft_id=${nft_id}`);
            return res.status(404).json({ success: false, error: "Voucher 不存在或已失效" });
        }
        const voucherRow = voucherResult.rows[0];
        console.log(`[${new Date().toISOString()}] ✅ Voucher 信息:`, voucherRow);

        // ============================= 准备 buyer 钱包
        const buyerWallet = new ethers.Wallet(process.env.LOCAL_BUYER_PRIVATE_KEY, provider);
        console.log(`[${new Date().toISOString()}] 👜 Buyer 钱包地址: ${buyerWallet.address}`);

        let tx;
        let tokenIdOnChain;

        // ============================= NFT 铸造或购买
        if (!nft.token_id) {
            console.log(`[${new Date().toISOString()}] 🔑 NFT 未铸造，调用 LazyNFT redeem 铸造...`);

            const contractWithBuyer = lazyNFT.connect(buyerWallet);

            const nftVoucher = {
                tokenURI: voucherRow.token_uri,
                minPrice: ethers.parseEther(voucherRow.min_price.toString()),
                creator: voucherRow.creator_address,
                nonce: Number(voucherRow.nonce)
            };
            console.log(`[${new Date().toISOString()}] 📄 铸造凭证数据:`, nftVoucher);

            // 调用 redeem
            tx = await contractWithBuyer.redeem(nftVoucher, voucherRow.signature, {
                value: ethers.parseEther(voucherRow.min_price.toString())
            });
            console.log(`[${new Date().toISOString()}] ⏳ 交易发送完成，等待上链: txHash=${tx.hash}`);

            await tx.wait();
            console.log(`[${new Date().toISOString()}] ✅ 铸造交易完成: txHash=${tx.hash}`);

            // 直接从合约获取最新 tokenId 主网才行
            tokenIdOnChain = await contractWithBuyer.getCurrentTokenId();
            console.log(`[${new Date().toISOString()}] 🆔 NFT tokenId=${tokenIdOnChain}`);
        } else {
            console.log(`[${new Date().toISOString()}] 🔁 NFT 已铸造，调用 Marketplace buyItem...`);

            tokenIdOnChain = nft.token_id;
            const contractWithBuyer = marketplace.connect(buyerWallet);

            tx = await contractWithBuyer.buyItem(lazyNFTAddress, tokenIdOnChain, {
                value: ethers.parseEther(voucherRow.min_price.toString())
            });
            console.log(`[${new Date().toISOString()}] ⏳ Marketplace 交易发送完成: txHash=${tx.hash}`);

            await tx.wait();
            console.log(`[${new Date().toISOString()}] ✅ Marketplace 购买完成: tokenId=${tokenIdOnChain}`);
        }

        // ============================= 更新数据库
        await client.query(
            `UPDATE nfts
             SET current_owner=$1,
                 status='Sold',
                 token_id=COALESCE(token_id,$2),
                 mint_time=COALESCE(mint_time,$3)
             WHERE nft_id=$4`,
            [buyerAddress, tokenIdOnChain, Math.floor(Date.now() / 1000), nft_id]
        );
        console.log(`[${new Date().toISOString()}] 📝 数据库 NFT 更新完成: nft_id=${nft_id}, tokenId=${tokenIdOnChain}`);

        await client.query(`UPDATE vouchers SET status='Used' WHERE nft_id=$1`, [nft_id]);
        console.log(`[${new Date().toISOString()}] 📝 Voucher 状态更新为 Used: nft_id=${nft_id}`);

        // ============================= 返回结果
        res.json({
            success: true,
            txHash: tx?.hash || null,
            buyer: buyerAddress,
            nft_id,
            token_id: tokenIdOnChain
        });

    } catch (err) {
        console.error(`[${new Date().toISOString()}] ❌ 购买失败:`, err);
        res.status(500).json({ success: false, error: err.message });
    } finally {
        client.release();
    }
});


module.exports = router;
