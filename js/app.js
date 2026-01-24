// /js/app.js
// OFA 点呼/日報（ドライバー）
// - IndexedDB保存
// - 履歴カード：見やすく、タップでその日のPDF出力（過去日OK）
// - 個別削除 / 全削除
// - Chrome/Safari安定（DOMContentLoadedで束縛、passive:false）

(() => {
  "use strict";

  // =============================
  // DOM utils
  // =============================
  const $ = (id) => document.getElementById(id);

  function toast(msg){
    alert(msg); // まずは確実な alert（必要なら後でtoast UIに差し替えOK）
  }

  function fmtDateTime(v){
    if(!v) return "";
    return String(v).replace("T"," ").slice(0,16);
  }

  function ymdFromAny(v){
    if(!v) return "";
    return String(v).slice(0,10);
  }

  function safeNum(n){
    const x = Number(n);
    return Number.isFinite(x) ? x : 0;
  }

  function esc(s){
    return String(s ?? "")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  }

  function todayYMD(){
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,"0");
    const dd = String(d.getDate()).padStart(2,"0");
    return `${y}-${m}-${dd}`;
  }

  function setDot(id, ok){
    const el = $(id);
    if(!el) return;
    el.classList.remove("ok","warn");
    if(ok) el.classList.add("ok");
  }

  // =============================
  // IndexedDB fallback (直叩き)
  // =============================
  const OFA_DB_NAME = "ofa_nippou_db";
  const OFA_DB_VER  = 1;
  const STORE_PROFILE = "profile";
  const STORE_TENKO   = "tenko";
  const STORE_DAILY   = "daily";

  function idbOpen(){
    return new Promise((resolve, reject)=>{
      const req = indexedDB.open(OFA_DB_NAME, OFA_DB_VER);
      req.onsuccess = ()=> resolve(req.result);
      req.onerror = ()=> reject(req.error);
    });
  }

  async function idbGet(store, key){
    const db = await idbOpen();
    return new Promise((resolve, reject)=>{
      const tx = db.transaction(store, "readonly");
      const req = tx.objectStore(store).get(key);
      req.onsuccess = ()=> resolve(req.result || null);
      req.onerror = ()=> reject(req.error);
    });
  }

  async function idbPut(store, value){
    const db = await idbOpen();
    return new Promise((resolve, reject)=>{
      const tx = db.transaction(store, "readwrite");
      const req = tx.objectStore(store).put(value);
      req.onsuccess = ()=> resolve(true);
      req.onerror = ()=> reject(req.error);
    });
  }

  async function idbAll(store){
    const db = await idbOpen();
    return new Promise((resolve, reject)=>{
      const tx = db.transaction(store, "readonly");
      const req = tx.objectStore(store).getAll();
      req.onsuccess = ()=> resolve(req.result || []);
      req.onerror = ()=> reject(req.error);
    });
  }

  async function idbDelete(store, key){
    const db = await idbOpen();
    return new Promise((resolve, reject)=>{
      const tx = db.transaction(store, "readwrite");
      const req = tx.objectStore(store).delete(key);
      req.onsuccess = ()=> resolve(true);
      req.onerror = ()=> reject(req.error);
    });
  }

  async function idbClear(store){
    const db = await idbOpen();
    return new Promise((resolve, reject)=>{
      const tx = db.transaction(store, "readwrite");
      const req = tx.objectStore(store).clear();
      req.onsuccess = ()=> resolve(true);
      req.onerror = ()=> reject(req.error);
    });
  }

  // =============================
  // db.js 互換呼び出し（あれば優先）
  // =============================
  const DB = {
    async getProfile(){
      // db.jsがある場合はそちら（キー名が違う可能性あり）
      if (typeof window.dbGetProfile === "function") return await window.dbGetProfile();
      if (typeof window.dbGet === "function") {
        // よくある: dbGet(store, key)
        try { return await window.dbGet("profile", "main"); } catch {}
      }
      // 直叩き（profile storeに key="main" を想定）
      return await idbGet(STORE_PROFILE, "main");
    },
    async saveProfile(profile){
      if (typeof window.dbSaveProfile === "function") return await window.dbSaveProfile(profile);
      if (typeof window.dbPut === "function") {
        try { return await window.dbPut("profile", profile); } catch {}
      }
      return await idbPut(STORE_PROFILE, profile);
    },

    async putTenko(row){
      if (typeof window.dbPutTenko === "function") return await window.dbPutTenko(row);
      if (typeof window.dbPut === "function") {
        try { return await window.dbPut("tenko", row); } catch {}
      }
      return await idbPut(STORE_TENKO, row);
    },
    async putDaily(row){
      if (typeof window.dbPutDaily === "function") return await window.dbPutDaily(row);
      if (typeof window.dbPut === "function") {
        try { return await window.dbPut("daily", row); } catch {}
      }
      return await idbPut(STORE_DAILY, row);
    },

    async allTenko(){
      if (typeof window.dbAllTenko === "function") return await window.dbAllTenko();
      if (typeof window.dbGetAll === "function") {
        try { return await window.dbGetAll("tenko"); } catch {}
      }
      return await idbAll(STORE_TENKO);
    },
    async allDaily(){
      if (typeof window.dbAllDaily === "function") return await window.dbAllDaily();
      if (typeof window.dbGetAll === "function") {
        try { return await window.dbGetAll("daily"); } catch {}
      }
      return await idbAll(STORE_DAILY);
    },

    async delTenko(id){
      if (typeof window.dbDeleteTenko === "function") return await window.dbDeleteTenko(id);
      if (typeof window.dbDelete === "function") {
        try { return await window.dbDelete("tenko", id); } catch {}
      }
      return await idbDelete(STORE_TENKO, id);
    },
    async delDaily(id){
      if (typeof window.dbDeleteDaily === "function") return await window.dbDeleteDaily(id);
      if (typeof window.dbDelete === "function") {
        try { return await window.dbDelete("daily", id); } catch {}
      }
      return await idbDelete(STORE_DAILY, id);
    },

    async clearAll(){
      // 既存関数があれば使う
      if (typeof window.dbClearAll === "function") return await window.dbClearAll();
      await idbClear(STORE_TENKO);
      await idbClear(STORE_DAILY);
      // profileは残す運用の方が多いので、ここでは消さない（必要なら別ボタンにする）
      return true;
    }
  };

  // =============================
  // フォーム取得/反映
  // =============================
  function getProfileFromForm(){
    return {
      id: "main",
      name: ($("p_name")?.value || "").trim(),
      base: ($("p_base")?.value || "").trim(),
      carNo: ($("p_carNo")?.value || "").trim(),
      licenseNo: ($("p_licenseNo")?.value || "").trim(),
      phone: ($("p_phone")?.value || "").trim(),
      email: ($("p_email")?.value || "").trim(),
      updatedAt: new Date().toISOString(),
    };
  }

  function setProfileToForm(p){
    if(!p) return;
    $("p_name").value = p.name || "";
    $("p_base").value = p.base || "";
    $("p_carNo").value = p.carNo || "";
    $("p_licenseNo").value = p.licenseNo || "";
    $("p_phone").value = p.phone || "";
    $("p_email").value = p.email || "";
  }

  function profileIsValid(p){
    return !!(p.name && p.base && p.carNo && p.licenseNo && p.phone && p.email);
  }

  // 出発
  function getDepFromForm(){
    return {
      id: `dep_${Date.now()}`,
      type: "dep", // 出発
      at: $("d_at")?.value || "",
      method: $("d_method")?.value || "",
      sleep: $("d_sleep")?.value || "",
      temp: $("d_temp")?.value || "",
      condition: $("d_condition")?.value || "",
      fatigue: $("d_fatigue")?.value || "",
      med: $("d_med")?.value || "",
      medDetail: $("d_medDetail")?.value || "",
      drink: $("d_drink")?.value || "",
      alcState: $("d_alcState")?.value || "",
      alcValue: $("d_alcValue")?.value || "",
      alcJudge: $("d_alcJudge")?.value || "",
      projectMain: $("d_projectMain")?.value || "",
      area: $("d_area")?.value || "",
      danger: $("d_danger")?.value || "",
      odoStart: $("d_odoStart")?.value || "",
      abnormal: $("d_abnormal")?.value || "",
      abnormalDetail: $("d_abnormalDetail")?.value || "",
      // checklist / memo は後で（db.js側で持ってるならそこに合わせる）
      createdAt: new Date().toISOString(),
    };
  }

  function clearDepForm(){
    $("d_at").value = "";
    $("d_method").value = "";
    $("d_sleep").value = "";
    $("d_temp").value = "";
    $("d_condition").value = "";
    $("d_fatigue").value = "";
    $("d_med").value = "";
    $("d_medDetail").value = "";
    $("d_drink").value = "";
    $("d_alcState").value = "";
    $("d_alcValue").value = "";
    $("d_alcJudge").value = "";
    $("d_projectMain").value = "";
    $("d_area").value = "";
    $("d_danger").value = "";
    $("d_odoStart").value = "";
    $("d_abnormal").value = "";
    $("d_abnormalDetail").value = "";
    if($("f_alcDepImg")) $("f_alcDepImg").value = "";
    if($("f_abnDepImg")) $("f_abnDepImg").value = "";
  }

  // 帰着
  function getArrFromForm(){
    return {
      id: `arr_${Date.now()}`,
      type: "arr", // 帰着
      at: $("a_at")?.value || "",
      method: $("a_method")?.value || "",
      breakMin: $("a_breakMin")?.value || "",
      temp: $("a_temp")?.value || "",
      condition: $("a_condition")?.value || "",
      fatigue: $("a_fatigue")?.value || "",
      med: $("a_med")?.value || "",
      medDetail: $("a_medDetail")?.value || "",
      alcState: $("a_alcState")?.value || "",
      alcValue: $("a_alcValue")?.value || "",
      alcJudge: $("a_alcJudge")?.value || "",
      odoEnd: $("a_odoEnd")?.value || "",
      abnormal: $("a_abnormal")?.value || "",
      abnormalDetail: $("a_abnormalDetail")?.value || "",
      createdAt: new Date().toISOString(),
    };
  }

  function clearArrForm(){
    $("a_at").value = "";
    $("a_method").value = "";
    $("a_breakMin").value = "";
    $("a_temp").value = "";
    $("a_condition").value = "";
    $("a_fatigue").value = "";
    $("a_med").value = "";
    $("a_medDetail").value = "";
    $("a_alcState").value = "";
    $("a_alcValue").value = "";
    $("a_alcJudge").value = "";
    $("a_odoEnd").value = "";
    $("a_abnormal").value = "";
    $("a_abnormalDetail").value = "";
    if($("f_alcArrImg")) $("f_alcArrImg").value = "";
    if($("f_abnArrImg")) $("f_abnArrImg").value = "";
  }

  // 日報（任意）
  function getDailyFromForm(){
    // 複数案件はここでは保存キー統一だけ（projectsBoxは既存実装がある前提）
    const projects = [];
    document.querySelectorAll("#projectsBox .pjRow").forEach(row=>{
      const main = row.querySelector('[data-k="main"]')?.value || "";
      const pay  = row.querySelector('[data-k="pay"]')?.value || "";
      projects.push({ main, pay });
    });

    const basePay = safeNum($("r_payBase")?.value);
    const inc     = safeNum($("r_incentive")?.value);
    const fuel    = safeNum($("r_fuel")?.value);
    const hw      = safeNum($("r_highway")?.value);
    const park    = safeNum($("r_parking")?.value);
    const other   = safeNum($("r_otherCost")?.value);

    const salesTotal = basePay + inc;
    const costTotal  = fuel + hw + park + other;
    const profit     = salesTotal - costTotal;

    return {
      id: `daily_${Date.now()}`,
      date: $("r_date")?.value || "",
      start: $("r_start")?.value || "",
      end: $("r_end")?.value || "",
      breakMin: $("r_break")?.value || "",
      count: $("r_count")?.value || "",
      absent: $("r_absent")?.value || "",
      redel: $("r_redel")?.value || "",
      ret: $("r_return")?.value || "",
      claim: $("r_claim")?.value || "",
      claimDetail: $("r_claimDetail")?.value || "",
      payBase: basePay,
      incentive: inc,
      fuel,
      highway: hw,
      parking: park,
      otherCost: other,
      salesTotal,
      costTotal,
      profit,
      memo: $("r_memo")?.value || "",
      projects,
      createdAt: new Date().toISOString(),
    };
  }

  // =============================
  // ODO計算
  // =============================
  function calcOdoDiff(dep, arr){
    const s = safeNum(dep?.odoStart);
    const e = safeNum(arr?.odoEnd);
    const diff = e - s;
    return diff > 0 ? diff : 0;
  }

  function updateOdoState(dep, arr){
    const diff = calcOdoDiff(dep, arr);
    if(diff > 0){
      setDot("dotOdo", true);
      if($("odoState")) $("odoState").textContent = `走行距離：${diff} km`;
    }else{
      setDot("dotOdo", false);
      if($("odoState")) $("odoState").textContent = "走行距離：未計算";
    }
    return diff;
  }

  // =============================
  // 履歴表示（カードUI + タップでPDF）
  // =============================
  // 日付ごとに dep/arr/daily をまとめる
  function groupByDay(tenkoAll, dailyAll){
    const map = new Map();

    tenkoAll.forEach(t=>{
      const day = ymdFromAny(t.at);
      if(!day) return;
      if(!map.has(day)) map.set(day, { day, dep:null, arr:null, daily:null, items:[] });
      const g = map.get(day);
      if(t.type === "arr") g.arr = t;
      else g.dep = t;
      g.items.push({ kind:"tenko", row:t });
    });

    dailyAll.forEach(r=>{
      const day = ymdFromAny(r.date || r.createdAt || "");
      if(!day) return;
      if(!map.has(day)) map.set(day, { day, dep:null, arr:null, daily:null, items:[] });
      const g = map.get(day);
      g.daily = r;
      g.items.push({ kind:"daily", row:r });
    });

    return Array.from(map.values()).sort((a,b)=> (a.day < b.day ? 1 : -1)); // 新しい順
  }

  function historyCardHtml(g, profile){
    const depAt = g.dep?.at ? fmtDateTime(g.dep.at) : "";
    const arrAt = g.arr?.at ? fmtDateTime(g.arr.at) : "";
    const odo = calcOdoDiff(g.dep, g.arr);

    const title = `${g.day} の履歴`;
    const sub = [
      depAt ? `出発:${depAt}` : "出発:—",
      arrAt ? `帰着:${arrAt}` : "帰着:—",
      `走行:${odo || 0}km`,
      g.daily?.salesTotal != null ? `売上:${g.daily.salesTotal}` : "売上:—"
    ].join(" / ");

    // 個別削除：その日まとめて削除（dep/arr/daily全部）
    return `
      <div class="historyItem" data-day="${esc(g.day)}" style="position:relative">
        <div class="historyTop">
          <div>
            <div class="historyTitle">${esc(title)}</div>
            <div class="historyBody" style="margin-top:4px;opacity:.9">${esc(sub)}</div>
            <div class="historyBody" style="margin-top:6px;opacity:.75">
              ${esc(profile?.base || g.dep?.base || g.arr?.base || "拠点:—")} / ${esc(profile?.name || g.dep?.name || g.arr?.name || "氏名:—")} / ${esc(profile?.phone || g.dep?.phone || g.arr?.phone || "TEL:—")}
            </div>
            <div class="historyBody" style="margin-top:6px;opacity:.7">
              タップでこの日のPDFを出力
            </div>
          </div>

          <div class="historyActions" onclick="event.stopPropagation()">
            <button class="miniBtn danger" data-act="delDay" data-day="${esc(g.day)}">削除</button>
          </div>
        </div>
      </div>
    `;
  }

  async function renderHistory(){
    const profile = await DB.getProfile().catch(()=>null);
    const [tenkoAll, dailyAll] = await Promise.all([DB.allTenko(), DB.allDaily()]);
    const groups = groupByDay(tenkoAll, dailyAll);

    const box = $("historyBox");
    if(!box) return;

    if(!groups.length){
      box.innerHTML = `<div class="note" style="opacity:.8">履歴がありません</div>`;
      return;
    }

    box.innerHTML = groups.map(g=>historyCardHtml(g, profile)).join("");

    // カードタップ → PDF
    box.querySelectorAll(".historyItem").forEach(el=>{
      el.addEventListener("click", async ()=>{
        const day = el.dataset.day;
        await exportPdfByDay(day);
      }, {passive:true});
    });

    // 個別削除
    box.querySelectorAll('[data-act="delDay"]').forEach(btn=>{
      btn.addEventListener("click", async (e)=>{
        e.preventDefault();
        const day = btn.dataset.day;
        if(!confirm(`${day} の履歴を削除しますか？（出発/帰着/日報）`)) return;
        await deleteByDay(day);
        await renderHistory();
        toast("削除しました");
      }, {passive:false});
    });
  }

  // =============================
  // その日のデータを探してPDF出力
  // =============================
  async function exportPdfByDay(dayYmd){
    const profile = await DB.getProfile().catch(()=>null);
    if(!profile || !profileIsValid(profile)){
      toast("先に「基本情報」を保存してください（必須）");
      return;
    }

    const [tenkoAll, dailyAll] = await Promise.all([DB.allTenko(), DB.allDaily()]);
    const dep = tenkoAll
      .filter(t=> t.type !== "arr" && ymdFromAny(t.at) === dayYmd)
      .sort((a,b)=> new Date(a.at).getTime() - new Date(b.at).getTime())
      .at(-1) || null;

    const arr = tenkoAll
      .filter(t=> t.type === "arr" && ymdFromAny(t.at) === dayYmd)
      .sort((a,b)=> new Date(a.at).getTime() - new Date(b.at).getTime())
      .at(-1) || null;

    const daily = dailyAll
      .filter(r=> ymdFromAny(r.date || r.createdAt) === dayYmd)
      .sort((a,b)=> new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime())
      .at(-1) || null;

    const odoDiff = calcOdoDiff(dep, arr);

    if(typeof window.generateTodayPdf !== "function"){
      toast("PDF機能が読み込めていません（pdf.js）");
      return;
    }

    // ファイル入力（その日じゃなくても当日フォームに入ってる分を使う）
    const files = {
      licenseImg: $("f_licenseImg")?.files?.[0] || null,
      alcDepImg: $("f_alcDepImg")?.files?.[0] || null,
      alcArrImg: $("f_alcArrImg")?.files?.[0] || null,
    };

    // generateTodayPdf を “過去日” でも流用（keyは daily.date or dep.at が使われる）
    await window.generateTodayPdf({ profile, dep, arr, daily, odoDiff, files });
  }

  // =============================
  // 日付で削除（dep/arr/daily）
  // =============================
  async function deleteByDay(dayYmd){
    const [tenkoAll, dailyAll] = await Promise.all([DB.allTenko(), DB.allDaily()]);
    const tenkoTargets = tenkoAll.filter(t=> ymdFromAny(t.at) === dayYmd);
    const dailyTargets = dailyAll.filter(r=> ymdFromAny(r.date || r.createdAt) === dayYmd);

    for(const t of tenkoTargets){
      if(t.id != null) await DB.delTenko(t.id).catch(()=>{});
    }
    for(const r of dailyTargets){
      if(r.id != null) await DB.delDaily(r.id).catch(()=>{});
    }
  }

  // =============================
  // 保存ボタン動作
  // =============================
  async function saveProfile(){
    const p = getProfileFromForm();
    if(!profileIsValid(p)){
      toast("基本情報はすべて必須です（氏名/拠点/車両/免許/電話/メール）");
      setDot("dotProfile", false);
      if($("profileState")) $("profileState").textContent = "未保存（必須未入力あり）";
      return;
    }
    await DB.saveProfile(p);
    setDot("dotProfile", true);
    if($("profileState")) $("profileState").textContent = "保存済み";
    toast("基本情報を保存しました");
  }

  async function loadProfile(){
    const p = await DB.getProfile().catch(()=>null);
    if(!p){
      toast("保存済みの基本情報がありません");
      setDot("dotProfile", false);
      if($("profileState")) $("profileState").textContent = "未保存";
      return;
    }
    setProfileToForm(p);
    setDot("dotProfile", true);
    if($("profileState")) $("profileState").textContent = "保存済み（読み込み）";
    toast("基本情報を読み込みました");
  }

  async function saveDep(){
    const profile = await DB.getProfile().catch(()=>null);
    if(!profile || !profileIsValid(profile)){
      toast("先に「基本情報」を保存してください（必須）");
      return;
    }

    const dep = getDepFromForm();
    // 基本情報を点呼レコードにも埋めて、管理検索（拠点/氏名/電話）に強くする
    dep.name = profile.name;
    dep.base = profile.base;
    dep.phone = profile.phone;

    if(!dep.at || !dep.method || !dep.sleep || !dep.temp || !dep.condition || !dep.fatigue ||
       !dep.med || !dep.drink || !dep.alcState || dep.alcValue === "" || !dep.alcJudge ||
       !dep.projectMain || !dep.area || !dep.danger || dep.odoStart === "" || !dep.abnormal){
      toast("出発点呼の必須項目を入力してください");
      return;
    }
    if(dep.abnormal === "あり" && !dep.abnormalDetail){
      toast("異常ありの場合は「異常内容」を入力してください");
      return;
    }

    await DB.putTenko(dep);
    toast("出発点呼を保存しました");
    await renderHistory();
  }

  async function saveArr(){
    const profile = await DB.getProfile().catch(()=>null);
    if(!profile || !profileIsValid(profile)){
      toast("先に「基本情報」を保存してください（必須）");
      return;
    }

    const arr = getArrFromForm();
    arr.name = profile.name;
    arr.base = profile.base;
    arr.phone = profile.phone;

    if(!arr.at || !arr.method || arr.breakMin === "" || !arr.temp || !arr.condition || !arr.fatigue ||
       !arr.med || !arr.alcState || arr.alcValue === "" || !arr.alcJudge ||
       arr.odoEnd === "" || !arr.abnormal){
      toast("帰着点呼の必須項目を入力してください");
      return;
    }
    if(arr.abnormal === "あり" && !arr.abnormalDetail){
      toast("異常ありの場合は「異常内容」を入力してください");
      return;
    }

    await DB.putTenko(arr);
    toast("帰着点呼を保存しました");
    await renderHistory();
  }

  async function makeTodayPdf(){
    const profile = await DB.getProfile().catch(()=>null);
    if(!profile || !profileIsValid(profile)){
      toast("先に「基本情報」を保存してください（必須）");
      return;
    }

    const day = todayYMD();
    await exportPdfByDay(day);
  }

  // CSVは既存csv.jsに任せる（全履歴）
  async function makeCsv(){
    if(typeof window.exportAllCsv === "function"){
      await window.exportAllCsv();
      return;
    }
    // fallback：json
    const [tenkoAll, dailyAll] = await Promise.all([DB.allTenko(), DB.allDaily()]);
    const blob = new Blob([JSON.stringify({tenkoAll,dailyAll}, null, 2)], {type:"application/json"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `OFA_all_${todayYMD().replaceAll("-","")}.json`;
    a.click();
  }

  // 全削除（点呼/日報）
  async function clearAll(){
    if(!confirm("点呼/日報の履歴を全削除しますか？（基本情報は残します）")) return;
    await DB.clearAll();
    toast("全削除しました");
    await renderHistory();
  }

  // =============================
  // 初期化
  // =============================
  document.addEventListener("DOMContentLoaded", async ()=>{
    // プロファイル状態表示
    const p = await DB.getProfile().catch(()=>null);
    if(p && profileIsValid(p)){
      setDot("dotProfile", true);
      if($("profileState")) $("profileState").textContent = "保存済み";
      // 自動入力しておく（現場が楽）
      setProfileToForm(p);
    }else{
      setDot("dotProfile", false);
      if($("profileState")) $("profileState").textContent = "未保存";
    }

    // ボタン束縛
    $("btnSaveProfile")?.addEventListener("click", async (e)=>{ e.preventDefault(); await saveProfile(); }, {passive:false});
    $("btnLoadProfile")?.addEventListener("click", async (e)=>{ e.preventDefault(); await loadProfile(); }, {passive:false});

    $("btnSaveDep")?.addEventListener("click", async (e)=>{ e.preventDefault(); await saveDep(); }, {passive:false});
    $("btnClearDep")?.addEventListener("click", (e)=>{ e.preventDefault(); clearDepForm(); }, {passive:false});

    $("btnSaveArr")?.addEventListener("click", async (e)=>{ e.preventDefault(); await saveArr(); }, {passive:false});
    $("btnClearArr")?.addEventListener("click", (e)=>{ e.preventDefault(); clearArrForm(); }, {passive:false});

    $("btnMakePdf")?.addEventListener("click", async (e)=>{ e.preventDefault(); await makeTodayPdf(); }, {passive:false});
    $("btnMakeCsv")?.addEventListener("click", async (e)=>{ e.preventDefault(); await makeCsv(); }, {passive:false});

    $("btnReloadHistory")?.addEventListener("click", async (e)=>{ e.preventDefault(); await renderHistory(); }, {passive:false});
    $("btnClearAll")?.addEventListener("click", async (e)=>{ e.preventDefault(); await clearAll(); }, {passive:false});

    // 初回履歴
    await renderHistory();
  });

})();
