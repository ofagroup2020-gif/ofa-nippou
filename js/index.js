// js/index.js
// Driver app core (Profile / Departure Tenko / Arrival Tenko / Daily / History / PDF / CSV)
// - IndexedDB保存（画像は保存しない）
// - 出発/帰着は分離入力
// - 日報・売上はオプション（未入力OK）
// - 履歴表示（点呼/日報）
// - PDF生成（pdf.js）
// - CSV出力（csv.js）

/* global idbPut, idbGet, idbGetAll, idbDelete,
          STORE_PROFILE, STORE_TENKO, STORE_DAILY,
          normalizeDate, inRange, includesLike,
          generateTodayPdf, exportCsvSearchResult */

(() => {
  "use strict";

  // ====== helpers ======
  const $ = (id) => document.getElementById(id);
  const qs = (sel) => document.querySelector(sel);
  const qsa = (sel) => Array.from(document.querySelectorAll(sel));

  function alertErr(msg){ alert(msg); }

  function nowLocalIsoMinute(){
    const d = new Date();
    const pad = (n) => String(n).padStart(2,"0");
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth()+1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const mi = pad(d.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
  }

  function todayStr(){
    return normalizeDate(new Date().toISOString());
  }

  function safeNum(n){
    const x = Number(n);
    return Number.isFinite(x) ? x : 0;
  }

  // ====== element ids (期待するHTMLのID) ======
  // Profile
  const elName      = $("name");
  const elBase      = $("base");
  const elCarNo     = $("carNo");
  const elLicenseNo = $("licenseNo");
  const elPhone     = $("phone");
  const elEmail     = $("email");
  const elLicenseImg= $("licenseImg"); // file (任意)

  const btnSaveProfile = $("btnSaveProfile");
  const btnClearProfile= $("btnClearProfile");

  // Tenko common
  const elMethod   = $("method");

  // Departure tenko
  const elDepAt       = $("dep_at");
  const elDepSleep    = $("dep_sleep");
  const elDepTemp     = $("dep_temp");
  const elDepCondition= $("dep_condition");
  const elDepFatigue  = $("dep_fatigue");
  const elDepMed      = $("dep_med");
  const elDepMedDetail= $("dep_medDetail");
  const elDepDrink    = $("dep_drink");
  const elDepAlcJudge = $("dep_alcJudge");
  const elDepAlcValue = $("dep_alcValue");
  const elDepAlcImg   = $("dep_alcImg"); // file
  const elDepOdoStart = $("dep_odoStart");
  const elDepProjectsWrap = $("dep_projectsWrap"); // 複数案件
  const btnAddDepProject  = $("btnAddDepProject");
  const elDepLoadBaseArea = $("dep_area"); // 積込拠点/エリア
  const elDepDanger       = $("dep_danger"); // 危険物・高額品
  const elDepAbnormal     = $("dep_abnormal");
  const elDepAbnormalDetail = $("dep_abnormalDetail");
  const elDepAbnormalImg  = $("dep_abnormalImg"); // file

  // Arrival tenko
  const elArrAt       = $("arr_at");
  const elArrSleep    = $("arr_sleep");
  const elArrTemp     = $("arr_temp");
  const elArrCondition= $("arr_condition");
  const elArrFatigue  = $("arr_fatigue");
  const elArrMed      = $("arr_med");
  const elArrMedDetail= $("arr_medDetail");
  const elArrDrink    = $("arr_drink");
  const elArrAlcJudge = $("arr_alcJudge");
  const elArrAlcValue = $("arr_alcValue");
  const elArrAlcImg   = $("arr_alcImg"); // file
  const elArrOdoEnd   = $("arr_odoEnd");
  const elArrProjectsWrap = $("arr_projectsWrap");
  const btnAddArrProject  = $("btnAddArrProject");
  const elArrLoadBaseArea = $("arr_area");
  const elArrDanger       = $("arr_danger");
  const elArrAbnormal     = $("arr_abnormal");
  const elArrAbnormalDetail = $("arr_abnormalDetail");
  const elArrAbnormalImg  = $("arr_abnormalImg"); // file

  // Daily check (full checklist)
  const elCheckWrap = $("dailyCheck"); // checkbox list container
  const elCheckMemo = $("checkMemo");

  // Daily (optional)
  const elDailyDate     = $("daily_date");
  const elDailyMainProj = $("daily_mainProject");
  const elDailyStartAt  = $("daily_startAt");
  const elDailyEndAt    = $("daily_endAt");
  const elDailyBreakMin = $("daily_breakMin");
  const elDailyPieces   = $("daily_pieces");
  const elDailyAbsent   = $("daily_absent");
  const elDailyRedeliver= $("daily_redeliver");
  const elDailyReturn   = $("daily_return");
  const elDailyClaim    = $("daily_claim");
  const elDailyClaimDetail = $("daily_claimDetail");

  // Pay (optional)
  const elPayBase    = $("pay_base");
  const elPayIncent  = $("pay_incent");
  const elCostFuel   = $("cost_fuel");
  const elCostHighway= $("cost_highway");
  const elCostParking= $("cost_parking");
  const elCostOther  = $("cost_other");

  const elDailyMemo  = $("daily_memo");

  // Buttons
  const btnSaveDep   = $("btnSaveDep");
  const btnSaveArr   = $("btnSaveArr");
  const btnSaveDaily = $("btnSaveDaily");
  const btnMakePdf   = $("btnMakePdf");
  const btnCsvToday  = $("btnCsvToday");

  // History
  const histFrom = $("hist_from");
  const histTo   = $("hist_to");
  const histType = $("hist_type"); // all / tenko / daily
  const btnHistSearch = $("btnHistSearch");
  const btnHistCsv    = $("btnHistCsv");
  const histList = $("histList");

  // ====== state ======
  let profile = null;
  let lastDep = null;
  let lastArr = null;
  let lastDaily = null;

  // ====== profile ======
  async function loadProfile(){
    profile = await idbGet(STORE_PROFILE, "me");
    if(profile){
      elName.value      = profile.name || "";
      elBase.value      = profile.base || "";
      elCarNo.value     = profile.carNo || "";
      elLicenseNo.value = profile.licenseNo || "";
      elPhone.value     = profile.phone || "";
      elEmail.value     = profile.email || "";
    }
  }

  async function saveProfile(){
    // 必須
    const required = [
      { el: elName,      label:"氏名" },
      { el: elBase,      label:"拠点" },
      { el: elLicenseNo, label:"運転免許証番号" },
      { el: elPhone,     label:"電話番号" },
      { el: elEmail,     label:"メールアドレス" }
    ];
    for(const r of required){
      if(!String(r.el.value||"").trim()){
        alertErr(`必須項目が未入力です：${r.label}`);
        r.el.focus();
        return;
      }
    }
    // 免許写真は任意・DB保存しない（PDFに埋め込みのみ）
    const data = {
      id:"me",
      name: String(elName.value||"").trim(),
      base: String(elBase.value||"").trim(),
      carNo: String(elCarNo.value||"").trim(),
      licenseNo: String(elLicenseNo.value||"").trim(),
      phone: String(elPhone.value||"").trim(),
      email: String(elEmail.value||"").trim(),
      updatedAt: new Date().toISOString()
    };
    await idbPut(STORE_PROFILE, data);
    profile = data;
    alert("保存しました");
  }

  async function clearProfile(){
    if(!confirm("基本情報を削除します。よろしいですか？")) return;
    await idbDelete(STORE_PROFILE, "me");
    profile = null;
    elName.value=""; elBase.value=""; elCarNo.value="";
    elLicenseNo.value=""; elPhone.value=""; elEmail.value="";
    alert("削除しました");
  }

  // ====== projects (multiple) ======
  function projectRowTemplate(){
    return `
      <div class="projRow" style="display:grid;grid-template-columns:1fr 110px 38px;gap:8px;align-items:center;margin-top:8px">
        <input class="p_name" placeholder="案件名（例：Amazon / ヤマト / 企業便）" />
        <input class="p_count" type="number" placeholder="個数" />
        <button type="button" class="p_del" style="border:1px solid #e5e7eb;background:#fff;border-radius:10px;height:44px;font-weight:900">×</button>
      </div>
    `;
  }

  function addProjectRow(container){
    const box = document.createElement("div");
    box.innerHTML = projectRowTemplate();
    const row = box.firstElementChild;
    container.appendChild(row);

    row.querySelector(".p_del").addEventListener("click", ()=>{
      row.remove();
    });
  }

  function readProjects(container){
    const rows = Array.from(container.querySelectorAll(".projRow"));
    const out = [];
    rows.forEach(r=>{
      const name = String(r.querySelector(".p_name")?.value || "").trim();
      const count = r.querySelector(".p_count")?.value;
      if(name){
        out.push({ name, count: (count===""||count==null) ? null : safeNum(count) });
      }
    });
    return out;
  }

  // ====== checklist (full) ======
  function readChecklist(){
    // HTML側は checkbox input に data-label を付ける想定
    // 例: <label><input type="checkbox" data-label="タイヤ空気圧" checked> タイヤ空気圧</label>
    const inputs = qsa('#dailyCheck input[type="checkbox"]');
    return inputs.map(i => ({
      label: i.dataset.label || i.parentElement?.innerText?.trim() || "項目",
      ok: !!i.checked
    }));
  }

  function anyNg(checklist){
    return checklist.some(x => x.ok === false);
  }

  // ====== tenko validate ======
  function requireProfile(){
    if(!profile){
      alertErr("先に「基本情報」を保存してください。");
      return false;
    }
    return true;
  }

  function commonTenkoRequired(method){
    if(!method){
      alertErr("点呼方法は必須です。");
      return false;
    }
    return true;
  }

  // 出発点呼 必須項目
  function validateDeparture(){
    if(!requireProfile()) return false;
    if(!commonTenkoRequired(elMethod.value)) return false;

    const reqs = [
      { el: elDepAt, label:"点呼日時（出発）" },
      { el: elDepSleep, label:"睡眠時間（出発）" },
      { el: elDepTemp, label:"体温（出発）" },
      { el: elDepCondition, label:"体調（出発）" },
      { el: elDepFatigue, label:"疲労（出発）" },
      { el: elDepMed, label:"服薬（出発）" },
      { el: elDepDrink, label:"飲酒の有無（出発）" },
      { el: elDepAlcJudge, label:"酒気帯び判定（出発）" },
      { el: elDepAlcValue, label:"アルコール数値（出発）" },
      { el: elDepOdoStart, label:"出発ODO" },
      { el: elDepLoadBaseArea, label:"積込拠点/エリア（出発）" },
      { el: elDepDanger, label:"危険物・高額品の有無（出発）" },
      { el: elDepAbnormal, label:"異常の有無（出発）" },
    ];
    for(const r of reqs){
      if(!String(r.el.value||"").trim()){
        alertErr(`必須項目が未入力です：${r.label}`);
        r.el.focus();
        return false;
      }
    }
    if(String(elDepMed.value)==="あり" && !String(elDepMedDetail.value||"").trim()){
      alertErr("服薬が「あり」の場合、服薬内容は必須です。");
      elDepMedDetail.focus();
      return false;
    }
    if(String(elDepAbnormal.value)==="あり" && !String(elDepAbnormalDetail.value||"").trim()){
      alertErr("異常が「あり」の場合、異常内容は必須です。");
      elDepAbnormalDetail.focus();
      return false;
    }
    // 案件（最低1つ）
    const projects = readProjects(elDepProjectsWrap);
    if(projects.length === 0){
      alertErr("稼働案件は最低1つ入力してください（出発）。");
      return false;
    }
    return true;
  }

  // 帰着点呼 必須項目
  function validateArrival(){
    if(!requireProfile()) return false;
    if(!commonTenkoRequired(elMethod.value)) return false;

    const reqs = [
      { el: elArrAt, label:"点呼日時（帰着）" },
      { el: elArrSleep, label:"睡眠時間（帰着）" },
      { el: elArrTemp, label:"体温（帰着）" },
      { el: elArrCondition, label:"体調（帰着）" },
      { el: elArrFatigue, label:"疲労（帰着）" },
      { el: elArrMed, label:"服薬（帰着）" },
      { el: elArrDrink, label:"飲酒の有無（帰着）" },
      { el: elArrAlcJudge, label:"酒気帯び判定（帰着）" },
      { el: elArrAlcValue, label:"アルコール数値（帰着）" },
      { el: elArrOdoEnd, label:"帰着ODO" },
      { el: elArrLoadBaseArea, label:"積込拠点/エリア（帰着）" },
      { el: elArrDanger, label:"危険物・高額品の有無（帰着）" },
      { el: elArrAbnormal, label:"異常の有無（帰着）" },
    ];
    for(const r of reqs){
      if(!String(r.el.value||"").trim()){
        alertErr(`必須項目が未入力です：${r.label}`);
        r.el.focus();
        return false;
      }
    }
    if(String(elArrMed.value)==="あり" && !String(elArrMedDetail.value||"").trim()){
      alertErr("服薬が「あり」の場合、服薬内容は必須です。");
      elArrMedDetail.focus();
      return false;
    }
    if(String(elArrAbnormal.value)==="あり" && !String(elArrAbnormalDetail.value||"").trim()){
      alertErr("異常が「あり」の場合、異常内容は必須です。");
      elArrAbnormalDetail.focus();
      return false;
    }
    // 案件（最低1つ）
    const projects = readProjects(elArrProjectsWrap);
    if(projects.length === 0){
      alertErr("稼働案件は最低1つ入力してください（帰着）。");
      return false;
    }
    return true;
  }

  // ====== save tenko ======
  async function saveDeparture(){
    if(!validateDeparture()) return;

    const checklist = readChecklist();
    // 日常点検は「必須」運用：全部チェックが入ってない＝NGがあるとみなす
    // ただしUIはチェック式のため、未チェックは NG 扱い
    if(checklist.length > 0 && anyNg(checklist)){
      // NG詳細メモは必須（運用ルール）
      if(!String(elCheckMemo.value||"").trim()){
        alertErr("日常点検で未チェック（NG）がある場合、NG詳細メモは必須です。");
        elCheckMemo.focus();
        return;
      }
      // NG写真は「必須推奨」扱い：強制しない（端末事情があるため）
      // ※必要ならここで必須化できる
    }

    const id = `dep_${Date.now()}`;
    const projects = readProjects(elDepProjectsWrap);

    const rec = {
      id,
      kind:"tenko",
      type:"departure",
      at: elDepAt.value, // 手入力
      name: profile.name,
      base: profile.base,
      carNo: profile.carNo,
      licenseNo: profile.licenseNo,
      phone: profile.phone,
      email: profile.email,

      method: elMethod.value,

      sleep: elDepSleep.value,
      temp: elDepTemp.value,
      condition: elDepCondition.value,
      fatigue: elDepFatigue.value,
      med: elDepMed.value,
      medDetail: elDepMedDetail.value || "",
      drink: elDepDrink.value,

      alcJudge: elDepAlcJudge.value,
      alcValue: elDepAlcValue.value,

      odoStart: elDepOdoStart.value,
      odoEnd: "", // 出発では入力しない
      odoDiff: 0, // 後で自動計算

      projects,
      area: elDepLoadBaseArea.value,
      danger: elDepDanger.value,

      abnormal: elDepAbnormal.value,
      abnormalDetail: elDepAbnormalDetail.value || "",

      checklist,
      checkMemo: elCheckMemo.value || "",

      createdAt: new Date().toISOString()
    };

    await idbPut(STORE_TENKO, rec);
    lastDep = rec;
    alert("出発点呼を保存しました。");

    // 履歴更新（軽く）
    await renderHistoryQuick();
  }

  async function saveArrival(){
    if(!validateArrival()) return;

    const checklist = readChecklist();
    if(checklist.length > 0 && anyNg(checklist)){
      if(!String(elCheckMemo.value||"").trim()){
        alertErr("日常点検で未チェック（NG）がある場合、NG詳細メモは必須です。");
        elCheckMemo.focus();
        return;
      }
    }

    const id = `arr_${Date.now()}`;
    const projects = readProjects(elArrProjectsWrap);

    const rec = {
      id,
      kind:"tenko",
      type:"arrival",
      at: elArrAt.value,
      name: profile.name,
      base: profile.base,
      carNo: profile.carNo,
      licenseNo: profile.licenseNo,
      phone: profile.phone,
      email: profile.email,

      method: elMethod.value,

      sleep: elArrSleep.value,
      temp: elArrTemp.value,
      condition: elArrCondition.value,
      fatigue: elArrFatigue.value,
      med: elArrMed.value,
      medDetail: elArrMedDetail.value || "",
      drink: elArrDrink.value,

      alcJudge: elArrAlcJudge.value,
      alcValue: elArrAlcValue.value,

      odoStart: "", // 帰着では入力しない
      odoEnd: elArrOdoEnd.value,
      odoDiff: 0, // 後で自動計算

      projects,
      area: elArrLoadBaseArea.value,
      danger: elArrDanger.value,

      abnormal: elArrAbnormal.value,
      abnormalDetail: elArrAbnormalDetail.value || "",

      checklist,
      checkMemo: elCheckMemo.value || "",

      createdAt: new Date().toISOString()
    };

    await idbPut(STORE_TENKO, rec);
    lastArr = rec;
    alert("帰着点呼を保存しました。");

    await renderHistoryQuick();
  }

  // ====== daily (optional) ======
  async function saveDaily(){
    if(!requireProfile()) return;

    // 日報はオプション項目が多いので、必須は「稼働日」だけにする（運用で変えられる）
    const date = String(elDailyDate.value||"").trim();
    if(!date){
      alertErr("日報の稼働日は入力してください。");
      elDailyDate.focus();
      return;
    }

    const id = `daily_${date}_${Date.now()}`;

    const projects = readProjects(qs("#daily_projectsWrap") || document.createElement("div"));

    const payBase = safeNum(elPayBase?.value);
    const incent  = safeNum(elPayIncent?.value);
    const fuel    = safeNum(elCostFuel?.value);
    const highway = safeNum(elCostHighway?.value);
    const parking = safeNum(elCostParking?.value);
    const other   = safeNum(elCostOther?.value);

    const salesTotal = payBase + incent;
    const costTotal = fuel + highway + parking + other;
    const profit = salesTotal - costTotal;

    const rec = {
      id,
      kind:"daily",
      name: profile.name,
      base: profile.base,
      date, // "YYYY-MM-DD"
      mainProject: elDailyMainProj?.value || "",
      startAt: elDailyStartAt?.value || "",
      endAt: elDailyEndAt?.value || "",
      breakMin: elDailyBreakMin?.value || "",

      pieces: elDailyPieces?.value || "",
      absent: elDailyAbsent?.value || "",
      redeliver: elDailyRedeliver?.value || "",
      returned: elDailyReturn?.value || "",
      claim: elDailyClaim?.value || "",
      claimDetail: elDailyClaimDetail?.value || "",

      // 走行距離は出発/帰着のODO差分を優先して後で反映
      odoDiff: 0,

      // pay/cost (optional)
      payBase: (elPayBase?.value==="" ? "" : payBase),
      incentive: (elPayIncent?.value==="" ? "" : incent),
      fuel: (elCostFuel?.value==="" ? "" : fuel),
      highway: (elCostHighway?.value==="" ? "" : highway),
      parking: (elCostParking?.value==="" ? "" : parking),
      otherCost: (elCostOther?.value==="" ? "" : other),

      salesTotal: ( (elPayBase?.value==="" && elPayIncent?.value==="") ? "" : salesTotal ),
      profit: ( (elPayBase?.value==="" && elPayIncent?.value==="") ? "" : profit ),

      memo: elDailyMemo?.value || "",
      projects: projects || [],
      createdAt: new Date().toISOString()
    };

    await idbPut(STORE_DAILY, rec);
    lastDaily = rec;
    alert("日報を保存しました。");

    await renderHistoryQuick();
  }

  // ====== ODO diff (departure + arrival pairing by date) ======
  async function computeOdoDiffForDate(dateStr){
    // 同日で最も近い出発/帰着を探す（簡易）
    const all = await idbGetAll(STORE_TENKO);
    const day = normalizeDate(dateStr);

    const dep = all
      .filter(r => r.type==="departure" && normalizeDate(r.at)===day && r.name===profile?.name && r.base===profile?.base)
      .sort((a,b)=> String(a.at).localeCompare(String(b.at)))
      .slice(-1)[0] || null;

    const arr = all
      .filter(r => r.type==="arrival" && normalizeDate(r.at)===day && r.name===profile?.name && r.base===profile?.base)
      .sort((a,b)=> String(a.at).localeCompare(String(b.at)))
      .slice(-1)[0] || null;

    const diff = Math.max(0, safeNum(arr?.odoEnd) - safeNum(dep?.odoStart));
    return { dep, arr, diff };
  }

  // ====== PDF (today) ======
  async function makePdf(){
    if(!requireProfile()) return;

    // PDF対象日：日報の稼働日を優先。なければ今日。
    const dateKey = (elDailyDate?.value && normalizeDate(elDailyDate.value)) || todayStr();

    // ODO差分
    const { dep, arr, diff } = await computeOdoDiffForDate(dateKey);

    // 日報（同日）
    const dailyAll = await idbGetAll(STORE_DAILY);
    const daily = dailyAll
      .filter(d => normalizeDate(d.date)===dateKey && d.name===profile.name && d.base===profile.base)
      .sort((a,b)=> String(a.createdAt).localeCompare(String(b.createdAt)))
      .slice(-1)[0] || null;

    // 画像ファイル（PDF埋め込み用：保存しない）
    const files = {
      licenseImg: elLicenseImg?.files?.[0] || null,
      alcDepImg:  elDepAlcImg?.files?.[0] || null,
      alcArrImg:  elArrAlcImg?.files?.[0] || null
    };

    // 異常写真は今はPDFに入れてない（重くなるため）
    // 必要なら pdf.js 側に枠を追加して files に渡す

    await generateTodayPdf({
      profile,
      dep,
      arr,
      daily,
      odoDiff: diff,
      files
    });

    // iPhone共有導線：ユーザーはファイルapp→共有で送れる
    // ここはブラウザ制限で自動共有できないため、UI側で案内するのが安全
  }

  // ====== CSV (today / range) ======
  async function csvToday(){
    const dateKey = (elDailyDate?.value && normalizeDate(elDailyDate.value)) || todayStr();
    await exportCsvSearchResult({ from: dateKey, to: dateKey, base: profile?.base||"", name: profile?.name||"" });
    alert("CSVを出力しました（点呼/日報）。");
  }

  // ====== history ======
  function historyItemHtml(rec){
    if(rec.kind==="tenko"){
      const typeLabel = rec.type==="departure" ? "出発点呼" : "帰着点呼";
      const dt = rec.at ? rec.at.replace("T"," ").slice(0,16) : "";
      const odo = rec.type==="departure" ? `出発ODO：${rec.odoStart||""}` : `帰着ODO：${rec.odoEnd||""}`;
      return `
        <div class="item">
          <div>
            <div class="v">${typeLabel} / ${dt}</div>
            <div class="k">${rec.name} / ${rec.base} / ${rec.carNo||"-"} / ${odo}</div>
          </div>
          <div class="right">
            <div class="pill">${rec.alcValue||""} / ${rec.alcJudge||""}</div>
            <div class="k">${rec.abnormal||""}</div>
          </div>
        </div>
      `;
    }else{
      const d = rec.date || "";
      return `
        <div class="item">
          <div>
            <div class="v">日報 / ${d}</div>
            <div class="k">${rec.name} / ${rec.base} / 案件：${rec.mainProject||"-"}</div>
          </div>
          <div class="right">
            <div class="pill">配達：${rec.pieces||"-"}</div>
            <div class="k">売上：${rec.salesTotal===""?"-":rec.salesTotal}</div>
          </div>
        </div>
      `;
    }
  }

  async function renderHistory(filters){
    const tenko = await idbGetAll(STORE_TENKO);
    const daily = await idbGetAll(STORE_DAILY);

    const from = filters?.from || "";
    const to   = filters?.to || "";
    const base = filters?.base || "";
    const name = filters?.name || "";

    const type = filters?.type || "all";

    const tenkoHit = tenko.filter(r=>{
      if(from || to){
        if(!inRange(r.at, from, to)) return false;
      }
      if(!includesLike(r.base, base)) return false;
      if(!includesLike(r.name, name)) return false;
      return true;
    }).sort((a,b)=> String(b.at).localeCompare(String(a.at)));

    const dailyHit = daily.filter(r=>{
      if(from || to){
        if(!inRange(r.date, from, to)) return false;
      }
      if(!includesLike(r.base, base)) return false;
      if(!includesLike(r.name, name)) return false;
      return true;
    }).sort((a,b)=> String(b.date).localeCompare(String(a.date)));

    const list = [];
    if(type==="all" || type==="tenko"){
      tenkoHit.forEach(x=> list.push({ kind:"tenko", rec:x }));
    }
    if(type==="all" || type==="daily"){
      dailyHit.forEach(x=> list.push({ kind:"daily", rec:x }));
    }

    // all の場合、時系列混ぜる（簡易）
    if(type==="all"){
      list.sort((a,b)=>{
        const ka = a.kind==="tenko" ? String(a.rec.at||"") : String(a.rec.date||"");
        const kb = b.kind==="tenko" ? String(b.rec.at||"") : String(b.rec.date||"");
        return kb.localeCompare(ka);
      });
    }

    if(!list.length){
      histList.innerHTML = `<div class="item"><span class="k">該当なし</span></div>`;
      return;
    }
    histList.innerHTML = list.map(x=> historyItemHtml({ ...x.rec, kind:x.kind })).join("");
  }

  async function renderHistoryQuick(){
    // 直近7日
    const today = normalizeDate(new Date().toISOString());
    const d = new Date();
    d.setDate(d.getDate()-7);
    const from = normalizeDate(d.toISOString());
    await renderHistory({
      from, to: today,
      base: profile?.base || "",
      name: profile?.name || "",
      type: "all"
    });
  }

  // ====== init ======
  async function init(){
    // 初期値：日時入力を自動で入れる（手入力は可能）
    if(elDepAt && !elDepAt.value) elDepAt.value = nowLocalIsoMinute();
    if(elArrAt && !elArrAt.value) elArrAt.value = nowLocalIsoMinute();
    if(elDailyDate && !elDailyDate.value) elDailyDate.value = normalizeDate(new Date().toISOString());

    // project rows (default 1)
    if(elDepProjectsWrap && elDepProjectsWrap.children.length===0) addProjectRow(elDepProjectsWrap);
    if(elArrProjectsWrap && elArrProjectsWrap.children.length===0) addProjectRow(elArrProjectsWrap);

    // bind events
    btnSaveProfile?.addEventListener("click", saveProfile);
    btnClearProfile?.addEventListener("click", clearProfile);

    btnAddDepProject?.addEventListener("click", ()=> addProjectRow(elDepProjectsWrap));
    btnAddArrProject?.addEventListener("click", ()=> addProjectRow(elArrProjectsWrap));

    btnSaveDep?.addEventListener("click", saveDeparture);
    btnSaveArr?.addEventListener("click", saveArrival);
    btnSaveDaily?.addEventListener("click", saveDaily);

    btnMakePdf?.addEventListener("click", makePdf);
    btnCsvToday?.addEventListener("click", csvToday);

    btnHistSearch?.addEventListener("click", async ()=>{
      await renderHistory({
        from: histFrom?.value || "",
        to: histTo?.value || "",
        base: profile?.base || "",
        name: profile?.name || "",
        type: histType?.value || "all"
      });
    });

    btnHistCsv?.addEventListener("click", async ()=>{
      if(!profile){ alertErr("先に基本情報を保存してください"); return; }
      const f = histFrom?.value || "";
      const t = histTo?.value || "";
      if(!f || !t){ alertErr("CSV出力は期間（開始/終了）が必要です"); return; }
      await exportCsvSearchResult({
        from: f,
        to: t,
        base: profile?.base || "",
        name: profile?.name || ""
      });
      alert("CSVを出力しました（点呼/日報）。");
    });

    // load profile
    await loadProfile();

    // 初期履歴
    await renderHistoryQuick();
  }

  // start
  window.addEventListener("load", ()=> { init().catch(e=>console.error(e)); });
})();
