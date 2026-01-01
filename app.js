/****************************************************
 * OFA 点呼アプリ（フロント）
 * - departure.html / arrival.html：送信（POST）
 * - export.html：日報PDF / 月報PDF / CSV / 履歴（GET）
 ****************************************************/

const GAS_WEBAPP_URL = window.OFA_GAS_URL;

const $ = (id)=>document.getElementById(id);

function toast(msg, ok=true){
  window.OFA_AUTH?.toast ? window.OFA_AUTH.toast(msg, ok) : alert(msg);
}

function toYMD(dateObj = new Date()){
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth()+1).padStart(2,"0");
  const d = String(dateObj.getDate()).padStart(2,"0");
  return `${y}-${m}-${d}`;
}
function toHM(dateObj = new Date()){
  const h = String(dateObj.getHours()).padStart(2,"0");
  const m = String(dateObj.getMinutes()).padStart(2,"0");
  return `${h}:${m}`;
}
function safeStr(v){ return (v===undefined||v===null) ? "" : String(v).trim(); }
function numOrBlank(v){
  const s = safeStr(v);
  if(!s) return "";
  const n = Number(s);
  return Number.isFinite(n) ? n : "";
}

function normalizeYMD(input){
  return String(input||"").trim().replace(/\//g,"-");
}

// ✅ 画像圧縮（任意）
async function fileToCompressedDataURL(file, maxW=1280, quality=0.75){
  if(!file) return null;
  if(!file.type || !file.type.startsWith("image/")) return null;

  const { im, url } = await new Promise((resolve, reject)=>{
    const u = URL.createObjectURL(file);
    const img = new Image();
    img.onload = ()=>resolve({ im:img, url:u });
    img.onerror = reject;
    img.src = u;
  });

  const w = im.naturalWidth || im.width;
  const h = im.naturalHeight || im.height;
  const scale = Math.min(1, maxW / w);
  const cw = Math.round(w*scale);
  const ch = Math.round(h*scale);

  const canvas = document.createElement("canvas");
  canvas.width = cw; canvas.height = ch;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(im, 0,0,cw,ch);

  URL.revokeObjectURL(url);
  return canvas.toDataURL("image/jpeg", quality);
}

async function collectFilesAsDataURLs(inputId){
  const el = $(inputId);
  if(!el || !el.files || !el.files.length) return [];
  const files = Array.from(el.files);
  const out = [];
  for(const f of files){
    const du = await fileToCompressedDataURL(f, 1280, 0.75);
    if(du) out.push(du);
  }
  return out;
}

function must(v, name){
  if(!v) throw new Error(`未入力: ${name}`);
}

function requireLoginOrBlock(){
  if(!window.OFA_AUTH?.isLoggedIn?.()){
    toast("ログインしてください", false);
    return false;
  }
  return true;
}

/** ===== 点検項目 ===== */
function collectInspection(){
  const keys = [
    "insp_tire","insp_light","insp_brake","insp_wiper",
    "insp_engineOil","insp_coolant","insp_damage","insp_cargo"
  ];
  const obj = {};
  keys.forEach((id)=>{
    const el = $(id);
    if(el) obj[id] = safeStr(el.value);
  });
  const note = $("insp_note");
  if(note) obj.note = safeStr(note.value);
  return obj;
}

/** ===== 出発/帰着送信 ===== */
async function submitTenko(mode){
  try{
    if(!requireLoginOrBlock()) return;

    const date = normalizeYMD(safeStr($("date")?.value));
    const time = safeStr($("time")?.value);

    const driverName = safeStr($("driverName")?.value);
    const vehicleNo  = safeStr($("vehicleNo")?.value);
    const managerName= safeStr($("managerName")?.value);
    const method     = safeStr($("method")?.value);
    const place      = safeStr($("place")?.value);
    const alcoholValue = safeStr($("alcoholValue")?.value);
    const alcoholBand  = safeStr($("alcoholBand")?.value);
    const memo = safeStr($("memo")?.value);

    const odoStart = numOrBlank($("odoStart")?.value);
    const odoEnd   = numOrBlank($("odoEnd")?.value);
    let odoTotal = "";
    if(odoStart!=="" && odoEnd!=="") odoTotal = Math.max(0, Number(odoEnd)-Number(odoStart));

    const licenseNo = safeStr($("licenseNo")?.value);

    // 日報（帰着のみ）
    const workType = safeStr($("workType")?.value);
    const workArea = safeStr($("workArea")?.value);
    const workHours= safeStr($("workHours")?.value);
    const deliveryCount = safeStr($("deliveryCount")?.value);
    const trouble = safeStr($("trouble")?.value);
    const dailyNote = safeStr($("dailyNote")?.value);

    // 必須
    must(date,"日付");
    must(time,"時刻");
    must(driverName,"運転者氏名");
    must(vehicleNo,"車両番号");
    must(managerName,"点呼実施者");
    must(method,"点呼方法");
    must(alcoholValue,"アルコール測定値");
    must(alcoholBand,"酒気帯び");

    const inspection = collectInspection();

    // 写真（任意）
    const photos = await collectFilesAsDataURLs("tenkoPhotos");
    const reportPhotos = await collectFilesAsDataURLs("reportPhotos");
    const licensePhotos = await collectFilesAsDataURLs("licensePhotos");

    const id_token = localStorage.getItem("ofa_id_token");

    const payload = {
      action: "saveTenko",
      mode, // departure / arrival
      id_token,
      data: {
        date, time,
        driverName, vehicleNo,
        managerName, method, place,
        alcoholValue, alcoholBand,
        memo,
        odoStart, odoEnd, odoTotal,
        licenseNo,
        inspection,

        // arrival(日報)
        workType, workArea, workHours,
        deliveryCount, trouble, dailyNote
      },
      photos,
      reportPhotos,
      licensePhotos
    };

    $("btnSubmit") && ($("btnSubmit").disabled = true);
    toast("送信中…", true);

    const res = await fetch(GAS_WEBAPP_URL, {
      method:"POST",
      headers:{ "Content-Type":"text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });

    const json = await res.json().catch(()=>null);
    if(!json || !json.ok){
      throw new Error(json?.message || "送信失敗");
    }

    toast("送信OK（保存完了）", true);
    setTimeout(()=>{ location.href="index.html"; }, 500);
  }catch(err){
    console.error(err);
    toast(err.message || String(err), false);
    $("btnSubmit") && ($("btnSubmit").disabled = false);
  }
}

/** ===== export 呼び出し ===== */
function buildUrl(action, params){
  const u = new URL(GAS_WEBAPP_URL);
  u.searchParams.set("action", action);
  Object.entries(params||{}).forEach(([k,v])=>{
    if(v!==undefined && v!==null && String(v).trim()!==""){
      u.searchParams.set(k, String(v).trim());
    }
  });
  return u.toString();
}

async function callGet(action, params){
  const url = buildUrl(action, params);
  try{
    const res = await fetch(url, { method:"GET", cache:"no-store" });
    const json = await res.json();
    return { ok:true, json, url };
  }catch(err){
    return { ok:false, err, url };
  }
}

function setResult(url, label){
  const box = $("resultBox");
  if(!box) return;
  box.style.display = "block";
  box.innerHTML = `
    <div class="resultTitle">${label}</div>
    <div>リンク：<a href="${url}" target="_blank" rel="noopener">${url}</a></div>
    <div class="resultActions">
      <button class="btn small rainbow" onclick="window.open('${url}','_blank')">開く</button>
      <button class="btn small" onclick="navigator.clipboard.writeText('${url}');toast('コピーしました');">コピー</button>
    </div>
  `;
}

async function createDailyPdf(date, name, adminKey){
  if(!requireLoginOrBlock()) return;
  if(!date){ toast("日付を入れてください", false); return; }

  toast("日報PDFを作成中…", true);
  const id_token = localStorage.getItem("ofa_id_token");
  const r = await callGet("dailyPdf", { date, name, adminKey, id_token });

  if(r.ok && r.json?.ok && r.json?.url){
    toast("作成しました", true);
    setResult(r.json.url, `日報PDF（${date}${name? " / "+name:""}）`);
    window.open(r.json.url, "_blank");
    return;
  }
  toast("取得に失敗。別タブで確認します", false);
  window.open(r.url, "_blank");
}

async function createMonthlyPdf(month, name, adminKey){
  if(!requireLoginOrBlock()) return;
  if(!month){ toast("月（YYYY-MM）を入れてください", false); return; }

  toast("月報PDFを作成中…", true);
  const id_token = localStorage.getItem("ofa_id_token");
  const r = await callGet("monthlyPdf", { month, name, adminKey, id_token });

  if(r.ok && r.json?.ok && r.json?.url){
    toast("作成しました", true);
    setResult(r.json.url, `月報PDF（${month}${name? " / "+name:""}）`);
    window.open(r.json.url, "_blank");
    return;
  }
  toast("取得に失敗。別タブで確認します", false);
  window.open(r.url, "_blank");
}

async function createMonthlyCsv(month, name, adminKey){
  if(!requireLoginOrBlock()) return;
  if(!month){ toast("月（YYYY-MM）を入れてください", false); return; }

  toast("月次CSVを作成中…", true);
  const id_token = localStorage.getItem("ofa_id_token");
  const r = await callGet("monthlyCsv", { month, name, adminKey, id_token });

  if(r.ok && r.json?.ok && r.json?.url){
    toast("作成しました", true);
    setResult(r.json.url, `月次CSV（${month}${name? " / "+name:""}）`);
    window.open(r.json.url, "_blank");
    return;
  }
  toast("取得に失敗。別タブで確認します", false);
  window.open(r.url, "_blank");
}

async function createCsvRange(from, to, name, adminKey){
  if(!requireLoginOrBlock()) return;
  if(!from || !to){ toast("開始日・終了日を入れてください", false); return; }
  if(from > to){ toast("開始日が終了日より後です", false); return; }

  toast("範囲CSVを作成中…", true);
  const id_token = localStorage.getItem("ofa_id_token");
  const r = await callGet("csvRange", { from, to, name, adminKey, id_token });

  if(r.ok && r.json?.ok && r.json?.url){
    toast("作成しました", true);
    setResult(r.json.url, `範囲CSV（${from}〜${to}${name? " / "+name:""}）`);
    window.open(r.json.url, "_blank");
    return;
  }
  toast("取得に失敗。別タブで確認します", false);
  window.open(r.url, "_blank");
}

async function loadHistory(month, name, adminKey){
  if(!requireLoginOrBlock()) return;
  if(!month){ toast("履歴の月（YYYY-MM）を入れてください", false); return; }

  toast("履歴を取得中…", true);
  const id_token = localStorage.getItem("ofa_id_token");
  const r = await callGet("historyDays", { month, name, adminKey, id_token });

  if(r.ok && r.json?.ok && Array.isArray(r.json.days)){
    const days = r.json.days;

    $("historyBox").style.display = "block";
    $("historyCount").textContent = `${days.length}件`;

    const list = $("historyList");
    list.innerHTML = "";

    if(days.length === 0){
      list.innerHTML = `<div style="color:rgba(17,24,39,.65);font-size:12px;padding:6px 2px;">データなし</div>`;
    }else{
      days.slice().reverse().forEach(d=>{
        const div = document.createElement("div");
        div.className = "item";
        div.innerHTML = `
          <div>
            <div class="d">${d}</div>
            <div class="meta">${name ? ("運転者: "+escapeHtml(name)) : "全員"} / 日報PDF</div>
          </div>
          <div class="right">
            <button class="btn small rainbow">日報PDF</button>
            <button class="btn small">リンク</button>
          </div>
        `;
        const btnPdf = div.querySelectorAll("button")[0];
        const btnLink= div.querySelectorAll("button")[1];

        btnPdf.addEventListener("click", ()=>createDailyPdf(d, name, adminKey));
        btnLink.addEventListener("click", ()=>{
          const u = buildUrl("dailyPdf", { date:d, name, adminKey, id_token });
          navigator.clipboard.writeText(u);
          toast("APIリンクをコピーしました", true);
        });

        list.appendChild(div);
      });
    }

    toast("履歴を表示しました", true);
    return;
  }

  toast("取得に失敗。別タブで確認します", false);
  window.open(r.url, "_blank");
}

function escapeHtml(s){
  return String(s??"")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#39;");
}

/** ===== 管理者モーダル ===== */
function openAdminModal(){
  $("adminModalBg").style.display = "flex";
  $("adminKey").value = "";
  $("adminKey").focus();
}
function closeAdminModal(){
  $("adminModalBg").style.display = "none";
}
function getAdminKey(){
  return safeStr($("adminKeyHold")?.value);
}
function setAdminKey(v){
  const el = $("adminKeyHold");
  if(el) el.value = v || "";
}

function initAdminUi(){
  const role = window.OFA_AUTH?.getRole?.() || "driver";
  $("roleBadge").textContent = (role==="admin" ? "管理者" : "ドライバー");

  $("btnAdminKey")?.addEventListener("click", ()=>{
    openAdminModal();
  });
  $("btnAdminCancel")?.addEventListener("click", closeAdminModal);
  $("adminModalBg")?.addEventListener("click", (e)=>{
    if(e.target?.id==="adminModalBg") closeAdminModal();
  });
  $("btnAdminOk")?.addEventListener("click", ()=>{
    const k = safeStr($("adminKey").value);
    setAdminKey(k);
    closeAdminModal();
    toast(k ? "管理者キーをセットしました" : "管理者キーをクリアしました", true);
  });
}

/** ===== ページ別 init ===== */
function initIndex(){
  $("goDeparture")?.addEventListener("click", ()=>location.href="departure.html");
  $("goArrival")?.addEventListener("click", ()=>location.href="arrival.html");
  $("goExport")?.addEventListener("click", ()=>location.href="export.html");
}

function initTenkoCommon(){
  if($("date") && !$("date").value) $("date").value = toYMD();
  if($("time") && !$("time").value) $("time").value = toHM();

  const calc = ()=>{
    const s = numOrBlank($("odoStart")?.value);
    const e = numOrBlank($("odoEnd")?.value);
    if($("odoTotal")){
      if(s!=="" && e!=="") $("odoTotal").value = Math.max(0, Number(e)-Number(s));
      else $("odoTotal").value = "";
    }
  };
  $("odoStart")?.addEventListener("input", calc);
  $("odoEnd")?.addEventListener("input", calc);

  $("backBtn")?.addEventListener("click", ()=>history.length>1 ? history.back() : location.href="index.html");
}

function initDeparture(){
  initTenkoCommon();
  $("btnSubmit")?.addEventListener("click", ()=>submitTenko("departure"));
}

function initArrival(){
  initTenkoCommon();
  $("btnSubmit")?.addEventListener("click", ()=>submitTenko("arrival"));
}

function initExport(){
  // init values
  const d = new Date();
  const month = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;

  $("dateDaily").value = toYMD();
  $("month").value = month;
  $("historyMonth").value = month;

  $("gasUrlView").textContent = GAS_WEBAPP_URL;

  // actions
  $("backBtn")?.addEventListener("click", ()=>history.length>1 ? history.back() : location.href="index.html");

  $("btnDailyPdf")?.addEventListener("click", ()=>{
    createDailyPdf($("dateDaily").value, $("name").value, getAdminKey());
  });
  $("btnMonthlyPdf")?.addEventListener("click", ()=>{
    createMonthlyPdf($("month").value, $("name").value, getAdminKey());
  });
  $("btnMonthlyCsv")?.addEventListener("click", ()=>{
    createMonthlyCsv($("month").value, $("name").value, getAdminKey());
  });
  $("btnCsvRange")?.addEventListener("click", ()=>{
    createCsvRange($("fromDate").value, $("toDate").value, $("name").value, getAdminKey());
  });
  $("btnLoadHistory")?.addEventListener("click", ()=>{
    loadHistory($("historyMonth").value, $("name").value, getAdminKey());
  });

  initAdminUi();
}

window.addEventListener("DOMContentLoaded", ()=>{
  const page = document.body?.dataset?.page || "";
  if(page==="index") initIndex();
  if(page==="departure") initDeparture();
  if(page==="arrival") initArrival();
  if(page==="export") initExport();
});
