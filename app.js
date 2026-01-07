// app.js (module)
// ======================================================
// OFA Tenko Full App (Firebase Anonymous Auth + Firestore)
// ======================================================

import { firebaseConfig, DRIVER_PASS, ADMIN_PASS, BASES, JOBS } from "./config.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  limit
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ---------- utils ----------
const $ = (id) => document.getElementById(id);

function showErr(msg){
  const e = $("errBox"); const o = $("okBox");
  if(e){ e.style.display="block"; e.textContent = msg; }
  if(o){ o.style.display="none"; }
}
function showOk(msg){
  const e = $("errBox"); const o = $("okBox");
  if(o){ o.style.display="block"; o.textContent = msg; }
  if(e){ e.style.display="none"; }
  setTimeout(()=>{ if(o) o.style.display="none"; }, 2200);
}

function setDot(ok){
  const d1 = $("authDot"); const d2 = $("authDot2");
  [d1,d2].forEach(d=>{
    if(!d) return;
    d.classList.remove("ok","ng");
    d.classList.add(ok ? "ok":"ng");
  });
}

function todayISO(){
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  return `${yyyy}-${mm}-${dd}`;
}
function nowHHMM(){
  const d = new Date();
  const hh = String(d.getHours()).padStart(2,"0");
  const mi = String(d.getMinutes()).padStart(2,"0");
  return `${hh}:${mi}`;
}
function nowDateTimeLabel(){
  const d = new Date();
  return d.toLocaleString();
}
function monthISO(){
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  return `${yyyy}-${mm}`;
}

function clearInvalid(){
  document.querySelectorAll(".is-invalid").forEach(el=>el.classList.remove("is-invalid"));
}
function markInvalid(el){
  if(el) el.classList.add("is-invalid");
}

function requireValue(el, name){
  const v = (el?.value ?? "").toString().trim();
  if(!v){
    markInvalid(el);
    throw new Error(`${name} は必須です`);
  }
  return v;
}

function requireNumber(el, name){
  const v = (el?.value ?? "").toString().trim();
  if(v === ""){
    markInvalid(el);
    throw new Error(`${name} は必須です`);
  }
  const n = Number(v);
  if(Number.isNaN(n)){
    markInvalid(el);
    throw new Error(`${name} は数値で入力してください`);
  }
  return n;
}

function getCheckedValues(name){
  return Array.from(document.querySelectorAll(`input[name="${name}"]:checked`)).map(x=>x.value);
}

function fileToDataURL(file){
  return new Promise((resolve, reject)=>{
    const r = new FileReader();
    r.onload = ()=>resolve(String(r.result||""));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function setLoginUI(loggedIn){
  setDot(!!loggedIn);
  const s = $("authState");
  if(s) s.textContent = loggedIn ? "ログイン中" : "未ログイン";
}

function getGate(){
  return localStorage.getItem("ofa_gate") || "";
}
function setGate(role){
  localStorage.setItem("ofa_gate", role); // "driver" | "admin"
}
function clearGate(){
  localStorage.removeItem("ofa_gate");
  localStorage.removeItem("ofa_admin");
}
function isAdminMode(){
  return localStorage.getItem("ofa_admin")==="1";
}
function setAdminMode(on){
  localStorage.setItem("ofa_admin", on ? "1":"0");
}

// ---------- auth gate (front) ----------
async function ensureSignedIn(){
  // 共通パスでゲート通過してるか
  const gate = getGate();
  if(gate !== "driver" && gate !== "admin"){
    location.href = "./index.html";
    return null;
  }

  // Firebase auth
  const user = auth.currentUser;
  if(user) return user;

  const cred = await signInAnonymously(auth);
  return cred.user;
}

async function writeSession(user){
  const sref = doc(db, "sessions", user.uid);
  const gate = getGate();
  await setDoc(sref, {
    uid: user.uid,
    role: gate,
    userAgent: navigator.userAgent,
    updatedAt: serverTimestamp()
  }, { merge:true });
}

// ---------- data model helpers ----------
function buildCommonTenkoPayload(type){
  const date = todayISO();
  const month = date.slice(0,7);
  const uid = auth.currentUser?.uid || null;

  const driverName = requireValue($("driverName"), "氏名（本名）");
  const base = requireValue($("base"), "事業者/拠点");
  const vehicleNo = requireValue($("vehicleNo"), "車両番号（ナンバー）");
  const method = requireValue($("method"), "点呼実施方法");

  const odoStart = requireNumber($("odoStart"), "出発ODO");
  let odoEnd = 0;
  if(type === "end"){
    odoEnd = requireNumber($("odoEnd"), "帰着ODO");
  }else{
    // start は任意。入っていれば計算
    const v = ($("odoEnd")?.value||"").trim();
    odoEnd = v ? Number(v) : 0;
  }
  const odoDiff = (odoEnd && odoEnd >= odoStart) ? (odoEnd - odoStart) : 0;

  const sleepHours = requireNumber($("sleepHours"), "睡眠時間");
  const temp = requireNumber($("temp"), "体温");
  const condition = requireValue($("condition"), "体調");
  const fatigue = requireValue($("fatigue"), "疲労");
  const medicine = requireValue($("medicine"), "服薬/体調影響");
  const medicineNote = ($("medicineNote")?.value||"").trim();
  if(medicine === "あり" && !medicineNote){
    markInvalid($("medicineNote"));
    throw new Error("服薬内容（ありの場合）は必須です");
  }

  const drink = requireValue($("drink"), "飲酒の有無");
  const alcoholBand = requireValue($("alcoholBand"), "酒気帯び");
  const alcoholValue = requireNumber($("alcoholValue"), "アルコール数値");

  const jobs = getCheckedValues("jobs");
  if(!jobs.length){
    const box = $("jobsBox");
    if(box) box.style.outline = "3px solid rgba(239,68,68,.15)";
    throw new Error("稼働案件（1つ以上）は必須です");
  }

  const loadArea = requireValue($("loadArea"), "積込拠点/エリア");
  const danger = requireValue($("danger"), "危険物・高額品");

  const abnormal = requireValue($("abnormal"), "異常の有無");
  const abnormalNote = ($("abnormalNote")?.value||"").trim();
  if(abnormal === "あり" && !abnormalNote){
    markInvalid($("abnormalNote"));
    throw new Error("異常内容（ありの場合）は必須です");
  }

  const alcoholPhoto = $("alcoholPhoto")?.files?.[0] ? true : false;
  const abnormalPhoto = $("abnormalPhoto")?.files?.[0] ? true : false;

  return {
    uid,
    role: getGate(),
    type, // "start" | "end"
    date,
    month,
    datetimeLabel: nowDateTimeLabel(),

    driverName,
    base,
    vehicleNo,
    method,

    odoStart,
    odoEnd,
    odoDiff,

    sleepHours,
    temp,
    condition,
    fatigue,
    medicine,
    medicineNote: medicineNote || null,

    drink,
    alcoholBand,
    alcoholValue,
    alcoholPhoto, // boolean
    jobs,
    loadArea,
    danger,

    abnormal,
    abnormalNote: abnormalNote || null,
    abnormalPhoto, // boolean

    createdAt: serverTimestamp()
  };
}

// 車両点検（帰着のみフル）
function buildVehicleCheckPayload(){
  const ids = [
    ["chk_tirePressure","タイヤ空気圧"],
    ["chk_tireTread","タイヤ溝/ひび割れ"],
    ["chk_wheelNut","ホイールナット緩み"],
    ["chk_brake","ブレーキ効き"],
    ["chk_parking","パーキングブレーキ"],
    ["chk_handle","ハンドル操作"],
    ["chk_lights","ライト類"],
    ["chk_wiper","ワイパー/ウォッシャー"],
    ["chk_glass","ミラー/ガラス破損"],
    ["chk_oil","エンジンオイル量"],
    ["chk_coolant","冷却水"],
    ["chk_battery","バッテリー"],
    ["chk_noise","異音/異臭/振動"],
    ["chk_leak","漏れ（油/冷却水）"],
    ["chk_damage","外装破損"],
    ["chk_load","積載状態"],
    ["chk_ext","消火器"],
    ["chk_triangle","三角停止板"],
    ["chk_vest","反射ベスト"],
    ["chk_tools","ジャッキ/工具（任意）"],
  ];

  const checks = {};
  let hasNG = false;

  ids.forEach(([id,label])=>{
    const v = requireValue($(id), label);
    checks[id] = v;
    if(v === "NG") hasNG = true;
  });

  const checkNote = ($("checkNote")?.value||"").trim();
  const hasCheckPhoto = ($("checkPhoto")?.files?.length||0) > 0;

  if(hasNG && !checkNote){
    markInvalid($("checkNote"));
    throw new Error("点検NGがある場合、NG詳細メモは必須です");
  }

  // 写真は「必須推奨」なので、ここでは強制はしない（運用で推奨）
  return { checks, hasNG, checkNote: checkNote || null, hasCheckPhoto };
}

// 日報（帰着のみ）
function buildDailyPayload(common){
  const workStart = requireValue($("workStart"), "稼働時間（開始）");
  const workEnd = requireValue($("workEnd"), "稼働時間（終了）");
  const breakMin = requireNumber($("breakMin"), "休憩時間");

  const deliveryCount = requireNumber($("deliveryCount"), "配達個数");
  const absentCount = Number(($("absentCount")?.value||"0")||0);
  const redeliveryCount = Number(($("redeliveryCount")?.value||"0")||0);
  const returnCount = Number(($("returnCount")?.value||"0")||0);

  const complaint = requireValue($("complaint"), "クレーム");
  const complaintNote = ($("complaintNote")?.value||"").trim();
  if(complaint === "あり" && !complaintNote){
    markInvalid($("complaintNote"));
    throw new Error("クレーム内容（ありの場合）は必須です");
  }

  const payBase = requireNumber($("payBase"), "日当（固定報酬）");
  const payIncentive = Number(($("payIncentive")?.value||"0")||0);
  const costFuel = Number(($("costFuel")?.value||"0")||0);
  const costToll = Number(($("costToll")?.value||"0")||0);
  const costPark = Number(($("costPark")?.value||"0")||0);
  const costOther = Number(($("costOther")?.value||"0")||0);

  const profit = (payBase + payIncentive) - (costFuel + costToll + costPark + costOther);

  const delayReason = requireValue($("delayReason"), "遅延理由");
  const accident = requireValue($("accident"), "事故/物損");
  const accidentNote = ($("accidentNote")?.value||"").trim();
  if(accident === "あり" && !accidentNote){
    markInvalid($("accidentNote"));
    throw new Error("事故/物損内容（ありの場合）は必須です");
  }

  const tomorrowPlan = requireValue($("tomorrowPlan"), "明日の稼働予定");
  const dailyMemo = ($("dailyMemo")?.value||"").trim();

  const hasPhotos = ($("dailyPhotos")?.files?.length||0) > 0;

  // 月報集計用に「数値」だけ保存（写真本体は保存しない）
  return {
    uid: common.uid,
    role: common.role,
    date: common.date,
    month: common.month,
    driverName: common.driverName,
    base: common.base,
    vehicleNo: common.vehicleNo,
    jobs: common.jobs,
    loadArea: common.loadArea,
    odoDiff: common.odoDiff,

    workStart,
    workEnd,
    breakMin,

    deliveryCount,
    absentCount,
    redeliveryCount,
    returnCount,

    complaint,
    complaintNote: complaintNote || null,

    payBase,
    payIncentive,
    costFuel,
    costToll,
    costPark,
    costOther,
    profit,

    delayReason,
    accident,
    accidentNote: accidentNote || null,

    tomorrowPlan,
    dailyMemo: dailyMemo || null,

    hasPhotos,          // ✅ 月報に「有/無」だけ反映
    createdAt: serverTimestamp()
  };
}

// ---------- init selects ----------
function initBases(selectEl, includeAll=false){
  if(!selectEl) return;
  selectEl.innerHTML = includeAll
    ? `<option value="">（全て）</option>` + BASES.map(b=>`<option>${b}</option>`).join("")
    : `<option value="">選択</option>` + BASES.map(b=>`<option>${b}</option>`).join("");
}

function initJobs(box){
  if(!box) return;
  box.innerHTML = JOBS.map(j=>`
    <label style="display:flex;gap:8px;align-items:center;margin:8px 0;">
      <input type="checkbox" name="jobs" value="${j}" />
      <span>${j}</span>
    </label>
  `).join("");
}

// ---------- page inits ----------
async function initIndex(){
  const loginCard = $("loginCard");
  const menuCard = $("menuCard");
  const passEl = $("driverPass");

  const btnLogin = $("btnLogin");
  const btnLogout = $("btnLogout");

  function showLogin(){
    if(loginCard) loginCard.classList.remove("hidden");
    if(menuCard) menuCard.classList.add("hidden");
    setLoginUI(false);
  }
  function showMenu(){
    if(loginCard) loginCard.classList.add("hidden");
    if(menuCard) menuCard.classList.remove("hidden");
    setLoginUI(true);
  }

  // 既にゲート通過ならそのまま匿名ログイン
  if(getGate()){
    try{
      const u = await ensureSignedIn();
      await writeSession(u);
      showMenu();
      const whoText = $("whoText");
      if(whoText) whoText.textContent = `ログイン中（UID: ${u.uid.slice(0,6)}…）`;
    }catch(e){
      showLogin();
    }
  }else{
    showLogin();
  }

  btnLogin?.addEventListener("click", async ()=>{
    try{
      clearInvalid();
      const p = requireValue(passEl, "共通ログインパスワード");
      if(p !== DRIVER_PASS){
        markInvalid(passEl);
        throw new Error("パスワードが違います（社内LINEの最新パスを確認）");
      }
      setGate("driver");
      const u = await ensureSignedIn();
      await writeSession(u);
      showOk("ログインしました");
      showMenu();
      const whoText = $("whoText");
      if(whoText) whoText.textContent = `ログイン中（UID: ${u.uid.slice(0,6)}…）`;
    }catch(e){
      showErr(e.message || String(e));
    }
  });

  btnLogout?.addEventListener("click", async ()=>{
    try{
      await signOut(auth);
    }catch(e){}
    clearGate();
    showOk("ログアウトしました");
    showLogin();
  });
}

async function guardAndCommonUI(){
  const u = await ensureSignedIn();
  if(!u) return null;
  await writeSession(u);
  setLoginUI(true);
  return u;
}

function bindBackBtn(){
  const b = $("backBtn");
  if(!b) return;
  b.addEventListener("click", ()=>{
    location.href = "./index.html";
  });
}

function bindOdoAuto(){
  const s = $("odoStart");
  const e = $("odoEnd");
  const d = $("odoDiff");
  if(!s || !e || !d) return;
  const calc = ()=>{
    const a = Number((s.value||"").trim());
    const b = Number((e.value||"").trim());
    if(!Number.isNaN(a) && !Number.isNaN(b) && b >= a){
      d.value = String(b - a);
    }else{
      d.value = "";
    }
  };
  s.addEventListener("input", calc);
  e.addEventListener("input", calc);
}

function bindProfitAuto(){
  const ids = ["payBase","payIncentive","costFuel","costToll","costPark","costOther"];
  const profit = $("profit");
  if(!profit) return;
  const calc = ()=>{
    const get = (id)=> Number(($(`${id}`)?.value||"0")||0);
    const p = get("payBase")+get("payIncentive")-(get("costFuel")+get("costToll")+get("costPark")+get("costOther"));
    profit.value = Number.isFinite(p) ? String(p) : "";
  };
  ids.forEach(id=>{
    const el = $(id);
    if(el) el.addEventListener("input", calc);
  });
  calc();
}

async function initDeparture(){
  const u = await guardAndCommonUI();
  if(!u) return;
  bindBackBtn();
  initBases($("base"));
  initJobs($("jobsBox"));
  bindOdoAuto();
  $("datetime").value = nowDateTimeLabel();

  const btn = $("btnSubmit");
  btn?.addEventListener("click", async ()=>{
    try{
      clearInvalid();
      showErr(""); $("errBox").style.display="none";

      // common payload (start)
      const payload = buildCommonTenkoPayload("start");

      // 保存ID： date + uid + type
      const id = `${payload.date}_${u.uid}_start`;
      await setDoc(doc(db, "tenko", id), payload, { merge:true });

      showOk("出発点呼を保存しました");
      setTimeout(()=>location.href="./index.html", 700);
    }catch(e){
      showErr(e.message || String(e));
    }
  });
}

async function initArrival(){
  const u = await guardAndCommonUI();
  if(!u) return;
  bindBackBtn();
  initBases($("base"));
  initJobs($("jobsBox"));
  bindOdoAuto();
  bindProfitAuto();
  $("datetime").value = nowDateTimeLabel();

  const btn = $("btnSubmit");
  btn?.addEventListener("click", async ()=>{
    try{
      clearInvalid();
      showErr(""); $("errBox").style.display="none";

      // common payload (end)
      const common = buildCommonTenkoPayload("end");

      // 免許番号必須
      const licenseNo = requireValue($("licenseNo"), "免許証番号");
      common.licenseNo = licenseNo;
      common.licenseHasPhoto = $("licensePhoto")?.files?.[0] ? true : false;

      // 車両点検（フル）
      const vc = buildVehicleCheckPayload();

      // 日報（数値保存）
      const daily = buildDailyPayload(common);

      // 点検NG時の写真推奨：ここでは強制しない（運用で）
      // daily写真は保存しない（hasPhotosだけ保存）
      const hasDailyPhotos = ($("dailyPhotos")?.files?.length||0) > 0;
      daily.hasPhotos = hasDailyPhotos;

      // 保存（tenko + daily）
      const tenkoId = `${common.date}_${u.uid}_end`;
      const dailyId = `${common.date}_${u.uid}`;

      await setDoc(doc(db, "tenko", tenkoId), { ...common, vehicleCheck: vc }, { merge:true });
      await setDoc(doc(db, "daily", dailyId), daily, { merge:true });

      showOk("帰着点呼＋日報を保存しました（写真はPDF用）");
      setTimeout(()=>location.href="./index.html", 900);
    }catch(e){
      showErr(e.message || String(e));
    }
  });
}

// ---------- export: fetch + PDF/CSV ----------
function setModeLabel(){
  const m = $("modeLabel");
  if(!m) return;
  m.textContent = isAdminMode() ? "管理者" : "ドライバー";
}

async function initExport(){
  const u = await guardAndCommonUI();
  if(!u) return;

  bindBackBtn();
  setModeLabel();

  // defaults
  if($("dateDaily")) $("dateDaily").value = todayISO();
  if($("month")) $("month").value = monthISO();
  if($("fromDate")) $("fromDate").value = todayISO();
  if($("toDate")) $("toDate").value = todayISO();

  // admin search base list
  initBases($("qBase"), true);

  const adminBox = $("adminSearchBox");
  const btnOn = $("btnAdminOn");
  const btnOff = $("btnAdminOff");

  btnOn?.addEventListener("click", ()=>{
    try{
      clearInvalid();
      const v = ($("adminPass")?.value||"").trim();
      if(!v){
        markInvalid($("adminPass"));
        throw new Error("管理者パスワードを入力してください");
      }
      if(v !== ADMIN_PASS){
        markInvalid($("adminPass"));
        setAdminMode(false);
        setModeLabel();
        adminBox?.classList.add("hidden");
        throw new Error("管理者パスワードが違います");
      }
      setAdminMode(true);
      setModeLabel();
      adminBox?.classList.remove("hidden");
      showOk("管理者モードON");
    }catch(e){
      showErr(e.message || String(e));
    }
  });

  btnOff?.addEventListener("click", ()=>{
    setAdminMode(false);
    setModeLabel();
    adminBox?.classList.add("hidden");
    if($("adminPass")) $("adminPass").value="";
    showOk("管理者モードOFF");
  });

  // helpers
  async function fetchTenkoForDate(date){
    // start/end 2件
    const startId = `${date}_${u.uid}_start`;
    const endId   = `${date}_${u.uid}_end`;

    // admin: 全員検索する場合は dailyから探すのが早いが、日報PDFは基本本人で良い
    const s = await getDoc(doc(db, "tenko", startId));
    const e = await getDoc(doc(db, "tenko", endId));
    return {
      start: s.exists() ? s.data() : null,
      end: e.exists() ? e.data() : null
    };
  }

  async function fetchDailyForDate(date){
    const id = `${date}_${u.uid}`;
    const d = await getDoc(doc(db, "daily", id));
    return d.exists() ? d.data() : null;
  }

  function csvEscape(v){
    const s = String(v ?? "");
    if(/[",\n]/.test(s)) return `"${s.replace(/"/g,'""')}"`;
    return s;
  }

  function downloadBlob(filename, blob){
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 2000);
  }

  async function makeDailyPdf(date){
    const tenko = await fetchTenkoForDate(date);
    const daily = await fetchDailyForDate(date);

    if(!tenko.start && !tenko.end && !daily){
      throw new Error("その日付のデータが見つかりません（点呼/日報）");
    }

    // 写真：この画面では保持してないので、PDFは「データ中心」でカラー付き作成
    // 日報写真を載せたい場合は、日報入力時にPDF生成機能を追加するのが確実（次の拡張で入れられる）
    const { jsPDF } = window.jspdf;
    const docPdf = new jsPDF({ unit:"mm", format:"a4" });
    const w = docPdf.internal.pageSize.getWidth();

    // header color bar
    docPdf.setFillColor(246,199,0);
    docPdf.rect(0, 0, w, 18, "F");
    docPdf.setTextColor(26,20,0);
    docPdf.setFontSize(14);
    docPdf.text(`OFA 日報PDF（${date}）`, 14, 12);

    docPdf.setTextColor(0,0,0);
    docPdf.setFontSize(10);

    let y = 26;
    const line = (label, value)=>{
      docPdf.text(`${label}: ${value ?? "-"}`, 14, y);
      y += 6;
      if(y > 280){ docPdf.addPage(); y = 20; }
    };

    line("氏名", daily?.driverName || tenko.end?.driverName || tenko.start?.driverName);
    line("拠点", daily?.base || tenko.end?.base || tenko.start?.base);
    line("車両", daily?.vehicleNo || tenko.end?.vehicleNo || tenko.start?.vehicleNo);

    docPdf.setDrawColor(0,0,0);
    docPdf.setLineWidth(0.2);
    docPdf.line(14, y, w-14, y); y+=7;

    // tenko
    line("出発点呼", tenko.start ? "あり" : "なし");
    line("帰着点呼", tenko.end ? "あり" : "なし");
    line("ODO差分", tenko.end?.odoDiff ?? tenko.start?.odoDiff ?? "-");
    line("アルコール数値", tenko.end?.alcoholValue ?? tenko.start?.alcoholValue ?? "-");
    line("酒気帯び", tenko.end?.alcoholBand ?? tenko.start?.alcoholBand ?? "-");

    docPdf.line(14, y, w-14, y); y+=7;

    // daily numbers
    if(daily){
      line("稼働時間", `${daily.workStart} - ${daily.workEnd}`);
      line("休憩（分）", daily.breakMin);
      line("配達個数", daily.deliveryCount);
      line("不在数", daily.absentCount);
      line("再配達数", daily.redeliveryCount);
      line("返品/持戻り", daily.returnCount);
      line("クレーム", daily.complaint === "あり" ? `あり（${daily.complaintNote||""}）` : "なし");

      docPdf.line(14, y, w-14, y); y+=7;

      line("日当", daily.payBase);
      line("インセンティブ", daily.payIncentive);
      line("経費（燃料/高速/駐車/その他）", `${daily.costFuel}/${daily.costToll}/${daily.costPark}/${daily.costOther}`);
      line("概算利益", daily.profit);

      docPdf.line(14, y, w-14, y); y+=7;

      line("遅延理由", daily.delayReason);
      line("事故/物損", daily.accident === "あり" ? `あり（${daily.accidentNote||""}）` : "なし");
      line("明日の稼働予定", daily.tomorrowPlan);
      line("メモ", daily.dailyMemo || "-");
      line("写真", daily.hasPhotos ? "あり" : "なし");
    }else{
      line("日報", "日報データなし");
    }

    docPdf.save(`OFA_Daily_${date}.pdf`);
    return true;
  }

  async function fetchDailyRange(from, to){
    // driver: uid固定 / admin: 条件検索可能
    const isAdmin = isAdminMode();

    let qBase = $("qBase")?.value || "";
    let qName = ($("qName")?.value||"").trim();
    let qVehicle = ($("qVehicle")?.value||"").trim();

    // Firestoreは部分一致ができないので、ここは「保存後にフロントでフィルタ」方式にする
    // まず範囲で取ってから絞る（運用上問題なし）
    let qRef = query(
      collection(db, "daily"),
      orderBy("date","asc"),
      where("date", ">=", from),
      where("date", "<=", to),
      ...(isAdmin ? [] : [where("uid","==", auth.currentUser.uid)])
    );

    const snap = await getDocs(qRef);
    let rows = [];
    snap.forEach(d=>rows.push(d.data()));

    if(isAdmin){
      if(qBase) rows = rows.filter(r=>r.base===qBase);
      if(qName) rows = rows.filter(r=>(r.driverName||"").includes(qName));
      if(qVehicle) rows = rows.filter(r=>(r.vehicleNo||"").includes(qVehicle));
    }

    return rows;
  }

  function sum(arr, key){
    return arr.reduce((a,r)=>a + Number(r[key]||0), 0);
  }

  function timeDiffMinutes(start, end){
    // "HH:MM"
    if(!start || !end) return 0;
    const [sh,sm]=start.split(":").map(Number);
    const [eh,em]=end.split(":").map(Number);
    if([sh,sm,eh,em].some(n=>Number.isNaN(n))) return 0;
    let s = sh*60+sm;
    let e = eh*60+em;
    if(e < s) e += 24*60; // crossing midnight
    return e - s;
  }

  async function makeMonthlyPdf(month){
    const from = `${month}-01`;
    const to = `${month}-31`;
    const rows = await fetchDailyRange(from, to);

    if(rows.length === 0) throw new Error("対象月のデータがありません");

    const days = rows.length;
    const totalWorkMin = rows.reduce((a,r)=>a + timeDiffMinutes(r.workStart,r.workEnd), 0);
    const totalBreakMin = sum(rows,"breakMin");
    const totalOdo = sum(rows,"odoDiff");
    const totalDelivery = sum(rows,"deliveryCount");
    const totalAbsent = sum(rows,"absentCount");
    const totalRedelivery = sum(rows,"redeliveryCount");
    const totalReturn = sum(rows,"returnCount");

    const complaintCount = rows.filter(r=>r.complaint==="あり").length;
    const accidentCount = rows.filter(r=>r.accident==="あり").length;

    const totalPay = sum(rows,"payBase")+sum(rows,"payIncentive");
    const totalCost = sum(rows,"costFuel")+sum(rows,"costToll")+sum(rows,"costPark")+sum(rows,"costOther");
    const totalProfit = sum(rows,"profit");

    const photoYes = rows.filter(r=>r.hasPhotos).length;

    const { jsPDF } = window.jspdf;
    const docPdf = new jsPDF({ unit:"mm", format:"a4" });
    const w = docPdf.internal.pageSize.getWidth();

    docPdf.setFillColor(246,199,0);
    docPdf.rect(0, 0, w, 18, "F");
    docPdf.setTextColor(26,20,0);
    docPdf.setFontSize(14);
    docPdf.text(`OFA 月報PDF（${month}）`, 14, 12);

    docPdf.setTextColor(0,0,0);
    docPdf.setFontSize(10);

    let y=26;
    const line=(k,v)=>{
      docPdf.text(`${k}: ${v}`, 14, y);
      y+=6;
      if(y>280){ docPdf.addPage(); y=20; }
    };

    line("稼働日数", days);
    line("総稼働時間（分）", totalWorkMin);
    line("総休憩（分）", totalBreakMin);
    line("総走行距離", totalOdo);
    line("総配達個数", totalDelivery);
    line("1日平均配達個数", (totalDelivery/days).toFixed(1));
    line("不在数（合計）", totalAbsent);
    line("再配達数（合計）", totalRedelivery);
    line("返品/持戻り（合計）", totalReturn);
    line("クレーム件数", complaintCount);
    line("事故件数", accidentCount);
    line("売上合計（総報酬）", totalPay);
    line("経費合計", totalCost);
    line("概算利益", totalProfit);
    line("日報写真（有）件数", photoYes);

    // 明細（最大 25行/ページ）
    y += 4;
    docPdf.setDrawColor(0,0,0);
    docPdf.line(14, y, w-14, y); y+=6;
    docPdf.setFontSize(9);
    docPdf.text("日付 / 氏名 / 拠点 / 配達 / 走行 / 休憩 / 売上 / 利益 / 写真", 14, y); y+=6;
    docPdf.line(14, y, w-14, y); y+=6;

    for(const r of rows){
      const row = `${r.date} / ${r.driverName} / ${r.base} / ${r.deliveryCount} / ${r.odoDiff} / ${r.breakMin} / ${Number(r.payBase||0)+Number(r.payIncentive||0)} / ${r.profit} / ${r.hasPhotos?"有":"無"}`;
      docPdf.text(row, 14, y);
      y+=5;
      if(y>280){ docPdf.addPage(); y=20; }
    }

    docPdf.save(`OFA_Monthly_${month}.pdf`);
  }

  async function makeMonthlyCsv(month){
    const from = `${month}-01`;
    const to = `${month}-31`;
    const rows = await fetchDailyRange(from, to);
    if(rows.length===0) throw new Error("対象月のデータがありません");

    const header = [
      "date","driverName","base","vehicleNo","jobs","loadArea",
      "workStart","workEnd","breakMin",
      "odoDiff",
      "deliveryCount","absentCount","redeliveryCount","returnCount",
      "complaint","complaintNote",
      "payBase","payIncentive","costFuel","costToll","costPark","costOther","profit",
      "delayReason","accident","accidentNote","tomorrowPlan",
      "hasPhotos"
    ];

    const lines = [];
    lines.push(header.join(","));
    for(const r of rows){
      const row = header.map(k=>{
        const v = k==="jobs" ? (Array.isArray(r.jobs)? r.jobs.join("|") : "") : (r[k] ?? "");
        return csvEscape(v);
      }).join(",");
      lines.push(row);
    }
    const blob = new Blob([lines.join("\n")], { type:"text/csv;charset=utf-8" });
    downloadBlob(`OFA_Monthly_${month}.csv`, blob);
  }

  async function makeRangeCsv(from, to){
    if(!from || !to) throw new Error("開始日・終了日を入力してください");
    if(from > to) throw new Error("開始日が終了日より後です");

    const rows = await fetchDailyRange(from, to);
    if(rows.length===0) throw new Error("対象期間のデータがありません");

    const header = [
      "date","driverName","base","vehicleNo","jobs","loadArea",
      "workStart","workEnd","breakMin",
      "odoDiff","deliveryCount","profit","hasPhotos"
    ];

    const lines = [];
    lines.push(header.join(","));
    for(const r of rows){
      const row = header.map(k=>{
        const v = k==="jobs" ? (Array.isArray(r.jobs)? r.jobs.join("|") : "") : (r[k] ?? "");
        return csvEscape(v);
      }).join(",");
      lines.push(row);
    }
    const blob = new Blob([lines.join("\n")], { type:"text/csv;charset=utf-8" });
    downloadBlob(`OFA_Range_${from}_${to}.csv`, blob);
  }

  // buttons
  $("btnDailyPdf")?.addEventListener("click", async ()=>{
    try{
      const date = $("dateDaily")?.value || "";
      if(!date) throw new Error("日付を入力してください");
      showOk("PDF作成中…");
      await makeDailyPdf(date);
      $("resultBox").textContent = `✅ 日報PDFを作成しました：${date}`;
    }catch(e){
      showErr(e.message || String(e));
    }
  });

  $("btnMonthlyPdf")?.addEventListener("click", async ()=>{
    try{
      const m = ($("month")?.value||"").trim();
      if(!m) throw new Error("月を入力してください");
      showOk("月報PDF作成中…");
      await makeMonthlyPdf(m);
      $("resultBox").textContent = `✅ 月報PDFを作成しました：${m}`;
    }catch(e){
      showErr(e.message || String(e));
    }
  });

  $("btnMonthlyCsv")?.addEventListener("click", async ()=>{
    try{
      const m = ($("month")?.value||"").trim();
      if(!m) throw new Error("月を入力してください");
      showOk("月次CSV作成中…");
      await makeMonthlyCsv(m);
      $("resultBox").textContent = `✅ 月次CSVを作成しました：${m}`;
    }catch(e){
      showErr(e.message || String(e));
    }
  });

  $("btnRangeCsv")?.addEventListener("click", async ()=>{
    try{
      const from = ($("fromDate")?.value||"").trim();
      const to = ($("toDate")?.value||"").trim();
      showOk("範囲CSV作成中…");
      await makeRangeCsv(from, to);
      $("resultBox").textContent = `✅ 範囲CSVを作成しました：${from}〜${to}`;
    }catch(e){
      showErr(e.message || String(e));
    }
  });
}

// ---------- boot ----------
window.addEventListener("DOMContentLoaded", async ()=>{
  const page = document.body?.dataset?.page || "";

  // auth state indicator (optional)
  onAuthStateChanged(auth, (user)=>{
    setLoginUI(!!user);
  });

  try{
    if(page === "index") return await initIndex();
    if(page === "departure") return await initDeparture();
    if(page === "arrival") return await initArrival();
    if(page === "export") return await initExport();
  }catch(e){
    // 最低限の保険
    console.error(e);
    const err = e?.message || String(e);
    if($("errBox")) showErr(err);
    else alert(err);
  }
});
