// js/admin.js
// 管理者（月報PDF・期間検索）
// - 管理者パス：端末内 localStorage（初期：ofa-admin）
// - 検索：IndexedDB（searchMonthly / searchRecords を利用）
// - 出力：CSV（exportCsvSearchResult or buildTenkoCsv/buildDailyCsv）
// - PDF：generateMonthlyPdf（js/pdf.js）

(function(){
  const $ = (id)=>document.getElementById(id);

  const LS_ADMIN_PASS_KEY = "ofa_admin_pass";
  const DEFAULT_ADMIN_PASS = "ofa-admin";

  // =========================
  // util
  // =========================
  function toast(msg){
    // admin画面にはtoastが無い場合があるのでalert fallback
    const t = $("toast");
    if(t){
      t.textContent = msg;
      t.style.display = "block";
      clearTimeout(toast._tm);
      toast._tm = setTimeout(()=>t.style.display="none", 2200);
    }else{
      alert(msg);
    }
  }

  function getAdminPass(){
    return localStorage.getItem(LS_ADMIN_PASS_KEY) || DEFAULT_ADMIN_PASS;
  }

  function setAdminPass(newPass){
    localStorage.setItem(LS_ADMIN_PASS_KEY, newPass);
  }

  function isLoggedIn(){
    return localStorage.getItem("ofa_admin_logged_in") === "1";
  }

  function setLoggedIn(v){
    localStorage.setItem("ofa_admin_logged_in", v ? "1" : "0");
  }

  function normalizeDate(d){
    if(!d) return "";
    return String(d).slice(0,10);
  }

  function includesLike(hay, needle){
    if(!needle) return true;
    return String(hay || "").toLowerCase().includes(String(needle).toLowerCase());
  }

  function safeNum(n){
    const x = Number(n);
    return Number.isFinite(x) ? x : 0;
  }

  // =========================
  // DOM refs
  // =========================
  const a_pass = $("a_pass");
  const btnAdminLogin = $("btnAdminLogin");
  const btnChangePass = $("btnChangePass");
  const adminPanel = $("adminPanel");

  const m_from = $("m_from");
  const m_to   = $("m_to");
  const m_base = $("m_base");
  const m_name = $("m_name");

  const btnMonthlySearch = $("btnMonthlySearch");
  const btnMonthlyCsv    = $("btnMonthlyCsv");
  const btnMonthlyPdf    = $("btnMonthlyPdf");
  const monthlyList      = $("monthlyList");

  // 内部保持：最後に検索した結果
  let lastGroups = [];
  let lastFilters = null;

  // =========================
  // Admin Auth
  // =========================
  function showAdminPanel(){
    if(adminPanel) adminPanel.classList.remove("hidden");
  }
  function hideAdminPanel(){
    if(adminPanel) adminPanel.classList.add("hidden");
  }

  function adminLogin(){
    const pass = (a_pass?.value || "").trim();
    if(!pass){
      toast("管理者パスを入力してください");
      return;
    }
    const ok = (pass === getAdminPass());
    if(!ok){
      toast("管理者パスが違います");
      return;
    }
    setLoggedIn(true);
    toast("ログインしました");
    showAdminPanel();
  }

  async function changePass(){
    const current = (a_pass?.value || "").trim();
    if(!current){
      toast("現在の管理者パスを入力してください");
      return;
    }
    if(current !== getAdminPass()){
      toast("現在の管理者パスが違います");
      return;
    }

    const p1 = prompt("新しい管理者パスを入力（8文字以上推奨）");
    if(!p1) return;
    const p2 = prompt("確認のためもう一度入力");
    if(!p2) return;
    if(p1 !== p2){
      toast("一致しません。やり直してください");
      return;
    }

    setAdminPass(p1);
    toast("管理者パスを変更しました（端末内保存）");
    // ログイン維持
    setLoggedIn(true);
    showAdminPanel();
  }

  // =========================
  // Search Filters
  // =========================
  function readFilters(){
    const from = normalizeDate(m_from?.value || "");
    const to   = normalizeDate(m_to?.value || "");
    const base = (m_base?.value || "").trim();
    const name = (m_name?.value || "").trim();

    if(!from || !to){
      toast("期間（開始/終了）は必須です");
      return null;
    }
    if(from > to){
      toast("期間が逆です（開始 <= 終了）");
      return null;
    }

    return { from, to, base, name };
  }

  // =========================
  // Render search result
  // =========================
  function renderGroups(groups){
    if(!monthlyList) return;

    if(!groups || groups.length === 0){
      monthlyList.innerHTML = `<div class="note">該当データがありません</div>`;
      return;
    }

    // グループごとに集計を軽く表示（PDFは generateMonthlyPdf 側で作る）
    monthlyList.innerHTML = groups.map((g, idx)=>{
      // 稼働日数：点呼の日付でカウント（出発/帰着どちらでも）
      const days = new Set();
      (g.tenko || []).forEach(t=>{
        const d = (t.at || "").slice(0,10);
        if(d) days.add(d);
      });

      // ODO差分：両方揃っているものだけ
      const byDate = new Map();
      (g.tenko || []).forEach(t=>{
        const d = (t.at || "").slice(0,10);
        if(!d) return;
        if(!byDate.has(d)) byDate.set(d, {dep:null, arr:null});
        if(t.type === "departure") byDate.get(d).dep = t;
        if(t.type === "arrival")   byDate.get(d).arr = t;
      });

      let km = 0;
      for(const [d,pair] of byDate.entries()){
        const dep = pair.dep?.odoStart;
        const arr = pair.arr?.odoEnd;
        const diff = safeNum(arr) - safeNum(dep);
        if(diff > 0) km += diff;
      }

      const tenkoCount = (g.tenko || []).length;
      const dailyCount = (g.daily || []).length;

      return `
        <div class="card" style="margin-top:14px">
          <div style="font-weight:900;font-size:16px;margin-bottom:6px">${g.name} / ${g.base}</div>
          <div class="small">
            稼働日数：<b>${days.size}</b> 日　
            走行距離合計：<b>${km}</b> km　
            点呼：<b>${tenkoCount}</b> 件　
            日報：<b>${dailyCount}</b> 件
          </div>

          <div class="divider" style="margin:12px 0"></div>

          <div class="small" style="margin-bottom:10px">点呼（最新10件）</div>
          <div style="border:1px solid #eee;border-radius:10px;overflow:hidden">
            ${(g.tenko || []).slice().sort((a,b)=>String(b.at).localeCompare(String(a.at))).slice(0,10).map(t=>{
              const d = (t.at||"").slice(0,10);
              const tm = (t.at||"").slice(11,16);
              const typeJ = (t.type==="departure") ? "出発" : "帰着";
              const odo = (t.type==="departure") ? (t.odoStart||"") : (t.odoEnd||"");
              const alc = (t.alcValue!=="" && t.alcValue!=null) ? ` / Alc:${t.alcValue}` : "";
              return `
                <div style="padding:10px 12px;border-top:1px solid #f1f1f1">
                  <div style="font-weight:800">${d} ${tm} / ${typeJ} / ODO:${odo}${alc}</div>
                  <div class="small">案件：${t.mainProject||""} / エリア：${t.loadArea||""} / 異常：${t.abnormal||""}</div>
                </div>
              `;
            }).join("")}
          </div>
        </div>
      `;
    }).join("");
  }

  // =========================
  // Search main
  // =========================
  async function doMonthlySearch(){
    if(!isLoggedIn()){
      toast("先に管理者ログインしてください");
      return;
    }

    const filters = readFilters();
    if(!filters) return;

    if(typeof searchMonthly !== "function"){
      toast("searchMonthly が見つかりません（js/db.js の読み込みを確認）");
      return;
    }

    try{
      const groups = await searchMonthly(filters);

      // 追加の部分一致フィルタ（念のため）
      const filtered = (groups || []).filter(g=>{
        if(!includesLike(g.base, filters.base)) return false;
        if(!includesLike(g.name, filters.name)) return false;
        return true;
      });

      lastGroups = filtered;
      lastFilters = filters;

      renderGroups(filtered);
      toast(`検索完了：${filtered.length} 件`);
    }catch(e){
      console.error(e);
      toast("検索に失敗しました： " + (e?.message || e));
    }
  }

  // =========================
  // CSV export (search result)
  // =========================
  async function exportMonthlyCsv(){
    if(!isLoggedIn()){
      toast("先に管理者ログインしてください");
      return;
    }
    const filters = readFilters();
    if(!filters) return;

    // 推奨：js/csv.js の exportCsvSearchResult を使う（点呼CSV/日報CSVを別々に確実出力）
    if(typeof exportCsvSearchResult === "function"){
      try{
        await exportCsvSearchResult(filters);
        toast("CSVを出力しました（点呼/日報）");
        return;
      }catch(e){
        console.error(e);
        toast("CSV出力に失敗： " + (e?.message || e));
        return;
      }
    }

    // fallback：buildTenkoCsv/buildDailyCsv がある場合
    if(typeof searchRecords !== "function" || typeof buildTenkoCsv !== "function" || typeof buildDailyCsv !== "function" || typeof downloadText !== "function"){
      toast("CSV機能が不足しています（js/csv.js / js/db.js の読み込みを確認）");
      return;
    }

    try{
      const { tenkoHit, dailyHit } = await searchRecords(filters);
      const key = `${filters.from}_${filters.to}`;
      downloadText(`OFA_点呼_${key}.csv`, buildTenkoCsv(tenkoHit));
      downloadText(`OFA_日報_${key}.csv`, buildDailyCsv(dailyHit));
      toast("CSVを出力しました（点呼/日報）");
    }catch(e){
      console.error(e);
      toast("CSV出力に失敗： " + (e?.message || e));
    }
  }

  // =========================
  // Monthly PDF
  // =========================
  async function makeMonthlyPdf(){
    if(!isLoggedIn()){
      toast("先に管理者ログインしてください");
      return;
    }

    const filters = readFilters();
    if(!filters) return;

    if(typeof generateMonthlyPdf !== "function"){
      toast("generateMonthlyPdf が見つかりません（js/pdf.js の読み込みを確認）");
      return;
    }

    // まだ検索してない場合は検索してから
    if(!lastGroups || lastGroups.length === 0 || !lastFilters ||
       lastFilters.from !== filters.from || lastFilters.to !== filters.to ||
       lastFilters.base !== filters.base || lastFilters.name !== filters.name){
      await doMonthlySearch();
    }

    if(!lastGroups || lastGroups.length === 0){
      toast("検索結果がありません。PDFを作成できません");
      return;
    }

    try{
      await generateMonthlyPdf(lastGroups, filters);
      toast("月報PDFを作成しました");
    }catch(e){
      console.error(e);
      toast("PDF作成に失敗： " + (e?.message || e));
    }
  }

  // =========================
  // init
  // =========================
  function init(){
    // 既にログイン済みなら開く
    if(isLoggedIn()){
      showAdminPanel();
    }else{
      hideAdminPanel();
    }

    btnAdminLogin && btnAdminLogin.addEventListener("click", adminLogin);
    btnChangePass && btnChangePass.addEventListener("click", changePass);

    btnMonthlySearch && btnMonthlySearch.addEventListener("click", doMonthlySearch);
    btnMonthlyCsv && btnMonthlyCsv.addEventListener("click", exportMonthlyCsv);
    btnMonthlyPdf && btnMonthlyPdf.addEventListener("click", makeMonthlyPdf);

    // 初期日付：今月をセット（ユーザーが手入力で変更できる）
    const d = new Date();
    const y = d.getFullYear();
    const m = d.getMonth();
    const first = new Date(y, m, 1);
    const last = new Date(y, m+1, 0);

    const f = `${first.getFullYear()}-${String(first.getMonth()+1).padStart(2,"0")}-${String(first.getDate()).padStart(2,"0")}`;
    const t = `${last.getFullYear()}-${String(last.getMonth()+1).padStart(2,"0")}-${String(last.getDate()).padStart(2,"0")}`;

    if(m_from && !m_from.value) m_from.value = f;
    if(m_to && !m_to.value) m_to.value = t;
  }

  document.addEventListener("DOMContentLoaded", init);
})();
