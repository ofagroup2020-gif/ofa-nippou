/****************************************************
 * OFA 点呼システム（GitHub Pages側）完成版
 * - departure.html / arrival.html 送信（doPost）
 * - export.html: 日報PDF / 月報PDF / 月次CSV / 範囲CSV / 履歴
 * - 管理者モード（パス: ofa-2026）で adminSearch 可能
 ****************************************************/

/** ✅ 最新のGAS WebApp URL（あなたの最新URLを固定） */
const GAS_WEBAPP_URL =
  "https://script.google.com/macros/s/AKfycby36HAYkaJwC3K6-8LogpFZ56iplXwvrp38IskarnrLZrHguoCzeOGLSB-S3Kcjo_Uf_w/exec";

/** アプリ識別（GAS側と一致） */
const APP_KEY = "OFA_TENKO";

/** 管理者パスワード（ユーザー指定） */
const ADMIN_PASS = "ofa-2026";

/** ===== DOM ===== */
function $(id) { return document.getElementById(id); }

/** ===== Toast ===== */
function toast(msg, ok=false) {
  const el = $("toast");
  if (!el) { alert(msg); return; }
  el.textContent = msg;
  el.className = "toast " + (ok ? "ok" : "ng");
  el.style.display = "block";
  setTimeout(() => (el.style.display = "none"), 2200);
}

/** ===== Date/Time ===== */
function toYMD(d=new Date()){
  const y=d.getFullYear();
  const m=String(d.getMonth()+1).padStart(2,"0");
  const dd=String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${dd}`;
}
function toHM(d=new Date()){
  const h=String(d.getHours()).padStart(2,"0");
  const m=String(d.getMinutes()).padStart(2,"0");
  return `${h}:${m}`;
}
function normalizeYMD(input){
  return String(input||"").trim().replace(/\//g,"-");
}
function safeStr(v){ return (v===undefined||v===null) ? "" : String(v).trim(); }
function numOrBlank(v){
  const s=safeStr(v);
  if(!s) return "";
  const n=Number(s);
  return Number.isFinite(n) ? n : "";
}

/** ===== 画像圧縮 ===== */
async function fileToCompressedDataURL(file, maxW=1280, quality=0.75){
  if(!file) return null;
  if(!file.type || !file.type.startsWith("image/")) return null;

  const {im, url} = await new Promise((resolve, reject)=>{
    const url=URL.createObjectURL(file);
    const im=new Image();
    im.onload=()=>resolve({im,url});
    im.onerror=reject;
    im.src=url;
  });

  const w=im.naturalWidth||im.width;
  const h=im.naturalHeight||im.height;

  const scale=Math.min(1, maxW/w);
  const cw=Math.round(w*scale);
  const ch=Math.round(h*scale);

  const canvas=document.createElement("canvas");
  canvas.width=cw; canvas.height=ch;
  canvas.getContext("2d").drawImage(im,0,0,cw,ch);
  URL.revokeObjectURL(url);

  return canvas.toDataURL("image/jpeg", quality);
}
async function collectFilesAsDataURLs(inputId){
  const el=$(inputId);
  if(!el || !el.files || !el.files.length) return [];
  const files=Array.from(el.files);
  const out=[];
  for(const f of files){
    const du=await fileToCompressedDataURL(f, 1280, 0.75);
    if(du) out.push(du);
  }
  return out;
}

/** ===== 点検項目収集 ===== */
function collectInspection(){
  const keys=[
    "insp_tire","insp_light","insp_brake","insp_wiper",
    "insp_engineOil","insp_coolant","insp_damage","insp_cargo"
  ];
  const obj={};
  keys.forEach(id=>{
    const el=$(id);
    if(el) obj[id]=safeStr(el.value);
  });
  const note=$("insp_note");
  if(note) obj.note=safeStr(note.value);
  return obj;
}

/** ===== doPost送信 ===== */
async function submitTenko(mode){
  try{
    if(mode!=="departure" && mode!=="arrival") throw new Error("invalid mode");

    const date=normalizeYMD(safeStr($("date")?.value));
    const time=safeStr($("time")?.value);

    const driverName=safeStr($("driverName")?.value);
    const phone=safeStr($("phone")?.value);
    const vehicleNo=safeStr($("vehicleNo")?.value);
    const managerName=safeStr($("managerName")?.value);

    const method=safeStr($("method")?.value);
    const place=safeStr($("place")?.value);
    const alcoholValue=safeStr($("alcoholValue")?.value);
    const alcoholBand=safeStr($("alcoholBand")?.value);
    const memo=safeStr($("memo")?.value);

    const odoStart=numOrBlank($("odoStart")?.value);
    const odoEnd=numOrBlank($("odoEnd")?.value);
    let odoTotal="";
    if(odoStart!=="" && odoEnd!=="") odoTotal=Math.max(0, Number(odoEnd)-Number(odoStart));

    const licenseNo=safeStr($("licenseNo")?.value);

    // arrival 日報
    const workType=safeStr($("workType")?.value);
    const workArea=safeStr($("workArea")?.value);
    const workHours=safeStr($("workHours")?.value);
    const deliveryCount=safeStr($("deliveryCount")?.value);
    const trouble=safeStr($("trouble")?.value);
    const dailyNote=safeStr($("dailyNote")?.value);

    // 必須
    const must=(v,n)=>{ if(!v) throw new Error(`未入力: ${n}`); };
    must(date,"日付"); must(time,"時刻");
    must(driverName,"運転者氏名");
    must(vehicleNo,"車両番号");
    must(managerName,"点呼実施者");
    must(method,"点呼方法");
    must(alcoholValue,"アルコール測定値");
    must(alcoholBand,"酒気帯び");

    const inspection=collectInspection();

    // 写真
    const photos=await collectFilesAsDataURLs("tenkoPhotos");
    const reportPhotos=await collectFilesAsDataURLs("reportPhotos");
    const licensePhotos=await collectFilesAsDataURLs("licensePhotos");

    const payload={
      app:APP_KEY,
      mode,
      data:{
        date,time,
        driverName,phone,vehicleNo,managerName,
        method,place,alcoholValue,alcoholBand,memo,
        odoStart,odoEnd,odoTotal,
        licenseNo,
        inspection,
        workType,workArea,workHours,deliveryCount,trouble,dailyNote
      },
      photos, reportPhotos, licensePhotos
    };

    $("btnSubmit") && ($("btnSubmit").disabled=true);
    toast("送信中…", true);

    const res=await fetch(GAS_WEBAPP_URL,{
      method:"POST",
      headers:{ "Content-Type":"text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });

    const json=await res.json().catch(()=>null);
    if(!json || !json.ok) throw new Error(json?.message || "送信失敗");

    toast("送信OK（保存完了）", true);

    setTimeout(()=>{ window.location.href="index.html"; }, 650);

  }catch(err){
    toast(err.message || String(err));
    $("btnSubmit") && ($("btnSubmit").disabled=false);
  }
}

/** ===== export 共通 ===== */
function buildUrl(action, params){
  const u=new URL(GAS_WEBAPP_URL);
  u.searchParams.set("action", action);
  Object.entries(params||{}).forEach(([k,v])=>{
    if(v!==undefined && v!==null && String(v).trim()!==""){
      u.searchParams.set(k, String(v).trim());
    }
  });
  return u.toString();
}
async function callApi(action, params){
  const url=buildUrl(action, params);
  try{
    const res=await fetch(url,{ method:"GET", cache:"no-store" });
    const json=await res.json();
    return { ok:true, json, url };
  }catch(err){
    return { ok:false, err, url };
  }
}
function showResult(url, label){
  const out=$("result");
  if(!out) return;
  out.innerHTML=`
    <div class="resultBox">
      <div class="resultTitle">✅ ${label}</div>
      <div class="resultLink"><a href="${url}" target="_blank" rel="noopener">ファイルを開く（Drive）</a></div>
      <div class="resultSmall">※印刷OK / LINE共有はリンクを送るだけ</div>
    </div>
  `;
}

/** 日報PDF */
async function runDailyPdf(){
  const date=normalizeYMD(safeStr($("date")?.value));
  const name=safeStr($("name")?.value);
  if(!date) return toast("日付（YYYY-MM-DD）が必要です");
  toast("日報PDF作成中…", true);
  const r=await callApi("dailyPdf",{ date, name });
  if(r.ok && r.json?.ok && r.json?.url){
    showResult(r.json.url, `日報PDF（${date}${name? " / "+name:""}）`);
    toast("作成OK", true);
    window.open(r.json.url,"_blank");
    return;
  }
  toast("失敗（別タブで確認）", false);
  window.open(r.url,"_blank");
}

/** 月報PDF（詳細版） */
async function runMonthlyPdf(){
  const month=safeStr($("month")?.value); // YYYY-MM
  const name=safeStr($("name")?.value);
  if(!month) return toast("月（YYYY-MM）が必要です");
  toast("月報PDF作成中…", true);
  const r=await callApi("monthlyPdf",{ month, name });
  if(r.ok && r.json?.ok && r.json?.url){
    showResult(r.json.url, `月報PDF（${month}${name? " / "+name:""}）`);
    toast("作成OK", true);
    window.open(r.json.url,"_blank");
    return;
  }
  toast("失敗（別タブで確認）", false);
  window.open(r.url,"_blank");
}

/** 月次CSV */
async function runMonthlyCsv(){
  const month=safeStr($("month")?.value);
  const name=safeStr($("name")?.value);
  if(!month) return toast("月（YYYY-MM）が必要です");
  toast("月次CSV作成中…", true);
  const r=await callApi("monthlyCsv",{ month, name });
  if(r.ok && r.json?.ok && r.json?.url){
    showResult(r.json.url, `月次CSV（${month}${name? " / "+name:""}）`);
    toast("作成OK", true);
    window.open(r.json.url,"_blank");
    return;
  }
  toast("失敗（別タブで確認）", false);
  window.open(r.url,"_blank");
}

/** 範囲CSV */
async function runCsvRange(){
  const from=normalizeYMD(safeStr($("fromDate")?.value));
  const to=normalizeYMD(safeStr($("toDate")?.value));
  const name=safeStr($("name")?.value);
  if(!from || !to) return toast("開始日・終了日を入力してください");
  if(from>to) return toast("開始日が終了日より後です");
  toast("範囲CSV作成中…", true);
  const r=await callApi("csvRange",{ from, to, name });
  if(r.ok && r.json?.ok && r.json?.url){
    showResult(r.json.url, `範囲CSV（${from}〜${to}${name? " / "+name:""}）`);
    toast("作成OK", true);
    window.open(r.json.url,"_blank");
    return;
  }
  toast("失敗（別タブで確認）", false);
  window.open(r.url,"_blank");
}

/** 日報履歴（月内の日付一覧） */
async function loadHistory(){
  const month=safeStr($("historyMonth")?.value);
  const name=safeStr($("name")?.value);
  if(!month) return toast("履歴対象の月（YYYY-MM）が必要です");
  toast("履歴取得中…", true);
  const r=await callApi("historyDays",{ month, name });
  if(r.ok && r.json?.ok && Array.isArray(r.json.days)){
    const days=r.json.days;
    $("historyBox") && ($("historyBox").style.display="block");
    $("historyCount") && ($("historyCount").textContent = `${days.length}件`);
    const list=$("historyList");
    if(list){
      list.innerHTML="";
      if(days.length===0){
        list.innerHTML=`<div style="color:#777;font-size:12px;padding:6px 2px;">データなし</div>`;
      }else{
        days.slice().reverse().forEach(d=>{
          const div=document.createElement("div");
          div.className="item";
          div.innerHTML=`
            <div>
              <div class="d">${d}</div>
              <div class="meta">${name? ("運転者: "+escapeHtml(name)) : "全員"} / 日報PDF</div>
            </div>
            <div class="right">
              <button class="btn small primary">日報PDF</button>
              <button class="btn small">リンク</button>
            </div>
          `;
          const btnPdf=div.querySelectorAll("button")[0];
          const btnLink=div.querySelectorAll("button")[1];
          btnPdf.addEventListener("click",()=> {
            // export.html側の date に反映して作成
            $("date") && ($("date").value = d);
            runDailyPdf();
          });
          btnLink.addEventListener("click",()=>{
            const u=buildUrl("dailyPdf",{ date:d, name });
            navigator.clipboard.writeText(u);
            toast("APIリンクをコピーしました", true);
          });
          list.appendChild(div);
        });
      }
    }
    toast("履歴OK", true);
    return;
  }
  toast("失敗（別タブで確認）", false);
  window.open(r.url,"_blank");
}

/** ===== 管理者検索（export.htmlに管理者欄がある場合用） */
async function adminSearch(){
  const pass=safeStr($("adminPass")?.value);
  if(pass !== ADMIN_PASS) return toast("管理者パスワードが違います");

  const month=safeStr($("adminMonth")?.value);
  const from=normalizeYMD(safeStr($("adminFrom")?.value));
  const to=normalizeYMD(safeStr($("adminTo")?.value));
  const name=safeStr($("adminName")?.value);
  const phone=safeStr($("adminPhone")?.value);
  const vehicleNo=safeStr($("adminVehicleNo")?.value);

  toast("管理者検索中…", true);
  const r=await callApi("adminSearch",{
    pass,
    month, from, to, name, phone, vehicleNo
  });

  if(r.ok && r.json?.ok && Array.isArray(r.json.rows)){
    const rows=r.json.rows;
    const box=$("adminResult");
    if(box){
      box.style.display="block";
      box.innerHTML = `<div style="font-weight:900;margin-bottom:6px;">検索結果：${rows.length}件（最大500件）</div>` +
        rows.slice(0,200).map(x => {
          const line = `${x.date} ${x.time} / ${x.mode} / ${x.driverName} / ${x.phone} / ${x.vehicleNo} / 酒気:${x.alcoholBand}`;
          return `<div style="border:1px solid #eee;border-radius:10px;padding:8px;margin:6px 0;font-size:12px;">${escapeHtml(line)}</div>`;
        }).join("");
    }
    toast("検索OK", true);
    return;
  }
  toast("失敗（別タブで確認）", false);
  window.open(r.url,"_blank");
}

function escapeHtml(s){
  return String(s??"")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#39;");
}

/** ===== init ===== */
function initDeparturePage(){
  if($("date") && !$("date").value) $("date").value=toYMD();
  if($("time") && !$("time").value) $("time").value=toHM();

  const calc=()=>{
    const s=numOrBlank($("odoStart")?.value);
    const e=numOrBlank($("odoEnd")?.value);
    if($("odoTotal") && s!=="" && e!=="") $("odoTotal").value=Math.max(0, Number(e)-Number(s));
  };
  $("odoStart")?.addEventListener("input", calc);
  $("odoEnd")?.addEventListener("input", calc);

  $("btnSubmit")?.addEventListener("click", ()=>submitTenko("departure"));
}

function initArrivalPage(){
  if($("date") && !$("date").value) $("date").value=toYMD();
  if($("time") && !$("time").value) $("time").value=toHM();

  const calc=()=>{
    const s=numOrBlank($("odoStart")?.value);
    const e=numOrBlank($("odoEnd")?.value);
    if($("odoTotal") && s!=="" && e!=="") $("odoTotal").value=Math.max(0, Number(e)-Number(s));
  };
  $("odoStart")?.addEventListener("input", calc);
  $("odoEnd")?.addEventListener("input", calc);

  $("btnSubmit")?.addEventListener("click", ()=>submitTenko("arrival"));
}

function initExportPage(){
  // 初期値
  if($("date") && !$("date").value) $("date").value=toYMD();
  if($("month") && !$("month").value){
    const d=new Date();
    const y=d.getFullYear();
    const m=String(d.getMonth()+1).padStart(2,"0");
    $("month").value=`${y}-${m}`;
  }
  if($("historyMonth") && !$("historyMonth").value){
    const d=new Date();
    const y=d.getFullYear();
    const m=String(d.getMonth()+1).padStart(2,"0");
    $("historyMonth").value=`${y}-${m}`;
  }

  $("btnDailyPdf")?.addEventListener("click", runDailyPdf);
  $("btnMonthlyPdf")?.addEventListener("click", runMonthlyPdf);
  $("btnMonthlyCsv")?.addEventListener("click", runMonthlyCsv);
  $("btnCsvRange")?.addEventListener("click", runCsvRange);
  $("btnLoadHistory")?.addEventListener("click", loadHistory);

  // 管理者検索欄がある場合だけ
  $("btnAdminSearch")?.addEventListener("click", adminSearch);

  // 表示用
  $("gasUrlView") && ($("gasUrlView").textContent = GAS_WEBAPP_URL);
}

/** DOM Ready */
window.addEventListener("DOMContentLoaded", ()=>{
  const page=document.body?.dataset?.page || "";
  if(page==="departure") initDeparturePage();
  if(page==="arrival") initArrivalPage();
  if(page==="export") initExportPage();
});
