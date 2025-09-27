require('dotenv').config({ path: '../.env', override: true });  // 指向上一级目录

console.log("PGUSER:", process.env.PGUSER);
console.log("PGPASSWORD:", process.env.PGPASSWORD);

const { Pool } = require('pg');
// const PGPASSWORD = process.env.PGPASSWORD


// 创建连接池
const pool = new Pool({
  host: process.env.PGHOST,
  port: process.env.PGPORT,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
});

async function main() {
  try {
    console.log('Connecting to PostgreSQL...');
    const client = await pool.connect();
    console.log('Connected!');

    // =======================
    // 1. 插入用户
    // =======================
    await client.query(
      `INSERT INTO users (wallet_address) VALUES ($1), ($2) ON CONFLICT DO NOTHING`,
      ['0xABC123', '0xDEF456']
    );
    console.log('Inserted users.');

    // =======================
    // 2. 插入 NFT
    // =======================
    await client.query(
      `INSERT INTO nfts 
      (token_id, contract_address, title, image_url, creator_address, current_owner, royalty_percent) 
      VALUES ($1,$2,$3,$4,$5,$6,$7) 
      ON CONFLICT DO NOTHING`,
      [1, '0xContract1', 'NFT #1', 'https://picsum.photos/200', '0xABC123', '0xABC123', 5]
    );
    console.log('Inserted NFT.');

    // =======================
    // 3. 插入 Listing
    // =======================
    await client.query(
      `INSERT INTO listings (nft_id, seller_address, price) VALUES ($1,$2,$3)`,
      [1, '0xABC123', 1.5]
    );
    console.log('Inserted listing.');

    // =======================
    // 4. 插入 Royalty
    // =======================
    await client.query(
      `INSERT INTO royalties (nft_id, creator_address, amount) VALUES ($1,$2,$3)`,
      [1, '0xABC123', 0.075]
    );
    console.log('Inserted royalty.');

    // =======================
    // 5. 查询 NFT
    // =======================
    const resNFT = await client.query('SELECT * FROM nfts');
    console.log('NFTs:', resNFT.rows);

    // =======================
    // 6. 查询 Listings
    // =======================
    const resListing = await client.query('SELECT * FROM listings');
    console.log('Listings:', resListing.rows);

    // =======================
    // 7. 更新 NFT 当前持有者
    // =======================
    await client.query(
      `UPDATE nfts SET current_owner=$1 WHERE nft_id=$2`,
      ['0xDEF456', 1]
    );
    console.log('Updated NFT owner.');

    // =======================
    // 8. 删除 NFT（会级联删除 listings 和 royalties）
    // =======================
    // await client.query(`DELETE FROM nfts WHERE nft_id=$1`, [1]);
    // console.log('Deleted NFT.');

    client.release();
    console.log('All operations done!');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

main();
