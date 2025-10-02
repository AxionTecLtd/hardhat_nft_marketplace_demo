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
// 每个路由引入一次数据库连接池，赋值为client
// 用户上传信息 → 写入 nfts 表（token_id=null）。-->创建 voucher → 写入 vouchers 表。


// ================ 懒铸造 NFT 接口 ========================
router.post('/:address/nfts/lazy', async (req, res) => {
    const client = await pool.connect();
    try {
        const { address } = req.params;
        const { title, image_url, story, price, type, royalty_percent,token_uri} = req.body;

        console.log(`[${new Date().toISOString()}] 📩 收到懒铸造请求:`, { address, title, price, type });

        // ✅ 基础参数校验
        if (!address) throw new Error("缺少创作者地址 address");
        if (!title || !image_url || !price) throw new Error("缺少必要字段 (title, image_url, price)");
        if (isNaN(price)) throw new Error("价格必须是数字");

        // 链下 token_id 暂时为null,链上交易成功再回填
        
        // ✅ 通过 pg（node-postgres）库,将NFT 数据（状态 Pre-list）写入nfts表。 client.query（`sql  RETURNING *`,[]) 
        // 第一个参数是sql语句字符串，第二个参数是一个数组，对应 SQL 里的 占位符 $1,$2,...;returning * 表示插入后把该行完整返回。
        const nftResult = await client.query(
            `INSERT INTO nfts( title, image_url, story, price, type, royalty_percent, creator_address, current_owner, contract_address, status)
             VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'Pre-list') RETURNING *`,
            [ title, image_url, story, price, type, royalty_percent || 0, address, address, lazyNFTAddress]
        );  // $7 → royalty_percent || 0 → 如果 royalty_percent 没传，就默认 0
        const nft = nftResult.rows[0];
        // 记录时间戳和nft信息
        console.log(`[${new Date().toISOString()}] ✅ NFT 已存入数据库: nft_id=${nft.nft_id}`);

        // ✅ 生成 Voucher（签名凭证） 
        // const token_uri = `ipfs://Qm123abc/${nft.nft_id}.json`; // 不用生成 metadata JSON URL，直接使用前端传来的 token_uri，可以降低维护费和法律风险
        const voucher = await createVoucher(nft.nft_id, price, token_uri);

        // ✅ 存 Voucher 数据
        const voucherResult = await client.query(
            `INSERT INTO vouchers(nft_id, token_uri, min_price, signature, creator_address,nonce)
             VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,
            [nft.nft_id, token_uri, price, voucher.signature, address,voucher.nonce]
        );

        console.log(`[${new Date().toISOString()}] 📝 Voucher 已生成: nft_id=${nft.nft_id}`);

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
// nft_id 入参形参 调用时后传入
// 记得引入ethers.js 和运行的网络条件provider、平台私钥地址这里，只作为演示，后期可替换
async function createVoucher(nft_id, minPrice, token_uri) {
    try {
        console.log(`[${new Date().toISOString()}] 🔑 开始生成 Voucher: nft_id=${nft_id}, price=${minPrice}`);
        const creatorWallet = new ethers.Wallet(process.env.LOCAL_CREATOR_PRIVATE_KEY, provider);
        const domain = {
                name: 'LazyNFT-Voucher',
                version: '1',
                chainId: 31337,
                verifyingContract: lazyNFTAddress
            };
        const types = {
            NFTVoucher: [
                { name: 'tokenURI', type: 'string' },
                { name: 'minPrice', type: 'uint256' },
                { name: 'creator', type: 'address' },
                { name: 'nonce', type: 'uint256' }
            ]
        };
        const value = {
            tokenURI: token_uri,
            minPrice: ethers.parseEther(minPrice.toString()),
            creator: creatorWallet.address,
            nonce: nft_id // 用 nft_id 保证唯一
        };
        const signature = await creatorWallet.signTypedData(domain, types, value);
        console.log(`[${new Date().toISOString()}] ✅ Voucher 签名完成: nft_id=${nft_id}`);
        return { nft_id, minPrice, token_uri, signature,nonce: nft_id  };
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
        const { buyerAddress, tokenId, nft_id } = req.body;
        if (!buyerAddress || !tokenId || !nft_id) throw new Error("缺少 buyerAddress / tokenId / nft_id");

        // 查询 voucher (用 nft_id 关联)
        const voucherResult = await client.query(
            `SELECT * FROM vouchers WHERE nft_id=$1 AND status='Active'`,
            [nft_id]
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
            owner = null;
        }

        let tx;
        if (!owner) {
            // NFT 未铸造 → redeem
            const nftVoucher = {
                tokenURI: voucherRow.token_uri,  // 字段名要对齐数据库
                minPrice: ethers.parseEther(voucherRow.min_price.toString()),
                creator: voucherRow.creator_address,
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
            `UPDATE nfts SET current_owner=$1, status='Sold', token_id=$2 WHERE nft_id=$3`,
            [buyerAddress, tokenId, nft_id]
        );
        await client.query(
            `UPDATE vouchers SET status='Used' WHERE nft_id=$1`,
            [nft_id]
        );

        res.json({
            success: true,
            txHash: receipt.transactionHash,
            buyer: buyerAddress,
            tokenId,
            nft_id
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

router.delete('/:address/nfts/:nft_id', async (req, res) => {
    try {
        const { nft_id  } = req.params;

        // 更新数据库 is_deleted 标记
        await pool.query(
            `UPDATE nfts SET is_deleted = 1 WHERE nft_id = $1`,
            [nft_id]
        );

        res.json({ success: true, message: 'NFT 已删除（逻辑删除）' });
    } catch (err) {
        console.error("删除 NFT 失败:", err);
        res.status(500).json({ success: false, error: err.message || '服务器内部错误' });
    }
});


module.exports = router;
