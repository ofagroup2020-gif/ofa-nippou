// /admin/js/admin.js
// 管理者画面ロジック（簡易パス + IndexedDB検索 + 月報PDF/CSV）

/* =========
  設定
========== */
const ADMIN_PASS_KEY = "ofa_admin_pass";
const DEFAULT_ADMIN_PASS = "ofa-admin"; // 初期値（運用では必ず変更）

/* =========
  要素取得
========== */
const elPass        = document.getElementById("a_pass");
const btnLogin      = document.getElementById("btnAdminLogin");
const btnChangePass = document.getElementById("btnChangePass");
const adminPanel    = document.getElementById("adminPanel");

const mFrom   = document.getElementById("m_from");
const mTo     = document.getElementById("m_to");
const mBase   = document.getElementById("m_base");
const mName   = document.getElementById("m_name");

const btnSearch = document.getElementById("btnMonthlySearch");
const btnCsv    = document.getElementById("btnMonthlyCsv");
const btnPdf    = document.getElementById("btnMonthlyPdf");

const monthlyList = document.getElementById("monthlyList");

/* =========
  初期化
========== */
(function init(){
  // 初回起動時、管理者パスが未設定なら初期値を保存
  if(!localStorage.getItem(ADMIN_PASS_KEY)){
    localStorage.setItem(ADMIN_PASS_KEY, DEFAULT_ADMIN_PASS);
  }
})();

/* =========
  管理者認証
========== */
function getSavedAdminPass(){
  return localStorage.getItem(ADMIN_PASS_KEY) || DEFAULT_ADMIN_PASS;
}

btnLogin.addEventListener("click", ()=>{
  const input = (elPass.value || "").trim();
  if(!input){
    alert("管理者パスを入力してください");
    return;
  }
  if(input !== getSavedAdminPass()){
    alert("管理者パスが違います");
    return;
  }
  adminPanel.classList.remove("hidden");
  alert("管理者ログインしました");
});

btnChangePass.addEventListener("click", ()=>{
  const cur = (elPass.value || "").trim();
  if(!cur){
    alert("現在の管理者パスを入力してください");
    return;
  }
  if(cur !== getSavedAdminPass()){
    alert("現在の管理者パスが違います");
    return;
  }
  const next = prompt("新しい管理者パスを入力してください（8文字以上推奨）");
  if(!next || next.length < 4){
    alert("短すぎます");
    return;
  }
  localStorage.setItem(ADMIN_PASS_KEY, next);
  alert("管理者パスを変更しました");
  elPass.value = "";
});

/* =========
  検索条件
========== */
function buildFilters(){
  return {
    from: mFrom.value || "",
    to:   mTo.value || "",
    base: (mBase.value || "").trim(),
    name: (mName.value || "").trim()
  };
}

/* =========
  検索表示
========== */
btnSearch.addEventListener("click", async ()=>{
  monthlyList.innerHTML = "";
  const filters = buildFilters();

  if(!filters.from || !filters.to){
    alert("期間（開始・終了）は必須です");
    return;
  }

  try{
    const groups = await searchMonthly(filters);
    if(groups.length === 0){
      monthlyList.innerHTML = `<div class="note">該当データがありません</div>`;
      return;
    }

    for(const g of groups){
      renderGroup(g, filters);
    }
  }catch(e){
    console.error(e);
    alert("検索に失敗しました");
  }
});

/* =========
  CSV出力（検索結果）
========== */
btnCsv.addEventListener("click", async ()=>{
  const filters = buildFilters();
  if(!filters.from || !filters.to){
    alert("期間（開始・終了）は必須です");
    return;
  }
  try{
    await exportCsvSearchResult(filters);
    alert("CSVを出力しました");
  }catch(e){
    console.error(e);
    alert("CSV出力に失敗しました");
  }
});

/* =========
  月報PDF
========== */
btnPdf.addEventListener("click", async ()=>{
  const filters = buildFilters();
  if(!filters.from || !filters.to){
    alert("期間（開始・終了）は必須です");
    return;
  }
  try{
    const groups = await searchMonthly(filters);
    if(groups.length === 0){
      alert("対象データがありません");
      return;
    }
    await generateMonthlyPdf(groups, filters);
  }catch(e){
    console.error(e);
    alert("月報PDF生成に失敗しました");
  }
});

/* =========
  表示用
========== */
function renderGroup(g, filters){
  // 集計
  const days = new Set();
  let totalKm = 0;

  const byDate = new Map();
  g.tenko.forEach(t=>{
    const d = (t.at||"").slice(0,10);
    if(!d) return;
    days.add(d);
    if(!byDate.has(d)) byDate.set(d, {dep:null, arr:null});
    if(t.type === "departure") byDate.get(d).dep = t;
    if(t.type === "arrival")   byDate.get(d).arr = t;
  });

  for(const pair of byDate.values()){
    const dep = Number(pair.dep?.odoStart || 0);
    const arr = Number(pair.arr?.odoEnd   || 0);
    const diff = arr - dep;
    if(diff > 0) totalKm += diff;
  }

  const wrap = document.createElement("div");
  wrap.className = "resultCard";

  wrap.innerHTML = `
    <div class="resultHead">
      <div>
        <div class="resultTitle">${g.name} / ${g.base}</div>
        <div class="resultSub">期間：${filters.from} ～ ${filters.to}</div>
      </div>
      <div class="pill"><b>${days.size}</b> 日</div>
    </div>

    <div class="kv">
      <div class="k">点呼件数</div><div class="v">${g.tenko.length}</div>
      <div class="k">日報件数</div><div class="v">${g.daily.length}</div>
      <div class="k">走行距離合計</div><div class="v">${totalKm} km</div>
    </div>
  `;

  monthlyList.appendChild(wrap);
}
