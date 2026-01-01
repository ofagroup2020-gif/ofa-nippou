// app.js
(function(){
  const OFA = window.OFA;
  const AUTH = window.OFA_AUTH;
  const $ = (id)=>document.getElementById(id);

  function ymd(d=new Date()){
    const y=d.getFullYear();
    const m=String(d.getMonth()+1).padStart(2,"0");
    const dd=String(d.getDate()).padStart(2,"0");
    return `${y}-${m}-${dd}`;
  }
  function hm(d=new Date()){
    return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
  }
  function normYMD(v){ return String(v||"").trim().replace(/\//g,"-"); }

  async function fileToDataURL(file, maxW=1280, quality=0.75){
    if(!file || !file.type?.startsWith("image/")) return null;
    const url = URL.createObjectURL(file);
    const img = new Image();
    await new Promise((ok,ng)=>{ img.onload=ok; img.onerror=ng; img.src=url; });
    const w=img.naturalWidth||img.width, h=img.naturalHeight||img.height;
    const s=Math.min(1, maxW/w);
    const cw=Math.round(w*s), ch=Math.round(h*s);
    const c=document.createElement("canvas"); c.width=cw; c.height=ch;
    c.getContext("2d").drawImage(img,0,0,cw,ch);
    URL.revokeObjectURL(url);
    return c.toDataURL("image/jpeg", quality);
  }

  async function collectFiles(id){
    const el=$(id);
    if(!el?.files?.length) return [];
    const arr=[];
    for(const f of Array.from(el.files)){
      const du = await fileToDataURL(f);
      if(du) arr.push(du);
    }
    return arr;
  }

  function collectInspection(){
    const keys=["insp_tire","insp_light","insp_brake","insp_wiper","insp_engineOil","insp_coolant","insp_damage","insp_cargo"];
    const obj={};
    keys.forEach(k=>{ const el=$(k); if(el) obj[k]=String(el.value||"").trim(); });
    obj.note = String($("insp_note")?.value||"").trim();
    return obj;
  }

  async function postJSON(payload){
    // 送信はPOST（CORS影響少ない）で統一
    const res = await fetch(OFA.GAS_WEBAPP_URL, {
      method:"POST",
      headers:{ "Content-Type":"text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(()=>null);
    if(!json || !json.ok) throw new Error(json?.message || "送信失敗");
    return json;
  }

  async function submitTenko(mode){
    try{
      AUTH.requireLogin();
      const token = AUTH.getToken();
      const email = AUTH.getEmail();

      const date = normYMD($("date")?.value);
      const time = $("time")?.value;
      const driverName = $("driverName")?.value;
      const vehicleNo = $("vehicleNo")?.value;
      const managerName = $("managerName")?.value;
      const method = $("method")?.value;
      const place = $("place")?.value;
      const alcoholValue = $("alcoholValue")?.value;
      const alcoholBand = $("alcoholBand")?.value;
      const memo = $("memo")?.value;

      const must=(v,n)=>{ if(!String(v||"").trim()) throw new Error(`未入力: ${n}`); };
      must(date,"日付"); must(time,"時刻"); must(driverName,"運転者氏名"); must(vehicleNo,"車両番号");
      must(managerName,"点呼実施者"); must(method,"点呼方法"); must(alcoholValue,"アルコール測定値"); must(alcoholBand,"酒気帯び");

      const odoStart = $("odoStart")?.value || "";
      const odoEnd   = $("odoEnd")?.value || "";
      const odoTotal = $("odoTotal")?.value || "";

      // 帰着のみ（日報項目）
      const workType = $("workType")?.value || "";
      const workArea = $("workArea")?.value || "";
      const workHours = $("workHours")?.value || "";
      const deliveryCount = $("deliveryCount")?.value || "";
      const trouble = $("trouble")?.value || "";
      const dailyNote = $("dailyNote")?.value || "";

      const inspection = collectInspection();

      const photos = await collectFiles("tenkoPhotos");
      const reportPhotos = await collectFiles("reportPhotos");
      const licensePhotos = await collectFiles("licensePhotos");

      $("btnSubmit").disabled = true;
      AUTH.toast("送信中…");

      const payload = {
        app: OFA.APP_KEY,
        mode: mode,                 // departure / arrival
        idToken: token,             // 本人判定
        data: {
          date,time,driverName,vehicleNo,managerName,method,place,
          alcoholValue,alcoholBand,memo,
          odoStart,odoEnd,odoTotal,
          inspection,
          // 日報（帰着）
          workType,workArea,workHours,deliveryCount,trouble,dailyNote,
          // 追跡用
          loginEmail: email
        },
        photos, reportPhotos, licensePhotos
      };

      await postJSON(payload);
      AUTH.toast("送信OK ✅");
      setTimeout(()=>location.href="index.html", 600);
    }catch(e){
      console.error(e);
      AUTH.toast(e.message || "送信失敗", false);
      if($("btnSubmit")) $("btnSubmit").disabled=false;
    }
  }

  async function exportAction(action, params){
    AUTH.requireLogin();
    const token = AUTH.getToken();
    const payload = { app: OFA.APP_KEY, mode:"export", action, params, idToken: token };
    const json = await postJSON(payload);
    return json; // {ok,url}
  }

  function setResult(url,label){
    const box=$("resultBox");
    if(!box) return;
    box.style.display="block";
    box.innerHTML = `
      <div style="font-weight:1000;margin-bottom:6px;">${label}</div>
      <div style="font-size:12px;color:#5b677a;word-break:break-all;">
        <a href="${url}" target="_blank" rel="noopener">${url}</a>
      </div>
      <div style="height:10px"></div>
      <div class="row">
        <button class="btn small grad" id="openBtn">開く</button>
        <button class="btn small" id="copyBtn">コピー</button>
      </div>
    `;
    $("openBtn").addEventListener("click", ()=>window.open(url,"_blank"));
    $("copyBtn").addEventListener("click", async ()=>{
      await navigator.clipboard.writeText(url);
      AUTH.toast("コピーしました");
    });
  }

  async function loadHistory(month){
    const json = await exportAction("historyDays", { month });
    return json.days || [];
  }

  // ===== ページ別 init =====
  function initIndex(){
    AUTH.renderLogin();

    // ログイン済みだけメニュー表示
    const logged = !!AUTH.getToken();
    const menu = $("menuBox");
    if(menu) menu.style.display = logged ? "block" : "none";

    // ボタンの click を必ず紐付け
    $("goDeparture")?.addEventListener("click", ()=>location.href="departure.html");
    $("goArrival")?.addEventListener("click", ()=>location.href="arrival.html");
    $("goExport")?.addEventListener("click", ()=>location.href="export.html");
  }

  function initDeparture(){
    AUTH.renderLogin();
    if($("date") && !$("date").value) $("date").value = ymd();
    if($("time") && !$("time").value) $("time").value = hm();

    const calc=()=>{
      const s=Number($("odoStart")?.value||"");
      const e=Number($("odoEnd")?.value||"");
      if(Number.isFinite(s)&&Number.isFinite(e)) $("odoTotal").value = Math.max(0, e-s);
    };
    $("odoStart")?.addEventListener("input", calc);
    $("odoEnd")?.addEventListener("input", calc);

    $("btnSubmit")?.addEventListener("click", ()=>submitTenko("departure"));
  }

  function initArrival(){
    AUTH.renderLogin();
    if($("date") && !$("date").value) $("date").value = ymd();
    if($("time") && !$("time").value) $("time").value = hm();

    const calc=()=>{
      const s=Number($("odoStart")?.value||"");
      const e=Number($("odoEnd")?.value||"");
      if(Number.isFinite(s)&&Number.isFinite(e)) $("odoTotal").value = Math.max(0, e-s);
    };
    $("odoStart")?.addEventListener("input", calc);
    $("odoEnd")?.addEventListener("input", calc);

    $("btnSubmit")?.addEventListener("click", ()=>submitTenko("arrival"));
  }

  function initExport(){
    AUTH.renderLogin();

    const d = ymd();
    const m = d.slice(0,7);
    $("dateDaily") && ($("dateDaily").value ||= d);
    $("month") && ($("month").value ||= m);
    $("historyMonth") && ($("historyMonth").value ||= m);
    $("gasUrlView") && ($("gasUrlView").textContent = OFA.GAS_WEBAPP_URL);

    $("btnDailyPdf")?.addEventListener("click", async ()=>{
      try{
        const date = $("dateDaily").value;
        AUTH.toast("日報PDF作成中…");
        const j = await exportAction("dailyPdf", { date });
        setResult(j.url, `日報PDF（${date}）`);
        AUTH.toast("作成OK ✅");
      }catch(e){
        console.error(e);
        AUTH.toast(e.message || "作成失敗", false);
      }
    });

    $("btnMonthlyPdf")?.addEventListener("click", async ()=>{
      try{
        const month = $("month").value;
        AUTH.toast("月報PDF作成中…");
        const j = await exportAction("monthlyPdf", { month });
        setResult(j.url, `月報PDF（${month}）`);
        AUTH.toast("作成OK ✅");
      }catch(e){
        console.error(e);
        AUTH.toast(e.message || "作成失敗", false);
      }
    });

    $("btnMonthlyCsv")?.addEventListener("click", async ()=>{
      try{
        const month = $("month").value;
        AUTH.toast("月次CSV作成中…");
        const j = await exportAction("monthlyCsv", { month });
        setResult(j.url, `月次CSV（${month}）`);
        AUTH.toast("作成OK ✅");
      }catch(e){
        console.error(e);
        AUTH.toast(e.message || "作成失敗", false);
      }
    });

    $("btnCsvRange")?.addEventListener("click", async ()=>{
      try{
        const from = $("fromDate").value;
        const to = $("toDate").value;
        if(!from||!to) throw new Error("開始日・終了日を入れてください");
        if(from>to) throw new Error("開始日が終了日より後です");
        AUTH.toast("範囲CSV作成中…");
        const j = await exportAction("csvRange", { from,to });
        setResult(j.url, `範囲CSV（${from}〜${to}）`);
        AUTH.toast("作成OK ✅");
      }catch(e){
        console.error(e);
        AUTH.toast(e.message || "作成失敗", false);
      }
    });

    $("btnLoadHistory")?.addEventListener("click", async ()=>{
      try{
        const month = $("historyMonth").value;
        AUTH.toast("履歴取得中…");
        const days = await loadHistory(month);
        const box=$("historyBox");
        const cnt=$("historyCount");
        const list=$("historyList");
        box.style.display="block";
        cnt.textContent=`${days.length}件`;
        list.innerHTML="";
        if(days.length===0){
          list.innerHTML=`<div style="color:#5b677a;font-size:12px;padding:6px 2px;">データなし</div>`;
          return;
        }
        days.slice().reverse().forEach(d=>{
          const div=document.createElement("div");
          div.className="menuBtn";
          div.innerHTML=`
            <div class="left">
              <div class="icon">PDF</div>
              <div class="meta">
                <div class="t">${d}</div>
                <div class="s">タップで日報PDF（詳細）を作成</div>
              </div>
            </div>
            <div class="pill">作成</div>
          `;
          div.addEventListener("click", async ()=>{
            try{
              AUTH.toast("日報PDF作成中…");
              const j = await exportAction("dailyPdf", { date:d });
              setResult(j.url, `日報PDF（${d}）`);
              AUTH.toast("作成OK ✅");
            }catch(e){
              AUTH.toast(e.message || "作成失敗", false);
            }
          });
          list.appendChild(div);
        });
        AUTH.toast("履歴を表示しました");
      }catch(e){
        console.error(e);
        AUTH.toast(e.message || "取得失敗", false);
      }
    });
  }

  window.addEventListener("DOMContentLoaded", ()=>{
    const page = document.body?.dataset?.page || "";
    if(page==="index") initIndex();
    if(page==="departure") initDeparture();
    if(page==="arrival") initArrival();
    if(page==="export") initExport();
  });
})();
