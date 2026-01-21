// admin/js/admin.js
// 管理者：簡易パス認証 → 期間/拠点/氏名で検索 → 一覧表示 → CSV出力 → 月報PDF出力
// 前提：../js/db.js（searchRecords/searchMonthly等）/ ../js/csv.js / ../js/pdf.js が読み込まれていること

(function(){
  // ========= utils =========
  const $ = (id)=> document.getElementById(id);

  function toast(msg){
    const t = $("toast");
    if(!t){ alert(msg); return; }
    t.textContent = msg;
    t.style.display = "block";
    clearTimeout(toast._tm);
    toast._tm = setTimeout(()=> t.style.display="none", 2400);
  }

  function normalizeDate(v){
    return (v||"").toString().slice(0,10);
  }

  function required(v){
    return v !== null && v !== undefined && String(v).trim() !== "";
  }

  // ========= admin pass =========
  const LS_ADMIN_PASS_KEY = "ofa_admin_pass";
  const LS_ADMIN_LOGIN_KEY = "ofa_admin_logged_in";

  function getAdminPass(){
    return localStorage.getItem(LS_ADMIN_PASS_KEY) || "ofa-admin";
  }
  function setAdminPass(newPass){
    localStorage.setItem(LS_ADMIN_PASS_KEY, newPass);
  }
  function isAdminLoggedIn(){
    return localStorage.getItem(LS_ADMIN_LOGIN_KEY) === "1";
  }
  function setAdminLoggedIn(flag){
    localStorage.setItem(LS_ADMIN_LOGIN_KEY, flag ? "1" : "0");
  }

  function showAdminPanel(){
    const panel = $("adminPanel");
    if(panel) panel.classList.remove("hidden");
  }
  function hideAdminPanel(){
    const panel = $("adminPanel");
    if(panel) panel.classList.add("hidden");
  }

  // ========= render =========
  function renderMonthlyList(groups, filters){
    const box = $("monthlyList");
    if(!box) return;

    if(!groups || groups.length === 0){
      box.innerHTML = `<div class="note">該当データがありません（条件を変えて検索してください）</div>`;
      return;
    }

    // 簡易集計（PDF側でも集計するが、画面にもサマリ表示）
    const lines = [];

    for(const g of groups){
      const days = new Set();
      const byDate = new Map(); // date => {dep,arr}

      (g.tenko || []).forEach(t=>{
        const d = normalizeDate(t.at);
        if(d) days.add(d);
        if(!byDate.has(d)) byDate.set(d, {dep:null, arr:null});
        if(t.type === "departure") byDate.get(d).dep = t;
        if(t.type === "arrival")   byDate.get(d).arr = t;
      });

      let totalKm = 0;
      for(const [d,pair] of byDate){
        const dep = pair.dep?.odoStart;
        const arr = pair.arr?.odoEnd;
        const diff = Number(arr) - Number(dep);
        if(Number.isFinite(diff) && diff > 0) totalKm += diff;
      }

      lines.push(`
        <div class="miniCard">
          <div class="miniTitle">${g.name} / ${g.base}</div>
          <div class="miniSub">期間：${filters.from||""} ～ ${filters.to||""}</div>
          <div class="miniGrid">
            <div><b>稼働日数</b><br>${days.size}日</div>
            <div><b>走行距離</b><br>${totalKm}km</div>
            <div><b>点呼</b><br>${(g.tenko||[]).length}件</div>
            <div><b>日報</b><br>${(g.daily||[]).length}件</div>
          </div>
        </div>
      `);
    }

    box.innerHTML = `
      <div class="note">検索結果：${groups.length} 名</div>
      ${lines.join("")}
    `;
  }

  // ========= actions =========
  let lastGroups = [];
  let lastFilters = {from:"", to:"", base:"", name:""};

  async function doMonthlySearch(){
    const from = $("m_from")?.value || "";
    const to   = $("m_to")?.value || "";
    const base = $("m_base")?.value || "";
    const name = $("m_name")?.value || "";

    if(!required(from) || !required(to)){
      toast("期間（開始/終了）は必須です");
      return;
    }
    if(from > to){
      toast("期間が逆です（開始 <= 終了）");
      return;
    }

    const filters = { from, to, base, name };
    lastFilters = filters;

    try{
      // searchMonthly は db.js 側で tenko/daily を group 化して返す
      const groups = await searchMonthly(filters);
      lastGroups = groups || [];
      renderMonthlyList(lastGroups, lastFilters);
      toast("検索しました");
    }catch(e){
      console.error(e);
      toast("検索に失敗しました： " + (e?.message || e));
    }
  }

  async function doMonthlyCsv(){
    // 仕様：検索結果が無ければ、条件で検索してCSV出す
    try{
      if(!lastFilters.from || !lastFilters.to){
        toast("先に期間を指定して検索してください");
        return;
      }
      await exportCsvSearchResult(lastFilters);
      toast("CSV出力しました（点呼CSV・日報CSV）");
    }catch(e){
      console.error(e);
      toast("CSV出力に失敗： " + (e?.message || e));
    }
  }

  async function doMonthlyPdf(){
    try{
      if(!lastFilters.from || !lastFilters.to){
        toast("先に期間を指定して検索してください");
        return;
      }
      // groupsが未取得なら検索してからPDF
      if(!lastGroups || lastGroups.length === 0){
        const groups = await searchMonthly(lastFilters);
        lastGroups = groups || [];
      }
      if(!lastGroups || lastGroups.length === 0){
        toast("対象データがありません");
        return;
      }
      await generateMonthlyPdf(lastGroups, lastFilters);
      toast("月報PDFを作成しました");
    }catch(e){
      console.error(e);
      toast("月報PDFに失敗： " + (e?.message || e));
    }
  }

  // ========= admin login =========
  function doAdminLogin(){
    const input = $("a_pass")?.value || "";
    const real = getAdminPass();

    if(!required(input)){
      toast("管理者パスを入力してください");
      return;
    }
    if(input !== real){
      toast("管理者パスが違います（LINEで確認）");
      return;
    }

    setAdminLoggedIn(true);
    showAdminPanel();
    toast("管理者ログインしました");
  }

  function doChangePass(){
    // 旧パス確認 → 新パス入力 → 保存
    const oldInput = $("a_pass")?.value || "";
    const real = getAdminPass();

    if(!required(oldInput)){
      toast("まず現在の管理者パスを入力してください");
      return;
    }
    if(oldInput !== real){
      toast("現在の管理者パスが違います");
      return;
    }

    const newPass = prompt("新しい管理者パスを入力してください（例：8文字以上推奨）");
    if(!newPass) return;
    if(String(newPass).trim().length < 4){
      toast("短すぎます（4文字以上）");
      return;
    }

    setAdminPass(String(newPass).trim());
    toast("管理者パスを変更しました（LINE共有はあなたの運用で）");
  }

  // ========= init =========
  function bind(){
    const b1 = $("btnAdminLogin");
    if(b1) b1.addEventListener("click", doAdminLogin);

    const b2 = $("btnChangePass");
    if(b2) b2.addEventListener("click", doChangePass);

    const b3 = $("btnMonthlySearch");
    if(b3) b3.addEventListener("click", doMonthlySearch);

    const b4 = $("btnMonthlyCsv");
    if(b4) b4.addEventListener("click", doMonthlyCsv);

    const b5 = $("btnMonthlyPdf");
    if(b5) b5.addEventListener("click", doMonthlyPdf);

    // Enter でログイン
    const pass = $("a_pass");
    if(pass){
      pass.addEventListener("keydown", (e)=>{
        if(e.key === "Enter") doAdminLogin();
      });
    }
  }

  async function init(){
    bind();

    // すでにログイン済みなら adminPanel 表示
    if(isAdminLoggedIn()){
      showAdminPanel();
    }else{
      hideAdminPanel();
    }

    // 初期表示（空）
    renderMonthlyList([], {from:"", to:"", base:"", name:""});
  }

  document.addEventListener("DOMContentLoaded", init);
})();
