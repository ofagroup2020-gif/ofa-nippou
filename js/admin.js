// js/admin.js
// 管理者（月報PDF・期間検索）
// - 管理者パスは端末内（localStorage）だけ
// - 月報検索：IndexedDB（tenko/daily）を期間/拠点/氏名でフィルタ
// - CSV：検索結果をワンクリック出力
// - 月報PDF：検索結果（グループ）からOFAフォーマットPDF生成
// 依存：db.js / pdf.js / csv.js

(() => {
  "use strict";

  // ====== 設定（画面に表示しない） ======
  const ADMIN_PASS_KEY = "OFA_ADMIN_PASS_V1";
  // 初期パス（サイトには出さない・placeholderにも出さない）
  // ※運用開始後は必ず管理者が変更する想定
  const DEFAULT_ADMIN_PASS = "ofa-admin";

  // ====== DOM ======
  const $ = (id) => document.getElementById(id);

  const authCard = $("adminAuthCard");
  const adminPanel = $("adminPanel");

  const passInput = $("a_pass");
  const btnAdminLogin = $("btnAdminLogin");
  const btnChangePass = $("btnChangePass");

  const mFrom = $("m_from");
  const mTo = $("m_to");
  const mBase = $("m_base");
  const mName = $("m_name");

  const btnMonthlySearch = $("btnMonthlySearch");
  const btnMonthlyCsv = $("btnMonthlyCsv");
  const btnMonthlyPdf = $("btnMonthlyPdf");
  const monthlyList = $("monthlyList");

  const btnDangerWipeAdmin = $("btnDangerWipeAdmin");

  // ====== 状態 ======
  let lastGroups = [];
  let lastFilters = null;

  // ====== 初期化 ======
  function ensureDefaultAdminPass() {
    // 初回だけ初期パスを内部セット（画面には出さない）
    const cur = localStorage.getItem(ADMIN_PASS_KEY);
    if (!cur) localStorage.setItem(ADMIN_PASS_KEY, DEFAULT_ADMIN_PASS);
  }

  function isLoggedInAdmin() {
    return sessionStorage.getItem("OFA_ADMIN_LOGGED_IN") === "1";
  }

  function setAdminLoggedIn(flag) {
    sessionStorage.setItem("OFA_ADMIN_LOGGED_IN", flag ? "1" : "0");
  }

  function showAdminPanel(flag) {
    if (flag) {
      adminPanel.classList.remove("hidden");
      // 認証カード自体は残してもいいが、混乱防止で隠す
      authCard.classList.add("hidden");
    } else {
      adminPanel.classList.add("hidden");
      authCard.classList.remove("hidden");
    }
  }

  function todayStr() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function clampDateInputs() {
    // 空なら当月（ざっくり）を入れる
    if (!mTo.value) mTo.value = todayStr();
    if (!mFrom.value) {
      const d = new Date();
      d.setDate(1);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      mFrom.value = `${yyyy}-${mm}-${dd}`;
    }
  }

  function buildFiltersFromUI() {
    clampDateInputs();
    return {
      from: mFrom.value,
      to: mTo.value,
      base: (mBase.value || "").trim(),
      name: (mName.value || "").trim(),
    };
  }

  // ====== 画面表示（検索結果） ======
  function renderGroups(groups, filters) {
    if (!monthlyList) return;

    if (!groups || groups.length === 0) {
      monthlyList.innerHTML = `
        <div class="emptyBox">
          検索結果がありません。<br>
          期間・拠点・氏名を見直してください。
        </div>
      `;
      return;
    }

    // 集計（グループ単位の要約）
    const html = groups
      .map((g, idx) => {
        const days = new Set();
        for (const t of (g.tenko || [])) {
          const d = String(t.at || "").slice(0, 10);
          if (d) days.add(d);
        }
        for (const d of (g.daily || [])) {
          const dd = String(d.date || "").slice(0, 10);
          if (dd) days.add(dd);
        }

        // 走行距離：出発/帰着が揃った日のみ合算
        let totalKm = 0;
        const byDate = new Map();
        for (const t of (g.tenko || [])) {
          const day = String(t.at || "").slice(0, 10);
          if (!day) continue;
          if (!byDate.has(day)) byDate.set(day, { dep: null, arr: null });
          if (t.type === "departure") byDate.get(day).dep = t;
          if (t.type === "arrival") byDate.get(day).arr = t;
        }
        for (const [day, pair] of byDate.entries()) {
          const dep = Number(pair.dep?.odoStart ?? NaN);
          const arr = Number(pair.arr?.odoEnd ?? NaN);
          if (Number.isFinite(dep) && Number.isFinite(arr)) {
            const diff = arr - dep;
            if (diff > 0) totalKm += diff;
          }
        }

        const tenkoCount = (g.tenko || []).length;
        const dailyCount = (g.daily || []).length;

        return `
          <div class="resultCard">
            <div class="resultTop">
              <div class="resultTitle">${escapeHtml(g.name || "-")} / ${escapeHtml(g.base || "-")}</div>
              <div class="resultSub">期間：${escapeHtml(filters.from)} ～ ${escapeHtml(filters.to)}</div>
            </div>

            <div class="resultGrid">
              <div class="kv"><span class="k">稼働日数</span><span class="v">${days.size}日</span></div>
              <div class="kv"><span class="k">走行距離合計</span><span class="v">${totalKm}km</span></div>
              <div class="kv"><span class="k">点呼</span><span class="v">${tenkoCount}件</span></div>
              <div class="kv"><span class="k">日報</span><span class="v">${dailyCount}件</span></div>
            </div>

            <div class="resultActions">
              <button class="btn mini" data-act="pdf_one" data-idx="${idx}">この人だけPDF</button>
              <button class="btn mini secondary" data-act="csv_one" data-idx="${idx}">この人だけCSV</button>
            </div>
          </div>
        `;
      })
      .join("");

    monthlyList.innerHTML = `
      <div class="resultSummary">
        <div>対象：<b>${groups.length}</b> 名</div>
        <div class="small">※「この人だけPDF/CSV」は端末内データのみで作成されます</div>
      </div>
      ${html}
    `;

    // ボタンイベント（委譲）
    monthlyList.querySelectorAll("button[data-act]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const act = btn.getAttribute("data-act");
        const idx = Number(btn.getAttribute("data-idx"));
        const g = groups[idx];
        if (!g) return;

        if (act === "pdf_one") {
          try {
            await generateMonthlyPdf([g], filters);
          } catch (e) {
            alert("PDF作成に失敗しました：\n" + (e?.message || e));
          }
        }

        if (act === "csv_one") {
          try {
            // 個人だけのCSV（tenko / daily 2本）
            await exportCsvForOne(g, filters);
          } catch (e) {
            alert("CSV出力に失敗しました：\n" + (e?.message || e));
          }
        }
      });
    });
  }

  // 個人だけCSV（検索結果から生成）
  async function exportCsvForOne(group, filters) {
    // tenko/daily をそのままCSV化したいので csv.js の関数を再利用
    // ただし csv.js は「searchRecords」を前提にしてるので、ここはローカルで組み立てる
    if (!group) return;

    const tenkoCsv = (typeof buildTenkoCsv === "function") ? buildTenkoCsv(group.tenko || []) : null;
    const dailyCsv = (typeof buildDailyCsv === "function") ? buildDailyCsv(group.daily || []) : null;

    if (!tenkoCsv || !dailyCsv) {
      throw new Error("CSV関数が見つかりません（csv.js を確認してください）");
    }

    const nameKey = (group.name || "unknown").replace(/[\\/:*?"<>|]/g, "_");
    const baseKey = (group.base || "base").replace(/[\\/:*?"<>|]/g, "_");
    const dateKey = `${filters.from || "all"}_${filters.to || "all"}`;

    if (typeof downloadText !== "function") {
      throw new Error("downloadText が見つかりません（csv.js を確認してください）");
    }

    downloadText(`OFA_点呼_${nameKey}_${baseKey}_${dateKey}.csv`, tenkoCsv);
    downloadText(`OFA_日報_${nameKey}_${baseKey}_${dateKey}.csv`, dailyCsv);
  }

  // HTMLエスケープ
  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // ====== 管理者認証 ======
  function adminLogin() {
    const input = (passInput.value || "").trim();
    const saved = localStorage.getItem(ADMIN_PASS_KEY) || DEFAULT_ADMIN_PASS;

    if (!input) {
      alert("管理者パスを入力してください。");
      return;
    }
    if (input !== saved) {
      alert("管理者パスが違います。\n（パスはLINEで確認してください）");
      return;
    }

    setAdminLoggedIn(true);
    showAdminPanel(true);
  }

  function changeAdminPass() {
    const saved = localStorage.getItem(ADMIN_PASS_KEY) || DEFAULT_ADMIN_PASS;

    const current = prompt("現在の管理者パスを入力してください");
    if (current === null) return;
    if ((current || "").trim() !== saved) {
      alert("現在のパスが違います。");
      return;
    }

    const next = prompt("新しい管理者パスを入力してください（8文字以上推奨）");
    if (next === null) return;
    const newPass = (next || "").trim();
    if (!newPass) {
      alert("新しいパスが空です。");
      return;
    }
    if (newPass.length < 4) {
      alert("短すぎます。もう少し長いパスにしてください。");
      return;
    }

    localStorage.setItem(ADMIN_PASS_KEY, newPass);
    alert("管理者パスを変更しました。\n（LINEで共有するパスも更新してください）");
    passInput.value = "";
  }

  // ====== 検索 ======
  async function monthlySearch() {
    const filters = buildFiltersFromUI();

    if (!filters.from || !filters.to) {
      alert("期間（開始/終了）は必須です。");
      return;
    }
    if (filters.from > filters.to) {
      alert("期間が不正です（開始が終了より後になっています）。");
      return;
    }

    monthlyList.innerHTML = `<div class="loadingBox">検索中…</div>`;

    try {
      // db.js の searchMonthly を利用
      const groups = await searchMonthly(filters);
      lastGroups = groups || [];
      lastFilters = filters;

      renderGroups(lastGroups, lastFilters);
    } catch (e) {
      monthlyList.innerHTML = `<div class="errorBox">検索に失敗：${escapeHtml(e?.message || e)}</div>`;
    }
  }

  // ====== CSV（検索結果一括） ======
  async function monthlyCsv() {
    const filters = buildFiltersFromUI();

    if (!filters.from || !filters.to) {
      alert("期間（開始/終了）は必須です。");
      return;
    }
    if (filters.from > filters.to) {
      alert("期間が不正です（開始が終了より後になっています）。");
      return;
    }

    try {
      // csv.js の exportCsvSearchResult を利用（点呼CSV + 日報CSV）
      await exportCsvSearchResult(filters);
      alert("CSVを出力しました（点呼 / 日報 の2ファイル）。");
    } catch (e) {
      alert("CSV出力に失敗しました：\n" + (e?.message || e));
    }
  }

  // ====== 月報PDF（一括） ======
  async function monthlyPdf() {
    if (!lastGroups || lastGroups.length === 0 || !lastFilters) {
      alert("先に検索してください（検索結果からPDFを作成します）。");
      return;
    }

    try {
      await generateMonthlyPdf(lastGroups, lastFilters);
    } catch (e) {
      alert("月報PDF作成に失敗しました：\n" + (e?.message || e));
    }
  }

  // ====== 端末データ全削除（管理者端末用） ======
  async function wipeAllDeviceData() {
    const ok = confirm(
      "この端末の点呼/日報/基本情報（IndexedDB）を全削除します。\n本当に実行しますか？"
    );
    if (!ok) return;

    try {
      // IndexedDBを丸ごと削除
      await new Promise((resolve, reject) => {
        const req = indexedDB.deleteDatabase(OFA_DB_NAME);
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
        req.onblocked = () => reject(new Error("削除がブロックされました（タブを閉じて再実行）"));
      });

      alert("削除しました。ページを再読み込みします。");
      location.reload();
    } catch (e) {
      alert("削除に失敗しました：\n" + (e?.message || e));
    }
  }

  // ====== 入口：実行 ======
  function init() {
    ensureDefaultAdminPass();

    // もしURL直打ちでも「前回ログイン済み」なら通す
    showAdminPanel(isLoggedInAdmin());

    // 初期の期間
    clampDateInputs();

    // events
    btnAdminLogin?.addEventListener("click", adminLogin);
    btnChangePass?.addEventListener("click", changeAdminPass);

    btnMonthlySearch?.addEventListener("click", monthlySearch);
    btnMonthlyCsv?.addEventListener("click", monthlyCsv);
    btnMonthlyPdf?.addEventListener("click", monthlyPdf);

    btnDangerWipeAdmin?.addEventListener("click", wipeAllDeviceData);

    // Enterでログイン
    passInput?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") adminLogin();
    });
  }

  init();
})();
