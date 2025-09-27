// D:\projects\hardhat_nft_marketplace\hardhat-nft\backend\server.js

// 引入 express 框架，用于创建 HTTP 服务
const express = require('express');
const app = express();

// 引入 NFT 路由和用户路由模块
// nftsRouter 处理 NFT 相关接口，如获取列表、购买、点赞等
// usersRouter 处理用户相关接口，如用户拥有的 NFT、上传/预列 NFT、Mint NFT 等
const nftsRouter = require('./routes/nfts.js');
const usersRouter = require('./routes/users.js'); // 修正为 users.js

// 加载环境变量 (.env 文件)，并允许覆盖已有环境变量
// __dirname 表示当前文件夹路径，通过 path.resolve 指向上一级目录
require('dotenv').config({ path: '../.env', override: true });

// 中间件：解析 JSON 请求体
// express.json() 会自动将请求体 JSON 转换为 JS 对象，挂载到 req.body
app.use(express.json());

// 路由挂载
// 所有 /api/nfts 开头的请求都会交给 nftsRouter 处理
app.use('/api/nfts', nftsRouter);

// 所有 /api/users 开头的请求都会交给 usersRouter 处理
app.use('/api/users', usersRouter);

// 提供前端静态页面
// 用户访问根路径或前端资源时，Express 会去 ../frontend 文件夹寻找
app.use(express.static('../frontend'));

// 设置服务端口
// 如果 .env 中有 PORT 配置则使用，否则默认 3000
const PORT = process.env.PORT || 3000;

// 启动服务并监听指定端口
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

/**
 * 整体流程：
 * 
 * 前端请求 -> Express server -> 对应路由文件处理请求 -> 数据库操作/链上操作 -> 返回结果给前端
 * 
 * 具体例子：
 * 1. 用户访问 /api/nfts?page=1&limit=6
 *    -> nftsRouter 处理 GET /
 *    -> 查询 Postgres 数据库 nfts 表
 *    -> 返回 NFT 列表给前端
 * 
 * 2. 用户购买 NFT /api/nfts/:tokenId/buy
 *    -> nftsRouter 处理 POST /:tokenId/buy
 *    -> 查询 NFT 信息
 *    -> 通过 ethers.js 调用 Marketplace 合约 buyItem
 *    -> 等待交易完成
 *    -> 更新数据库中 NFT 当前拥有者
 *    -> 返回交易哈希给前端
 * 
 * 3. 用户查看自己 NFT /api/users/:address/nfts
 *    -> usersRouter 处理 GET /:address/nfts
 *    -> 查询数据库中该用户拥有或创建的 NFT
 *    -> 返回 NFT 列表给前端
 * 
 * 注意：
 * - 所有链上操作需要钱包私钥 (Wallet) 与 provider
 * - 数据库操作使用 pool.query 访问 Postgres
 * - 环境变量中存放 RPC URL、合约地址、数据库信息等敏感信息
 */
