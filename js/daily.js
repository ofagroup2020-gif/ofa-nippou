// js/daily.js
// 日報ロジック（任意入力・複数案件・自動計算・IndexedDB対応）

/*
  想定データ構造（STORE_DAILY）
  {
    id,              // "daily_YYYY-MM-DD"
    date,            // "YYYY-MM-DD"
    name,
    base,
    odoDiff,         // km（出発/帰着ODO差分）
    mainProject,     // メイン案件名（表示用）
    projects: [      // 複数案件
      { name, qty, unit, amount }
    ],
    payBase,
    incentive,
    fuel,
    highway,
    parking,
    otherCost,
    salesTotal,
    profit,
    memo
  }
*/

function todayKey(){
  const d = new Date();
  return d.toISOString().slice(0,10);
}

/* ---------- 案件管理 ---------- */

const projects = [];

function addProject(){
  projects.push({ name:"", qty:"", unit:"", amount:0 });
  renderProjects();
}

function removeProject(idx){
  projects.splice(idx,1);
  renderProjects();
}

function updateProject(idx, key, val){
  projects[idx][key] = val;
  if(key==="qty" || key==="unit"){
    const q = Number(projects[idx].qty)||0;
    const u = Number(projects[idx].unit)||0;
    projects[idx].amount = q * u;
  }
  renderProjects();
  calcDaily();
}

function renderProjects(){
  const box = document.getElementById("projectsBox");
  if(!box) return;

  box.innerHTML = "";
  projects.forEach((p, i)=>{
    const row = document.createElement("div");
    row.className = "projectRow";
    row.innerHTML = `
      <input placeholder="案件名" value="${p.name||""}"
        onchange="updateProject(${i},'name',this.value)">
      <input type="number" placeholder="数量" value="${p.qty||""}"
        onchange="updateProject(${i},'qty',this.value)">
      <input type="number" placeholder="単価" value="${p.unit||""}"
        onchange="updateProject(${i},'unit',this.value)">
      <input placeholder="金額" value="${p.amount||0}" disabled>
      <button onclick="removeProject(${i})">削除</button>
    `;
    box.appendChild(row);
  });
}

/* ---------- 自動計算 ---------- */

function calcDaily(){
  const payBase   = Number(document.getElementById("payBase")?.value)||0;
  const incentive = Number(document.getElementById("incentive")?.value)||0;
  const fuel      = Number(document.getElementById("fuel")?.value)||0;
  const highway   = Number(document.getElementById("highway")?.value)||0;
  const parking   = Number(document.getElementById("parking")?.value)||0;
  const otherCost = Number(document.getElementById("otherCost")?.value)||0;

  const projectSum = projects.reduce((s,p)=> s + (Number(p.amount)||0), 0);
  const salesTotal = payBase + incentive + projectSum;
  const costTotal  = fuel + highway + parking + otherCost;
  const profit     = salesTotal - costTotal;

  setVal("salesTotal", salesTotal);
  setVal("profit", profit);
}

function setVal(id, v){
  const el = document.getElementById(id);
  if(el) el.value = v;
}

/* ---------- 保存 ---------- */

async function saveDaily(profile, odoDiff){
  const date = document.getElementById("dailyDate")?.value || todayKey();

  const daily = {
    id: "daily_"+date,
    date,
    name: profile.name,
    base: profile.base,
    odoDiff: Number(odoDiff)||0,
    mainProject: document.getElementById("mainProject")?.value || "",
    projects: JSON.parse(JSON.stringify(projects)),
    payBase: Number(getVal("payBase")),
    incentive: Number(getVal("incentive")),
    fuel: Number(getVal("fuel")),
    highway: Number(getVal("highway")),
    parking: Number(getVal("parking")),
    otherCost: Number(getVal("otherCost")),
    salesTotal: Number(getVal("salesTotal")),
    profit: Number(getVal("profit")),
    memo: document.getElementById("dailyMemo")?.value || ""
  };

  await idbPut(STORE_DAILY, daily);
  alert("日報を保存しました（必須入力なし）");
}

function getVal(id){
  return document.getElementById(id)?.value || 0;
}

/* ---------- CSV（今日分） ---------- */

async function exportTodayDailyCsv(){
  const date = todayKey();
  const daily = await idbGet(STORE_DAILY, "daily_"+date);
  if(!daily){
    alert("今日の日報データがありません");
    return;
  }
  const csv = buildDailyCsv([daily]);
  downloadText(`OFA_日報_${date}.csv`, csv);
}

/* ---------- 初期化 ---------- */

function initDaily(){
  addProject(); // 最初は1行出す
  const inputs = [
    "payBase","incentive","fuel","highway","parking","otherCost"
  ];
  inputs.forEach(id=>{
    const el = document.getElementById(id);
    if(el) el.addEventListener("input", calcDaily);
  });
}
