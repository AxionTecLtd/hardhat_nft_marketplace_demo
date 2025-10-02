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



// ==========================================
//    一 、创作者页面  MyNFT 初始化
// ==========================================
//  1.初始化 MyNFT 页面,提供当前用户的 NFT 列表 ok
router.get('/:address/nfts', async (req, res) => {
    const { address } = req.params;
    const { page = 1, limit = 6 } = req.query;
    const offset = (page-1)*limit;
    // 创作人可跟综，显示current_owner or creator_address 未删除的,只是，二级市场sold售出之后,如果自己！=当前所有人,则不能上下架，按钮禁用并置为‘已售出’，只有 当前所有人 =自己，才能操作
    const result = await pool.query(`SELECT * FROM nfts WHERE is_deleted = 0 AND (current_owner=$1 or creator_address=$1) ORDER BY token_id DESC LIMIT $2 OFFSET $3`, [address, limit, offset]);
    res.json(result.rows);
});



// ==========================================
//    二、创作者 懒铸造NFT
// ==========================================
// ======= 懒铸造 NFT 功能 设计==================
// 要实现 懒铸造 NFT 功能，包括前端上传表单、后端存数据库、生成 voucher 凭证
// 2.创作者上传 懒铸造 NFT
// 创作者上传 → 选懒铸造 Pre-list 按钮 → 调用 POST /:address/nfts/lazy → 预览状态
// 把 Pre-list NFT 数据存进 PostgreSQL 的 nfts 表。状态是 Pre-list.同时生成 voucher 凭证并存 voucher 表
// 每个路由引入一次数据库连接池，赋值为client
// 用户上传信息 → 写入 nfts 表（token_id=null）。-->创建 voucher → 写入 vouchers 表。

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
             [nft.nft_id, token_uri, voucher.minPrice, voucher.signature, voucher.creator, voucher.nonce]
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


// ================ 工具：生成 voucher 凭证  ========================
// 记得引入ethers.js 和运行的网络条件provider、平台私钥地址这里，只作为演示，后期可替换
async function createVoucher(nft_id, minPrice, token_uri) {
    try {
        console.log(`[${new Date().toISOString()}] 🔑 开始生成 Voucher: nft_id=${nft_id}, price=${minPrice}`);
        const creatorWallet = new ethers.Wallet(process.env.LOCAL_CREATOR_PRIVATE_KEY, provider);
        const domain = {
                name: 'LazyNFT',  // <-- 改成合约里 EIP712 的 name
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
            minPrice: ethers.parseEther(minPrice.toString()).toString(), // ⚡字符串
            creator: creatorWallet.address, // ✅ 签名者地址
            nonce: nft_id.toString() // ⚡字符串化  // 用 nft_id 保证唯一
        };


        const signature = await creatorWallet.signTypedData(domain, types, value);
        console.log(`[${new Date().toISOString()}] ✅ Voucher 签名完成: nft_id=${nft_id}`);
        
        // 调试：验证签名是否正确恢复到 creator 地址
        const recovered = ethers.verifyTypedData(domain, types, value, signature);
        console.log('🔍 signature recovered:', recovered, ' expected:', creatorWallet.address);

        return {
                    nft_id,
                    minPrice: value.minPrice,   // 链下存储 wei 字符串
                    token_uri,
                    signature,
                    nonce: value.nonce,
                    creator: creatorWallet.address
                };
                

    } catch (err) {
        console.error(`[${new Date().toISOString()}] ❌ Voucher 生成失败:`, err);
        throw err;
    }
}



// =============================== 
//    三、 创作者 删除 NFT 
// ============================= 
// 仅链下逻辑删除 ，链上区块链无法删除
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




// --------------------------
// 上架/下架 NFT（链下逻辑）
// backend/routes/users.js
// --------------------------
// backend/routes/users.js
// --------------------------
// 上架/下架 NFT（链下逻辑，仅切换 is_listed）
// --------------------------
router.post('/:address/nfts/:nft_id/toggle-listing', async (req, res) => {
    try {
        const { nft_id, address } = req.params;

        // 查询 NFT 是否存在且属于当前用户
        const result = await pool.query(
            `SELECT * FROM nfts WHERE nft_id = $1 AND current_owner = $2 AND is_deleted = 0`,
            [nft_id, address]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'NFT 不存在或已删除' });
        }

        const nft = result.rows[0];

        // 切换 is_listed，0 -> 1, 1 -> 0
        const newIsListed = nft.is_listed === 0 ? 1 : 0;

        // 更新数据库
        await pool.query(
            `UPDATE nfts SET is_listed = $1 WHERE nft_id = $2`,
            [newIsListed, nft_id]
        );

        res.json({ success: true, message: `NFT 已${newIsListed ? '上架' : '下架'}` });
    } catch (err) {
        console.error("切换上架状态失败:", err);
        res.status(500).json({ success: false, error: err.message || '服务器内部错误' });
    }
});


// 导出
module.exports = router;
