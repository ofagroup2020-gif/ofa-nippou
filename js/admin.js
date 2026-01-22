// js/admin.js
// 管理者（月報PDF・期間検索）
// - 端末内パス（localStorage）で簡易ロック
// - IndexedDB検索（db.js）
// - CSV出力（csv.js）
// - 月報PDF出力（pdf.js）

(() => {
  "use strict";

  // ==========
  // 設定
  // ==========
  const ADMIN_PASS_KEY = "ofa_admin_pass";
  const ADMIN_LOGIN_KEY = "ofa_admin_logged_in";

  // ⚠️ 注意：
  // ここに「初期パス」を固定で書いても、
  // 端末に保存済みのパス（localStorage）が優先されます。
  // つまり「過去に変更した端末」では初期パスは効きません。
  const DEFAULT_ADMIN_PASS = "ofa-admin";

  // ==========
  // DOM
  // ==========
  const elPass = document.getElementById("a_pass");
  const btnLogin = document.getElementById("btnAdminLogin");
  const btnChange = document.getElementById("btnChangePass");

  const adminPanel = document.getElementById("adminPanel");
  const listEl = document.getElementById("monthlyList");

  const mFrom = document.getElementById("m_from");
  const mTo = document.getElementById("m_to");
  const mBase = document.getElementById("m_base");
  const mName = document.getElementById("m_name");

  const btnSearch = document.getElementById("btnMonthlySearch");
  const btnCsv = document.getElementById("btnMonthlyCsv");
  const btnPdf = document.getElementById("btnMonthlyPdf");

  if (!btnLogin) return; // adminページ以外で読み込まれても落ちないように

  // ==========
  // Utils
  // ==========
  const qs = (v) => String(v ?? "").trim();

  function getStoredAdminPass() {
    return localStorage.getItem(ADMIN_PASS_KEY) || DEFAULT_ADMIN_PASS;
  }

  function setStoredAdminPass(newPass) {
    localStorage.setItem(ADMIN_PASS_KEY, newPass);
  }

  function setLoggedIn(flag) {
    localStorage.setItem(ADMIN_LOGIN_KEY, flag ? "1" : "0");
  }

  function isLoggedIn() {
    return localStorage.getItem(ADMIN_LOGIN_KEY) === "1";
  }

  function showPanel() {
    adminPanel?.classList.remove("hidden");
  }

  function hidePanel() {
    adminPanel?.classList.add("hidden");
  }

  function todayStr() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  }

  function lastDayOfThisMonthStr() {
    const d = new Date();
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const y = last.getFullYear();
    const m = String(last.getMonth() + 1).padStart(2, "0");
    const dd = String(last.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  }

  function ensureDefaultDates() {
    if (!mFrom.value) mFrom.value = `${todayStr().slice(0, 8)}01`; // 月初
    if (!mTo.value) mTo.value = lastDayOfThisMonthStr(); // 月末
  }

  function buildFilters() {
    return {
      from: qs(mFrom.value),
      to: qs(mTo.value),
      base: qs(mBase.value),
      name: qs(mName.value),
    };
  }

  function validateRange(filters) {
    if (!filters.from || !filters.to) {
      alert("期間（開始・終了）は必須です");
      return false;
    }
    if (filters.from > filters.to) {
      alert("期間が不正です（開始 > 終了）");
      return false;
    }
    return true;
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function smallBadge(text) {
    return `<span style="
      display:inline-block;padding:4px 10px;border-radius:999px;
      background:#f3f6fb;border:1px solid #e9eef5;font-size:12px;color:#444;
    ">${escapeHtml(text)}</span>`;
  }

  // ==========
  // Render
  // ==========
  function renderGroups(groups, filters) {
    if (!listEl) return;

    if (!groups || !groups.length) {
      listEl.innerHTML = `
        <div style="padding:12px;border:1px dashed #d7deea;border-radius:14px;color:#666;background:#fafcff">
          該当データがありません（期間・拠点・氏名の条件を見直してください）
        </div>
      `;
      return;
    }

    const html = groups.map((g) => {
      const tenkoCount = (g.tenko || []).length;
      const dailyCount = (g.daily || []).length;

      // 稼働日数（点呼の日付ベース）
      const days = new Set();
      (g.tenko || []).forEach((t) => {
        const d = String(t.at || "").slice(0, 10);
        if (d) days.add(d);
      });

      // 走行距離合計（同日 dep+arr が揃った日だけ）
      const byDate = new Map();
      (g.tenko || []).forEach((t) => {
        const d = String(t.at || "").slice(0, 10);
        if (!d) return;
        if (!byDate.has(d)) byDate.set(d, { dep: null, arr: null });
        if (t.type === "departure") byDate.get(d).dep = t;
        if (t.type === "arrival") byDate.get(d).arr = t;
      });

      let totalKm = 0;
      for (const [d, pair] of byDate.entries()) {
        const dep = Number(pair.dep?.odoStart ?? 0);
        const arr = Number(pair.arr?.odoEnd ?? 0);
        const diff = arr - dep;
        if (Number.isFinite(diff) && diff > 0) totalKm += diff;
      }

      return `
        <div style="margin-top:12px;border:1px solid #e9eef5;border-radius:18px;padding:12px;background:#fff;box-shadow:0 6px 18px rgba(16,24,40,.06)">
          <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center">
            <div style="font-weight:900;font-size:16px">
              ${escapeHtml(g.name || "（氏名不明）")} / ${escapeHtml(g.base || "（拠点不明）")}
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              ${smallBadge(`期間：${filters.from}〜${filters.to}`)}
              ${smallBadge(`稼働：${days.size}日`)}
              ${smallBadge(`走行：${totalKm}km`)}
              ${smallBadge(`点呼：${tenkoCount}`)}
              ${smallBadge(`日報：${dailyCount}`)}
            </div>
          </div>

          <div style="margin-top:10px;color:#666;font-size:13px">
            代表データ：点呼 ${tenkoCount}件 / 日報 ${dailyCount}件（条件一致分）
          </div>
        </div>
      `;
    }).join("");

    listEl.innerHTML = html;
  }

  // ==========
  // Actions
  // ==========
  async function doSearchAndRender() {
    ensureDefaultDates();
    const filters = buildFilters();
    if (!validateRange(filters)) return;

    try {
      const groups = await searchMonthly(filters); // db.js
      window.__ofa_admin_last_groups = groups;
      window.__ofa_admin_last_filters = filters;
      renderGroups(groups, filters);
    } catch (e) {
      console.error(e);
      alert("検索でエラーが発生しました（IndexedDBの状態を確認してください）");
    }
  }

  async function doCsvExport() {
    ensureDefaultDates();
    const filters = buildFilters();
    if (!validateRange(filters)) return;

    try {
      await exportCsvSearchResult(filters); // csv.js
    } catch (e) {
      console.error(e);
      alert("CSV出力でエラーが発生しました");
    }
  }

  async function doMonthlyPdf() {
    const groups = window.__ofa_admin_last_groups || [];
    const filters = window.__ofa_admin_last_filters || buildFilters();

    if (!groups.length) {
      // 検索してない場合でも作れるように自動検索
      await doSearchAndRender();
    }

    const g2 = window.__ofa_admin_last_groups || [];
    const f2 = window.__ofa_admin_last_filters || filters;

    if (!g2.length) {
      alert("PDF作成対象がありません（まず検索条件を見直してください）");
      return;
    }

    try {
      await generateMonthlyPdf(g2, f2); // pdf.js
    } catch (e) {
      console.error(e);
      alert("月報PDF作成でエラーが発生しました");
    }
  }

  function doAdminLogin() {
    const input = qs(elPass?.value);
    const stored = getStoredAdminPass();

    if (!input) {
      alert("管理者パスを入力してください");
      return;
    }

    if (input !== stored) {
      alert("管理者パスが違います");
      setLoggedIn(false);
      hidePanel();
      return;
    }

    setLoggedIn(true);
    showPanel();
    ensureDefaultDates();
    // 初回は空表示にしておく（重くならない）
    if (listEl) listEl.innerHTML = "";
    alert("管理者ログインOK");
  }

  function doChangePass() {
    // 変更は「現在パス一致」→「新パス設定」
    const current = prompt("現在の管理者パスを入力");
    if (current === null) return;

    const stored = getStoredAdminPass();
    if (qs(current) !== stored) {
      alert("現在パスが違います");
      return;
    }

    const next1 = prompt("新しい管理者パスを入力（8文字以上推奨）");
    if (next1 === null) return;

    const next = qs(next1);
    if (next.length < 4) {
      alert("短すぎます（4文字以上にしてください）");
      return;
    }

    const confirm1 = prompt("確認のため、もう一度新しいパスを入力");
    if (confirm1 === null) return;

    if (qs(confirm1) !== next) {
      alert("確認パスが一致しません");
      return;
    }

    setStoredAdminPass(next);
    setLoggedIn(true);
    showPanel();
    alert("管理者パスを変更しました");
  }

  // ==========
  // Bind
  // ==========
  btnLogin.addEventListener("click", doAdminLogin);
  btnChange.addEventListener("click", doChangePass);

  btnSearch?.addEventListener("click", doSearchAndRender);
  btnCsv?.addEventListener("click", doCsvExport);
  btnPdf?.addEventListener("click", doMonthlyPdf);

  // Enterキーでログイン
  elPass?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") doAdminLogin();
  });

  // 起動時
  ensureDefaultDates();
  if (isLoggedIn()) {
    showPanel();
  } else {
    hidePanel();
  }

})();
