/****************************************************
 * OFA 点呼システム app.js【完全版】
 * - departure / arrival 送信（doPost）
 * - export: 日報PDF / 月報PDF / 月次CSV / 範囲CSV / 履歴
 * - 管理者モード（ofa-2026）
 ****************************************************/

/* ========= GAS ========= */
const GAS_WEBAPP_URL =
  "https://script.google.com/macros/s/AKfycby36HAYkaJwC3K6-8LogpFZ56iplXwvrp38IskarnrLZrHguoCzeOGLSB-S3Kcjo_Uf_w/exec";

const APP_KEY = "OFA_TENKO";
const ADMIN_PASS = "ofa-2026";

function $(id){ return document.getElementById(id); }
function safe(v){ return (v===undefined||v===null) ? "" : String(v).trim(); }
function ymd(v){ return safe(v).replace(/\//g,"-"); }
function numOrBlank(v){
  const s = safe(v);
  if(!s) return "";
  const n = Number(s);
  return Number.isFinite(n) ? n : "";
}

/* ========= Toast ========= */
function toast(msg, ok=false){
  const el = $("toast");
  if(!el){ alert(msg); return; }
  el.textContent = msg;
  el.className = "toast " + (ok ? "ok":"ng");
  el.style.display = "block";
  setTimeout(()=> el.style.display="none", 2200);
}

/* ========= Admin ========= */
function setAdmin(on){ localStorage.setItem("ofa_admin", on ? "1" : "0"); }
function isAdmin(){ return localStorage.getItem("ofa_admin")==="1"; }

/* ========= Date util ========= */
function todayISO(){
  const d=new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function nowHM(){
  const d=new Date();
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}
function monthISO(){
  const d=new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
}

/* ========= 画像圧縮 ========= */
async function fileToCompressedDataURL(file, maxW=1280, quality=0.75){
  if(!file) return null;
  if(!file.type || !file.type.startsWith("image/")) return null;

  const {im,url} = await new Promise((resolve,reject)=>{
    const u = URL.createObjectURL(file);
    const img = new Image();
    img.onload = ()=> resolve({im:img,url:u});
    img.onerror = reject;
    img.src = u;
  });

  const w = im.naturalWidth || im.width;
  const h = im.naturalHeight || im.height;
  const scale = Math.min(1, maxW / w);
  const cw = Math.round(w * scale);
  const ch = Math.round(h * scale);

  const canvas=document.createElement("canvas");
  canvas.width=cw; canvas.height=ch;
  const ctx=canvas.getContext("2d");
  ctx.drawImage(im,0,0,cw,ch);

  URL.revokeObjectURL(url);
  return canvas.toDataURL("image/jpeg", quality);
}

async function collectFilesAsDataURLs(inputId){
  const el=$(inputId);
  if(!el||!el.files||!el.files.length) return [];
  const files=Array.from(el.files);
  const out=[];
  for(const f of files){
    const du = await fileToCompressedDataURL(f, 1280, 0.75);
    if(du) out.push(du);
  }
  return out;
}

/* ========= 点検 ========= */
function collectInspection(){
  const keys=[
    "insp_tire","insp_light","insp_brake","insp_wiper",
    "insp_engineOil","insp_coolant","insp_battery","insp_horn",
    "insp_mirror","insp_damage","insp_cargo","insp_extinguisher","insp_triangle"
  ];
  const obj={};
  keys.forEach(id=>{
    const el=$(id);
    if(el) obj[id]=safe(el.value);
  });
  if($("insp_note")) obj.note = safe($("insp_note").value);
  return obj;
}

/* ========= 点呼送信 ========= */
async function submitTenko(mode){
  try{
    if(mode!=="departure" && mode!=="arrival"){
      toast("invalid mode");
      return;
    }

    const date = ymd(safe($("date")?.value));
    const time = safe($("time")?.value);
    const driverName = safe($("driverName")?.value);
    const driverPhone = safe($("driverPhone")?.value);
    const vehicleNo = safe($("vehicleNo")?.value);
    const managerName = safe($("managerName")?.value);
    const method = safe($("method")?.value);
    const place = safe($("place")?.value);
    const alcoholValue = safe($("alcoholValue")?.value);
    const alcoholBand = safe($("alcoholBand")?.value);
    const memo = safe($("memo")?.value);

    const odoStart = numOrBlank($("odoStart")?.value);
    const odoEnd = numOrBlank($("odoEnd")?.value);
    let odoTotal = "";
    if(odoStart!=="" && odoEnd!=="") odoTotal = Math.max(0, Number(odoEnd) - Number(odoStart));

    const licenseNo = safe($("licenseNo")?.value);

    const workType = safe($("workType")?.value);
    const workArea = safe($("workArea")?.value);
    const workHours = safe($("workHours")?.value);
    const deliveryCount = safe($("deliveryCount")?.value);
    const trouble = safe($("trouble")?.value);
    const dailyNote = safe($("dailyNote")?.value);

    // 必須チェック
    const must = (v, name)=>{ if(!v) throw new Error(`未入力: ${name}`); };
    must(date,"日付");
    must(time,"時刻");
    must(driverName,"運転者氏名");
    must(vehicleNo,"車両番号");
    must(managerName,"点呼実施者");
    must(method,"点呼方法");
    must(alcoholValue,"アルコール測定値");
    must(alcoholBand,"酒気帯び");

    // 点検は必須（どれか空はNG）
    const insp = collectInspection();
    const inspKeys = Object.keys(insp).filter(k=>k!=="note");
    const inspMissing = inspKeys.some(k=>!safe(insp[k]));
    if(inspMissing) throw new Error("車両点検が未入力です（全項目選択）");

    // 写真
    const photos = await collectFilesAsDataURLs("tenkoPhotos");
    const reportPhotos = await collectFilesAsDataURLs("reportPhotos");
    const licensePhotos = await collectFilesAsDataURLs("licensePhotos");

    const payload={
      app: APP_KEY,
      mode,
      data:{
        date,time,driverName,driverPhone,vehicleNo,managerName,method,place,
        alcoholValue,alcoholBand,memo,
        odoStart,odoEnd,odoTotal,
        licenseNo,
        inspection: insp,
        workType,workArea,workHours,deliveryCount,trouble,dailyNote
      },
      photos,
      reportPhotos,
      licensePhotos
    };

    $("btnSubmit") && ($("btnSubmit").disabled=true);
    toast("送信中…",true);

    const res = await fetch(GAS_WEBAPP_URL,{
      method:"POST",
      headers:{ "Content-Type":"text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });

    const json = await res.json().catch(()=>null);
    if(!json || !json.ok){
      throw new Error(json?.message || "送信失敗（GAS応答なし）");
    }

    toast("保存完了",true);
    setTimeout(()=> location.href="./index.html", 650);
  }catch(err){
    toast(err.message || String(err));
    $("btnSubmit") && ($("btnSubmit").disabled=false);
  }
}

/* ========= Export ========= */
function buildUrl(action, params){
  const u=new URL(GAS_WEBAPP_URL);
  u.searchParams.set("action", action);
  Object.entries(params||{}).forEach(([k,v])=>{
    if(v!==undefined && v!==null && String(v).trim()!==""){
      u.searchParams.set(k, String(v).trim());
    }
  });

  // 管理者ONなら admin=1 も付ける（GAS側で必要なら判定できる）
  if(isAdmin()) u.searchParams.set("admin","1");

  // 管理者検索条件（exportページだけ）
  if(isAdmin()){
    const qName = $("qName") ? safe($("qName").value) : "";
    const qPhone = $("qPhone") ? safe($("qPhone").value) : "";
    const qVehicle = $("qVehicle") ? safe($("qVehicle").value) : "";
    if(qName) u.searchParams.set("qName", qName);
    if(qPhone) u.searchParams.set("qPhone", qPhone);
    if(qVehicle) u.searchParams.set("qVehicle", qVehicle);
  }

  return u.toString();
}

async function callApi(action, params){
  const url = buildUrl(action, params);
  try{
    const res = await fetch(url, { method:"GET", cache:"no-store" });
    const json = await res.json();
    return { ok:true, json, url };
  }catch(err){
    return { ok:false, err, url };
  }
}

function setResult(url, label){
  const box = $("resultBox");
  if(!box) return;
  box.style.display="block";
  box.innerHTML = `
    <div style="font-weight:900;margin-bottom:6px;">${escapeHtml(label)}</div>
    <div style="margin-bottom:8px;">
      リンク：<a href="${url}" target="_blank" rel="noopener">${url}</a>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn small primary" onclick="window.open('${url}','_blank')">開く</button>
      <button class="btn small" onclick="navigator.clipboard.writeText('${url}');">コピー</button>
    </div>
  `;
}

function escapeHtml(s){
  return String(s??"")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#39;");
}

async function runExport(action){
  try{
    if(action==="dailyPdf"){
      const date = ymd($("dateDaily")?.value);
      if(!date) throw new Error("日付が必要です");
      toast("日報PDFを作成中…",true);
      const r=await callApi("dailyPdf",{ date });
      if(r.ok && r.json?.ok && r.json?.url){
        toast("作成完了",true);
        setResult(r.json.url, `日報PDF（${date}）`);
        window.open(r.json.url,"_blank");
        return;
      }
      toast("取得失敗：別タブで確認します",false);
      window.open(r.url,"_blank");
      return;
    }

    if(action==="monthlyPdf"){
      const month = $("month")?.value;
      if(!month) throw new Error("月が必要です");
      toast("月報PDFを作成中…",true);
      const r=await callApi("monthlyPdf",{ month });
      if(r.ok && r.json?.ok && r.json?.url){
        toast("作成完了",true);
        setResult(r.json.url, `月報PDF（${month}）`);
        window.open(r.json.url,"_blank");
        return;
      }
      toast("取得失敗：別タブで確認します",false);
      window.open(r.url,"_blank");
      return;
    }

    if(action==="monthlyCsv"){
      const month = $("month")?.value;
      if(!month) throw new Error("月が必要です");
      toast("月次CSVを作成中…",true);
      const r=await callApi("monthlyCsv",{ month });
      if(r.ok && r.json?.ok && r.json?.url){
        toast("作成完了",true);
        setResult(r.json.url, `月次CSV（${month}）`);
        window.open(r.json.url,"_blank");
        return;
      }
      toast("取得失敗：別タブで確認します",false);
      window.open(r.url,"_blank");
      return;
    }

    if(action==="csvRange"){
      const from = $("fromDate")?.value;
      const to = $("toDate")?.value;
      if(!from || !to) throw new Error("開始日と終了日が必要です");
      if(from>to) throw new Error("開始日が終了日より後です");
      toast("範囲CSVを作成中…",true);
      const r=await callApi("csvRange",{ from,to });
      if(r.ok && r.json?.ok && r.json?.url){
        toast("作成完了",true);
        setResult(r.json.url, `範囲CSV（${from}〜${to}）`);
        window.open(r.json.url,"_blank");
        return;
      }
      toast("取得失敗：別タブで確認します",false);
      window.open(r.url,"_blank");
      return;
    }

  }catch(e){
    toast(e.message||String(e));
  }
}

async function loadHistory(){
  const month = $("historyMonth")?.value;
  if(!month){ toast("履歴の月が必要です"); return; }

  toast("履歴を取得中…",true);
  const r = await callApi("historyDays",{ month });

  if(r.ok && r.json?.ok && Array.isArray(r.json.days)){
    const days = r.json.days;
    $("historyBox").style.display="block";
    $("historyCount").textContent = `${days.length}件`;
    const list = $("historyList");
    list.innerHTML="";
    if(days.length===0){
      list.innerHTML=`<div class="muted" style="padding:6px 2px;">データなし</div>`;
      toast("データなし",false);
      return;
    }

    // 新しい日付が上に
    days.slice().reverse().forEach(d=>{
      const div=document.createElement("div");
      div.className="item";
      div.innerHTML=`
        <div>
          <div class="d">${escapeHtml(d)}</div>
          <div class="meta">タップで日報PDF作成</div>
        </div>
        <div class="right">
          <button class="btn small primary">日報PDF</button>
          <button class="btn small">リンク</button>
        </div>
      `;
      const btnPdf = div.querySelectorAll("button")[0];
      const btnLink = div.querySelectorAll("button")[1];

      btnPdf.addEventListener("click", ()=> {
        $("dateDaily").value = d;
        runExport("dailyPdf");
      });
      btnLink.addEventListener("click", ()=>{
        const u = buildUrl("dailyPdf",{ date:d });
        navigator.clipboard.writeText(u);
        toast("リンクをコピーしました",true);
      });

      list.appendChild(div);
    });

    toast("履歴表示完了",true);
    return;
  }

  toast("取得失敗：別タブで確認します",false);
  window.open(r.url,"_blank");
}

/* ========= ページ初期化 ========= */
function initCommon(){
  // 戻る
  if($("backBtn")){
    $("backBtn").addEventListener("click", ()=>{
      if(history.length>1) history.back();
      else location.href="./index.html";
    });
  }
}

function initDepartureArrival(){
  if($("date") && !$("date").value) $("date").value = todayISO();
  if($("time") && !$("time").value) $("time").value = nowHM();

  // odoTotal 自動計算
  if($("odoStart") && $("odoEnd") && $("odoTotal")){
    const calc=()=>{
      const s=numOrBlank($("odoStart").value);
      const e=numOrBlank($("odoEnd").value);
      $("odoTotal").value = (s!=="" && e!=="") ? Math.max(0, Number(e)-Number(s)) : "";
    };
    $("odoStart").addEventListener("input", calc);
    $("odoEnd").addEventListener("input", calc);
  }

  // 送信ボタン
  const page = document.body?.dataset?.page || "";
  if($("btnSubmit")){
    $("btnSubmit").addEventListener("click", ()=>{
      submitTenko(page==="arrival" ? "arrival" : "departure");
    });
  }
}

function initExport(){
  if($("dateDaily") && !$("dateDaily").value) $("dateDaily").value = todayISO();
  if($("month") && !$("month").value) $("month").value = monthISO();
  if($("historyMonth") && !$("historyMonth").value) $("historyMonth").value = monthISO();
  if($("gasUrlView")) $("gasUrlView").textContent = GAS_WEBAPP_URL;

  // 管理者状態
  const adminState = $("adminState");
  const box = $("adminSearchBox");
  const paintAdmin = ()=>{
    const on = isAdmin();
    if(adminState) adminState.innerHTML = on ? "管理者：<b>ON</b>" : "管理者：OFF";
    if(box) box.style.display = on ? "block" : "none";
  };
  paintAdmin();

  if($("adminLoginBtn")){
    $("adminLoginBtn").addEventListener("click", ()=>{
      const v = safe($("adminPass")?.value);
      if(v !== ADMIN_PASS){
        setAdmin(false);
        paintAdmin();
        toast("管理者パスワードが違います");
        return;
      }
      setAdmin(true);
      paintAdmin();
      toast("管理者モードON", true);
    });
  }
  if($("adminLogoutBtn")){
    $("adminLogoutBtn").addEventListener("click", ()=>{
      setAdmin(false);
      if($("adminPass")) $("adminPass").value="";
      paintAdmin();
      toast("管理者モードOFF", true);
    });
  }

  $("btnDailyPdf")?.addEventListener("click", ()=>runExport("dailyPdf"));
  $("btnMonthlyPdf")?.addEventListener("click", ()=>runExport("monthlyPdf"));
  $("btnMonthlyCsv")?.addEventListener("click", ()=>runExport("monthlyCsv"));
  $("btnCsvRange")?.addEventListener("click", ()=>runExport("csvRange"));
  $("btnLoadHistory")?.addEventListener("click", loadHistory);
}

/* ========= 起動 ========= */
document.addEventListener("DOMContentLoaded", ()=>{
  initCommon();

  const page = document.body?.dataset?.page || "";
  if(page==="departure" || page==="arrival") initDepartureArrival();
  if(page==="export") initExport();
});
