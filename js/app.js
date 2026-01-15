// js/app.js

// ---- UI helpers ----
function $(id){ return document.getElementById(id); }
function toast(msg){ alert(msg); }

function setTab(name){
  document.querySelectorAll(".tab").forEach(t=>t.classList.remove("active"));
  document.querySelector(`.tab[data-tab="${name}"]`)?.classList.add("active");

  $("tab_tenko").classList.toggle("hidden", name!=="tenko");
  $("tab_daily").classList.toggle("hidden", name!=="daily");
  $("tab_history").classList.toggle("hidden", name!=="history");
}

function nowLocalDatetime(){
  const d = new Date();
  const pad = n => String(n).padStart(2,"0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth()+1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function calcOdoDiff(){
  // 出発ODOと帰着ODOが揃ったら差分
  const s = Number($("t_odoStart").value || 0);
  const e = Number($("t_odoEnd").value || 0);
  const diff = (e>0 && s>0 && e>=s) ? (e - s) : 0;
  $("t_odoDiff").value = String(diff);
  return diff;
}

// ---- Checklist ----
const CHECK_ITEMS = [
  "タイヤ空気圧","ブレーキ","ライト","ワイパー","ミラー","エンジン音","オイル漏れ","冷却水","バッテリー","ホーン","荷台・ドア","積載物固定","警告灯","その他異常なし"
];

function renderChecklist(){
  const wrap = $("dailyChecklist");
  wrap.innerHTML = "";
  CHECK_ITEMS.forEach((label, idx)=>{
    const div = document.createElement("div");
    div.className = "checkitem";
    div.innerHTML = `
      <input type="checkbox" id="chk_${idx}" checked>
      <div style="flex:1;font-weight:800">${label}</div>
      <span class="badge">OK</span>
    `;
    const cb = div.querySelector("input");
    const badge = div.querySelector(".badge");
    cb.addEventListener("change", ()=>{
      if(cb.checked){
        badge.textContent="OK";
        badge.style.background="#f0f6ff";
        badge.style.borderColor="#dbe9ff";
      }else{
        badge.textContent="NG";
        badge.style.background="#fff2f2";
        badge.style.borderColor="#ffd5d5";
      }
    });
    wrap.appendChild(div);
  });
}

function readChecklist(){
  const list = [];
  CHECK_ITEMS.forEach((label, idx)=>{
    const ok = $(`chk_${idx}`).checked;
    list.push({ label, ok });
  });
  return list;
}

function hasNg(list){
  return list.some(x=>!x.ok);
}

// ---- Projects (Daily optional) ----
function addProjectRow(init={}){
  const wrap = $("projectsWrap");
  const idx = wrap.children.length + 1;
  const box = document.createElement("div");
  box.className = "card";
  box.style.boxShadow = "none";
  box.style.margin = "10px 0";
  box.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px">
      <div style="font-weight:900">案件 ${idx}</div>
      <button class="btn secondary" type="button" style="width:auto;padding:10px 12px" data-del>削除</button>
    </div>
    <label>案件名</label><input data-k="name" placeholder="例：Amazon / 企業配" value="${init.name||""}">
    <label>エリア</label><input data-k="area" placeholder="例：鹿児島市" value="${init.area||""}">
    <div class="row">
      <div><label>開始</label><input data-k="start" placeholder="例：09:00" value="${init.start||""}"></div>
      <div><label>終了</label><input data-k="end" placeholder="例：18:00" value="${init.end||""}"></div>
    </div>
    <div class="row">
      <div><label>配達個数</label><input data-k="count" inputmode="numeric" value="${init.count||""}"></div>
      <div><label>メモ</label><input data-k="memo" value="${init.memo||""}"></div>
    </div>
  `;
  box.querySelector("[data-del]").addEventListener("click", ()=>{
    box.remove();
  });
  wrap.appendChild(box);
}

function readProjects(){
  const wrap = $("projectsWrap");
  const res = [];
  [...wrap.children].forEach(card=>{
    const get = k => card.querySelector(`[data-k="${k}"]`)?.value || "";
    res.push({
      name:get("name"),
      area:get("area"),
      start:get("start"),
      end:get("end"),
      count:get("count"),
      memo:get("memo"),
    });
  });
  // 空行は落とす
  return res.filter(p=> Object.values(p).some(v=>String(v).trim()!==""));
}

function calcDailyMoney(){
  const payBase = Number($("d_payBase").value||0);
  const incentive = Number($("d_incentive").value||0);
  const fuel = Number($("d_fuel").value||0);
  const highway = Number($("d_highway").value||0);
  const parking = Number($("d_parking").value||0);
  const other = Number($("d_otherCost").value||0);

  const sales = payBase + incentive;
  const cost = fuel + highway + parking + other;
  const profit = sales - cost;

  $("d_salesTotal").value = String(sales);
  $("d_profit").value = String(profit);
  return { sales, profit };
}

// ---- Profile ----
async function loadProfileToForm(){
  const p = await idbGet(STORE_PROFILE, "me");
  if(!p) return;

  $("p_name").value = p.name || "";
  $("p_base").value = p.base || "";
  $("p_carNo").value = p.carNo || "";
  $("p_licenseNo").value = p.licenseNo || "";
  $("p_phone").value = p.phone || "";
  $("p_email").value = p.email || "";
}

async function saveProfile(){
  const required = ["p_name","p_base","p_licenseNo","p_phone","p_email"];
  for(const id of required){
    if(!$(id).value.trim()){
      toast("必須項目が未入力です");
      return false;
    }
  }
  const p = {
    id:"me",
    name:$("p_name").value.trim(),
    base:$("p_base").value.trim(),
    carNo:$("p_carNo").value.trim(),
    licenseNo:$("p_licenseNo").value.trim(),
    phone:$("p_phone").value.trim(),
    email:$("p_email").value.trim(),
  };
  await idbPut(STORE_PROFILE, p);
  toast("基本情報を保存しました");
  return true;
}

async function resetProfile(){
  await idbDelete(STORE_PROFILE, "me");
  ["p_name","p_base","p_carNo","p_licenseNo","p_phone","p_email"].forEach(id=>$(id).value="");
  $("p_licenseImg").value = "";
  toast("基本情報をリセットしました");
}

// ---- Tenko save ----
function validateTenko(){
  const type = $("t_type").value;
  if(!type) return "点呼区分を選択してください";
  if(!$("t_at").value) return "点呼日時は必須です（手入力）";
  const req = ["t_method","t_sleep","t_temp","t_condition","t_fatigue","t_med","t_alcValue","t_abnormal"];
  for(const id of req){
    if(!$(id).value) return "必須項目が未入力です";
  }
  if($("t_abnormal").value==="あり" && !$("t_abnormalDetail").value.trim()){
    return "異常ありの場合、異常内容は必須です";
  }

  const list = readChecklist();
  if(hasNg(list) && !$("t_checkMemo").value.trim()){
    return "日常点検でNGがある場合、メモは必須です";
  }

  // ODOは点呼区分に応じて入力（任意だが、距離計算には必要）
  if(type==="departure"){
    // 出発で帰着ODOを強制しない（入れててもOKだが、嘘になるので注意文を出す）
    // ただしユーザーが入れた場合も許容
  }else if(type==="arrival"){
    // 帰着で出発ODOを強制しない
  }

  return "";
}

async function saveTenko(){
  const p = await idbGet(STORE_PROFILE, "me");
  if(!p){
    toast("先に基本情報を保存してください");
    return;
  }
  const err = validateTenko();
  if(err){ toast(err); return; }

  const type = $("t_type").value; // departure/arrival
  const at = $("t_at").value;

  // compute odo diff from inputs (if both provided)
  const odoStart = $("t_odoStart").value.trim();
  const odoEnd = $("t_odoEnd").value.trim();
  const diff = calcOdoDiff();

  const rec = {
    id: crypto.randomUUID(),
    kind:"tenko",
    name:p.name, base:p.base, carNo:p.carNo, licenseNo:p.licenseNo, phone:p.phone, email:p.email,
    type,
    at,
    method:$("t_method").value,
    sleep:$("t_sleep").value,
    temp:$("t_temp").value,
    condition:$("t_condition").value,
    fatigue:$("t_fatigue").value,
    med:$("t_med").value,
    medDetail:$("t_medDetail").value.trim(),
    alcValue:$("t_alcValue").value,
    alcJudge:$("t_alcJudge").value,
    odoStart,
    odoEnd,
    odoDiff: diff,
    abnormal:$("t_abnormal").value,
    abnormalDetail:$("t_abnormalDetail").value.trim(),
    checklist: readChecklist(),
    checkMemo:$("t_checkMemo").value.trim(),
    createdAt: new Date().toISOString(),
  };

  await idbPut(STORE_TENKO, rec);
  toast("点呼を保存しました");
}

// ---- Daily save (optional) ----
async function saveDaily(){
  const p = await idbGet(STORE_PROFILE, "me");
  if(!p){ toast("先に基本情報を保存してください"); return; }

  // 日報は完全任意。最低限 date が空でも保存できるが、検索のため推奨
  const date = $("d_date").value || "";
  const mainProject = $("d_mainProject").value.trim();

  const { sales, profit } = calcDailyMoney();
  const projects = readProjects();

  // odoDiff: その日に紐づく点呼ペアがあれば算出して入れる
  const odoDiff = await calcOdoDiffForDate(p.name, p.base, date);

  const rec = {
    id: crypto.randomUUID(),
    kind:"daily",
    name:p.name,
    base:p.base,
    date,
    mainProject,
    projects,
    payBase:$("d_payBase").value,
    incentive:$("d_incentive").value,
    fuel:$("d_fuel").value,
    highway:$("d_highway").value,
    parking:$("d_parking").value,
    otherCost:$("d_otherCost").value,
    salesTotal: sales,
    profit: profit,
    memo:$("d_memo").value.trim(),
    odoDiff,
    createdAt: new Date().toISOString(),
  };

  await idbPut(STORE_DAILY, rec);
  toast("日報を保存しました（任意）");
}

async function calcOdoDiffForDate(name, base, date){
  if(!date) return 0;
  const all = await idbGetAll(STORE_TENKO);
  const target = all.filter(t => t.name===name && t.base===base && (t.at||"").slice(0,10)===date);
  const dep = target.find(t=>t.type==="departure");
  const arr = target.find(t=>t.type==="arrival");
  const diff = safeNum(arr?.odoEnd) - safeNum(dep?.odoStart);
  return diff>0 ? diff : 0;
}

// ---- Find dep/arr for today ----
async function getPairByDate(name, base, date){
  const all = await idbGetAll(STORE_TENKO);
  const target = all.filter(t => t.name===name && t.base===base && (t.at||"").slice(0,10)===date);
  const dep = target.filter(t=>t.type==="departure").sort((a,b)=>String(b.at).localeCompare(String(a.at)))[0] || null;
  const arr = target.filter(t=>t.type==="arrival").sort((a,b)=>String(b.at).localeCompare(String(a.at)))[0] || null;
  return {dep, arr};
}

async function getDailyByDate(name, base, date){
  const all = await idbGetAll(STORE_DAILY);
  const target = all.filter(d => d.name===name && d.base===base && (d.date||"")===date);
  // 最後に保存したものを採用
  return target.sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)))[0] || null;
}

// ---- PDF today ----
async function pdfToday(){
  const p = await idbGet(STORE_PROFILE, "me");
  if(!p){ toast("先に基本情報を保存してください"); return; }

  // 基準日：日報の日付があればそれ、なければ点呼日時から今日
  const date = $("d_date").value || ($("t_at").value || "").slice(0,10) || new Date().toISOString().slice(0,10);

  const { dep, arr } = await getPairByDate(p.name, p.base, date);
  const daily = await getDailyByDate(p.name, p.base, date);
  const odoDiff = safeNum(arr?.odoEnd) - safeNum(dep?.odoStart);
  const km = odoDiff>0 ? odoDiff : 0;

  // files for pdf embedding (NOT saved)
  const files = {
    licenseImg: $("p_licenseImg").files?.[0] || null,
    alcDepImg: $("t_alcImg").files?.[0] || null, // 今のフォームは1つだけだが、出発/帰着を分けたい場合は拡張可
    alcArrImg: null
  };

  // 1ファイルだけの場合、出発/帰着どちらかに寄せる
  // depが存在すれば出発として扱い、なければ帰着として扱う
  if(dep && !arr){
    files.alcDepImg = $("t_alcImg").files?.[0] || null;
  }else if(arr && !dep){
    files.alcDepImg = null;
    files.alcArrImg = $("t_alcImg").files?.[0] || null;
  }else{
    // dep/arr両方ある場合は、写真を1枚しか選べないので出発側に入れる
    files.alcDepImg = $("t_alcImg").files?.[0] || null;
  }

  await generateTodayPdf({ profile:p, dep, arr, daily, odoDiff: km, files });
  toast("PDFを生成しました。共有からLINE送信できます。");
}

// ---- History search ----
function renderHistory({tenkoHit, dailyHit}){
  const list = $("historyList");
  list.innerHTML = "";

  const sec1 = document.createElement("div");
  sec1.className = "card";
  sec1.style.boxShadow="none";
  sec1.innerHTML = `<div class="h2">点呼（${tenkoHit.length}件）</div>`;
  list.appendChild(sec1);

  tenkoHit.slice(0, 100).forEach(r=>{
    const div = document.createElement("div");
    div.className="card";
    div.style.boxShadow="none";
    div.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap">
        <div style="font-weight:900">${r.type==="departure"?"出発":"帰着"} / ${fmtDateTime(r.at)}</div>
        <div class="badge">${r.base} / ${r.name}</div>
      </div>
      <div class="small">アルコール：${r.alcValue||""}　ODO差：${r.odoDiff||0} km　異常：${r.abnormal||""}</div>
    `;
    list.appendChild(div);
  });

  const sec2 = document.createElement("div");
  sec2.className = "card";
  sec2.style.boxShadow="none";
  sec2.innerHTML = `<div class="h2">日報（${dailyHit.length}件）</div>`;
  list.appendChild(sec2);

  dailyHit.slice(0, 100).forEach(r=>{
    const div = document.createElement("div");
    div.className="card";
    div.style.boxShadow="none";
    div.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap">
        <div style="font-weight:900">${r.date || "(日付未入力)"} / ${r.mainProject||"(案件未入力)"}</div>
        <div class="badge">${r.base} / ${r.name}</div>
      </div>
      <div class="small">走行距離：${r.odoDiff||0} km　売上：${r.salesTotal||0}　差引：${r.profit||0}</div>
    `;
    list.appendChild(div);
  });

  const tip = document.createElement("div");
  tip.className="small";
  tip.style.margin="10px 0";
  tip.textContent = "※表示は最大100件（CSVは全件出力）";
  list.appendChild(tip);
}

async function doSearch(){
  const filters = {
    from:$("h_from").value,
    to:$("h_to").value,
    base:$("h_base").value.trim(),
    name:$("h_name").value.trim(),
  };
  const res = await searchRecords(filters);
  renderHistory(res);
}

// ---- Events ----
window.addEventListener("DOMContentLoaded", async ()=>{
  renderChecklist();
  await loadProfileToForm();

  // tabs
  document.querySelectorAll(".tab").forEach(btn=>{
    btn.addEventListener("click", ()=> setTab(btn.dataset.tab));
  });

  $("btnSaveProfile").addEventListener("click", saveProfile);
  $("btnResetProfile").addEventListener("click", resetProfile);

  $("btnAutoFillNow").addEventListener("click", ()=>{
    $("t_at").value = nowLocalDatetime();
    toast("点呼日時に現在時刻を入れました（必要なら手で修正してください）");
  });

  $("t_odoStart").addEventListener("input", calcOdoDiff);
  $("t_odoEnd").addEventListener("input", calcOdoDiff);

  $("btnSaveTenko").addEventListener("click", saveTenko);

  $("btnAddProject").addEventListener("click", ()=> addProjectRow());
  ["d_payBase","d_incentive","d_fuel","d_highway","d_parking","d_otherCost"].forEach(id=>{
    $(id).addEventListener("input", calcDailyMoney);
  });

  $("btnSaveDaily").addEventListener("click", saveDaily);

  $("btnGoDaily").addEventListener("click", ()=> setTab("daily"));
  $("btnGoTenko").addEventListener("click", ()=> setTab("tenko"));

  $("btnPdfToday").addEventListener("click", pdfToday);

  $("btnSearch").addEventListener("click", doSearch);
  $("btnCsv").addEventListener("click", async ()=>{
    const filters = {
      from:$("h_from").value,
      to:$("h_to").value,
      base:$("h_base").value.trim(),
      name:$("h_name").value.trim(),
    };
    await exportCsvSearchResult(filters);
    toast("CSVを出力しました（点呼/日報）");
  });

  // 初期：日付を今日に
  const today = new Date().toISOString().slice(0,10);
  $("d_date").value = today;
  $("h_from").value = today;
  $("h_to").value = today;

  // 案件1行を最初から作っておく（任意）
  addProjectRow();
});
