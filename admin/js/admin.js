/* admin/js/admin.js
  管理者：端末内データ（IndexedDB）検索 → 月報PDF / CSV 出力
  - 管理者パスはローカル保存（localStorage）
  - 画面にパスは表示しない（LINE配布前提）
*/

(function(){
  // ====== DOM ======
  const elPass = document.getElementById("a_pass");
  const btnLogin = document.getElementById("btnAdminLogin");
  const btnChange = document.getElementById("btnChangePass");
  const panel = document.getElementById("adminPanel");

  const fromEl = document.getElementById("m_from");
  const toEl   = document.getElementById("m_to");
  const baseEl = document.getElementById("m_base");
  const nameEl = document.getElementById("m_name");

  const btnSearch = document.getElementById("btnMonthlySearch");
  const btnCsv    = document.getElementById("btnMonthlyCsv");
  const btnPdf    = document.getElementById("btnMonthlyPdf");

  const listEl = document.getElementById("monthlyList");

  // ====== PASS ======
  const PASS_KEY = "ofa_admin_pass";
  const DEFAULT_PASS = "ofa-admin"; // 初期（画面に書かない運用にしたいなら index.html 側の説明文を変える）

  function getSavedPass(){
    return localStorage.getItem(PASS_KEY) || DEFAULT_PASS;
  }

  function isLoggedIn(){
    return localStorage.getItem("ofa_admin_logged") === "1";
  }

  function setLoggedIn(v){
    localStorage.setItem("ofa_admin_logged", v ? "1" : "0");
  }

  function toast(msg){
    alert(msg);
  }

  function requireLoggedIn(){
    if(!isLoggedIn()){
      panel.classList.add("hidden");
      return false;
    }
    panel.classList.remove("hidden");
    return true;
  }

  // ====== Helpers ======
  function getFilters(){
    return {
      from: fromEl.value || "",
      to:   toEl.value || "",
      base: (baseEl.value || "").trim(),
      name: (nameEl.value || "").trim()
    };
  }

  function validateRange(){
    if(!fromEl.value || !toEl.value){
      toast("期間（開始/終了）は必須です");
      return false;
    }
    if(fromEl.value > toEl.value){
      toast("期間が逆です（開始 ≤ 終了）");
      return false;
    }
    return true;
  }

  function renderGroups(groups, filters){
    if(!groups || groups.length === 0){
      listEl.innerHTML = `<div class="note">該当データがありません（条件を変えて検索してください）</div>`;
      return;
    }

    const html = [];
    html.push(`<div class="note">検索条件： ${filters.from} ～ ${filters.to} / 拠点=${filters.base||"指定なし"} / 氏名=${filters.name||"指定なし"}</div>`);
    html.push(`<div class="histList">`);

    for(const g of groups){
      const days = new Set();
      g.tenko.forEach(t=>{
        const d = String(t.at||"").slice(0,10);
        if(d) days.add(d);
      });

      html.push(`
        <div class="histItem">
          <div class="histTop">
            <span class="badge"><span class="k">氏名</span>&nbsp;<span class="v">${g.name || "-"}</span></span>
            <span class="badge"><span class="k">拠点</span>&nbsp;<span class="v">${g.base || "-"}</span></span>
            <span class="badge"><span class="k">稼働日数</span>&nbsp;<span class="v">${days.size}日</span></span>
            <span class="badge"><span class="k">点呼</span>&nbsp;<span class="v">${g.tenko.length}件</span></span>
            <span class="badge"><span class="k">日報</span>&nbsp;<span class="v">${g.daily.length}件</span></span>
          </div>

          <div class="histMeta">
            <div><span class="k">期間：</span>${filters.from} ～ ${filters.to}</div>
            <div><span class="k">メモ：</span>月報は端末内の点呼/日報データから生成します</div>
          </div>
        </div>
      `);
    }

    html.push(`</div>`);
    listEl.innerHTML = html.join("");
  }

  // ====== Actions ======
  btnLogin?.addEventListener("click", ()=>{
    const input = (elPass.value || "").trim();
    const saved = getSavedPass();

    if(!input){
      toast("管理者パスを入力してください");
      return;
    }
    if(input !== saved){
      toast("管理者パスが違います");
      return;
    }
    setLoggedIn(true);
    elPass.value = "";
    toast("ログインしました");
    requireLoggedIn();
  });

  btnChange?.addEventListener("click", ()=>{
    const input = (elPass.value || "").trim();
    const saved = getSavedPass();

    if(!input){
      toast("現在の管理者パスを入力してください");
      return;
    }
    if(input !== saved){
      toast("現在の管理者パスが違います");
      return;
    }
    const next = prompt("新しい管理者パスを入力してください（8文字以上推奨）");
    if(!next) return;
    if(next.trim().length < 4){
      toast("短すぎます。もう少し長くしてください");
      return;
    }
    localStorage.setItem(PASS_KEY, next.trim());
    elPass.value = "";
    toast("管理者パスを変更しました（この端末で有効）");
  });

  btnSearch?.addEventListener("click", async ()=>{
    if(!requireLoggedIn()) return;
    if(!validateRange()) return;

    const filters = getFilters();
    try{
      const groups = await searchMonthly(filters); // db.js
      renderGroups(groups, filters);
      window.__OFA_MONTHLY_GROUPS__ = groups;
      window.__OFA_MONTHLY_FILTERS__ = filters;
      toast(`検索完了：${groups.length}件`);
    }catch(e){
      console.error(e);
      toast("検索に失敗しました（IndexedDBが初期化されていない可能性）");
    }
  });

  btnCsv?.addEventListener("click", async ()=>{
    if(!requireLoggedIn()) return;
    if(!validateRange()) return;

    const filters = getFilters();
    try{
      await exportCsvSearchResult(filters); // csv.js
      toast("CSVを出力しました（点呼/日報の2ファイル）");
    }catch(e){
      console.error(e);
      toast("CSV出力に失敗しました");
    }
  });

  btnPdf?.addEventListener("click", async ()=>{
    if(!requireLoggedIn()) return;
    if(!validateRange()) return;

    const filters = getFilters();
    try{
      const groups = window.__OFA_MONTHLY_GROUPS__ || await searchMonthly(filters);
      if(!groups || groups.length===0){
        toast("対象データがありません（先に検索してください）");
        return;
      }
      await generateMonthlyPdf(groups, filters); // pdf.js
      toast("月報PDFを作成しました");
    }catch(e){
      console.error(e);
      toast("月報PDF作成に失敗しました");
    }
  });

  // ====== init ======
  // 初期ログイン状態
  requireLoggedIn();

})();
