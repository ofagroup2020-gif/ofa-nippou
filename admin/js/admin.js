// /admin/js/admin.js
// 管理者画面制御：ログイン / 検索 / CSV / 月報PDF

const ADMIN_PASS_KEY = "ofa_admin_pass";
const DEFAULT_ADMIN_PASS = "ofa-admin";

// 初期パス未設定なら自動セット
(function initAdminPass(){
  if(!localStorage.getItem(ADMIN_PASS_KEY)){
    localStorage.setItem(ADMIN_PASS_KEY, DEFAULT_ADMIN_PASS);
  }
})();

const el = id => document.getElementById(id);

// ----------------------
// 管理者ログイン
// ----------------------
document.addEventListener("DOMContentLoaded", () => {

  el("btnAdminLogin").onclick = () => {
    const input = el("a_pass").value;
    const saved = localStorage.getItem(ADMIN_PASS_KEY);

    if(!input){
      alert("管理者パスを入力してください");
      return;
    }
    if(input !== saved){
      alert("管理者パスが違います");
      return;
    }

    // ログイン成功
    el("adminPanel").classList.remove("hidden");
    el("a_pass").value = "";
    alert("管理者ログイン成功");
  };

  el("btnChangePass").onclick = () => {
    const oldPass = prompt("現在の管理者パスを入力");
    if(oldPass !== localStorage.getItem(ADMIN_PASS_KEY)){
      alert("現在のパスが違います");
      return;
    }
    const newPass = prompt("新しい管理者パスを入力");
    if(!newPass){
      alert("新しいパスが未入力です");
      return;
    }
    localStorage.setItem(ADMIN_PASS_KEY, newPass);
    alert("管理者パスを変更しました");
  };

  // ----------------------
  // 月報検索
  // ----------------------
  el("btnMonthlySearch").onclick = async () => {
    const filters = getFilters();
    if(!filters.from || !filters.to){
      alert("期間（開始・終了）は必須です");
      return;
    }

    const { tenkoHit, dailyHit } = await searchRecords(filters);
    renderMonthlyList(tenkoHit, dailyHit);
  };

  // CSV出力（検索結果）
  el("btnMonthlyCsv").onclick = async () => {
    const filters = getFilters();
    if(!filters.from || !filters.to){
      alert("期間（開始・終了）は必須です");
      return;
    }
    await exportCsvSearchResult(filters);
  };

  // 月報PDF出力（集計）
  el("btnMonthlyPdf").onclick = async () => {
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
  };

});

// ----------------------
// フィルター取得
// ----------------------
function getFilters(){
  return {
    from: el("m_from").value,
    to:   el("m_to").value,
    base: el("m_base").value,
    name: el("m_name").value
  };
}

// ----------------------
// 検索結果表示
// ----------------------
function renderMonthlyList(tenkoRows, dailyRows){
  const box = el("monthlyList");
  box.innerHTML = "";

  if(tenkoRows.length === 0 && dailyRows.length === 0){
    box.innerHTML = "<div class='note'>検索結果がありません</div>";
    return;
  }

  const makeRow = (label, value) =>
    `<div style="display:flex;gap:8px">
      <div style="width:120px;font-weight:700">${label}</div>
      <div>${value ?? ""}</div>
    </div>`;

  // 点呼一覧
  if(tenkoRows.length){
    const t = document.createElement("div");
    t.className = "card";
    t.innerHTML = `<div class="h2">点呼（${tenkoRows.length}件）</div>`;
    tenkoRows.forEach(r=>{
      const typeJP = r.type==="departure"?"出発":"帰着";
      const div = document.createElement("div");
      div.style.borderTop = "1px solid #eee";
      div.style.padding = "8px 0";
      div.innerHTML = `
        ${makeRow("氏名", r.name)}
        ${makeRow("拠点", r.base)}
        ${makeRow("区分", typeJP)}
        ${makeRow("日時", r.at)}
        ${makeRow("アルコール", r.alcValue)}
        ${makeRow("異常", r.abnormal)}
      `;
      t.appendChild(div);
    });
    box.appendChild(t);
  }

  // 日報一覧
  if(dailyRows.length){
    const d = document.createElement("div");
    d.className = "card";
    d.innerHTML = `<div class="h2">日報（${dailyRows.length}件）</div>`;
    dailyRows.forEach(r=>{
      const div = document.createElement("div");
      div.style.borderTop = "1px solid #eee";
      div.style.padding = "8px 0";
      div.innerHTML = `
        ${makeRow("氏名", r.name)}
        ${makeRow("拠点", r.base)}
        ${makeRow("日付", r.date)}
        ${makeRow("案件", r.mainProject)}
        ${makeRow("走行距離", r.odoDiff)}
      `;
      d.appendChild(div);
    });
    box.appendChild(d);
  }
}
