// ==========================
// script.js
// 企业级 MyNFT + Marketplace 前端逻辑
// ==========================

// --------------------------
// 一、全局变量
// --------------------------
let myNFTData = [];           
let myCurrentPage = 1;        
const myItemsPerPage = 6;     
let userAddr = '';            
let nftData = [];             
let currentPage = 1;          
const marketItemsPerPage = 12; 

// --------------------------
// 初始化 MetaMask 钱包
// --------------------------
async function initWallet() {
    if (!window.ethereum) {
        alert("请安装 MetaMask！");
        return null;
    }
    try {
        await window.ethereum.request({ method: 'eth_requestAccounts' });
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = provider.getSigner();
        const address = await signer.getAddress();

        window.provider = provider;
        window.signer = signer;
        userAddr = address;

        console.log("🔑 当前钱包地址:", address);
        return address;
    } catch (err) {
        console.error("钱包初始化失败:", err);
        alert("钱包初始化失败，请检查 MetaMask");
        return null;
    }
}


// --------------------------
// 二、初始化 MyNFT 页面
// --------------------------
async function initMyNFT() {
    userAddr = await initWallet();
    if (!userAddr) return alert("必须提供钱包地址");

    await fetchMyNFTs();

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
    if (uploadForm) uploadForm.addEventListener('submit', handleLazyMint);
}


// --------------------------
// 三、获取用户 NFT 数据
// --------------------------
async function fetchMyNFTs() {
    if (!userAddr) return;
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
// 四、渲染用户 NFT 列表
// --------------------------
function renderMyNFTs() {
    const primaryContainer = document.getElementById('primaryNFTs');
    const secondaryContainer = document.getElementById('secondaryNFTs');
    if (!primaryContainer || !secondaryContainer) return;

    primaryContainer.innerHTML = '';
    secondaryContainer.innerHTML = '';

    const start = (myCurrentPage - 1) * myItemsPerPage;
    const end = start + myItemsPerPage;

    myNFTData.slice(start, end).forEach(nft => {
        const card = document.createElement('div');
        card.className = 'nft-card';

        const isListed = Boolean(Number(nft.is_listed));
        const isPrimary = !nft.token_id;
        let statusText = '';
        let toggleBtnHtml = '';
        let removeBtnHtml = '';

        // 一级市场逻辑
        if (isPrimary) {
            statusText = `状态: ${isListed ? '懒铸造已投放一级市场' : '懒铸造未投放'}`;
            if (nft.creator_address === userAddr) {
                toggleBtnHtml = `<button class="toggleListingBtn" data-nftid="${nft.nft_id}">${isListed ? '撤回一级市场' : '投放一级市场'}</button>`;
                removeBtnHtml = `<button class="removeNFTBtn" data-nftid="${nft.nft_id}">删除</button>`;
            } else {
                toggleBtnHtml = `<button disabled>无权限</button>`;
            }
        } else {
            // 二级市场逻辑
            if (nft.status === 'Sold' && nft.current_owner !== userAddr) {
                statusText = '状态: 二级市场已售出';
                toggleBtnHtml = `<button disabled>已售出</button>`;
            } else {
                statusText = `状态: ${isListed ? '二级市场出售中' : '未链上出售'}`;
                if (nft.current_owner === userAddr) {
                    toggleBtnHtml = `<button class="toggleListingBtn" data-nftid="${nft.nft_id}" data-onchain="true">${isListed ? '链上停售' : '链上出售'}</button>`;
                    removeBtnHtml = `<button class="removeNFTBtn" data-nftid="${nft.nft_id}">删除</button>`;
                } else {
                    toggleBtnHtml = `<button disabled>已售出</button>`;
                }
            }
        }

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
            <div class="nft-actions">${toggleBtnHtml}${removeBtnHtml}</div>
        `;

        if (isPrimary) primaryContainer.appendChild(card);
        else secondaryContainer.appendChild(card);
    });

    const pageInfo = document.getElementById('myPageInfo');
    if (pageInfo) pageInfo.innerText = `Page ${myCurrentPage}/${Math.ceil(myNFTData.length / myItemsPerPage)}`;

    // 绑定事件
    document.querySelectorAll('.removeNFTBtn').forEach(btn => {
        btn.removeEventListener('click', removeNFTHandler);
        btn.addEventListener('click', removeNFTHandler);
    });
    document.querySelectorAll('.toggleListingBtn:not([disabled])').forEach(btn => {
        btn.removeEventListener('click', toggleListingHandler);
        btn.addEventListener('click', toggleListingHandler);
    });
}


// --------------------------
// 链上出售 / 链上停售 / 修改价格
// --------------------------
async function toggleListingHandler(e) {
    const nft_id = e.target.dataset.nftid;
    await toggleListing(nft_id);
}

// 后端签名版-暂行
async function toggleListing(nft_id) {
    userAddr = userAddr || await initWallet();
    if (!userAddr) return alert("未获取钱包地址");

    const nft = myNFTData.find(n => String(n.nft_id) === String(nft_id));
    if (!nft) return alert("NFT 数据不存在");
    const isListed = Boolean(Number(nft.is_listed));
    let apiUrl = '';
    let method = 'POST';
    let bodyData = { sellerAddress: userAddr, nft_id };
    if (!nft.token_id) {
        // 一级市场逻辑不变
        const action = isListed ? '撤回一级市场' : '投放一级市场';
        if (!confirm(`确定要执行「${action}」操作吗？\nNFT: ${nft.title}`)) return;
        apiUrl = `/api/users/${userAddr}/nfts/${nft_id}/toggle-listing`;
        bodyData.onChain = false;
    } else {
        // 二级市场逻辑
        if (!isListed) {
            // 链上出售
            const choice = prompt(
                `请确认 NFT 链上操作：\n1️⃣ 链上出售 (On-chain) - 会产生 Gas 费用\n请输入 1 确认`,
                ""
            );
            if (choice !== "1") return alert("操作已取消");
            apiUrl = `/api/nfts/marketplace/list`;
            bodyData.price = nft.price;
        } else {
            // 已上架 -> 允许修改价格或下架
            const actionChoice = prompt(
                `NFT 已上架，操作选项：\n1️⃣ 修改价格\n2️⃣ 链上停售 (Off-chain)\n请输入 1 或 2 确认`,
                ""
            );
            if (actionChoice === "1") {
                const newPrice = prompt(`请输入新的上架价格（ETH）：`, nft.price);
                if (!newPrice || isNaN(newPrice) || Number(newPrice) <= 0) return alert("价格无效");
                apiUrl = `/api/nfts/marketplace/update-price`;
                bodyData.newPrice = newPrice;
            } else if (actionChoice === "2") {
                apiUrl = `/api/nfts/marketplace/cancel`;
            } else {
                return alert("操作已取消");
            }
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
            if (apiUrl.includes('list') || apiUrl.includes('update-price')) {
                nft.is_listed = 1;
                nft.price = bodyData.newPrice || nft.price;
            } else {
                nft.is_listed = 0;
            }
            alert(`✅ NFT 已成功${apiUrl.includes('list') ? '上架' : apiUrl.includes('update-price') ? '修改价格' : '下架'}`);
            renderMyNFTs();
        } else {
            alert(`❌ 操作失败: ${data.error || '未知错误'}`);
        }
    } catch (err) {
        console.error("切换上架状态失败:", err);
        alert("系统错误，请稍后再试");
    }
}

// 前端前面版本-未完成
// async function toggleListing(nft_id) {
//     userAddr = userAddr || await initWallet();
//     if (!userAddr) return alert("未获取钱包地址");

//     const nft = myNFTData.find(n => String(n.nft_id) === String(nft_id));
//     if (!nft) return alert("NFT 数据不存在");

//     const isListed = Boolean(Number(nft.is_listed));

//     if (!nft.token_id) {
//         // 一级市场操作，走后端接口
//         const action = isListed ? '撤回一级市场' : '投放一级市场';
//         if (!confirm(`确定要执行「${action}」操作吗？\nNFT: ${nft.title}`)) return;

//         const res = await fetch(`/api/users/${userAddr}/nfts/${nft_id}/toggle-listing`, {
//             method: 'POST',
//             headers: { 'Content-Type': 'application/json' },
//             body: JSON.stringify({ onChain: false })
//         });
//         const data = await res.json();
//         if (data.success) {
//             nft.is_listed = isListed ? 0 : 1;
//             alert(`✅ NFT 已成功${isListed ? '下架' : '上架'}`);
//             renderMyNFTs();
//         }
//         return;
//     }

//     const marketplaceAbi = fetch('./public/abi/Marketplace.json');
//     const lazyNFTAbi = fetch('./public/abi/LazyNFT.json');
//     const marketplaceAddress = '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512';
//     const lazyNFTAddress = '0x5FbDB2315678afecb367f032d93F642f64180aa3';


//     // 二级市场操作（链上）
//     const contract = new ethers.Contract(marketplaceAddress, marketplaceAbi, window.signer);
//     const lazyNFTContract = new ethers.Contract(lazyNFTAddress, lazyNFTAbi, window.signer);

//     if (!isListed) {
//         // 链上出售
//         const choice = prompt(`请确认 NFT 链上操作：\n1️⃣ 链上出售 (On-chain) - 会产生 Gas 费用\n请输入 1 确认`, "");
//         if (choice !== "1") return alert("操作已取消");

//         const priceInWei = ethers.parseEther(nft.price.toString());

//         // 授权检查
//         const isApproved = await lazyNFTContract.isApprovedForAll(userAddr, marketplaceAddress);
//         if (!isApproved) {
//             const approveTx = await lazyNFTContract.setApprovalForAll(marketplaceAddress, true);
//             await approveTx.wait();
//         }

//         // 上架交易
//         const tx = await contract.listItem(lazyNFTAddress, BigInt(nft.token_id), priceInWei);
//         await tx.wait();

//         nft.is_listed = 1;

//         // 🔄 数据库同步
//         await fetch('/api/nfts/marketplace/update-status', {
//             method: 'POST',
//             headers: {'Content-Type': 'application/json'},
//             body: JSON.stringify({
//                 nft_id,
//                 is_listed: 1,
//                 price: nft.price,
//                 market_level: 2,
//                 is_blockchain: 1
//             })
//         });

//         alert("✅ NFT 链上上架完成，数据库已同步");
//         renderMyNFTs();

//     } else {
//         // 已上架 -> 修改价格或下架
//         const actionChoice = prompt(`NFT 已上架，操作选项：\n1️⃣ 修改价格\n2️⃣ 链上停售 (Off-chain)\n请输入 1 或 2 确认`, "");
//         if (actionChoice === "1") {
//             const newPrice = prompt(`请输入新的上架价格（ETH）：`, nft.price);
//             if (!newPrice || isNaN(newPrice) || Number(newPrice) <= 0) return alert("价格无效");

//             const priceInWei = ethers.parseEther(newPrice);
//             const tx = await contract.updatePrice(lazyNFTAddress, BigInt(nft.token_id), priceInWei);
//             await tx.wait();

//             nft.price = newPrice;

//             // 🔄 数据库同步
//             await fetch('/api/nfts/marketplace/update-status', {
//                 method: 'POST',
//                 headers: {'Content-Type': 'application/json'},
//                 body: JSON.stringify({
//                     nft_id,
//                     price: newPrice
//                 })
//             });

//             alert("✅ NFT 链上价格已更新，数据库已同步");

//         } else if (actionChoice === "2") {
//             const tx = await contract.cancelListing(lazyNFTAddress, BigInt(nft.token_id));
//             await tx.wait();

//             nft.is_listed = 0;

//             // 🔄 数据库同步
//             await fetch('/api/nfts/marketplace/update-status', {
//                 method: 'POST',
//                 headers: {'Content-Type': 'application/json'},
//                 body: JSON.stringify({
//                     nft_id,
//                     is_listed: 0
//                 })
//             });

//             alert("✅ NFT 链上下架完成，数据库已同步");

//         } else {
//             return alert("操作已取消");
//         }

//         renderMyNFTs();
//     }
// }


// --------------------------
// 五、上传 NFT 表单处理
// --------------------------
async function handleLazyMint(e) {
    e.preventDefault();
    userAddr = userAddr || await initWallet();
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
    userAddr = userAddr || await initWallet();
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
// 十一、Marketplace 数据与渲染
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
// 十三、购买 NFT
// --------------------------
async function buyNFT(nft_id) {
    userAddr = userAddr || await initWallet();
    if (!userAddr) return alert("未获取钱包地址");

    try {
        const res = await fetch("/api/nfts/marketplace/buy", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nft_id, buyerAddress: userAddr })
        });
        const data = await res.json();
        if (data.success) alert(`✅ 购买成功！交易 Hash: ${data.txHash}`);
        else alert(`❌ 购买失败: ${data.error}`);
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
    // const addr = getUserAddress();
    // if (!addr) return alert("未获取钱包地址");
     userAddr = userAddr || await initWallet();
    if (!userAddr) return alert("未获取钱包地址");

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
                user_address: userAddr,
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
    // const addr = getUserAddress();
    // if (!addr) return alert("未获取钱包地址");
     userAddr = userAddr || await initWallet();
    if (!userAddr) return alert("未获取钱包地址");

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
                user_address: userAddr,
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
// 页面初始化
// --------------------------
document.addEventListener('DOMContentLoaded', async () => {
    await initMyNFT();
    await initMarket();
});
