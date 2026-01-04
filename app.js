/****************************************************
 * app.js - OFA 点呼システム（確実送信・検索・出力）
 ****************************************************/

const GAS_WEBAPP_URL =
  "https://script.google.com/macros/s/AKfycbwvairPzgugAoB-51_9JcnAOKBxKF6hRDdj2hfwaGvq8KcczWFKDdBBia_mepTVEhoBGQ/exec"; // ←あなたのURL

function $(id){ return document.getElementById(id); }

function toast(msg, ok=false){
  const el = $("toast");
  if(!el){ alert(msg); return; }
  el.textContent = msg;
  el.className = "toast " + (ok ? "ok":"ng");
  el.style.display = "block";
  setTimeout(()=> el.style.display="none", 2600);
}

function setNow(dateEl, timeEl){
  const d = new Date();
  const pad = (n)=> String(n).padStart(2,"0");
  if(dateEl) dateEl.value = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  if(timeEl) timeEl.value = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function scrollToFirstError(){
  const el = document.querySelector(".error");
  if(el){
    el.scrollIntoView({behavior:"smooth", block:"center"});
    el.focus?.();
  }
}

function markError(el, on){
  if(!el) return;
  if(on) el.classList.add("error");
  else el.classList.remove("error");
}

function isEmpty(v){ return (v==null || String(v).trim()===""); }

async function fileToDataURL(file, maxW=1280, quality=0.82){
  // 画像を圧縮して dataURL へ（送信安定化）
  return new Promise((resolve,reject)=>{
    const reader = new FileReader();
    reader.onload = ()=>{
      const img = new Image();
      img.onload = ()=>{
        const scale = Math.min(1, maxW / img.width);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img,0,0,w,h);
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve(dataUrl);
      };
      img.onerror = ()=> resolve(reader.result); // 失敗時は元を返す
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function filesToDataURLs(inputEl, limit=6){
  if(!inputEl || !inputEl.files) return [];
  const arr = Array.from(inputEl.files).slice(0, limit);
  const out = [];
  for(const f of arr){
    out.push(await fileToDataURL(f));
  }
  return out;
}

async function postJSON(action, payload){
  // GASに必ず action 付きで送る。必ず JSON が返る想定（GAS側もこの回答のコード）
  const body = JSON.stringify({ action, payload });
  let res, txt;
  try{
    res = await fetch(GAS_WEBAPP_URL, {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body
    });
    txt = await res.text();
  }catch(e){
    throw new Error("通信に失敗しました（回線/URL/CORS）");
  }
  let json;
  try{
    json = JSON.parse(txt);
  }catch(e){
    // HTMLが返ってくる時はここに落ちる（=GASのデプロイ/URLミス/権限ミス）
    throw new Error("サーバー応答が不正です（JSONではありません）");
  }
  if(!json.ok){
    throw new Error(json.message || "サーバーで失敗しました");
  }
  return json;
}

function calcOdoTotal(start, end){
  const s = Number(String(start||"").replace(/[^\d.]/g,""));
  const e = Number(String(end||"").replace(/[^\d.]/g,""));
  if(!isFinite(s) || !isFinite(e)) return "";
  if(e < s) return "";
  return String(e - s);
}

/* 共通：必須チェック */
function requireFields(map){
  // map: { el: HTMLElement, name: string }
  let ok = true;
  for(const item of map){
    const el = item.el;
    const v = (el?.value ?? "");
    const empty = isEmpty(v);
    markError(el, empty);
    if(empty) ok = false;
  }
  if(!ok) scrollToFirstError();
  return ok;
}

/* 点検：OK/NG */
function anyNG(inspections){
  return inspections.some(v => String(v||"") === "NG");
}

/* =========================
   出発点呼ページ
========================= */
async function initDeparture(){
  const backBtn = $("backBtn");
  backBtn?.addEventListener("click", ()=> history.length ? history.back() : location.href="./index.html");

  setNow($("date"), $("time"));

  // 走行距離自動
  const odoStart = $("odoStart"), odoEnd = $("odoEnd"), odoTotal = $("odoTotal");
  const updateOdo = ()=>{
    const t = calcOdoTotal(odoStart?.value, odoEnd?.value);
    if(odoTotal) odoTotal.value = t || "";
  };
  odoStart?.addEventListener("input", updateOdo);
  odoEnd?.addEventListener("input", updateOdo);

  $("btnSubmit")?.addEventListener("click", async ()=>{
    const btn = $("btnSubmit");
    btn.disabled = true;

    try{
      // 必須（出発）
      const ok = requireFields([
        {el:$("date")},{el:$("time")},
        {el:$("driverName")},{el:$("vehicleNo")},
        {el:$("sleepHours")},{el:$("condition")},
        {el:$("managerName")},{el:$("method")},{el:$("place")},
        {el:$("alcoholValue")},{el:$("alcoholBand")},
        {el:$("licenseNo")}
      ]);
      if(!ok){ btn.disabled=false; return; }

      // 点検必須
      const inspIds = [
        "insp_tire","insp_light","insp_brake","insp_wiper","insp_engineOil","insp_coolant",
        "insp_battery","insp_horn","insp_mirror","insp_damage","insp_cargo","insp_extinguisher","insp_triangle"
      ];
      const insp = {};
      let inspOK = true;
      inspIds.forEach(id=>{
        const el = $(id);
        const v = el?.value || "";
        insp[id] = v;
        const empty = isEmpty(v);
        markError(el, empty);
        if(empty) inspOK = false;
      });
      if(!inspOK){ scrollToFirstError(); btn.disabled=false; return; }

      // アルコール指標写真：必須
      const alcoholPhotos = await filesToDataURLs($("alcoholPhotos"), 2);
      if(alcoholPhotos.length === 0){
        markError($("alcoholPhotos"), true);
        toast("アルコール指標写真は必須です");
        btn.disabled=false; return;
      }else{
        markError($("alcoholPhotos"), false);
      }

      // 異常箇所：NGがあれば推奨（今回は「できれば必須」に寄せる）
      const abnormalPhotos = await filesToDataURLs($("abnormalPhotos"), 6);
      if(anyNG(Object.values(insp)) && abnormalPhotos.length === 0){
        markError($("abnormalPhotos"), true);
        toast("点検NGがある場合は異常箇所写真を追加してください");
        btn.disabled=false; return;
      }else{
        markError($("abnormalPhotos"), false);
      }

      const payload = {
        kind: "departure",
        date: $("date").value,
        time: $("time").value,
        driverName: $("driverName").value.trim(),
        driverPhone: ($("driverPhone")?.value || "").trim(),
        vehicleNo: $("vehicleNo").value.trim(),

        sleepHours: $("sleepHours").value,
        condition: $("condition").value,

        managerName: $("managerName").value.trim(),
        method: $("method").value,
        place: $("place").value.trim(),

        alcoholValue: $("alcoholValue").value.trim(),
        alcoholBand: $("alcoholBand").value,
        alcoholPhotos,

        licenseNo: $("licenseNo").value.trim(),

        odoStart: ($("odoStart")?.value || "").trim(),
        odoEnd: ($("odoEnd")?.value || "").trim(),
        odoTotal: ($("odoTotal")?.value || "").trim(),

        memo: ($("memo")?.value || "").trim(),

        inspections: {
          tire: $("insp_tire").value,
          light: $("insp_light").value,
          brake: $("insp_brake").value,
          wiper: $("insp_wiper").value,
          engineOil: $("insp_engineOil").value,
          coolant: $("insp_coolant").value,
          battery: $("insp_battery").value,
          horn: $("insp_horn").value,
          mirror: $("insp_mirror").value,
          damage: $("insp_damage").value,
          cargo: $("insp_cargo").value,
          extinguisher: $("insp_extinguisher").value,
          triangle: $("insp_triangle").value,
          note: ($("insp_note")?.value || "").trim(),
          abnormalPhotos
        },

        tenkoPhotos: await filesToDataURLs($("tenkoPhotos"), 4)
      };

      const r = await postJSON("submit_departure", payload);
      toast("送信完了（出発点呼）", true);

      // 成功したらトップへ
      setTimeout(()=> location.href="./index.html", 600);

    }catch(e){
      toast(e.message || "送信に失敗しました");
    }finally{
      btn.disabled = false;
    }
  });
}

/* =========================
   帰着点呼 + 日報
========================= */
async function initArrival(){
  const backBtn = $("backBtn");
  backBtn?.addEventListener("click", ()=> history.length ? history.back() : location.href="./index.html");

  setNow($("date"), $("time"));

  const odoStart = $("odoStart"), odoEnd = $("odoEnd"), odoTotal = $("odoTotal");
  const updateOdo = ()=>{
    const t = calcOdoTotal(odoStart?.value, odoEnd?.value);
    if(odoTotal) odoTotal.value = t || "";
  };
  odoStart?.addEventListener("input", updateOdo);
  odoEnd?.addEventListener("input", updateOdo);

  $("btnSubmit")?.addEventListener("click", async ()=>{
    const btn = $("btnSubmit");
    btn.disabled = true;

    try{
      // 必須（帰着+日報）
      const ok = requireFields([
        {el:$("date")},{el:$("time")},
        {el:$("driverName")},{el:$("vehicleNo")},
        {el:$("restHours")},
        {el:$("managerName")},{el:$("method")},{el:$("place")},
        {el:$("alcoholValue")},{el:$("alcoholBand")},
        {el:$("licenseNo")},
        {el:$("workType")},{el:$("workArea")},{el:$("workHours")}
      ]);
      if(!ok){ btn.disabled=false; return; }

      // 点検必須
      const inspIds = [
        "insp_tire","insp_light","insp_brake","insp_wiper","insp_engineOil","insp_coolant",
        "insp_battery","insp_horn","insp_mirror","insp_damage","insp_cargo","insp_extinguisher","insp_triangle"
      ];
      const insp = {};
      let inspOK = true;
      inspIds.forEach(id=>{
        const el = $(id);
        const v = el?.value || "";
        insp[id] = v;
        const empty = isEmpty(v);
        markError(el, empty);
        if(empty) inspOK = false;
      });
      if(!inspOK){ scrollToFirstError(); btn.disabled=false; return; }

      // アルコール指標写真：必須
      const alcoholPhotos = await filesToDataURLs($("alcoholPhotos"), 2);
      if(alcoholPhotos.length === 0){
        markError($("alcoholPhotos"), true);
        toast("アルコール指標写真は必須です");
        btn.disabled=false; return;
      }else{
        markError($("alcoholPhotos"), false);
      }

      // 異常箇所：NGあれば必須
      const abnormalPhotos = await filesToDataURLs($("abnormalPhotos"), 6);
      if(anyNG(Object.values(insp)) && abnormalPhotos.length === 0){
        markError($("abnormalPhotos"), true);
        toast("点検NGがある場合は異常箇所写真を追加してください");
        btn.disabled=false; return;
      }else{
        markError($("abnormalPhotos"), false);
      }

      const payload = {
        kind: "arrival",
        date: $("date").value,
        time: $("time").value,
        driverName: $("driverName").value.trim(),
        driverPhone: ($("driverPhone")?.value || "").trim(),
        vehicleNo: $("vehicleNo").value.trim(),

        restHours: $("restHours").value,

        managerName: $("managerName").value.trim(),
        method: $("method").value,
        place: $("place").value.trim(),

        alcoholValue: $("alcoholValue").value.trim(),
        alcoholBand: $("alcoholBand").value,
        alcoholPhotos,

        licenseNo: $("licenseNo").value.trim(),

        memo: ($("memo")?.value || "").trim(),

        odoStart: ($("odoStart")?.value || "").trim(),
        odoEnd: ($("odoEnd")?.value || "").trim(),
        odoTotal: ($("odoTotal")?.value || "").trim(),

        inspections: {
          tire: $("insp_tire").value,
          light: $("insp_light").value,
          brake: $("insp_brake").value,
          wiper: $("insp_wiper").value,
          engineOil: $("insp_engineOil").value,
          coolant: $("insp_coolant").value,
          battery: $("insp_battery").value,
          horn: $("insp_horn").value,
          mirror: $("insp_mirror").value,
          damage: $("insp_damage").value,
          cargo: $("insp_cargo").value,
          extinguisher: $("insp_extinguisher").value,
          triangle: $("insp_triangle").value,
          note: ($("insp_note")?.value || "").trim(),
          abnormalPhotos
        },

        tenkoPhotos: await filesToDataURLs($("tenkoPhotos"), 4),

        // 日報（写真は日報のみ）
        report: {
          workType: $("workType").value.trim(),
          workArea: $("workArea").value.trim(),
          workHours: $("workHours").value.trim(),
          deliveryCount: ($("deliveryCount")?.value || "").trim(),
          trouble: ($("trouble")?.value || "").trim(),
          dailyNote: ($("dailyNote")?.value || "").trim(),
          reportPhotos: await filesToDataURLs($("reportPhotos"), 8)
        }
      };

      const r = await postJSON("submit_arrival", payload);
      toast("送信完了（帰着点呼/日報）", true);
      setTimeout(()=> location.href="./index.html", 650);

    }catch(e){
      toast(e.message || "送信に失敗しました");
    }finally{
      btn.disabled = false;
    }
  });
}

/* =========================
   出力ページ（本人/管理者）
========================= */
async function initExport(){
  const backBtn = $("backBtn");
  backBtn?.addEventListener("click", ()=> history.length ? history.back() : location.href="./index.html");

  // 既定日
  setNow($("day"), null);
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  if($("month")) $("month").value = `${y}-${m}`;

  const role = (JSON.parse(localStorage.getItem("OFA_TENKO_V2")||"{}").role) || "driver";
  $("modeBadge").textContent = role==="admin" ? "管理者" : "本人";
  $("modeBadge").className = "badge " + (role==="admin" ? "admin":"driver");

  // 本人のPDF
  $("btnDayPdf")?.addEventListener("click", async ()=>{
    try{
      if(!requireFields([{el:$("day")},{el:$("driverName")}])) return;
      const r = await postJSON("make_day_pdf", {
        day: $("day").value,
        driverName: $("driverName").value.trim(),
        scope: "self"
      });
      window.open(r.url, "_blank");
    }catch(e){ toast(e.message||"失敗"); }
  });

  // 月報（本人：詳細）
  $("btnMonthDetailPdf")?.addEventListener("click", async ()=>{
    try{
      if(!requireFields([{el:$("month")},{el:$("driverName")}])) return;
      const r = await postJSON("make_month_detail_pdf", {
        month: $("month").value,
        driverName: $("driverName").value.trim(),
        scope: "self"
      });
      window.open(r.url, "_blank");
    }catch(e){ toast(e.message||"失敗"); }
  });

  // 月報（本人：サマリ）
  $("btnMonthPdf")?.addEventListener("click", async ()=>{
    try{
      if(!requireFields([{el:$("month")},{el:$("driverName")}])) return;
      const r = await postJSON("make_month_pdf", {
        month: $("month").value,
        driverName: $("driverName").value.trim(),
        scope: "self"
      });
      window.open(r.url, "_blank");
    }catch(e){ toast(e.message||"失敗"); }
  });

  // CSV（本人）
  $("btnCsv")?.addEventListener("click", async ()=>{
    try{
      if(!requireFields([{el:$("from")},{el:$("to")},{el:$("driverName")}])) return;
      const r = await postJSON("export_csv", {
        from: $("from").value,
        to: $("to").value,
        driverName: $("driverName").value.trim(),
        scope:"self"
      });
      window.open(r.url, "_blank");
    }catch(e){ toast(e.message||"失敗"); }
  });

  // 管理者検索・全出力（adminのみ）
  const adminArea = $("adminArea");
  if(role === "admin"){
    adminArea?.classList.remove("hidden");

    $("btnSearch")?.addEventListener("click", async ()=>{
      try{
        if(!requireFields([{el:$("qFrom")},{el:$("qTo")}])) return;
        const r = await postJSON("admin_search", {
          from: $("qFrom").value,
          to: $("qTo").value,
          keyword: ($("keyword")?.value || "").trim()
        });
        $("result").value = JSON.stringify(r.items, null, 2);
        toast(`検索 ${r.items.length}件`, true);
      }catch(e){ toast(e.message||"失敗"); }
    });

    $("btnAdminCsv")?.addEventListener("click", async ()=>{
      try{
        if(!requireFields([{el:$("qFrom")},{el:$("qTo")}])) return;
        const r = await postJSON("export_csv", {
          from: $("qFrom").value,
          to: $("qTo").value,
          driverName: "",
          scope:"all"
        });
        window.open(r.url, "_blank");
      }catch(e){ toast(e.message||"失敗"); }
    });
  }
}

/* =========================
   初期化ルータ
========================= */
window.addEventListener("DOMContentLoaded", ()=>{
  const p = document.body?.dataset?.page || "";
  if(p === "departure") initDeparture();
  if(p === "arrival") initArrival();
  if(p === "export") initExport();

  // hidden クラス簡易
  document.querySelectorAll(".hidden").forEach(()=>{});
});
