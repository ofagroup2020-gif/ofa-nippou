// app-daily.js
import { auth, db, watchAuth } from "./app-auth.js";
import { PROJECT_PRESETS } from "./config.js";
import { $, toast, todayISO, nowTime, clearErrors, requireValue, requireNumber, toMinutes } from "./app-common.js";

import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { getStorage, ref as sRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js";
const storage = getStorage();

let projects=[{name:"",area:"",note:""}];

function projectRow(i, preset=""){
  const opts = [`<option value="">選択</option>`].concat(PROJECT_PRESETS.map(p=>`<option ${p===preset?"selected":""}>${p}</option>`));
  return `
    <div class="card" style="border:1px dashed #e6ecf7;padding:12px;margin:10px 0;">
      <div class="row" style="justify-content:space-between;">
        <b>案件 #${i+1}</b>
        <button class="btnSmall btnDanger" type="button" data-remove="${i}">削除</button>
      </div>
      <div class="grid2">
        <div>
          <label>案件名 <span class="req">*</span></label>
          <select data-pname="${i}">${opts.join("")}</select>
        </div>
        <div>
          <label>エリア/コース <span class="req">*</span></label>
          <input data-parea="${i}" placeholder="例：姶良 / 東区" />
        </div>
      </div>
      <label>メモ</label>
      <input data-pnote="${i}" placeholder="任意" />
    </div>
  `;
}
function renderProjects(){
  $("projectsBox").innerHTML = projects.map((p,i)=>projectRow(i,p.name)).join("");
  document.querySelectorAll("[data-remove]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      projects.splice(Number(btn.getAttribute("data-remove")),1);
      if(projects.length===0) projects.push({name:"",area:"",note:""});
      renderProjects();
    });
  });
}
function readProjects(){
  return projects.map((_,i)=>({
    name:(document.querySelector(`[data-pname="${i}"]`)?.value||"").trim(),
    area:(document.querySelector(`[data-parea="${i}"]`)?.value||"").trim(),
    note:(document.querySelector(`[data-pnote="${i}"]`)?.value||"").trim(),
  }));
}

function sumMoney(){
  const payDaily = Number(($("payDaily").value||0));
  const payInc = Number(($("payIncentive").value||0));
  const payTotal = (payDaily+payInc);
  $("payTotal").value = isFinite(payTotal) ? String(payTotal) : "";

  const toll=Number(($("costToll").value||0));
  const park=Number(($("costParking").value||0));
  const fuel=Number(($("costFuel").value||0));
  const other=Number(($("costOther").value||0));
  const costTotal = toll+park+fuel+other;
  $("costTotal").value = isFinite(costTotal) ? String(costTotal) : "";

  const profit = payTotal - costTotal;
  $("profit").value = isFinite(profit) ? String(profit) : "";
}

async function uploadMany(files, prefix){
  const arr=[];
  for(const f of files){
    const r = sRef(storage, `${prefix}/${Date.now()}_${Math.random().toString(16).slice(2)}_${f.name}`);
    await uploadBytes(r, f);
    arr.push(await getDownloadURL(r));
  }
  return arr;
}

let sending=false;

async function submit(){
  if(sending) return;
  sending=true; clearErrors(document);

  try{
    const user=auth.currentUser;
    if(!user) throw new Error("ログインしてください");

    const workDate=requireValue($("workDate"),"稼働日");
    const driverName=requireValue($("driverName"),"運転者氏名");

    const projs=readProjects();
    if(projs.some(p=>!p.name || !p.area)) throw new Error("案件（案件名・エリア）は全て必須です");

    const startTime=requireValue($("startTime"),"稼働開始");
    const endTime=requireValue($("endTime"),"稼働終了");
    const breakMinutes=requireNumber($("breakMinutes"),"休憩時間");

    // 稼働時間（分）自動
    const startMin=toMinutes(startTime);
    const endMin=toMinutes(endTime);
    let workMinutes = endMin - startMin;
    if(workMinutes < 0) workMinutes += 24*60; // 日跨ぎ対応
    if(workMinutes < 0) workMinutes = 0;

    const deliveries=requireNumber($("deliveries"),"配達個数");
    const claimFlag=requireValue($("claimFlag"),"クレーム");
    const claimDetail=($("claimDetail").value||"").trim();
    if(claimFlag==="あり" && !claimDetail){
      $("claimDetail").classList.add("isError");
      throw new Error("クレーム内容を入力してください");
    }

    const payDaily=requireNumber($("payDaily"),"日当");
    const payIncentive=Number(($("payIncentive").value||0));
    const payTotal=payDaily + (isFinite(payIncentive)?payIncentive:0);

    const toll=Number(($("costToll").value||0));
    const park=Number(($("costParking").value||0));
    const fuel=Number(($("costFuel").value||0));
    const other=Number(($("costOther").value||0));
    const costTotal=(toll+park+fuel+other);

    const accidentFlag=requireValue($("accidentFlag"),"事故/物損");
    const accidentDetail=($("accidentDetail").value||"").trim();
    if(accidentFlag==="あり" && !accidentDetail){
      $("accidentDetail").classList.add("isError");
      throw new Error("事故/物損 内容を入力してください");
    }
    const delayReason=requireValue($("delayReason"),"遅延理由");
    const tomorrowPlan=requireValue($("tomorrowPlan"),"明日の稼働予定");

    const distanceKm=Number(($("distanceKm").value||0));
    const absent=Number(($("absent").value||0));
    const redelivery=Number(($("redelivery").value||0));
    const returns=Number(($("returns").value||0));
    const note=($("note").value||"").trim();

    toast("送信中…（データ保存）");
    const docRef=await addDoc(collection(db,"daily"),{
      uid:user.uid,email:user.email||null,
      workDate,
      driverName,
      projects:projs,

      startTime,endTime,
      workMinutes,
      breakMinutes,

      distanceKm,
      deliveries,
      absent,
      redelivery,
      returns,

      claimFlag,
      claimDetail: claimFlag==="あり" ? claimDetail : "",

      payDaily,
      payIncentive: isFinite(payIncentive)?payIncentive:0,
      payTotal,
      costToll: isFinite(toll)?toll:0,
      costParking: isFinite(park)?park:0,
      costFuel: isFinite(fuel)?fuel:0,
      costOther: isFinite(other)?other:0,
      costTotal,
      profit: payTotal - costTotal,

      accidentFlag,
      accidentDetail: accidentFlag==="あり" ? accidentDetail : "",
      delayReason,
      tomorrowPlan,

      note,

      createdAt: serverTimestamp()
    });

    toast("送信中…（写真アップ）");
    const photos = Array.from($("reportPhotos").files||[]);
    if(photos.length){
      const urls = await uploadMany(photos, `daily/${docRef.id}/reportPhotos`);
      const { doc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js");
      await setDoc(doc(db,"daily",docRef.id), { reportPhotoUrls: urls }, {merge:true});
    }

    toast("送信完了",true);
    setTimeout(()=>location.href="./index.html",700);
  }catch(e){
    toast(e?.message||"送信に失敗しました");
  }finally{
    sending=false;
  }
}

watchAuth((user)=>{
  $("dot").classList.remove("ng"); $("dot").classList.add("ok");
  $("state").textContent="ログイン中";
  $("who").textContent=user.email||"(no email)";
}, ()=>location.href="./index.html");

document.addEventListener("DOMContentLoaded", ()=>{
  $("backBtn").addEventListener("click", ()=>location.href="./index.html");
  $("workDate").value = todayISO();
  renderProjects();
  $("addProjectBtn").addEventListener("click", ()=>{projects.push({name:"",area:"",note:""});renderProjects();});
  ["payDaily","payIncentive","costToll","costParking","costFuel","costOther"].forEach(id=>{
    $(id).addEventListener("input", sumMoney);
  });
  sumMoney();
  $("submitBtn").addEventListener("click", submit);
});
