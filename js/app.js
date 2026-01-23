// js/app.js
// Driver main logic: profile/tenko/daily save + history render + CSV/PDF hooks

(function(){
  // ---------- helpers ----------
  const $ = (id)=> document.getElementById(id);
  const nowLocalDT = ()=>{
    const d = new Date();
    const pad = (n)=> String(n).padStart(2,"0");
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  const todayDate = ()=>{
    const d = new Date();
    const pad = (n)=> String(n).padStart(2,"0");
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  };
  const safeNum = (v)=>{
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  const str = (v)=> (v ?? "").toString().trim();
  const escapeHtml = (s)=>{
    return String(s ?? "")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  };
  const toast = (msg)=>{
    alert(msg);
  };

  // ---------- checklist master ----------
  // フル版（日常点検）
  const CHECK_ITEMS = [
    // A. 安全走行に直結
    "タイヤ空気圧",
    "タイヤ溝 / ひび割れ",
    "ホイールナット緩み",
    "ブレーキ効き",
    "パーキングブレーキ",
    "ハンドル操作",
    "ライト（前照灯/尾灯/ブレーキ/ウインカー/ハザード）",
    "ワイパー / ウォッシャー液",
    "ミラー / ガラス破損",

    // B. 車両状態
    "エンジンオイル量",
    "冷却水",
    "バッテリー（警告灯含む）",
    "異音 / 異臭 / 異常振動",
    "漏れ（オイル / 冷却水）",
    "外装破損",
    "積載状態（偏り/過積載なし）",

    // C. 装備
    "消火器",
    "三角停止板",
    "反射ベスト",
    "ジャッキ / 工具（任意）"
  ];

  // ---------- DOM refs ----------
  const btnSaveProfile = $("btnSaveProfile");
  const btnLoadProfile = $("btnLoadProfile");

  const btnSaveDep = $("btnSaveDep");
  const btnClearDep = $("btnClearDep");
  const btnSaveArr = $("btnSaveArr");
  const btnClearArr = $("btnClearArr");

  const btnAddProject = $("btnAddProject");

  const btnMakePdf = $("btnMakePdf");
  const btnMakeCsv = $("btnMakeCsv");

  const btnReloadHistory = $("btnReloadHistory");
  const btnClearAll = $("btnClearAll");

  const dotProfile = $("dotProfile");
  const profileState = $("profileState");

  const dotOdo = $("dotOdo");
  const odoState = $("odoState");

  const checkScroll = $("checkScroll");
  const historyBox = $("historyBox");
  const projectsBox = $("projectsBox");

  // file inputs
  const f_licenseImg = $("f_licenseImg");
  const f_alcDepImg = $("f_alcDepImg");
  const f_alcArrImg = $("f_alcArrImg");
  const f_abnDepImg = $("f_abnDepImg");
  const f_abnArrImg = $("f_abnArrImg");
  const f_checkImg  = $("f_checkImg");
  const f_dailyImg  = $("f_dailyImg");

  // ---------- initial fill ----------
  // 日付・時間は自動入力は困る、という要望があるので「自動で埋めない」。
  // ただし空のままだと面倒なので、1タップで入れる補助として placeholder を出す。
  const d_at = $("d_at");
  const a_at = $("a_at");
  if(d_at) d_at.placeholder = nowLocalDT();
  if(a_at) a_at.placeholder = nowLocalDT();

  const r_date = $("r_date");
  if(r_date) r_date.placeholder = todayDate();

  // ---------- checklist UI build ----------
  function buildChecklist(){
    if(!checkScroll) return;

    const rows = CHECK_ITEMS.map((label, idx)=>{
      const idOk = `chk_ok_${idx}`;
      const idNg = `chk_ng_${idx}`;
      return `
        <div class="checkRow" data-idx="${idx}">
          <div class="checkCol item">${escapeHtml(label)}</div>
          <div class="checkCol ok"><input type="radio" name="chk_${idx}" id="${idOk}" value="OK"></div>
          <div class="checkCol ng"><input type="radio" name="chk_${idx}" id="${idNg}" value="NG"></div>
        </div>
      `;
    }).join("");

    checkScroll.innerHTML = rows;

    // default: OK にしておく（入力負荷を下げる）
    CHECK_ITEMS.forEach((_, idx)=>{
      const ok = document.getElementById(`chk_ok_${idx}`);
      if(ok) ok.checked = true;
    });
  }

  function readChecklist(){
    const list = [];
    CHECK_ITEMS.forEach((label, idx)=>{
      const ok = document.getElementById(`chk_ok_${idx}`);
      const ng = document.getElementById(`chk_ng_${idx}`);
      let isOk = true;
      if(ng && ng.checked) isOk = false;
      if(ok && ok.checked) isOk = true;
      list.push({ label, ok: isOk });
    });
    return list;
  }

  function setChecklistFrom(record){
    if(!record || !record.checklist) return;
    record.checklist.forEach((it, idx)=>{
      const ok = document.getElementById(`chk_ok_${idx}`);
      const ng = document.getElementById(`chk_ng_${idx}`);
      if(!ok || !ng) return;
      if(it.ok){ ok.checked = true; }
      else { ng.checked = true; }
    });
    if($("checkMemo")) $("checkMemo").value = record.checkMemo || "";
  }

  // ---------- projects ----------
  function createProjectRow(p = {}){
    const uid = `pj_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const el = document.createElement("div");
    el.className = "pjRow";
    el.dataset.pid = uid;

    el.innerHTML = `
      <div class="row">
        <div>
          <label>案件名（任意）</label>
          <input class="pj_name" placeholder="例：ヤマト/スポット" value="${escapeHtml(p.name||"")}">
        </div>
        <div>
          <label>個数（任意）</label>
          <input class="pj_count" inputmode="numeric" placeholder="例：50" value="${escapeHtml(p.count||"")}">
        </div>
      </div>
      <div class="row">
        <div>
          <label>メモ（任意）</label>
          <input class="pj_memo" placeholder="任意" value="${escapeHtml(p.memo||"")}">
        </div>
        <div style="display:flex;align-items:flex-end">
          <button class="btn secondary pj_del" type="button" style="width:100%">削除</button>
        </div>
      </div>
      <div class="divider"></div>
    `;

    el.querySelector(".pj_del").addEventListener("click", ()=>{
      el.remove();
    });

    return el;
  }

  function addProject(p){
    if(!projectsBox) return;
    projectsBox.appendChild(createProjectRow(p));
  }

  function readProjects(){
    if(!projectsBox) return [];
    const rows = Array.from(projectsBox.querySelectorAll(".pjRow"));
    return rows.map(row=>{
      const name = row.querySelector(".pj_name")?.value ?? "";
      const count = row.querySelector(".pj_count")?.value ?? "";
      const memo = row.querySelector(".pj_memo")?.value ?? "";
      const obj = { name: str(name), count: str(count), memo: str(memo) };
      // 空は除外（ゴミを減らす）
      if(!obj.name && !obj.count && !obj.memo) return null;
      return obj;
    }).filter(Boolean);
  }

  // ---------- profile ----------
  async function saveProfile(){
    const required = [
      ["p_name","氏名"],
      ["p_base","拠点"],
      ["p_carNo","車両番号"],
      ["p_licenseNo","免許証番号"],
      ["p_phone","電話番号"],
      ["p_email","メール"]
    ];
    for(const [id,label] of required){
      const v = str($(id)?.value);
      if(!v){
        toast(`必須項目が未入力です：${label}`);
        return;
      }
    }

    const profile = {
      id: "me",
      name: str($("p_name").value),
      base: str($("p_base").value),
      carNo: str($("p_carNo").value),
      licenseNo: str($("p_licenseNo").value),
      phone: str($("p_phone").value),
      email: str($("p_email").value),
      updatedAt: new Date().toISOString()
    };

    await idbPut(STORE_PROFILE, profile);

    dotProfile?.classList.add("ok");
    profileState.textContent = "保存済み";
    toast("基本情報を保存しました");
  }

  async function loadProfile(){
    const me = await idbGet(STORE_PROFILE, "me");
    if(!me){
      dotProfile?.classList.remove("ok");
      profileState.textContent = "未保存";
      toast("まだ保存がありません");
      return;
    }
    $("p_name").value = me.name || "";
    $("p_base").value = me.base || "";
    $("p_carNo").value = me.carNo || "";
    $("p_licenseNo").value = me.licenseNo || "";
    $("p_phone").value = me.phone || "";
    $("p_email").value = me.email || "";

    dotProfile?.classList.add("ok");
    profileState.textContent = "保存済み";
  }

  // ---------- tenko record build ----------
  function validateDep(){
    const meMissing = profileState.textContent !== "保存済み";
    if(meMissing){
      toast("先に「基本情報を保存」してください");
      return false;
    }

    const must = [
      ["d_at","点呼日時（出発）"],
      ["d_method","点呼方法（出発）"],
      ["d_sleep","睡眠時間（出発）"],
      ["d_temp","体温（出発）"],
      ["d_condition","体調（出発）"],
      ["d_fatigue","疲労（出発）"],
      ["d_med","服薬（出発）"],
      ["d_drink","飲酒の有無（出発）"],
      ["d_alcState","酒気帯び有無（出発）"],
      ["d_alcValue","アルコール数値（出発）"],
      ["d_alcJudge","アルコール判定（出発）"],
      ["d_projectMain","稼働案件（メイン）"],
      ["d_area","積込拠点/エリア"],
      ["d_danger","危険物・高額品の有無"],
      ["d_odoStart","出発ODO"]
    ];
    for(const [id,label] of must){
      const v = str($(id)?.value);
      if(!v){
        toast(`必須項目が未入力です：${label}`);
        return false;
      }
    }

    // abnormal rule
    if(str($("d_abnormal").value)==="あり" && !str($("d_abnormalDetail").value)){
      toast("異常ありの場合、異常内容は必須です（出発）");
      return false;
    }
    return true;
  }

  function validateArr(){
    const meMissing = profileState.textContent !== "保存済み";
    if(meMissing){
      toast("先に「基本情報を保存」してください");
      return false;
    }

    const must = [
      ["a_at","点呼日時（帰着）"],
      ["a_method","点呼方法（帰着）"],
      ["a_breakMin","休憩時間（帰着）"],
      ["a_temp","体温（帰着）"],
      ["a_condition","体調（帰着）"],
      ["a_fatigue","疲労（帰着）"],
      ["a_med","服薬（帰着）"],
      ["a_alcState","酒気帯び有無（帰着）"],
      ["a_alcValue","アルコール数値（帰着）"],
      ["a_alcJudge","アルコール判定（帰着）"],
      ["a_odoEnd","帰着ODO"]
    ];
    for(const [id,label] of must){
      const v = str($(id)?.value);
      if(!v){
        toast(`必須項目が未入力です：${label}`);
        return false;
      }
    }

    // abnormal rule
    if(str($("a_abnormal").value)==="あり" && !str($("a_abnormalDetail").value)){
      toast("異常ありの場合、異常内容は必須です（帰着）");
      return false;
    }
    return true;
  }

  async function buildCommonProfile(){
    const me = await idbGet(STORE_PROFILE, "me");
    if(!me) throw new Error("profile missing");
    return me;
  }

  async function saveDeparture(){
    if(!validateDep()) return;

    const me = await buildCommonProfile();
    const id = `dep_${Date.now()}`;

    const record = {
      id,
      kind: "tenko",
      type: "departure",
      at: str($("d_at").value),
      name: me.name,
      base: me.base,
      carNo: me.carNo,
      licenseNo: me.licenseNo,
      phone: me.phone,
      email: me.email,

      method: str($("d_method").value),

      sleep: str($("d_sleep").value),
      temp: str($("d_temp").value),
      condition: str($("d_condition").value),
      fatigue: str($("d_fatigue").value),

      med: str($("d_med").value),
      medDetail: str($("d_medDetail").value),

      drink: str($("d_drink").value),
      alcState: str($("d_alcState").value),
      alcValue: str($("d_alcValue").value),
      alcJudge: str($("d_alcJudge").value),

      projectMain: str($("d_projectMain").value),
      area: str($("d_area").value),
      danger: str($("d_danger").value),

      odoStart: safeNum($("d_odoStart").value),
      odoEnd: null,        // 出発では入れない
      odoDiff: null,       // ペアが揃ったら計算

      abnormal: str($("d_abnormal").value),
      abnormalDetail: str($("d_abnormalDetail").value),

      // checklist is stored with departure (1回入れればOK運用)
      checklist: readChecklist(),
      checkMemo: str($("checkMemo")?.value),
      createdAt: new Date().toISOString()
    };

    await idbPut(STORE_TENKO, record);
    await renderHistory();
    await recalcOdoState();

    toast("出発点呼を保存しました");
  }

  async function saveArrival(){
    if(!validateArr()) return;

    const me = await buildCommonProfile();
    const id = `arr_${Date.now()}`;

    const record = {
      id,
      kind: "tenko",
      type: "arrival",
      at: str($("a_at").value),
      name: me.name,
      base: me.base,
      carNo: me.carNo,
      licenseNo: me.licenseNo,
      phone: me.phone,
      email: me.email,

      method: str($("a_method").value),

      breakMin: safeNum($("a_breakMin").value),
      temp: str($("a_temp").value),
      condition: str($("a_condition").value),
      fatigue: str($("a_fatigue").value),

      med: str($("a_med").value),
      medDetail: str($("a_medDetail").value),

      alcState: str($("a_alcState").value),
      alcValue: str($("a_alcValue").value),
      alcJudge: str($("a_alcJudge").value),

      odoStart: null,
      odoEnd: safeNum($("a_odoEnd").value),
      odoDiff: null,

      abnormal: str($("a_abnormal").value),
      abnormalDetail: str($("a_abnormalDetail").value),

      // checklist / memo can be reused; keep current
      checklist: readChecklist(),
      checkMemo: str($("checkMemo")?.value),
      createdAt: new Date().toISOString()
    };

    await idbPut(STORE_TENKO, record);
    await renderHistory();
    await recalcOdoState();

    toast("帰着点呼を保存しました");
  }

  // ---------- clear forms ----------
  function clearDeparture(){
    ["d_at","d_method","d_sleep","d_temp","d_condition","d_fatigue","d_med","d_medDetail","d_drink","d_alcState","d_alcValue","d_alcJudge","d_projectMain","d_area","d_danger","d_odoStart","d_abnormal","d_abnormalDetail"]
      .forEach(id=>{ if($(id)) $(id).value=""; });
    if(f_alcDepImg) f_alcDepImg.value = "";
    if(f_abnDepImg) f_abnDepImg.value = "";
    toast("出発点呼をクリアしました");
  }

  function clearArrival(){
    ["a_at","a_method","a_breakMin","a_temp","a_condition","a_fatigue","a_med","a_medDetail","a_alcState","a_alcValue","a_alcJudge","a_odoEnd","a_abnormal","a_abnormalDetail"]
      .forEach(id=>{ if($(id)) $(id).value=""; });
    if(f_alcArrImg) f_alcArrImg.value = "";
    if(f_abnArrImg) f_abnArrImg.value = "";
    toast("帰着点呼をクリアしました");
  }

  // ---------- daily report (optional) ----------
  async function saveDailyOptional(odoDiff){
    const me = await buildCommonProfile();

    // 日報はオプション：全部空なら保存しない（PDFには載せてもOK）
    const payload = {
      date: str($("r_date")?.value),
      start: str($("r_start")?.value),
      end: str($("r_end")?.value),
      breakMin: str($("r_break")?.value),
      count: str($("r_count")?.value),
      absent: str($("r_absent")?.value),
      redel: str($("r_redel")?.value),
      ret: str($("r_return")?.value),
      claim: str($("r_claim")?.value),
      claimDetail: str($("r_claimDetail")?.value),
      payBase: str($("r_payBase")?.value),
      incentive: str($("r_incentive")?.value),
      fuel: str($("r_fuel")?.value),
      highway: str($("r_highway")?.value),
      parking: str($("r_parking")?.value),
      otherCost: str($("r_otherCost")?.value),
      memo: str($("r_memo")?.value),
      projects: readProjects()
    };

    const anyFilled = Object.values(payload).some(v=>{
      if(Array.isArray(v)) return v.length>0;
      return str(v) !== "";
    });

    if(!anyFilled) return null;

    // date fallback: dep/arr date will be used in pdf. Daily record key uses date.
    const dateKey = payload.date || todayDate();
    const id = `daily_${dateKey}_${Date.now()}`;

    const salesTotal = safeNum(payload.payBase) + safeNum(payload.incentive);
    const costTotal = safeNum(payload.fuel) + safeNum(payload.highway) + safeNum(payload.parking) + safeNum(payload.otherCost);
    const profit = salesTotal - costTotal;

    const rec = {
      id,
      kind: "daily",
      name: me.name,
      base: me.base,
      date: dateKey,
      mainProject: payload.projects?.[0]?.name || "", // 代表（任意）
      odoDiff: safeNum(odoDiff),

      // numeric optional fields
      payBase: safeNum(payload.payBase),
      incentive: safeNum(payload.incentive),
      fuel: safeNum(payload.fuel),
      highway: safeNum(payload.highway),
      parking: safeNum(payload.parking),
      otherCost: safeNum(payload.otherCost),

      salesTotal,
      profit,

      // other optional fields
      start: payload.start,
      end: payload.end,
      breakMin: payload.breakMin,
      count: payload.count,
      absent: payload.absent,
      redel: payload.redel,
      ret: payload.ret,
      claim: payload.claim,
      claimDetail: payload.claimDetail,
      memo: payload.memo,
      projects: payload.projects,

      createdAt: new Date().toISOString()
    };

    await idbPut(STORE_DAILY, rec);
    return rec;
  }

  // ---------- odo calc ----------
  async function findPairForToday(){
    // まず「今日の出発＋帰着」でペアリング
    const all = await idbGetAll(STORE_TENKO);
    const me = await idbGet(STORE_PROFILE, "me");
    if(!me) return { dep:null, arr:null, odoDiff:null };

    const name = me.name;
    const base = me.base;

    // use date from inputs first
    const depDate = str($("d_at")?.value).slice(0,10);
    const arrDate = str($("a_at")?.value).slice(0,10);
    const targetDate = depDate || arrDate || todayDate();

    const dep = all
      .filter(r=>r.type==="departure" && r.name===name && r.base===base && (r.at||"").slice(0,10)===targetDate)
      .sort((a,b)=> String(b.at).localeCompare(String(a.at)))[0] || null;

    const arr = all
      .filter(r=>r.type==="arrival" && r.name===name && r.base===base && (r.at||"").slice(0,10)===targetDate)
      .sort((a,b)=> String(b.at).localeCompare(String(a.at)))[0] || null;

    let diff = null;
    if(dep && arr){
      const d = safeNum(arr.odoEnd) - safeNum(dep.odoStart);
      diff = (d>0 ? d : 0);
    }
    return { dep, arr, odoDiff: diff, dateKey: targetDate };
  }

  async function recalcOdoState(){
    try{
      const { dep, arr, odoDiff } = await findPairForToday();
      if(dep && arr){
        dotOdo?.classList.add("ok");
        odoState.textContent = `走行距離：${odoDiff} km（出発ODO→帰着ODO）`;
      }else{
        dotOdo?.classList.remove("ok");
        odoState.textContent = "走行距離：未計算（出発＋帰着が揃うと自動）";
      }
    }catch(e){
      dotOdo?.classList.remove("ok");
      odoState.textContent = "走行距離：計算エラー";
    }
  }

  // ---------- PDF/CSV ----------
  async function makeTodayPdf(){
    // profile required
    const me = await idbGet(STORE_PROFILE, "me");
    if(!me){
      toast("先に基本情報を保存してください");
      return;
    }

    // pair
    const { dep, arr, odoDiff, dateKey } = await findPairForToday();
    if(!dep && !arr){
      toast("出発点呼または帰着点呼のどちらかを保存してください");
      return;
    }

    // daily optional: ここで入力があるなら保存（オプション）
    const daily = await saveDailyOptional(odoDiff ?? 0);

    // files used for PDF embedding only
    const files = {
      licenseImg: f_licenseImg?.files?.[0] || null,
      alcDepImg: f_alcDepImg?.files?.[0] || null,
      alcArrImg: f_alcArrImg?.files?.[0] || null,

      // optional extras: abnormal/check/daily images are not inside pdf.js now,
      // but keep for future extension if needed.
      abnDepImg: f_abnDepImg?.files?.[0] || null,
      abnArrImg: f_abnArrImg?.files?.[0] || null,
      checkImg : f_checkImg?.files?.[0]  || null,
      dailyImg : f_dailyImg?.files?.[0]  || null
    };

    // pdf.js expects dep/arr/daily; checklist is in dep/arr
    try{
      await generateTodayPdf({
        profile: me,
        dep,
        arr,
        daily,
        odoDiff: odoDiff ?? 0,
        files
      });
      await renderHistory();
      toast("PDFを作成しました（ファイルから共有→LINE/メールで送信）");
    }catch(e){
      console.error(e);
      toast("PDF生成に失敗しました。もう一度お試しください。");
    }
  }

  async function exportAllCsv(){
    const me = await idbGet(STORE_PROFILE, "me");
    if(!me){
      toast("先に基本情報を保存してください");
      return;
    }
    // filters: export all, but for this device only (name/base)
    const filters = { from:"", to:"", base: me.base, name: me.name };
    try{
      await exportCsvSearchResult(filters);
      toast("CSVを出力しました（点呼・日報の2本）");
    }catch(e){
      console.error(e);
      toast("CSV出力に失敗しました");
    }
  }

  // ---------- history ----------
  function summarizeTenko(t){
    const type = t.type==="departure" ? "出発" : "帰着";
    const at = (t.at||"").replace("T"," ").slice(0,16);
    const odo = t.type==="departure" ? `ODO:${t.odoStart ?? ""}` : `ODO:${t.odoEnd ?? ""}`;
    const alc = `ALC:${t.alcValue ?? ""}(${t.alcJudge ?? ""})`;
    const abn = t.abnormal ? `異常:${t.abnormal}` : "";
    return `${type} / ${at} / ${odo} / ${alc} ${abn}`;
  }
  function summarizeDaily(d){
    return `日報 / ${d.date || ""} / 売上:${d.salesTotal ?? 0} / 利益:${d.profit ?? 0}`;
  }

  async function renderHistory(){
    if(!historyBox) return;
    const me = await idbGet(STORE_PROFILE, "me");
    const name = me?.name;
    const base = me?.base;

    const tenko = (await idbGetAll(STORE_TENKO))
      .filter(r=> !name || (r.name===name && r.base===base))
      .sort((a,b)=> String(b.at || b.createdAt).localeCompare(String(a.at || a.createdAt)));

    const daily = (await idbGetAll(STORE_DAILY))
      .filter(r=> !name || (r.name===name && r.base===base))
      .sort((a,b)=> String(b.date || b.createdAt).localeCompare(String(a.date || a.createdAt)));

    // render limited for speed
    const tenkoShow = tenko.slice(0,30);
    const dailyShow = daily.slice(0,30);

    const tenkoHtml = tenkoShow.map(r=>{
      return `
        <div class="histItem">
          <div class="histTop">
            <div class="histTitle">点呼：${escapeHtml(r.type==="departure"?"出発":"帰着")}</div>
            <button class="miniBtn danger" data-deltenko="${escapeHtml(r.id)}">削除</button>
          </div>
          <div class="histBody">${escapeHtml(summarizeTenko(r))}</div>
        </div>
      `;
    }).join("") || `<div class="small">点呼履歴がありません</div>`;

    const dailyHtml = dailyShow.map(r=>{
      return `
        <div class="histItem">
          <div class="histTop">
            <div class="histTitle">日報：${escapeHtml(r.date || "")}</div>
            <button class="miniBtn danger" data-deldaily="${escapeHtml(r.id)}">削除</button>
          </div>
          <div class="histBody">${escapeHtml(summarizeDaily(r))}</div>
        </div>
      `;
    }).join("") || `<div class="small">日報履歴がありません</div>`;

    historyBox.innerHTML = `
      <div class="h3">点呼（最新30件）</div>
      ${tenkoHtml}
      <div class="divider"></div>
      <div class="h3">日報（最新30件）</div>
      ${dailyHtml}
      <div class="divider"></div>
      <div class="small">※履歴は端末内保存です。全件CSV出力は「CSV出力」ボタンから。</div>
    `;

    // delete handlers
    historyBox.querySelectorAll("[data-deltenko]").forEach(btn=>{
      btn.addEventListener("click", async ()=>{
        const id = btn.getAttribute("data-deltenko");
        if(!confirm("この点呼履歴を削除しますか？")) return;
        await idbDelete(STORE_TENKO, id);
        await renderHistory();
        await recalcOdoState();
      });
    });
    historyBox.querySelectorAll("[data-deldaily]").forEach(btn=>{
      btn.addEventListener("click", async ()=>{
        const id = btn.getAttribute("data-deldaily");
        if(!confirm("この日報履歴を削除しますか？")) return;
        await idbDelete(STORE_DAILY, id);
        await renderHistory();
      });
    });
  }

  async function clearAll(){
    if(!confirm("端末内データを全削除します。よろしいですか？")) return;
    // brute: delete by listing keys
    const tenko = await idbGetAll(STORE_TENKO);
    const daily = await idbGetAll(STORE_DAILY);
    for(const t of tenko) await idbDelete(STORE_TENKO, t.id);
    for(const d of daily) await idbDelete(STORE_DAILY, d.id);
    await renderHistory();
    await recalcOdoState();
    toast("削除しました");
  }

  // ---------- wiring ----------
  async function init(){
    buildChecklist();
    await loadProfile().catch(()=>{});
    await recalcOdoState().catch(()=>{});
    await renderHistory().catch(()=>{});

    // profile
    btnSaveProfile?.addEventListener("click", ()=> saveProfile().catch(console.error));
    btnLoadProfile?.addEventListener("click", ()=> loadProfile().catch(console.error));

    // tenko
    btnSaveDep?.addEventListener("click", ()=> saveDeparture().catch(console.error));
    btnClearDep?.addEventListener("click", clearDeparture);

    btnSaveArr?.addEventListener("click", ()=> saveArrival().catch(console.error));
    btnClearArr?.addEventListener("click", clearArrival);

    // projects
    btnAddProject?.addEventListener("click", ()=> addProject({}));

    // exports
    btnMakePdf?.addEventListener("click", ()=> makeTodayPdf().catch(console.error));
    btnMakeCsv?.addEventListener("click", ()=> exportAllCsv().catch(console.error));

    // history
    btnReloadHistory?.addEventListener("click", ()=> renderHistory().catch(console.error));
    btnClearAll?.addEventListener("click", ()=> clearAll().catch(console.error));
  }

  // run
  document.addEventListener("DOMContentLoaded", init);
})();
