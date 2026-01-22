// js/admin.js
// 管理者：認証 / 月報検索 / CSV / PDF 制御
// 前提：db.js / pdf.js / csv.js が先に読み込まれていること

(() => {
  const PASS_KEY = "ofa_admin_pass";
  const LOGIN_KEY = "ofa_admin_login";

  // 初期パス（初回のみ使用。以降は変更可能）
  const DEFAULT_PASS = "ofa-admin";

  const $ = (id) => document.getElementById(id);

  // ---- 初期化 ----
  document.addEventListener("DOMContentLoaded", () => {
    initAdminAuth();
    bindEvents();
    restoreLoginState();
  });

  function initAdminAuth(){
    // 初回だけ初期パスを保存
    if(!localStorage.getItem(PASS_KEY)){
      localStorage.setItem(PASS_KEY, DEFAULT_PASS);
    }
  }

  function bindEvents(){
    $("btnAdminLogin")?.addEventListener("click", onAdminLogin);
    $("btnChangePass")?.addEventListener("click", onChangePass);

    $("btnMonthlySearch")?.addEventListener("click", onMonthlySearch);
    $("btnMonthlyCsv")?.addEventListener("click", onMonthlyCsv);
    $("btnMonthlyPdf")?.addEventListener("click", onMonthlyPdf);
  }

  function restoreLoginState(){
    const ok = localStorage.getItem(LOGIN_KEY) === "1";
    if(ok){
      showAdminPanel(true);
    }
  }

  // ---- 認証 ----
  function onAdminLogin(){
    const input = $("a_pass").value || "";
    const saved = localStorage.getItem(PASS_KEY) || DEFAULT_PASS;

    if(input !== saved){
      alert("管理者パスが違います");
      return;
    }

    localStorage.setItem(LOGIN_KEY, "1");
    showAdminPanel(true);
  }

  function onChangePass(){
    const oldPass = prompt("現在の管理者パスを入力してください");
    if(!oldPass) return;

    const saved = localStorage.getItem(PASS_KEY) || DEFAULT_PASS;
    if(oldPass !== saved){
      alert("現在のパスが違います");
      return;
    }

    const newPass = prompt("新しい管理者パスを入力してください");
    if(!newPass || newPass.length < 4){
      alert("4文字以上で入力してください");
      return;
    }

    localStorage.setItem(PASS_KEY, newPass);
    alert("管理者パスを変更しました");
  }

  function showAdminPanel(show){
    const panel = $("adminPanel");
    if(!panel) return;
    panel.classList.toggle("hidden", !show);
  }

  // ---- 検索条件 ----
  function getFilters(){
    return {
      from: $("m_from")?.value || "",
      to:   $("m_to")?.value || "",
      base: $("m_base")?.value || "",
      name: $("m_name")?.value || ""
    };
  }

  // ---- 月報検索 ----
  async function onMonthlySearch(){
    const filters = getFilters();
    if(!filters.from || !filters.to){
      alert("期間（開始・終了）は必須です");
      return;
    }

    const { tenkoHit, dailyHit } = await searchRecords(filters);
    renderMonthlyList(tenkoHit, dailyHit);
  }

  function renderMonthlyList(tenkoRows, dailyRows){
    const box = $("monthlyList");
    if(!box) return;

    if(tenkoRows.length === 0 && dailyRows.length === 0){
      box.innerHTML = `<div class="note">該当データがありません</div>`;
      return;
    }

    let html = `<div class="note">検索結果：点呼 ${tenkoRows.length} 件 / 日報 ${dailyRows.length} 件</div>`;

    html += `<table class="tbl">
      <thead>
        <tr>
          <th>日付</th>
          <th>氏名</th>
          <th>拠点</th>
          <th>区分</th>
          <th>アルコール</th>
          <th>異常</th>
        </tr>
      </thead>
      <tbody>
    `;

    tenkoRows.forEach(r => {
      html += `
        <tr>
          <td>${(r.at||"").slice(0,10)}</td>
          <td>${r.name||""}</td>
          <td>${r.base||""}</td>
          <td>${r.type==="departure"?"出発":"帰着"}</td>
          <td>${r.alcValue||""}</td>
          <td>${r.abnormal||""}</td>
        </tr>
      `;
    });

    html += `</tbody></table>`;
    box.innerHTML = html;
  }

  // ---- CSV ----
  async function onMonthlyCsv(){
    const filters = getFilters();
    if(!filters.from || !filters.to){
      alert("期間（開始・終了）は必須です");
      return;
    }
    await exportCsvSearchResult(filters);
  }

  // ---- PDF ----
  async function onMonthlyPdf(){
    const filters = getFilters();
    if(!filters.from || !filters.to){
      alert("期間（開始・終了）は必須です");
      return;
    }

    const groups = await searchMonthly(filters);
    if(groups.length === 0){
      alert("対象データがありません");
      return;
    }

    await generateMonthlyPdf(groups, filters);
  }

})();
