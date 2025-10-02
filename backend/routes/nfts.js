// D:\projects\hardhat_nft_marketplace\hardhat-nft\backend\routes\nfts.js
const express = require('express');
const router = express.Router();
const pool = require('../db'); // PostgreSQL pool
const { ethers } = require('ethers');
const { lazyNFT, marketplace, provider, lazyNFTAddress,LOCAL_SELLER_PRIVATE_KEY_LIST, marketplaceAddress } = require('../contracts');


// --------------------------
// 调试输出
// --------------------------
console.log('lazyNFTAddress:', lazyNFTAddress);
console.log('lazyNFT:', lazyNFT);
console.log('marketplace:', marketplace);
console.log('marketplace:', LOCAL_SELLER_PRIVATE_KEY_LIST);


// --------------------------
//   一、 获取 NFT 列表 
// --------------------------
router.get('/', async (req, res) => {
    const { page = 1, limit = 6 } = req.query;
    const offset = (page - 1) * limit;
    const result = await pool.query(
        `SELECT * FROM nfts WHERE is_deleted = 0 and is_listed = 1 ORDER BY token_id DESC LIMIT $1 OFFSET $2`,
        [limit, offset]
    );
    res.json(result.rows);
});



// ==== 获取余额工具 ====
async function getBalance(address) {
    try {
        const balance = await provider.getBalance(address); // bigint
        console.log("💰 买家余额:", Number(balance) / 1e18, "ETH"); // 转为 ETH 输出
        return balance;
    } catch (err) {
        console.error("获取余额失败:", err);
        throw err;
    }
}


// ========================
//  二、买家购买 NFT
// ========================
// 购买 NFT （支持一级市场和二级市场）
// router.post('/marketplace/buy', async (req, res) => {
//     const client = await pool.connect();

//     // 工具函数：统一序列化 BigInt，保证 res.json 不报错
//     const toSerializable = (obj) => JSON.parse(JSON.stringify(obj, (_, v) =>
//         typeof v === "bigint" ? v.toString() : v
//     ));

//     try {
//         const { buyerAddress, nft_id } = req.body;
//         console.log(`[${new Date().toISOString()}] 📩 收到购买请求: buyer=${buyerAddress}, nft_id=${nft_id}`);

//         if (!buyerAddress || !nft_id) {
//             console.warn(`[${new Date().toISOString()}] ❌ 请求缺少 buyerAddress 或 nft_id`);
//             return res.status(400).json({ success: false, error: "缺少 buyerAddress 或 nft_id" });
//         }

//         // ============================= 余额检查 ==========================
//         const balance = await getBalance(buyerAddress);
//         console.log(`[${new Date().toISOString()}] 💰 买家余额: ${ethers.formatEther(balance)} ETH`);

//         // ============================= 查询 NFT 信息 =====================
//         const nftResult = await client.query(`SELECT * FROM nfts WHERE nft_id=$1`, [nft_id]);
//         if (nftResult.rowCount === 0) {
//             console.warn(`[${new Date().toISOString()}] ❌ NFT 不存在: nft_id=${nft_id}`);
//             return res.status(404).json({ success: false, error: "NFT 不存在" });
//         }
//         const nft = nftResult.rows[0];
//         console.log(`[${new Date().toISOString()}] ✅ NFT 信息:`, nft);

//         // ============================= 查询 Voucher =====================
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

//         // ============================= 准备 Buyer 钱包 ==================
//         const buyerWallet = new ethers.Wallet(process.env.LOCAL_BUYER_PRIVATE_KEY, provider);
//         console.log(`[${new Date().toISOString()}] 👜 Buyer 钱包地址: ${buyerWallet.address}`);

//         let tx;
//         let tokenIdOnChain;

//         // ============================= NFT 铸造或购买 ==================
//         if (!nft.token_id) {
//             console.log(`[${new Date().toISOString()}] 🔑 NFT 未铸造，调用 LazyNFT redeem 铸造...`);

//             const contractWithBuyer = lazyNFT.connect(buyerWallet);

//             const nftVoucher = {
//                 tokenURI: voucherRow.token_uri,
//                 minPrice: BigInt(voucherRow.min_price),
//                 creator: voucherRow.creator_address,
//                 nonce: BigInt(voucherRow.nonce)
//             };

//             tx = await contractWithBuyer.redeem(nftVoucher, voucherRow.signature, {
//                 value: BigInt(voucherRow.min_price)
//             });

//             console.log(`[${new Date().toISOString()}] ⏳ 交易发送完成，等待上链: txHash=${tx.hash}`);
//             await tx.wait();
//             console.log(`[${new Date().toISOString()}] ✅ 铸造交易完成: txHash=${tx.hash}`);

//             const recoveredFromContract = await lazyNFT._verify(nftVoucher, voucherRow.signature);
//             console.log(`[${new Date().toISOString()}] 🔍 合约验证签名者: ${recoveredFromContract}`);

//             tokenIdOnChain = await contractWithBuyer.getCurrentTokenId();
//             console.log(`[${new Date().toISOString()}] 🆔 NFT tokenId=${tokenIdOnChain}`);
//         } else {
//             console.log(`[${new Date().toISOString()}] 🔁 NFT 已铸造，调用 Marketplace buyItem...`);

//             tokenIdOnChain = nft.token_id;
//             const contractWithBuyer = marketplace.connect(buyerWallet);

//             tx = await contractWithBuyer.buyItem(lazyNFTAddress, tokenIdOnChain, {
//                 value: BigInt(voucherRow.min_price)
//             });
//             console.log(`[${new Date().toISOString()}] ⏳ Marketplace 交易发送完成: txHash=${tx.hash}`);

//             await tx.wait();
//             console.log(`[${new Date().toISOString()}] ✅ Marketplace 购买完成: tokenId=${tokenIdOnChain}`);
//         }

//         // ============================= 更新数据库 =====================
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

//         // ============================= 返回结果 ========================
//         res.json(toSerializable({
//             success: true,
//             txHash: tx?.hash || null,
//             buyer: buyerAddress,
//             nft_id,
//             token_id: tokenIdOnChain
//         }));

//     } catch (err) {
//         console.error(`[${new Date().toISOString()}] ❌ 购买失败:`, err);
//         res.status(500).json({ success: false, error: err.message });
//     } finally {
//         client.release();
//     }
// });

router.post('/marketplace/buy', async (req, res) => {
    const client = await pool.connect();

    const toSerializable = (obj) => JSON.parse(JSON.stringify(obj, (_, v) =>
        typeof v === "bigint" ? v.toString() : v
    ));

    try {
        const { buyerAddress, nft_id } = req.body;
        console.log(`[${new Date().toISOString()}] 📩 收到购买请求: buyer=${buyerAddress}, nft_id=${nft_id}`);

        if (!buyerAddress || !nft_id) {
            console.warn(`[${new Date().toISOString()}] ❌ 请求缺少 buyerAddress 或 nft_id`);
            return res.status(400).json({ success: false, error: "缺少 buyerAddress 或 nft_id" });
        }

        // ============================= 余额检查 ==========================
        const balance = await getBalance(buyerAddress);
        console.log(`[${new Date().toISOString()}] 💰 买家余额: ${ethers.formatEther(balance)} ETH`);

        // ============================= 查询 NFT 信息 =====================
        const nftResult = await client.query(`SELECT * FROM nfts WHERE nft_id=$1`, [nft_id]);
        if (nftResult.rowCount === 0) {
            console.warn(`[${new Date().toISOString()}] ❌ NFT 不存在: nft_id=${nft_id}`);
            return res.status(404).json({ success: false, error: "NFT 不存在" });
        }
        const nft = nftResult.rows[0];
        console.log(`[${new Date().toISOString()}] ✅ NFT 信息:`, nft);

        // ============================= 准备 Buyer 钱包 ==================
        const buyerWallet = new ethers.Wallet(process.env.LOCAL_BUYER_PRIVATE_KEY, provider);
        console.log(`[${new Date().toISOString()}] 👜 Buyer 钱包地址: ${buyerWallet.address}`);

        let tx;
        let tokenIdOnChain;

        // ============================= 一级市场 (懒铸造) ==================
        if (!nft.token_id) {
            // NFT 未铸造，需要 Voucher
            console.log(`[${new Date().toISOString()}] 🔑 NFT ${nft_id} 未铸造，一级市场mint+transfe ，查 Voucher 并调 LazyNFT redeem 懒铸造...`);

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

            const contractWithBuyer = lazyNFT.connect(buyerWallet);
            const nftVoucher = {
                tokenURI: voucherRow.token_uri,
                minPrice: BigInt(voucherRow.min_price),
                creator: voucherRow.creator_address,
                nonce: BigInt(voucherRow.nonce)
            };

            tx = await contractWithBuyer.redeem(nftVoucher, voucherRow.signature, {
                value: BigInt(voucherRow.min_price)
            });

            console.log(`[${new Date().toISOString()}] ⏳ 交易发送完成，等待上链: txHash=${tx.hash}`);
            await tx.wait();
            console.log(`[${new Date().toISOString()}] ✅ 铸造交易完成: txHash=${tx.hash}`);

            tokenIdOnChain = await contractWithBuyer.getCurrentTokenId();
            console.log(`[${new Date().toISOString()}] 🆔 NFT tokenId=${tokenIdOnChain}`);

            // 更新 Voucher 状态
            await client.query(`UPDATE vouchers SET status='Used' WHERE nft_id=$1`, [nft_id]);
            console.log(`[${new Date().toISOString()}] 📝 Voucher 状态更新为 Used: nft_id=${nft_id}`);

        } else {
            // NFT 已铸造，直接二手市场购买
            console.log(`[${new Date().toISOString()}] 🔁 NFT 已铸造，调用 Marketplace buyItem...`);

            tokenIdOnChain = nft.token_id;
            const contractWithBuyer = marketplace.connect(buyerWallet);

            const priceInWei = ethers.parseEther(nft.price.toString()); // 转成 BigInt
            tx = await contractWithBuyer.buyItem(lazyNFTAddress, tokenIdOnChain, {
                value: priceInWei
            });

            console.log(`[${new Date().toISOString()}] ⏳ Marketplace 交易发送完成: txHash=${tx.hash}`);

            await tx.wait();
            console.log(`[${new Date().toISOString()}] ✅ Marketplace 购买完成: tokenId=${tokenIdOnChain}`);
        }

        // ============================= 更新数据库 =====================
            await client.query(
                `UPDATE nfts
                SET current_owner=$1,
                    status=$2,
                    token_id=COALESCE(token_id,$3),
                    mint_time=COALESCE(mint_time,$4),
                    market_level=$5,
                    is_blockchain=$6,
                    is_listed=0
                WHERE nft_id=$7`,
                [
                    buyerAddress,                    // 所有权变更
                    'sold',                          // 状态
                    tokenIdOnChain,                  // tokenId
                    Math.floor(Date.now() / 1000),   // 铸造时间
                    nft.token_id ? 2 : 1,            // 已有 token_id → 二级市场，否则一级
                    nft.token_id ? 1 : 0,            // 是否链上
                    nft_id
                ]
            );
            console.log(`[${new Date().toISOString()}] 📝 数据库 NFT 更新完成: nft_id=${nft_id}, tokenId=${tokenIdOnChain}`);

        // ============================= 返回结果 ========================
        res.json(toSerializable({
            success: true,
            txHash: tx?.hash || null,
            buyer: buyerAddress,
            nft_id,
            token_id: tokenIdOnChain
        }));

    } catch (err) {
        console.error(`[${new Date().toISOString()}] ❌ 购买失败:`, err);
        res.status(500).json({ success: false, error: err.message });
    } finally {
        client.release();
    }
});




// =======================================
// 二级市场 NFT 上架 
// 路由风格与 /marketplace/buy 一致
// =======================================
router.post('/marketplace/list', async (req, res) => {
    const client = await pool.connect();
    const toSerializable = (obj) => JSON.parse(JSON.stringify(obj, (_, v) =>
        typeof v === "bigint" ? v.toString() : v
    ));

    try {
        const { sellerAddress, nft_id, price } = req.body;
        console.log(`[${new Date().toISOString()}] 📩 上架请求: seller=${sellerAddress}, nft_id=${nft_id}, price=${price}`);

        if (!sellerAddress || !nft_id || !price) {
            return res.status(400).json({ success: false, error: "缺少 sellerAddress、nft_id 或 price" });
        }

        // 查询 NFT 信息
        const nftResult = await client.query(`SELECT * FROM nfts WHERE nft_id=$1`, [nft_id]);
        if (nftResult.rowCount === 0) {
            return res.status(404).json({ success: false, error: "NFT 不存在" });
        }
        const nft = nftResult.rows[0];

        // 准备 Seller 钱包

        const sellerWallet = new ethers.Wallet(LOCAL_SELLER_PRIVATE_KEY_LIST, provider);
        console.log(`[${new Date().toISOString()}] 👜 Seller 钱包: ${sellerWallet.address}`);

        // 链上 Marketplace 合约上架
        const contractWithSeller = marketplace.connect(sellerWallet);
        const priceInWei = ethers.parseEther(price.toString());

        const tx = await contractWithSeller.listItem(lazyNFTAddress, nft.token_id, priceInWei);
        console.log(`[${new Date().toISOString()}] ⏳ 上架交易发送完成: txHash=${tx.hash}`);
        await tx.wait();
        console.log(`[${new Date().toISOString()}] ✅ NFT 链上上架完成: tokenId=${nft.token_id}`);

        // 数据库标记上架状态
        await client.query(
            `UPDATE nfts
             SET is_listed=1,
                 price=$1,
                 market_level=2,
                 is_blockchain=1
             WHERE nft_id=$2`,
            [price, nft_id]
        );
        console.log(`[${new Date().toISOString()}] 📝 数据库更新 NFT 上架状态完成`);

        res.json(toSerializable({
            success: true,
            txHash: tx.hash,
            nft_id,
            price
        }));

    } catch (err) {
        console.error(`[${new Date().toISOString()}] ❌ 上架失败:`, err);
        res.status(500).json({ success: false, error: err.message });
    } finally {
        client.release();
    }
});

// =======================================
// 二级市场 NFT  下架
// 路由风格与 /marketplace/buy 一致
// =======================================
router.post('/marketplace/cancel', async (req, res) => {
    const client = await pool.connect();
    const toSerializable = (obj) => JSON.parse(JSON.stringify(obj, (_, v) =>
        typeof v === "bigint" ? v.toString() : v
    ));

    try {
        const { sellerAddress, nft_id } = req.body;
        console.log(`[${new Date().toISOString()}] 📩 下架请求: seller=${sellerAddress}, nft_id=${nft_id}`);

        if (!sellerAddress || !nft_id) {
            return res.status(400).json({ success: false, error: "缺少 sellerAddress 或 nft_id" });
        }

        // 查询 NFT
        const nftResult = await client.query(`SELECT * FROM nfts WHERE nft_id=$1`, [nft_id]);
        if (nftResult.rowCount === 0) {
            return res.status(404).json({ success: false, error: "NFT 不存在" });
        }
        const nft = nftResult.rows[0];

        // 链上 Marketplace 合约下架
        const LOCAL_SELLER_PRIVATE_KEY_UNLIST = LOCAL_SELLER_PRIVATE_KEY_LIST; // for test
        const sellerWallet = new ethers.Wallet(LOCAL_SELLER_PRIVATE_KEY_UNLIST, provider);
        const contractWithSeller = marketplace.connect(sellerWallet);

        const tx = await contractWithSeller.cancelListing(lazyNFTAddress, nft.token_id);
        console.log(`[${new Date().toISOString()}] ⏳ 下架交易发送完成: txHash=${tx.hash}`);
        await tx.wait();
        console.log(`[${new Date().toISOString()}] ✅ NFT 链上下架完成: tokenId=${nft.token_id}`);

        // 数据库标记下架状态
        await client.query(
            `UPDATE nfts
             SET is_listed=0
             WHERE nft_id=$1`,
            [nft_id]
        );
        console.log(`[${new Date().toISOString()}] 📝 数据库更新 NFT 下架状态完成`);

        res.json(toSerializable({
            success: true,
            txHash: tx.hash,
            nft_id
        }));

    } catch (err) {
        console.error(`[${new Date().toISOString()}] ❌ 下架失败:`, err);
        res.status(500).json({ success: false, error: err.message });
    } finally {
        client.release();
    }
});



module.exports = router;
