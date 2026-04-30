// --- GAS設定 ---
const GAS_ENDPOINT = "https://script.google.com/macros/s/AKfycbxq_JIV-tLFuWyAlQznonBkPS64oGMhqojCrGTrnNwCV9wZL7BjC3nMkLG_0EDVBDJ7CA/exec";
const STORAGE_KEY = "book_pro_cache_v70";
let allBooks = [];

async function init() {
  const statusEl = document.getElementById('sync-status');
  allBooks = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  renderBooks(allBooks);
  
  try {
    const res = await fetch(GAS_ENDPOINT + "?action=getData");
    const data = await res.json();
    if (data && data.length > 0) {
      allBooks = data.slice(1);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(allBooks));
      renderBooks(allBooks);
      // 同期成功時にバッジを緑にする
      statusEl.innerText = "ONLINE ✅";
      statusEl.classList.add('online');
    }
  } catch (e) { 
    statusEl.innerText = "OFFLINE";
    statusEl.classList.remove('online');
  }
}

function renderBooks(books) {
  const list = document.getElementById("book-list");
  list.innerHTML = [...books].reverse().map(b => {
    const g = b[4] || 'その他';
    return `
      <div class="book-card">
        <span class="genre-badge badge-${g}">${g}</span>
        <div style="font-weight:bold; color:#1e293b;">${b[0]}</div>
        <div style="font-size:0.8rem; color:#64748b; margin-top:2px;">${b[1]}</div>
        <div class="card-actions">
          <a href="https://calil.jp/book/${b[6]}" target="_blank" class="card-btn btn-blue">🔍 カーリル</a>
          <div onclick="deleteLocal('${b[6]}','${b[0]}')" class="card-btn btn-red">🗑️ 削除</div>
        </div>
      </div>`;
  }).join('');
}

async function fetchInfo(isbn) {
  const res = await fetch(`https://api.openbd.jp/v1/get?isbn=${isbn}`);
  const data = await res.json();
  if (data && data[0]) {
    const s = data[0].summary;
    document.getElementById("preview").style.display = "block";
    document.getElementById("pre-title").innerText = s.title;
    document.getElementById("pre-author").innerText = s.author;
    document.getElementById("btn-save").onclick = () => saveProcess({ ...s, isbn, genre: document.getElementById("edit-genre").value });
  }
}

async function saveProcess(book) {
  document.getElementById("preview").style.display = "none";
  fetch(GAS_ENDPOINT, { method: "POST", mode: "no-cors", body: JSON.stringify(book) });
  setTimeout(init, 2000);
}

function manualRegister() {
  const i = document.getElementById('manual-isbn').value.replace(/\D/g, "");
  if (i.length === 13) fetchInfo(i);
}

async function deleteLocal(isbn, title) {
  if (!confirm(title + " を削除しますか？")) return;
  fetch(GAS_ENDPOINT, { method: "POST", mode: "no-cors", body: JSON.stringify({ action: "delete", isbn, title }) });
  setTimeout(init, 2000);
}

// カメラ制御
const scanBtn = document.getElementById('scan-toggle');
let html5QrCode = new Html5Qrcode("reader");
let isScanning = false;

scanBtn.onclick = async () => {
  if (!isScanning) {
    document.getElementById('reader').style.display = 'block';
    scanBtn.innerText = "⏹️ スキャン停止";
    await html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, (txt) => {
      const c = txt.replace(/\D/g, "");
      if (c.length === 13) { 
        html5QrCode.stop(); 
        fetchInfo(c); 
        isScanning = false; 
        document.getElementById('reader').style.display = 'none'; 
        scanBtn.innerText = "📷 スキャン開始";
      }
    });
    isScanning = true;
  } else { 
    await html5QrCode.stop(); 
    isScanning = false; 
    document.getElementById('reader').style.display = 'none'; 
    scanBtn.innerText = "📷 スキャン開始";
  }
};

init();