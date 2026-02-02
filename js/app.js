// js/app.js
// OFA 点呼 / 日報（ドライバー）メイン制御
"use strict";

document.addEventListener("DOMContentLoaded", init);

async function init(){
  bindProfile();
  bindTenko();
  bindDaily();
  bindHistory();
  await restoreProfile();
  await renderHistory();
}

/* ========= 基本情報 ========= */
function bindProfile(){
  qs("#btnSaveProfile")?.addEventListener("click", saveProfileUI);
  qs("#btnLoadProfile")?.addEventListener("click", restoreProfile);
}

async function saveProfileUI(){
  const profile = {
    name: v("#p_name"),
    base: v("#p_base"),
    carNo: v("#p_carNo"),
    licenseNo: v("#p_licenseNo"),
    phone: v("#p_phone"),
    email: v("#p_email"),
  };
  if(!profile.name || !profile.base || !profile.phone){
    alert("氏名・拠点・電話番号は必須です");
    return;
  }
  await window.dbApi.saveProfile(profile);
  setState("#profileState","保存済","#dotProfile","ok");
}

async function restoreProfile(){
  const p = await window.dbApi.loadProfile();
  if(!p) return;
  set("#p_name",p.name);
  set("#p_base",p.base);
  set("#p_carNo",p.carNo);
  set("#p_licenseNo",p.licenseNo);
  set("#p_phone",p.phone);
  set("#p_email",p.email);
  setState("#profileState","保存済","#dotProfile","ok");
}

/* ========= 点呼 ========= */
function bindTenko(){
  qs("#btnSaveDep")?.addEventListener("click", ()=>saveTenko("departure"));
  qs("#btnSaveArr")?.addEventListener("click", ()=>saveTenko("arrival"));
}

async function saveTenko(type){
  const p = await window.dbApi.loadProfile();
  if(!p){ alert("基本情報を保存してください"); return; }

  const data = {
    type,
    at: type==="departure"?v("#d_at"):v("#a_at"),
    method: type==="departure"?v("#d_method"):v("#a_method"),
    odoStart: type==="departure"?v("#d_odoStart"):undefined,
    odoEnd: type==="arrival"?v("#a_odoEnd"):undefined,
    alcValue: type==="departure"?v("#d_alcValue"):v("#a_alcValue"),
    alcJudge: type==="departure"?v("#d_alcJudge"):v("#a_alcJudge"),
    abnormal: type==="departure"?v("#d_abnormal"):v("#a_abnormal"),
    name: p.name,
    base: p.base,
    phone: p.phone,
  };
  if(!data.at){ alert("点呼日時は必須です"); return; }
  await window.dbApi.addTenko(data);
  alert("点呼を保存しました");
  await renderHistory();
}

/* ========= 日報 ========= */
function bindDaily(){
  qs("#btnAddProject")?.addEventListener("click", addProjectRow);
}

async function saveDaily(){
  const p = await window.dbApi.loadProfile();
  if(!p){ alert("基本情報を保存してください"); return; }

  const daily = {
    date: v("#r_date"),
    salesTotal: num("#r_payBase")+num("#r_incentive"),
    costTotal: num("#r_fuel")+num("#r_highway")+num("#r_parking")+num("#r_otherCost"),
    profit: (num("#r_payBase")+num("#r_incentive")) -
             (num("#r_fuel")+num("#r_highway")+num("#r_parking")+num("#r_otherCost")),
    memo: v("#r_memo"),
    name: p.name,
    base: p.base,
    phone: p.phone,
  };
  await window.dbApi.addDaily(daily);
  alert("日報を保存しました");
  await renderHistory();
}

/* ========= 履歴 ========= */
function bindHistory(){
  qs("#btnReloadHistory")?.addEventListener("click", renderHistory);
  qs("#btnClearAll")?.addEventListener("click", async ()=>{
    if(confirm("全削除しますか？")){
      await window.dbApi.clearAll();
      await renderHistory();
    }
  });
}

async function renderHistory(){
  const box = qs("#historyBox");
  if(!box) return;
  const tenko = await window.dbApi.getAllTenko();
  box.innerHTML = tenko.map(t=>`
    <div class="histItem">
      <div class="histTop">
        <div class="histTitle">点呼：${t.at} / ${t.type}</div>
        <button class="miniBtn danger" data-id="${t.id}">削除</button>
      </div>
      <div class="histBody">${t.name} / ${t.base}</div>
    </div>
  `).join("") || "<p class='note'>履歴はまだありません</p>";

  box.querySelectorAll("button[data-id]").forEach(btn=>{
    btn.onclick = async ()=>{
      await window.dbApi.deleteTenko(Number(btn.dataset.id));
      await renderHistory();
    };
  });
}

/* ========= util ========= */
function qs(s){ return document.querySelector(s); }
function v(s){ return qs(s)?.value || ""; }
function set(s,val){ if(qs(s)) qs(s).value = val||""; }
function num(s){ return Number(v(s))||0; }
function setState(t,msg,dot,cls){
  if(qs(t)) qs(t).textContent = msg;
  if(qs(dot)) qs(dot).className = "dot "+cls;
}
function addProjectRow(){
  const box = qs("#projectsBox");
  if(!box) return;
  box.insertAdjacentHTML("beforeend",
    `<div class="pjRow"><input placeholder="案件名（任意）"></div>`);
}
