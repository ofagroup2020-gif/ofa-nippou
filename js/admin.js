// ==============================
// js/admin.js
// 管理者：ログイン / パス変更 / 期間検索 / 一覧表示 / CSV / 月報PDF
// 依存：db.js（searchMonthly/searchRecords 等）, csv.js（exportCsvSearchResult）, html2canvas+jsPDF（動的ロード）
// ==============================

(() => {
  // ---- DOM ----
  const $ = (id) => document.getElementById(id);

  const elPass        = $("a_pass");
  const btnLogin      = $("btnAdminLogin");
  const btnChangePass = $("btnChangePass");

  const adminPanel    = $("adminPanel");

  const elFrom   = $("m_from");
  const elTo     = $("m_to");
  const elBase   = $("m_base");
  const elName   = $("m_name");

  const btnSearch = $("btnMonthlySearch");
  const btnCsv    = $("btnMonthlyCsv");
  const btnPdf    = $("btnMonthlyPdf");

  const elList    = $("monthlyList");

  // ---- Admin Pass / Auth ----
  const ADMIN_PASS_KEY = "ofa_admin_pass_v1";     // localStorage
  const ADMIN_AUTH_KEY = "ofa_admin_authed_v1";   // sessionStorage（タブ閉じたら解除）

  const DEFAULT_PASS = "ofa-admin";

  function getSavedPass() {
    return localStorage.getItem(ADMIN_PASS_KEY) || DEFAULT_PASS;
  }
  function setSavedPass(pass) {
    localStorage.setItem(ADMIN_PASS_KEY, pass);
  }
  function isAuthed() {
    return sessionStorage.getItem(ADMIN_AUTH_KEY) === "1";
  }
  function setAuthed(v) {
    sessionStorage.setItem(ADMIN_AUTH_KEY, v ? "1" : "0");
  }

  function showAdminPanel() {
    adminPanel?.classList?.remove("hidden");
  }
  function hideAdminPanel() {
    adminPanel?.classList?.add("hidden");
  }

  // ---- Helpers ----
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

  function fmtYmd(v){
    return normalizeDate(v);
  }

  function calcGroupStats(group){
    // 稼働日数 / 走行距離（dep+arrのODO差がある日だけ）/ 点呼数 / 日報数
    const days = new Set();

    // date => {dep,arr}
    const byDate = new Map();

    for(const t of (group.tenko || [])){
      const d = fmtYmd(t.at);
      if(d) days.add(d);
      if(!byDate.has(d)) byDate.set(d, { dep:null, arr:null });
      if(t.type === "departure") byDate.get(d).dep = t;
      if(t.type === "arrival")   byDate.get(d).arr = t;
    }

    // 日報の日付も稼働日に含める（点呼が無い日報だけの日もカウントしたい場合）
    for(const d of (group.daily || [])){
      const y = fmtYmd(d.date);
      if(y) days.add(y);
    }

    let totalKm = 0;
    let kmDays = 0;

    for(const [d, pair] of byDate.entries()){
      const depOdo = pair.dep?.odoStart;
      const arrOdo = pair.arr?.odoEnd;

      if(depOdo && arrOdo){
        const diff = safeNum(arrOdo) - safeNum(depOdo);
        if(diff > 0){
          totalKm += diff;
          kmDays += 1;
        }
      }
    }

    return {
      days: days.size,
      tenkoCount: (group.tenko || []).length,
      dailyCount: (group.daily || []).length,
      totalKm,
      kmDays
    };
  }

  function mustDateRange(){
    const f = elFrom?.value;
    const t = elTo?.value;
    if(!f || !t){
      alert("期間（開始/終了）は必須です。");
      return false;
    }
    if(f > t){
      alert("期間が不正です（開始 > 終了）。");
      return false;
    }
    return true;
  }

  function getFilters(){
    return {
      from: elFrom?.value || "",
      to: elTo?.value || "",
      base: elBase?.value || "",
      name: elName?.value || ""
    };
  }

  // ---- Monthly State ----
  let lastGroups = [];
  let lastFilters = null;

  // ---- CSV (検索結果) ----
  async function runCsvExport(){
    if(!mustDateRange()) return;
    const filters = getFilters();
    // csv.js の exportCsvSearchResult を使用
    await exportCsvSearchResult(filters);
  }

  // ---- Monthly List Render ----
  function renderGroups(groups, filters){
    if(!elList) return;

    if(!groups || groups.length === 0){
      elList.innerHTML = `
        <div class="note" style="margin-top:12px">
          該当データがありません（条件を変えて検索してください）
        </div>
      `;
      return;
    }

    const head = `
      <div class="note" style="margin-top:10px">
        検索件数：<b>${groups.length}</b> グループ　
        （期間：${filters.from} ～ ${filters.to}）
      </div>
      <div class="divider"></div>
    `;

    const html = groups.map((g, idx) => {
      const s = calcGroupStats(g);
      return `
        <div class="card" style="margin-top:12px">
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap">
            <div>
              <div style="font-weight:900;font-size:16px">${g.name || "（氏名なし）"} / ${g.base || "（拠点なし）"}</div>
              <div class="small" style="margin-top:6px">
                稼働日数：<b>${s.days}</b>日　
                点呼：<b>${s.tenkoCount}</b>件　
                日報：<b>${s.dailyCount}</b>件　
                走行距離合計：<b>${s.totalKm}</b> km（計算できた日：${s.kmDays}日）
              </div>
            </div>

            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <button class="btn secondary" data-action="onePdf" data-idx="${idx}">個別PDF</button>
              <button class="btn secondary" data-action="oneCsv" data-idx="${idx}">個別CSV</button>
            </div>
          </div>

          <div class="divider"></div>

          <div class="small" style="color:#666">
            ※走行距離は「出発ODO」と「帰着ODO」が同日に揃っている場合のみ集計。
          </div>
        </div>
      `;
    }).join("");

    elList.innerHTML = head + html;

    // bind buttons
    elList.querySelectorAll("button[data-action]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const act = btn.dataset.action;
        const idx = Number(btn.dataset.idx);
        const g = groups[idx];
        if(!g) return;

        if(act === "onePdf"){
          await generateMonthlyPdfAll([g], filters, `OFA_月報_${filters.from}_${filters.to}_${(g.name||"no-name")}.pdf`);
        }
        if(act === "oneCsv"){
          await exportGroupCsv(g, filters);
        }
      });
    });
  }

  // ---- Monthly Search ----
  async function runMonthlySearch(){
    if(!mustDateRange()) return;

    const filters = getFilters();
    const groups = await searchMonthly(filters);

    // さらに（念のため）部分一致フィルタ（db側でもやってるがUI一致のため）
    const baseNeedle = filters.base;
    const nameNeedle = filters.name;

    const finalGroups = groups.filter(g => {
      if(!includesLike(g.base, baseNeedle)) return false;
      if(!includesLike(g.name, nameNeedle)) return false;
      return true;
    });

    lastGroups = finalGroups;
    lastFilters = filters;
    renderGroups(finalGroups, filters);
  }

  // ---- Monthly PDF (All) ----
  async function loadScriptOnce(src){
    if(document.querySelector(`script[data-src="${src}"]`)) return;
    await new Promise((resolve, reject)=>{
      const s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.dataset.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  async function ensurePdfLibs(){
    await loadScriptOnce("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js");
    await loadScriptOnce("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
  }

  function buildMonthlyPageHtml(group, filters){
    const headerGrad = `linear-gradient(90deg,#20d3c2,#4a90ff,#9b5cff,#ff4d8d)`;
    const s = calcGroupStats(group);

    // 点呼一覧（軽量版）
    const tenkoRows = (group.tenko || []).slice().sort((a,b)=> String(a.at||"").localeCompare(String(b.at||""))).map(t=>{
      const ymd = fmtYmd(t.at);
      const hm  = String(t.at||"").slice(11,16);
      const kind = (t.type==="departure") ? "出発" : "帰着";
      const odo = (t.type==="departure") ? (t.odoStart||"") : (t.odoEnd||"");
      return `
        <tr>
          <td class="td">${ymd}</td>
          <td class="td">${kind}</td>
          <td class="td">${hm}</td>
          <td class="td">${t.alcValue||""}</td>
          <td class="td">${odo}</td>
          <td class="td">${t.abnormal||""}</td>
        </tr>
      `;
    }).join("");

    // 日報一覧（任意）
    const dailyRows = (group.daily || []).slice().sort((a,b)=> String(a.date||"").localeCompare(String(b.date||""))).map(d=>{
      return `
        <tr>
          <td class="td">${fmtYmd(d.date)}</td>
          <td class="td">${d.mainProject||""}</td>
          <td class="td">${d.salesTotal||""}</td>
          <td class="td">${d.profit||""}</td>
        </tr>
      `;
    }).join("");

    return `
      <div id="ofaPdfRoot" style="width:794px;background:#fff;
        font-family:'Noto Sans JP',-apple-system,BlinkMacSystemFont,
        'Hiragino Kaku Gothic ProN','Helvetica Neue',Arial,sans-serif;
        color:#222;padding:18px">

        <style>
          .box{border-radius:18px;overflow:hidden;border:1px solid #e9eef5}
          .head{padding:14px;background:${headerGrad};color:#fff;display:flex;justify-content:space-between;align-items:center}
          .hL{font-weight:900;font-size:18px}
          .hR{font-weight:800;font-size:13px}
          .sec{padding:14px}
          .sum{margin-top:10px;border:1px solid #e9eef5;border-radius:14px;padding:12px;background:#f7fbff;font-size:13px}
          .t{width:100%;border-collapse:collapse;font-size:12px;margin-top:8px}
          .th{background:#f0fbff;border:1px solid #e9eef5;padding:8px;text-align:left}
          .td{border:1px solid #e9eef5;padding:8px}
          .cap{font-weight:900;margin-top:14px}
          .foot{margin-top:14px;border-top:1px solid #e9eef5;padding-top:10px;font-size:12px;color:#666;display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap}
        </style>

        <div class="box">
          <div class="head">
            <div class="hL">OFA GROUP</div>
            <div class="hR">月報（管理者）</div>
          </div>

          <div class="sec">
            <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap">
              <div style="font-weight:900;font-size:16px">${group.name||"（氏名なし）"} / ${group.base||"（拠点なし）"}</div>
              <div style="font-size:12px;color:#555">期間：${filters.from||""} ～ ${filters.to||""}</div>
            </div>

            <div class="sum">
              <div style="display:flex;gap:14px;flex-wrap:wrap">
                <div><b>稼働日数</b>：${s.days} 日</div>
                <div><b>走行距離合計</b>：${s.totalKm} km</div>
                <div><b>点呼件数</b>：${s.tenkoCount}</div>
                <div><b>日報件数</b>：${s.dailyCount}</div>
              </div>
              <div style="margin-top:6px;color:#666;font-size:12px">
                ※走行距離は「出発ODO」と「帰着ODO」が同日に揃っている場合のみ集計
              </div>
            </div>

            <div class="cap">点呼一覧</div>
            <table class="t">
              <tr>
                <th class="th">日付</th>
                <th class="th">区分</th>
                <th class="th">時刻</th>
                <th class="th">アルコール</th>
                <th class="th">ODO</th>
                <th class="th">異常</th>
              </tr>
              ${tenkoRows || `<tr><td class="td" colspan="6">該当なし</td></tr>`}
            </table>

            <div class="cap">日報（任意・入力がある場合のみ）</div>
            <table class="t">
              <tr>
                <th class="th">日付</th>
                <th class="th">案件</th>
                <th class="th">売上合計</th>
                <th class="th">差引</th>
              </tr>
              ${dailyRows || `<tr><td class="td" colspan="4">該当なし（オプション）</td></tr>`}
            </table>

            <div class="foot">
              <div>© OFA GROUP</div>
              <div>※端末内データ（IndexedDB）から月報生成</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  async function generateMonthlyPdfAll(groups, filters, filename){
    if(!groups || groups.length === 0){
      alert("月報PDF：対象データがありません。");
      return;
    }

    await ensurePdfLibs();

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF("p","pt","a4");

    let first = true;

    for(const g of groups){
      if(!first) pdf.addPage();
      first = false;

      const holder = document.createElement("div");
      holder.style.position = "fixed";
      holder.style.left = "-10000px";
      holder.style.top = "0";
      holder.innerHTML = buildMonthlyPageHtml(g, filters);
      document.body.appendChild(holder);

      const root = holder.querySelector("#ofaPdfRoot");
      const canvas = await html2canvas(root, { scale:2, backgroundColor:"#ffffff" });
      const img = canvas.toDataURL("image/png");

      const pageW = 595;
      const pageH = 842;
      const imgW = pageW;
      const imgH = (canvas.height * imgW) / canvas.width;

      if(imgH <= pageH){
        pdf.addImage(img, "PNG", 0, 0, imgW, imgH);
      }else{
        // 分割（長い場合）
        let remain = imgH;
        let pos = 0;
        while(remain > 0){
          pdf.addImage(img, "PNG", 0, pos, imgW, imgH);
          remain -= pageH;
          pos -= pageH;
          if(remain > 0) pdf.addPage();
        }
      }

      document.body.removeChild(holder);
    }

    pdf.save(filename || `OFA_月報_${filters.from||""}_${filters.to||""}.pdf`);
  }

  // ---- Group CSV (軽量) ----
  // 検索結果CSVは exportCsvSearchResult が出すが、
  // 個別ボタン用に「この人だけ」のCSVも作れるようにする
  function csvEscape(v){
    const s = String(v ?? "");
    if(/[",\n]/.test(s)) return `"${s.replace(/"/g,'""')}"`;
    return s;
  }
  function downloadText(filename, text){
    const blob = new Blob([text], {type:"text/csv;charset=utf-8"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function exportGroupCsv(group, filters){
    const tenko = group.tenko || [];
    const daily = group.daily || [];

    // 点呼CSV（簡易）
    const tenkoHeader = ["種別","氏名","拠点","区分","日時","アルコール","ODO","異常","異常内容"];
    const tenkoLines = [tenkoHeader.map(csvEscape).join(",")];
    for(const t of tenko){
      tenkoLines.push([
        "点呼",
        group.name || "",
        group.base || "",
        t.type==="departure"?"出発":"帰着",
        t.at || "",
        t.alcValue || "",
        t.type==="departure" ? (t.odoStart||"") : (t.odoEnd||""),
        t.abnormal || "",
        t.abnormalDetail || ""
      ].map(csvEscape).join(","));
    }

    // 日報CSV（簡易・任意）
    const dailyHeader = ["種別","氏名","拠点","日付","案件","売上合計","差引","メモ"];
    const dailyLines = [dailyHeader.map(csvEscape).join(",")];
    for(const d of daily){
      dailyLines.push([
        "日報",
        group.name || "",
        group.base || "",
        d.date || "",
        d.mainProject || "",
        d.salesTotal || "",
        d.profit || "",
        d.memo || ""
      ].map(csvEscape).join(","));
    }

    const key = `${filters.from||"all"}_${filters.to||"all"}_${group.name||"no-name"}`;
    downloadText(`OFA_個別_点呼_${key}.csv`, tenkoLines.join("\n"));
    downloadText(`OFA_個別_日報_${key}.csv`, dailyLines.join("\n"));
  }

  // ---- Events ----
  async function onLogin(){
    const input = (elPass?.value || "").trim();
    const pass = getSavedPass();

    if(!input){
      alert("管理者パスを入力してください。");
      return;
    }
    if(input !== pass){
      alert("管理者パスが違います");
      return;
    }

    setAuthed(true);
    showAdminPanel();
    alert("管理者ログインOK");
  }

  async function onChangePass(){
    // 変更は「現在パス一致」を必須にする
    const current = prompt("現在の管理者パスを入力してください");
    if(current === null) return;

    const saved = getSavedPass();
    if(String(current) !== String(saved)){
      alert("現在パスが違います");
      return;
    }

    const next1 = prompt("新しい管理者パスを入力してください（4文字以上推奨）");
    if(next1 === null) return;
    if(String(next1).trim().length < 4){
      alert("短すぎます（4文字以上推奨）");
      return;
    }

    const next2 = prompt("確認：もう一度入力してください");
    if(next2 === null) return;

    if(String(next1) !== String(next2)){
      alert("一致しません");
      return;
    }

    setSavedPass(String(next1).trim());
    alert("管理者パスを変更しました");
  }

  async function onMonthlyPdf(){
    if(!lastFilters || !lastGroups || lastGroups.length === 0){
      alert("先に検索してください。");
      return;
    }
    await generateMonthlyPdfAll(lastGroups, lastFilters, `OFA_月報_${lastFilters.from}_${lastFilters.to}.pdf`);
  }

  // ---- Init ----
  function init(){
    // すでにログイン済みなら開く
    if(isAuthed()){
      showAdminPanel();
    }else{
      hideAdminPanel();
    }

    btnLogin?.addEventListener("click", onLogin);
    btnChangePass?.addEventListener("click", onChangePass);

    btnSearch?.addEventListener("click", runMonthlySearch);
    btnCsv?.addEventListener("click", runCsvExport);
    btnPdf?.addEventListener("click", onMonthlyPdf);

    // 便利：Enterでログイン
    elPass?.addEventListener("keydown", (e)=>{
      if(e.key === "Enter") onLogin();
    });
  }

  init();

})();
