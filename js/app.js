// /ofa-nippou/js/app.js
// OFA 点呼/日報（ドライバー）フル版
// - 基本情報：保存/読込（IndexedDB profile: id="me"）
// - 点呼：出発/帰着 保存（IndexedDB tenko）
// - 日報：任意 保存（IndexedDB daily）
// - 履歴：最新表示
// - PDF：generateTodayPdf を呼ぶ（pdf.js）
// - CSV：exportCsvSearchResult は管理側で利用（csv.js）
//
// 重要：Chrome対策
// - DOMContentLoaded後に必ずイベント付与
// - button type=button を強制
// - 例外は alert + console.error

(function(){
  "use strict";

  // ===== util =====
  const $ = (id) => document.getElementById(id);

  function nowIso(){
    const d = new Date();
    const pad = (n)=> String(n).padStart(2,"0");
    const y = d.getFullYear();
    const m = pad(d.getMonth()+1);
    const day = pad(d.getDate());
    const hh = pad(d.getHours());
    const mm = pad(d.getMinutes());
    return `${y}-${m}-${day}T${hh}:${mm}`;
  }

  function normDate(v){
    return String(v||"").slice(0,10);
  }

  function safeNum(n){
    const x = Number(n);
    return Number.isFinite(x) ? x : 0;
  }

  function calcOdoDiff(depOdo, arrOdo){
    const d = safeNum(arrOdo) - safeNum(depOdo);
    return d > 0 ? d : 0;
  }

  function alertErr(msg, e){
    if(e) console.error(e);
    alert(msg);
  }

  function requireValue(id, label){
    const el = $(id);
    const v = el ? String(el.value||"").trim() : "";
    if(!v){
      alert(`${label} が未入力です`);
      throw new Error(`required: ${id}`);
    }
    return v;
  }

  function optionalValue(id){
    const el = $(id);
    return el ? String(el.value||"").trim() : "";
  }

  function optionalFile(id){
    const el = $(id);
    const f = el && el.files && el.files[0] ? el.files[0] : null;
    return f;
  }

  // ===== IDs (HTML側のidと一致させる) =====
  // 基本情報
  const ID_P_NAME    = "p_name";
  const ID_P_BASE    = "p_base";
  const ID_P_CAR     = "p_car";
  const ID_P_LICENSE = "p_license";
  const ID_P_PHONE   = "p_phone";
  const ID_P_EMAIL   = "p_email";
  const ID_P_LIC_IMG = "p_license_img"; // 任意（PDF生成時のみ使用）

  const ID_BTN_P_SAVE = "btnProfileSave";
  const ID_BTN_P_LOAD = "btnProfileLoad";

  // 出発点呼
  const ID_DEP_AT       = "dep_at";
  const ID_DEP_METHOD   = "dep_method";
  const ID_DEP_SLEEP    = "dep_sleep";
  const ID_DEP_TEMP     = "dep_temp";
  const ID_DEP_COND     = "dep_condition";
  const ID_DEP_FATIGUE  = "dep_fatigue";
  const ID_DEP_MED      = "dep_med";
  const ID_DEP_MEDDET   = "dep_med_detail";
  const ID_DEP_ALC      = "dep_alc_value";
  const ID_DEP_ALCJ     = "dep_alc_judge";
  const ID_DEP_ODO      = "dep_odo_start";
  const ID_DEP_ABN      = "dep_abnormal";
  const ID_DEP_ABNDET   = "dep_abnormal_detail";
  const ID_DEP_ALC_IMG  = "dep_alc_img"; // 任意（PDF用）
  const ID_BTN_DEP_SAVE = "btnDepSave";

  // 日常点検（出発側で入力する想定）
  const ID_CHECK_MEMO = "check_memo";
  const CHECK_PREFIX  = "check_"; // 例: check_tire, check_light... など（HTML側に合わせる）

  // 帰着点呼
  const ID_ARR_AT       = "arr_at";
  const ID_ARR_METHOD   = "arr_method";
  const ID_ARR_SLEEP    = "arr_sleep";
  const ID_ARR_TEMP     = "arr_temp";
  const ID_ARR_COND     = "arr_condition";
  const ID_ARR_FATIGUE  = "arr_fatigue";
  const ID_ARR_MED      = "arr_med";
  const ID_ARR_MEDDET   = "arr_med_detail";
  const ID_ARR_ALC      = "arr_alc_value";
  const ID_ARR_ALCJ     = "arr_alc_judge";
  const ID_ARR_ODO      = "arr_odo_end";
  const ID_ARR_ABN      = "arr_abnormal";
  const ID_ARR_ABNDET   = "arr_abnormal_detail";
  const ID_ARR_ALC_IMG  = "arr_alc_img"; // 任意（PDF用）
  const ID_BTN_ARR_SAVE = "btnArrSave";

  // 日報（任意）
  const ID_DAILY_DATE      = "d_date";
  const ID_DAILY_MAIN      = "d_main_project";
  const ID_DAILY_PAY       = "d_pay_base";
  const ID_DAILY_INC       = "d_incentive";
  const ID_DAILY_FUEL      = "d_fuel";
  const ID_DAILY_HIGHWAY   = "d_highway";
  const ID_DAILY_PARKING   = "d_parking";
  const ID_DAILY_OTHER     = "d_other_cost";
  const ID_DAILY_SALES     = "d_sales_total";
  const ID_DAILY_PROFIT    = "d_profit";
  const ID_DAILY_MEMO      = "d_memo";
  const ID_BTN_DAILY_SAVE  = "btnDailySave";

  // 履歴
  const ID_HISTORY = "historyList";
  const ID_BTN_REFRESH = "btnRefreshHistory";

  // PDF
  const ID_BTN_PDF = "btnMakePdf";

  // 管理へ
  const ID_BTN_ADMIN = "btnGoAdmin";

  // ===== state =====
  let lastProfile = null;

  // ===== profile =====
  async function loadProfile(silent=false){
    try{
      const me = await idbGet("profile", "me");
      if(!me){
        if(!silent) alert("まだ保存がありません");
        lastProfile = null;
        return null;
      }
      lastProfile = me;

      if($(ID_P_NAME))    $(ID_P_NAME).value = me.name || "";
      if($(ID_P_BASE))    $(ID_P_BASE).value = me.base || "";
      if($(ID_P_CAR))     $(ID_P_CAR).value = me.carNo || "";
      if($(ID_P_LICENSE)) $(ID_P_LICENSE).value = me.licenseNo || "";
      if($(ID_P_PHONE))   $(ID_P_PHONE).value = me.phone || "";
      if($(ID_P_EMAIL))   $(ID_P_EMAIL).value = me.email || "";

      if(!silent) alert("読み込みました");
      return me;
    }catch(e){
      alertErr("読み込みに失敗しました（IndexedDBが使えない可能性）", e);
      return null;
    }
  }

  async function saveProfile(){
    try{
      const name = requireValue(ID_P_NAME, "氏名（本名）");
      const base = requireValue(ID_P_BASE, "拠点");
      const carNo = requireValue(ID_P_CAR, "車両番号");
      const licenseNo = requireValue(ID_P_LICENSE, "運転免許証番号");
      const phone = requireValue(ID_P_PHONE, "電話番号");
      const email = requireValue(ID_P_EMAIL, "メールアドレス");

      const profile = {
        id: "me",
        name, base, carNo, licenseNo, phone, email,
        updatedAt: new Date().toISOString()
      };

      await idbPut("profile", profile);
      lastProfile = profile;
      alert("基本情報を保存しました");
      await refreshHistory(true);
    }catch(e){
      if(String(e?.message||"").startsWith("required:")) return;
      alertErr("保存に失敗しました（IndexedDBが使えない可能性）", e);
    }
  }

  // ===== checklist =====
  function collectChecklist(){
    // HTML側にチェック項目がある場合：
    // <input type="checkbox" id="check_xxx" data-label="タイヤ"> のようにしておくと拾える
    const inputs = Array.from(document.querySelectorAll(`input[id^="${CHECK_PREFIX}"]`));
    const list = [];
    for(const el of inputs){
      if(el.type !== "checkbox") continue;
      const label = el.dataset.label || el.getAttribute("aria-label") || el.id.replace(CHECK_PREFIX,"");
      list.push({ label, ok: !!el.checked });
    }
    return list;
  }

  // ===== tenko save =====
  async function saveTenkoDeparture(){
    try{
      const profile = lastProfile || await idbGet("profile", "me");
      if(!profile){
        alert("先に『基本情報を保存』してください");
        return;
      }

      const at = requireValue(ID_DEP_AT, "点呼日時（出発）");
      const method = requireValue(ID_DEP_METHOD, "点呼実施方法（出発）");
      const sleep = requireValue(ID_DEP_SLEEP, "睡眠時間（出発）");
      const temp = requireValue(ID_DEP_TEMP, "体温（出発）");
      const condition = requireValue(ID_DEP_COND, "体調（出発）");
      const fatigue = requireValue(ID_DEP_FATIGUE, "疲労（出発）");

      const med = requireValue(ID_DEP_MED, "服薬（出発）");
      const medDetail = optionalValue(ID_DEP_MEDDET);

      const alcValue = requireValue(ID_DEP_ALC, "アルコール数値（出発）");
      const alcJudge = requireValue(ID_DEP_ALCJ, "アルコール判定（出発）");

      // ✅ 出発は出発ODOのみ（帰着はここでは入力しない）
      const odoStart = requireValue(ID_DEP_ODO, "出発ODO");

      const abnormal = requireValue(ID_DEP_ABN, "異常（出発）");
      const abnormalDetail = optionalValue(ID_DEP_ABNDET);

      const checklist = collectChecklist();
      const checkMemo = optionalValue(ID_CHECK_MEMO);

      const id = `tenko_departure_${normDate(at)}_${String(profile.name||"").trim()}_${Date.now()}`;

      const record = {
        id,
        type: "departure",
        at,
        name: profile.name,
        base: profile.base,
        carNo: profile.carNo,
        licenseNo: profile.licenseNo,
        phone: profile.phone,
        email: profile.email,

        method,
        sleep,
        temp,
        condition,
        fatigue,

        med,
        medDetail,

        alcValue,
        alcJudge,

        odoStart,
        odoEnd: "",      // 出発では空
        odoDiff: 0,      // 帰着が入るまでは0

        abnormal,
        abnormalDetail,

        checklist,
        checkMemo,

        createdAt: new Date().toISOString()
      };

      await idbPut("tenko", record);
      alert("出発点呼を保存しました");
      await refreshHistory(true);
    }catch(e){
      if(String(e?.message||"").startsWith("required:")) return;
      alertErr("出発点呼の保存に失敗しました", e);
    }
  }

  async function saveTenkoArrival(){
    try{
      const profile = lastProfile || await idbGet("profile", "me");
      if(!profile){
        alert("先に『基本情報を保存』してください");
        return;
      }

      const at = requireValue(ID_ARR_AT, "点呼日時（帰着）");
      const method = requireValue(ID_ARR_METHOD, "点呼実施方法（帰着）");
      const sleep = requireValue(ID_ARR_SLEEP, "睡眠時間（帰着）");
      const temp = requireValue(ID_ARR_TEMP, "体温（帰着）");
      const condition = requireValue(ID_ARR_COND, "体調（帰着）");
      const fatigue = requireValue(ID_ARR_FATIGUE, "疲労（帰着）");

      const med = requireValue(ID_ARR_MED, "服薬（帰着）");
      const medDetail = optionalValue(ID_ARR_MEDDET);

      const alcValue = requireValue(ID_ARR_ALC, "アルコール数値（帰着）");
      const alcJudge = requireValue(ID_ARR_ALCJ, "アルコール判定（帰着）");

      // ✅ 帰着は帰着ODOのみ
      const odoEnd = requireValue(ID_ARR_ODO, "帰着ODO");

      const abnormal = requireValue(ID_ARR_ABN, "異常（帰着）");
      const abnormalDetail = optionalValue(ID_ARR_ABNDET);

      // 日常点検は出発側で入力してる前提。帰着側では触らない。
      const id = `tenko_arrival_${normDate(at)}_${String(profile.name||"").trim()}_${Date.now()}`;

      const record = {
        id,
        type: "arrival",
        at,
        name: profile.name,
        base: profile.base,
        carNo: profile.carNo,
        licenseNo: profile.licenseNo,
        phone: profile.phone,
        email: profile.email,

        method,
        sleep,
        temp,
        condition,
        fatigue,

        med,
        medDetail,

        alcValue,
        alcJudge,

        odoStart: "",    // 帰着では空
        odoEnd,
        odoDiff: 0,      // 出発との突合でPDF生成時に計算

        abnormal,
        abnormalDetail,

        checklist: [],   // 帰着側では空
        checkMemo: "",

        createdAt: new Date().toISOString()
      };

      await idbPut("tenko", record);
      alert("帰着点呼を保存しました");
      await refreshHistory(true);
    }catch(e){
      if(String(e?.message||"").startsWith("required:")) return;
      alertErr("帰着点呼の保存に失敗しました", e);
    }
  }

  // ===== daily (optional) =====
  async function saveDailyOptional(){
    try{
      const profile = lastProfile || await idbGet("profile", "me");
      if(!profile){
        alert("先に『基本情報を保存』してください");
        return;
      }

      // 日報はオプション：ただし保存するなら date は必要
      const date = requireValue(ID_DAILY_DATE, "稼働日（日報）");

      const mainProject = optionalValue(ID_DAILY_MAIN);

      const payBase = optionalValue(ID_DAILY_PAY);
      const incentive = optionalValue(ID_DAILY_INC);
      const fuel = optionalValue(ID_DAILY_FUEL);
      const highway = optionalValue(ID_DAILY_HIGHWAY);
      const parking = optionalValue(ID_DAILY_PARKING);
      const otherCost = optionalValue(ID_DAILY_OTHER);

      const salesTotal = optionalValue(ID_DAILY_SALES);
      const profit = optionalValue(ID_DAILY_PROFIT);
      const memo = optionalValue(ID_DAILY_MEMO);

      // 走行距離は tenko の ODOから算出して入れておく（空でもOK）
      const { dep, arr, odoDiff } = await findTenkoPairByDate(profile.name, profile.base, date);

      const id = `daily_${normDate(date)}_${String(profile.name||"").trim()}_${Date.now()}`;

      const record = {
        id,
        date: normDate(date),
        name: profile.name,
        base: profile.base,

        mainProject,
        odoDiff, // あれば自動

        payBase,
        incentive,
        fuel,
        highway,
        parking,
        otherCost,
        salesTotal,
        profit,
        memo,

        projects: [], // 将来拡張
        createdAt: new Date().toISOString()
      };

      await idbPut("daily", record);
      alert("日報（任意）を保存しました");
      await refreshHistory(true);
    }catch(e){
      if(String(e?.message||"").startsWith("required:")) return;
      alertErr("日報の保存に失敗しました", e);
    }
  }

  // ===== find pair (dep+arr) by date =====
  async function findTenkoPairByDate(name, base, date){
    const all = await idbGetAll("tenko");
    const d = normDate(date);

    const same = all.filter(t =>
      normDate(t.at) === d &&
      String(t.name||"") === String(name||"") &&
      String(t.base||"") === String(base||"")
    );

    const dep = same.filter(x=>x.type==="departure").sort((a,b)=> String(b.at).localeCompare(String(a.at)))[0] || null;
    const arr = same.filter(x=>x.type==="arrival").sort((a,b)=> String(b.at).localeCompare(String(a.at)))[0] || null;

    const odoDiff = calcOdoDiff(dep?.odoStart, arr?.odoEnd);

    return { dep, arr, odoDiff };
  }

  // ===== history =====
  async function refreshHistory(silent=false){
    try{
      const box = $(ID_HISTORY);
      if(!box) return;

      const profile = lastProfile || await idbGet("profile","me");
      const name = profile?.name || "";
      const base = profile?.base || "";

      const tenko = (await idbGetAll("tenko"))
        .filter(r => (!name || r.name===name) && (!base || r.base===base))
        .sort((a,b)=> String(b.at).localeCompare(String(a.at)));

      const daily = (await idbGetAll("daily"))
        .filter(r => (!name || r.name===name) && (!base || r.base===base))
        .sort((a,b)=> String(b.date).localeCompare(String(a.date)));

      // UI
      const lines = [];

      lines.push(`<div class="miniTitle">点呼履歴（最新）</div>`);
      if(tenko.length === 0){
        lines.push(`<div class="item muted">まだ点呼がありません</div>`);
      }else{
        for(const t of tenko.slice(0, 12)){
          lines.push(`
            <div class="item">
              <span class="k">${(t.type==="departure")?"出発":"帰着"}</span>
              <span class="v">${t.at || ""}</span>
              <span class="muted">ODO:${(t.type==="departure")?(t.odoStart||""):(t.odoEnd||"")}</span>
            </div>
          `);
        }
      }

      lines.push(`<div class="divider"></div>`);
      lines.push(`<div class="miniTitle">日報履歴（最新）</div>`);
      if(daily.length === 0){
        lines.push(`<div class="item muted">まだ日報がありません（任意）</div>`);
      }else{
        for(const d of daily.slice(0, 12)){
          lines.push(`
            <div class="item">
              <span class="k">日報</span>
              <span class="v">${d.date || ""}</span>
              <span class="muted">売上:${d.salesTotal||""} / 利益:${d.profit||""}</span>
            </div>
          `);
        }
      }

      box.innerHTML = lines.join("");
      if(!silent) {
        // no alert
      }
    }catch(e){
      alertErr("履歴の更新に失敗しました", e);
    }
  }

  // ===== PDF (today / selected date) =====
  async function makePdfToday(){
    try{
      const profile = lastProfile || await idbGet("profile","me");
      if(!profile){
        alert("先に『基本情報を保存』してください");
        return;
      }

      // PDF対象日：日報日があればそれ、無ければ今日
      let dateKey = optionalValue(ID_DAILY_DATE);
      if(!dateKey) dateKey = normDate(new Date().toISOString());

      const { dep, arr, odoDiff } = await findTenkoPairByDate(profile.name, profile.base, dateKey);

      // dailyは同日最新を拾う
      const allDaily = await idbGetAll("daily");
      const daily = allDaily
        .filter(x => x.name===profile.name && x.base===profile.base && x.date===normDate(dateKey))
        .sort((a,b)=> String(b.createdAt||"").localeCompare(String(a.createdAt||"")))[0] || null;

      const files = {
        licenseImg: optionalFile(ID_P_LIC_IMG),
        alcDepImg: optionalFile(ID_DEP_ALC_IMG),
        alcArrImg: optionalFile(ID_ARR_ALC_IMG),
      };

      await generateTodayPdf({
        profile,
        dep,
        arr,
        daily,
        odoDiff,
        files
      });

    }catch(e){
      alertErr("PDF作成に失敗しました", e);
    }
  }

  // ===== go admin =====
  function goAdmin(){
    // ここはあなたの運用URLに合わせてOK
    // GitHub Pages上の admin
    location.href = "./admin/index.html?v=20260124";
  }

  // ===== init =====
  function forceButtonType(){
    // form submit誤爆を防ぐ
    const ids = [
      ID_BTN_P_SAVE, ID_BTN_P_LOAD,
      ID_BTN_DEP_SAVE, ID_BTN_ARR_SAVE,
      ID_BTN_DAILY_SAVE,
      ID_BTN_REFRESH,
      ID_BTN_PDF,
      ID_BTN_ADMIN
    ];
    for(const id of ids){
      const b = $(id);
      if(b && b.tagName === "BUTTON") b.type = "button";
    }
  }

  function bindEvents(){
    // 基本情報
    const btnSave = $(ID_BTN_P_SAVE);
    if(btnSave) btnSave.addEventListener("click", saveProfile, { passive:true });

    const btnLoad = $(ID_BTN_P_LOAD);
    if(btnLoad) btnLoad.addEventListener("click", ()=>loadProfile(false), { passive:true });

    // 出発/帰着
    const btnDep = $(ID_BTN_DEP_SAVE);
    if(btnDep) btnDep.addEventListener("click", saveTenkoDeparture, { passive:true });

    const btnArr = $(ID_BTN_ARR_SAVE);
    if(btnArr) btnArr.addEventListener("click", saveTenkoArrival, { passive:true });

    // 日報（任意）
    const btnDaily = $(ID_BTN_DAILY_SAVE);
    if(btnDaily) btnDaily.addEventListener("click", saveDailyOptional, { passive:true });

    // 履歴更新
    const btnRef = $(ID_BTN_REFRESH);
    if(btnRef) btnRef.addEventListener("click", ()=>refreshHistory(true), { passive:true });

    // PDF
    const btnPdf = $(ID_BTN_PDF);
    if(btnPdf) btnPdf.addEventListener("click", makePdfToday, { passive:true });

    // 管理へ
    const btnAdmin = $(ID_BTN_ADMIN);
    if(btnAdmin) btnAdmin.addEventListener("click", goAdmin, { passive:true });
  }

  document.addEventListener("DOMContentLoaded", async () => {
    try{
      forceButtonType();
      bindEvents();

      // 初期値：日時を入れておく（未入力事故防止）
      if($(ID_DEP_AT) && !$(ID_DEP_AT).value) $(ID_DEP_AT).value = nowIso();
      if($(ID_ARR_AT) && !$(ID_ARR_AT).value) $(ID_ARR_AT).value = nowIso();
      if($(ID_DAILY_DATE) && !$(ID_DAILY_DATE).value) $(ID_DAILY_DATE).value = normDate(new Date().toISOString());

      // 保存済み基本情報があれば自動読み込み（silent）
      await loadProfile(true);
      await refreshHistory(true);

    }catch(e){
      alertErr("初期化に失敗しました", e);
    }
  });

})();
