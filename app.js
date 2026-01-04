// app.js
(function(){
  const CFG = window.OFA_CFG;

  const $ = (id)=>document.getElementById(id);

  function toast(msg, ok=false){
    const el = $("toast");
    if(!el){ alert(msg); return; }
    el.textContent = msg;
    el.className = "toast " + (ok ? "ok":"ng");
    el.style.display = "block";
    setTimeout(()=> el.style.display="none", 2400);
  }

  function ymd(d=new Date()){
    const y=d.getFullYear();
    const m=String(d.getMonth()+1).padStart(2,"0");
    const dd=String(d.getDate()).padStart(2,"0");
    return `${y}-${m}-${dd}`;
  }
  function hm(d=new Date()){
    const h=String(d.getHours()).padStart(2,"0");
    const m=String(d.getMinutes()).padStart(2,"0");
    return `${h}:${m}`;
  }

  function clearInvalid(){
    document.querySelectorAll(".invalid").forEach(el=>el.classList.remove("invalid"));
  }

  function markInvalid(el){
    if(el) el.classList.add("invalid");
  }

  function must(id, label){
    const el = $(id);
    const v = (el && "value" in el) ? String(el.value||"").trim() : "";
    if(!v){
      markInvalid(el);
      throw new Error(`未入力：${label}`);
    }
    return v;
  }

  function opt(id){
    const el=$(id);
    return el ? String(el.value||"").trim() : "";
  }

  async function fileToCompressedDataURL(file, maxW=1280, quality=0.75){
    if(!file) return null;
    if(!file.type || !file.type.startsWith("image/")) return null;

    const {im,url} = await new Promise((resolve,reject)=>{
      const u=URL.createObjectURL(file);
      const img=new Image();
      img.onload=()=>resolve({im:img,url:u});
      img.onerror=reject;
      img.src=u;
    });

    const w=im.naturalWidth||im.width, h=im.naturalHeight||im.height;
    const scale=Math.min(1, maxW/w);
    const cw=Math.round(w*scale), ch=Math.round(h*scale);

    const canvas=document.createElement("canvas");
    canvas.width=cw; canvas.height=ch;
    const ctx=canvas.getContext("2d");
    ctx.drawImage(im,0,0,cw,ch);
    URL.revokeObjectURL(url);

    return canvas.toDataURL("image/jpeg", quality);
  }

  async function collectFilesAsDataURLs(inputId){
    const el=$(inputId);
    if(!el || !el.files || !el.files.length) return [];
    const files=Array.from(el.files);
    const out=[];
    for(const f of files){
      const du=await fileToCompressedDataURL(f, 1280, 0.75);
      if(du) out.push(du);
    }
    return out;
  }

  function calcOdo(){
    const s = Number(opt("odoStart")||"");
    const e = Number(opt("odoEnd")||"");
    if(Number.isFinite(s) && Number.isFinite(e)){
      const t = Math.max(0, e - s);
      const el = $("odoTotal");
      if(el) el.value = String(t);
    }
  }

  function collectInspection(){
    const ids = [
      "insp_tire","insp_light","insp_brake","insp_wiper","insp_engineOil","insp_coolant",
      "insp_battery","insp_horn","insp_mirror","insp_damage","insp_cargo","insp_extinguisher","insp_triangle"
    ];
    const obj = {};
    ids.forEach(id=> obj[id] = opt(id));
    obj.note = opt("insp_note");
    return obj;
  }

  // ✅ 点呼項目（点検とは別に増やす）
  function collectTenkoItems(page){
    // page: "departure" | "arrival"
    const obj = {
      driverPhone: opt("driverPhone"),
      condition: opt("condition"),
      temperature: opt("temperature"),
      // 出発：睡眠 / 帰着：休憩
      sleepHours: (page==="departure") ? opt("sleepHours") : "",
      restMinutes: (page==="arrival") ? opt("restMinutes") : "",
      // 共通：体調・指示・連絡
      healthNote: opt("healthNote")
    };
    return obj;
  }

  function setLoginBadge(){
    const st = window.OFA_AUTH.sessionType();
    const badge = $("badgeMode");
    const loginState = $("loginState");
    if(loginState){
      loginState.textContent = (st==="admin") ? "管理者モード（全データ操作可）" : "ドライバーモード（本人データのみ）";
    }
    if(badge){
      badge.textContent = (st==="admin") ? "管理者" : "ドライバー";
      badge.classList.toggle("admin", st==="admin");
    }
  }

  async function postJsonReliable(payload){
    const url = CFG.GAS_WEBAPP_URL;

    // 1) fetch（text/plainでプリフライト回避）
    try{
      const res = await fetch(url, {
        method:"POST",
        headers: { "Content-Type":"text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
        cache:"no-store"
      });
      const json = await res.json().catch(()=>null);
      if(!json || !json.ok){
        throw new Error(json?.message || "送信に失敗しました");
      }
      return json;
    }catch(e){
      // 2) sendBeacon fallback（レスポンスは読めないが、送信成功率が高い）
      try{
        if(navigator.sendBeacon){
          const blob = new Blob([JSON.stringify(payload)], {type:"text/plain;charset=utf-8"});
          const ok = navigator.sendBeacon(url, blob);
          if(ok){
            return { ok:true, beacon:true };
          }
        }
      }catch(_){}
      throw e;
    }
  }

  async function submitTenko(mode){
    clearInvalid();

    const page = (mode==="departure") ? "departure" : "arrival";

    // 必須
    const date = must("date","日付");
    const time = must("time","時刻");
    const driverName = must("driverName","運転者氏名（本名）");
    const vehicleNo = must("vehicleNo","車両番号/ナンバー");
    const managerName = must("managerName","点呼実施者");
    const method = must("method","点呼方法");
    const place = must("place","点呼場所");
    const alcoholValue = must("alcoholValue","アルコール測定値");
    const alcoholBand = must("alcoholBand","酒気帯び");
    const licenseNo = must("licenseNo","免許証番号");

    // 追加必須：出発は睡眠、帰着は休憩
    if(page==="departure"){
      must("sleepHours","睡眠時間");
    }else{
      must("restMinutes","休憩時間（分）");
    }
    must("condition","体調");
    // temperature は任意にしておく（現場で拒否られやすいので）
    // 点検は全部必須
    const inspIds = ["insp_tire","insp_light","insp_brake","insp_wiper","insp_engineOil","insp_coolant",
      "insp_battery","insp_horn","insp_mirror","insp_damage","insp_cargo","insp_extinguisher","insp_triangle"];
    inspIds.forEach(id=> must(id, `点検:${id}`));

    // 帰着のみ：日報必須（最低限）
    let workType="", workArea="", workHours="", dailyNote="";
    if(page==="arrival"){
      workType = must("workType","業務内容");
      workArea = must("workArea","配送エリア");
      workHours = must("workHours","稼働時間");
      dailyNote = opt("dailyNote"); // 長文は任意（でも推奨）
    }

    const memo = opt("memo");
    const odoStart = opt("odoStart");
    const odoEnd = opt("odoEnd");
    const odoTotal = opt("odoTotal");

    const tenkoItems = collectTenkoItems(page);
    const inspection = collectInspection();

    // 写真（任意）
    const tenkoPhotos = await collectFilesAsDataURLs("tenkoPhotos");
    const reportPhotos = await collectFilesAsDataURLs("reportPhotos"); // 日報写真（任意）
    const licensePhotos = await collectFilesAsDataURLs("licensePhotos"); // 任意
    const abnormalPhotos = await collectFilesAsDataURLs("abnormalPhotos"); // 異常箇所（任意）
    const alcoholPhotos = await collectFilesAsDataURLs("alcoholPhotos"); // アルコール指標写真（任意）

    const payload = {
      app: CFG.APP_KEY,
      auth: window.OFA_AUTH.authToken(),   // ✅ GAS側でも照合
      role: window.OFA_AUTH.sessionType(), // driver/admin
      mode,
      data: {
        date, time,
        driverName,
        driverPhone: tenkoItems.driverPhone,
        vehicleNo,
        managerName,
        method,
        place,
        alcoholValue,
        alcoholBand,
        memo,

        licenseNo,

        odoStart, odoEnd, odoTotal,

        tenkoItems,     // ✅ 点呼項目（増やした）
        inspection,     // ✅ 点検

        // 日報（帰着）
        workType,
        workArea,
        workHours,
        deliveryCount: opt("deliveryCount"),
        trouble: opt("trouble"),
        dailyNote
      },
      photos: {
        tenkoPhotos,
        alcoholPhotos,
        abnormalPhotos,
        reportPhotos,
        licensePhotos
      }
    };

    const btn = $("btnSubmit");
    if(btn) btn.disabled = true;

    toast("送信中…", true);

    try{
      const json = await postJsonReliable(payload);
      if(json.beacon){
        toast("送信しました（通信状況により反映に数秒かかる場合あり）", true);
      }else{
        toast("送信OK（保存完了）", true);
      }
      setTimeout(()=> location.href="./index.html", 650);
    }catch(err){
      toast(err?.message || String(err), false);
      if(btn) btn.disabled = false;
    }
  }

  // ====== 出力（PDF/CSV/履歴） ======
  function buildUrl(action, params){
    const u = new URL(CFG.GAS_WEBAPP_URL);
    u.searchParams.set("action", action);
    u.searchParams.set("auth", window.OFA_AUTH.authToken());
    // ドライバーは本人縛り（name+vehicle）
    Object.entries(params||{}).forEach(([k,v])=>{
      if(v!==undefined && v!==null && String(v).trim()!==""){
        u.searchParams.set(k, String(v).trim());
      }
    });
    return u.toString();
  }

  async function callApi(action, params){
    const url = buildUrl(action, params);
    const res = await fetch(url, {method:"GET", cache:"no-store"});
    const json = await res.json().catch(()=>null);
    if(!json || !json.ok){
      throw new Error(json?.message || "出力に失敗しました");
    }
    return json;
  }

  function showResult(url,label){
    const box = $("resultBox");
    if(!box) return;
    box.style.display = "block";
    box.innerHTML = `
      <div style="font-weight:900;margin-bottom:8px;">${label}</div>
      <div style="font-size:12px;color:#4b5563;word-break:break-all;margin-bottom:10px;">
        <a href="${url}" target="_blank" rel="noopener">${url}</a>
      </div>
      <div class="btnrow">
        <button class="btn small primary" type="button" onclick="window.open('${url}','_blank')">開く</button>
        <button class="btn small" type="button" onclick="navigator.clipboard.writeText('${url}');">コピー</button>
      </div>
    `;
  }

  async function runExportDaily(){
    clearInvalid();

    const date = must("dateDaily","日付");
    const name = must("driverNameExport","運転者氏名（本名）");
    const vehicle = must("vehicleNoExport","車両番号/ナンバー");

    toast("日報PDF作成中…", true);
    const json = await callApi("dailyPdf", { date, name, vehicle });
    showResult(json.url, `日報PDF（${date} / ${name}）`);
    window.open(json.url, "_blank");
    toast("作成しました", true);
  }

  async function runExportMonthly(){
    clearInvalid();

    const month = must("month","月");
    const name = must("driverNameExport","運転者氏名（本名）");
    const vehicle = must("vehicleNoExport","車両番号/ナンバー");

    toast("月報PDF作成中…", true);
    const json = await callApi("monthlyPdf", { month, name, vehicle });
    showResult(json.url, `月報PDF（詳細）（${month} / ${name}）`);
    window.open(json.url, "_blank");
    toast("作成しました", true);
  }

  async function runExportMonthlyCsv(){
    clearInvalid();

    const month = must("month","月");
    const name = must("driverNameExport","運転者氏名（本名）");
    const vehicle = must("vehicleNoExport","車両番号/ナンバー");

    toast("月次CSV作成中…", true);
    const json = await callApi("monthlyCsv", { month, name, vehicle });
    showResult(json.url, `月次CSV（${month} / ${name}）`);
    window.open(json.url, "_blank");
    toast("作成しました", true);
  }

  async function runExportRangeCsv(){
    clearInvalid();

    const from = must("fromDate","開始日");
    const to = must("toDate","終了日");
    if(from > to){
      markInvalid($("fromDate"));
      markInvalid($("toDate"));
      throw new Error("開始日が終了日より後です");
    }
    const name = must("driverNameExport","運転者氏名（本名）");
    const vehicle = must("vehicleNoExport","車両番号/ナンバー");

    toast("範囲CSV作成中…", true);
    const json = await callApi("csvRange", { from, to, name, vehicle });
    showResult(json.url, `範囲CSV（${from}〜${to} / ${name}）`);
    window.open(json.url, "_blank");
    toast("作成しました", true);
  }

  async function loadHistory(){
    clearInvalid();

    const month = must("historyMonth","履歴の月");
    const name = must("driverNameExport","運転者氏名（本名）");
    const vehicle = must("vehicleNoExport","車両番号/ナンバー");

    toast("履歴取得中…", true);
    const json = await callApi("historyDays", { month, name, vehicle });

    const days = Array.isArray(json.days) ? json.days : [];
    const box = $("historyBox");
    const list = $("historyList");
    const cnt = $("historyCount");
    if(!box || !list || !cnt) return;

    box.style.display = "block";
    cnt.textContent = `${days.length}件`;
    list.innerHTML = "";

    if(days.length===0){
      list.innerHTML = `<div class="hint" style="padding:6px 2px;">データなし</div>`;
    }else{
      days.slice().reverse().forEach(d=>{
        const div = document.createElement("div");
        div.className = "item";
        div.innerHTML = `
          <div>
            <div class="d">${d}</div>
            <div class="meta">${name} / ${vehicle}</div>
          </div>
          <div class="right">
            <button class="btn small primary" type="button">日報PDF</button>
            <button class="btn small" type="button">APIリンク</button>
          </div>
        `;
        const [b1,b2] = div.querySelectorAll("button");
        b1.addEventListener("click", async ()=>{
          $("dateDaily").value = d;
          await runExportDaily();
        });
        b2.addEventListener("click", ()=>{
          const u = buildUrl("dailyPdf", { date:d, name, vehicle });
          navigator.clipboard.writeText(u);
          toast("コピーしました", true);
        });
        list.appendChild(div);
      });
    }
    toast("表示しました", true);
  }

  // ====== 管理者ページ（検索） ======
  async function adminSearch(){
    clearInvalid();

    if(!window.OFA_AUTH.isAdmin()){
      throw new Error("管理者ログインが必要です");
    }

    const month = opt("adminMonth");
    const from = opt("adminFrom");
    const to = opt("adminTo");

    toast("検索中…", true);
    const json = await callApi("adminSearch", {
      qName: opt("qName"),
      qPhone: opt("qPhone"),
      qVehicle: opt("qVehicle"),
      month, from, to
    });

    const box = $("adminResult");
    if(!box) return;
    const rows = json.rows || [];
    box.style.display = "block";
    box.innerHTML = `
      <div style="font-weight:900;margin-bottom:8px;">検索結果：${rows.length}件</div>
      <div class="hint" style="margin-bottom:10px;">※管理者は「全員」対象。PDF/CSV出力もここから可能。</div>
      <div class="btnrow" style="margin-bottom:10px;">
        <button class="btn small primary" type="button" id="btnAdminCsv">検索結果CSV</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;">
        ${rows.slice(0,60).map(r=>`
          <div class="item">
            <div>
              <div class="d">${escapeHtml(r.date)} ${escapeHtml(r.time)} / ${escapeHtml(r.mode)}</div>
              <div class="meta">${escapeHtml(r.driverName)} / ${escapeHtml(r.vehicleNo)} / ${escapeHtml(r.driverPhone||"")}</div>
            </div>
            <div class="right">
              <button class="btn small rainbow" type="button" data-date="${escapeHtml(r.date)}" data-name="${escapeHtml(r.driverName)}" data-veh="${escapeHtml(r.vehicleNo)}">日報PDF</button>
            </div>
          </div>
        `).join("")}
        ${rows.length>60 ? `<div class="hint">※表示は60件まで。CSVで全件取得してください。</div>`:""}
      </div>
    `;

    // 日報PDF（管理者は対象指定で生成）
    box.querySelectorAll("button[data-date]").forEach(btn=>{
      btn.addEventListener("click", async ()=>{
        const d = btn.getAttribute("data-date");
        const n = btn.getAttribute("data-name");
        const v = btn.getAttribute("data-veh");
        toast("日報PDF作成中…", true);
        const out = await callApi("dailyPdf", { date:d, name:n, vehicle:v, admin:1 });
        showResult(out.url, `日報PDF（管理者）${d} / ${n}`);
        window.open(out.url, "_blank");
        toast("作成しました", true);
      });
    });

    // 検索CSV（管理者）
    const btnAdminCsv = $("btnAdminCsv");
    if(btnAdminCsv){
      btnAdminCsv.addEventListener("click", async ()=>{
        toast("CSV作成中…", true);
        const out = await callApi("adminCsv", {
          qName: opt("qName"),
          qPhone: opt("qPhone"),
          qVehicle: opt("qVehicle"),
          month, from, to
        });
        showResult(out.url, `管理者CSV（検索結果）`);
        window.open(out.url, "_blank");
        toast("作成しました", true);
      });
    }
  }

  function escapeHtml(s){
    return String(s??"")
      .replace(/&/g,"&amp;")
      .replace(/</g,"&lt;")
      .replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;")
      .replace(/'/g,"&#39;");
  }

  // ====== init ======
  function initCommonBack(){
    const b = $("backBtn");
    if(b){
      b.addEventListener("click", ()=>{
        if(history.length>1) history.back();
        else location.href="./index.html";
      });
    }
  }

  function initDeparture(){
    if(!window.OFA_AUTH.requireLogin()) return;
    setLoginBadge();
    initCommonBack();

    if($("date") && !$("date").value) $("date").value = ymd();
    if($("time") && !$("time").value) $("time").value = hm();

    $("odoStart")?.addEventListener("input", calcOdo);
    $("odoEnd")?.addEventListener("input", calcOdo);

    $("btnSubmit")?.addEventListener("click", ()=> submitTenko("departure"));

    // 出発：睡眠必須
    // 追加点呼欄が無い場合でも動く（HTML側に用意済みが前提）
  }

  function initArrival(){
    if(!window.OFA_AUTH.requireLogin()) return;
    setLoginBadge();
    initCommonBack();

    if($("date") && !$("date").value) $("date").value = ymd();
    if($("time") && !$("time").value) $("time").value = hm();

    $("odoStart")?.addEventListener("input", calcOdo);
    $("odoEnd")?.addEventListener("input", calcOdo);

    $("btnSubmit")?.addEventListener("click", ()=> submitTenko("arrival"));
  }

  function initExport(){
    if(!window.OFA_AUTH.requireLogin()) return;
    setLoginBadge();
    initCommonBack();

    // デフォルト
    const d = new Date();
    if($("dateDaily") && !$("dateDaily").value) $("dateDaily").value = ymd(d);
    if($("month") && !$("month").value){
      const m=String(d.getMonth()+1).padStart(2,"0");
      $("month").value = `${d.getFullYear()}-${m}`;
    }
    if($("historyMonth") && !$("historyMonth").value){
      const m=String(d.getMonth()+1).padStart(2,"0");
      $("historyMonth").value = `${d.getFullYear()}-${m}`;
    }

    // driver本人識別（必須）…「本人のみ」縛り
    // ※ログイン名は使わない（本名入力）
    $("btnDailyPdf")?.addEventListener("click", async ()=>{
      try{ await runExportDaily(); }catch(e){ toast(e.message||String(e)); }
    });
    $("btnMonthlyPdf")?.addEventListener("click", async ()=>{
      try{ await runExportMonthly(); }catch(e){ toast(e.message||String(e)); }
    });
    $("btnMonthlyCsv")?.addEventListener("click", async ()=>{
      try{ await runExportMonthlyCsv(); }catch(e){ toast(e.message||String(e)); }
    });
    $("btnCsvRange")?.addEventListener("click", async ()=>{
      try{ await runExportRangeCsv(); }catch(e){ toast(e.message||String(e)); }
    });
    $("btnLoadHistory")?.addEventListener("click", async ()=>{
      try{ await loadHistory(); }catch(e){ toast(e.message||String(e)); }
    });

    // 管理者ログインON/OFF（export内のみ）
    const adminState = $("adminState");
    const adminBox = $("adminBox");
    const btnAdminOn = $("adminLoginBtn");
    const btnAdminOff = $("adminLogoutBtn");
    const adminPass = $("adminPass");

    const refreshAdminUi = ()=>{
      const isAdmin = window.OFA_AUTH.isAdmin();
      if(adminState){
        adminState.innerHTML = isAdmin ? `<span class="badge admin">管理者モード</span>` : `<span class="badge">ドライバー</span>`;
      }
      if(adminBox){
        adminBox.style.display = isAdmin ? "block" : "none";
      }
    };

    btnAdminOn?.addEventListener("click", ()=>{
      const ok = window.OFA_AUTH.loginAdmin(adminPass?.value||"");
      if(!ok){ toast("管理者パスワードが違います"); return; }
      toast("管理者モードON", true);
      refreshAdminUi();
      setLoginBadge();
    });

    btnAdminOff?.addEventListener("click", ()=>{
      // 管理者→ドライバーに戻す（ドライバーパスで再ログインが安全）
      // ここでは一旦ログアウトさせる（誤操作防止）
      window.OFA_AUTH.logout();
      toast("ログアウトしました。再ログインしてください", true);
      setTimeout(()=> location.href="./index.html", 500);
    });

    refreshAdminUi();

    // 管理者検索
    $("btnAdminSearch")?.addEventListener("click", async ()=>{
      try{ await adminSearch(); }catch(e){ toast(e.message||String(e)); }
    });

    // GAS表示
    const v = $("gasUrlView");
    if(v) v.textContent = CFG.GAS_WEBAPP_URL;
  }

  function initIndex(){
    // indexはログイン画面
    const driverPass = $("driverPass");
    const btnDriver = $("btnDriverLogin");
    const btnLogout = $("btnLogout");
    const state = $("loginStateIndex");

    const refresh = ()=>{
      const s = window.OFA_AUTH.sessionType();
      if(state){
        state.textContent = s ? `ログイン中：${s==="admin"?"管理者":"ドライバー"}` : "未ログイン";
      }
      // 未ログインでも押せないように
      document.querySelectorAll("[data-require-login='1']").forEach(a=>{
        a.classList.toggle("disabledLink", !s);
      });
    };

    btnDriver?.addEventListener("click", ()=>{
      const ok = window.OFA_AUTH.loginDriver(driverPass?.value||"");
      if(!ok){ toast("パスワードが違います"); return; }
      toast("ログインOK", true);
      refresh();
      setTimeout(()=> location.href="./index.html", 350);
    });

    btnLogout?.addEventListener("click", ()=>{
      window.OFA_AUTH.logout();
      toast("ログアウトしました", true);
      refresh();
    });

    refresh();
  }

  // ===== boot =====
  window.addEventListener("DOMContentLoaded", ()=>{
    const page = document.body?.dataset?.page || "";
    if(page==="departure") initDeparture();
    else if(page==="arrival") initArrival();
    else if(page==="export") initExport();
    else initIndex();
  });
})();
