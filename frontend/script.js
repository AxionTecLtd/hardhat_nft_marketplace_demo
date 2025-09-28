// ==========================
// script.js
// 企业级 MyNFT + Marketplace 前端逻辑
// ==========================

// --------------------------
// 一、全局变量
// --------------------------
let myNFTData = [];           // 用户 NFT 数据
let myCurrentPage = 1;        // 用户 NFT 当前页
const myItemsPerPage = 6;     // 用户 NFT 每页数量
let userAddr = '';            // 用户钱包地址

let nftData = [];             // Marketplace NFT 数据
let currentPage = 1;          // Marketplace 当前页
const marketItemsPerPage = 6; // Marketplace 每页数量

// --------------------------
// 二、初始化 MyNFT 页面
// --------------------------
function initMyNFT() {
    const savedAddress = localStorage.getItem('walletAddress');
    if (savedAddress) {
        userAddr = savedAddress;
    } else {
        const address = prompt("请输入您的钱包地址（测试用）:");
        if (!address) return alert("必须提供钱包地址");
        userAddr = address;
        localStorage.setItem('walletAddress', userAddr);
    }

    fetchMyNFTs();

    const prevBtn = document.getElementById('prevMyPage');
    const nextBtn = document.getElementById('nextMyPage');
    if (prevBtn && nextBtn) {
        prevBtn.addEventListener('click', () => {
            if (myCurrentPage > 1) { myCurrentPage--; renderMyNFTs(); }
        });
        nextBtn.addEventListener('click', () => {
            if (myCurrentPage < Math.ceil(myNFTData.length / myItemsPerPage)) { myCurrentPage++; renderMyNFTs(); }
        });
    }

    const uploadForm = document.getElementById('uploadForm');
    if (uploadForm) {
        uploadForm.addEventListener('submit', handleLazyMint);
    }

    // ✅ 更换钱包按钮
    const changeWalletBtn = document.getElementById('changeWalletBtn');
    if (changeWalletBtn) {
        changeWalletBtn.addEventListener('click', () => {
            const newAddress = prompt("请输入新的钱包地址（测试用）:");
            if (!newAddress) return;          // 没输入直接返回
            if (newAddress === userAddr) return; // 地址没改也返回
            userAddr = newAddress;
            localStorage.setItem('walletAddress', userAddr);

            // 重置分页 & 清空上传表单
            myCurrentPage = 1;
            if (uploadForm) uploadForm.reset();

            // 刷新 NFT 列表
            fetchMyNFTs();
        });
    }
}

// --------------------------
// 三、获取用户 NFT 数据
// --------------------------
async function fetchMyNFTs() {
    try {
        const res = await fetch(`/api/users/${userAddr}/nfts?page=1&limit=100`);
        myNFTData = await res.json();
        console.log("📦 返回的 NFT 数据:", myNFTData);
        renderMyNFTs();
    } catch (err) {
        console.error("❌ 获取用户 NFT 失败:", err);
    }
}

// --------------------------
// 四、渲染用户 NFT 列表（只显示删除）
// --------------------------
function renderMyNFTs() {
    const container = document.getElementById('myNFTs');
    if (!container) return;
    container.innerHTML = '';

    const start = (myCurrentPage - 1) * myItemsPerPage;
    const end = start + myItemsPerPage;

    myNFTData.slice(start, end).forEach(nft => {
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
                <button class="removeNFTBtn" data-nftid="${nft.nft_id}">Remove</button>
            </div>
        `;
        container.appendChild(card);
    });

    const pageInfo = document.getElementById('myPageInfo');
    if (pageInfo) pageInfo.innerText = `Page ${myCurrentPage}/${Math.ceil(myNFTData.length / myItemsPerPage)}`;

    // 绑定删除事件
    document.querySelectorAll('.removeNFTBtn').forEach(btn => {
        btn.removeEventListener('click', removeNFTHandler);
        btn.addEventListener('click', removeNFTHandler);
    });
}

// --------------------------
// 五、上传 NFT 表单处理（唯一懒铸造入口）
// --------------------------
async function handleLazyMint(e) {
    e.preventDefault();
    if (!userAddr) return alert("钱包地址未获取");

    const newNFT = {
        title: document.getElementById('nftTitle').value,
        image_url: document.getElementById('nftImage').value,
        story: document.getElementById('nftStory').value,
        price: parseFloat(document.getElementById('nftPrice').value),
        type: document.getElementById('nftType').value,
        royalty_percent: parseInt(document.getElementById('nftRoyalty').value)
    };

    try {
        const res = await fetch(`/api/users/${userAddr}/nfts/lazy`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newNFT)
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`请求失败: ${res.status}\n${text}`);
        }

        const data = await res.json();
        alert("✅ NFT 上传成功，已生成懒铸造凭证");
        fetchMyNFTs();
        this.reset();
    } catch (err) {
        console.error("上传 NFT 出错:", err);
        alert("上传失败，请检查控制台信息");
    }
}

// --------------------------
// 六、删除 NFT
// --------------------------
function removeNFTHandler(e) {
    const nft_id = e.target.dataset.nftid;
    removeNFT(nft_id);
}

async function removeNFT(nft_id) {
    if (!nft_id) return alert("nft_id 不存在，无法删除");
    if (!userAddr) return alert("未获取钱包地址");
    if (!confirm(`确定要删除 NFT（nft ID: ${nft_id}）吗？`)) return;

    try {
        const res = await fetch(`/api/users/${userAddr}/nfts/${nft_id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            alert("✅ NFT 删除成功");
            fetchMyNFTs();
        } else {
            alert("❌ 删除失败: " + (data.error || '未知错误'));
        }
    } catch (err) {
        console.error("删除 NFT 出错:", err);
        alert("删除失败，请查看控制台");
    }
}



// --------------------------
// 九、Marketplace 页面初始化
// --------------------------
async function initMarket() {
    await fetchNFTs();
    renderMarketNFTs();
    renderRanking();
    renderPriceTrend();

    document.getElementById('prevPage').addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderMarketNFTs();
        }
    });

    document.getElementById('nextPage').addEventListener('click', () => {
        if (currentPage < Math.ceil(nftData.length / marketItemsPerPage)) {
            currentPage++;
            renderMarketNFTs();
        }
    });
}

// --------------------------
// 十、Marketplace 数据与渲染
// --------------------------
async function fetchNFTs() {
    try {
        const res = await fetch(`/api/nfts?page=${currentPage}&limit=100`);
        nftData = await res.json();
        console.log("📦 Marketplace NFT 数据:", nftData);
    } catch (err) {
        console.error("获取 Marketplace NFT 数据失败:", err);
    }
}

function renderMarketNFTs() {
    const container = document.getElementById('marketNFTs');
    if (!container) return;
    container.innerHTML = '';

    const start = (currentPage - 1) * marketItemsPerPage;
    const end = start + marketItemsPerPage;

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
                <button onclick="buyNFT(${nft.token_id}, '${userAddr}')">Buy</button>
            </div>
        `;
        container.appendChild(card);
    });

    const pageInfo = document.getElementById('pageInfo');
    if (pageInfo) pageInfo.innerText = `Page ${currentPage}/${Math.ceil(nftData.length / marketItemsPerPage)}`;
}

// --------------------------
// 十一、Marketplace 辅助功能
// --------------------------
// 排行榜
function renderRanking() {
    const container = document.getElementById('rankingList');
    if (!container) return;
    container.innerHTML = '';
    const topNFTs = [...nftData].sort((a,b) => ((b.likes||0)+(b.wants||0)) - ((a.likes||0)+(a.wants||0))).slice(0,5);
    topNFTs.forEach(nft => {
        const li = document.createElement('li');
        li.innerText = `${nft.title} - Likes:${nft.likes || 0} Wants:${nft.wants || 0}`;
        container.appendChild(li);
    });
}
// 走势
function renderPriceTrend() {
    const ctx = document.getElementById('priceChart')?.getContext('2d');
    if (!ctx) return;
    const labels = nftData.slice(0,10).map(n => n.title);
    const data = nftData.slice(0,10).map(n => n.price || 0);
    new Chart(ctx, {
        type: 'line',
        data: { labels, datasets: [{ label:'Price ETH', data, borderColor:'rgb(75,192,192)', tension:0.3 }]},
        options: { responsive:true }
    });
}

// --------------------------
// 十二、Marketplace 点赞/收藏/购买
// --------------------------
function likeNFT(tokenId) {
    alert(`👍 点赞成功 (Token ID: ${tokenId})`);
}

function wantNFT(tokenId) {
    alert(`⭐ 收藏成功 (Token ID: ${tokenId})`);
}


// buy
async function buyNFT(tokenId, buyerAddress) {
    try {
        const res = await fetch("/api/nfts/marketplace/buy", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tokenId, buyerAddress }) // 只传这两个字段
        });

        const data = await res.json();
        if (data.success) {
            alert(`✅ 购买成功！交易 Hash: ${data.txHash}`);
        } else {
            alert(`❌ 购买失败: ${data.error}`);
        }
    } catch (err) {
        console.error("购买请求出错:", err);
        alert("系统错误，请稍后再试");
    }
}




// --------------------------
// 初始化
// --------------------------
document.addEventListener('DOMContentLoaded', () => {
    initMyNFT();
    initMarket();
});
