// js/admin.js
// 管理者画面ロジック（IndexedDB / PDF / CSV 連携）

/* =========================
   管理者パス管理
========================= */

const ADMIN_PASS_KEY = "ofa_admin_pass";

// 初期パス（LINE共有用・画面には一切表示しない）
function getAdminPass(){
  let p = localStorage.getItem(ADMIN_PASS_KEY);
  if(!p){
    // 初回のみ初期化
    p = "ofa-admin";
    localStorage.setItem(ADMIN_PASS_KEY, p);
  }
  return p;
}

function setAdminPass(newPass){
  localStorage.setItem(ADMIN_PASS_KEY, newPass);
}

/* =========================
   DOM取得（iPhone対策）
========================= */

const $ = id => document.getElementById(id);

const cardLogin   = $("cardLogin");
const adminPanel  = $("adminPanel");

const inputPass   = $("a_pass");
const btnLogin    = $("btnAdminLogin");
const btnChange   = $("btnChangePass");
const btnLogout   = $("btnLogoutAdmin");

const btnSearch   = $("btnMonthlySearch");
const btnCsv      = $("btnMonthlyCsv");
const btnPdf      = $("btnMonthlyPdf");
const btnBackup   = $("btnExportBackup");

const listArea    = $("monthlyList");
const summaryArea = $("monthlySummary");

/* =========================
   表示制御
========================= */

function showAdmin(){
  cardLogin.classList.add("hidden");
  adminPanel.classList.remove("hidden");
}

function hideAdmin(){
  adminPanel.classList.add("hidden");
  cardLogin.classList.remove("hidden");
}

/* =========================
   管理者ログイン
========================= */

btnLogin.addEventListener("click", () => {
  const input = (inputPass.value || "").trim();
  if(!input){
    alert("管理者パスワードを入力してください");
    return;
  }

  if(input === getAdminPass()){
    showAdmin();
    inputPass.value = "";
  }else{
    alert("管理者パスワードが違います");
  }
});

/* =========================
   管理者パス変更
========================= */

btnChange.addEventListener("click", () => {
  const cur = prompt("現在の管理者パスを入力");
  if(cur !== getAdminPass()){
    alert("現在のパスが違います");
    return;
  }

  const next = prompt("新しい管理者パスを入力（8文字以上推奨）");
  if(!next || next.length < 4){
    alert("短すぎます");
    return;
  }

  setAdminPass(next);
  alert("管理者パスを変更しました。\n※社内LINEで共有してください");
});

/* =========================
   ログアウト
========================= */

btnLogout.addEventListener("click", () => {
  hideAdmin();
});

/* =========================
   検索処理
========================= */

function getFilters(){
  return {
    from : $("m_from").value,
    to   : $("m_to").value,
    base : $("m_base").value,
    name : $("m_name").value
  };
}

btnSearch.addEventListener("click", async () => {
  const filters = getFilters();
  if(!filters.from || !filters.to){
    alert("期間（開始・終了）は必須です");
    return;
  }

  listArea.innerHTML = "検索中…";
  summaryArea.innerHTML = "";

  const groups = await searchMonthly(filters);
  renderSummary(groups, filters);
  renderList(groups);
});

/* =========================
   CSV出力
========================= */

btnCsv.addEventListener("click", async () => {
  const filters = getFilters();
  if(!filters.from || !filters.to){
    alert("期間（開始・終了）は必須です");
    return;
  }
  await exportCsvSearchResult(filters);
});

/* =========================
   月報PDF
========================= */

btnPdf.addEventListener("click", async () => {
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
});

/* =========================
   バックアップ（JSON）
========================= */

btnBackup.addEventListener("click", async () => {
  const tenko = await idbGetAll("tenko");
  const daily = await idbGetAll("daily");
  const profile = await idbGet("profile", "me");

  const data = {
    exportedAt: new Date().toISOString(),
    profile,
    tenko,
    daily
  };

  const blob = new Blob(
    [JSON.stringify(data, null, 2)],
    { type:"application/json;charset=utf-8" }
  );

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `OFA_backup_${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

/* =========================
   表示描画
========================= */

function renderSummary(groups, filters){
  let totalDays = 0;
  let totalKm   = 0;

  groups.forEach(g => {
    const days = new Set();
    g.tenko.forEach(t => days.add((t.at||"").slice(0,10)));
    totalDays += days.size;

    const map = {};
    g.tenko.forEach(t => {
      const d = (t.at||"").slice(0,10);
      map[d] = map[d] || {};
      if(t.type === "departure") map[d].dep = t;
      if(t.type === "arrival")   map[d].arr = t;
    });

    Object.values(map).forEach(p => {
      const km = (Number(p.arr?.odoEnd||0) - Number(p.dep?.odoStart||0));
      if(km > 0) totalKm += km;
    });
  });

  summaryArea.innerHTML = `
    <div class="card">
      <b>検索結果サマリー</b><br>
      期間：${filters.from} ～ ${filters.to}<br>
      対象人数：${groups.length} 名<br>
      稼働日数合計：${totalDays} 日<br>
      走行距離合計：${totalKm} km
    </div>
  `;
}

function renderList(groups){
  if(groups.length === 0){
    listArea.innerHTML = "<div class='small'>該当データなし</div>";
    return;
  }

  listArea.innerHTML = groups.map(g => `
    <div class="card">
      <b>${g.name}</b> / ${g.base}<br>
      点呼：${g.tenko.length} 件　
      日報：${g.daily.length} 件
    </div>
  `).join("");
}

/* =========================
   初期表示
========================= */

// 初期は必ずログイン画面
hideAdmin();
