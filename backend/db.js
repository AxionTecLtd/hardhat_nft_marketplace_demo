require('dotenv').config({ path: '../.env', override: true });  // 指向上一级目录
const { Pool } = require('pg');

// console.log("PGUSER:", process.env.PGUSER);
// console.log("PGPASSWORD:", process.env.PGPASSWORD);


// 创建连接池
const pool = new Pool({
  host: process.env.PGHOST,
  port: process.env.PGPORT,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
});
console.log(`数据库连接成功！`);
module.exports = pool;
