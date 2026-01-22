// js/app.js
// Driver app controller (IndexedDB) - Full
// 画像は保存しない（PDF生成時のみ使用）
// 出発/帰着は分離、日報・売上は任意

// ========= helpers =========
const $ = (id) => document.getElementById(id);

function toast(msg){
  alert(msg);
}

function nowId(prefix="rec"){
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function normalizeDate(v){
  if(!v) return "";
  return String(v).slice(0,10);
}

function num(v){
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function val(id){ return ($(id)?.value ?? "").toString().trim(); }

function setTab(name){
  const tabs = document.querySelectorAll(".tab");
  tabs.forEach(t => t.classList.toggle("active", t.dataset.tab === name));
  const panels = ["profile","departure","arrival","daily","history","export"];
  panels.forEach(p => {
    const el = $(`tab_${p}`);
    if(el) el.classList.toggle("hidden", p !== name);
  });
}

function required(ids){
  for(const id of ids){
    if(!val(id)){
      return id;
    }
  }
  return null;
}

function setStatusCounts(){
  Promise.all([idbGetAll(STORE_TENKO), idbGetAll(STORE_DAILY)]).then(([t,d])=>{
    $("countText").textContent = `点呼 ${t.length} / 日報 ${d.length}`;
  }).catch(()=>{ $("countText").textContent = "-"; });
}

async function getProfile(){
  const p = await idbGet(STORE_PROFILE, "me");
  return p || null;
}

async function ensureProfileOrGo(){
  const p = await getProfile();
  if(!p){
    setTab("profile");
    toast("先に「基本情報（必須）」を保存してください。");
    return null;
  }
  return p;
}

// ========= Projects UI =========
const PROJECT_OPTIONS = [
  "Amazon","ヤマト","佐川","スポット","企業配送","ルート便","引越","チャーター","その他"
];

function createProjectRow(containerId, init){
  const wrap = document.createElement("div");
  wrap.className = "card";
  wrap.style.padding = "10px";
  wrap.style.margin = "10px 0";
  wrap.style.borderRadius = "14px";
  wrap.style.background = "#f7fbff";

  const sel = document.createElement("select");
  sel.style.marginTop = "0";
  sel.innerHTML = `<option value="">選択</option>` + PROJECT_OPTIONS.map(x=>`<option>${x}</option>`).join("");
  sel.value = init?.name || "";

  const inp = document.createElement("input");
  inp.placeholder = "補足（任意）例：博多エリア/企業名";
  inp.value = init?.note || "";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn2";
  btn.textContent = "削除";
  btn.style.marginTop = "10px";
  btn.onclick = ()=> wrap.remove();

  wrap.appendChild(labelLite("案件"));
  wrap.appendChild(sel);
  wrap.appendChild(labelLite("補足"));
  wrap.appendChild(inp);
  wrap.appendChild(btn);

  $(containerId).appendChild(wrap);

  return { wrap, sel, inp };
}

function labelLite(text){
  const l = document.createElement("div");
  l.style.fontSize = "12px";
  l.style.fontWeight = "900";
  l.style.margin = "10px 0 6px";
  l.style.color = "#223";
  l.textContent = text;
  return l;
}

function readProjects(containerId){
  const box = $(containerId);
  const cards = box.querySelectorAll(".card");
  const list = [];
  cards.forEach(card=>{
    const sel = card.querySelector("select");
    const inp = card.querySelector("input");
    const name = (sel?.value||"").trim();
    const note = (inp?.value||"").trim();
    if(name){
      list.push({ name, note });
    }
  });
  return list;
}

function clearProjects(containerId){
  $(containerId).innerHTML = "";
}

// ========= Checklist (Daily vehicle inspection) =========
const CHECK_ITEMS = [
  // A. 安全走行に直結
  "タイヤ空気圧",
  "タイヤ溝/ひび割れ",
  "ホイールナット緩み",
  "ブレーキ効き",
  "パーキングブレーキ",
  "ハンドル操作",
  "ライト（前照灯/尾灯/ブレーキ/ウインカー/ハザード）",
  "ワイパー/ウォッシャー液",
  "ミラー/ガラス破損",
  // B. 車両状態
  "エンジンオイル量",
  "冷却水",
  "バッテリー（警告灯含む）",
  "異音/異臭/異常振動",
  "漏れ（オイル/冷却水）",
  "外装破損",
  "積載状態（偏り/過積載なし）",
  // C. 装備
  "消火器",
  "三角停止板",
  "反射ベスト",
  "ジャッキ/工具（任意）"
];

function buildChecklistUI(){
  const box = $("checklistBox");
  if(!box) return;
  box.innerHTML = "";

  CHECK_ITEMS.forEach((label)=>{
    const row = document.createElement("div");
    row.className = "checkRow";

    const left = document.createElement("div");
    left.className = "lbl";
    left.textContent = label;

    const sel = document.createElement("select");
    sel.innerHTML = `
      <option value="">選択</option>
      <option value="OK">OK</option>
      <option value="NG">NG</option>
    `;
    sel.dataset.label = label;

    row.appendChild(left);
    row.appendChild(sel);
    box.appendChild(row);
  });
}

function readChecklist(){
  const box = $("checklistBox");
  const sels = box.querySelectorAll("select");
  const list = [];
  sels.forEach(s=>{
    const label = s.dataset.label || "";
    const v = (s.value||"").trim();
    if(label){
      list.push({ label, ok: v==="OK", value: v }); // value: OK/NG/""
    }
  });
  return list;
}

function checklistAllSelected(list){
  return list.every(x => (x.value==="OK" || x.value==="NG"));
}

function checklistHasNg(list){
  return list.some(x => x.value==="NG");
}

// ========= init =========
document.addEventListener("DOMContentLoaded", async ()=>{
  // tabs
  document.querySelectorAll(".tab").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      const name = btn.dataset.tab;
      setTab(name);
      if(name==="history") await refreshHistory();
      if(name==="export") setStatusCounts();
    });
  });

  // initial checklist
  buildChecklistUI();

  // initial projects one row
  clearProjects("d_projects");
  createProjectRow("d_projects", {name:"", note:""});
  clearProjects("r_projects");

  // counts
  setStatusCounts();

  // wire buttons
  wireProfile();
  wireDeparture();
  wireArrival();
  wireDaily();
  wireHistory();
  wireExport();

  // load profile in form if exists
  await loadProfileToForm();
});

// ========= profile =========
function wireProfile(){
  $("btnSaveProfile")?.addEventListener("click", saveProfileFromForm);
  $("btnLoadProfile")?.addEventListener("click", loadProfileToForm);
  $("btnClearProfile")?.addEventListener("click", async ()=>{
    if(!confirm("基本情報を削除します。よろしいですか？")) return;
    await idbDelete(STORE_PROFILE, "me");
    toast("削除しました");
  });
}

async function saveProfileFromForm(){
  const missing = required(["p_name","p_base","p_carNo","p_licenseNo","p_phone","p_email"]);
  if(missing){
    toast("必須項目が未入力です。");
    $(missing)?.focus();
    return;
  }

  // 画像は保存しない（ファイル参照のみ）
  const profile = {
    id: "me",
    name: val("p_name"),
    base: val("p_base"),
    carNo: val("p_carNo"),
    licenseNo: val("p_licenseNo"),
    phone: val("p_phone"),
    email: val("p_email"),
    updatedAt: new Date().toISOString()
  };

  await idbPut(STORE_PROFILE, profile);
  toast("基本情報を保存しました");
  setStatusCounts();
  setTab("departure");
}

async function loadProfileToForm(){
  const p = await getProfile();
  if(!p){
    toast("保存済みの基本情報がありません。");
    return;
  }
  $("p_name").value = p.name || "";
  $("p_base").value = p.base || "";
  $("p_carNo").value = p.carNo || "";
  $("p_licenseNo").value = p.licenseNo || "";
  $("p_phone").value = p.phone || "";
  $("p_email").value = p.email || "";
  toast("基本情報を読み込みました");
}

// ========= departure tenko =========
function wireDeparture(){
  $("btnAddProjectDep")?.addEventListener("click", ()=> createProjectRow("d_projects"));
  $("btnClearProjectDep")?.addEventListener("click", ()=>{
    clearProjects("d_projects");
    createProjectRow("d_projects", {name:"", note:""});
  });

  $("btnSaveDeparture")?.addEventListener("click", saveDeparture);
}

async function saveDeparture(){
  const profile = await ensureProfileOrGo();
  if(!profile) return;

  const missing = required([
    "d_at","d_method","d_sleep","d_temp","d_condition","d_fatigue",
    "d_med","d_drink","d_alcBand","d_alcValue","d_alcJudge",
    "d_odoStart","d_loadArea","d_danger"
  ]);
  if(missing){
    toast("出発点呼の必須項目が未入力です。");
    $(missing)?.focus();
    return;
  }

  if(val("d_med")==="あり" && !val("d_medDetail")){
    toast("服薬が「あり」の場合は内容を入力してください。");
    $("d_medDetail")?.focus();
    return;
  }

  const projects = readProjects("d_projects");
  if(projects.length===0){
    toast("稼働案件を最低1件選択してください。");
    return;
  }

  const abnormal = val("d_abnormal");
  if(!abnormal){
    toast("異常の有無を選択してください。");
    $("d_abnormal")?.focus();
    return;
  }
  if(abnormal==="あり" && !val("d_abnormalDetail")){
    toast("異常が「あり」の場合は異常内容を入力してください。");
    $("d_abnormalDetail")?.focus();
    return;
  }

  const rec = {
    id: nowId("tenko"),
    kind: "tenko",
    type: "departure", // 出発
    at: val("d_at"),
    date: normalizeDate(val("d_at")),
    name: profile.name,
    base: profile.base,
    carNo: profile.carNo,
    licenseNo: profile.licenseNo,
    phone: profile.phone,
    email: profile.email,

    method: val("d_method"),
    sleep: val("d_sleep"),
    temp: val("d_temp"),
    condition: val("d_condition"),
    fatigue: val("d_fatigue"),
    med: val("d_med"),
    medDetail: val("d_medDetail"),
    drink: val("d_drink"),
    alcBand: val("d_alcBand"),
    alcValue: val("d_alcValue"),
    alcJudge: val("d_alcJudge"),

    odoStart: val("d_odoStart"),
    odoEnd: "",

    projects, // 複数案件
    loadArea: val("d_loadArea"),
    danger: val("d_danger"),

    abnormal,
    abnormalDetail: val("d_abnormalDetail"),

    // checklistは帰着側で保存（ここは空）
    checklist: [],
    checkMemo: "",

    createdAt: new Date().toISOString()
  };

  await idbPut(STORE_TENKO, rec);
  toast("出発点呼を保存しました");
  setStatusCounts();
  setTab("arrival");
}

// ========= arrival tenko + checklist =========
function wireArrival(){
  $("btnSaveArrival")?.addEventListener("click", saveArrival);
}

async function saveArrival(){
  const profile = await ensureProfileOrGo();
  if(!profile) return;

  const missing = required([
    "a_at","a_method","a_breakMin","a_temp","a_condition","a_fatigue",
    "a_med","a_drink","a_alcBand","a_alcValue","a_alcJudge",
    "a_odoEnd","a_abnormal"
  ]);
  if(missing){
    toast("帰着点呼の必須項目が未入力です。");
    $(missing)?.focus();
    return;
  }

  if(val("a_med")==="あり" && !val("a_medDetail")){
    toast("服薬が「あり」の場合は内容を入力してください。");
    $("a_medDetail")?.focus();
    return;
  }

  const abnormal = val("a_abnormal");
  if(abnormal==="あり" && !val("a_abnormalDetail")){
    toast("異常が「あり」の場合は異常内容を入力してください。");
    $("a_abnormalDetail")?.focus();
    return;
  }

  const checklist = readChecklist();
  if(!checklistAllSelected(checklist)){
    toast("日常点検は全項目 OK/NG を選択してください。");
    return;
  }
  const hasNg = checklistHasNg(checklist);
  if(hasNg && !val("a_checkMemo")){
    toast("日常点検にNGがあるため、NG詳細メモを入力してください。");
    $("a_checkMemo")?.focus();
    return;
  }

  const rec = {
    id: nowId("tenko"),
    kind: "tenko",
    type: "arrival", // 帰着
    at: val("a_at"),
    date: normalizeDate(val("a_at")),
    name: profile.name,
    base: profile.base,
    carNo: profile.carNo,
    licenseNo: profile.licenseNo,
    phone: profile.phone,
    email: profile.email,

    method: val("a_method"),
    breakMin: val("a_breakMin"),
    temp: val("a_temp"),
    condition: val("a_condition"),
    fatigue: val("a_fatigue"),
    med: val("a_med"),
    medDetail: val("a_medDetail"),
    drink: val("a_drink"),
    alcBand: val("a_alcBand"),
    alcValue: val("a_alcValue"),
    alcJudge: val("a_alcJudge"),

    odoStart: "",
    odoEnd: val("a_odoEnd"),

    abnormal,
    abnormalDetail: val("a_abnormalDetail"),

    checklist,
    checkMemo: val("a_checkMemo"),

    createdAt: new Date().toISOString()
  };

  await idbPut(STORE_TENKO, rec);
  toast("帰着点呼＋日常点検を保存しました");
  setStatusCounts();
  setTab("daily");
}

// ========= daily report (optional) =========
function wireDaily(){
  $("btnAddProjectDaily")?.addEventListener("click", ()=> createProjectRow("r_projects"));
  $("btnClearProjectDaily")?.addEventListener("click", ()=> clearProjects("r_projects"));
  $("btnClearDailyForm")?.addEventListener("click", clearDailyForm);
  $("btnSaveDaily")?.addEventListener("click", saveDaily);
}

function clearDailyForm(){
  [
    "r_date","r_mainProject","r_start","r_end","r_breakMin","r_delivery","r_absent",
    "r_redelivery","r_return","r_claim","r_claimDetail",
    "r_payBase","r_incentive","r_fuel","r_highway","r_parking","r_otherCost","r_memo"
  ].forEach(id=>{ if($(id)) $(id).value=""; });
  $("r_photos").value = "";
  clearProjects("r_projects");
  toast("日報フォームをクリアしました");
}

async function saveDaily(){
  const profile = await ensureProfileOrGo();
  if(!profile) return;

  // 日報はオプションだが、保存する場合は「稼働日」だけ必須にする（あなたの運用上、日付が無いと履歴が成立しないため）
  const missing = required(["r_date"]);
  if(missing){
    toast("日報を保存するには「稼働日」は必須です。");
    $("r_date")?.focus();
    return;
  }

  // 入力は全部任意（空OK）
  const projects = readProjects("r_projects"); // optional

  const rec = {
    id: nowId("daily"),
    kind: "daily",
    uid: "local",
    name: profile.name,
    base: profile.base,
    date: val("r_date"),

    mainProject: val("r_mainProject"),
    start: val("r_start"),
    end: val("r_end"),
    breakMin: val("r_breakMin"),

    delivery: val("r_delivery"),
    absent: val("r_absent"),
    redelivery: val("r_redelivery"),
    ret: val("r_return"),

    claim: val("r_claim"),
    claimDetail: val("r_claimDetail"),

    payBase: val("r_payBase"),
    incentive: val("r_incentive"),
    fuel: val("r_fuel"),
    highway: val("r_highway"),
    parking: val("r_parking"),
    otherCost: val("r_otherCost"),

    // odoDiffは後でPDF作成時に計算して埋める（ここでは未確定）
    odoDiff: "",

    memo: val("r_memo"),
    projects,

    createdAt: new Date().toISOString()
  };

  await idbPut(STORE_DAILY, rec);
  toast("日報を保存しました（任意項目は未入力でもOK）");
  setStatusCounts();
  setTab("history");
  await refreshHistory();
}

// ========= history =========
function wireHistory(){
  $("btnHistorySearch")?.addEventListener("click", refreshHistory);
  $("btnHistoryReset")?.addEventListener("click", async ()=>{
    ["h_from","h_to","h_base","h_name"].forEach(id=>{ if($(id)) $(id).value=""; });
    await refreshHistory();
  });
  $("btnHistoryRefresh")?.addEventListener("click", refreshHistory);
}

async function refreshHistory(){
  const filters = {
    from: val("h_from"),
    to: val("h_to"),
    base: val("h_base"),
    name: val("h_name")
  };

  const { tenkoHit, dailyHit } = await searchRecords(filters);

  // tenko list
  const tBox = $("tenkoList");
  if(!tenkoHit.length){
    tBox.innerHTML = `<div class="item"><span class="k">該当なし</span></div>`;
  }else{
    tBox.innerHTML = tenkoHit.slice(0,200).map(r=>{
      const dt = (r.at||"").replace("T"," ").slice(0,16);
      const kind = r.type==="departure" ? "出発" : "帰着";
      const odo = r.type==="departure" ? (r.odoStart||"") : (r.odoEnd||"");
      const abnormal = r.abnormal || "";
      return `
        <div class="item">
          <div>
            <div class="v">${dt} / ${kind}</div>
            <div class="k">${r.name} / ${r.base} / ODO:${odo}</div>
          </div>
          <div class="right">
            <div class="v">${abnormal}</div>
            <div class="k"><button class="btnSmall" data-del-tenko="${r.id}">削除</button></div>
          </div>
        </div>
      `;
    }).join("");

    // bind delete
    tBox.querySelectorAll("[data-del-tenko]").forEach(btn=>{
      btn.addEventListener("click", async ()=>{
        const id = btn.getAttribute("data-del-tenko");
        if(!confirm("この点呼データを削除しますか？")) return;
        await idbDelete(STORE_TENKO, id);
        toast("削除しました");
        setStatusCounts();
        await refreshHistory();
      });
    });
  }

  // daily list
  const dBox = $("dailyList");
  if(!dailyHit.length){
    dBox.innerHTML = `<div class="item"><span class="k">該当なし</span></div>`;
  }else{
    dBox.innerHTML = dailyHit.slice(0,200).map(r=>{
      const date = r.date || "";
      const prj = r.mainProject || "";
      return `
        <div class="item">
          <div>
            <div class="v">${date}</div>
            <div class="k">${r.name} / ${r.base} / ${prj}</div>
          </div>
          <div class="right">
            <div class="v">${r.salesTotal || ""}</div>
            <div class="k"><button class="btnSmall" data-del-daily="${r.id}">削除</button></div>
          </div>
        </div>
      `;
    }).join("");

    dBox.querySelectorAll("[data-del-daily]").forEach(btn=>{
      btn.addEventListener("click", async ()=>{
        const id = btn.getAttribute("data-del-daily");
        if(!confirm("この日報データを削除しますか？")) return;
        await idbDelete(STORE_DAILY, id);
        toast("削除しました");
        setStatusCounts();
        await refreshHistory();
      });
    });
  }

  setStatusCounts();
}

// ========= export =========
function wireExport(){
  $("btnShareHint")?.addEventListener("click", ()=>{
    $("shareHint").classList.toggle("hidden");
  });

  $("btnMakePdf")?.addEventListener("click", makePdfByDate);
  $("btnExportCsv")?.addEventListener("click", exportCsvByFilters);
  $("btnDangerClearAll")?.addEventListener("click", clearAllData);
}

async function exportCsvByFilters(){
  const filters = {
    from: val("x_from"),
    to: val("x_to"),
    base: "", // driver側は自分端末想定なので空でOK
    name: ""
  };
  try{
    await exportCsvSearchResult(filters);
    toast("CSVを出力しました（点呼CSV / 日報CSV）");
  }catch(e){
    console.error(e);
    toast("CSV出力に失敗しました");
  }
}

async function clearAllData(){
  if(!confirm("端末内の全データ（基本情報・点呼・日報）を削除します。よろしいですか？")) return;
  // easiest: delete DB
  await new Promise((resolve)=>{
    const req = indexedDB.deleteDatabase(OFA_DB_NAME);
    req.onsuccess = ()=> resolve();
    req.onerror = ()=> resolve();
    req.onblocked = ()=> resolve();
  });
  toast("全データを削除しました。ページを再読み込みしてください。");
}

async function makePdfByDate(){
  const profile = await ensureProfileOrGo();
  if(!profile) return;

  const target = val("x_date") || normalizeDate(new Date().toISOString());

  // find dep/arr by date (same day) - choose latest per type
  const tenkoAll = await idbGetAll(STORE_TENKO);
  const dep = tenkoAll
    .filter(x=>x.type==="departure" && normalizeDate(x.at)===target)
    .sort((a,b)=> String(b.at).localeCompare(String(a.at)))[0] || null;

  const arr = tenkoAll
    .filter(x=>x.type==="arrival" && normalizeDate(x.at)===target)
    .sort((a,b)=> String(b.at).localeCompare(String(a.at)))[0] || null;

  const dailyAll = await idbGetAll(STORE_DAILY);
  const daily = dailyAll
    .filter(x=>normalizeDate(x.date)===target)
    .sort((a,b)=> String(b.createdAt).localeCompare(String(a.createdAt)))[0] || null;

  if(!dep && !arr && !daily){
    toast("指定日のデータが見つかりません（出発/帰着/日報）。");
    return;
  }

  // odo diff calc
  const odoDiff = Math.max(0, num(arr?.odoEnd) - num(dep?.odoStart));
  if(daily){
    daily.odoDiff = odoDiff; // PDFに表示用（保存はしない）
    // 売上系 自動計算（入力があれば）
    const payBase = num(daily.payBase);
    const inc = num(daily.incentive);
    const cost = num(daily.fuel)+num(daily.highway)+num(daily.parking)+num(daily.otherCost);
    daily.salesTotal = payBase + inc;
    daily.profit = (payBase + inc) - cost;
  }

  // Files (not saved)
  const files = {
    licenseImg: $("p_licenseImg")?.files?.[0] || null,
    alcDepImg: $("d_alcImg")?.files?.[0] || null,
    alcArrImg: $("a_alcImg")?.files?.[0] || null
  };

  // Additional images: abnormal/check/daily photos (pdf.jsが対応しているのは上3つだが、pdf.js側で拡張可)
  // ここでは最低限、pdf.jsの引数仕様に合わせる（壊れない優先）

  try{
    await generateTodayPdf({ profile, dep, arr, daily, odoDiff, files });
    toast("PDFを作成しました（ファイル保存後にLINE/メールで共有してください）");
  }catch(e){
    console.error(e);
    toast("PDF作成に失敗しました。通信状態やブラウザを確認してください。");
  }
}

// ========= tab switching click support =========
document.addEventListener("click", (e)=>{
  const el = e.target;
  if(!(el instanceof HTMLElement)) return;

  // if user taps header management or others, ignore here
});

// ========= small UI: tab default =========
setTab("profile");
