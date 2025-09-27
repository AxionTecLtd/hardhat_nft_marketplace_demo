// ===== MYNFT =====
let myNFTData = [];
let myCurrentPage = 1;
const myItemsPerPage = 6; // ✅ 和 Market 分开

// 初始化 MyNFT 页面
function initMyNFT() {
    fetchMyNFTs();

    // const uploadForm = document.getElementById('uploadForm');
    // if (uploadForm) {
    //     uploadForm.addEventListener('submit', async function(e){
    //         e.preventDefault();
    //         const address = prompt("请输入您的钱包地址（测试用）:");
    //         if(!address) return alert("请提供钱包地址");

    //         const newNFT = {
    //             title: document.getElementById('nftTitle').value,
    //             image_url: document.getElementById('nftImage').value,
    //             story: document.getElementById('nftStory').value,
    //             price: parseFloat(document.getElementById('nftPrice').value),
    //             type: document.getElementById('nftType').value,
    //             royalty_percent: parseFloat(document.getElementById('nftRoyalty').value)
    //         };

    //         try {
    //             const res = await fetch(`/api/users/${address}/nfts`, {
    //                 method: 'POST',
    //                 headers: {'Content-Type': 'application/json'},
    //                 body: JSON.stringify(newNFT)
    //             });
    //             const data = await res.json();
    //             alert("NFT 上传成功！");
    //             fetchMyNFTs(address);
    //             this.reset();
    //         } catch (err) {
    //             console.error(err);
    //             alert("上传失败");
    //         }
    //     });
    // }

    const uploadForm = document.getElementById('uploadForm');
if (uploadForm) {
    uploadForm.addEventListener('submit', async function(e){
        e.preventDefault();

        const address = prompt("请输入您的钱包地址（测试用）:");
        if(!address) return alert("请提供钱包地址");

        // 构建要发送到后端的 NFT 对象
        const newNFT = {
            title: document.getElementById('nftTitle').value,
            image_url: document.getElementById('nftImage').value,
            story: document.getElementById('nftStory').value,
            price: parseFloat(document.getElementById('nftPrice').value),
            type: document.getElementById('nftType').value,
            royalty_percent: parseInt(document.getElementById('nftRoyalty').value),
            contract_address: "0x0000000000000000000000000000000000000000" // 默认合约地址
        };

        try {
            const res = await fetch(`/api/users/${address}/nfts`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(newNFT)
            });

            if (!res.ok) {
                const text = await res.text();
                throw new Error(`请求失败: ${res.status}\n${text}`);
            }

            const data = await res.json();
            alert("NFT 上传成功！");
            fetchMyNFTs(address);
            this.reset();
        } catch (err) {
            console.error(err);
            alert("上传失败，请检查后端控制台错误信息");
        }
    });
}

    // 分页按钮事件
    const prevBtn = document.getElementById('prevMyPage');
    const nextBtn = document.getElementById('nextMyPage');
    if (prevBtn && nextBtn) {
        prevBtn.addEventListener('click', () => {
            if(myCurrentPage > 1) { myCurrentPage--; renderMyNFTs(); }
        });
        nextBtn.addEventListener('click', () => {
            if(myCurrentPage < Math.ceil(myNFTData.length/myItemsPerPage)) { myCurrentPage++; renderMyNFTs(); }
        });
    }
}

// 获取用户 NFT
async function fetchMyNFTs(address) {
    try {
        const userAddr = address || prompt("请输入您的钱包地址（测试用）:");
        if(!userAddr) return;

        const res = await fetch(`/api/users/${userAddr}/nfts?page=1&limit=100`);
        myNFTData = await res.json();
        renderMyNFTs();
    } catch (err) {
        console.error(err);
    }
}

// 渲染用户 NFT
function renderMyNFTs() {
    const container = document.getElementById('myNFTs');
    if (!container) return;
    container.innerHTML = '';
    let start = (myCurrentPage-1)*myItemsPerPage;
    let end = start + myItemsPerPage;
    myNFTData.slice(start,end).forEach(nft => {
        const card = document.createElement('div');
        card.className = 'nft-card';
        card.innerHTML = `
            <img src="${nft.image_url}" alt="${nft.title}">
            <div class="nft-info">
                <div class="nft-title">${nft.title}</div>
                <div class="nft-story">${nft.story}</div>
                <div class="nft-meta">
                    <span>${nft.type || ''}</span>
                    <span>${nft.price || 0} ETH</span>
                </div>
                <div class="nft-meta">Status: ${nft.status}</div>
            </div>
            <div class="nft-actions">
                <button onclick="mintNFT('${nft.token_id}')">Mint</button>
                <button onclick="removeNFT('${nft.token_id}')">Remove</button>
            </div>
        `;
        container.appendChild(card);
    });
    const pageInfo = document.getElementById('myPageInfo');
    if (pageInfo) pageInfo.innerText = `Page ${myCurrentPage}/${Math.ceil(myNFTData.length/myItemsPerPage)}`;
}

// ===== MARKET =====
let nftData = [];
let currentPage = 1;
const marketItemsPerPage = 6; // ✅ 和 myNFT 分开

// 初始化 Marketplace 页面
async function initMarket() {
    await fetchNFTs();
    renderMarketNFTs();
    renderRanking();
    renderPriceTrend();

    // 分页按钮事件
    document.getElementById('prevPage').addEventListener('click', async () => {
        if (currentPage > 1) {
            currentPage--;
            renderMarketNFTs();
        }
    });
    document.getElementById('nextPage').addEventListener('click', async () => {
        if (currentPage < Math.ceil(nftData.length / marketItemsPerPage)) {
            currentPage++;
            renderMarketNFTs();
        }
    });
}

// 从后端获取 NFT 数据
async function fetchNFTs() {
    try {
        const res = await fetch(`/api/nfts?page=${currentPage}&limit=100`);
        nftData = await res.json();
        console.log("📦 NFT 数据:", nftData); // ✅ 调试日志
    } catch (err) {
        console.error('获取 NFT 数据失败:', err);
    }
}

// 渲染 NFT 卡片
function renderMarketNFTs() {
    const container = document.getElementById('marketNFTs');
    container.innerHTML = '';
    let start = (currentPage - 1) * marketItemsPerPage;
    let end = start + marketItemsPerPage;
    nftData.slice(start, end).forEach(nft => {
        const card = document.createElement('div');
        card.className = 'nft-card';
        card.innerHTML = `
            <img src="${nft.image_url}" alt="${nft.title}">
            <div class="nft-info">
                <div class="nft-title">${nft.title}</div>
                <div class="nft-creator">Creator: ${nft.creator_address}</div>
                <div class="nft-story">${nft.story || ''}</div>
                <div class="nft-meta">
                    <span>${nft.type || ''}</span>
                    <span>${nft.price || 0} ETH</span>
                    <span>Royalty: ${nft.royalty_percent || 0}%</span>
                </div>
            </div>
            <div class="nft-actions">
                <button onclick="likeNFT(${nft.token_id})">❤️ ${nft.likes || 0}</button>
                <button onclick="wantNFT(${nft.token_id})">⭐ ${nft.wants || 0}</button>
                <button onclick="buyNFT(${nft.token_id})">Buy</button>
            </div>
        `;
        container.appendChild(card);
    });
    document.getElementById('pageInfo').innerText = `Page ${currentPage}/${Math.ceil(nftData.length / marketItemsPerPage)}`;
}

// 排行榜
function renderRanking() {
    const container = document.getElementById('rankingList');
    container.innerHTML = '';
    let topNFTs = [...nftData].sort((a, b) => ((b.likes||0) + (b.wants||0)) - ((a.likes||0) + (a.wants||0))).slice(0, 5);
    topNFTs.forEach(nft => {
        const li = document.createElement('li');
        li.innerText = `${nft.title} - Likes:${nft.likes || 0} Wants:${nft.wants || 0}`;
        container.appendChild(li);
    });
}

// 价格趋势图
function renderPriceTrend() {
    const ctx = document.getElementById('priceChart').getContext('2d');
    const labels = nftData.slice(0, 10).map(n => n.title);
    const data = nftData.slice(0, 10).map(n => n.price || 0);
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Price ETH',
                data: data,
                borderColor: 'rgb(75,192,192)',
                tension: 0.3
            }]
        },
        options: { responsive: true }
    });
}

// ===== 占位操作函数 =====

// 点赞
function likeNFT(tokenId) {
    alert(`👍 点赞成功 (Token ID: ${tokenId})`);
}

// 想要
function wantNFT(tokenId) {
    alert(`⭐ 收藏成功 (Token ID: ${tokenId})`);
}

// 购买
function buyNFT(tokenId) {
    alert(`💰 购买功能待实现 (Token ID: ${tokenId})`);
}

// 铸造
// 铸造 NFT
// D:\projects\hardhat_nft_marketplace\hardhat-nft\frontend\script.js
// ===== MyNFT 页面 =====

// 在 mintNFT 函数里调用
async function mintNFT(tokenId) {
    try {
        // 获取当前 NFT 数据
        const nft = myNFTData.find(n => n.token_id == tokenId);
        if (!nft) return alert('NFT 数据不存在');

        // 向后端请求 voucher
        const { voucher, signature } = await getVoucher(
            nft.image_url,     // 或 tokenURI
            nft.price,         // minPrice
            tokenId            // nonce 可用 tokenId 或自定义
        );

        // 买家钱包
        const buyerPrivateKey = prompt("请输入买家私钥（测试用）:");
        const provider = new ethers.BrowserProvider(window.ethereum); // 或你自己的 provider
        const wallet = new ethers.Wallet(buyerPrivateKey, provider);
        const lazyWithWallet = lazyNFT.connect(wallet);

        const tx = await lazyWithWallet.redeem(voucher, signature, { value: ethers.parseEther(nft.price.toString()) });
        await tx.wait();

        alert('铸造成功！TxHash: ' + tx.hash);
        fetchMyNFTs(); // 刷新列表
    } catch (err) {
        console.error('Mint NFT 失败:', err);
        alert('Mint NFT 失败，请查看控制台');
    }
}

// getVoucher 函数
async function getVoucher(tokenURI, minPrice, nonce) {
    const res = await fetch('/api/voucher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenURI, minPrice, nonce })
    });
    if (!res.ok) throw new Error('生成 voucher 失败');
    return await res.json(); // { voucher, signature }
}


// 删除
function removeNFT(tokenId) {
    alert(`❌ 移除功能待实现 (Token ID: ${tokenId})`);
}
