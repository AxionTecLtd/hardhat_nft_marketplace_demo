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
const marketItemsPerPage = 12; // Marketplace 每页数量

// --------------------------
// 统一获取钱包地址函数
// --------------------------

// 获取用户钱包地址
function getUserAddress() {
    let addr = localStorage.getItem('walletAddress');
    if (!addr) {
        addr = prompt("请输入钱包地址（测试用）:");
        if (!addr) return null;
        localStorage.setItem('walletAddress', addr);
    }
    return addr;
}

// 设置钱包地址（切换）
function setUserAddress(newAddr) {
    if (!newAddr) return;
    localStorage.setItem('walletAddress', newAddr);
}


// --------------------------
// 二、初始化 MyNFT 页面
// --------------------------
function initMyNFT() {
    userAddr = getUserAddress();
    if (!userAddr) return alert("必须提供钱包地址");
    

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


// ------------------------------------------
// 四、 渲染用户 NFT 列表（一级市场 / 二级市场）
// ------------------------------------------
/**
 * 功能目标：
 *  1. 根据 NFT 的市场类别（一级 / 二级）、状态（Sold / 未售出）、持有人权限，动态渲染 UI。
 *  2. 只有创作者或当前持有人，才能执行删除 / 上架 / 下架操作。
 *  3. 已售出且非持有人 → 按钮显示为「已售出」，删除按钮隐藏。
 *
 * 权限控制：
 *  - 一级市场（token_id 为空） → 仅创作者可操作。
 *  - 二级市场（token_id 存在）：
 *      · 当前持有人 = userAddr → 可上架/下架 + 删除。
 *      · 非持有人 → 禁用操作，显示“已售出”或“无权限”。
 *
 * UI 渲染：
 *  - 状态文本根据 is_listed、status 动态切换。
 *  - 删除按钮在无权限时彻底隐藏（避免误点或假象）。
 *  - 上架按钮文案动态切换：投放/撤回、链上出售/停售。
 *
 * 分页处理：
 *  - 按当前页码 + 每页数量切片渲染。
 *  - 更新页码信息。
 *
 * 事件绑定：
 *  - 删除按钮 → removeNFTHandler。
 *  - 上架/下架按钮 → toggleListingHandler（仅绑定非禁用按钮）。
 */
function renderMyNFTs() {
    const primaryContainer = document.getElementById('primaryNFTs');
    const secondaryContainer = document.getElementById('secondaryNFTs');
    if (!primaryContainer || !secondaryContainer) return;

    // 清空容器，防止重复渲染
    primaryContainer.innerHTML = '';
    secondaryContainer.innerHTML = '';

    // 分页切片范围
    const start = (myCurrentPage - 1) * myItemsPerPage;
    const end = start + myItemsPerPage;

    myNFTData.slice(start, end).forEach(nft => {
        const card = document.createElement('div');
        card.className = 'nft-card';

        const isListed = Boolean(Number(nft.is_listed)); // 是否上架
        const isPrimary = !nft.token_id;                 // 是否一级市场
        let statusText = '';     // 状态描述
        let toggleBtnHtml = '';  // 上架/下架按钮
        let removeBtnHtml = '';  // 删除按钮（可能隐藏）

        // ------------------------
        // 一级市场逻辑
        // ------------------------
        if (isPrimary) {
            statusText = `状态: ${isListed ? '懒铸造已投放一级市场' : '懒铸造未投放'}`;

            if (nft.creator_address === userAddr) {
                // 当前用户是创作者 → 允许投放/撤回、删除
                toggleBtnHtml = `<button class="toggleListingBtn" data-nftid="${nft.nft_id}">
                                    ${isListed ? '撤回一级市场' : '投放一级市场'}
                                 </button>`;
                removeBtnHtml = `<button class="removeNFTBtn" data-nftid="${nft.nft_id}">删除</button>`;
            } else {
                // 非创作者 → 禁用操作，隐藏删除
                toggleBtnHtml = `<button disabled>无权限</button>`;
            }
        }

        // ------------------------
        // 二级市场逻辑
        // ------------------------
        else {
            if (nft.status === 'Sold') {
                if (nft.current_owner === userAddr) {
                    // 已售出但当前用户为持有人（回购情况）
                    statusText = `状态: 已回购 - ${isListed ? '二级市场出售中' : '未链上出售'}`;
                    toggleBtnHtml = `<button class="toggleListingBtn" data-nftid="${nft.nft_id}" data-onchain="true">
                                        ${isListed ? '链上停售' : '链上出售'}
                                     </button>`;
                    removeBtnHtml = `<button class="removeNFTBtn" data-nftid="${nft.nft_id}">删除</button>`;
                } else {
                    // 已售出且非持有人 → 禁止一切操作
                    statusText = '状态: 二级市场已售出';
                    toggleBtnHtml = `<button disabled>已售出</button>`;
                }
            } else {
                // 未售出 → 判断持有人
                statusText = `状态: ${isListed ? '二级市场出售中' : '未链上出售'}`;
                if (nft.current_owner === userAddr) {
                    toggleBtnHtml = `<button class="toggleListingBtn" data-nftid="${nft.nft_id}" data-onchain="true">
                                        ${isListed ? '链上停售' : '链上出售'}
                                     </button>`;
                    removeBtnHtml = `<button class="removeNFTBtn" data-nftid="${nft.nft_id}">删除</button>`;
                } else {
                    toggleBtnHtml = `<button disabled>已售出</button>`;
                }
            }
        }

        // ------------------------
        // 拼装卡片 UI
        // ------------------------
        card.innerHTML = `
            <img src="${nft.image_url}" alt="${nft.title}">
            <div class="nft-info">
                <div class="nft-title">${nft.title}</div>
                <div class="nft-story">${nft.story || ''}</div>
                <div class="nft-meta">
                    <span>${nft.type || ''}</span>
                    <span>${nft.price || 0} ETH</span>
                </div>
                <div class="nft-meta">${statusText}</div>
            </div>
            <div class="nft-actions">
                ${toggleBtnHtml}
                ${removeBtnHtml}
            </div>
        `;

        // 根据市场类别放入对应容器
        if (isPrimary) {
            primaryContainer.appendChild(card);
        } else {
            secondaryContainer.appendChild(card);
        }
    });

    // ------------------------
    // 分页信息渲染
    // ------------------------
    const pageInfo = document.getElementById('myPageInfo');
    if (pageInfo) {
        pageInfo.innerText = `Page ${myCurrentPage}/${Math.ceil(myNFTData.length / myItemsPerPage)}`;
    }

    // ------------------------
    // 事件绑定
    // ------------------------
    document.querySelectorAll('.removeNFTBtn').forEach(btn => {
        btn.removeEventListener('click', removeNFTHandler);
        btn.addEventListener('click', removeNFTHandler);
    });
    document.querySelectorAll('.toggleListingBtn:not([disabled])').forEach(btn => {
        btn.removeEventListener('click', toggleListingHandler);
        btn.addEventListener('click', toggleListingHandler);
    });
}





function toggleListingHandler(e) {
    const nft_id = e.target.dataset.nftid;
    toggleListing(nft_id);
}

async function toggleListing(nft_id) {
    const userAddr = getUserAddress();
    if (!userAddr) return alert("未获取钱包地址");

    const nft = myNFTData.find(n => String(n.nft_id) === String(nft_id));
    if (!nft) return alert("NFT 数据不存在");

    const isListed = Boolean(Number(nft.is_listed));

    let apiUrl = '';
    let method = 'POST';
    let bodyData = { sellerAddress: userAddr, nft_id };

    // 一级市场（未铸造 NFT）保留原 confirm 逻辑
    if (!nft.token_id) {
        const action = isListed ? '撤回一级市场' : '投放一级市场';
        if (!confirm(`确定要执行「${action}」操作吗？\nNFT: ${nft.title}`)) return;

        // 一级市场不调用链上 Marketplace，只更新数据库或调用现有 LazyNFT mint 流程
        apiUrl = `/api/users/${userAddr}/nfts/${nft_id}/toggle-listing`; // 后端自己处理一级市场
        bodyData.onChain = false;

    } else {
        // 二级市场逻辑
        if (!isListed) {
            // 链上出售
            // 用户输入新的上架价格

            const choice = prompt(
                `请确认 NFT 链上操作：\n1️⃣ 链上出售 (On-chain) - 会产生 Gas 费用\n请输入 1 确认`,
                ""
            );
            if (choice !== "1") return alert("操作已取消");
            

            apiUrl = `/api/nfts/marketplace/list`; // 上架
            bodyData.price = nft.price;       // 需要传价格
        } else {
            // 链上停售
            const choice = prompt(
                `请确认 NFT 链上操作：\n2️⃣ 链上停售 (Off-chain) - 会产生 Gas 费用\n请输入 2 确认`,
                ""
            );
            if (choice !== "2") return alert("操作已取消");

            apiUrl = `/api/nfts/marketplace/cancel`; // 下架
        }
    }

    try {
        const res = await fetch(apiUrl, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bodyData)
        });

        const data = await res.json();
        if (data.success) {
            nft.is_listed = apiUrl.includes('list') ? 1 : 0;
            alert(`✅ NFT 已成功${apiUrl.includes('list') ? '链上出售' : '链上停售'}`);
            renderMyNFTs();
        } else {
            alert(`❌ 操作失败: ${data.error || '未知错误'}`);
        }
    } catch (err) {
        console.error("切换上架状态失败:", err);
        alert("系统错误，请稍后再试");
    }
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
        royalty_percent: parseInt(document.getElementById('nftRoyalty').value),
        token_uri: document.getElementById('nftMetadata').value  // 用户自己上传的 JSON
    };
       // ----- 前端校验 -----
    if (!newNFT.title || !newNFT.story || !newNFT.price || !newNFT.type || !newNFT.token_uri) {
        return alert("请填写所有必填字段");
    }
    if (isNaN(newNFT.price) || newNFT.price <= 0) return alert("价格必须是大于 0 的数字");
    const allowedTypes = ['Fixed Price','Auction','Bundle'];
    if (!allowedTypes.includes(newNFT.type)) return alert("NFT 类型不合法");
    if (isNaN(newNFT.royalty_percent) || newNFT.royalty_percent < 0 || newNFT.royalty_percent > 100) return alert("版税必须在 0~100 之间");



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
    await renderTopNFTs(); // ✅ 等数据返回再渲染

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

// 价格走势
let priceChartInstance = null; // 保存 Chart 实例

function renderPriceTrend() {
    const ctx = document.getElementById('priceChart')?.getContext('2d');
    if (!ctx) return;

    const labels = nftData.slice(0,10).map(n => n.title);
    const data = nftData.slice(0,10).map(n => n.price || 0);

    // 如果已有实例，先销毁
    if (priceChartInstance) priceChartInstance.destroy();

    priceChartInstance = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets: [{ label:'Price ETH', data, borderColor:'rgb(75,192,192)', tension:0.3 }]},
        options: { responsive:true }
    });
}




// --------------------------
// 十三、购买
// --------------------------
// 
async function buyNFT(nft_id) {
    const buyerAddress = getUserAddress();
    if (!buyerAddress) return alert("未获取钱包地址");

    try {
        const res = await fetch("/api/nfts/marketplace/buy", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nft_id, buyerAddress })
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
// 十四、Top NFTs 两列数据
// --------------------------
let topLikesData = [];
let topWantsData = [];

// --------------------------
// 渲染 Top Likes / Wants 两列（兼容后端返回）
// --------------------------
async function renderTopNFTs() {
    const likesList = document.getElementById('likesTopList');
    const wantsList = document.getElementById('wantsTopList');

    if (!likesList || !wantsList) {
        return console.warn("❌ Top NFTs DOM 元素不存在");
    }

    try {
        // 并行请求
        const [resLikes, resWants] = await Promise.all([
            fetch('/api/nft/likes/top?limit=10'),
            fetch('/api/nft/wants/top?limit=10')
        ]);

        const likesData = await resLikes.json();
        const wantsData = await resWants.json();

        // 🔹 兼容不同返回格式
        topLikesData = Array.isArray(likesData) ? likesData :
                       (Array.isArray(likesData.data) ? likesData.data : []);
        topWantsData = Array.isArray(wantsData) ? wantsData :
                       (Array.isArray(wantsData.data) ? wantsData.data : []);

        // 🔹 清空列表
        likesList.innerHTML = '';
        wantsList.innerHTML = '';

        // 🔹 渲染 Likes
        topLikesData.forEach(nft => {
            const li = document.createElement('li');
            li.innerText = `${nft.title || '未命名'} - Likes: ${nft.likes || 0}`;
            likesList.appendChild(li);
        });

        // 🔹 渲染 Wants
        topWantsData.forEach(nft => {
            const li = document.createElement('li');
            li.innerText = `${nft.title || '未命名'} - Wants: ${nft.wants || 0}`;
            wantsList.appendChild(li);
        });

    } catch (err) {
        console.error('❌ 获取 Top NFTs 失败:', err);
    }
}




// --------------------------
// 点赞 NFT（增强版）
// --------------------------
const lastLikeTime = {}; // nft_id -> 时间戳
async function likeNFT(nft_id) {
    const addr = getUserAddress();
    if (!addr) return alert("未获取钱包地址");

    const now = Date.now();
    if (lastLikeTime[nft_id] && now - lastLikeTime[nft_id] < 1000) {
        return alert("操作过于频繁，请稍后再试");
    }
    lastLikeTime[nft_id] = now;

    try {
        const res = await fetch('/api/nft/likes/like', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_address: addr,
                nft_id,
                ip_address: '127.0.0.1',
                user_agent: navigator.userAgent
            })
        });

        const data = await res.json();
        if (data.success) {
            // 🔹 更新 Marketplace NFT 数据本地状态
            const nft = nftData.find(n => String(n.nft_id) === String(nft_id));
            if (nft) {
                nft.likes = data.likes; 
                nft.user_liked = data.status; // 1 点赞, 0 未点赞
            }

            // 🔹 更新按钮显示
            const btn = document.querySelector(`button[data-likeid="${nft_id}"]`);
            if (btn) {
                btn.style.color = data.status === 1 ? 'red' : 'white';
                btn.innerText = `${data.status === 1 ? '❤️' : '🤍'} ${data.likes}`;  // ⚠️ 改这里
            }

            // 🔹 刷新排行榜
            renderTopNFTs();
        } else {
            alert(`❌ 点赞失败: ${data.error || '未知错误'}`);
        }
    } catch (err) {
        console.error("点赞失败:", err);
        alert("系统错误，请查看控制台");
    }
}

// --------------------------
// 收藏 NFT（增强版）
// --------------------------
const lastWantTime = {}; // nft_id -> 时间戳
async function wantNFT(nft_id) {
    const addr = getUserAddress();
    if (!addr) return alert("未获取钱包地址");

    const now = Date.now();
    if (lastWantTime[nft_id] && now - lastWantTime[nft_id] < 1000) {
        return alert("操作过于频繁，请稍后再试");
    }
    lastWantTime[nft_id] = now;

    try {
        const res = await fetch('/api/nft/wants/want', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_address: addr,
                nft_id,
                ip_address: '127.0.0.1',
                user_agent: navigator.userAgent
            })
        });

        const data = await res.json();
        if (data.success) {
            const nft = nftData.find(n => String(n.nft_id) === String(nft_id));
            if (nft) {
                nft.wants = data.wants;      // ⚠️ 保持和后端字段一致
                nft.user_wanted = data.status; // 1 收藏, 0 未收藏
            }

            const btn = document.querySelector(`button[data-wantid="${nft_id}"]`);
            if (btn) {
                btn.style.color = data.status === 1 ? 'gold' : 'white';
                btn.innerText = `${data.status === 1 ? '⭐' : '☆'} ${data.wants}`;  // ⚠️ 改这里
            }

            renderTopNFTs();
        } else {
            alert(`❌ 收藏失败: ${data.error || '未知错误'}`);
        }
    } catch (err) {
        console.error("收藏失败:", err);
        alert("系统错误，请查看控制台");
    }
}



// ------------------------------------------
// Marketplace 渲染 NFT（匹配 Likes/Wants API）
// ------------------------------------------
function renderMarketNFTs() {
    const container = document.getElementById('marketNFTs');
    if (!container) return;
    container.innerHTML = '';

    const start = (currentPage - 1) * marketItemsPerPage;
    const end = start + marketItemsPerPage;

    nftData.slice(start, end).forEach(nft => {
        const liked = nft.user_liked === 1 || nft.user_liked === '1';
        const wanted = nft.user_wanted === 1 || nft.user_wanted === '1';

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
                <button data-likeid="${nft.nft_id}" style="color:${liked?'red':'white'}">
                    ${liked?'❤️':'🤍'} ${nft.likes || 0}
                </button>
                <button data-wantid="${nft.nft_id}" style="color:${wanted?'gold':'white'}">
                    ${wanted?'⭐':'☆'} ${nft.wants || 0}
                </button>
                <button onclick="buyNFT(${nft.nft_id})">Buy</button>
            </div>
        `;

        container.appendChild(card);
    });

    // ✅ 绑定点击事件
    container.querySelectorAll('button[data-likeid]').forEach(btn => {
        btn.removeEventListener('click', likeClickHandler);
        btn.addEventListener('click', likeClickHandler);
    });
    container.querySelectorAll('button[data-wantid]').forEach(btn => {
        btn.removeEventListener('click', wantClickHandler);
        btn.addEventListener('click', wantClickHandler);
    });

    // 分页显示
    const pageInfo = document.getElementById('pageInfo');
    if (pageInfo) pageInfo.innerText = `Page ${currentPage}/${Math.ceil(nftData.length / marketItemsPerPage)}`;
}


// 点击处理器
function likeClickHandler(e) {
    const nft_id = e.target.dataset.likeid;
    likeNFT(nft_id);
}
function wantClickHandler(e) {
    const nft_id = e.target.dataset.wantid;
    wantNFT(nft_id);
}


// --------------------------
// 初始化
// --------------------------
document.addEventListener('DOMContentLoaded', () => {
    initMyNFT();
    initMarket();
   
});

