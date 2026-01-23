// js/app.js
// OFA 点呼 / 日報（IndexedDB）
// - 出発点呼と帰着点呼を完全分離（同時ODO入力しない）
// - 日報/売上はオプション（未入力OK）
// - 写真は保存しない（PDF生成時だけFileを渡す）
// - 履歴保存＆履歴表示
// - PDF（OFAフォーマット/文字化け対策: HTML→Canvas→PDF）
// - CSV（期間検索ワンクリック）
// 依存: js/db.js, js/pdf.js, js/csv.js

// ===== Helpers =====
const $ = (id) => document.getElementById(id);

function nowId(prefix="id"){
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}
function normalizeDTLocal(v){ // "2026-01-23T08:10" -> same
  return (v||"").trim();
}
function normalizeDateOnly(v){ // "2026-01-23" or dt -> "2026-01-23"
  if(!v) return "";
  return String(v).slice(0,10);
}
function isEmpty(v){ return (v===undefined||v===null||String(v).trim()===""); }
function numOrEmpty(v){
  if(isEmpty(v)) return "";
  const n = Number(v);
  return Number.isFinite(n) ? n : "";
}
function numOrZero(v){
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function requiredAlert(msg){
  alert(msg);
  throw new Error(msg);
}

// ===== Checklist Master (フル) =====
const CHECK_ITEMS = [
  // A. 安全走行に直結
  { key:"tirePressure", label:"タイヤ空気圧" },
  { key:"tireTread", label:"タイヤ溝/ひび割れ" },
  { key:"wheelNut", label:"ホイールナット緩み" },
  { key:"brake", label:"ブレーキ効き" },
  { key:"parkingBrake", label:"パーキングブレーキ" },
  { key:"steering", label:"ハンドル操作" },
  { key:"lights", label:"ライト（前照灯/尾灯/ブレーキ/ウインカー/ハザード）" },
  { key:"wiper", label:"ワイパー/ウォッシャー液" },
  { key:"mirrorGlass", label:"ミラー/ガラス破損" },
  // B. 車両状態
  { key:"engineOil", label:"エンジンオイル量" },
  { key:"coolant", label:"冷却水" },
  { key:"battery", label:"バッテリー（警告灯含む）" },
  { key:"noiseSmell", label:"異音/異臭/異常振動" },
  { key:"leak", label:"漏れ（オイル/冷却水）" },
  { key:"bodyDamage", label:"外装破損" },
  { key:"loadState", label:"積載状態（偏り/過積載なし）" },
  // C. 装備
  { key:"fireExt", label:"消火器" },
  { key:"triangle", label:"三角停止板" },
  { key:"reflectVest", label:"反射ベスト" },
  { key:"jackTools", label:"ジャッキ/工具（任意でもOK）" },
];

// ===== Projects UI (複数案件) =====
function projectRowHtml(prefix, idx){
  return `
    <div class="projRow" data-idx="${idx}">
      <div class="row">
        <div>
          <label>案件名*</label>
          <input class="p_projName" placeholder="例：Amazon / ヤマト / スポット" />
        </div>
        <div>
          <label>エリア/コース</label>
          <input class="p_projArea" placeholder="例：姶良 / 福岡南" />
        </div>
      </div>
      <div class="row">
        <div>
          <label>メモ</label>
          <input class="p_projMemo" placeholder="例：積込 7:30 / 200個" />
        </div>
        <div style="display:flex;align-items:flex-end">
          <button class="btn secondary p_removeBtn" type="button">削除</button>
        </div>
      </div>
      <div class="divider"></div>
    </div>
  `;
}

function ensureAtLeastOneProject(containerId){
  const box = $(containerId);
  if(!box) return;
  if(box.querySelectorAll(".projRow").length === 0){
    box.insertAdjacentHTML("beforeend", projectRowHtml(containerId, 0));
    bindProjectRowRemove(box);
  }
}
function bindProjectRowRemove(box){
  box.querySelectorAll(".p_removeBtn").forEach(btn=>{
    if(btn.dataset.bound) return;
    btn.dataset.bound = "1";
    btn.addEventListener("click", ()=>{
      const row = btn.closest(".projRow");
      if(row) row.remove();
      // 1つは残す
      if(box.querySelectorAll(".projRow").length === 0){
        box.insertAdjacentHTML("beforeend", projectRowHtml(box.id, 0));
        bindProjectRowRemove(box);
      }
    });
  });
}

function collectProjects(containerId){
  const box = $(containerId);
  const rows = Array.from(box.querySelectorAll(".projRow"));
  const projects = [];
  for(const r of rows){
    const name = (r.querySelector(".p_projName")?.value || "").trim();
    const area = (r.querySelector(".p_projArea")?.value || "").trim();
    const memo = (r.querySelector(".p_projMemo")?.value || "").trim();
    if(!name) continue; // 空は無視（ただし最低1つ必須チェックは別で）
    projects.push({ name, area, memo });
  }
  return projects;
}

function requireProjectsAtLeastOne(containerId){
  const projects = collectProjects(containerId);
  if(projects.length === 0) requiredAlert("稼働案件は最低1つ入力してください。");
  return projects;
}

// ===== Checklist UI =====
function renderChecklist(){
  const box = $("checklistBox");
  if(!box) return;

  // スクロール入力（OK/NGの切替）
  let html = `
    <div class="checkHeader">
      <div class="checkCol item">項目</div>
      <div class="checkCol ok">OK</div>
      <div class="checkCol ng">NG</div>
    </div>
  `;

  for(const item of CHECK_ITEMS){
    html += `
      <div class="checkRow" data-key="${item.key}">
        <div class="checkCol item">${item.label}</div>
        <div class="checkCol ok">
          <input type="radio" name="chk_${item.key}" value="OK">
        </div>
        <div class="checkCol ng">
          <input type="radio" name="chk_${item.key}" value="NG">
        </div>
      </div>
    `;
  }
  box.innerHTML = html;

  // 初期は全部OKにしておく（入力負担軽減）
  for(const item of CHECK_ITEMS){
    const ok = box.querySelector(`input[name="chk_${item.key}"][value="OK"]`);
    if(ok) ok.checked = true;
  }
}

function collectChecklist(){
  const box = $("checklistBox");
  const list = [];
  for(const item of CHECK_ITEMS){
    const val = box.querySelector(`input[name="chk_${item.key}"]:checked`)?.value || "";
    const ok = (val === "OK");
    list.push({ key:item.key, label:item.label, ok });
  }
  return list;
}

function hasAnyNg(checklist){
  return (checklist || []).some(x => x.ok === false);
}

// ===== Profile =====
async function saveProfile(){
  const name = ($("p_name").value||"").trim();
  const base = ($("p_base").value||"").trim();
  const carNo = ($("p_carNo").value||"").trim();
  const licenseNo = ($("p_licenseNo").value||"").trim();
  const phone = ($("p_phone").value||"").trim();
  const email = ($("p_email").value||"").trim();

  if(!name) requiredAlert("氏名（本名）は必須です。");
  if(!base) requiredAlert("拠点は必須です。");
  if(!carNo) requiredAlert("車両番号（ナンバー）は必須です。");
  if(!licenseNo) requiredAlert("運転免許証番号は必須です。");
  if(!phone) requiredAlert("電話番号は必須です。");
  if(!email) requiredAlert("メールアドレスは必須です。");

  const profile = {
    id: "me",
    name, base, carNo, licenseNo, phone, email,
    updatedAt: new Date().toISOString()
  };
  await idbPut(STORE_PROFILE, profile);
  alert("基本情報を保存しました。");
}

async function loadProfile(){
  const profile = await idbGet(STORE_PROFILE, "me");
  if(!profile){
    alert("まだ基本情報が保存されていません。");
    return null;
  }
  $("p_name").value = profile.name || "";
  $("p_base").value = profile.base || "";
  $("p_carNo").value = profile.carNo || "";
  $("p_licenseNo").value = profile.licenseNo || "";
  $("p_phone").value = profile.phone || "";
  $("p_email").value = profile.email || "";
  return profile;
}

async function requireProfile(){
  const p = await idbGet(STORE_PROFILE, "me");
  if(!p){
    requiredAlert("まず「基本情報（必須）」を保存してください。");
  }
  // 必須漏れ防止（過去データの穴も拾う）
  const must = ["name","base","carNo","licenseNo","phone","email"];
  for(const k of must){
    if(isEmpty(p[k])) requiredAlert(`基本情報の必須項目が不足しています：${k}`);
  }
  return p;
}

// ===== Save Departure Tenko =====
async function saveDeparture(){
  const profile = await requireProfile();

  const at = normalizeDTLocal($("dep_at").value);
  const method = ($("dep_method").value||"").trim();
  const sleep = ($("dep_sleep").value||"").trim();
  const temp = ($("dep_temp").value||"").trim();
  const condition = ($("dep_condition").value||"").trim();
  const fatigue = ($("dep_fatigue").value||"").trim();
  const med = ($("dep_med").value||"").trim();
  const medDetail = ($("dep_medDetail").value||"").trim();
  const drink = ($("dep_drink").value||"").trim();
  const alcBand = ($("dep_alcBand").value||"").trim();
  const alcValue = ($("dep_alcValue").value||"").trim();
  const alcJudge = ($("dep_alcJudge").value||"").trim();
  const odoStart = ($("dep_odoStart").value||"").trim();
  const area = ($("dep_area").value||"").trim();
  const risky = ($("dep_risky").value||"").trim();
  const abnormal = ($("dep_abnormal").value||"").trim();
  const abnormalDetail = ($("dep_abnormalDetail").value||"").trim();

  if(!at) requiredAlert("出発点呼：点呼日時は必須です。");
  if(!method) requiredAlert("出発点呼：点呼実施方法は必須です。");
  if(isEmpty(sleep)) requiredAlert("出発点呼：睡眠時間は必須です。");
  if(isEmpty(temp)) requiredAlert("出発点呼：体温は必須です。");
  if(!condition) requiredAlert("出発点呼：体調は必須です。");
  if(!fatigue) requiredAlert("出発点呼：疲労は必須です。");
  if(!med) requiredAlert("出発点呼：服薬は必須です。");
  if(med === "あり" && !medDetail) requiredAlert("出発点呼：服薬が「あり」の場合、服薬内容は必須です。");
  if(!drink) requiredAlert("出発点呼：飲酒の有無は必須です。");
  if(!alcBand) requiredAlert("出発点呼：酒気帯びは必須です。");
  if(isEmpty(alcValue)) requiredAlert("出発点呼：アルコール数値は必須です。");
  if(!alcJudge) requiredAlert("出発点呼：アルコール判定は必須です。");
  if(isEmpty(odoStart)) requiredAlert("出発点呼：出発ODOは必須です。");
  if(!area) requiredAlert("出発点呼：積込拠点/エリアは必須です。");
  if(!risky) requiredAlert("出発点呼：危険物・高額品の有無は必須です。");
  if(!abnormal) requiredAlert("出発点呼：異常申告は必須です。");
  if(abnormal === "あり" && !abnormalDetail) requiredAlert("出発点呼：異常が「あり」の場合、異常内容は必須です。");

  const projects = requireProjectsAtLeastOne("dep_projects");

  // Files (not saved) — stored only in memory for PDF generation later
  const files = {
    licenseImg: $("p_licenseImg").files?.[0] || null,
    alcDepImg: $("dep_alcImg").files?.[0] || null,
    abnormalDepImg: $("dep_abnormalImg").files?.[0] || null
  };
  // keep in window memory
  window.__ofaFiles = window.__ofaFiles || {};
  window.__ofaFiles.licenseImg = files.licenseImg || window.__ofaFiles.licenseImg || null;
  window.__ofaFiles.alcDepImg = files.alcDepImg || null;
  window.__ofaFiles.abnormalDepImg = files.abnormalDepImg || null;

  const rec = {
    id: nowId("tenko"),
    type: "departure",
    at,
    date: normalizeDateOnly(at),

    // profile snapshot
    name: profile.name,
    base: profile.base,
    carNo: profile.carNo,
    licenseNo: profile.licenseNo,
    phone: profile.phone,
    email: profile.email,

    method,
    sleep,
    temp,
    condition,
    fatigue,
    med,
    medDetail: (med==="あり"?medDetail:""),
    drink,
    alcBand,
    alcValue,
    alcJudge,
    odoStart: numOrEmpty(odoStart),
    odoEnd: "",
    odoDiff: "",

    projects,
    area,
    risky,

    abnormal,
    abnormalDetail,

    // checklist is saved at arrival time (but to keep CSV consistent, we set empty now)
    checklist: [],
    checkMemo: "",

    createdAt: new Date().toISOString(),
  };

  await idbPut(STORE_TENKO, rec);

  alert("出発点呼を保存しました。");
  // optional: keep fields as-is (現場だと戻って確認したい)
}

// ===== Save Arrival Tenko + Daily Check =====
async function saveArrival(){
  const profile = await requireProfile();

  const at = normalizeDTLocal($("arr_at").value);
  const method = ($("arr_method").value||"").trim();
  const breakMin = ($("arr_break").value||"").trim();
  const temp = ($("arr_temp").value||"").trim();
  const condition = ($("arr_condition").value||"").trim();
  const fatigue = ($("arr_fatigue").value||"").trim();
  const med = ($("arr_med").value||"").trim();
  const medDetail = ($("arr_medDetail").value||"").trim();
  const drink = ($("arr_drink").value||"").trim();
  const alcBand = ($("arr_alcBand").value||"").trim();
  const alcValue = ($("arr_alcValue").value||"").trim();
  const alcJudge = ($("arr_alcJudge").value||"").trim();
  const odoEnd = ($("arr_odoEnd").value||"").trim();

  const abnormal = ($("arr_abnormal").value||"").trim();
  const abnormalDetail = ($("arr_abnormalDetail").value||"").trim();

  if(!at) requiredAlert("帰着点呼：点呼日時は必須です。");
  if(!method) requiredAlert("帰着点呼：点呼実施方法は必須です。");
  if(isEmpty(breakMin)) requiredAlert("帰着点呼：休憩時間（分）は必須です。");
  if(isEmpty(temp)) requiredAlert("帰着点呼：体温は必須です。");
  if(!condition) requiredAlert("帰着点呼：体調は必須です。");
  if(!fatigue) requiredAlert("帰着点呼：疲労は必須です。");
  if(!med) requiredAlert("帰着点呼：服薬は必須です。");
  if(med === "あり" && !medDetail) requiredAlert("帰着点呼：服薬が「あり」の場合、服薬内容は必須です。");
  if(!drink) requiredAlert("帰着点呼：飲酒の有無は必須です。");
  if(!alcBand) requiredAlert("帰着点呼：酒気帯びは必須です。");
  if(isEmpty(alcValue)) requiredAlert("帰着点呼：アルコール数値は必須です。");
  if(!alcJudge) requiredAlert("帰着点呼：アルコール判定は必須です。");
  if(isEmpty(odoEnd)) requiredAlert("帰着点呼：帰着ODOは必須です。");

  if(!abnormal) requiredAlert("帰着点呼：異常申告は必須です。");
  if(abnormal === "あり" && !abnormalDetail) requiredAlert("帰着点呼：異常が「あり」の場合、異常内容は必須です。");

  // checklist required
  const checklist = collectChecklist();
  const memo = ($("checkMemo").value||"").trim();
  const anyNg = hasAnyNg(checklist);
  if(anyNg && !memo){
    requiredAlert("日常点検でNGがある場合、「NG詳細メモ」は必須です。");
  }

  // files for PDF only
  const files = {
    licenseImg: $("p_licenseImg").files?.[0] || null,
    alcArrImg: $("arr_alcImg").files?.[0] || null,
    abnormalArrImg: $("arr_abnormalImg").files?.[0] || null,
    checkImg: $("checkImg").files?.[0] || null
  };
  window.__ofaFiles = window.__ofaFiles || {};
  window.__ofaFiles.licenseImg = files.licenseImg || window.__ofaFiles.licenseImg || null;
  window.__ofaFiles.alcArrImg = files.alcArrImg || null;
  window.__ofaFiles.abnormalArrImg = files.abnormalArrImg || null;
  window.__ofaFiles.checkImg = files.checkImg || null;

  // find same-day departure (latest in that date)
  const allTenko = await idbGetAll(STORE_TENKO);
  const day = normalizeDateOnly(at);
  const deps = allTenko
    .filter(t => t.type==="departure" && normalizeDateOnly(t.at)===day && t.name===profile.name && t.base===profile.base)
    .sort((a,b)=> String(b.at).localeCompare(String(a.at)));
  const dep = deps[0] || null;

  const odoDiff = dep ? (numOrZero(odoEnd) - numOrZero(dep.odoStart)) : "";
  const odoDiffSafe = (Number.isFinite(odoDiff) && odoDiff >= 0) ? odoDiff : "";

  const rec = {
    id: nowId("tenko"),
    type: "arrival",
    at,
    date: day,

    // profile snapshot
    name: profile.name,
    base: profile.base,
    carNo: profile.carNo,
    licenseNo: profile.licenseNo,
    phone: profile.phone,
    email: profile.email,

    method,
    // arrival side has break time, not sleep (仕様)
    sleep: "",
    breakMin,
    temp,
    condition,
    fatigue,
    med,
    medDetail: (med==="あり"?medDetail:""),
    drink,
    alcBand,
    alcValue,
    alcJudge,

    odoStart: dep ? dep.odoStart : "",
    odoEnd: numOrEmpty(odoEnd),
    odoDiff: odoDiffSafe,

    projects: dep ? dep.projects : [], // 出発の案件を引き継ぐ（帰着側で再入力させない）
    area: dep ? dep.area : "",
    risky: dep ? dep.risky : "",

    abnormal,
    abnormalDetail,

    checklist,
    checkMemo: memo,

    createdAt: new Date().toISOString(),
  };

  await idbPut(STORE_TENKO, rec);
  alert("帰着点呼＋日常点検を保存しました。");
}

// ===== Daily Report (OPTIONAL) =====
async function saveDaily(){
  const profile = await requireProfile();

  const date = normalizeDateOnly($("d_date").value);
  const mainProject = ($("d_mainProject").value||"").trim();
  const workStart = ($("d_workStart").value||"").trim();
  const workEnd = ($("d_workEnd").value||"").trim();
  const breakMin = ($("d_break").value||"").trim();
  const count = ($("d_count").value||"").trim();
  const absent = ($("d_absent").value||"").trim();
  const redel = ($("d_redel").value||"").trim();
  const claim = ($("d_claim").value||"").trim();
  const claimDetail = ($("d_claimDetail").value||"").trim();

  // optional money
  const payBase = ($("d_payBase").value||"").trim();
  const incentive = ($("d_incentive").value||"").trim();
  const fuel = ($("d_fuel").value||"").trim();
  const highway = ($("d_highway").value||"").trim();
  const parking = ($("d_parking").value||"").trim();
  const otherCost = ($("d_otherCost").value||"").trim();
  const memo = ($("d_memo").value||"").trim();

  // 日報はオプション：dateだけ推奨だが必須にはしない
  // ただし全部空なら警告してやめる
  const anyInput = [
    date, mainProject, workStart, workEnd, breakMin, count, absent, redel,
    claim, claimDetail, payBase, incentive, fuel, highway, parking, otherCost, memo
  ].some(v => !isEmpty(v));

  if(!anyInput){
    alert("日報は任意です。入力が何も無いので保存しません。");
    return;
  }

  // 走行距離（同日の最新 出発+帰着 から自動）
  let odoDiff = "";
  if(date){
    const allTenko = await idbGetAll(STORE_TENKO);
    const dep = allTenko
      .filter(t=>t.type==="departure" && normalizeDateOnly(t.at)===date && t.name===profile.name && t.base===profile.base)
      .sort((a,b)=> String(b.at).localeCompare(String(a.at)))[0] || null;
    const arr = allTenko
      .filter(t=>t.type==="arrival" && normalizeDateOnly(t.at)===date && t.name===profile.name && t.base===profile.base)
      .sort((a,b)=> String(b.at).localeCompare(String(a.at)))[0] || null;

    if(dep && arr){
      const diff = numOrZero(arr.odoEnd) - numOrZero(dep.odoStart);
      odoDiff = (diff>=0 && Number.isFinite(diff)) ? diff : "";
    }
  }

  // 利益概算（入っている分だけ計算）
  const salesTotal = numOrZero(payBase) + numOrZero(incentive);
  const costs = numOrZero(fuel) + numOrZero(highway) + numOrZero(parking) + numOrZero(otherCost);
  const profit = salesTotal - costs;

  // 複数案件：出発の案件を引き継ぐ（dateがある場合）
  let projects = [];
  if(date){
    const allTenko = await idbGetAll(STORE_TENKO);
    const dep = allTenko
      .filter(t=>t.type==="departure" && normalizeDateOnly(t.at)===date && t.name===profile.name && t.base===profile.base)
      .sort((a,b)=> String(b.at).localeCompare(String(a.at)))[0] || null;
    projects = dep?.projects || [];
  }

  const rec = {
    id: nowId("daily"),
    // profile snapshot
    name: profile.name,
    base: profile.base,
    date: date || "",

    mainProject,
    workStart,
    workEnd,
    breakMin: numOrEmpty(breakMin),

    count: numOrEmpty(count),
    absent: numOrEmpty(absent),
    redel: numOrEmpty(redel),

    claim,
    claimDetail: (claim==="あり"?claimDetail:""),

    // money
    payBase: numOrEmpty(payBase),
    incentive: numOrEmpty(incentive),
    fuel: numOrEmpty(fuel),
    highway: numOrEmpty(highway),
    parking: numOrEmpty(parking),
    otherCost: numOrEmpty(otherCost),

    salesTotal: salesTotal || "",
    profit: (anyInput ? profit : ""),

    odoDiff: odoDiff || "",

    memo,
    projects,

    createdAt: new Date().toISOString(),
  };

  await idbPut(STORE_DAILY, rec);
  alert("日報（任意）を保存しました。");
}

// ===== PDF Generation =====
async function buildTargetForPdf(targetDate){
  const profile = await requireProfile();

  const allTenko = await idbGetAll(STORE_TENKO);
  const allDaily = await idbGetAll(STORE_DAILY);

  // choose date
  let date = targetDate ? normalizeDateOnly(targetDate) : "";
  if(!date){
    // latest arrival date if exists, else latest departure
    const latest = allTenko
      .filter(t => t.name===profile.name && t.base===profile.base)
      .sort((a,b)=> String(b.at).localeCompare(String(a.at)))[0] || null;
    date = latest ? normalizeDateOnly(latest.at) : "";
  }
  if(!date) requiredAlert("PDF作成：対象日を選択するか、点呼を保存してください。");

  const deps = allTenko
    .filter(t => t.type==="departure" && normalizeDateOnly(t.at)===date && t.name===profile.name && t.base===profile.base)
    .sort((a,b)=> String(a.at).localeCompare(String(b.at)));
  const arrs = allTenko
    .filter(t => t.type==="arrival" && normalizeDateOnly(t.at)===date && t.name===profile.name && t.base===profile.base)
    .sort((a,b)=> String(a.at).localeCompare(String(b.at)));

  const dep = deps[deps.length-1] || null;
  const arr = arrs[arrs.length-1] || null;

  // daily: latest for date
  const dailys = allDaily
    .filter(d => normalizeDateOnly(d.date)===date && d.name===profile.name && d.base===profile.base)
    .sort((a,b)=> String(b.createdAt).localeCompare(String(a.createdAt)));
  const daily = dailys[0] || null;

  let odoDiff = "";
  if(dep && arr){
    const diff = numOrZero(arr.odoEnd) - numOrZero(dep.odoStart);
    if(diff>=0 && Number.isFinite(diff)) odoDiff = diff;
  }

  // files for PDF only
  const files = {
    licenseImg: window.__ofaFiles?.licenseImg || null,
    alcDepImg: window.__ofaFiles?.alcDepImg || null,
    alcArrImg: window.__ofaFiles?.alcArrImg || null,
  };

  return { profile, dep, arr, daily, odoDiff, files, date };
}

async function createPdfForDate(){
  const targetDate = $("out_date").value;
  const { profile, dep, arr, daily, odoDiff, files, date } = await buildTargetForPdf(targetDate);

  // pdf.js expects files object; allow missing (no images)
  await generateTodayPdf({
    profile,
    dep,
    arr,
    daily,
    odoDiff,
    files
  });

  // iPhone共有導線：PDF保存後に案内
  alert("PDFを作成しました。iPhoneの場合「共有」からLINE/メールへ送信できます。");
}

// ===== CSV Export (range search) =====
async function exportCsv(){
  const filters = {
    from: $("out_from").value || "",
    to: $("out_to").value || "",
    base: ($("out_base").value||"").trim(),
    name: ($("out_name").value||"").trim(),
  };
  await exportCsvSearchResult(filters);
  alert("CSVを出力しました。");
}

// ===== History =====
function renderHistoryCardTenko(t){
  const typeJa = (t.type==="departure") ? "出発" : "帰着";
  const odoTxt = (t.type==="departure")
    ? `出発ODO：${t.odoStart ?? ""}`
    : `帰着ODO：${t.odoEnd ?? ""} / 走行：${t.odoDiff ?? ""}km`;

  const ng = (t.checklist||[]).filter(x=>x.ok===false).map(x=>x.label);
  const ngTxt = ng.length ? `点検NG：${ng.join(" / ")}` : "";

  return `
    <div class="histItem">
      <div class="histTop">
        <div class="histTitle">${typeJa}点呼</div>
        <div class="histAt">${(t.at||"").replace("T"," ").slice(0,16)}</div>
      </div>
      <div class="histBody">
        <div>氏名：${t.name || ""}</div>
        <div>拠点：${t.base || ""}</div>
        <div>${odoTxt}</div>
        <div>アルコール：${t.alcValue || ""}（${t.alcJudge || ""}）</div>
        ${ngTxt ? `<div>${ngTxt}</div>` : ""}
        <div class="histBtns">
          <button class="btn secondary" data-action="delTenko" data-id="${t.id}">削除</button>
        </div>
      </div>
    </div>
  `;
}

function renderHistoryCardDaily(d){
  return `
    <div class="histItem">
      <div class="histTop">
        <div class="histTitle">日報（任意）</div>
        <div class="histAt">${(d.date||"")}</div>
      </div>
      <div class="histBody">
        <div>氏名：${d.name || ""}</div>
        <div>拠点：${d.base || ""}</div>
        <div>案件：${d.mainProject || ""}</div>
        <div>売上：${d.salesTotal || ""} / 利益：${d.profit || ""}</div>
        <div class="histBtns">
          <button class="btn secondary" data-action="delDaily" data-id="${d.id}">削除</button>
        </div>
      </div>
    </div>
  `;
}

async function reloadHistory(){
  const box = $("historyBox");
  box.innerHTML = `<div class="small">読み込み中...</div>`;

  const tenko = (await idbGetAll(STORE_TENKO)).sort((a,b)=> String(b.at).localeCompare(String(a.at)));
  const daily = (await idbGetAll(STORE_DAILY)).sort((a,b)=> String(b.createdAt).localeCompare(String(a.createdAt)));

  // merge like timeline (rough)
  const merged = [];
  for(const t of tenko) merged.push({ kind:"tenko", at:t.at, data:t });
  for(const d of daily) merged.push({ kind:"daily", at:(d.date?`${d.date}T23:59`:""), data:d });
  merged.sort((a,b)=> String(b.at).localeCompare(String(a.at)));

  if(merged.length === 0){
    box.innerHTML = `<div class="small">履歴はまだありません。</div>`;
    return;
  }

  let html = "";
  for(const m of merged.slice(0, 80)){ // 表示は重くなるので上限
    if(m.kind==="tenko") html += renderHistoryCardTenko(m.data);
    if(m.kind==="daily") html += renderHistoryCardDaily(m.data);
  }
  html += `<div class="small">表示は最大80件まで（データは端末内に全件保存）</div>`;
  box.innerHTML = html;

  // bind delete buttons
  box.querySelectorAll("button[data-action]").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      const act = btn.dataset.action;
      const id = btn.dataset.id;
      if(!id) return;

      if(!confirm("この履歴を削除しますか？（この端末のみ）")) return;

      if(act==="delTenko"){
        await idbDelete(STORE_TENKO, id);
      }else if(act==="delDaily"){
        await idbDelete(STORE_DAILY, id);
      }
      await reloadHistory();
    });
  });
}

async function clearAll(){
  if(!confirm("この端末内の履歴をすべて削除します。本当に実行しますか？")) return;
  const tenko = await idbGetAll(STORE_TENKO);
  const daily = await idbGetAll(STORE_DAILY);
  for(const t of tenko) await idbDelete(STORE_TENKO, t.id);
  for(const d of daily) await idbDelete(STORE_DAILY, d.id);
  alert("全履歴を削除しました。");
  await reloadHistory();
}

// ===== Init & Bind =====
function bind(){
  // profile
  $("btnSaveProfile").addEventListener("click", async ()=>{
    try{ await saveProfile(); }
    catch(e){ console.error(e); }
  });

  $("btnLoadProfile").addEventListener("click", async ()=>{
    try{ await loadProfile(); alert("読み込みました。"); }
    catch(e){ console.error(e); }
  });

  // projects (departure)
  $("btnAddProjectDep").addEventListener("click", ()=>{
    const box = $("dep_projects");
    box.insertAdjacentHTML("beforeend", projectRowHtml("dep_projects", Date.now()));
    bindProjectRowRemove(box);
  });

  // save tenko
  $("btnSaveDep").addEventListener("click", async ()=>{
    try{ await saveDeparture(); await reloadHistory(); }
    catch(e){ console.error(e); }
  });

  $("btnSaveArr").addEventListener("click", async ()=>{
    try{ await saveArrival(); await reloadHistory(); }
    catch(e){ console.error(e); }
  });

  // daily optional
  $("btnSaveDaily").addEventListener("click", async ()=>{
    try{ await saveDaily(); await reloadHistory(); }
    catch(e){ console.error(e); }
  });

  // outputs
  $("btnPdfToday").addEventListener("click", async ()=>{
    try{ await createPdfForDate(); }
    catch(e){ console.error(e); alert(e.message||"PDF作成に失敗しました"); }
  });
  $("btnCsvRange").addEventListener("click", async ()=>{
    try{ await exportCsv(); }
    catch(e){ console.error(e); alert(e.message||"CSV出力に失敗しました"); }
  });

  // history
  $("btnReloadHistory").addEventListener("click", reloadHistory);
  $("btnClearAll").addEventListener("click", clearAll);
}

async function init(){
  renderChecklist();
  ensureAtLeastOneProject("dep_projects");

  // 初期で基本情報を読み込み（あるなら）
  try{ await loadProfile(); }catch(e){}

  // 履歴表示
  await reloadHistory();
}

document.addEventListener("DOMContentLoaded", ()=>{
  bind();
  init();
});
