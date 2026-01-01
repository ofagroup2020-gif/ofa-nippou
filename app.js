/****************************************************
 * OFA 点呼アプリ
 * - departure/arrival: doPost
 * - export/admin: doGet
 ****************************************************/

// ★あなたのGAS URL（auth.jsと合わせる）
const GAS_WEBAPP_URL =
  "https://script.google.com/macros/s/AKfycbxa7fmk0rDDNmZ2p2GTEmE8g6yVaVJxy97J2vpw_NUuYr8lR3QbDNg6EDifoSoSFrKq9Q/exec";

const APP_KEY = "OFA_TENKO_V2";

const $ = (id)=>document.getElementById(id);

function toast(msg, ok=true){
  const t = $("toast");
  if(!t){ alert(msg); return; }
  t.textContent = msg;
  t.classList.toggle("bad", !ok);
  t.classList.add("show");
  setTimeout(()=>t.classList.remove("show"), 1800);
}

function ymd(d=new Date()){
  const y=d.getFullYear();
  const m=String(d.getMonth()+1).padStart(2,"0");
  const dd=String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${dd}`;
}
function hm(d=new Date()){
  const h=String(d.getHours()).padStart(2,"0");
  const m=String(d.getMinutes()).padStart(2,"0");
  return `${h}:${m}`;
}

function safe(v){ return (v==null) ? "" : String(v).trim(); }
function num(v){
  const s=safe(v);
  if(!s) return "";
  const n=Number(s);
  return Number.isFinite(n) ? n : "";
}

async function fileToCompressedDataURL(file, maxW=1280, quality=0.75){
  if(!file) return null;
  if(!file.type || !file.type.startsWith("image/")) return null;

  const {im,url} = await new Promise((resolve,reject)=>{
    const u=URL.createObjectURL(file);
    const im=new Image();
    im.onload=()=>resolve({im,url:u});
    im.onerror=reject;
    im.src=u;
  });

  const w=im.naturalWidth||im.width;
  const h=im.naturalHeight||im.height;
  const scale=Math.min(1, maxW/w);
  const cw=Math.round(w*scale);
  const ch=Math.round(h*scale);

  const canvas=document.createElement("canvas");
  canvas.width=cw; canvas.height=ch;
  const ctx=canvas.getContext("2d");
  ctx.drawImage(im,0,0,cw,ch);
  URL.revokeObjectURL(url);
  return canvas.toDataURL("image/jpeg", quality);
}

async function collectDataURLs(inputId){
  const el=$(inputId);
  if(!el || !el.files || !el.files.length) return [];
  const arr=[];
  for(const f of Array.from(el.files)){
    const du = await fileToCompressedDataURL(f, 1280, 0.75);
    if(du) arr.push(du);
  }
  return arr;
}

function collectInspection(){
  const keys=[
    "insp_tire","insp_light","insp_brake","insp_wiper",
    "insp_engineOil","insp_coolant","insp_damage","insp_cargo",
  ];
  const o={};
  for(const k of keys){
    const el=$(k);
    if(el) o[k]=safe(el.value);
  }
  o.note = safe($("insp_note")?.value);
  return o;
}

function getIdToken(){
  return localStorage.getItem("ofa_id_token") || "";
}

async function submitTenko(mode){
  try{
    const id_token = getIdToken();
    if(!id_token) throw new Error("ログインが必要です");

    const date = safe($("date")?.value) || ymd();
    const time = safe($("time")?.value) || hm();

    // ドライバー本人情報（ログイン情報優先）
    const me = (()=>{
      try{ return JSON.parse(localStorage.getItem("ofa_me")||"null"); }catch(e){ return null; }
    })();

    const driverName = safe($("driverName")?.value) || safe(me?.driverName) || safe(me?.name);
    const phone      = safe($("phone")?.value)      || safe(me?.phone);
    const vehicleNo  = safe($("vehicleNo")?.value)  || safe(me?.vehicleNo);
    const plate      = safe($("plate")?.value)      || safe(me?.plate);

    const managerName = safe($("managerName")?.value);
    const method      = safe($("method")?.value);
    const place       = safe($("place")?.value);
    const alcoholValue= safe($("alcoholValue")?.value);
    const alcoholBand = safe($("alcoholBand")?.value);
    const memo        = safe($("memo")?.value);

    const odoStart=num($("odoStart")?.value);
    const odoEnd  =num($("odoEnd")?.value);
    const odoTotal = (odoStart!=="" && odoEnd!=="") ? Math.max(0, Number(odoEnd)-Number(odoStart)) : "";

    // 帰着（日報）
    const workType     = safe($("workType")?.value);
    const workArea     = safe($("workArea")?.value);
    const workHours    = safe($("workHours")?.value);
    const deliveryCount= safe($("deliveryCount")?.value);
    const trouble      = safe($("trouble")?.value);
    const dailyNote    = safe($("dailyNote")?.value);

    // 最低限必須
    const must=(v,name)=>{ if(!v) throw new Error(`未入力: ${name}`); };
    must(date,"日付"); must(time,"時刻");
    must(driverName,"運転者名");
    must(vehicleNo,"車番");
    must(managerName,"点呼実施者");
    must(method,"点呼方法");
    must(alcoholValue,"アルコール値");
    must(alcoholBand,"酒気帯び");

    const inspection = collectInspection();
    const tenkoPhotos   = await collectDataURLs("tenkoPhotos");
    const reportPhotos  = await collectDataURLs("reportPhotos");
    const licensePhotos = await collectDataURLs("licensePhotos");

    $("btnSubmit") && ($("btnSubmit").disabled=true);
    toast("送信中...", true);

    const payload = {
      app: APP_KEY,
      id_token,
      mode, // departure / arrival
      data:{
        date,time,
        driverName,phone,vehicleNo,plate,
        managerName,method,place,
        alcoholValue,alcoholBand,
        memo,
        odoStart,odoEnd,odoTotal,
        inspection,
        // arrival(日報)
        workType,workArea,workHours,deliveryCount,trouble,dailyNote,
      },
      tenkoPhotos, reportPhotos, licensePhotos
    };

    const res = await fetch(GAS_WEBAPP_URL, {
      method:"POST",
      headers:{ "Content-Type":"text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });

    const json = await res.json().catch(()=>null);
    if(!json || !json.ok) throw new Error(json?.message || "送信失敗");

    toast("送信OK（保存完了）", true);
    setTimeout(()=>location.href="./index.html", 400);

  }catch(e){
    toast(e.message||String(e), false);
    $("btnSubmit") && ($("btnSubmit").disabled=false);
  }
}

function buildUrl(action, params={}){
  const u=new URL(GAS_WEBAPP_URL);
  u.searchParams.set("action", action);
  // tokenはGETにも付ける（本人制御）
  const id_token = getIdToken();
  if(id_token) u.searchParams.set("id_token", id_token);

  for(const [k,v] of Object.entries(params)){
    if(v==null) continue;
    const s=String(v).trim();
    if(!s) continue;
    u.searchParams.set(k,s);
  }
  return u.toString();
}

async function callApi(action, params={}){
  const url=buildUrl(action, params);
  try{
    const res=await fetch(url,{cache:"no-store"});
    const json=await res.json();
    return {ok:true,json,url};
  }catch(err){
    return {ok:false,err,url};
  }
}

function setResult(url,label){
  const box=$("resultBox");
  if(!box) return;
  box.style.display="block";
  box.innerHTML = `
    <div style="font-weight:1000;margin-bottom:6px">${label}</div>
    <div class="small" style="word-break:break-all;margin-bottom:10px;">
      <a href="${url}" target="_blank" rel="noopener">${url}</a>
    </div>
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      <button class="btn dark" type="button" onclick="window.open('${url}','_blank')">開く</button>
      <button class="btn" type="button" onclick="navigator.clipboard.writeText('${url}');">コピー</button>
    </div>
  `;
}

async function createDailyPdf(date){
  toast("日報PDF作成中...", true);
  const r=await callApi("dailyPdf",{date});
  if(r.ok && r.json?.ok && r.json?.url){
    toast("作成しました", true);
    setResult(r.json.url, `日報PDF（${date}）`);
    window.open(r.json.url,"_blank");
    return;
  }
  toast("失敗。別タブで確認します", false);
  window.open(r.url,"_blank");
}

async function createMonthlyPdf(month){
  toast("月報PDF作成中...", true);
  const r=await callApi("monthlyPdf",{month});
  if(r.ok && r.json?.ok && r.json?.url){
    toast("作成しました", true);
    setResult(r.json.url, `月報PDF（${month}）`);
    window.open(r.json.url,"_blank");
    return;
  }
  toast("失敗。別タブで確認します", false);
  window.open(r.url,"_blank");
}

async function createMonthlyCsv(month){
  toast("月次CSV作成中...", true);
  const r=await callApi("monthlyCsv",{month});
  if(r.ok && r.json?.ok && r.json?.url){
    toast("作成しました", true);
    setResult(r.json.url, `月次CSV（${month}）`);
    window.open(r.json.url,"_blank");
    return;
  }
  toast("失敗。別タブで確認します", false);
  window.open(r.url,"_blank");
}

async function createCsvRange(from,to){
  if(!from||!to){ toast("開始日・終了日を入れてください", false); return; }
  if(from>to){ toast("開始日が終了日より後です", false); return; }
  toast("範囲CSV作成中...", true);
  const r=await callApi("csvRange",{from,to});
  if(r.ok && r.json?.ok && r.json?.url){
    toast("作成しました", true);
    setResult(r.json.url, `範囲CSV（${from}〜${to}）`);
    window.open(r.json.url,"_blank");
    return;
  }
  toast("失敗。別タブで確認します", false);
  window.open(r.url,"_blank");
}

async function loadHistory(month){
  toast("履歴取得中...", true);
  const r=await callApi("historyDays",{month});
  if(r.ok && r.json?.ok && Array.isArray(r.json.days)){
    const days=r.json.days;
    $("historyBox").style.display="block";
    $("historyCount").textContent = `${days.length}件`;
    const list=$("historyList");
    list.innerHTML="";
    if(days.length===0){
      list.innerHTML=`<div class="small">データなし</div>`;
    }else{
      days.slice().reverse().forEach(d=>{
        const div=document.createElement("div");
        div.className="help";
        div.style.cursor="pointer";
        div.innerHTML=`<b>${d}</b><div class="small">タップで日報PDF作成</div>`;
        div.addEventListener("click",()=>createDailyPdf(d));
        list.appendChild(div);
      });
    }
    toast("履歴を表示しました", true);
    return;
  }
  toast("失敗。別タブで確認します", false);
  window.open(r.url,"_blank");
}

/** admin search */
async function adminSearch(q){
  toast("検索中...", true);
  const r=await callApi("adminSearch",{q});
  if(r.ok && r.json?.ok){
    const out=$("adminOut");
    const rows=r.json.rows||[];
    out.innerHTML=`<div class="small">結果：${rows.length}件</div><div class="hr"></div>`;
    rows.forEach(row=>{
      const box=document.createElement("div");
      box.className="help";
      box.innerHTML=`
        <b>${row.date} ${row.time}（${row.mode}）</b>
        <div class="small">${row.driverName} / ${row.email} / ${row.vehicleNo} / ${row.plate}</div>
        <div class="small">点呼実施者：${row.managerName} / アルコール：${row.alcoholValue} / 酒気：${row.alcoholBand}</div>
        <div style="margin-top:8px;display:flex;gap:10px;flex-wrap:wrap">
          <button class="btn dark" type="button">日報PDF</button>
        </div>
      `;
      box.querySelector("button").addEventListener("click",()=>{
        const url=buildUrl("dailyPdf",{date:row.date, email:row.email});
        window.open(url,"_blank");
      });
      out.appendChild(box);
    });
    toast("完了", true);
    return;
  }
  toast("失敗", false);
  window.open(r.url,"_blank");
}

/** ページ初期化 */
window.addEventListener("DOMContentLoaded", async ()=>{
  const page=document.body?.dataset?.page || "";

  // ログイン必須ページはauth.jsのrequireLoginを呼ぶ
  if(page !== "index"){
    if(typeof requireLogin === "function") await requireLogin();
  }

  if($("gasUrlView")) $("gasUrlView").textContent = GAS_WEBAPP_URL;

  if(page==="departure" || page==="arrival"){
    $("date").value = $("date").value || ymd();
    $("time").value = $("time").value || hm();

    const calc=()=>{
      const s=num($("odoStart")?.value);
      const e=num($("odoEnd")?.value);
      if(s!=="" && e!=="") $("odoTotal").value = Math.max(0, Number(e)-Number(s));
    };
    $("odoStart")?.addEventListener("input", calc);
    $("odoEnd")?.addEventListener("input", calc);

    $("btnSubmit")?.addEventListener("click", ()=>{
      submitTenko(page==="departure" ? "departure" : "arrival");
    });
  }

  if(page==="export"){
    $("dateDaily").value = $("dateDaily").value || ymd();
    const d=new Date(); $("month").value = $("month").value || `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    $("historyMonth").value = $("historyMonth").value || $("month").value;

    $("btnDailyPdf")?.addEventListener("click", ()=>createDailyPdf($("dateDaily").value));
    $("btnMonthlyPdf")?.addEventListener("click", ()=>createMonthlyPdf($("month").value));
    $("btnMonthlyCsv")?.addEventListener("click", ()=>createMonthlyCsv($("month").value));
    $("btnCsvRange")?.addEventListener("click", ()=>createCsvRange($("fromDate").value, $("toDate").value));
    $("btnLoadHistory")?.addEventListener("click", ()=>loadHistory($("historyMonth").value));
  }

  if(page==="admin"){
    $("btnAdmin")?.addEventListener("click", async ()=>{
      const pass=safe($("adminPass").value);
      if(!pass){ toast("管理者パスを入力", false); return; }
      localStorage.setItem("ofa_admin_pass", pass);
      toast("管理者モード確認中...", true);
      const r=await callApi("adminUnlock",{pass});
      if(r.ok && r.json?.ok){
        toast("管理者モードOK", true);
        $("adminBox").style.display="block";
      }else{
        toast("パスが違います", false);
      }
    });

    $("btnSearch")?.addEventListener("click", ()=>{
      const q=safe($("q").value);
      adminSearch(q);
    });
  }
});
