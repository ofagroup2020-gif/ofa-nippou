// js/app.js
// OFA 点呼/日報 Driver UI 制御（統一版）
// 依存: window.OFA_DB（db.js）, window.generateTodayPdf（pdf.js）, window.exportCsv（csv.js）※存在すれば

(function(){
  "use strict";

  const $ = (id)=> document.getElementById(id);

  // ====== element ids ======
  const EL = {
    // profile
    p_name: "p_name",
    p_base: "p_base",
    p_carNo: "p_carNo",
    p_licenseNo: "p_licenseNo",
    p_phone: "p_phone",
    p_email: "p_email",
    f_licenseImg: "f_licenseImg",
    btnSaveProfile: "btnSaveProfile",
    btnLoadProfile: "btnLoadProfile",
    dotProfile: "dotProfile",
    profileState: "profileState",

    // departure
    d_at: "d_at",
    d_method: "d_method",
    d_sleep: "d_sleep",
    d_temp: "d_temp",
    d_condition: "d_condition",
    d_fatigue: "d_fatigue",
    d_med: "d_med",
    d_medDetail: "d_medDetail",
    d_drink: "d_drink",
    d_alcState: "d_alcState",
    d_alcValue: "d_alcValue",
    d_alcJudge: "d_alcJudge",
    f_alcDepImg: "f_alcDepImg",
    d_projectMain: "d_projectMain",
    d_area: "d_area",
    d_danger: "d_danger",
    d_odoStart: "d_odoStart",
    d_abnormal: "d_abnormal",
    d_abnormalDetail: "d_abnormalDetail",
    f_abnDepImg: "f_abnDepImg",
    btnSaveDep: "btnSaveDep",
    btnClearDep: "btnClearDep",

    // arrival
    a_at: "a_at",
    a_method: "a_method",
    a_breakMin: "a_breakMin",
    a_temp: "a_temp",
    a_condition: "a_condition",
    a_fatigue: "a_fatigue",
    a_med: "a_med",
    a_medDetail: "a_medDetail",
    a_alcState: "a_alcState",
    a_alcValue: "a_alcValue",
    a_alcJudge: "a_alcJudge",
    f_alcArrImg: "f_alcArrImg",
    a_odoEnd: "a_odoEnd",
    a_abnormal: "a_abnormal",
    a_abnormalDetail: "a_abnormalDetail",
    f_abnArrImg: "f_abnArrImg",
    btnSaveArr: "btnSaveArr",
    btnClearArr: "btnClearArr",
    dotOdo: "dotOdo",
    odoState: "odoState",

    // check
    checkScroll: "checkScroll",
    checkMemo: "checkMemo",
    f_checkImg: "f_checkImg",

    // daily (optional)
    r_date: "r_date",
    r_start: "r_start",
    r_end: "r_end",
    r_break: "r_break",
    r_count: "r_count",
    r_absent: "r_absent",
    r_redel: "r_redel",
    r_return: "r_return",
    r_claim: "r_claim",
    r_claimDetail: "r_claimDetail",
    r_payBase: "r_payBase",
    r_incentive: "r_incentive",
    r_fuel: "r_fuel",
    r_highway: "r_highway",
    r_parking: "r_parking",
    r_otherCost: "r_otherCost",
    r_memo: "r_memo",
    f_dailyImg: "f_dailyImg",

    projectsBox: "projectsBox",
    btnAddProject: "btnAddProject",

    // output
    btnMakePdf: "btnMakePdf",
    btnMakeCsv: "btnMakeCsv",

    // history
    btnReloadHistory: "btnReloadHistory",
    btnClearAll: "btnClearAll",
    historyBox: "historyBox",
  };

  // ====== checklist master ======
  const CHECK_ITEMS = [
    "ブレーキ（踏みしろ/効き）",
    "タイヤ（空気圧/亀裂/溝）",
    "ライト（前後/ウインカー/ハザード）",
    "ワイパー/ウォッシャー",
    "ミラー（視界）",
    "警音器（ホーン）",
    "方向指示器",
    "計器（スピード/警告灯）",
    "エンジンオイル",
    "冷却水",
    "バッテリー",
    "燃料漏れ",
    "荷台/扉（開閉）",
    "積載状態（固定）",
    "安全装備（消火器/三角停止板）",
  ];

  // ====== state ======
  const state = {
    profile: null,
    lastHistory: { tenko: [], daily: [] },
    // 画像は端末保存しない（PDF生成時のみ参照）
    files: {
      licenseImg: null,
      alcDepImg: null,
      alcArrImg: null,
      dailyImg: null,
      checkImg: null,
      abnDepImg: null,
      abnArrImg: null,
    }
  };

  function toast(msg){
    alert(msg); // まずは確実に。必要なら後で非blocking UIへ
  }

  function setDotOk(dotId, ok){
    const el = $(dotId);
    if(!el) return;
    el.classList.remove("ok","warn");
    if(ok) el.classList.add("ok");
  }

  function fmtDateTime(v){
    if(!v) return "";
    return String(v).replace("T"," ").slice(0,16);
  }

  function todayYmd(){
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth()+1).padStart(2,"0");
    const dd = String(d.getDate()).padStart(2,"0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function defaultDateTimeLocal(){
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth()+1).padStart(2,"0");
    const dd = String(d.getDate()).padStart(2,"0");
    const hh = String(d.getHours()).padStart(2,"0");
    const mi = String(d.getMinutes()).padStart(2,"0");
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
  }

  // ====== checklist render ======
  function renderChecklist(){
    const box = $(EL.checkScroll);
    if(!box) return;

    box.innerHTML = "";
    CHECK_ITEMS.forEach((label, idx)=>{
      const row = document.createElement("div");
      row.className = "checkRow";
      row.innerHTML = `
        <div class="checkCol item">${label}</div>
        <div class="checkCol ok">
          <input type="radio" name="chk_${idx}" value="ok" />
        </div>
        <div class="checkCol ng">
          <input type="radio" name="chk_${idx}" value="ng" />
        </div>
      `;
      box.appendChild(row);
    });
  }

  function getChecklist(){
    return CHECK_ITEMS.map((label, idx)=>{
      const ok = document.querySelector(`input[name="chk_${idx}"][value="ok"]`)?.checked || false;
      const ng = document.querySelector(`input[name="chk_${idx}"][value="ng"]`)?.checked || false;
      // 未選択は ok=false 扱い（必要なら null にしてもOK）
      return { label, ok: ok && !ng };
    });
  }

  function clearChecklist(){
    CHECK_ITEMS.forEach((_, idx)=>{
      const radios = document.querySelectorAll(`input[name="chk_${idx}"]`);
      radios.forEach(r=> r.checked = false);
    });
    if($(EL.checkMemo)) $(EL.checkMemo).value = "";
    if($(EL.f_checkImg)) $(EL.f_checkImg).value = "";
    state.files.checkImg = null;
  }

  // ====== profile ======
  function readProfileFromForm(){
    return {
      name: ($(EL.p_name)?.value || "").trim(),
      base: ($(EL.p_base)?.value || "").trim(),
      carNo: ($(EL.p_carNo)?.value || "").trim(),
      licenseNo: ($(EL.p_licenseNo)?.value || "").trim(),
      phone: ($(EL.p_phone)?.value || "").trim(),
      email: ($(EL.p_email)?.value || "").trim(),
    };
  }

  function fillProfileForm(p){
    $(EL.p_name).value = p?.name || "";
    $(EL.p_base).value = p?.base || "";
    $(EL.p_carNo).value = p?.carNo || "";
    $(EL.p_licenseNo).value = p?.licenseNo || "";
    $(EL.p_phone).value = p?.phone || "";
    $(EL.p_email).value = p?.email || "";
  }

  function validateProfile(p){
    if(!p.name) return "氏名が未入力です";
    if(!p.base) return "拠点が未入力です";
    if(!p.carNo) return "車両番号が未入力です";
    if(!p.licenseNo) return "免許証番号が未入力です";
    if(!p.phone) return "電話番号が未入力です";
    if(!p.email) return "メールアドレスが未入力です";
    return "";
  }

  async function loadProfile(){
    if(!window.OFA_DB) throw new Error("db.js が読み込まれていません");
    const p = await window.OFA_DB.getProfile();
    state.profile = p;
    if(p){
      fillProfileForm(p);
      setDotOk(EL.dotProfile, true);
      $(EL.profileState).textContent = "保存済み";
    }else{
      setDotOk(EL.dotProfile, false);
      $(EL.profileState).textContent = "未保存";
    }
  }

  async function saveProfile(){
    const p = readProfileFromForm();
    const err = validateProfile(p);
    if(err){ toast(err); return; }

    const saved = await window.OFA_DB.saveProfile(p);
    state.profile = saved;

    setDotOk(EL.dotProfile, true);
    $(EL.profileState).textContent = "保存済み";
    toast("基本情報を保存しました");
  }

  // ====== tenko forms ======
  function readDeparture(){
    return {
      type: "dep",
      at: $(EL.d_at).value,
      method: $(EL.d_method).value,
      sleep: $(EL.d_sleep).value,
      temp: $(EL.d_temp).value,
      condition: $(EL.d_condition).value,
      fatigue: $(EL.d_fatigue).value,
      med: $(EL.d_med).value,
      medDetail: $(EL.d_medDetail).value,
      drink: $(EL.d_drink).value,
      alcState: $(EL.d_alcState).value,
      alcValue: $(EL.d_alcValue).value,
      alcJudge: $(EL.d_alcJudge).value,
      projectMain: $(EL.d_projectMain).value,
      area: $(EL.d_area).value,
      danger: $(EL.d_danger).value,
      odoStart: $(EL.d_odoStart).value,
      abnormal: $(EL.d_abnormal).value,
      abnormalDetail: $(EL.d_abnormalDetail).value,
      checklist: getChecklist(),
      checkMemo: $(EL.checkMemo)?.value || "",
    };
  }

  function readArrival(){
    return {
      type: "arr",
      at: $(EL.a_at).value,
      method: $(EL.a_method).value,
      breakMin: $(EL.a_breakMin).value,
      temp: $(EL.a_temp).value,
      condition: $(EL.a_condition).value,
      fatigue: $(EL.a_fatigue).value,
      med: $(EL.a_med).value,
      medDetail: $(EL.a_medDetail).value,
      alcState: $(EL.a_alcState).value,
      alcValue: $(EL.a_alcValue).value,
      alcJudge: $(EL.a_alcJudge).value,
      odoEnd: $(EL.a_odoEnd).value,
      abnormal: $(EL.a_abnormal).value,
      abnormalDetail: $(EL.a_abnormalDetail).value,
      checklist: getChecklist(),
      checkMemo: $(EL.checkMemo)?.value || "",
    };
  }

  function validateTenkoCommon(profile){
    const p = profile || state.profile;
    if(!p) return "先に基本情報を保存してください";
    const err = validateProfile({
      name: p.name, base: p.base, carNo: p.carNo,
      licenseNo: p.licenseNo, phone: p.phone, email: p.email
    });
    if(err) return "基本情報が未完成です：" + err;
    return "";
  }

  function validateDep(d){
    if(!d.at) return "出発：点呼日時が未入力です";
    if(!d.method) return "出発：方法が未選択です";
    if(!d.sleep) return "出発：睡眠時間が未入力です";
    if(!d.temp) return "出発：体温が未入力です";
    if(!d.condition) return "出発：体調が未選択です";
    if(!d.fatigue) return "出発：疲労が未選択です";
    if(!d.med) return "出発：服薬が未選択です";
    if(!d.drink) return "出発：飲酒が未選択です";
    if(!d.alcState) return "出発：酒気帯びが未選択です";
    if(d.alcValue === "") return "出発：アルコール数値が未入力です";
    if(!d.alcJudge) return "出発：判定が未選択です";
    if(!d.projectMain) return "出発：稼働案件が未入力です";
    if(!d.area) return "出発：積込拠点/エリアが未入力です";
    if(!d.danger) return "出発：危険物が未選択です";
    if(d.odoStart === "") return "出発：出発ODOが未入力です";
    if(!d.abnormal) return "出発：異常申告が未選択です";
    if(d.abnormal === "あり" && !d.abnormalDetail) return "出発：異常内容が未入力です";
    return "";
  }

  function validateArr(a){
    if(!a.at) return "帰着：点呼日時が未入力です";
    if(!a.method) return "帰着：方法が未選択です";
    if(a.breakMin === "") return "帰着：休憩時間が未入力です";
    if(!a.temp) return "帰着：体温が未入力です";
    if(!a.condition) return "帰着：体調が未選択です";
    if(!a.fatigue) return "帰着：疲労が未選択です";
    if(!a.med) return "帰着：服薬が未選択です";
    if(!a.alcState) return "帰着：酒気帯びが未選択です";
    if(a.alcValue === "") return "帰着：アルコール数値が未入力です";
    if(!a.alcJudge) return "帰着：判定が未選択です";
    if(a.odoEnd === "") return "帰着：帰着ODOが未入力です";
    if(!a.abnormal) return "帰着：異常申告が未選択です";
    if(a.abnormal === "あり" && !a.abnormalDetail) return "帰着：異常内容が未入力です";
    return "";
  }

  async function saveDeparture(){
    const pre = validateTenkoCommon(state.profile);
    if(pre){ toast(pre); return; }

    const d = readDeparture();
    const err = validateDep(d);
    if(err){ toast(err); return; }

    await window.OFA_DB.addTenko(d, state.profile);
    toast("出発点呼を保存しました");

    await reloadHistory();
  }

  async function saveArrival(){
    const pre = validateTenkoCommon(state.profile);
    if(pre){ toast(pre); return; }

    const a = readArrival();
    const err = validateArr(a);
    if(err){ toast(err); return; }

    await window.OFA_DB.addTenko(a, state.profile);
    toast("帰着点呼を保存しました");

    await reloadHistory();
    calcOdoBadgeFromLatest();
  }

  function clearDeparture(){
    $(EL.d_at).value = defaultDateTimeLocal();
    $(EL.d_method).value = "";
    $(EL.d_sleep).value = "";
    $(EL.d_temp).value = "";
    $(EL.d_condition).value = "";
    $(EL.d_fatigue).value = "";
    $(EL.d_med).value = "";
    $(EL.d_medDetail).value = "";
    $(EL.d_drink).value = "";
    $(EL.d_alcState).value = "";
    $(EL.d_alcValue).value = "";
    $(EL.d_alcJudge).value = "";
    $(EL.d_projectMain).value = "";
    $(EL.d_area).value = "";
    $(EL.d_danger).value = "";
    $(EL.d_odoStart).value = "";
    $(EL.d_abnormal).value = "";
    $(EL.d_abnormalDetail).value = "";
    $(EL.f_alcDepImg).value = "";
    $(EL.f_abnDepImg).value = "";
    state.files.alcDepImg = null;
    state.files.abnDepImg = null;
  }

  function clearArrival(){
    $(EL.a_at).value = defaultDateTimeLocal();
    $(EL.a_method).value = "";
    $(EL.a_breakMin).value = "";
    $(EL.a_temp).value = "";
    $(EL.a_condition).value = "";
    $(EL.a_fatigue).value = "";
    $(EL.a_med).value = "";
    $(EL.a_medDetail).value = "";
    $(EL.a_alcState).value = "";
    $(EL.a_alcValue).value = "";
    $(EL.a_alcJudge).value = "";
    $(EL.a_odoEnd).value = "";
    $(EL.a_abnormal).value = "";
    $(EL.a_abnormalDetail).value = "";
    $(EL.f_alcArrImg).value = "";
    $(EL.f_abnArrImg).value = "";
    state.files.alcArrImg = null;
    state.files.abnArrImg = null;
  }

  // ===== daily (optional) =====
  function readDaily(){
    const projects = [];
    const box = $(EL.projectsBox);
    if(box){
      box.querySelectorAll(".pjRow").forEach(row=>{
        const p = row.querySelector(".pj_project")?.value || "";
        const a = row.querySelector(".pj_amount")?.value || "";
        const m = row.querySelector(".pj_memo")?.value || "";
        if(p || a || m){
          projects.push({ project:p, amount:a, memo:m });
        }
      });
    }

    // 合計（任意）
    const payBase = Number($(EL.r_payBase)?.value || 0) || 0;
    const incentive = Number($(EL.r_incentive)?.value || 0) || 0;
    const salesTotal = payBase + incentive;

    const fuel = Number($(EL.r_fuel)?.value || 0) || 0;
    const highway = Number($(EL.r_highway)?.value || 0) || 0;
    const parking = Number($(EL.r_parking)?.value || 0) || 0;
    const otherCost = Number($(EL.r_otherCost)?.value || 0) || 0;
    const costTotal = fuel + highway + parking + otherCost;

    const profit = salesTotal - costTotal;

    return {
      date: ($(EL.r_date)?.value || "").trim(),
      start: $(EL.r_start)?.value || "",
      end: $(EL.r_end)?.value || "",
      breakMin: $(EL.r_break)?.value || "",
      count: $(EL.r_count)?.value || "",
      absent: $(EL.r_absent)?.value || "",
      redel: $(EL.r_redel)?.value || "",
      returns: $(EL.r_return)?.value || "",
      claim: $(EL.r_claim)?.value || "",
      claimDetail: $(EL.r_claimDetail)?.value || "",

      payBase: $(EL.r_payBase)?.value || "",
      incentive: $(EL.r_incentive)?.value || "",
      fuel: $(EL.r_fuel)?.value || "",
      highway: $(EL.r_highway)?.value || "",
      parking: $(EL.r_parking)?.value || "",
      otherCost: $(EL.r_otherCost)?.value || "",

      salesTotal,
      costTotal,
      profit,

      memo: $(EL.r_memo)?.value || "",
      projects,
    };
  }

  function addProjectRow(p = {}){
    const box = $(EL.projectsBox);
    if(!box) return;

    const row = document.createElement("div");
    row.className = "pjRow";
    row.innerHTML = `
      <label>案件名（任意）</label>
      <input class="pj_project" placeholder="例：ヤマト / Amazon / 企業便" value="${(p.project||"")}" />
      <label>金額（任意）</label>
      <input class="pj_amount" inputmode="decimal" placeholder="例：15000" value="${(p.amount||"")}" />
      <label>メモ（任意）</label>
      <input class="pj_memo" placeholder="任意" value="${(p.memo||"")}" />
      <div class="actions" style="margin-top:10px">
        <button class="miniBtn danger pj_remove">この案件を削除</button>
      </div>
    `;
    row.querySelector(".pj_remove").addEventListener("click",(e)=>{
      e.preventDefault();
      row.remove();
    }, {passive:false});

    box.appendChild(row);
  }

  // ===== PDF output (today or by date) =====
  function odoDiffFrom(dep, arr){
    const s = Number(dep?.odoStart || 0) || 0;
    const e = Number(arr?.odoEnd || 0) || 0;
    const diff = e - s;
    return (diff > 0) ? diff : 0;
  }

  function pickDayRecords(ymd, tenkoAll, dailyAll){
    // tenko: date で絞る（無い場合は at の先頭10）
    const tenko = tenkoAll.filter(t=>{
      const d = (t.date || String(t.at||"").slice(0,10));
      return d === ymd;
    });

    // type: dep/arr
    const dep = tenko.filter(t=> (t.type === "dep" || t.type === "departure")).sort((a,b)=> new Date(a.at)-new Date(b.at)).at(-1) || null;
    const arr = tenko.filter(t=> (t.type === "arr" || t.type === "arrival")).sort((a,b)=> new Date(a.at)-new Date(b.at)).at(-1) || null;

    const daily = dailyAll.filter(r=> (r.date || "") === ymd).sort((a,b)=> new Date(a.updatedAt||0)-new Date(b.updatedAt||0)).at(-1) || null;

    return { dep, arr, daily };
  }

  async function makePdfForDate(ymd){
    if(typeof window.generateTodayPdf !== "function"){
      toast("PDF機能（pdf.js）が読み込まれていません");
      return;
    }

    // profile は “保存済み” から作る（履歴側にもコピーされてるが、優先はprofile）
    const profile = state.profile || await window.OFA_DB.getProfile();
    if(!profile){
      toast("基本情報が未保存です（PDF作成できません）");
      return;
    }

    const tenkoAll = state.lastHistory.tenko || await window.OFA_DB.getAllTenko();
    const dailyAll = state.lastHistory.daily || await window.OFA_DB.getAllDaily();

    const { dep, arr, daily } = pickDayRecords(ymd, tenkoAll, dailyAll);
    const odoDiff = odoDiffFrom(dep, arr);

    const files = {
      licenseImg: state.files.licenseImg,
      alcDepImg: state.files.alcDepImg,
      alcArrImg: state.files.alcArrImg,
    };

    await window.generateTodayPdf({ profile, dep, arr, daily, odoDiff, files });
  }

  async function makeTodayPdf(){
    await makePdfForDate(todayYmd());
  }

  // ===== CSV output (all) =====
  async function makeCsv(){
    if(typeof window.exportCsv === "function"){
      await window.exportCsv();
      return;
    }
    // fallback: json dump
    const tenko = await window.OFA_DB.getAllTenko();
    const daily = await window.OFA_DB.getAllDaily();
    const blob = new Blob([JSON.stringify({tenko,daily}, null, 2)], {type:"application/json"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `OFA_export_${todayYmd()}.json`;
    a.click();
  }

  // ===== history =====
  function sortByAtDesc(a,b){
    const ta = new Date(a.at || a.date || a.updatedAt || 0).getTime();
    const tb = new Date(b.at || b.date || b.updatedAt || 0).getTime();
    return tb - ta;
  }

  function renderHistory(tenkoAll, dailyAll){
    const box = $(EL.historyBox);
    if(!box) return;

    // 日付キーでまとめる
    const map = new Map(); // ymd -> {tenko:[], daily:[]}
    const push = (ymd, kind, rec)=>{
      if(!map.has(ymd)) map.set(ymd, { tenko: [], daily: [] });
      map.get(ymd)[kind].push(rec);
    };

    tenkoAll.forEach(t=>{
      const ymd = t.date || String(t.at||"").slice(0,10) || "unknown";
      push(ymd, "tenko", t);
    });
    dailyAll.forEach(r=>{
      const ymd = r.date || "unknown";
      push(ymd, "daily", r);
    });

    const days = Array.from(map.keys()).sort((a,b)=> b.localeCompare(a)); // desc

    if(!days.length){
      box.innerHTML = `<div class="note">履歴がありません</div>`;
      return;
    }

    box.innerHTML = "";
    days.forEach(ymd=>{
      const g = map.get(ymd);
      const dep = g.tenko.filter(x=>x.type==="dep" || x.type==="departure").sort(sortByAtDesc)[0] || null;
      const arr = g.tenko.filter(x=>x.type==="arr" || x.type==="arrival").sort(sortByAtDesc)[0] || null;
      const daily = g.daily.sort(sortByAtDesc)[0] || null;

      const name = (daily?.name || dep?.name || arr?.name || state.profile?.name || "").trim();
      const base = (daily?.base || dep?.base || arr?.base || state.profile?.base || "").trim();
      const phone = (daily?.phone || dep?.phone || arr?.phone || state.profile?.phone || "").trim();

      const odo = odoDiffFrom(dep, arr);
      const hasDep = !!dep;
      const hasArr = !!arr;

      const card = document.createElement("div");
      card.className = "histItem";
      card.innerHTML = `
        <div class="histTop">
          <div>
            <div class="histTitle">${ymd}　${name ? `｜${name}`:""} ${base ? `｜${base}`:""}</div>
            <div class="small" style="margin-top:4px">
              ${phone ? `📞 ${phone}　`:""}
              🚚 走行 ${odo} km　
              🟦 出発 ${hasDep ? "あり":"なし"} / 🩷 帰着 ${hasArr ? "あり":"なし"}　
              📝 日報 ${daily ? "あり":"なし"}
            </div>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">
            <button class="miniBtn hist_pdf">PDF</button>
            <button class="miniBtn danger hist_del_day">この日を削除</button>
          </div>
        </div>

        <div class="histBody">
          ${hasDep ? `【出発】${fmtDateTime(dep.at)} / ${dep.method||"-"} / Alc:${dep.alcValue ?? "-"} / 異常:${dep.abnormal||"-"}<br/>`:""}
          ${hasArr ? `【帰着】${fmtDateTime(arr.at)} / ${arr.method||"-"} / Alc:${arr.alcValue ?? "-"} / 異常:${arr.abnormal||"-"}<br/>`:""}
          ${daily ? `【日報】売上:${daily.salesTotal ?? "-"} 経費:${daily.costTotal ?? "-"} 利益:${daily.profit ?? "-"} / ${String(daily.memo||"").slice(0,60)}`:""}
          ${(!hasDep && !hasArr && !daily) ? `<span style="opacity:.7">データ無し</span>`:""}
        </div>

        <div class="actions" style="margin-top:10px">
          <button class="miniBtn hist_del_dep" ${hasDep ? "" : "disabled"}>出発だけ削除</button>
          <button class="miniBtn hist_del_arr" ${hasArr ? "" : "disabled"}>帰着だけ削除</button>
          <button class="miniBtn hist_del_daily" ${daily ? "" : "disabled"}>日報だけ削除</button>
        </div>
      `;

      // PDF（過去日もOK）
      card.querySelector(".hist_pdf").addEventListener("click", async (e)=>{
        e.preventDefault();
        try{
          await makePdfForDate(ymd);
        }catch(err){
          console.error(err);
          toast("PDF作成に失敗しました");
        }
      }, {passive:false});

      // 個別削除
      const delDepBtn = card.querySelector(".hist_del_dep");
      const delArrBtn = card.querySelector(".hist_del_arr");
      const delDailyBtn = card.querySelector(".hist_del_daily");
      const delDayBtn = card.querySelector(".hist_del_day");

      delDepBtn?.addEventListener("click", async (e)=>{
        e.preventDefault();
        if(!dep) return;
        if(!confirm(`出発点呼だけ削除しますか？（${ymd}）`)) return;
        await window.OFA_DB.deleteTenkoById(dep.id);
        await reloadHistory();
      }, {passive:false});

      delArrBtn?.addEventListener("click", async (e)=>{
        e.preventDefault();
        if(!arr) return;
        if(!confirm(`帰着点呼だけ削除しますか？（${ymd}）`)) return;
        await window.OFA_DB.deleteTenkoById(arr.id);
        await reloadHistory();
      }, {passive:false});

      delDailyBtn?.addEventListener("click", async (e)=>{
        e.preventDefault();
        if(!daily) return;
        if(!confirm(`日報だけ削除しますか？（${ymd}）`)) return;
        await window.OFA_DB.deleteDailyById(daily.id);
        await reloadHistory();
      }, {passive:false});

      delDayBtn?.addEventListener("click", async (e)=>{
        e.preventDefault();
        if(!confirm(`この日のデータを全部削除しますか？（${ymd}）`)) return;

        // この日の tenko/daily を全削除
        const delIdsTenko = g.tenko.map(x=>x.id).filter(x=>x!=null);
        const delIdsDaily = g.daily.map(x=>x.id).filter(x=>x!=null);

        for(const id of delIdsTenko) await window.OFA_DB.deleteTenkoById(id);
        for(const id of delIdsDaily) await window.OFA_DB.deleteDailyById(id);

        await reloadHistory();
      }, {passive:false});

      box.appendChild(card);
    });
  }

  async function reloadHistory(){
    const [tenko, daily] = await Promise.all([
      window.OFA_DB.getAllTenko(),
      window.OFA_DB.getAllDaily(),
    ]);
    state.lastHistory.tenko = tenko;
    state.lastHistory.daily = daily;
    renderHistory(tenko, daily);
  }

  function calcOdoBadgeFromLatest(){
    const tenko = state.lastHistory.tenko || [];
    // 今日の dep/arr から計算
    const ymd = todayYmd();
    const list = tenko.filter(t=> (t.date || String(t.at||"").slice(0,10)) === ymd);

    const dep = list.filter(t=>t.type==="dep" || t.type==="departure").sort(sortByAtDesc)[0] || null;
    const arr = list.filter(t=>t.type==="arr" || t.type==="arrival").sort(sortByAtDesc)[0] || null;

    const diff = odoDiffFrom(dep, arr);
    $(EL.odoState).textContent = (dep && arr) ? `走行距離：${diff} km` : "走行距離：未計算";
    setDotOk(EL.dotOdo, (dep && arr));
  }

  // ===== init =====
  function bindFileInputs(){
    const bind = (id, key)=>{
      const el = $(id);
      if(!el) return;
      el.addEventListener("change", ()=>{
        state.files[key] = el.files?.[0] || null;
      });
    };

    bind(EL.f_licenseImg, "licenseImg");
    bind(EL.f_alcDepImg, "alcDepImg");
    bind(EL.f_alcArrImg, "alcArrImg");
    bind(EL.f_dailyImg, "dailyImg");
    bind(EL.f_checkImg, "checkImg");
    bind(EL.f_abnDepImg, "abnDepImg");
    bind(EL.f_abnArrImg, "abnArrImg");
  }

  function setDefaultDates(){
    if($(EL.d_at) && !$(EL.d_at).value) $(EL.d_at).value = defaultDateTimeLocal();
    if($(EL.a_at) && !$(EL.a_at).value) $(EL.a_at).value = defaultDateTimeLocal();
    if($(EL.r_date) && !$(EL.r_date).value) $(EL.r_date).value = todayYmd();
  }

  async function init(){
    if(!window.OFA_DB){
      toast("db.js が読み込まれていません（読み込み順を確認してください）");
      return;
    }

    renderChecklist();
    bindFileInputs();
    setDefaultDates();

    // buttons
    $(EL.btnSaveProfile)?.addEventListener("click", async (e)=>{
      e.preventDefault();
      try{ await saveProfile(); }
      catch(err){ console.error(err); toast("保存に失敗しました"); }
    }, {passive:false});

    $(EL.btnLoadProfile)?.addEventListener("click", async (e)=>{
      e.preventDefault();
      try{ await loadProfile(); toast("読み込みました"); }
      catch(err){ console.error(err); toast("読み込みに失敗しました"); }
    }, {passive:false});

    $(EL.btnSaveDep)?.addEventListener("click", async (e)=>{
      e.preventDefault();
      try{ await saveDeparture(); }
      catch(err){ console.error(err); toast("保存に失敗しました"); }
    }, {passive:false});

    $(EL.btnSaveArr)?.addEventListener("click", async (e)=>{
      e.preventDefault();
      try{ await saveArrival(); }
      catch(err){ console.error(err); toast("保存に失敗しました"); }
    }, {passive:false});

    $(EL.btnClearDep)?.addEventListener("click", (e)=>{
      e.preventDefault();
      clearDeparture();
      toast("出発点呼をクリアしました");
    }, {passive:false});

    $(EL.btnClearArr)?.addEventListener("click", (e)=>{
      e.preventDefault();
      clearArrival();
      toast("帰着点呼をクリアしました");
    }, {passive:false});

    $(EL.btnAddProject)?.addEventListener("click", (e)=>{
      e.preventDefault();
      addProjectRow();
    }, {passive:false});

    $(EL.btnMakePdf)?.addEventListener("click", async (e)=>{
      e.preventDefault();
      try{ await makeTodayPdf(); }
      catch(err){ console.error(err); toast("PDF作成に失敗しました"); }
    }, {passive:false});

    $(EL.btnMakeCsv)?.addEventListener("click", async (e)=>{
      e.preventDefault();
      try{ await makeCsv(); }
      catch(err){ console.error(err); toast("CSV作成に失敗しました"); }
    }, {passive:false});

    $(EL.btnReloadHistory)?.addEventListener("click", async (e)=>{
      e.preventDefault();
      try{ await reloadHistory(); toast("履歴を更新しました"); }
      catch(err){ console.error(err); toast("更新に失敗しました"); }
    }, {passive:false});

    $(EL.btnClearAll)?.addEventListener("click", async (e)=>{
      e.preventDefault();
      if(!confirm("端末内データを全削除します。よろしいですか？")) return;
      try{
        await window.OFA_DB.clearAll();
        toast("全削除しました");
        await loadProfile();
        await reloadHistory();
        calcOdoBadgeFromLatest();
        clearChecklist();
      }catch(err){
        console.error(err);
        toast("全削除に失敗しました");
      }
    }, {passive:false});

    // 初期ロード
    await loadProfile();
    await reloadHistory();
    calcOdoBadgeFromLatest();
  }

  document.addEventListener("DOMContentLoaded", ()=>{
    init().catch(err=>{
      console.error(err);
      toast("初期化に失敗しました");
    });
  });

})();
