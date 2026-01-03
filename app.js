/****************************************************
 * OFA 点呼システム app.js（完成版：反応しない問題を潰した版）
 ****************************************************/

const GAS_WEBAPP_URL =
  "https://script.google.com/macros/s/AKfycby36HAYkaJwC3K6-8LogpFZ56iplXwvrp38IskarnrLZrHguoCzeOGLSB-S3Kcjo_Uf_w/exec";

const ADMIN_PASS = "ofa-2026";

function $(id){ return document.getElementById(id); }

function toast(msg, ok=false){
  const el = $("toast");
  if(!el){ alert(msg); return; }
  el.textContent = msg;
  el.className = "toast " + (ok ? "ok":"ng");
  el.style.display = "block";
  setTimeout(()=> el.style.display="none", 2400);
}

function setBusy(btn, busy){
  if(!btn) return;
  btn.disabled = !!busy;
  btn.dataset.origText = btn.dataset.origText || btn.textContent;
  btn.textContent = busy ? "送信中..." : btn.dataset.origText;
}

function getToken(){
  return localStorage.getItem("ofa_id_token") || "";
}
function isLoggedIn(){
  return !!(localStorage.getItem("ofa_id_token") && localStorage.getItem("ofa_email"));
}

/** 管理者フラグ（ローカル保存） */
function setAdmin(enabled){
  localStorage.setItem("ofa_admin", enabled ? "1" : "0");
}
function isAdmin(){
  return localStorage.getItem("ofa_admin")==="1";
}

/** POST to GAS */
async function postGAS(payload){
  const res = await fetch(GAS_WEBAPP_URL, {
    method: "POST",
    headers: { "Content-Type":"text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let json;
  try{ json = JSON.parse(text); }catch(e){
    throw new Error("GAS応答がJSONではありません: " + text.slice(0,200));
  }
  if(!json.ok){
    throw new Error(json.error || "GASエラー");
  }
  return json;
}

/** Required validation (data-req="1") */
function validateRequired(root){
  let ok = true;
  const reqs = root.querySelectorAll("[data-req='1']");
  reqs.forEach(el=>{
    el.classList.remove("err");
    const v = (el.value || "").trim();
    if(!v){
      el.classList.add("err");
      ok = false;
    }
  });
  if(!ok) toast("必須項目が未入力です（赤枠）");
  return ok;
}

/** ODO auto calc */
function bindOdoCalc(){
  const s = $("odoStart"), e = $("odoEnd"), t = $("odoTotal");
  if(!s || !e || !t) return;
  function calc(){
    const a = parseFloat((s.value||"").trim());
    const b = parseFloat((e.value||"").trim());
    if(isFinite(a) && isFinite(b) && b >= a){
      t.value = String(b - a);
    }else{
      t.value = "";
    }
  }
  s.addEventListener("input", calc);
  e.addEventListener("input", calc);
}

/** Read files -> base64 list (limit safety) */
async function readFiles(inputId, limit=8){
  const inp = $(inputId);
  if(!inp || !inp.files || inp.files.length===0) return [];
  const files = Array.from(inp.files).slice(0, limit);
  const out = [];
  for(const f of files){
    const b64 = await fileToBase64(f);
    out.push({
      name: f.name,
      type: f.type || "application/octet-stream",
      data: b64
    });
  }
  return out;
}
function fileToBase64(file){
  return new Promise((resolve, reject)=>{
    const fr = new FileReader();
    fr.onload = ()=> {
      const res = String(fr.result || "");
      // "data:image/jpeg;base64,...."
      const base64 = res.split(",")[1] || "";
      resolve(base64);
    };
    fr.onerror = ()=> reject(new Error("ファイル読み込み失敗: " + file.name));
    fr.readAsDataURL(file);
  });
}

/** collect common fields */
function collectCommon(){
  return {
    date: $("date")?.value || "",
    time: $("time")?.value || "",
    driverName: ($("driverName")?.value || "").trim(),
    driverPhone: ($("driverPhone")?.value || "").trim(),
    vehicleNo: ($("vehicleNo")?.value || "").trim(),
    managerName: ($("managerName")?.value || "").trim(),
    method: $("method")?.value || "",
    place: ($("place")?.value || "").trim(),
    alcoholValue: ($("alcoholValue")?.value || "").trim(),
    alcoholBand: $("alcoholBand")?.value || "",
    sleepHours: ($("sleepHours")?.value || "").trim(),
    bodyTemp: ($("bodyTemp")?.value || "").trim(),
    health: $("health")?.value || "",
    memo: ($("memo")?.value || "").trim(),
    odoStart: ($("odoStart")?.value || "").trim(),
    odoEnd: ($("odoEnd")?.value || "").trim(),
    odoTotal: ($("odoTotal")?.value || "").trim(),
    inspection: {
      tire: $("insp_tire")?.value || "",
      light: $("insp_light")?.value || "",
      brake: $("insp_brake")?.value || "",
      wiper: $("insp_wiper")?.value || "",
      engineOil: $("insp_engineOil")?.value || "",
      coolant: $("insp_coolant")?.value || "",
      battery: $("insp_battery")?.value || "",
      horn: $("insp_horn")?.value || "",
      mirror: $("insp_mirror")?.value || "",
      damage: $("insp_damage")?.value || "",
      cargo: $("insp_cargo")?.value || "",
      extinguisher: $("insp_extinguisher")?.value || "",
      triangle: $("insp_triangle")?.value || "",
      note: ($("insp_note")?.value || "").trim(),
    },
    licenseNo: ($("licenseNo")?.value || "").trim(),
  };
}

/** submit tenko */
async function submitTenko(kind){
  if(!isLoggedIn()){
    toast("Googleログインしてください"); return;
  }
  const form = $("tenkoForm") || document;
  if(!validateRequired(form)) return;

  const btn = $("btnSubmit");
  setBusy(btn, true);

  try{
    const payload = collectCommon();

    // files
    const files = {
      inspPhotos: await readFiles("inspPhotos", 10),
      licensePhotos: await readFiles("licensePhotos", 6),
      tenkoPhotos: await readFiles("tenkoPhotos", 10),
      reportPhotos: await readFiles("reportPhotos", 10),
    };

    // arrival-only daily report
    let daily = null;
    if(kind === "arrival"){
      daily = {
        workType: ($("workType")?.value || "").trim(),
        workArea: ($("workArea")?.value || "").trim(),
        workHours: ($("workHours")?.value || "").trim(),
        deliveryCount: ($("deliveryCount")?.value || "").trim(),
        trouble: ($("trouble")?.value || "").trim(),
        dailyNote: ($("dailyNote")?.value || "").trim(),
      };
    }

    const req = {
      action: "submitTenko",
      token: getToken(),
      kind, // "departure" or "arrival"
      payload,
      daily,
      files
    };

    const json = await postGAS(req);
    toast("保存しました ✅", true);

    // redirect top
    setTimeout(()=> location.href="./index.html", 600);
  }catch(e){
    toast("送信失敗: " + e.message);
    console.error(e);
  }finally{
    setBusy(btn, false);
  }
}

/** Export page */
function initExport(){
  if($("gasUrlView")) $("gasUrlView").textContent = GAS_WEBAPP_URL;

  const adminState = $("adminState");
  const adminBox = $("adminSearchBox");

  function refreshAdminUI(){
    const on = isAdmin();
    if(adminState) adminState.innerHTML = on ? `<span class="pill on">管理者ON</span>` : `<span class="pill">管理者OFF</span>`;
    if(adminBox) adminBox.style.display = on ? "block" : "none";
  }

  $("adminLoginBtn")?.addEventListener("click", ()=>{
    const v = ($("adminPass")?.value || "").trim();
    if(v !== ADMIN_PASS){
      setAdmin(false);
      toast("管理者パスワードが違います");
      refreshAdminUI();
      return;
    }
    setAdmin(true);
    toast("管理者モードON", true);
    refreshAdminUI();
  });

  $("adminLogoutBtn")?.addEventListener("click", ()=>{
    setAdmin(false);
    toast("管理者モードOFF", true);
    if($("adminPass")) $("adminPass").value = "";
    refreshAdminUI();
  });

  refreshAdminUI();

  $("btnDailyPdf")?.addEventListener("click", async ()=>{
    try{
      if(!isLoggedIn()){ toast("Googleログインしてください"); return; }
      const date = $("dateDaily")?.value || "";
      if(!date){ toast("日付を選んでください"); return; }
      const q = getAdminQuery();
      const json = await postGAS({ action:"exportDailyPdf", token:getToken(), date, admin:isAdmin(), query:q });
      showResult(json.data);
      toast("PDFを作成しました", true);
    }catch(e){ toast("失敗: " + e.message); }
  });

  $("btnMonthlyPdf")?.addEventListener("click", async ()=>{
    try{
      if(!isLoggedIn()){ toast("Googleログインしてください"); return; }
      const month = $("month")?.value || "";
      if(!month){ toast("月を選んでください"); return; }
      const q = getAdminQuery();
      const json = await postGAS({ action:"exportMonthlyPdf", token:getToken(), month, admin:isAdmin(), query:q });
      showResult(json.data);
      toast("月報PDFを作成しました", true);
    }catch(e){ toast("失敗: " + e.message); }
  });

  $("btnMonthlyCsv")?.addEventListener("click", async ()=>{
    try{
      if(!isLoggedIn()){ toast("Googleログインしてください"); return; }
      const month = $("month")?.value || "";
      if(!month){ toast("月を選んでください"); return; }
      const q = getAdminQuery();
      const json = await postGAS({ action:"exportMonthlyCsv", token:getToken(), month, admin:isAdmin(), query:q });
      showResult(json.data);
      toast("CSVを作成しました", true);
    }catch(e){ toast("失敗: " + e.message); }
  });

  $("btnCsvRange")?.addEventListener("click", async ()=>{
    try{
      if(!isLoggedIn()){ toast("Googleログインしてください"); return; }
      const from = $("fromDate")?.value || "";
      const to = $("toDate")?.value || "";
      if(!from || !to){ toast("開始日/終了日を入れてください"); return; }
      const q = getAdminQuery();
      const json = await postGAS({ action:"exportCsvRange", token:getToken(), from, to, admin:isAdmin(), query:q });
      showResult(json.data);
      toast("範囲CSVを作成しました", true);
    }catch(e){ toast("失敗: " + e.message); }
  });

  $("btnLoadHistory")?.addEventListener("click", async ()=>{
    try{
      if(!isLoggedIn()){ toast("Googleログインしてください"); return; }
      const m = $("historyMonth")?.value || "";
      if(!m){ toast("対象月を選んでください"); return; }
      const q = getAdminQuery();
      const json = await postGAS({ action:"listHistory", token:getToken(), month:m, admin:isAdmin(), query:q });
      renderHistory(json.data || []);
    }catch(e){ toast("失敗: " + e.message); }
  });

  function getAdminQuery(){
    return {
      name: ($("qName")?.value || "").trim(),
      phone: ($("qPhone")?.value || "").trim(),
      vehicle: ($("qVehicle")?.value || "").trim(),
    };
  }

  function showResult(data){
    const box = $("resultBox");
    if(!box) return;
    box.style.display = "block";
    const items = [];
    if(data?.pdfUrl) items.push(`<div><b>PDF</b>：<a target="_blank" rel="noopener" href="${data.pdfUrl}">開く</a></div>`);
    if(data?.csvUrl) items.push(`<div><b>CSV</b>：<a target="_blank" rel="noopener" href="${data.csvUrl}">開く</a></div>`);
    if(data?.message) items.push(`<div>${escapeHtml(data.message)}</div>`);
    box.innerHTML = items.join("");
  }

  function renderHistory(list){
    const box = $("historyBox");
    const cnt = $("historyCount");
    const ul = $("historyList");
    if(!box || !cnt || !ul) return;
    box.style.display = "block";
    cnt.textContent = `${list.length}件`;
    ul.innerHTML = "";
    list.forEach(row=>{
      const a = document.createElement("button");
      a.type = "button";
      a.className = "histItem";
      a.textContent = `${row.date} / ${row.driverName} / ${row.vehicleNo}`;
      a.addEventListener("click", async ()=>{
        try{
          const q = getAdminQuery();
          const json = await postGAS({ action:"exportDailyPdf", token:getToken(), date:row.date, admin:isAdmin(), query:q, rowId: row.rowId });
          showResult(json.data);
          toast("日報PDFを作成しました", true);
        }catch(e){ toast("失敗: " + e.message); }
      });
      ul.appendChild(a);
    });
  }
}

/** Back button */
function bindBack(){
  const b = $("backBtn");
  if(!b) return;
  b.addEventListener("click", ()=> history.length>1 ? history.back() : (location.href="./index.html"));
}

/** Escape */
function escapeHtml(str){
  return (str||"").replace(/[&<>"']/g, (m)=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[m]));
}

/** page init */
window.addEventListener("DOMContentLoaded", ()=>{
  bindBack();
  bindOdoCalc();

  const page = document.body?.dataset?.page || "";

  if(page === "departure"){
    $("btnSubmit")?.addEventListener("click", ()=> submitTenko("departure"));
  }
  if(page === "arrival"){
    $("btnSubmit")?.addEventListener("click", ()=> submitTenko("arrival"));
  }
  if(page === "export"){
    initExport();
  }

  // GAS 疎通確認（静かに）
  // postGAS({action:"ping"}).catch(()=>{});
});
