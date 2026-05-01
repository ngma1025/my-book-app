// --- 設定 ---
const GAS_ENDPOINT = "https://script.google.com/macros/s/AKfycbxq_JIV-tLFuWyAlQznonBkPS64oGMhqojCrGTrnNwCV9wZL7BjC3nMkLG_0EDVBDJ7CA/exec";
const STORAGE_KEY = "book_pro_cache_v80";
let allBooks = []; // 全データを保持

/**
 * 1. 初期化開始
 */
async function init() {
  console.log("1. 初期化開始");
  const statusEl = document.getElementById('sync-status');
  
  // キャッシュの読み込み
  const cache = localStorage.getItem(STORAGE_KEY);
  allBooks = cache ? JSON.parse(cache) : [];
  console.log("2. キャッシュ読み込み完了:", allBooks.length, "件");
  
  // 初期表示（フィルター適用）
  applyFilters();
  
  try {
    console.log("3. GASへ接続試行:", GAS_ENDPOINT);
    const res = await fetch(GAS_ENDPOINT);
    const data = await res.json();
    console.log("4. レスポンス受信");
    
    if (Array.isArray(data)) {
      // 1行目のヘッダーを除外して保存
      allBooks = data.slice(1); 
      localStorage.setItem(STORAGE_KEY, JSON.stringify(allBooks));
      
      // 同期後の再描画
      applyFilters();
      
      statusEl.innerText = "ONLINE ✅";
      statusEl.classList.add("online");
      console.log("5. 同期・描画完了");
    }
  } catch (e) { 
    console.error("致命的なエラー場所:", e);
    statusEl.innerText = "OFFLINE ⚠️";
    statusEl.classList.remove("online");
  }
}

/**
 * 2. フィルターを適用して描画
 * HTML側のプルダウンの onchange で呼び出されます
 */
function applyFilters() {
  const genreVal = document.getElementById('filter-genre').value;
  const userVal = document.getElementById('filter-user').value;

  // 全データから条件に合うものを抽出
  const filtered = allBooks.filter(b => {
    // E列(index 4)がジャンル[cite: 4]
    const matchGenre = (genreVal === "All") || (b[4] === genreVal);
    // H列(index 7)が登録者[cite: 4]
    const matchUser = (userVal === "All") || (b[7] === userVal);
    
    return matchGenre && matchUser;
  });

  renderBooks(filtered);
}

/**
 * 3. 登録済み一覧の描画
 */
function renderBooks(booksToRender) {
  const list = document.getElementById("book-list");
  if (!list) return;

  if (booksToRender.length === 0) {
    list.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 30px; color: #64748b;">該当する本がありません</div>`;
    return;
  }

  // 最新の登録が上に来るように reverse して描画[cite: 2]
  list.innerHTML = [...booksToRender].reverse().map(b => {
    const g = b[4] || 'その他'; // ジャンル
    const u = b[7] || 'All';    // 登録者
    
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
          <a href="https://calil.jp/book/${b[6]}" target="_blank" class="card-btn btn-blue">🔍 蔵書検索</a>
          <div onclick="deleteLocal('${b[6]}','${b[0]}')" class="card-btn btn-red">🗑️ 削除</div>
        </div>
      </div>`;
  }).join('');
}

/**
 * 4. 本情報の取得 (OpenBD API)
 */
async function fetchInfo(isbn) {
  const res = await fetch(`https://api.openbd.jp/v1/get?isbn=${isbn}`);
  const data = await res.json();
  if (data && data[0]) {
    const s = data[0].summary;
    document.getElementById("preview").style.display = "block";
    document.getElementById("pre-title").innerText = s.title;
    document.getElementById("pre-author").innerText = s.author;
    document.getElementById("pre-publisher").innerText = s.publisher || "";
    
    // 保存ボタンにイベントを付与
    document.getElementById("btn-save").onclick = () => saveProcess({ 
      ...s, 
      isbn, 
      genre: document.getElementById("edit-genre").value,
      userName: document.getElementById("edit-user").value 
    });
  }
}

/**
 * 5. 保存処理
 */
async function saveProcess(book) {
  document.getElementById("preview").style.display = "none";
  document.getElementById('sync-status').innerText = "SAVING...";
  
  await fetch(GAS_ENDPOINT, { 
    method: "POST", 
    mode: "no-cors", 
    body: JSON.stringify(book) 
  });
  
  // 登録完了後に再読み込み[cite: 2]
  setTimeout(init, 2000);
}

/**
 * 6. 手動登録・削除
 */
function manualRegister() {
  const val = document.getElementById('manual-isbn').value.replace(/\D/g, "");
  if (val.length === 13) fetchInfo(val);
  else alert("13桁のISBNを入力してください。");
}

async function deleteLocal(isbn, title) {
  if (!confirm(title + " を削除しますか？")) return;
  fetch(GAS_ENDPOINT, { 
    method: "POST", 
    mode: "no-cors", 
    body: JSON.stringify({ action: "delete", isbn }) 
  });
  setTimeout(init, 2000);
}

// --- カメラ制御 ---
const scanBtn = document.getElementById('scan-toggle');
let html5QrCode = new Html5Qrcode("reader");
let isScanning = false;

scanBtn.onclick = async () => {
  if (!isScanning) {
    document.getElementById('reader').style.display = 'block';
    scanBtn.innerText = "⏹️ 停止";
    await html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, (txt) => {
      const c = txt.replace(/\D/g, "");
      if (c.length === 13) { 
        html5QrCode.stop(); 
        fetchInfo(c); 
        isScanning = false; 
        document.getElementById('reader').style.display = 'none'; 
        scanBtn.innerText = "📷 開始";
      }
    });
    isScanning = true;
  } else { 
    await html5QrCode.stop(); 
    isScanning = false; 
    document.getElementById('reader').style.display = 'none'; 
    scanBtn.innerText = "📷 開始";
  }
};

// 実行
init();