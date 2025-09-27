// D:\projects\hardhat_nft_marketplace\hardhat-nft\backend\listen.js
const { lazyNFT, marketplace, provider } = require('./contracts');
const pool = require('./db');

// ============================
// 测试数据库连接
// ============================
(async () => {
    try {
        const res = await pool.query('SELECT NOW()');
        console.log('数据库连接成功！', res.rows[0].now);
    } catch (err) {
        console.error('数据库连接失败:', err);
        process.exit(1);
    }
})();

// ============================
// 打印网络信息
// ============================
(async () => {
    try {
        const net = await provider.getNetwork();
        console.log('连接网络:', net.chainId, net.name);
    } catch (err) {
        console.error('获取网络信息失败:', err);
    }
})();

// ============================
// 监听 LazyNFT Minted 事件
// ============================
lazyNFT.on('Minted', async (creator, owner, tokenId, tokenURI) => {
    console.log('NFT Minted:', { creator, owner, tokenId, tokenURI });

    try {
        await pool.query(
            `UPDATE nfts SET status='Minted', current_owner=$1 WHERE token_id=$2`,
            [owner, tokenId]
        );
        console.log('数据库更新成功:', tokenId);
    } catch (err) {
        console.error('数据库写入失败:', err);
    }
});

// ============================
// 监听 LazyNFT Transferred 事件
// ============================
lazyNFT.on('Transferred', async (from, to, tokenId) => {
    console.log(`NFT Transferred: tokenId=${tokenId}, from=${from}, to=${to}`);

    try {
        await pool.query(
            `UPDATE nfts SET current_owner=$1 WHERE token_id=$2`,
            [to, tokenId]
        );
        console.log('数据库更新成功');
    } catch (err) {
        console.error('数据库更新失败:', err);
    }
});

// ============================
// 监听 Marketplace 事件（可选，根据合约添加）
// ============================
// marketplace.on('SomeEvent', async (...args) => {
//     console.log('Marketplace Event:', args);
//     // TODO: 数据库操作
// });

console.log('链上事件监听已启动...');
