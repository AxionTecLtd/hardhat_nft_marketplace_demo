// D:\projects\hardhat_nft_marketplace\hardhat-nft\backend\routes\nfts.js
const express = require('express');
const router = express.Router();
const pool = require('../db'); // PostgreSQL pool
const { ethers } = require('ethers');
const { lazyNFT, marketplace, provider, lazyNFTAbi,lazyNFTAddress,LOCAL_SELLER_PRIVATE_KEY_LIST, marketplaceAddress } = require('../contracts');


// --------------------------
// 调试输出
// --------------------------
console.log('lazyNFTAddress:', lazyNFTAddress);
console.log('lazyNFT:', lazyNFT);
console.log('marketplace:', marketplace);
console.log('LOCAL_SELLER_PRIVATE_KEY_LIST:', LOCAL_SELLER_PRIVATE_KEY_LIST);



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

        // ============================= 一级市场 (懒铸造) ===========================
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
                feeNumerator: voucherRow.fee_numerator, // ⚡ 关键映射
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





// ===================================================
// 二级市场 NFT 上架（后端固定seller测试版本）-暂行
// ===================================================
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

        // NFT 合约实例（用当前用户钱包）
        const sellerWallet = new ethers.Wallet(LOCAL_SELLER_PRIVATE_KEY_LIST, provider); 
        console.log(`[${new Date().toISOString()}] 👜 卖家钱包: ${sellerWallet.address}`);

        // lazyNFT 就是合约实例
        // const nftContract = new ethers.Contract(lazyNFTAddress, lazyNFTAbi, provider);

        // -------------------------------
        // 链上检查卖家是否为 lazyNFT 合约中的 NFT 拥有者
        // 使用 BigInt 确保类型正确
        // -------------------------------
        const tokenIdBig = BigInt(nft.token_id);
        const onChainOwner = await lazyNFT.ownerOf(tokenIdBig);
        if (onChainOwner.toLowerCase() !== sellerAddress.toLowerCase()) {
            return res.status(403).json({ success: false, error: "当前用户不是 NFT 拥有者" });
        }

        // -------------------------------
        // 检查 lazyNFT 合约 是否已对 Marketplace 合约 授权所有 NFT
        // 注意：不要使用 marketplace.address（在 ethers v6 中通常是 undefined）
        // 改为使用后端导出的 marketplaceAddress（或 marketplace.target）
        // -------------------------------
        // 推荐使用从 contracts.js 导出的 marketplaceAddress（字符串）
        const operatorAddr = (typeof marketplaceAddress !== 'undefined') ? marketplaceAddress : marketplace.target;
        console.log(`[${new Date().toISOString()}] DEBUG operatorAddr = ${operatorAddr}`);

        const nftWithSeller = lazyNFT.connect(sellerWallet);

        // 读取当前 nonce（最新已计入链上的 nonce）
        let nonce = await provider.getTransactionCount(sellerWallet.address, "latest");
        console.log(`[${new Date().toISOString()}] DEBUG starting nonce = ${nonce}`);

        // 检查并授予 Marketplace 授权（如果还没授权）
        const isApprovedForAll = await nftWithSeller.isApprovedForAll(sellerAddress, operatorAddr);
        if (!isApprovedForAll) {
            console.log(`[${new Date().toISOString()}] 🔑 NFT 未授权 Marketplace，正在授权所有 NFT...`);
            // 显式用当前 nonce 发授权 tx，避免自动 nonce 冲突
            const approveTx = await nftWithSeller.setApprovalForAll(operatorAddr, true, { nonce });
            await approveTx.wait();
            console.log(`[${new Date().toISOString()}] ✅ NFT 全部授权给 Marketplace 完成 (nonce used: ${nonce})`);
            // 增加 nonce 准备发送下一笔（list）交易
            nonce = nonce + 1n;
        } else {
            // 若已授权，则把 nonce 同步为链上最新值（保证正确）
            nonce = await provider.getTransactionCount(sellerWallet.address, "latest");
            console.log(`[${new Date().toISOString()}] ✅ 已授权，刷新 nonce = ${nonce}`);
        }

        // -------------------------------
        // 链上 Marketplace 上架（显式传 nonce）
        // -------------------------------
        const contractWithSeller = marketplace.connect(sellerWallet);
        const priceInWei = ethers.parseEther(price.toString());

        // DEBUG 打印关键值
        console.log("DEBUG lazyNFTAddress =", lazyNFTAddress);
        console.log("DEBUG tokenId =", tokenIdBig);
        console.log("DEBUG priceInWei =", priceInWei.toString());
        console.log("DEBUG tx nonce to use =", nonce.toString());

        // 显式传 nonce，确保不会与其他并发 tx 冲突
        const tx = await contractWithSeller.listItem(lazyNFTAddress, tokenIdBig, priceInWei, { nonce });
        console.log(`[${new Date().toISOString()}] ⏳ 上架交易发送完成: txHash=${tx.hash}, nonce=${nonce}`);
        await tx.wait();
        console.log(`[${new Date().toISOString()}] ✅ NFT 链上上架完成: tokenId=${nft.token_id}`);

        // -------------------------------
        // 数据库更新上架状态
        // -------------------------------
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


// ===================================================
// 二级市场 NFT  下架链上停售 （后端固定seller测试版本）-暂行
// ===================================================
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

        // NFT token_id 必须存在
        if (!nft.token_id) {
            return res.status(400).json({ success: false, error: "NFT 尚未铸造，无法下架" });
        }

        // 准备卖家 signer
        const sellerWallet = new ethers.Wallet(LOCAL_SELLER_PRIVATE_KEY_LIST, provider);
        console.log(`[${new Date().toISOString()}] 👜 卖家钱包: ${sellerWallet.address}`);

        // 检查链上拥有者
        const tokenIdBig = BigInt(nft.token_id);
        const onChainOwner = await lazyNFT.ownerOf(tokenIdBig);
        if (onChainOwner.toLowerCase() !== sellerAddress.toLowerCase()) {
            return res.status(403).json({ success: false, error: "当前用户不是 NFT 拥有者" });
        }

        // operatorAddr
        const operatorAddr = (typeof marketplaceAddress !== 'undefined') ? marketplaceAddress : marketplace.target;
        console.log(`[${new Date().toISOString()}] DEBUG operatorAddr = ${operatorAddr}`);

        // 获取当前 nonce
        let nonce = await provider.getTransactionCount(sellerWallet.address, "latest");
        console.log(`[${new Date().toISOString()}] DEBUG starting nonce = ${nonce}`);

        // 连接 Marketplace 合约
        const contractWithSeller = marketplace.connect(sellerWallet);

        // 下架 tx 显式传 nonce
        const tx = await contractWithSeller.cancelListing(lazyNFTAddress, tokenIdBig, { nonce });
        console.log(`[${new Date().toISOString()}] ⏳ 下架交易发送完成: txHash=${tx.hash}, nonce=${nonce}`);
        await tx.wait();
        console.log(`[${new Date().toISOString()}] ✅ NFT 链上下架完成: tokenId=${nft.token_id}`);

        // 数据库标记下架状态
        await client.query(
            `UPDATE nfts
             SET is_listed=0,
             is_onchain=0
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

// ===================================================
// 二级市场 NFT  链上改价 （后端固定seller测试版本）-暂行
// ===================================================
router.post('/marketplace/update-price', async (req, res) => {
    const client = await pool.connect();
    const toSerializable = (obj) => JSON.parse(JSON.stringify(obj, (_, v) =>
        typeof v === "bigint" ? v.toString() : v
    ));

    try {
        const { sellerAddress, nft_id, newPrice } = req.body;
        console.log(`[${new Date().toISOString()}] 📩 改价请求: seller=${sellerAddress}, nft_id=${nft_id}, newPrice=${newPrice}`);

        if (!sellerAddress || !nft_id || !newPrice) {
            return res.status(400).json({ success: false, error: "缺少参数" });
        }

        // 查询 NFT
        const nftResult = await client.query(`SELECT * FROM nfts WHERE nft_id=$1`, [nft_id]);
        if (nftResult.rowCount === 0) {
            return res.status(404).json({ success: false, error: "NFT 不存在" });
        }
        const nft = nftResult.rows[0];

        if (!nft.token_id) {
            return res.status(400).json({ success: false, error: "NFT 尚未铸造，无法改价" });
        }

        // 准备卖家 signer
        const sellerWallet = new ethers.Wallet(LOCAL_SELLER_PRIVATE_KEY_LIST, provider);
        console.log(`[${new Date().toISOString()}] 👜 卖家钱包: ${sellerWallet.address}`);

        // 检查链上拥有者
        const tokenIdBig = BigInt(nft.token_id);
        const onChainOwner = await lazyNFT.ownerOf(tokenIdBig);
        if (onChainOwner.toLowerCase() !== sellerAddress.toLowerCase()) {
            return res.status(403).json({ success: false, error: "当前用户不是 NFT 拥有者" });
        }

        // 获取当前 nonce
        let nonce = await provider.getTransactionCount(sellerWallet.address, "latest");
        console.log(`[${new Date().toISOString()}] DEBUG starting nonce = ${nonce}`);

        // 链上改价
        const contractWithSeller = marketplace.connect(sellerWallet);
        const priceInWei = ethers.parseEther(newPrice.toString());

        console.log("DEBUG lazyNFTAddress =", lazyNFTAddress);
        console.log("DEBUG tokenId =", tokenIdBig);
        console.log("DEBUG newPriceInWei =", priceInWei.toString());
        console.log("DEBUG tx nonce to use =", nonce.toString());

        const tx = await contractWithSeller.updateListingPrice(lazyNFTAddress, tokenIdBig, priceInWei, { nonce });
        console.log(`[${new Date().toISOString()}] ⏳ 改价交易发送完成: txHash=${tx.hash}, nonce=${nonce}`);
        await tx.wait();
        console.log(`[${new Date().toISOString()}] ✅ NFT 链上改价完成: tokenId=${nft.token_id}, newPrice=${newPrice}`);

        // 数据库更新
        await client.query(
            `UPDATE nfts SET price=$1 WHERE nft_id=$2`,
            [newPrice, nft_id]
        );
        console.log(`[${new Date().toISOString()}] 📝 数据库更新 NFT 价格完成`);

        res.json(toSerializable({
            success: true,
            txHash: tx.hash,
            nft_id,
            newPrice
        }));

    } catch (err) {
        console.error(`[${new Date().toISOString()}] ❌ 改价失败:`, err);
        res.status(500).json({ success: false, error: err.message });
    } finally {
        client.release();
    }
});



// ===================================================
// 二级市场 NFT 上架（前端签名版）-未完成 
// // ===================================================
// router.post('/marketplace/update-status', async (req, res) => {
//     const client = await pool.connect();
//     const toSerializable = (obj) => JSON.parse(JSON.stringify(obj, (_, v) =>
//         typeof v === "bigint" ? v.toString() : v
//     ));

//     try {
//         const { nft_id, is_listed, price, market_level, is_blockchain } = req.body;
//         console.log(`[${new Date().toISOString()}] 📩 更新NFT状态请求: nft_id=${nft_id}, is_listed=${is_listed}, price=${price}, market_level=${market_level}, is_blockchain=${is_blockchain}`);

//         if (!nft_id) {
//             return res.status(400).json({ success: false, error: "缺少 nft_id" });
//         }

//         // 查询 NFT 是否存在
//         const nftResult = await client.query(`SELECT * FROM nfts WHERE nft_id=$1`, [nft_id]);
//         if (nftResult.rowCount === 0) {
//             return res.status(404).json({ success: false, error: "NFT 不存在" });
//         }

//         // 构造动态更新字段
//         const updates = [];
//         const values = [];
//         let idx = 1;

//         if (typeof is_listed !== 'undefined') {
//             updates.push(`is_listed = $${idx++}`);
//             values.push(is_listed);
//         }
//         if (typeof price !== 'undefined') {
//             updates.push(`price = $${idx++}`);
//             values.push(price);
//         }
//         if (typeof market_level !== 'undefined') {
//             updates.push(`market_level = $${idx++}`);
//             values.push(market_level);
//         }
//         if (typeof is_blockchain !== 'undefined') {
//             updates.push(`is_blockchain = $${idx++}`);
//             values.push(is_blockchain);
//         }

//         if (updates.length === 0) {
//             return res.status(400).json({ success: false, error: "没有需要更新的字段" });
//         }

//         // 更新时间戳
//         updates.push(`updated_at = NOW()`);

//         values.push(nft_id);
//         const query = `UPDATE nfts SET ${updates.join(', ')} WHERE nft_id = $${idx}`;
//         await client.query(query, values);

//         console.log(`[${new Date().toISOString()}] 📝 NFT 数据库更新完成: nft_id=${nft_id}`);
//         res.json(toSerializable({ success: true, nft_id }));

//     } catch (err) {
//         console.error(`[${new Date().toISOString()}] ❌ NFT状态更新失败:`, err);
//         res.status(500).json({ success: false, error: err.message });
//     } finally {
//         client.release();
//     }
// });


module.exports = router;
