// js/daily.js
// 日報（任意入力）＋複数案件（追加式）＋IndexedDB保存＋履歴表示＋CSV
// 前提：js/db.js（idbPut/idbGet/searchRecords 等）と js/csv.js（buildDailyCsv/downloadText）が読み込まれていること

(function(){
  const $ = (id)=> document.getElementById(id);

  // -------------------------
  // 画面に依存するID一覧（index.html側に存在している前提）
  // -------------------------
  // 日報の基本
  //  daily_date        : date
  //  daily_mainProject : text
  //  daily_workStart   : time or text
  //  daily_workEnd     : time or text
  //  daily_breakMin    : number
  //  daily_delivery    : number
  //  daily_absent      : number
  //  daily_redelivery  : number
  //  daily_return      : number
  //  daily_claim       : select (なし/あり)
  //  daily_claimDetail : textarea
  //  daily_accident    : select (なし/あり)
  //  daily_accDetail   : textarea
  //  daily_delay       : select (なし/渋滞/積込遅れ/体調/その他)
  //  daily_delayDetail : textarea
  //  daily_tomorrow    : select (あり/なし)
  //  daily_memo        : textarea
  //
  // 売上（任意）
  //  pay_base, pay_incentive, cost_fuel, cost_highway, cost_parking, cost_other
  //
  // 複数案件
  //  projectsWrap（表示領域）
  //  btnAddProject（追加ボタン）
  //
  // 操作ボタン
  //  btnDailySave
  //  btnDailyPdf (PDFは別で担当：pdf.js へ渡すだけ)
  //  btnDailyCsv
  //  dailyHistoryList（履歴表示）
  //
  // 依存：プロフィール（STORE_PROFILE）を読み、名前/拠点などを自動で埋める
  // -------------------------

  const PROJECT_TEMPLATE = () => ({
    project: "",
    area: "",
    start: "",
    end: "",
    count: "",
    memo: ""
  });

  let projects = [ PROJECT_TEMPLATE() ];
  let lastSavedDaily = null;

  // -------------------------
  // util
  // -------------------------
  function toast(msg){
    const t = $("toast");
    if(!t){ alert(msg); return; }
    t.textContent = msg;
    t.style.display = "block";
    clearTimeout(toast._tm);
    toast._tm = setTimeout(()=> t.style.display="none", 2400);
  }

  function n(v){
    const x = Number(v);
    return Number.isFinite(x) ? x : 0;
  }

  function normDate(v){
    return (v||"").toString().slice(0,10);
  }

  function todayStr(){
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,"0");
    const dd = String(d.getDate()).padStart(2,"0");
    return `${y}-${m}-${dd}`;
  }

  function safeStr(v){
    return (v===null || v===undefined) ? "" : String(v);
  }

  // -------------------------
  // profile
  // -------------------------
  async function loadProfile(){
    try{
      const p = await idbGet("profile", "me");
      return p || null;
    }catch(e){
      console.error(e);
      return null;
    }
  }

  // -------------------------
  // projects UI
  // -------------------------
  function renderProjects(){
    const wrap = $("projectsWrap");
    if(!wrap) return;

    wrap.innerHTML = projects.map((p, idx)=>{
      return `
        <div class="projectCard" data-idx="${idx}">
          <div class="projectHead">
            <div class="projectTitle">案件 ${idx+1}</div>
            <button type="button" class="miniBtn danger" data-act="del" ${projects.length<=1 ? "disabled":""}>削除</button>
          </div>

          <label>案件名（任意）</label>
          <input data-k="project" value="${safeStr(p.project)}" placeholder="例：Amazon / ヤマト / スポット">

          <label>エリア（任意）</label>
          <input data-k="area" value="${safeStr(p.area)}" placeholder="例：鹿児島市">

          <div class="row2">
            <div>
              <label>開始（任意）</label>
              <input data-k="start" value="${safeStr(p.start)}" placeholder="例：08:00">
            </div>
            <div>
              <label>終了（任意）</label>
              <input data-k="end" value="${safeStr(p.end)}" placeholder="例：21:00">
            </div>
          </div>

          <label>配達個数（任意）</label>
          <input data-k="count" value="${safeStr(p.count)}" inputmode="numeric" placeholder="例：180">

          <label>メモ（任意）</label>
          <textarea data-k="memo" placeholder="引継ぎ・注意点など">${safeStr(p.memo)}</textarea>
        </div>
      `;
    }).join("");

    // bind events
    wrap.querySelectorAll(".projectCard").forEach(card=>{
      const idx = Number(card.dataset.idx);

      card.querySelectorAll("input[data-k], textarea[data-k]").forEach(el=>{
        el.addEventListener("input", ()=>{
          const k = el.dataset.k;
          projects[idx][k] = el.value;
        });
      });

      const delBtn = card.querySelector('button[data-act="del"]');
      if(delBtn){
        delBtn.addEventListener("click", ()=>{
          if(projects.length<=1) return;
          projects.splice(idx,1);
          renderProjects();
        });
      }
    });
  }

  function addProject(){
    projects.push(PROJECT_TEMPLATE());
    renderProjects();
    toast("案件を追加しました");
  }

  // -------------------------
  // read form
  // -------------------------
  function readDailyForm(){
    const daily = {
      date: normDate($("daily_date")?.value || ""),
      mainProject: safeStr($("daily_mainProject")?.value || ""),
      workStart: safeStr($("daily_workStart")?.value || ""),
      workEnd: safeStr($("daily_workEnd")?.value || ""),
      breakMin: n($("daily_breakMin")?.value || 0),

      deliveryCount: n($("daily_delivery")?.value || 0),
      absentCount: n($("daily_absent")?.value || 0),
      redeliveryCount: n($("daily_redelivery")?.value || 0),
      returnCount: n($("daily_return")?.value || 0),

      claim: safeStr($("daily_claim")?.value || ""),
      claimDetail: safeStr($("daily_claimDetail")?.value || ""),

      accident: safeStr($("daily_accident")?.value || ""),
      accidentDetail: safeStr($("daily_accDetail")?.value || ""),

      delay: safeStr($("daily_delay")?.value || ""),
      delayDetail: safeStr($("daily_delayDetail")?.value || ""),

      tomorrow: safeStr($("daily_tomorrow")?.value || ""),
      memo: safeStr($("daily_memo")?.value || ""),

      // optional money
      payBase: n($("pay_base")?.value || 0),
      incentive: n($("pay_incentive")?.value || 0),
      fuel: n($("cost_fuel")?.value || 0),
      highway: n($("cost_highway")?.value || 0),
      parking: n($("cost_parking")?.value || 0),
      otherCost: n($("cost_other")?.value || 0),

      // multi projects
      projects: projects.map(p => ({
        project: safeStr(p.project),
        area: safeStr(p.area),
        start: safeStr(p.start),
        end: safeStr(p.end),
        count: safeStr(p.count),
        memo: safeStr(p.memo)
      }))
    };

    // auto totals (optional)
    daily.salesTotal = daily.payBase + daily.incentive;
    daily.costTotal  = daily.fuel + daily.highway + daily.parking + daily.otherCost;
    daily.profit     = daily.salesTotal - daily.costTotal;

    return daily;
  }

  function validateDaily(daily){
    // 日報は「任意入力」を守る：最低限 date だけ必須にする（履歴の軸）
    if(!daily.date){
      toast("日報の稼働日（date）は必須です");
      return false;
    }
    // 他は任意（入力されていれば使う）
    return true;
  }

  // -------------------------
  // save daily
  // -------------------------
  async function saveDaily(){
    const profile = await loadProfile();
    if(!profile){
      toast("基本情報が未保存です。先に基本情報を保存してください。");
      return;
    }

    const daily = readDailyForm();
    if(!validateDaily(daily)) return;

    // 走行距離は tenko（出発/帰着）から拾う
    // 同日ペアがあれば odoDiff を反映（無ければ 0）
    let odoDiff = 0;
    try{
      const { tenkoHit } = await searchRecords({
        from: daily.date,
        to: daily.date,
        base: profile.base || "",
        name: profile.name || ""
      });

      // 同日で dep/arr を探す
      const dep = tenkoHit.find(t => t.type==="departure" && normDate(t.at)===daily.date);
      const arr = tenkoHit.find(t => t.type==="arrival" && normDate(t.at)===daily.date);
      if(dep && arr){
        const d = n(arr.odoEnd) - n(dep.odoStart);
        if(Number.isFinite(d) && d>0) odoDiff = d;
      }
    }catch(e){
      console.warn("odoDiff resolve failed", e);
    }

    const id = `${daily.date}_${profile.name}_${profile.base}`; // 1日1件のキー（上書き運用）
    const record = {
      id,
      uid: profile.uid || "",
      name: profile.name || "",
      base: profile.base || "",
      date: daily.date,

      mainProject: daily.mainProject,
      workStart: daily.workStart,
      workEnd: daily.workEnd,
      breakMin: daily.breakMin,

      deliveryCount: daily.deliveryCount,
      absentCount: daily.absentCount,
      redeliveryCount: daily.redeliveryCount,
      returnCount: daily.returnCount,

      claim: daily.claim,
      claimDetail: daily.claimDetail,

      accident: daily.accident,
      accidentDetail: daily.accidentDetail,

      delay: daily.delay,
      delayDetail: daily.delayDetail,

      tomorrow: daily.tomorrow,
      memo: daily.memo,

      // optional money
      payBase: daily.payBase,
      incentive: daily.incentive,
      fuel: daily.fuel,
      highway: daily.highway,
      parking: daily.parking,
      otherCost: daily.otherCost,
      salesTotal: daily.salesTotal,
      costTotal: daily.costTotal,
      profit: daily.profit,

      // auto from tenko
      odoDiff,

      // multi projects
      projects: daily.projects,

      updatedAt: new Date().toISOString()
    };

    try{
      await idbPut("daily", record);
      lastSavedDaily = record;
      toast("日報を保存しました（IndexedDB）");
      await refreshDailyHistory(); // 自分の履歴を更新
    }catch(e){
      console.error(e);
      toast("保存に失敗しました： " + (e?.message || e));
    }
  }

  // -------------------------
  // history list
  // -------------------------
  function renderDailyHistory(rows){
    const box = $("dailyHistoryList");
    if(!box) return;

    if(!rows || rows.length === 0){
      box.innerHTML = `<div class="note">日報の履歴がありません</div>`;
      return;
    }

    box.innerHTML = rows.map(r=>{
      const p = r.mainProject ? ` / ${r.mainProject}` : "";
      const km = r.odoDiff ? ` / ${r.odoDiff}km` : "";
      return `
        <div class="histItem">
          <div class="histTop">
            <div class="histDate">${r.date}${p}${km}</div>
            <button class="miniBtn" data-act="load" data-id="${r.id}">呼出</button>
          </div>
          <div class="histSub">
            配達:${n(r.deliveryCount)} / 不在:${n(r.absentCount)} / 再配:${n(r.redeliveryCount)}
          </div>
        </div>
      `;
    }).join("");

    box.querySelectorAll('button[data-act="load"]').forEach(btn=>{
      btn.addEventListener("click", async ()=>{
        const id = btn.dataset.id;
        await loadDailyToForm(id);
      });
    });
  }

  async function refreshDailyHistory(){
    const profile = await loadProfile();
    if(!profile) return;

    try{
      const { dailyHit } = await searchRecords({
        from: "",
        to: "",
        base: profile.base || "",
        name: profile.name || ""
      });

      // 自分だけに絞る（念のため）
      const mine = (dailyHit || []).filter(d => d.name===profile.name && d.base===profile.base)
                                  .sort((a,b)=> String(b.date).localeCompare(String(a.date)))
                                  .slice(0, 120); // 多すぎ表示を防ぐ（DB自体は1000件超OK）

      renderDailyHistory(mine);
    }catch(e){
      console.error(e);
      renderDailyHistory([]);
    }
  }

  // -------------------------
  // load to form
  // -------------------------
  async function loadDailyToForm(id){
    try{
      const r = await idbGet("daily", id);
      if(!r){ toast("データが見つかりません"); return; }

      $("daily_date") && ($("daily_date").value = r.date || "");
      $("daily_mainProject") && ($("daily_mainProject").value = r.mainProject || "");
      $("daily_workStart") && ($("daily_workStart").value = r.workStart || "");
      $("daily_workEnd") && ($("daily_workEnd").value = r.workEnd || "");
      $("daily_breakMin") && ($("daily_breakMin").value = r.breakMin ?? "");

      $("daily_delivery") && ($("daily_delivery").value = r.deliveryCount ?? "");
      $("daily_absent") && ($("daily_absent").value = r.absentCount ?? "");
      $("daily_redelivery") && ($("daily_redelivery").value = r.redeliveryCount ?? "");
      $("daily_return") && ($("daily_return").value = r.returnCount ?? "");

      $("daily_claim") && ($("daily_claim").value = r.claim || "");
      $("daily_claimDetail") && ($("daily_claimDetail").value = r.claimDetail || "");

      $("daily_accident") && ($("daily_accident").value = r.accident || "");
      $("daily_accDetail") && ($("daily_accDetail").value = r.accidentDetail || "");

      $("daily_delay") && ($("daily_delay").value = r.delay || "");
      $("daily_delayDetail") && ($("daily_delayDetail").value = r.delayDetail || "");

      $("daily_tomorrow") && ($("daily_tomorrow").value = r.tomorrow || "");
      $("daily_memo") && ($("daily_memo").value = r.memo || "");

      // optional money
      $("pay_base") && ($("pay_base").value = r.payBase ?? "");
      $("pay_incentive") && ($("pay_incentive").value = r.incentive ?? "");
      $("cost_fuel") && ($("cost_fuel").value = r.fuel ?? "");
      $("cost_highway") && ($("cost_highway").value = r.highway ?? "");
      $("cost_parking") && ($("cost_parking").value = r.parking ?? "");
      $("cost_other") && ($("cost_other").value = r.otherCost ?? "");

      // projects
      projects = Array.isArray(r.projects) && r.projects.length ? r.projects.map(p=>({
        project: safeStr(p.project),
        area: safeStr(p.area),
        start: safeStr(p.start),
        end: safeStr(p.end),
        count: safeStr(p.count),
        memo: safeStr(p.memo),
      })) : [ PROJECT_TEMPLATE() ];

      renderProjects();
      toast("日報を呼び出しました");
    }catch(e){
      console.error(e);
      toast("呼出に失敗： " + (e?.message || e));
    }
  }

  // -------------------------
  // CSV export (自分の検索結果)
  // -------------------------
  async function exportMyDailyCsv(){
    const profile = await loadProfile();
    if(!profile){
      toast("基本情報が未保存です");
      return;
    }
    try{
      const { dailyHit } = await searchRecords({
        from: "", to: "",
        base: profile.base || "",
        name: profile.name || ""
      });
      const mine = (dailyHit||[]).filter(d => d.name===profile.name && d.base===profile.base)
                                .sort((a,b)=> String(a.date).localeCompare(String(b.date)));

      const csv = buildDailyCsv(mine);
      const key = `${profile.name}_${profile.base}`;
      downloadText(`OFA_日報_${key}.csv`, csv);
      toast("日報CSVを出力しました");
    }catch(e){
      console.error(e);
      toast("CSV出力に失敗： " + (e?.message || e));
    }
  }

  // -------------------------
  // init
  // -------------------------
  async function init(){
    // 1) プロジェクト表示初期化
    renderProjects();

    // 2) 初期日付を今日に（入力が空なら）
    if($("daily_date") && !$("daily_date").value){
      $("daily_date").value = todayStr();
    }

    // 3) ボタン
    $("btnAddProject") && $("btnAddProject").addEventListener("click", addProject);
    $("btnDailySave") && $("btnDailySave").addEventListener("click", saveDaily);
    $("btnDailyCsv")  && $("btnDailyCsv").addEventListener("click", exportMyDailyCsv);

    // PDFは pdf.js 側の generateTodayPdf を呼べるなら連携（ここでは「渡すだけ」）
    $("btnDailyPdf") && $("btnDailyPdf").addEventListener("click", async ()=>{
      try{
        const profile = await loadProfile();
        if(!profile){ toast("基本情報が未保存です"); return; }

        // 日報は保存しなくてもPDF出せる。保存したい人は保存ボタンを押す運用。
        const dailyForm = readDailyForm();
        if(!dailyForm.date){ toast("稼働日（date）は必須です"); return; }

        // 同日点呼ペアから odoDiff を取る（無ければ0）
        let odoDiff = 0, dep=null, arr=null;
        try{
          const { tenkoHit } = await searchRecords({
            from: dailyForm.date,
            to: dailyForm.date,
            base: profile.base || "",
            name: profile.name || ""
          });
          dep = tenkoHit.find(t => t.type==="departure" && normDate(t.at)===dailyForm.date) || null;
          arr = tenkoHit.find(t => t.type==="arrival" && normDate(t.at)===dailyForm.date) || null;
          if(dep && arr){
            const d = n(arr.odoEnd) - n(dep.odoStart);
            if(Number.isFinite(d) && d>0) odoDiff = d;
          }
        }catch(e){}

        // 画像ファイルは日報のみ（あなたの仕様）：reportPhotos があれば拾う
        // PDF側が受け取る設計にしておく（無ければ空でOK）
        const reportPhotos = $("daily_photos") ? $("daily_photos").files : null;

        // generateTodayPdf は pdf.js で定義済みの想定
        if(typeof generateTodayPdf !== "function"){
          toast("PDFライブラリが未読み込みです（js/pdf.js を確認）");
          return;
        }

        await generateTodayPdf({
          profile,
          dep,
          arr,
          daily: {
            date: dailyForm.date,
            mainProject: dailyForm.mainProject,
            memo: dailyForm.memo,
            salesTotal: dailyForm.salesTotal,
            profit: dailyForm.profit,
            // projectsはPDF側で表示可能
            projects: dailyForm.projects,
            // 任意項目（必要ならPDF側で追加表示できる）
            workStart: dailyForm.workStart,
            workEnd: dailyForm.workEnd,
            breakMin: dailyForm.breakMin,
            deliveryCount: dailyForm.deliveryCount,
            absentCount: dailyForm.absentCount,
            redeliveryCount: dailyForm.redeliveryCount,
            returnCount: dailyForm.returnCount,
            claim: dailyForm.claim,
            claimDetail: dailyForm.claimDetail,
            accident: dailyForm.accident,
            accidentDetail: dailyForm.accidentDetail,
            delay: dailyForm.delay,
            delayDetail: dailyForm.delayDetail,
            tomorrow: dailyForm.tomorrow
          },
          odoDiff,
          files: {
            // pdf.js 側は licenseImg / alcDepImg / alcArrImg を想定していたが、
            // 日報写真のみ運用なら pdf.js を後で合わせる（次のファイルで対応する）
            reportPhotos: reportPhotos ? Array.from(reportPhotos) : []
          }
        });

        toast("PDFを作成しました");
      }catch(e){
        console.error(e);
        toast("PDF作成に失敗： " + (e?.message || e));
      }
    });

    // 4) 履歴表示
    await refreshDailyHistory();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
