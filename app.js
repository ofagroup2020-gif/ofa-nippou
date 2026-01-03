/****************************************************
 * OFA 点呼システム app.js（完全動作・送信停止潰し版）
 ****************************************************/

// ✅ あなたのGAS WebApp URLに置換
const GAS_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbyBhHOjpzOlfOIVANlELi4sbJtT_DWd7ApCEX8f_chBXl4xfCtYo9nJE008vLwtKcqO_w/exec";

// ✅ 管理者パス
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

function setAdmin(enabled){
  localStorage.setItem("ofa_admin", enabled ? "1" : "0");
}
function isAdmin(){
  return localStorage.getItem("ofa_admin")==="1";
}

function getLogin(){
  return {
    token: localStorage.getItem("ofa_token") || "",
    email: localStorage.getItem("ofa_email") || "",
    name: localStorage.getItem("ofa_name") || ""
  };
}

function fillNow(){
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  const hh = String(d.getHours()).padStart(2,"0");
  const mi = String(d.getMinutes()).padStart(2,"0");
  if($("date") && !$("date").value) $("date").value = `${yyyy}-${mm}-${dd}`;
  if($("time") && !$("time").value) $("time").value = `${hh}:${mi}`;
}

function bindBack(){
  const b = $("backBtn");
  if(b) b.addEventListener("click", ()=> history.length>1 ? history.back() : location.href="./index.html");
}

function calcOdo(){
  const s = ($("odoStart")?.value||"").trim();
  const e = ($("odoEnd")?.value||"").trim();
  const total = $("odoTotal");
  if(!total) return;
  const sn = Number(String(s).replace(/[^\d.]/g,""));
  const en = Number(String(e).replace(/[^\d.]/g,""));
  if(!isFinite(sn) || !isFinite(en) || !s || !e){ total.value=""; return; }
  const diff = en - sn;
  total.value = diff >= 0 ? String(diff) : "";
}

function markInvalid(el, invalid){
  if(!el) return;
  if(invalid) el.classList.add("invalid");
  else el.classList.remove("invalid");
}

function validateRequired(){
  let ok = true;
  const req = document.querySelectorAll("[data-required='1']");
  req.forEach(el=>{
    const v = (el.value || "").trim();
    const invalid = !v;
    markInvalid(el, invalid);
    if(invalid) ok = false;
  });
  if(!ok) toast("必須項目を入力してください（赤枠）");
  return ok;
}

async function filesToBase64(inputId, limitCount=3){
  const el = $(inputId);
  if(!el || !el.files || el.files.length===0) return [];
  const files = Array.from(el.files).slice(0, limitCount);

  const results = [];
  for(const f of files){
    const b64 = await new Promise((resolve, reject)=>{
      const r = new FileReader();
      r.onload = ()=> resolve(String(r.result||""));
      r.onerror = reject;
      r.readAsDataURL(f);
    });
    results.push({
      name: f.name,
      type: f.type,
      dataUrl: b64
    });
  }
  return results;
}

async function postToGAS(payload){
  // ✅ 送信中表示
  const btn = $("btnSubmit");
  if(btn){
    btn.disabled = true;
    btn.dataset.old = btn.textContent;
    btn.textContent = "送信中…";
  }

  try{
    const res = await fetch(GAS_WEBAPP_URL, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify(payload),
      mode: "cors"
    });

    // GASがtext返す場合もあるので両対応
    const text = await res.text();
    let json;
    try{ json = JSON.parse(text); }catch(_){ json = { ok: res.ok, raw: text }; }

    if(!res.ok || json.ok === false){
      throw new Error(json.message || json.error || json.raw || "送信に失敗しました");
    }
    return json;

  }finally{
    if(btn){
      btn.disabled = false;
      btn.textContent = btn.dataset.old || "送信";
    }
  }
}

function collectCommon(){
  const login = getLogin();
  return {
    token: login.token,
    loginEmail: login.email,
    loginName: login.name,
    date: $("date")?.value || "",
    time: $("time")?.value || "",
    driverName: $("driverName")?.value || "",
    driverPhone: $("driverPhone")?.value || "",
    vehicleNo: $("vehicleNo")?.value || "",
    managerName: $("managerName")?.value || "",
    method: $("method")?.value || "",
    place: $("place")?.value || "",
    alcoholValue: $("alcoholValue")?.value || "",
    alcoholBand: $("alcoholBand")?.value || "",
    sleepHours: $("sleepHours")?.value || "",
    condition: $("condition")?.value || "",
    memo: $("memo")?.value || "",
    odoStart: $("odoStart")?.value || "",
    odoEnd: $("odoEnd")?.value || "",
    odoTotal: $("odoTotal")?.value || "",

    insp: {
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
      triangle: $("insp_triangle")?.value || ""
    },
    insp_note: $("insp_note")?.value || "",
    licenseNo: $("licenseNo")?.value || ""
  };
}

async function initDeparture(){
  fillNow();
  bindBack();

  $("odoStart")?.addEventListener("input", calcOdo);
  $("odoEnd")?.addEventListener("input", calcOdo);

  // 入力時に赤枠解除
  document.querySelectorAll("[data-required='1']").forEach(el=>{
    el.addEventListener("input", ()=> markInvalid(el,false));
    el.addEventListener("change", ()=> markInvalid(el,false));
  });

  const btn = $("btnSubmit");
  if(!btn) return;

  btn.addEventListener("click", async ()=>{
    const login = getLogin();
    if(!login.token){
      toast("Googleでログインしてください");
      return;
    }
    if(!validateRequired()) return;

    const base = collectCommon();

    // 写真（多すぎると失敗するので枚数制限）
    const inspPhotos = await filesToBase64("inspPhotos", 3);
    const licensePhotos = await filesToBase64("licensePhotos", 2);
    const tenkoPhotos = await filesToBase64("tenkoPhotos", 2);

    const payload = {
      action: "submitDeparture",
      ...base,
      photos: { inspPhotos, licensePhotos, tenkoPhotos }
    };

    try{
      const out = await postToGAS(payload);
      toast("送信完了！", true);
      // ✅ 戻る
      setTimeout(()=> location.href="./index.html", 700);
    }catch(e){
      toast(String(e.message || e));
    }
  });
}

async function initArrival(){
  fillNow();
  bindBack();

  $("odoStart")?.addEventListener("input", calcOdo);
  $("odoEnd")?.addEventListener("input", calcOdo);

  document.querySelectorAll("[data-required='1']").forEach(el=>{
    el.addEventListener("input", ()=> markInvalid(el,false));
    el.addEventListener("change", ()=> markInvalid(el,false));
  });

  const btn = $("btnSubmit");
  if(!btn) return;

  btn.addEventListener("click", async ()=>{
    const login = getLogin();
    if(!login.token){
      toast("Googleでログインしてください");
      return;
    }
    if(!validateRequired()) return;

    const base = collectCommon();

    // 日報系
    const workType = $("workType")?.value || "";
    const workArea = $("workArea")?.value || "";
    const workHours = $("workHours")?.value || "";
    const deliveryCount = $("deliveryCount")?.value || "";
    const trouble = $("trouble")?.value || "";
    const dailyNote = $("dailyNote")?.value || "";

    const inspPhotos = await filesToBase64("inspPhotos", 3);
    const licensePhotos = await filesToBase64("licensePhotos", 2);
    const tenkoPhotos = await filesToBase64("tenkoPhotos", 2);
    const reportPhotos = await filesToBase64("reportPhotos", 3);

    const payload = {
      action: "submitArrival",
      ...base,
      daily: { workType, workArea, workHours, deliveryCount, trouble, dailyNote },
      photos: { inspPhotos, licensePhotos, tenkoPhotos, reportPhotos }
    };

    try{
      const out = await postToGAS(payload);
      toast("送信完了！", true);
      setTimeout(()=> location.href="./index.html", 700);
    }catch(e){
      toast(String(e.message || e));
    }
  });
}

function initExport(){
  bindBack();

  const gasView = $("gasUrlView");
  if(gasView) gasView.textContent = GAS_WEBAPP_URL;

  const adminState = $("adminState");
  const adminBox = $("adminSearchBox");

  function refreshAdminUI(){
    const on = isAdmin();
    if(adminState) adminState.textContent = on ? "管理者ON" : "管理者OFF";
    if(adminBox){
      adminBox.classList.toggle("hidden", !on);
    }
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
    if($("adminPass")) $("adminPass").value="";
    toast("管理者モードOFF", true);
    refreshAdminUI();
  });

  refreshAdminUI();

  async function exportAction(action, extra){
    const login = getLogin();
    if(!login.token){
      toast("Googleでログインしてください");
      return;
    }

    const payload = {
      action,
      token: login.token,
      loginEmail: login.email,
      admin: isAdmin(),
      adminQuery: isAdmin() ? {
        name: $("qName")?.value || "",
        phone: $("qPhone")?.value || "",
        vehicle: $("qVehicle")?.value || ""
      } : null,
      ...extra
    };

    try{
      const out = await postToGAS(payload);
      const box = $("resultBox");
      if(box){
        box.classList.remove("hidden");
        const link = out.url ? `<a href="${out.url}" target="_blank" rel="noopener">出力を開く</a>` : "";
        box.innerHTML = `<b>完了</b><br>${out.message || ""}<br>${link}`;
      }
      toast("出力完了", true);
    }catch(e){
      toast(String(e.message || e));
    }
  }

  $("btnDailyPdf")?.addEventListener("click", ()=>{
    exportAction("makeDailyPdf", { date: $("dateDaily")?.value || "" });
  });

  $("btnMonthlyPdf")?.addEventListener("click", ()=>{
    exportAction("makeMonthlyPdf", { month: $("month")?.value || "" });
  });

  $("btnMonthlyCsv")?.addEventListener("click", ()=>{
    exportAction("makeMonthlyCsv", { month: $("month")?.value || "" });
  });

  $("btnCsvRange")?.addEventListener("click", ()=>{
    exportAction("makeRangeCsv", { from: $("fromDate")?.value || "", to: $("toDate")?.value || "" });
  });
}

window.addEventListener("DOMContentLoaded", ()=>{
  const page = document.body?.dataset?.page || "";

  // 共通：ログイン表示
  const ls = $("loginState");
  const login = getLogin();
  if(ls){
    ls.innerHTML = login.token ? `ログイン中：<b>${login.email}</b>` : "未ログイン";
  }

  if(page === "departure") initDeparture();
  if(page === "arrival") initArrival();
  if(page === "export") initExport();

  // indexはauth.js側でメニュー制御
});
