/* ============================
   OFA 点呼アプリ main app.js
   ============================ */

// ---------- util ----------
const $ = (id) => document.getElementById(id);
const today = () => new Date().toISOString().slice(0,10);
const uuid = () => Date.now() + "_" + Math.random().toString(36).slice(2);

function alertReq(msg){
  alert("【入力エラー】\n" + msg);
}

// ---------- tab ----------
document.querySelectorAll(".tab").forEach(tab=>{
  tab.addEventListener("click", ()=>{
    document.querySelectorAll(".tab").forEach(t=>t.classList.remove("active"));
    document.querySelectorAll(".card").forEach(c=>c.classList.add("hidden"));
    tab.classList.add("active");
    $(tab.dataset.tab).classList.remove("hidden");
  });
});

// ---------- status ----------
function setStatus(text){
  $("statusText").textContent = text;
}
function setKm(km){
  $("statusKm").textContent = km ? `${km} km` : "- km";
}
function setDay(d){
  $("statusDay").textContent = d || "-";
}

// ---------- checklist master ----------
const CHECK_ITEMS = [
  "タイヤ空気圧","タイヤ溝/ひび割れ","ホイールナット",
  "ブレーキ","パーキングブレーキ","ハンドル操作",
  "ライト類","ワイパー/ウォッシャー","ミラー/ガラス",
  "エンジンオイル","冷却水","バッテリー",
  "異音/異臭","漏れ","外装破損","積載状態",
  "消火器","三角停止板","反射ベスト"
];

function buildChecklist(el){
  el.innerHTML = "";
  CHECK_ITEMS.forEach((label,i)=>{
    const row = document.createElement("div");
    row.className = "checkrow";
    row.innerHTML = `
      <span>${label}</span>
      <select data-label="${label}">
        <option value="OK">OK</option>
        <option value="NG">NG</option>
      </select>
    `;
    el.appendChild(row);
  });
}
buildChecklist($("dep_checklist"));
buildChecklist($("arr_checklist"));

// ---------- projects ----------
let projects = [];
$("btnAddProject").onclick = ()=>{
  const id = uuid();
  projects.push({id,name:""});
  renderProjects();
};
function renderProjects(){
  const box = $("projectList");
  box.innerHTML = "";
  projects.forEach(p=>{
    const d = document.createElement("div");
    d.className = "projectItem";
    d.innerHTML = `
      <input value="${p.name}" placeholder="案件名">
      <button type="button">削除</button>
    `;
    d.querySelector("input").oninput = e=>p.name=e.target.value;
    d.querySelector("button").onclick = ()=>{
      projects = projects.filter(x=>x.id!==p.id);
      renderProjects();
    };
    box.appendChild(d);
  });
}

// ---------- profile ----------
$("btnSaveProfile").onclick = async ()=>{
  const req = ["p_name","p_base","p_carNo","p_licenseNo","p_phone","p_email"];
  for(const id of req){
    if(!$(id).value){ alertReq("基本情報が未入力です"); return; }
  }
  await idbPut("profile",{
    id:"me",
    name:$("p_name").value,
    base:$("p_base").value,
    carNo:$("p_carNo").value,
    licenseNo:$("p_licenseNo").value,
    phone:$("p_phone").value,
    email:$("p_email").value
  });
  setStatus("基本情報 保存済");
};
$("btnClearProfile").onclick = async ()=>{
  if(!confirm("基本情報を削除しますか？")) return;
  await idbDelete("profile","me");
  location.reload();
};

// load profile
(async()=>{
  const p = await idbGet("profile","me");
  if(p){
    $("p_name").value=p.name||"";
    $("p_base").value=p.base||"";
    $("p_carNo").value=p.carNo||"";
    $("p_licenseNo").value=p.licenseNo||"";
    $("p_phone").value=p.phone||"";
    $("p_email").value=p.email||"";
    setStatus("基本情報 読み込み済");
  }
})();

// ---------- save tenko ----------
async function saveTenko(type){
  const profile = await idbGet("profile","me");
  if(!profile){ alertReq("先に基本情報を保存してください"); return; }

  const isDep = type==="departure";
  const at = isDep ? $("dep_at").value : $("arr_at").value;
  if(!at){ alertReq("点呼日時は必須です"); return; }

  const checklistEl = isDep ? $("dep_checklist") : $("arr_checklist");
  const checklist = [...checklistEl.querySelectorAll("select")].map(s=>({
    label:s.dataset.label,
    ok:s.value==="OK"
  }));

  const odoStart = isDep ? $("dep_odoStart").value : "";
  const odoEnd   = !isDep ? $("arr_odoEnd").value : "";

  const rec = {
    id: uuid(),
    type,
    at,
    name: profile.name,
    base: profile.base,
    carNo: profile.carNo,
    licenseNo: profile.licenseNo,
    phone: profile.phone,
    email: profile.email,
    method: isDep ? $("dep_method").value : $("arr_method").value,
    sleep: isDep ? $("dep_sleep").value : "",
    temp: isDep ? $("dep_temp").value : $("arr_temp").value,
    condition: isDep ? $("dep_condition").value : $("arr_condition").value,
    fatigue: isDep ? $("dep_fatigue").value : $("arr_fatigue").value,
    med: isDep ? $("dep_med").value : $("arr_med").value,
    medDetail: isDep ? $("dep_medDetail").value : $("arr_medDetail").value,
    alcValue: isDep ? $("dep_alcValue").value : $("arr_alcValue").value,
    alcJudge: isDep ? $("dep_alcJudge").value : $("arr_alcJudge").value,
    abnormal: isDep ? $("dep_abnormal").value : $("arr_abnormal").value,
    abnormalDetail: isDep ? $("dep_abnormalDetail").value : $("arr_abnormalDetail").value,
    odoStart,
    odoEnd,
    checklist,
    checkMemo: isDep ? $("dep_checkMemo").value : $("arr_checkMemo").value,
    projects: [...projects]
  };

  await idbPut("tenko", rec);
  setStatus(`${isDep?"出発":"帰着"}点呼 保存済`);
  setDay(at.slice(0,10));
}

// buttons
$("btnSaveDep").onclick = ()=>saveTenko("departure");
$("btnSaveArr").onclick = ()=>saveTenko("arrival");

// ---------- daily ----------
$("btnSaveDaily").onclick = async ()=>{
  const profile = await idbGet("profile","me");
  if(!profile){ alertReq("基本情報が未入力です"); return; }

  const d = {
    id: uuid(),
    date: $("d_date").value || today(),
    name: profile.name,
    base: profile.base,
    mainProject: $("d_mainProject").value,
    payBase: $("d_payBase").value,
    incentive: $("d_incentive").value,
    fuel: $("d_fuel").value,
    highway: $("d_highway").value,
    parking: $("d_parking").value,
    otherCost: $("d_otherCost").value,
    memo: $("d_memo").value
  };
  await idbPut("daily", d);
  setStatus("日報 保存済（任意）");
};

// ---------- history ----------
$("btnHistorySearch").onclick = async ()=>{
  const res = await searchRecords({
    from:$("h_from").value,
    to:$("h_to").value,
    base:$("h_base").value,
    name:$("h_name").value
  });
  const box = $("historyResult");
  box.innerHTML="";
  res.tenkoHit.forEach(r=>{
    const div=document.createElement("div");
    div.className="item";
    div.textContent=`${r.at.slice(0,10)} ${r.name} ${r.type==="departure"?"出発":"帰着"}`;
    box.appendChild(div);
  });
};

$("btnHistoryCsv").onclick = ()=>{
  exportCsvSearchResult({
    from:$("h_from").value,
    to:$("h_to").value,
    base:$("h_base").value,
    name:$("h_name").value
  });
};

// ---------- backup ----------
$("btnBackupCsv").onclick = ()=>{
  exportCsvSearchResult({});
};
$("btnDangerWipe").onclick = async ()=>{
  if(!confirm("全データ削除します。戻せません。")) return;
  indexedDB.deleteDatabase("ofa_nippou_db");
  alert("削除しました。再読み込みします。");
  location.reload();
};
