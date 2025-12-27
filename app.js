// ====================
// GitHub Pages -> GAS WebApp
// ====================

// ★ここだけあなたの最新URLに固定（貼り替え済み）
const API_URL = "https://script.google.com/macros/s/AKfycbzoEn9NU_ejtAwjwYz4K5ahrVo5Usl_4KH22BvUV8-YFgsxAa8BAMOBZ3U2IudVSHsyvw/exec";

const el = (id) => document.getElementById(id);

let mode = "start"; // start / end

function setMode(nextMode){
  mode = nextMode;

  el("tabStart").classList.toggle("active", mode==="start");
  el("tabEnd").classList.toggle("active", mode==="end");

  el("modeBtn").textContent = mode==="start" ? "出発点呼モード" : "帰着点呼モード";

  el("meterStartWrap").classList.toggle("hidden", mode==="end");
  el("meterEndWrap").classList.toggle("hidden", mode==="start");
  el("endAlcoholWrap").classList.toggle("hidden", mode==="start");

  // 帰着は meterEnd を必須に
  el("meterEnd").required = (mode==="end");
}

async function toDataUrl(file){
  if(!file) return "";
  return await new Promise((resolve, reject)=>{
    const reader = new FileReader();
    reader.onload = ()=> resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function toastOk(msg){
  const t = el("toast");
  t.className = "toast ok";
  t.textContent = "✅ " + msg;
}
function toastBad(msg){
  const t = el("toast");
  t.className = "toast bad";
  t.textContent = "❌ " + msg;
}

async function ping(){
  el("pingStatus").className = "status bad";
  el("pingStatus").textContent = "確認中…";
  el("pingMsg").textContent = "";

  try{
    const res = await fetch(API_URL + "?ping=1", { method:"GET" });
    const json = await res.json();
    if(json && json.ok){
      el("pingStatus").className = "status ok";
      el("pingStatus").textContent = "接続OK（到達）";
      el("pingMsg").textContent = "接続できました。送信テストOKです。";
    }else{
      el("pingStatus").className = "status bad";
      el("pingStatus").textContent = "接続NG";
      el("pingMsg").textContent = "URL/デプロイ設定を確認";
    }
  }catch(e){
    el("pingStatus").className = "status bad";
    el("pingStatus").textContent = "接続NG";
    el("pingMsg").textContent = "通信に失敗しました（URL/デプロイ設定を確認）";
  }
}

async function requestPdfDaily(){
  const d = el("dailyDate").value;
  if(!d) return toastBad("日付を選んでください");
  try{
    const res = await fetch(`${API_URL}?report=daily&date=${encodeURIComponent(d)}`);
    const json = await res.json();
    if(json.ok && json.pdfUrl){
      el("pdfLink").innerHTML = `📄 日報PDF：<a href="${json.pdfUrl}" target="_blank" rel="noopener">開く</a>`;
      toastOk("日報PDFを作成しました");
    }else{
      toastBad(json.error || "PDF作成に失敗");
    }
  }catch(e){
    toastBad("PDF作成で通信エラー");
  }
}

async function requestPdfMonthly(){
  const m = el("monthlyMonth").value;
  if(!m) return toastBad("月を選んでください");
  try{
    const res = await fetch(`${API_URL}?report=monthly&month=${encodeURIComponent(m)}`);
    const json = await res.json();
    if(json.ok && json.pdfUrl){
      el("pdfLink").innerHTML = `📄 月報PDF：<a href="${json.pdfUrl}" target="_blank" rel="noopener">開く</a>`;
      toastOk("月報PDFを作成しました");
    }else{
      toastBad(json.error || "PDF作成に失敗");
    }
  }catch(e){
    toastBad("PDF作成で通信エラー");
  }
}

async function submitForm(ev){
  ev.preventDefault();
  el("submitBtn").disabled = true;

  try{
    const payload = {
      type: mode==="start" ? "出発" : "帰着",
      driver: el("driver").value.trim(),
      vehicle: el("vehicle").value.trim(),
      alcohol: el("alcohol").value,
      condition: el("condition").value,
      temp: el("temp").value.trim(),
      sleep: el("sleep").value.trim(),
      inspection: el("inspection").value,
      inspectionDetail: el("inspectionDetail").value.trim(),
      meterStart: mode==="start" ? el("meterStart").value.trim() : "",
      meterEnd: mode==="end" ? el("meterEnd").value.trim() : "",
      memo: el("memo").value.trim(),
      inspectionPhotoDataUrl: await toDataUrl(el("inspectionPhoto").files[0]),
      startAlcoholPhotoDataUrl: await toDataUrl(el("startAlcoholPhoto").files[0]),
      endAlcoholPhotoDataUrl: mode==="end" ? await toDataUrl(el("endAlcoholPhoto").files[0]) : ""
    };

    // 必須チェック（最低限）
    if(!payload.driver || !payload.vehicle){
      toastBad("氏名・車両番号は必須です");
      el("submitBtn").disabled = false;
      return;
    }
    if(mode==="end" && !payload.meterEnd){
      toastBad("帰着点呼は帰着メーターが必須です");
      el("submitBtn").disabled = false;
      return;
    }

    const res = await fetch(API_URL, {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify(payload)
    });

    const json = await res.json();
    if(json && json.ok){
      toastOk("送信しました");
      // 送信後、入力は残す（現場で便利）
    }else{
      toastBad(json.error || "送信に失敗しました（GASの権限/デプロイ/URLを確認）");
    }

  }catch(e){
    toastBad("送信に失敗しました（通信/画像変換エラー）");
  }finally{
    el("submitBtn").disabled = false;
  }
}

// init
function init(){
  el("apiUrl").textContent = API_URL;

  el("pingBtn").addEventListener("click", ping);

  el("tabStart").addEventListener("click", ()=>setMode("start"));
  el("tabEnd").addEventListener("click", ()=>setMode("end"));

  el("modeBtn").addEventListener("click", ()=>{
    setMode(mode==="start" ? "end" : "start");
  });

  el("dailyPdfBtn").addEventListener("click", requestPdfDaily);
  el("monthlyPdfBtn").addEventListener("click", requestPdfMonthly);

  el("form").addEventListener("submit", submitForm);

  // 初期値（今日）
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth()+1).padStart(2,"0");
  const dd = String(now.getDate()).padStart(2,"0");
  el("dailyDate").value = `${yyyy}-${mm}-${dd}`;
  el("monthlyMonth").value = `${yyyy}-${mm}`;

  setMode("start");
}
init();
