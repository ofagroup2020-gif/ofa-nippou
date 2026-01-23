// admin/js/admin.js
// 管理者（月報PDF・期間検索）
// 依存：./js/db.js（IndexedDB） ./js/pdf.js（generateMonthlyPdf） ./js/csv.js（exportCsvSearchResult）

(() => {
  "use strict";

  // ===== Admin Pass (端末内) =====
  const ADMIN_PASS_KEY = "ofa_admin_pass_v1";
  const ADMIN_LOGIN_KEY = "ofa_admin_loggedin_v1";
  const DEFAULT_PASS = "ofa-admin"; // 初期（画面に表示しない運用にしてOK）

  // ===== DOM =====
  const elPass = document.getElementById("a_pass");
  const btnAdminLogin = document.getElementById("btnAdminLogin");
  const btnChangePass = document.getElementById("btnChangePass");

  const adminPanel = document.getElementById("adminPanel");

  const mFrom = document.getElementById("m_from");
  const mTo = document.getElementById("m_to");
  const mBase = document.getElementById("m_base");
  const mName = document.getElementById("m_name");

  const btnMonthlySearch = document.getElementById("btnMonthlySearch");
  const btnMonthlyCsv = document.getElementById("btnMonthlyCsv");
  const btnMonthlyPdf = document.getElementById("btnMonthlyPdf");

  const monthlyList = document.getElementById("monthlyList");

  // ===== State =====
  let lastGroups = [];
  let lastFilters = null;

  // ===== Helpers =====
  function getSavedPass() {
    return localStorage.getItem(ADMIN_PASS_KEY) || "";
  }
  function setSavedPass(p) {
    localStorage.setItem(ADMIN_PASS_KEY, String(p || ""));
  }

  function setLoggedIn(flag) {
    sessionStorage.setItem(ADMIN_LOGIN_KEY, flag ? "1" : "0");
  }
  function isLoggedIn() {
    return sessionStorage.getItem(ADMIN_LOGIN_KEY) === "1";
  }

  function showAdminPanel(flag) {
    if (flag) adminPanel.classList.remove("hidden");
    else adminPanel.classList.add("hidden");
  }

  function todayStr() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function safeNum(n) {
    const x = Number(n);
    return Number.isFinite(x) ? x : 0;
  }

  function normalizeDate(d) {
    if (!d) return "";
    return String(d).slice(0, 10);
  }

  function inRange(dateStr, fromStr, toStr) {
    const d = normalizeDate(dateStr);
    const f = fromStr ? normalizeDate(fromStr) : "";
    const t = toStr ? normalizeDate(toStr) : "";
    if (!d) return false;
    if (f && d < f) return false;
    if (t && d > t) return false;
    return true;
  }

  function calcKmFromGroupTenko(tenkoRows, fromStr, toStr) {
    // 日付ごとに出発/帰着をペアリングしてODO差分合計
    const byDate = new Map();
    for (const t of (tenkoRows || [])) {
      const d = normalizeDate(t.at);
      if (!d) continue;
      if (!inRange(d, fromStr, toStr)) continue;

      if (!byDate.has(d)) byDate.set(d, { dep: null, arr: null });
      const slot = byDate.get(d);

      if (t.type === "departure") slot.dep = t;
      if (t.type === "arrival") slot.arr = t;
    }

    let total = 0;
    for (const [d, pair] of byDate.entries()) {
      const dep = safeNum(pair.dep?.odoStart);
      const arr = safeNum(pair.arr?.odoEnd);
      const diff = arr - dep;
      if (diff > 0) total += diff;
    }
    return total;
  }

  function calcWorkDays(tenkoRows, dailyRows, fromStr, toStr) {
    // 稼働日数：点呼・日報のどちらかがある日をユニーク集計
    const set = new Set();
    (tenkoRows || []).forEach(t => {
      const d = normalizeDate(t.at);
      if (d && inRange(d, fromStr, toStr)) set.add(d);
    });
    (dailyRows || []).forEach(r => {
      const d = normalizeDate(r.date);
      if (d && inRange(d, fromStr, toStr)) set.add(d);
    });
    return set.size;
  }

  function buildFilters() {
    const from = (mFrom.value || "").trim();
    const to = (mTo.value || "").trim();
    const base = (mBase.value || "").trim();
    const name = (mName.value || "").trim();

    if (!from || !to) {
      alert("期間（開始/終了）は必須です。");
      return null;
    }
    if (from > to) {
      alert("期間が不正です（開始が終了より後です）。");
      return null;
    }

    return { from, to, base, name };
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function setListLoading(msg = "検索中…") {
    monthlyList.innerHTML = `
      <div class="small" style="padding:8px 2px;color:#667085">${escapeHtml(msg)}</div>
    `;
  }

  function renderGroups(groups, filters) {
    if (!groups || groups.length === 0) {
      monthlyList.innerHTML = `
        <div class="small" style="padding:8px 2px;">該当データがありません。</div>
      `;
      return;
    }

    const cards = groups.map((g, idx) => {
      const tenkoCount = (g.tenko || []).filter(t => inRange(t.at, filters.from, filters.to)).length;
      const dailyCount = (g.daily || []).filter(d => inRange(d.date, filters.from, filters.to)).length;
      const km = calcKmFromGroupTenko(g.tenko || [], filters.from, filters.to);
      const days = calcWorkDays(g.tenko || [], g.daily || [], filters.from, filters.to);

      return `
        <div class="histItem">
          <div class="histTop">
            <div class="histTitle">${escapeHtml(g.name || "（氏名なし）")} / ${escapeHtml(g.base || "（拠点なし）")}</div>
            <div class="small">#${idx + 1}</div>
          </div>
          <div class="histBody">
            <div><b>期間</b>：${escapeHtml(filters.from)} ～ ${escapeHtml(filters.to)}</div>
            <div><b>稼働日数</b>：${days} 日　/　<b>走行距離</b>：${km} km</div>
            <div><b>点呼件数</b>：${tenkoCount}　/　<b>日報件数</b>：${dailyCount}</div>
            <div class="small" style="margin-top:6px;color:#667085">
              ※月報PDFは検索結果（全員分）をまとめて出力します
            </div>
          </div>
        </div>
      `;
    });

    monthlyList.innerHTML = cards.join("");
  }

  // ===== Init =====
  function initAdminPassIfNeeded() {
    const saved = getSavedPass();
    if (!saved) setSavedPass(DEFAULT_PASS);
  }

  function initDefaultRange() {
    // 初回：当月1日〜今日（入力が空の場合）
    const today = todayStr();
    if (!mTo.value) mTo.value = today;
    if (!mFrom.value) {
      const d = new Date();
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      mFrom.value = `${y}-${m}-01`;
    }
  }

  // ===== Admin auth =====
  function adminLogin() {
    const input = (elPass.value || "").trim();
    if (!input) {
      alert("管理者パスを入力してください。");
      return;
    }
    const saved = getSavedPass();
    if (input !== saved) {
      alert("管理者パスが違います。");
      return;
    }
    setLoggedIn(true);
    showAdminPanel(true);
    elPass.value = "";
    alert("管理者ログインしました。");
  }

  function changeAdminPass() {
    // 現在のパス確認
    const current = prompt("現在の管理者パスを入力してください");
    if (current === null) return;
    if (String(current).trim() !== getSavedPass()) {
      alert("現在の管理者パスが違います。");
      return;
    }
    const next = prompt("新しい管理者パスを入力してください（8文字以上推奨）");
    if (next === null) return;
    const next2 = prompt("確認のため、もう一度入力してください");
    if (next2 === null) return;

    if (String(next).trim() !== String(next2).trim()) {
      alert("新しいパスが一致しません。");
      return;
    }
    if (String(next).trim().length < 4) {
      alert("短すぎます。もう少し長いパスにしてください。");
      return;
    }
    setSavedPass(String(next).trim());
    setLoggedIn(true);
    showAdminPanel(true);
    alert("管理者パスを変更しました。");
  }

  // ===== Search / Export =====
  async function doMonthlySearch() {
    const filters = buildFilters();
    if (!filters) return;

    setListLoading("検索中…（IndexedDB）");
    try {
      // db.js の searchMonthly を使う
      const groups = await searchMonthly(filters);

      // filtersでグループも「空データ」を除外（名前/拠点一致後に、期間内が0件は落とす）
      const trimmed = (groups || []).filter(g => {
        const tCount = (g.tenko || []).some(t => inRange(t.at, filters.from, filters.to));
        const dCount = (g.daily || []).some(d => inRange(d.date, filters.from, filters.to));
        return tCount || dCount;
      });

      lastGroups = trimmed;
      lastFilters = filters;

      renderGroups(lastGroups, filters);
    } catch (e) {
      console.error(e);
      monthlyList.innerHTML = `<div class="small" style="padding:8px 2px;color:#b42318">検索エラー：${escapeHtml(e?.message || e)}</div>`;
    }
  }

  async function doCsvExport() {
    const filters = buildFilters();
    if (!filters) return;

    try {
      // csv.js の exportCsvSearchResult を使う（点呼CSV + 日報CSV を別々に出力）
      await exportCsvSearchResult(filters);
      alert("CSVを出力しました（点呼CSV / 日報CSV）。");
    } catch (e) {
      console.error(e);
      alert("CSV出力に失敗しました：" + (e?.message || e));
    }
  }

  async function doMonthlyPdf() {
    // 直近検索が無い場合は検索してから
    const filters = buildFilters();
    if (!filters) return;

    try {
      if (!lastFilters || JSON.stringify(filters) !== JSON.stringify(lastFilters)) {
        await doMonthlySearch();
      }
      if (!lastGroups || lastGroups.length === 0) {
        alert("月報PDFを作成するデータがありません。先に検索してください。");
        return;
      }

      // pdf.js の generateMonthlyPdf を使う
      await generateMonthlyPdf(lastGroups, filters);
    } catch (e) {
      console.error(e);
      alert("月報PDFの作成に失敗しました：" + (e?.message || e));
    }
  }

  // ===== Events =====
  btnAdminLogin?.addEventListener("click", adminLogin);
  btnChangePass?.addEventListener("click", changeAdminPass);

  btnMonthlySearch?.addEventListener("click", doMonthlySearch);
  btnMonthlyCsv?.addEventListener("click", doCsvExport);
  btnMonthlyPdf?.addEventListener("click", doMonthlyPdf);

  // ===== Boot =====
  initAdminPassIfNeeded();
  initDefaultRange();

  // 既にログイン済みならパネル表示
  showAdminPanel(isLoggedIn());

})();
