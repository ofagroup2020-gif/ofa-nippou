// /admin/js/admin.js
// 管理者（月報PDF・期間検索）
// - 端末内データ（IndexedDB）検索
// - CSV出力（検索結果）
// - 月報PDF作成
// - 管理者パス（localStorage）で簡易ロック
//
// 依存：
//  - /admin/js/db.js : searchRecords(), searchMonthly()
//  - /admin/js/csv.js: exportCsvSearchResult()
//  - /admin/js/pdf.js: generateMonthlyPdf()

(function(){
  // ====== DOM ======
  const elPass = document.getElementById("a_pass");
  const btnLogin = document.getElementById("btnAdminLogin");
  const btnChange = document.getElementById("btnChangePass");

  const adminPanel = document.getElementById("adminPanel");

  const mFrom = document.getElementById("m_from");
  const mTo = document.getElementById("m_to");
  const mBase = document.getElementById("m_base");
  const mName = document.getElementById("m_name");

  const btnSearch = document.getElementById("btnMonthlySearch");
  const btnCsv = document.getElementById("btnMonthlyCsv");
  const btnPdf = document.getElementById("btnMonthlyPdf");

  const list = document.getElementById("monthlyList");

  // ====== Storage Keys ======
  const LS_ADMIN_HASH = "ofa_admin_pass_hash_v1";
  const LS_ADMIN_UNLOCK = "ofa_admin_unlocked_v1";

  // ====== Utils ======
  function toast(msg){
    alert(msg);
  }

  function normalizeDate(d){
    if(!d) return "";
    return String(d).slice(0,10);
  }

  function todayStr(){
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,"0");
    const dd = String(d.getDate()).padStart(2,"0");
    return `${y}-${m}-${dd}`;
  }

  // 簡易ハッシュ（パスワードを平文保存しない）
  // ※強固な暗号化ではない。運用（LINE共有）前提の簡易ロック。
  async function sha256(str){
    const enc = new TextEncoder().encode(str);
    const buf = await crypto.subtle.digest("SHA-256", enc);
    return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,"0")).join("");
  }

  function isPassInitialized(){
    return !!localStorage.getItem(LS_ADMIN_HASH);
  }

  function setUnlocked(v){
    localStorage.setItem(LS_ADMIN_UNLOCK, v ? "1" : "0");
  }

  function isUnlocked(){
    return localStorage.getItem(LS_ADMIN_UNLOCK) === "1";
  }

  function showPanel(){
    adminPanel.classList.remove("hidden");
  }
  function hidePanel(){
    adminPanel.classList.add("hidden");
  }

  function bindTap(el, fn){
    if(!el) return;
    el.addEventListener("click", fn, {passive:true});
    el.addEventListener("touchend", (e)=>{ e.preventDefault(); fn(); }, {passive:false});
  }

  // ====== 初期入力（期間） ======
  function initDates(){
    // 今月の1日〜今日
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth()+1).padStart(2,"0");
    const first = `${y}-${m}-01`;
    const today = todayStr();
    if(!mFrom.value) mFrom.value = first;
    if(!mTo.value) mTo.value = today;
  }

  // ====== 管理者パス運用 ======
  async function setupFirstPass(){
    // 初回だけパスを設定（コードに初期パスを書かない）
    const newPass = prompt("管理者パスを初回設定してください（LINEで共有するパス）");
    if(!newPass || newPass.length < 4){
      toast("パスは4文字以上で設定してください。");
      return;
    }
    const h = await sha256(newPass);
    localStorage.setItem(LS_ADMIN_HASH, h);
    setUnlocked(true);
    toast("管理者パスを設定しました。ログイン済みです。");
    showPanel();
  }

  async function adminLogin(){
    // パス未設定なら初回設定へ
    if(!isPassInitialized()){
      await setupFirstPass();
      return;
    }

    const pass = (elPass.value || "").trim();
    if(!pass){
      toast("管理者パスを入力してください。");
      return;
    }

    const h = await sha256(pass);
    const saved = localStorage.getItem(LS_ADMIN_HASH);
    if(h !== saved){
      toast("管理者パスが違います。LINEで確認してください。");
      return;
    }

    setUnlocked(true);
    toast("ログインしました。");
    showPanel();
  }

  async function changePass(){
    // 変更はログイン後のみ
    if(!isUnlocked()){
      toast("先に管理者ログインしてください。");
      return;
    }

    const newPass = prompt("新しい管理者パスを入力してください（LINEで共有するパス）");
    if(!newPass || newPass.length < 4){
      toast("パスは4文字以上で設定してください。");
      return;
    }
    const h = await sha256(newPass);
    localStorage.setItem(LS_ADMIN_HASH, h);
    toast("管理者パスを変更しました。");
    elPass.value = "";
  }

  // ====== 検索・表示 ======
  let lastFilters = null;
  let lastMonthlyGroups = null;

  function filtersFromUI(){
    const from = normalizeDate(mFrom.value);
    const to = normalizeDate(mTo.value);
    const base = (mBase.value || "").trim();
    const name = (mName.value || "").trim();

    if(!from || !to){
      toast("期間（開始・終了）は必須です。");
      return null;
    }
    if(from > to){
      toast("期間の開始と終了が逆です。");
      return null;
    }
    return { from, to, base, name };
  }

  function renderMonthlyList(groups){
    if(!groups || groups.length === 0){
      list.innerHTML = `
        <div class="note" style="margin-top:10px">
          該当データがありません。期間や氏名/拠点を変えて検索してください。
        </div>
      `;
      return;
    }

    const cards = groups.map(g=>{
      const tenkoCount = g.tenko?.length || 0;
      const dailyCount = g.daily?.length || 0;

      // 稼働日（点呼の日付）推定
      const days = new Set();
      (g.tenko||[]).forEach(t=>{
        const d = (t.at||"").slice(0,10);
        if(d) days.add(d);
      });

      // 走行距離推定（出発ODOと帰着ODOが揃った日だけ）
      const byDate = new Map();
      (g.tenko||[]).forEach(t=>{
        const d = (t.at||"").slice(0,10);
        if(!d) return;
        if(!byDate.has(d)) byDate.set(d, {dep:null, arr:null});
        if(t.type === "departure") byDate.get(d).dep = t;
        if(t.type === "arrival") byDate.get(d).arr = t;
      });
      let totalKm = 0;
      for(const [d,p] of byDate){
        const km = (Number(p.arr?.odoEnd||0) - Number(p.dep?.odoStart||0));
        if(Number.isFinite(km) && km > 0) totalKm += km;
      }

      return `
        <div class="card" style="margin-top:12px">
          <div class="h2" style="margin-bottom:6px">${g.name || "-"} / ${g.base || "-"}</div>
          <div class="small">
            稼働日数（推定）: <b>${days.size}</b> 日　
            走行距離合計（推定）: <b>${totalKm}</b> km　
            点呼: <b>${tenkoCount}</b> 件　
            日報: <b>${dailyCount}</b> 件
          </div>
        </div>
      `;
    }).join("");

    list.innerHTML = cards;
  }

  async function doSearch(){
    if(!isUnlocked()){
      toast("先に管理者ログインしてください。");
      return;
    }
    const f = filtersFromUI();
    if(!f) return;

    list.innerHTML = `<div class="note" style="margin-top:10px">検索中…</div>`;

    try{
      // 月報は「集計グループ」で検索
      const groups = await searchMonthly(f);
      lastFilters = f;
      lastMonthlyGroups = groups;

      renderMonthlyList(groups);
      toast(`検索完了：${groups.length} 件（グループ）`);
    }catch(e){
      console.error(e);
      list.innerHTML = `<div class="note" style="margin-top:10px">検索失敗：${e.message || e}</div>`;
      toast("検索に失敗しました。");
    }
  }

  async function doCsv(){
    if(!isUnlocked()){
      toast("先に管理者ログインしてください。");
      return;
    }
    const f = lastFilters || filtersFromUI();
    if(!f) return;

    try{
      await exportCsvSearchResult(f);
      toast("CSVを出力しました（点呼CSV / 日報CSV）");
    }catch(e){
      console.error(e);
      toast("CSV出力に失敗しました。");
    }
  }

  async function doPdf(){
    if(!isUnlocked()){
      toast("先に管理者ログインしてください。");
      return;
    }
    const f = lastFilters || filtersFromUI();
    if(!f) return;

    if(!lastMonthlyGroups){
      toast("先に検索してください。");
      return;
    }

    try{
      await generateMonthlyPdf(lastMonthlyGroups, f);
      toast("月報PDFを作成しました。");
    }catch(e){
      console.error(e);
      toast("月報PDF作成に失敗しました。");
    }
  }

  // ====== 起動処理 ======
  function boot(){
    initDates();

    // すでに解除済なら表示
    if(isUnlocked()){
      showPanel();
    }else{
      hidePanel();
    }

    bindTap(btnLogin, adminLogin);
    bindTap(btnChange, changePass);
    bindTap(btnSearch, doSearch);
    bindTap(btnCsv, doCsv);
    bindTap(btnPdf, doPdf);

    // Enterでログイン
    if(elPass){
      elPass.addEventListener("keydown", (e)=>{
        if(e.key === "Enter"){
          adminLogin();
        }
      });
    }
  }

  boot();

})();
