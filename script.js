// --- 設定 ---
const GAS_ENDPOINT = "https://script.google.com/macros/s/AKfycbxq_JIV-tLFuWyAlQznonBkPS64oGMhqojCrGTrnNwCV9wZL7BjC3nMkLG_0EDVBDJ7CA/exec";
const STORAGE_KEY = "book_pro_cache_v80";
let allBooks = []; 

/**
 * 1. 初期化
 */
async function init() {
  const statusEl = document.getElementById('sync-status');
  const cache = localStorage.getItem(STORAGE_KEY);
  allBooks = cache ? JSON.parse(cache) : [];
  
  applyFilters(); // 初回描画[cite: 7]
  
  try {
    const res = await fetch(GAS_ENDPOINT);
    const data = await res.json();
    if (Array.isArray(data)) {
      allBooks = data.slice(1); // ヘッダー除外[cite: 7]
      localStorage.setItem(STORAGE_KEY, JSON.stringify(allBooks));
      applyFilters();
      statusEl.innerText = "ONLINE ✅";
      statusEl.classList.add("online");
    }
  } catch (e) { 
    statusEl.innerText = "OFFLINE ⚠️";
    statusEl.classList.remove("online");
  }
}

/**
 * 2. フィルタリング処理
 */
function applyFilters() {
  const genreVal = document.getElementById('filter-genre').value;
  const userVal = document.getElementById('filter-user').value;

  const filtered = allBooks.filter(b => {
    const matchGenre = (genreVal === "All") || (b[4] === genreVal); // E列:ジャンル[cite: 4]
    const matchUser = (userVal === "All") || (b[7] === userVal);  // H列:登録者[cite: 4]
    return matchGenre && matchUser;
  });

  renderBooks(filtered);
}

/**
 * 3. 一覧の描画
 */
function renderBooks(booksToRender) {
  const list = document.getElementById("book-list");
  if (!list) return;

  if (booksToRender.length === 0) {
    list.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 30px; color: #64748b;">該当する本がありません</div>`;
    return;
  }

  list.innerHTML = [...booksToRender].reverse().map(b => {
    const g = b[4] || 'その他';
    const u = b[7] || 'All';
    
    return `
      <div class="book-card">
        <div class="badge-container">
          <span class="genre-badge badge-${g}">${g}</span>
          <span class="user-badge badge-${u}">${u}</span>
        </div>
        <div style="font-weight:bold; color:#1e293b; font-size:0.95rem;">${b[0]}</div>
        <div style="font-size:0.8rem; color:#64748b; margin-top:2px;">${b[1]}</div>
        <div style="font-size:0.75rem; color:#94a3b8; margin-top:1px;">${b[2] || ''}</div>
        
        <div class="card-actions">
          <a href="https://calil.jp/book/${b[6]}" target="_blank" class="card-btn btn-blue">🔍 検索</a>
          <div onclick="openEdit('${b[6]}','${b[0]}','${g}','${u}')" class="card-btn btn-green">🔧 編集</div>
          <div onclick="deleteLocal('${b[6]}','${b[0]}')" class="card-btn btn-red">🗑️ 削除</div>
        </div>
      </div>`;
  }).join('');
}

/**
 * 4. 編集モード開始
 */
function openEdit(isbn, title, g, u) {
  const preview = document.getElementById("preview");
  preview.style.display = "block";
  preview.scrollIntoView({ behavior: 'smooth' });

  document.getElementById("pre-title").innerText = "編集: " + title;
  document.getElementById("pre-author").innerText = "ISBN: " + isbn;
  document.getElementById("edit-genre").value = g;
  document.getElementById("edit-user").value = u;

  document.getElementById("btn-save").onclick = () => updateProcess(isbn);
}

/**
 * 5. 更新・保存・削除処理
 */
async function updateProcess(isbn) {
  const data = {
    action: "update",
    isbn: isbn,
    genre: document.getElementById("edit-genre").value,
    userName: document.getElementById("edit-user").value
  };
  document.getElementById("preview").style.display = "none";
  document.getElementById('sync-status').innerText = "UPDATING...";
  await fetch(GAS_ENDPOINT, { method: "POST", mode: "no-cors", body: JSON.stringify(data) });
  setTimeout(init, 2000);
}

async function fetchInfo(isbn) {
  const res = await fetch(`https://api.openbd.jp/v1/get?isbn=${isbn}`);
  const data = await res.json();
  if (data && data[0]) {
    const s = data[0].summary;
    document.getElementById("preview").style.display = "block";
    document.getElementById("pre-title").innerText = s.title;
    document.getElementById("pre-author").innerText = s.author;
    document.getElementById("pre-publisher").innerText = s.publisher || "";
    document.getElementById("btn-save").onclick = () => saveProcess({ 
      ...s, isbn, 
      genre: document.getElementById("edit-genre").value,
      userName: document.getElementById("edit-user").value 
    });
  }
}

async function saveProcess(book) {
  document.getElementById("preview").style.display = "none";
  await fetch(GAS_ENDPOINT, { method: "POST", mode: "no-cors", body: JSON.stringify(book) });
  setTimeout(init, 2000);
}

async function deleteLocal(isbn, title) {
  if (!confirm(title + " を削除しますか？")) return;
  fetch(GAS_ENDPOINT, { method: "POST", mode: "no-cors", body: JSON.stringify({ action: "delete", isbn }) });
  setTimeout(init, 2000);
}

function manualRegister() {
  const val = document.getElementById('manual-isbn').value.replace(/\D/g, "");
  if (val.length === 13) fetchInfo(val);
  else alert("ISBNを入力してください。");
}

// カメラ制御
const scanBtn = document.getElementById('scan-toggle');
let html5QrCode = new Html5Qrcode("reader");
let isScanning = false;
scanBtn.onclick = async () => {
  if (!isScanning) {
    document.getElementById('reader').style.display = 'block';
    scanBtn.innerText = "⏹️ 停止";
    await html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, (txt) => {
      const c = txt.replace(/\D/g, "");
      if (c.length === 13) { html5QrCode.stop(); fetchInfo(c); isScanning = false; document.getElementById('reader').style.display = 'none'; scanBtn.innerText = "📷 開始"; }
    });
    isScanning = true;
  } else { await html5QrCode.stop(); isScanning = false; document.getElementById('reader').style.display = 'none'; scanBtn.innerText = "📷 開始"; }
};

init();