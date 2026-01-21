// /js/app.js
// OFA 点呼アプリ（ドライバー側）
// ・基本情報保存
// ・出発点呼 / 帰着点呼（分離）
// ・日常点検（スクロール）
// ・履歴保存（IndexedDB）
// ・PDF生成（OFAフォーマット）
//
// 依存：
//  - js/db.js
//  - js/pdf.js

(function(){
  "use strict";

  /* =========================
     DOM 取得
  ========================= */

  const $ = (id)=>document.getElementById(id);

  // 基本情報
  const btnSaveProfile = $("btnSaveProfile");

  // 点呼
  const btnSaveDeparture = $("btnSaveDeparture");
  const btnSaveArrival   = $("btnSaveArrival");
  const btnPdfToday      = $("btnPdfToday");

  // 履歴
  const historyList = $("historyList");

  /* =========================
     共通ユーティリティ
  ========================= */

  function uuid(){
    return "id-" + Date.now() + "-" + Math.random().toString(16).slice(2);
  }

  function nowIso(){
    const d = new Date();
    const z = n=>String(n).padStart(2,"0");
    return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`;
  }

  function val(id){ return $(id)?.value?.trim() || ""; }
  function checked(id){ return $(id)?.checked || false; }

  function alertReq(msg){
    alert(msg);
    throw new Error(msg);
  }

  function num(v){
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  function todayKey(){
    const d = new Date();
    return d.toISOString().slice(0,10);
  }

  /* =========================
     プロファイル
  ========================= */

  async function saveProfile(){
    if(!val("p_name")) alertReq("氏名は必須です");
    if(!val("p_base")) alertReq("拠点は必須です");
    if(!val("p_license")) alertReq("免許番号は必須です");
    if(!val("p_phone")) alertReq("電話番号は必須です");
    if(!val("p_email")) alertReq("メールアドレスは必須です");

    const profile = {
      id: "me",
      name: val("p_name"),
      base: val("p_base"),
      carNo: val("p_car"),
      licenseNo: val("p_license"),
      phone: val("p_phone"),
      email: val("p_email"),
      updatedAt: Date.now()
    };

    await idbPut(STORE_PROFILE, profile);
    alert("基本情報を保存しました");
  }

  async function loadProfile(){
    const p = await idbGet(STORE_PROFILE, "me");
    if(!p) return null;

    $("p_name").value    = p.name || "";
    $("p_base").value    = p.base || "";
    $("p_car").value     = p.carNo || "";
    $("p_license").value = p.licenseNo || "";
    $("p_phone").value   = p.phone || "";
    $("p_email").value   = p.email || "";

    return p;
  }

  /* =========================
     日常点検
  ========================= */

  function collectChecklist(){
    const rows = document.querySelectorAll(".checkItem");
    const list = [];
    rows.forEach(row=>{
      const label = row.dataset.label;
      const ok = row.querySelector("input[type=checkbox]").checked;
      list.push({ label, ok });
    });
    return list;
  }

  /* =========================
     点呼 保存
  ========================= */

  async function saveTenko(type){
    const profile = await idbGet(STORE_PROFILE, "me");
    if(!profile) alertReq("先に基本情報を保存してください");

    const at = val("t_at") || nowIso();

    // 出発 / 帰着で ODO を分ける
    let odoStart = "";
    let odoEnd = "";
    if(type === "departure"){
      if(!val("odo_start")) alertReq("出発ODOを入力してください");
      odoStart = val("odo_start");
    }
    if(type === "arrival"){
      if(!val("odo_end")) alertReq("帰着ODOを入力してください");
      odoEnd = val("odo_end");
    }

    const tenko = {
      id: uuid(),
      type, // "departure" | "arrival"
      at,
      date: at.slice(0,10),

      // profile snapshot
      name: profile.name,
      base: profile.base,
      carNo: profile.carNo,
      licenseNo: profile.licenseNo,
      phone: profile.phone,
      email: profile.email,

      // health
      sleep: val("t_sleep"),
      temp: val("t_temp"),
      condition: val("t_condition"),
      fatigue: val("t_fatigue"),
      med: val("t_med"),
      medDetail: val("t_med_detail"),

      // alcohol
      alcValue: val("t_alc"),
      alcJudge: val("t_alc_judge"),

      // odo
      odoStart,
      odoEnd,

      // abnormal
      abnormal: val("t_abnormal"),
      abnormalDetail: val("t_abnormal_detail"),

      // checklist
      checklist: collectChecklist(),
      checkMemo: val("check_memo"),

      createdAt: Date.now()
    };

    await idbPut(STORE_TENKO, tenko);
    alert(type==="departure" ? "出発点呼を保存しました" : "帰着点呼を保存しました");

    await renderHistory();
  }

  /* =========================
     走行距離計算
  ========================= */

  async function calcOdoDiff(date){
    const all = await idbGetAll(STORE_TENKO);
    const dep = all.find(t=>t.type==="departure" && t.date===date);
    const arr = all.find(t=>t.type==="arrival" && t.date===date);
    if(!dep || !arr) return 0;
    return num(arr.odoEnd) - num(dep.odoStart);
  }

  /* =========================
     PDF生成
  ========================= */

  async function generateTodayPdf(){
    const profile = await idbGet(STORE_PROFILE, "me");
    if(!profile) alertReq("基本情報がありません");

    const date = todayKey();
    const tenkos = (await idbGetAll(STORE_TENKO)).filter(t=>t.date===date);

    const dep = tenkos.find(t=>t.type==="departure") || null;
    const arr = tenkos.find(t=>t.type==="arrival") || null;

    const odoDiff = await calcOdoDiff(date);

    // 日報はオプション（未入力OK）
    const daily = (await idbGetAll(STORE_DAILY)).find(d=>d.date===date) || null;

    await generateTodayPdf({
      profile,
      dep,
      arr,
      daily,
      odoDiff,
      files: {
        licenseImg: $("license_img")?.files?.[0],
        alcDepImg: $("alc_dep_img")?.files?.[0],
        alcArrImg: $("alc_arr_img")?.files?.[0]
      }
    });
  }

  /* =========================
     履歴表示
  ========================= */

  async function renderHistory(){
    const all = await idbGetAll(STORE_TENKO);
    if(all.length === 0){
      historyList.innerHTML = "<div class='muted'>履歴はまだありません</div>";
      return;
    }

    const rows = all
      .sort((a,b)=>b.createdAt-a.createdAt)
      .slice(0,30)
      .map(t=>`
        <div class="historyRow">
          <div>
            <b>${t.date}</b>
            ${t.type==="departure"?"出発":"帰着"}
          </div>
          <div class="small">${t.at.slice(11,16)} / ODO ${t.type==="departure"?t.odoStart:t.odoEnd}</div>
        </div>
      `).join("");

    historyList.innerHTML = rows;
  }

  /* =========================
     イベント
  ========================= */

  if(btnSaveProfile) btnSaveProfile.onclick = saveProfile;
  if(btnSaveDeparture) btnSaveDeparture.onclick = ()=>saveTenko("departure");
  if(btnSaveArrival) btnSaveArrival.onclick = ()=>saveTenko("arrival");
  if(btnPdfToday) btnPdfToday.onclick = generateTodayPdf;

  /* =========================
     初期化
  ========================= */

  (async function init(){
    await loadProfile();
    await renderHistory();
    if($("t_at")) $("t_at").value = nowIso();
  })();

})();
