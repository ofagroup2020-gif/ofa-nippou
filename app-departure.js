// app-departure.js
import { auth, db, watchAuth } from "./app-auth.js";
import { BASES, PROJECT_PRESETS } from "./config.js";
import { $, toast, todayISO, nowTime, clearErrors, requireValue, requireNumber } from "./app-common.js";

import {
  collection, addDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import {
  getStorage, ref as sRef, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js";

const storage = getStorage();

function setDatetime(){
  const d = new Date();
  $("datetime").value = `${todayISO()} ${nowTime()}`;
}

function fillBases(){
  const sel = $("base");
  sel.innerHTML = `<option value="">選択</option>` + BASES.map(b=>`<option>${b}</option>`).join("");
}

function calcOdo(){
  const a = Number(($("odoStart").value||"").trim());
  const b = Number(($("odoEnd").value||"").trim());
  if(!Number.isNaN(a) && !Number.isNaN(b) && a>0 && b>=a){
    $("odoDiff").value = String(b-a);
  }else{
    $("odoDiff").value = "";
  }
}

function projectRow(i, preset=""){
  const opts = [`<option value="">選択</option>`].concat(PROJECT_PRESETS.map(p=>`<option ${p===preset?"selected":""}>${p}</option>`));
  return `
    <div class="card" style="border:1px dashed #e6ecf7;padding:12px;margin:10px 0;">
      <div class="row" style="justify-content:space-between;">
        <b>稼働案件 #${i+1}</b>
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

let projects = [ {name:"", area:"", note:""} ];

function renderProjects(){
  const box = $("projectsBox");
  box.innerHTML = projects.map((p,i)=>projectRow(i, p.name)).join("");
  box.querySelectorAll("[data-remove]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const idx = Number(btn.getAttribute("data-remove"));
      projects.splice(idx,1);
      if(projects.length===0) projects.push({name:"",area:"",note:""});
      renderProjects();
    });
  });
}

function readProjects(){
  return projects.map((_,i)=>{
    const name = document.querySelector(`[data-pname="${i}"]`)?.value?.trim() || "";
    const area = document.querySelector(`[data-parea="${i}"]`)?.value?.trim() || "";
    const note = document.querySelector(`[data-pnote="${i}"]`)?.value?.trim() || "";
    return { name, area, note };
  });
}

const INSPECTION_ITEMS = [
  // A
  ["tirePressure","タイヤ空気圧"],
  ["tireTread","タイヤ溝/ひび割れ"],
  ["wheelNut","ホイールナット緩み"],
  ["brake","ブレーキ効き"],
  ["parkingBrake","パーキングブレーキ"],
  ["steering","ハンドル操作"],
  ["lights","ライト（前照/尾灯/ブレーキ/ウインカー/ハザード）"],
  ["wiperWasher","ワイパー/ウォッシャー液"],
  ["mirrorGlass","ミラー/ガラス破損"],
  // B
  ["engineOil","エンジンオイル量"],
  ["coolant","冷却水"],
  ["battery","バッテリー（警告灯含む）"],
  ["noiseSmellVibration","異音/異臭/異常振動"],
  ["leak","漏れ（オイル/冷却水）"],
  ["damage","外装破損"],
  ["loadState","積載状態（偏り/過積載なし）"],
  // C
  ["extinguisher","消火器"],
  ["triangle","三角停止板"],
  ["reflectVest","反射ベスト"],
  ["tools","ジャッキ/工具（任意でもOK）"],
];

function renderInspection(){
  const box = $("inspectionBox");
  const rows = INSPECTION_ITEMS.map(([key,label])=>{
    const req = key==="tools" ? "" : `<span class="req">*</span>`;
    return `
      <div class="grid2" style="margin:6px 0;">
        <div class="small"><b>${label}</b> ${req}</div>
        <div>
          <select data-insp="${key}">
            <option value="">選択</option>
            <option>OK</option>
            <option>NG</option>
          </select>
        </div>
      </div>
    `;
  }).join("");
  box.innerHTML = rows;
}

function readInspection(){
  const obj = {};
  let anyNg = false;
  let missingReq = false;

  INSPECTION_ITEMS.forEach(([key,label])=>{
    const v = document.querySelector(`[data-insp="${key}"]`)?.value?.trim() || "";
    obj[key] = v;
    if(key!=="tools" && !v) missingReq = true;
    if(v==="NG") anyNg = true;
  });
  return { obj, anyNg, missingReq };
}

async function uploadOne(file, path){
  const r = sRef(storage, path);
  await uploadBytes(r, file);
  return await getDownloadURL(r);
}
async function uploadMany(files, prefix){
  const arr = [];
  for(const f of files){
    const url = await uploadOne(f, `${prefix}/${Date.now()}_${Math.random().toString(16).slice(2)}_${f.name}`);
    arr.push(url);
  }
  return arr;
}

function bind(){
  $("backBtn").addEventListener("click", ()=>location.href="./index.html");
  $("odoStart").addEventListener("input", calcOdo);
  $("odoEnd").addEventListener("input", calcOdo);

  $("addProjectBtn").addEventListener("click", ()=>{
    projects.push({name:"",area:"",note:""});
    renderProjects();
  });

  $("submitBtn").addEventListener("click", submit);
}

let sending = false;

async function submit(){
  if(sending) return;
  sending = true;
  clearErrors(document);

  try{
    const user = auth.currentUser;
    if(!user) throw new Error("ログインしてください");

    // 必須
    const driverName = requireValue($("driverName"), "運転者氏名");
    const base = requireValue($("base"), "拠点");
    const vehicleNo = requireValue($("vehicleNo"), "車両番号");
    const odoStart = requireNumber($("odoStart"), "出発ODO");
    const odoEnd = requireNumber($("odoEnd"), "帰着ODO");
    if(odoEnd < odoStart) throw new Error("帰着ODOは出発ODO以上で入力してください");
    const odoDiff = odoEnd - odoStart;

    const method = requireValue($("method"), "点呼実施方法");

    const sleepHours = requireNumber($("sleepHours"), "睡眠時間");
    const temp = requireNumber($("temp"), "体温");
    const condition = requireValue($("condition"), "体調");
    const fatigue = requireValue($("fatigue"), "疲労");
    const medicineFlag = requireValue($("medicineFlag"), "服薬");
    const medicineDetail = ($("medicineDetail").value||"").trim();
    if(medicineFlag==="あり" && !medicineDetail){
      $("medicineDetail").classList.add("isError");
      throw new Error("服薬内容を入力してください");
    }

    const drinkFlag = requireValue($("drinkFlag"), "飲酒の有無");
    const alcoholJudge = requireValue($("alcoholJudge"), "酒気帯び有無");
    const alcoholValue = requireNumber($("alcoholValue"), "アルコール数値");

    const licenseNo = requireValue($("licenseNo"), "免許証番号");

    // 業務
    const loadBase = requireValue($("loadBase"), "積込拠点/エリア");
    const dangerous = requireValue($("dangerous"), "危険物・高額品");

    // 案件（複数）
    const projs = readProjects();
    if(projs.some(p=>!p.name || !p.area)){
      throw new Error("稼働案件（案件名・エリア）は全て必須です");
    }

    // 異常
    const abnormalFlag = requireValue($("abnormalFlag"), "異常の有無");
    const abnormalDetail = ($("abnormalDetail").value||"").trim();
    if(abnormalFlag==="あり" && !abnormalDetail){
      $("abnormalDetail").classList.add("isError");
      throw new Error("異常内容を入力してください");
    }

    // 点検
    const insp = readInspection();
    if(insp.missingReq) throw new Error("日常点検の必須項目を全て選択してください");
    const inspectionNgDetail = ($("inspectionNgDetail").value||"").trim();

    // 先にデータ保存（写真は後）
    toast("送信中…（データ保存）");
    const docRef = await addDoc(collection(db,"tenko"), {
      uid: user.uid,
      email: user.email || null,
      type: "start",
      datetimeText: $("datetime").value,
      driverName,
      base,
      vehicleNo,
      odoStart,
      odoEnd,
      odoDiff,
      method,

      sleepHours,
      temp,
      condition,
      fatigue,
      medicineFlag,
      medicineDetail: medicineFlag==="あり" ? medicineDetail : "",
      drinkFlag,
      alcoholJudge,
      alcoholValue,

      licenseNo,

      projects: projs,
      loadBase,
      dangerous,

      abnormalFlag,
      abnormalDetail: abnormalFlag==="あり" ? abnormalDetail : "",

      inspection: insp.obj,
      inspectionHasNg: insp.anyNg,
      inspectionNgDetail: insp.anyNg ? inspectionNgDetail : "",

      createdAt: serverTimestamp()
    });

    // NG時：詳細必須、写真推奨（ここでは“必須推奨”運用。強制したいならここで必須化OK）
    if(insp.anyNg && !inspectionNgDetail){
      $("inspectionNgDetail").classList.add("isError");
      throw new Error("点検にNGがあるため、NG詳細メモは必須です（保存済みなので追記して再送信してください）");
    }

    // 写真アップ（失敗しても tenko 保存は残る）
    toast("送信中…（写真アップ）");
    const updates = {};
    const prefix = `tenko/${docRef.id}`;

    const alcoholFile = $("alcoholPhoto").files?.[0];
    if(alcoholFile){
      updates.alcoholPhotoUrl = await uploadOne(alcoholFile, `${prefix}/alcohol/${alcoholFile.name}`);
    }
    const licenseFile = $("licensePhoto").files?.[0];
    if(licenseFile){
      updates.licensePhotoUrl = await uploadOne(licenseFile, `${prefix}/license/${licenseFile.name}`);
    }
    const abnormalFiles = Array.from($("abnormalPhotos").files||[]);
    if(abnormalFiles.length){
      updates.abnormalPhotoUrls = await uploadMany(abnormalFiles, `${prefix}/abnormal`);
    }
    const ngPhotos = Array.from($("inspectionNgPhotos").files||[]);
    if(ngPhotos.length){
      updates.inspectionNgPhotoUrls = await uploadMany(ngPhotos, `${prefix}/inspectionNg`);
    }

    if(Object.keys(updates).length){
      const { doc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js");
      await setDoc(doc(db,"tenko", docRef.id), updates, {merge:true});
    }

    toast("送信完了", true);
    setTimeout(()=>location.href="./index.html", 700);
  }catch(e){
    toast(e?.message || "送信に失敗しました");
  }finally{
    sending = false;
  }
}

watchAuth((user)=>{
  $("dot").classList.remove("ng"); $("dot").classList.add("ok");
  $("state").textContent = "ログイン中";
  $("who").textContent = user.email || "(no email)";
}, ()=>{
  location.href="./index.html";
});

document.addEventListener("DOMContentLoaded", ()=>{
  setDatetime();
  fillBases();
  renderProjects();
  renderInspection();
  bind();
  calcOdo();
});
