/****************************************************
 * OFA 点呼システム app.js（確実に動く版）
 ****************************************************/

// ★ここに「最新のGAS WebApp exec URL」を貼る（超重要）
const GAS_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbyJWQuBbTPCEyBKGpWEPs7p5olc1-ZIHK-O6rOqYJHwehw28AEt8VYoTfWoGCfi5XSduQ/exec";

const APP_KEY = "OFA_TENKO";

function $(id){ return document.getElementById(id); }

function toast(msg, ok=false){
  const el = $("toast");
  if(!el){ alert(msg); return; }
  el.textContent = msg;
  el.className = "toast " + (ok ? "ok":"ng");
  el.style.display = "block";
  setTimeout(()=> el.style.display="none", 2400);
}

function toYMD(d=new Date()){
  const y=d.getFullYear();
  const m=String(d.getMonth()+1).padStart(2,"0");
  const da=String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${da}`;
}
function toHM(d=new Date()){
  const h=String(d.getHours()).padStart(2,"0");
  const m=String(d.getMinutes()).padStart(2,"0");
  return `${h}:${m}`;
}

function normalizeYMD(input){
  return String(input||"").trim().replace(/\//g,"-");
}

function safeStr(v){ return (v===undefined||v===null) ? "" : String(v).trim(); }
function numOrBlank(v){
  const s=safeStr(v);
  if(!s) return "";
  const n=Number(s);
  return Number.isFinite(n) ? n : "";
}

function markError(el, on){
  if(!el) return;
  el.classList.toggle("is-error", !!on);
}

function requiredCheck(pairs){
  // pairs: [{el, name}]
  let ok=true;
  pairs.forEach(({el,name})=>{
    const v = safeStr(el?.value);
    const bad = !v;
    markError(el, bad);
    if(bad && ok){
      toast(`未入力: ${name}`, false);
      ok=false;
    }
  });
  return ok;
}

/** 画像を圧縮してDataURL（送信失敗を減らす） */
async function fileToCompressedDataURL(file, maxW=1280, quality=0.75){
  if(!file) return null;
  if(!file.type || !file.type.startsWith("image/")) return null;

  const {im, url} = await new Promise((resolve, reject)=>{
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload=()=>resolve({im,url});
    im.onerror=reject;
    im.src=url;
  });

  const w = im.naturalWidth || im.width;
  const h = im.naturalHeight || im.height;
  const scale = Math.min(1, maxW / w);
  const cw = Math.round(w * scale);
  const ch = Math.round(h * scale);

  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(im, 0, 0, cw, ch);

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

function collectInspection(){
  const keys = [
    "insp_tire","insp_light","insp_brake",
    "insp_wiper","insp_engineOil","insp_coolant",
    "insp_battery","insp_horn","insp_mirror",
    "insp_damage","insp_cargo","insp_extinguisher",
    "insp_triangle"
  ];
  const obj = {};
  keys.forEach(id=>{
    const el=$(id);
    if(el) obj[id]=safeStr(el.value);
  });
  const note=$("insp_note");
  if(note) obj.note=safeStr(note.value);
  return obj;
}

function setLoginState(){
  const a = (typeof requireAuth === "function") ? requireAuth(true) : null;
  const st = $("loginState");
  const badge = $("badgeMode");
  if(st && a){
    st.textContent = a.role==="admin"
      ? "管理者モード（全件）"
      : `ドライバー：${a.name}`;
  }
  if(badge && a){
    badge.textContent = (a.role==="admin") ? "管理者" : "ドライバー";
  }
  return a;
}

/** timeout付きfetch */
async function fetchWithTimeout(url, opts={}, ms=20000){
  const ac = new AbortController();
  const t = setTimeout(()=>ac.abort(), ms);
  try{
    const res = await fetch(url, { ...opts, signal: ac.signal, cache:"no-store" });
    return res;
  } finally{
    clearTimeout(t);
  }
}

/** ========== 送信（doPost） ========== */
async function submitTenko(mode){
  const a = requireAuth(true);
  if(!a) return;

  try{
    if(mode!=="departure" && mode!=="arrival"){
      toast("invalid mode"); return;
    }

    const btn = $("btnSubmit");
    if(btn) btn.disabled = true;

    // 必須項目
    const date = normalizeYMD(safeStr($("date")?.value)) || toYMD();
    const time = safeStr($("time")?.value) || toHM();
    const driverName = safeStr($("driverName")?.value);
    const driverPhone = safeStr($("driverPhone")?.value);
    const sleepHours = safeStr($("sleepHours")?.value);
    const condition = safeStr($("condition")?.value);

    const vehicleNo = safeStr($("vehicleNo")?.value);
    const managerName = safeStr($("managerName")?.value);
    const method = safeStr($("method")?.value);
    const place = safeStr($("place")?.value);
    const alcoholValue = safeStr($("alcoholValue")?.value);
    const alcoholBand = safeStr($("alcoholBand")?.value);
    const memo = safeStr($("memo")?.value);

    // 車両点検（必須）
    const inspection = collectInspection();

    // 走行距離
    const odoStart = numOrBlank($("odoStart")?.value);
    const odoEnd = numOrBlank($("odoEnd")?.value);
    let odoTotal = "";
    if(odoStart!=="" && odoEnd!=="") odoTotal = Math.max(0, Number(odoEnd)-Number(odoStart));

    // 免許
    const licenseNo = safeStr($("licenseNo")?.value);

    // arrival only（日報）
    const workType = safeStr($("workType")?.value);
    const workArea = safeStr($("workArea")?.value);
    const workHours = safeStr($("workHours")?.value);
    const deliveryCount = safeStr($("deliveryCount")?.value);
    const trouble = safeStr($("trouble")?.value);
    const dailyNote = safeStr($("dailyNote")?.value);

    // 必須赤枠チェック
    const musts = [
      {el:$("date"), name:"日付"},
      {el:$("time"), name:"時刻"},
      {el:$("driverName"), name:"運転者氏名（本名）"},
      {el:$("sleepHours"), name:"睡眠時間"},
      {el:$("condition"), name:"体調"},
      {el:$("vehicleNo"), name:"車両番号"},
      {el:$("managerName"), name:"点呼実施者"},
      {el:$("method"), name:"点呼方法"},
      {el:$("place"), name:"点呼場所"},
      {el:$("alcoholValue"), name:"アルコール測定値"},
      {el:$("alcoholBand"), name:"酒気帯び"},
      {el:$("insp_tire"), name:"点検 タイヤ"},
      {el:$("insp_light"), name:"点検 灯火"},
      {el:$("insp_brake"), name:"点検 ブレーキ"},
      {el:$("insp_wiper"), name:"点検 ワイパー"},
      {el:$("insp_engineOil"), name:"点検 エンジンオイル"},
      {el:$("insp_coolant"), name:"点検 冷却水"},
      {el:$("insp_battery"), name:"点検 バッテリー"},
      {el:$("insp_horn"), name:"点検 ホーン"},
      {el:$("insp_mirror"), name:"点検 ミラー"},
      {el:$("insp_damage"), name:"点検 外装/破損"},
      {el:$("insp_cargo"), name:"点検 積載状態"},
      {el:$("insp_extinguisher"), name:"点検 消火器"},
      {el:$("insp_triangle"), name:"点検 三角停止板"},
    ];

    // arrivalは日報必須を追加
    if(mode==="arrival"){
      musts.push({el:$("workType"), name:"業務内容"});
      musts.push({el:$("workArea"), name:"配送エリア"});
      musts.push({el:$("workHours"), name:"稼働時間"});
    }

    if(!requiredCheck(musts)){
      if(btn) btn.disabled = false;
      return;
    }

    // ★driverはログイン名を優先して固定（改ざん防止）
    const fixedDriverName = (a.role==="driver") ? a.name : driverName;

    // 写真（任意）
    toast("送信準備…", true);
    const photos = await collectFilesAsDataURLs("tenkoPhotos");
    const reportPhotos = await collectFilesAsDataURLs("reportPhotos");
    const licensePhotos = await collectFilesAsDataURLs("licensePhotos");
    const abnormalPhotos = await collectFilesAsDataURLs("abnormalPhotos");

    const payload = {
      app: APP_KEY,
      mode,
      auth: { role: a.role, name: fixedDriverName, pass: a.pass },
      data:{
        date, time,
        driverName: fixedDriverName,
        driverPhone,
        sleepHours,
        condition,
        vehicleNo,
        managerName,
        method,
        place,
        alcoholValue,
        alcoholBand,
        memo,
        odoStart, odoEnd, odoTotal,
        licenseNo,
        inspection,
        workType, workArea, workHours, deliveryCount, trouble, dailyNote
      },
      photos,
      reportPhotos,
      licensePhotos,
      abnormalPhotos
    };

    toast("送信中…", true);

    const res = await fetchWithTimeout(GAS_WEBAPP_URL, {
      method:"POST",
      headers:{ "Content-Type":"text/plain;charset=utf-8" }, // ★プリフライト回避
      body: JSON.stringify(payload)
    }, 30000);

    const json = await res.json().catch(()=>null);
    if(!json || !json.ok){
      throw new Error(json?.message || "送信失敗（GAS 응答なし）");
    }

    toast("送信OK（保存完了）", true);

    setTimeout(()=>{ location.href="./index.html"; }, 700);

  }catch(err){
    toast(err?.message || String(err), false);
    const btn = $("btnSubmit");
    if(btn) btn.disabled = false;
  }
}

/** ========== export API（doGet） ========== */
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

async function callApi(action, params){
  const url = buildUrl(action, params);
  const res = await fetchWithTimeout(url, { method:"GET" }, 30000);
  const json = await res.json().catch(()=>null);
  return { url, json };
}

function setResult(url, label){
  const box = $("resultBox");
  if(!box) return;
  box.style.display="block";
  box.innerHTML = `
    <div style="font-weight:900;color:#0b1020;margin-bottom:6px;">${label}</div>
    <div style="margin-bottom:10px;">リンク：<a href="${url}" target="_blank" rel="noopener">${url}</a></div>
    <button class="btn rainbow" type="button" onclick="window.open('${url}','_blank')">開く</button>
  `;
}

async function createDailyPdf(){
  const a = requireAuth(true); if(!a) return;
  const date = $("dateDaily")?.value;
  const driverName = $("driverNameExport")?.value || a.name || "";
  if(!date){ toast("日付が必要です"); return; }

  toast("日報PDF 作成中…", true);
  const params = (a.role==="admin")
    ? { date, adminPass: a.pass, driverName: driverName }
    : { date, driverPass: a.pass, driverName: a.name };

  const r = await callApi("dailyPdf", params);
  if(r.json && r.json.ok && r.json.url){
    toast("作成OK", true);
    setResult(r.json.url, `日報PDF（${date}）`);
    window.open(r.json.url, "_blank");
    return;
  }
  toast(r.json?.message || "作成失敗", false);
  window.open(r.url, "_blank");
}

async function createMonthlyPdf(){
  const a = requireAuth(true); if(!a) return;
  const month = $("month")?.value;
  const driverName = $("driverNameExport")?.value || a.name || "";
  if(!month){ toast("月が必要です"); return; }

  toast("月報PDF 作成中…", true);
  const params = (a.role==="admin")
    ? { month, adminPass: a.pass, driverName: driverName }
    : { month, driverPass: a.pass, driverName: a.name };

  const r = await callApi("monthlyPdf", params);
  if(r.json && r.json.ok && r.json.url){
    toast("作成OK", true);
    setResult(r.json.url, `月報PDF（詳細）（${month}）`);
    window.open(r.json.url, "_blank");
    return;
  }
  toast(r.json?.message || "作成失敗", false);
  window.open(r.url, "_blank");
}

async function createMonthlyCsv(){
  const a = requireAuth(true); if(!a) return;
  const month = $("month")?.value;
  const driverName = $("driverNameExport")?.value || a.name || "";
  if(!month){ toast("月が必要です"); return; }

  toast("月次CSV 作成中…", true);
  const params = (a.role==="admin")
    ? { month, adminPass: a.pass, driverName: driverName }
    : { month, driverPass: a.pass, driverName: a.name };

  const r = await callApi("monthlyCsv", params);
  if(r.json && r.json.ok && r.json.url){
    toast("作成OK", true);
    setResult(r.json.url, `月次CSV（${month}）`);
    window.open(r.json.url, "_blank");
    return;
  }
  toast(r.json?.message || "作成失敗", false);
  window.open(r.url, "_blank");
}

async function createCsvRange(){
  const a = requireAuth(true); if(!a) return;
  const from = $("fromDate")?.value;
  const to = $("toDate")?.value;
  const driverName = $("driverNameExport")?.value || a.name || "";
  if(!from || !to){ toast("開始日/終了日が必要です"); return; }
  if(from > to){ toast("日付範囲が不正です"); return; }

  toast("範囲CSV 作成中…", true);
  const params = (a.role==="admin")
    ? { from, to, adminPass: a.pass, driverName: driverName }
    : { from, to, driverPass: a.pass, driverName: a.name };

  const r = await callApi("csvRange", params);
  if(r.json && r.json.ok && r.json.url){
    toast("作成OK", true);
    setResult(r.json.url, `範囲CSV（${from}〜${to}）`);
    window.open(r.json.url, "_blank");
    return;
  }
  toast(r.json?.message || "作成失敗", false);
  window.open(r.url, "_blank");
}

async function loadHistory(){
  const a = requireAuth(true); if(!a) return;
  const month = $("historyMonth")?.value;
  const driverName = $("driverNameExport")?.value || a.name || "";
  if(!month){ toast("履歴の月が必要です"); return; }

  toast("履歴取得中…", true);
  const params = (a.role==="admin")
    ? { month, adminPass: a.pass, driverName: driverName }
    : { month, driverPass: a.pass, driverName: a.name };

  const r = await callApi("historyDays", params);
  if(r.json && r.json.ok && Array.isArray(r.json.days)){
    const days = r.json.days;
    const box = $("historyBox");
    const list = $("historyList");
    const cnt = $("historyCount");
    if(box) box.style.display="block";
    if(cnt) cnt.textContent = `${days.length}件`;
    if(list){
      list.innerHTML="";
      if(days.length===0){
        list.innerHTML = `<div class="hint">データなし</div>`;
      }else{
        days.slice().reverse().forEach(d=>{
          const div = document.createElement("div");
          div.className="item";
          div.innerHTML=`
            <div>
              <div class="d">${d}</div>
              <div class="meta">${a.role==="admin" ? ("対象："+(driverName||"全員")) : ("本人："+a.name)}</div>
            </div>
            <button class="btn rainbow" type="button">日報PDF</button>
          `;
          div.querySelector("button").addEventListener("click", ()=>{
            $("dateDaily").value = d;
            createDailyPdf();
          });
          list.appendChild(div);
        });
      }
    }
    toast("履歴表示OK", true);
    return;
  }
  toast(r.json?.message || "履歴取得失敗", false);
  window.open(r.url, "_blank");
}

/** admin search page */
async function adminSearch(){
  const a = requireAuth(true); if(!a) return;
  if(a.role!=="admin"){ toast("管理者のみ"); return; }

  const month = $("adminMonth")?.value || "";
  const qName = $("qName")?.value || "";
  const qPhone = $("qPhone")?.value || "";
  const qVehicle = $("qVehicle")?.value || "";

  toast("検索中…", true);
  const r = await callApi("adminSearch", { action:"adminSearch", month, qName, qPhone, qVehicle, adminPass: a.pass });
  if(r.json && r.json.ok && Array.isArray(r.json.rows)){
    const rows = r.json.rows;
    const out = $("adminResult");
    if(out){
      out.innerHTML = `<div class="hint">結果：${rows.length}件（最新500件まで）</div>` +
      rows.map(x=>`
        <div class="item">
          <div>
            <div class="d">${escapeHtml(x.date)} ${escapeHtml(x.time)} / ${escapeHtml(x.mode)}</div>
            <div class="meta">${escapeHtml(x.driverName)} / ${escapeHtml(x.driverPhone)} / ${escapeHtml(x.vehicleNo)}</div>
          </div>
          <button class="btn primary" type="button" data-date="${escapeHtml(x.date)}" data-name="${escapeHtml(x.driverName)}">日報PDF</button>
        </div>
      `).join("");

      out.querySelectorAll("button[data-date]").forEach(btn=>{
        btn.addEventListener("click", ()=>{
          const d = btn.getAttribute("data-date");
          const n = btn.getAttribute("data-name");
          const u = buildUrl("dailyPdf", { date:d, adminPass:a.pass, driverName:n });
          window.open(u, "_blank");
        });
      });
    }
    toast("検索OK", true);
    return;
  }
  toast(r.json?.message || "検索失敗", false);
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

/** ========== page init ========== */
function initDeparture(){
  const a = setLoginState();
  if($("date") && !$("date").value) $("date").value = toYMD();
  if($("time") && !$("time").value) $("time").value = toHM();

  // driverNameはログイン名で固定入力（本名）
  if(a && a.role==="driver"){
    if($("driverName")) $("driverName").value = a.name;
  }

  const calc=()=>{
    const s=numOrBlank($("odoStart")?.value);
    const e=numOrBlank($("odoEnd")?.value);
    if(s!=="" && e!=="") $("odoTotal").value = Math.max(0, Number(e)-Number(s));
  };
  $("odoStart")?.addEventListener("input", calc);
  $("odoEnd")?.addEventListener("input", calc);

  $("btnSubmit")?.addEventListener("click", ()=>submitTenko("departure"));
  $("backBtn")?.addEventListener("click", ()=>location.href="./index.html");
}

function initArrival(){
  const a = setLoginState();
  if($("date") && !$("date").value) $("date").value = toYMD();
  if($("time") && !$("time").value) $("time").value = toHM();

  if(a && a.role==="driver"){
    if($("driverName")) $("driverName").value = a.name;
  }

  const calc=()=>{
    const s=numOrBlank($("odoStart")?.value);
    const e=numOrBlank($("odoEnd")?.value);
    if(s!=="" && e!=="") $("odoTotal").value = Math.max(0, Number(e)-Number(s));
  };
  $("odoStart")?.addEventListener("input", calc);
  $("odoEnd")?.addEventListener("input", calc);

  $("btnSubmit")?.addEventListener("click", ()=>submitTenko("arrival"));
  $("backBtn")?.addEventListener("click", ()=>location.href="./index.html");
}

function initExport(){
  const a = setLoginState();
  if($("gasUrlView")) $("gasUrlView").textContent = GAS_WEBAPP_URL;

  if($("dateDaily") && !$("dateDaily").value) $("dateDaily").value = toYMD();
  if($("month") && !$("month").value){
    const d=new Date();
    $("month").value = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
  }
  if($("historyMonth") && !$("historyMonth").value){
    const d=new Date();
    $("historyMonth").value = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
  }

  // driverNameExport：driverは編集不可にする（本人のみ）
  if(a && a.role==="driver"){
    if($("driverNameExport")){
      $("driverNameExport").value = a.name;
      $("driverNameExport").setAttribute("readonly","readonly");
    }
  }

  $("btnDailyPdf")?.addEventListener("click", createDailyPdf);
  $("btnMonthlyPdf")?.addEventListener("click", createMonthlyPdf);
  $("btnMonthlyCsv")?.addEventListener("click", createMonthlyCsv);
  $("btnCsvRange")?.addEventListener("click", createCsvRange);
  $("btnLoadHistory")?.addEventListener("click", loadHistory);

  $("backBtn")?.addEventListener("click", ()=>location.href="./index.html");
}

function initAdmin(){
  const a = setLoginState();
  if(!a || a.role!=="admin"){
    toast("管理者のみ", false);
    location.href="./index.html";
    return;
  }
  if($("gasUrlView")) $("gasUrlView").textContent = GAS_WEBAPP_URL;

  $("adminSearchBtn")?.addEventListener("click", adminSearch);
  $("backBtn")?.addEventListener("click", ()=>location.href="./index.html");
}

function initIndex(){
  // indexはauth.jsで制御
  const a = authGet();
  const st = $("sessionState");
  if(st){
    if(isAuthed()){
      st.innerHTML = a.role==="admin"
        ? `ログイン中：<b>管理者</b>`
        : `ログイン中：<b>${escapeHtml(a.name)}</b>`;
    }else{
      st.innerHTML = `未ログイン`;
    }
  }

  $("logoutBtn")?.addEventListener("click", ()=>{
    authClear();
    toast("ログアウトしました", true);
    setTimeout(()=>location.reload(), 300);
  });

  // ドライバー login
  $("driverLoginBtn")?.addEventListener("click", ()=>{
    const name = safeStr($("driverNameLogin")?.value);
    const pass = safeStr($("driverPassLogin")?.value);
    markError($("driverNameLogin"), !name);
    markError($("driverPassLogin"), !pass);

    if(!name){ toast("本名を入力"); return; }
    if(pass !== "202601"){ toast("ドライバーパスが違います"); return; }

    authSet("driver", name, pass);
    toast("ログインOK", true);
    setTimeout(()=>location.reload(), 400);
  });

  // 管理者 login
  $("adminLoginBtn")?.addEventListener("click", ()=>{
    const pass = safeStr($("adminPassLogin")?.value);
    markError($("adminPassLogin"), !pass);
    if(pass !== "ofa-2026"){ toast("管理者パスが違います"); return; }
    authSet("admin", "", pass);
    toast("管理者ログインOK", true);
    setTimeout(()=>location.reload(), 400);
  });

  // ログイン済みならメニュー表示
  const menu = $("menuBox");
  const lock = $("loginBox");
  if(isAuthed()){
    if(lock) lock.style.display="none";
    if(menu) menu.style.display="block";
  }else{
    if(lock) lock.style.display="block";
    if(menu) menu.style.display="none";
  }
}

window.addEventListener("DOMContentLoaded", ()=>{
  const page = document.body?.dataset?.page || "";
  if(page==="index") initIndex();
  if(page==="departure") initDeparture();
  if(page==="arrival") initArrival();
  if(page==="export") initExport();
  if(page==="admin") initAdmin();
});
