// js/index.js
// ドライバー側 点呼・日報 完全版

/* =========================
   DOM取得
========================= */
const $ = id => document.getElementById(id);

/* =========================
   プロフィール
========================= */

async function saveProfile(){
  const required = ["p_name","p_base","p_license","p_phone","p_email"];
  for(const id of required){
    if(!$(id).value){
      alert("必須項目が未入力です");
      return;
    }
  }

  const profile = {
    id: "me",
    name: $("p_name").value,
    base: $("p_base").value,
    carNo: $("p_car").value,
    licenseNo: $("p_license").value,
    phone: $("p_phone").value,
    email: $("p_email").value
  };

  await idbPut("profile", profile);
  alert("基本情報を保存しました");
}

async function loadProfile(){
  const p = await idbGet("profile","me");
  if(!p) return;
  $("p_name").value = p.name || "";
  $("p_base").value = p.base || "";
  $("p_car").value  = p.carNo || "";
  $("p_license").value = p.licenseNo || "";
  $("p_phone").value = p.phone || "";
  $("p_email").value = p.email || "";
}

/* =========================
   日常点検（チェック取得）
========================= */

function getChecklist(){
  return Array.from(document.querySelectorAll(".chkItem")).map(el => ({
    label: el.dataset.label,
    ok: el.checked
  }));
}

/* =========================
   点呼保存（出発 / 帰着）
========================= */

async function saveTenko(type){
  const profile = await idbGet("profile","me");
  if(!profile){
    alert("先に基本情報を保存してください");
    return;
  }

  const at = $("t_at").value;
  if(!at){
    alert("点呼日時は必須です");
    return;
  }

  const tenko = {
    id: `${type}_${Date.now()}`,
    type, // departure / arrival
    at,
    name: profile.name,
    base: profile.base,
    carNo: profile.carNo,
    licenseNo: profile.licenseNo,
    phone: profile.phone,
    email: profile.email,

    method: $("t_method").value,
    sleep: $("t_sleep").value,
    temp: $("t_temp").value,
    condition: $("t_condition").value,
    fatigue: $("t_fatigue").value,

    med: $("t_med").value,
    medDetail: $("t_med_detail").value,

    alcValue: $("t_alc").value,
    alcJudge: $("t_alc_judge").value,

    odoStart: type==="departure" ? $("t_odo_start").value : "",
    odoEnd:   type==="arrival"   ? $("t_odo_end").value   : "",

    abnormal: $("t_abn").value,
    abnormalDetail: $("t_abn_detail").value,

    checklist: getChecklist(),
    checkMemo: $("t_check_memo").value
  };

  await idbPut("tenko", tenko);
  alert(type==="departure" ? "出発点呼を保存しました" : "帰着点呼を保存しました");
}

/* =========================
   日報保存（完全オプション）
========================= */

async function saveDaily(){
  const profile = await idbGet("profile","me");
  if(!profile){
    alert("先に基本情報を保存してください");
    return;
  }

  const date = $("d_date").value;
  if(!date){
    alert("稼働日だけは必須です");
    return;
  }

  const daily = {
    id: `daily_${Date.now()}`,
    date,
    name: profile.name,
    base: profile.base,

    mainProject: $("d_project").value,

    payBase: Number($("d_pay").value || 0),
    incentive: Number($("d_incentive").value || 0),

    fuel: Number($("d_fuel").value || 0),
    highway: Number($("d_highway").value || 0),
    parking: Number($("d_parking").value || 0),
    otherCost: Number($("d_other").value || 0),

    memo: $("d_memo").value
  };

  daily.salesTotal = daily.payBase + daily.incentive;
  daily.costTotal  = daily.fuel + daily.highway + daily.parking + daily.otherCost;
  daily.profit     = daily.salesTotal - daily.costTotal;

  await idbPut("daily", daily);
  alert("日報を保存しました（任意項目）");
}

/* =========================
   PDF生成
========================= */

async function generateTodayPdf(){
  const profile = await idbGet("profile","me");
  if(!profile){
    alert("基本情報が未保存です");
    return;
  }

  const tenko = await idbGetAll("tenko");
  const daily = await idbGetAll("daily");

  const today = new Date().toISOString().slice(0,10);

  const dep = tenko.find(t => t.type==="departure" && t.at.startsWith(today));
  const arr = tenko.find(t => t.type==="arrival"   && t.at.startsWith(today));
  const dly = daily.find(d => d.date === today);

  let odoDiff = 0;
  if(dep && arr){
    odoDiff = Number(arr.odoEnd||0) - Number(dep.odoStart||0);
    if(odoDiff < 0) odoDiff = 0;
  }

  await generateTodayPdf({
    profile,
    dep,
    arr,
    daily: dly,
    odoDiff,
    files:{
      licenseImg: $("f_license").files[0],
      alcDepImg:  $("f_alc_dep").files[0],
      alcArrImg:  $("f_alc_arr").files[0]
    }
  });
}

/* =========================
   初期処理
========================= */

document.addEventListener("DOMContentLoaded", () => {
  loadProfile();
});
