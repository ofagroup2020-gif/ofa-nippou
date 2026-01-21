// /admin/js/admin.js
// 管理者：端末内パスでロック → 月報検索（IndexedDB）→ CSV / PDF 出力
// 依存：../js/db.js (searchMonthly, searchRecordsなど)
//      ../js/csv.js (exportCsvSearchResultなど)
//      ../js/pdf.js (generateMonthlyPdfなど)

(function(){
  "use strict";

  // ====== 設定 ======
  const LS_ADMIN_PASS_KEY = "ofa_admin_pass";     // 管理者パス（端末内）
  const DEFAULT_ADMIN_PASS = "ofa-admin";         // 初期値（表示しない・LINEで共有運用）

  // ====== DOM ======
  const passEl = document.getElementById("a_pass");
  const btnLogin = document.getElementById("btnAdminLogin");
  const btnChange = document.getElementById("btnChangePass");
  const adminPanel = document.getElementById("adminPanel");

  const fromEl = document.getElementById("m_from");
  const toEl   = document.getElementById("m_to");
  const baseEl = document.getElementById("m_base");
  const nameEl = document.getElementById("m_name");

  const btnSearch = document.getElementById("btnMonthlySearch");
  const btnCsv    = document.getElementById("btnMonthlyCsv");
  const btnPdf    = document.getElementById("btnMonthlyPdf");

  const listEl = document.getElementById("monthlyList");
  const summaryEl = document.getElementById("monthlySummary");

  // ====== 状態 ======
  let lastGroups = [];   // searchMonthly() の戻り（グループ配列）
  let lastFilters = null;
  let lastFlatTenko = [];
  let lastFlatDaily = [];

  // ====== Util ======
  function getSavedPass(){
    const p = localStorage.getItem(LS_ADMIN_PASS_KEY);
    return p && p.trim() ? p.trim() : "";
  }

  function ensureDefaultPass(){
    // 初回（端末にまだ無い）だけ初期パスを設定
    // ※画面には表示しない。LINEで共有運用。
    const p = getSavedPass();
    if(!p){
      localStorage.setItem(LS_ADMIN_PASS_KEY, DEFAULT_ADMIN_PASS);
    }
  }

  function setAdminUnlocked(isUnlocked){
    adminPanel.classList.toggle("hidden", !isUnlocked);
  }

  function alertMsg(msg){
    alert(msg);
  }

  function normalizeDate(v){
    if(!v) return "";
    return String(v).slice(0,10);
  }

  function requiredDateRange(){
    const f = normalizeDate(fromEl.value);
    const t = normalizeDate(toEl.value);
    if(!f || !t) return null;
    if(f > t) return null;
    return { from: f, to: t };
  }

  function buildFilters(){
    const range = requiredDateRange();
    if(!range) return null;

    return {
      from: range.from,
      to: range.to,
      base: (baseEl.value || "").trim(),
      name: (nameEl.value || "").trim()
    };
  }

  function escapeHtml(s){
    return String(s ?? "").replace(/[&<>"']/g, (m)=>({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    }[m]));
  }

  function calcMonthlySummary(groups, filters){
    // groups: [{name, base, tenko:[], daily:[]}, ...]
    let totalDrivers = groups.length;
    let totalTenko = 0;
    let totalDaily = 0;

    // 稼働日数・走行距離などは person/baseごとにも出せるが
    // ここでは全体要約（画面上）を作る
    let allDays = new Set();
    let totalKm = 0;

    for(const g of groups){
      totalTenko += g.tenko.length;
      totalDaily += g.daily.length;

      // 日付集合（点呼 from at / 日報 from date）
      for(const t of g.tenko){
        const d = (t.at || "").slice(0,10);
        if(d) allDays.add(d);
      }
      for(const d of g.daily){
        const dd = (d.date || "").slice(0,10);
        if(dd) allDays.add(dd);
      }

      // kmは「同日 出発ODO と 帰着ODO の差分」のみ加算（0以下は除外）
      const byDate = new Map(); // date -> {dep?, arr?}
      for(const t of g.tenko){
        const d = (t.at || "").slice(0,10);
        if(!d) continue;
        if(!byDate.has(d)) byDate.set(d, { dep:null, arr:null });
        if(t.type === "departure") byDate.get(d).dep = t;
        if(t.type === "arrival")   byDate.get(d).arr = t;
      }
      for(const [d, pair] of byDate){
        const dep = Number(pair.dep?.odoStart || 0);
        const arr = Number(pair.arr?.odoEnd || 0);
        const diff = arr - dep;
        if(Number.isFinite(diff) && diff > 0) totalKm += diff;
      }
    }

    const html = `
      <div style="font-weight:900;margin-bottom:6px;">検索サマリー</div>
      <div>期間：<b>${escapeHtml(filters.from)}</b> ～ <b>${escapeHtml(filters.to)}</b></div>
      <div>条件：拠点「${escapeHtml(filters.base || "指定なし")}」 / 氏名「${escapeHtml(filters.name || "指定なし")}」</div>
      <div style="margin-top:6px;">
        <span style="display:inline-block;margin-right:10px;">対象グループ：<b>${totalDrivers}</b></span>
        <span style="display:inline-block;margin-right:10px;">点呼件数：<b>${totalTenko}</b></span>
        <span style="display:inline-block;margin-right:10px;">日報件数：<b>${totalDaily}</b></span>
        <span style="display:inline-block;margin-right:10px;">日数（全体）：<b>${allDays.size}</b></span>
        <span style="display:inline-block;">走行距離合計：<b>${totalKm}</b> km</span>
      </div>
    `;
    summaryEl.innerHTML = html;
  }

  function renderGroups(groups){
    if(!groups || groups.length === 0){
      listEl.innerHTML = `
        <div class="resultItem">
          <div class="k">該当なし</div>
          <div class="right"><span class="pill">0</span></div>
        </div>
      `;
      return;
    }

    const rows = groups.map(g=>{
      // 稼働日数（点呼 at 日付 & 日報 date）
      const days = new Set();
      for(const t of g.tenko){ const d=(t.at||"").slice(0,10); if(d) days.add(d); }
      for(const d of g.daily){ const dd=(d.date||"").slice(0,10); if(dd) days.add(dd); }

      return `
        <div class="resultItem">
          <div>
            <div class="v">${escapeHtml(g.name)} / ${escapeHtml(g.base)}</div>
            <div class="k">稼働日数：${days.size} 日 / 点呼：${g.tenko.length} / 日報：${g.daily.length}</div>
          </div>
          <div class="right">
            <div class="pill">group</div>
          </div>
        </div>
      `;
    }).join("");

    listEl.innerHTML = rows;
  }

  async function doSearch(){
    const filters = buildFilters();
    if(!filters){
      alertMsg("期間（開始・終了）は必須です（開始<=終了）。");
      return;
    }

    // 端末内DBから検索
    listEl.innerHTML = `
      <div class="resultItem">
        <div class="k">検索中…</div>
      </div>
    `;
    summaryEl.innerHTML = "";

    try{
      const groups = await searchMonthly(filters);
      lastGroups = groups;
      lastFilters = filters;

      // CSV用に「フラット」も持つ（検索結果CSVは tenko/daily の明細を出したい）
      const { tenkoHit, dailyHit } = await searchRecords(filters);
      lastFlatTenko = tenkoHit;
      lastFlatDaily = dailyHit;

      calcMonthlySummary(groups, filters);
      renderGroups(groups);

      alertMsg(`検索完了：${groups.length} グループ`);
    }catch(e){
      console.error(e);
      listEl.innerHTML = `
        <div class="resultItem">
          <div class="k">検索失敗：${escapeHtml(e.message || String(e))}</div>
        </div>
      `;
      alertMsg("検索に失敗しました。");
    }
  }

  async function doCsv(){
    const filters = buildFilters();
    if(!filters){
      alertMsg("期間（開始・終了）は必須です（開始<=終了）。");
      return;
    }
    try{
      // csv.js 側の検索結果CSV（点呼CSV + 日報CSV を別々にDL）
      await exportCsvSearchResult(filters);
      alertMsg("CSVを出力しました（点呼CSV・日報CSVの2本）。");
    }catch(e){
      console.error(e);
      alertMsg("CSV出力に失敗しました。");
    }
  }

  async function doPdf(){
    if(!lastFilters || !lastGroups){
      // 検索未実行なら先に検索
      await doSearch();
    }
    if(!lastGroups || lastGroups.length === 0){
      alertMsg("PDF作成：該当データがありません。");
      return;
    }

    try{
      // pdf.js の generateMonthlyPdf(groups, filters)
      await generateMonthlyPdf(lastGroups, lastFilters);
      alertMsg("月報PDFを作成しました。");
    }catch(e){
      console.error(e);
      alertMsg("月報PDF作成に失敗しました。");
    }
  }

  function unlockIfPassOk(){
    const input = (passEl.value || "").trim();
    const saved = getSavedPass();
    if(!input){
      alertMsg("管理者パスを入力してください。");
      return;
    }
    if(input !== saved){
      alertMsg("管理者パスが違います。LINEで最新パスを確認してください。");
      return;
    }
    setAdminUnlocked(true);
    alertMsg("管理者ログインOK");
  }

  async function changePass(){
    // 現パス確認 → 新パス設定
    const currentInput = (passEl.value || "").trim();
    const saved = getSavedPass();
    if(!currentInput){
      alertMsg("現在の管理者パスを入力してください。");
      return;
    }
    if(currentInput !== saved){
      alertMsg("現在の管理者パスが違います。");
      return;
    }

    const newPass = prompt("新しい管理者パスを入力してください（LINEで共有する値）");
    if(!newPass || !newPass.trim()){
      alertMsg("変更をキャンセルしました。");
      return;
    }
    if(newPass.trim().length < 4){
      alertMsg("短すぎます（4文字以上推奨）。");
      return;
    }

    localStorage.setItem(LS_ADMIN_PASS_KEY, newPass.trim());
    passEl.value = "";
    alertMsg("管理者パスを変更しました（LINE共有を更新してください）。");
  }

  // ====== init ======
  ensureDefaultPass();
  setAdminUnlocked(false);

  btnLogin.addEventListener("click", unlockIfPassOk);
  btnChange.addEventListener("click", changePass);

  btnSearch.addEventListener("click", doSearch);
  btnCsv.addEventListener("click", doCsv);
  btnPdf.addEventListener("click", doPdf);

  // 期間の初期値（今月 1日〜今日）
  try{
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth()+1).padStart(2,"0");
    const d = String(now.getDate()).padStart(2,"0");
    const first = `${y}-${m}-01`;
    const today = `${y}-${m}-${d}`;
    if(!fromEl.value) fromEl.value = first;
    if(!toEl.value) toEl.value = today;
  }catch(_){}

})();
