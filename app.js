/****************************************************
 * OFA 点呼システム app.js（確実動作版）
 ****************************************************/
const GAS_URL = "【あなたのGAS WebApp URL】";
const ADMIN_PASS = "ofa-2026";

function $(id){ return document.getElementById(id); }

function toast(msg, ok=false){
  const el = $("toast");
  if(!el){ alert(msg); return; }
  el.textContent = msg;
  el.className = "toast " + (ok ? "ok":"ng");
  el.style.display = "block";
  setTimeout(()=> el.style.display="none", 2200);
}

function setAdmin(on){ localStorage.setItem("ofa_admin",""+(on?1:0)); }
function isAdmin(){ return localStorage.getItem("ofa_admin")==="1"; }
function setAdminPass(p){ localStorage.setItem("ofa_admin_pass", p); }
function getAdminPass(){ return localStorage.getItem("ofa_admin_pass")||""; }

function todayStr(){
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const da = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${da}`;
}
function nowTimeStr(){
  const d = new Date();
  const hh = String(d.getHours()).padStart(2,"0");
  const mm = String(d.getMinutes()).padStart(2,"0");
  return `${hh}:${mm}`;
}

function markInvalid(el, invalid){
  if(!el) return;
  el.classList.toggle("invalid", !!invalid);
}

function requireValue(el, label){
  const v = (el?.value||"").trim();
  const bad = !v;
  markInvalid(el, bad);
  if(bad) toast(`${label} は必須です`);
  return !bad;
}

async function postJSON(payload){
  const res = await fetch(GAS_URL, {
    method:"POST",
    headers:{ "Content-Type":"text/plain;charset=utf-8" }, // GAS相性◎
    body: JSON.stringify(payload),
  });
  const txt = await res.text();
  let json = {};
  try { json = JSON.parse(txt); } catch(e){ json = {ok:false, message:"サーバー応答が不正です"}; }
  return json;
}

async function uploadFilesAsBase64(fileInput){
  // 画像をGASに上げたい場合は別途Driveアップロード実装が必要。
  // 今回は「送信が止まらないこと優先」→ ファイル名のみ保存（100%動作）
  if(!fileInput || !fileInput.files || fileInput.files.length===0) return [];
  return Array.from(fileInput.files).map(f => f.name);
}

function bindBack(){
  const b = $("backBtn");
  if(b) b.addEventListener("click", ()=> location.href="./index.html");
}

/***************
 * 共通：フォーム入力補助
 ***************/
function bindAutoCalcOdo(){
  const s = $("odoStart"), e = $("odoEnd"), t = $("odoTotal");
  if(!s || !e || !t) return;
  const calc = ()=>{
    const a = parseFloat((s.value||"").replace(/[^\d.]/g,""));
    const b = parseFloat((e.value||"").replace(/[^\d.]/g,""));
    if(!isNaN(a) && !isNaN(b) && b>=a){
      t.value = String(b-a);
      markInvalid(e,false);
    }else{
      t.value = "";
      if(e.value) markInvalid(e,true);
    }
  };
  s.addEventListener("input", calc);
  e.addEventListener("input", calc);
}

function bindPersistName(){
  const n = $("driverName");
  if(!n) return;
  n.value = localStorage.getItem("ofa_driver_name") || "";
  n.addEventListener("input", ()=> localStorage.setItem("ofa_driver_name", n.value));
}

/***************
 * 出発/帰着：送信
 ***************/
async function submitTenko(type){
  const btn = $("btnSubmit");
  if(btn){
    btn.disabled = true;
    btn.textContent = "送信中…";
  }

  try{
    // 必須：氏名・日付・時刻・点検（最低限）
    const okName = requireValue($("driverName"), "運転者氏名（本名）");
    if(!okName) throw new Error("required");

    const dateEl = $("date");
    const timeEl = $("time");
    if(dateEl && !dateEl.value) dateEl.value = todayStr();
    if(timeEl && !timeEl.value) timeEl.value = nowTimeStr();

    // 点検 必須（全部OK/NG選択必須）
    const inspIds = [
      "insp_tire","insp_light","insp_brake","insp_wiper","insp_engineOil","insp_coolant",
      "insp_battery","insp_horn","insp_mirror","insp_damage","insp_cargo","insp_extinguisher","insp_triangle"
    ];
    for(const id of inspIds){
      const el = $(id);
      if(el){
        const v = (el.value||"").trim();
        const bad = !v;
        markInvalid(el, bad);
        if(bad){
          toast("車両点検（必須）をすべて選択してください");
          throw new Error("required");
        }
      }
    }

    // 異常写真（点検NGが1つでもあれば推奨）
    const hasNG = inspIds.some(id => ($(id)?.value||"") === "NG");
    const abnormalPhotos = await uploadFilesAsBase64($("abnormalPhotos"));

    if(hasNG && abnormalPhotos.length===0){
      // 強制ではないが注意
      toast("点検にNGがあります。異常箇所写真の添付を推奨します");
    }

    const payload = {
      action:"submit",
      type,
      date: $("date")?.value || todayStr(),
      time: $("time")?.value || nowTimeStr(),

      name: $("driverName")?.value || "",
      phone: $("driverPhone")?.value || "",
      vehicleNo: $("vehicleNo")?.value || "",
      managerName: $("managerName")?.value || "",
      method: $("method")?.value || "",
      place: $("place")?.value || "",

      alcoholValue: $("alcoholValue")?.value || "",
      alcoholBand: $("alcoholBand")?.value || "",

      // 睡眠（追加）
      sleepHours: $("sleepHours")?.value || "",
      sleepQuality: $("sleepQuality")?.value || "",

      odoStart: $("odoStart")?.value || "",
      odoEnd: $("odoEnd")?.value || "",
      odoTotal: $("odoTotal")?.value || "",

      // 点検
      insp_tire: $("insp_tire")?.value || "",
      insp_light: $("insp_light")?.value || "",
      insp_brake: $("insp_brake")?.value || "",
      insp_wiper: $("insp_wiper")?.value || "",
      insp_engineOil: $("insp_engineOil")?.value || "",
      insp_coolant: $("insp_coolant")?.value || "",
      insp_battery: $("insp_battery")?.value || "",
      insp_horn: $("insp_horn")?.value || "",
      insp_mirror: $("insp_mirror")?.value || "",
      insp_damage: $("insp_damage")?.value || "",
      insp_cargo: $("insp_cargo")?.value || "",
      insp_extinguisher: $("insp_extinguisher")?.value || "",
      insp_triangle: $("insp_triangle")?.value || "",

      memo: $("memo")?.value || "",
      insp_note: $("insp_note")?.value || "",

      abnormalPhotos,

      licenseNo: $("licenseNo")?.value || "",
      licensePhotos: await uploadFilesAsBase64($("licensePhotos")),
      tenkoPhotos: await uploadFilesAsBase64($("tenkoPhotos")),

      // 帰着（日報）
      workType: $("workType")?.value || "",
      workArea: $("workArea")?.value || "",
      workHours: $("workHours")?.value || "",
      deliveryCount: $("deliveryCount")?.value || "",
      trouble: $("trouble")?.value || "",
      dailyNote: $("dailyNote")?.value || "",
      reportPhotos: await uploadFilesAsBase64($("reportPhotos")),
    };

    const r = await postJSON(payload);
    if(!r.ok) throw new Error(r.message || "送信失敗");

    toast("送信完了", true);
    setTimeout(()=> location.href="./index.html", 700);

  }catch(err){
    if(String(err.message||"") !== "required"){
      toast(err.message || "送信に失敗しました");
    }
  }finally{
    if(btn){
      btn.disabled = false;
      btn.textContent = type==="departure"
        ? "送信（出発点呼）→ 保存してトップへ"
        : "送信（帰着点呼/日報）→ 保存してトップへ";
    }
  }
}

/***************
 * 本人用PDF/CSV
 ***************/
async function driverDailyPdf(){
  const nameEl = $("driverNameExport");
  const dateEl = $("dateDaily");
  if(!requireValue(nameEl, "氏名")) return;

  const name = nameEl.value.trim();
  const date = dateEl.value || todayStr();

  const r = await postJSON({action:"dailyPdf", name, date});
  if(!r.ok) return toast(r.message || "作成失敗");
  toast("PDF作成完了", true);
  window.open(r.url, "_blank");
}

async function driverMonthlyCsv(){
  const nameEl = $("driverNameExport");
  const monthEl = $("month");
  if(!requireValue(nameEl, "氏名")) return;
  if(!requireValue(monthEl, "月")) return;

  const r = await postJSON({action:"monthlyCsv", name:nameEl.value.trim(), month:monthEl.value});
  if(!r.ok) return toast(r.message || "作成失敗");

  // CSVダウンロード
  const blob = new Blob([r.csv], {type:"text/csv;charset=utf-8"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = r.filename || "export.csv";
  a.click();
  toast("CSV出力完了", true);
}

/***************
 * 管理者：ログイン&検索
 ***************/
function adminLogin(){
  const p = ($("adminPass")?.value||"").trim();
  if(p !== ADMIN_PASS){
    setAdmin(false); setAdminPass("");
    toast("管理者パスワードが違います");
    return;
  }
  setAdmin(true);
  setAdminPass(p);
  toast("管理者モードON", true);
  location.href = "./export.html";
}
function adminLogout(){
  setAdmin(false); setAdminPass("");
  toast("管理者モードOFF", true);
}

async function adminSearch(){
  const pass = getAdminPass();
  if(!isAdmin() || !pass){
    toast("管理者ログインが必要です");
    return;
  }
  const qName = ($("qName")?.value||"").trim();
  const qPhone = ($("qPhone")?.value||"").trim();
  const qVehicle = ($("qVehicle")?.value||"").trim();

  const r = await postJSON({action:"adminSearch", adminPass:pass, qName, qPhone, qVehicle});
  if(!r.ok) return toast(r.message || "検索失敗");

  const box = $("adminResult");
  if(!box) return;

  const items = r.items || [];
  box.innerHTML = items.length
    ? items.map(x => `<div class="row">
        <div><b>${escapeHtml(x.name)}</b> ${escapeHtml(x.date)} (${escapeHtml(x.type)})</div>
        <div class="muted">${escapeHtml(x.phone)} / ${escapeHtml(x.vehicle)}</div>
      </div>`).join("")
    : `<div class="muted">該当なし</div>`;
}

function escapeHtml(s){
  return String(s||"").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[m]));
}

/***************
 * ページ初期化
 ***************/
window.addEventListener("DOMContentLoaded", ()=>{
  const page = document.body?.dataset?.page || "";

  // 共通
  bindBack();

  // 出発/帰着
  if(page==="departure" || page==="arrival"){
    bindAutoCalcOdo();
    bindPersistName();
    if($("date") && !$("date").value) $("date").value = todayStr();
    if($("time") && !$("time").value) $("time").value = nowTimeStr();

    const type = page==="departure" ? "departure" : "arrival";
    const btn = $("btnSubmit");
    if(btn) btn.addEventListener("click", ()=> submitTenko(type));
  }

  // export（本人+管理者）
  if(page==="export"){
    const n = $("driverNameExport");
    if(n){
      n.value = localStorage.getItem("ofa_driver_name") || "";
      n.addEventListener("input", ()=> localStorage.setItem("ofa_driver_name", n.value));
    }

    // 管理者表示切替
    const adminBox = $("adminBox");
    const adminBadge = $("adminBadge");
    if(isAdmin()){
      adminBox && (adminBox.style.display="block");
      adminBadge && (adminBadge.textContent="管理者ON");
    }else{
      adminBox && (adminBox.style.display="none");
      adminBadge && (adminBadge.textContent="一般");
    }

    $("btnDailyPdf")?.addEventListener("click", driverDailyPdf);
    $("btnMonthlyCsv")?.addEventListener("click", driverMonthlyCsv);

    $("btnAdminSearch")?.addEventListener("click", adminSearch);
    $("btnAdminOff")?.addEventListener("click", adminLogout);
    $("btnGoAdmin")?.addEventListener("click", ()=> location.href="./admin.html");
  }

  // admin
  if(page==="admin"){
    $("btnAdminOn")?.addEventListener("click", adminLogin);
    $("btnAdminOff")?.addEventListener("click", adminLogout);
  }
});
