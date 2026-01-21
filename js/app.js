// js/app.js
// 司令塔：基本情報→出発点呼/帰着点呼→日報→PDF→履歴表示
// 前提：js/db.js / js/pdf.js / js/csv.js / js/daily.js が読み込まれていること

// =========================
// 共通ユーティリティ
// =========================
function $(id){ return document.getElementById(id); }

function nowLocalDatetimeValue(){
  // datetime-local に入れられる形式（秒なし）
  const d = new Date();
  const pad = (n)=> String(n).padStart(2,"0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function todayStr(){
  return new Date().toISOString().slice(0,10);
}
function normalizeDate(v){
  return (v||"").toString().slice(0,10);
}
function safeNum(v){
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function clampText(v, max=5000){
  v = (v ?? "").toString();
  if(v.length > max) return v.slice(0,max);
  return v;
}
function required(value){
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function toast(msg){
  // 画面にtoastがある想定（無ければalert）
  const t = $("toast");
  if(!t){ alert(msg); return; }
  t.textContent = msg;
  t.style.display = "block";
  clearTimeout(toast._tm);
  toast._tm = setTimeout(()=> t.style.display="none", 2400);
}

function scrollToId(id){
  const el = $(id);
  if(!el) return;
  el.scrollIntoView({behavior:"smooth", block:"start"});
}

// =========================
// 基本情報（PROFILE）
// =========================
async function loadProfile(){
  const p = await idbGet(STORE_PROFILE, "me");
  return p || null;
}
async function saveProfile(){
  // 必須：氏名・拠点・免許番号・電話・メール
  const name = $("name")?.value || "";
  const base = $("base")?.value || "";
  const licenseNo = $("licenseNo")?.value || "";
  const phone = $("phone")?.value || "";
  const email = $("email")?.value || "";

  if(!required(name) || !required(base) || !required(licenseNo) || !required(phone) || !required(email)){
    toast("必須項目が未入力です（氏名/拠点/免許番号/電話/メール）");
    return false;
  }

  const profile = {
    id: "me",
    name: name.trim(),
    base: base.trim(), // 47都道府県は自由記入運用
    carNo: ($("carNo")?.value || "").trim(),
    licenseNo: licenseNo.trim(),
    phone: phone.trim(),
    email: email.trim(),
    updatedAt: new Date().toISOString()
  };

  await idbPut(STORE_PROFILE, profile);
  toast("基本情報を保存しました");
  setProfileBadge(profile);
  return true;
}

function setProfileBadge(profile){
  const el = $("profileState");
  if(!el) return;
  if(!profile){
    el.textContent = "基本情報：未保存";
    el.className = "badge bad";
  }else{
    el.textContent = `基本情報：保存済み（${profile.name} / ${profile.base}）`;
    el.className = "badge ok";
  }
}

// =========================
// 点呼（日常点呼：出発/帰着を分ける）
// =========================

// 点呼必須項目（共通）
function validateTenkoCommon(type){
  // type: "departure" or "arrival"
  const errors = [];

  const tenkoType = $("tenkoType")?.value || "";
  if(!required(tenkoType)) errors.push("点呼区分");

  const at = $("tenkoAt")?.value || "";
  if(!required(at)) errors.push("点呼日時");

  const method = $("method")?.value || "";
  if(!required(method)) errors.push("点呼方法");

  const sleep = $("sleep")?.value || "";
  const rest  = $("rest")?.value || ""; // 帰着は休憩、出発は睡眠（UI側でラベル変えてOK）
  // ここは運用：出発は睡眠必須、帰着は休憩必須
  if(type === "departure"){
    if(!required(sleep)) errors.push("睡眠時間");
  }else{
    if(!required(rest)) errors.push("休憩時間");
  }

  const temp = $("temp")?.value || "";
  if(!required(temp)) errors.push("体温");

  const condition = $("condition")?.value || "";
  if(!required(condition)) errors.push("体調");

  const fatigue = $("fatigue")?.value || "";
  if(!required(fatigue)) errors.push("疲労");

  const med = $("med")?.value || "";
  if(!required(med)) errors.push("服薬・体調影響");
  if(med === "あり"){
    const medDetail = $("medDetail")?.value || "";
    if(!required(medDetail)) errors.push("服薬内容");
  }

  const drink = $("drink")?.value || "";
  if(!required(drink)) errors.push("飲酒の有無");

  const alcBand = $("alcBand")?.value || "";
  if(!required(alcBand)) errors.push("酒気帯び有無");

  const alcValue = $("alcValue")?.value || "";
  if(!required(alcValue)) errors.push("アルコール数値");

  // 事業者/拠点（プロファイルの base に統一運用）
  // 車両番号（必須）
  const carNo = $("carNo")?.value || $("profileCarNo")?.value || "";
  // index.htmlが上の構造なら carNo は基本情報側にある想定。なければprofileの carNo を使う
  // ここでは profileから取るので必須は保存時に担保。
  // ただしユーザー要望「車両番号必須」なので、未入力ならエラー
  if(!required(($("carNo")?.value || "")) && !required((window.__profile?.carNo || ""))){
    errors.push("車両番号");
  }

  // 稼働案件（複数対応は日報側でも持つが、点呼側の必須として mainProject を使う）
  const mainProject = $("mainProject")?.value || "";
  if(!required(mainProject)) errors.push("稼働案件（メイン）");

  const area = $("workArea")?.value || "";
  if(!required(area)) errors.push("積込拠点/エリア");

  const danger = $("danger")?.value || "";
  if(!required(danger)) errors.push("危険物・高額品の有無");

  // 異常申告
  const abnormal = $("abnormal")?.value || "";
  if(!required(abnormal)) errors.push("異常の有無");
  if(abnormal === "あり"){
    const abnormalDetail = $("abnormalDetail")?.value || "";
    if(!required(abnormalDetail)) errors.push("異常内容");
  }

  // ODOは出発と帰着で分ける
  if(type === "departure"){
    const odoStart = $("odoStart")?.value || "";
    if(!required(odoStart)) errors.push("出発ODO");
  }else{
    const odoEnd = $("odoEnd")?.value || "";
    if(!required(odoEnd)) errors.push("帰着ODO");
  }

  return errors;
}

// 日常点検（フル）チェック収集
function collectDailyCheck(){
  // 想定：チェック項目はチェックボックス群 + NG選択/メモ
  // この関数は「存在するものを全部拾う」方式にして、HTML変更に強くする

  // ① checkbox形式： input[data-check-item]
  const items = [];
  document.querySelectorAll('input[type="checkbox"][data-check-item]').forEach(ch=>{
    const label = ch.getAttribute("data-check-item") || ch.value || ch.id || "項目";
    items.push({ label, ok: !!ch.checked });
  });

  // ② radio/ select 形式： select[data-check-item]
  document.querySelectorAll('select[data-check-item]').forEach(sel=>{
    const label = sel.getAttribute("data-check-item") || sel.id || "項目";
    const v = (sel.value || "").toUpperCase();
    if(v === "OK" || v === "NG"){
      items.push({ label, ok: v === "OK" });
    }else if(v){
      // "良/不良" などをOK/NGに寄せる
      items.push({ label, ok: !/NG|不良|×/i.test(v) });
    }
  });

  // NG詳細
  const checkMemo = ($("checkMemo")?.value || "").trim();

  // NG写真（ファイルは保存しない。PDF生成時のみ）
  const ngPhoto = $("checkNgPhoto")?.files?.[0] || null;

  return { checklist: items, checkMemo, ngPhoto };
}

async function saveTenko(type){
  // type: "departure" or "arrival"
  const profile = window.__profile;
  if(!profile){
    toast("先に「基本情報を保存」してください");
    scrollToId("name");
    return null;
  }

  const errors = validateTenkoCommon(type);
  if(errors.length){
    toast("必須未入力：" + errors.join(" / "));
    return null;
  }

  // idは日付＋区分＋時刻で一意
  const at = $("tenkoAt").value;
  const date = normalizeDate(at);
  const id = `tenko_${date}_${type}_${Date.now()}`;

  const dailyCheck = collectDailyCheck();

  const common = {
    id,
    name: profile.name,
    base: profile.base,
    carNo: (profile.carNo || $("carNo")?.value || "").trim(),
    licenseNo: profile.licenseNo,
    phone: profile.phone,
    email: profile.email,

    type,               // departure / arrival
    at,
    method: $("method").value,

    // 健康・状態
    sleep: (type==="departure") ? ($("sleep").value || "") : "",
    rest:  (type==="arrival")   ? ($("rest").value || "")  : "",
    temp: $("temp").value,
    condition: $("condition").value,
    fatigue: $("fatigue").value,
    med: $("med").value,
    medDetail: ($("medDetail")?.value || "").trim(),
    drink: $("drink").value,

    alcBand: $("alcBand").value,
    alcValue: $("alcValue").value,
    alcJudge: ($("alcJudge")?.value || ""), // UIがある場合
    // アルコール写真（ファイルは保存しない）
    // → PDF生成時に files として渡す

    // 業務
    mainProject: ($("mainProject")?.value || "").trim(),
    workArea: ($("workArea")?.value || "").trim(),
    danger: ($("danger")?.value || "").trim(),

    // 異常申告
    abnormal: $("abnormal").value,
    abnormalDetail: ($("abnormalDetail")?.value || "").trim(),

    // ODO
    odoStart: (type==="departure") ? ($("odoStart").value || "") : "",
    odoEnd:   (type==="arrival") ? ($("odoEnd").value || "") : "",

    // 日常点検
    checklist: dailyCheck.checklist,
    checkMemo: dailyCheck.checkMemo,

    createdAt: new Date().toISOString()
  };

  // odoDiffは後で「出発と帰着が揃ったら」計算して、レコードにも反映しておく
  common.odoDiff = 0;

  await idbPut(STORE_TENKO, common);

  toast(type==="departure" ? "出発点呼を保存しました" : "帰着点呼を保存しました");

  // 保存後：今日の出発/帰着が揃っていれば odoDiff を計算して双方に入れる
  await updateOdoDiffIfPaired(date, profile.name, profile.base);

  // 履歴表示更新
  await renderHistory();

  return common;
}

// 今日の出発/帰着を探してODO差分反映
async function updateOdoDiffIfPaired(date, name, base){
  const all = await idbGetAll(STORE_TENKO);
  const dep = all
    .filter(r => normalizeDate(r.at)===date && r.type==="departure" && r.name===name && r.base===base)
    .sort((a,b)=> String(b.at).localeCompare(String(a.at)))[0] || null;

  const arr = all
    .filter(r => normalizeDate(r.at)===date && r.type==="arrival" && r.name===name && r.base===base)
    .sort((a,b)=> String(b.at).localeCompare(String(a.at)))[0] || null;

  if(!dep || !arr) return;

  const diff = safeNum(arr.odoEnd) - safeNum(dep.odoStart);
  const odoDiff = diff > 0 ? diff : 0;

  // dep/arr それぞれに反映（idbPutで上書き）
  dep.odoDiff = odoDiff;
  arr.odoDiff = odoDiff;
  await idbPut(STORE_TENKO, dep);
  await idbPut(STORE_TENKO, arr);

  // 日報にも反映（存在していれば）
  const daily = await idbGet(STORE_DAILY, "daily_"+date);
  if(daily){
    daily.odoDiff = odoDiff;
    await idbPut(STORE_DAILY, daily);
  }

  // 画面表示があるなら反映
  if($("odoDiffView")) $("odoDiffView").textContent = `${odoDiff} km`;
}

// =========================
// 日報（任意入力）保存
// =========================
async function saveDailyFromUI(){
  const profile = window.__profile;
  if(!profile){
    toast("先に「基本情報を保存」してください");
    return false;
  }

  const date = $("dailyDate")?.value || todayStr();

  // odoDiff（tenkoから拾う：今日の最新ペア）
  const all = await idbGetAll(STORE_TENKO);
  const dep = all
    .filter(r => normalizeDate(r.at)===date && r.type==="departure" && r.name===profile.name && r.base===profile.base)
    .sort((a,b)=> String(b.at).localeCompare(String(a.at)))[0] || null;
  const arr = all
    .filter(r => normalizeDate(r.at)===date && r.type==="arrival" && r.name===profile.name && r.base===profile.base)
    .sort((a,b)=> String(b.at).localeCompare(String(a.at)))[0] || null;

  const odoDiff = (dep && arr) ? (safeNum(arr.odoEnd) - safeNum(dep.odoStart)) : 0;

  // js/daily.js の saveDaily を使う（projectsも含めて保存）
  await saveDaily(profile, odoDiff);

  await renderHistory();
  return true;
}

// =========================
// PDF生成（OFAフォーマット）
// =========================
async function generateTodayPdfFromUI(){
  const profile = window.__profile;
  if(!profile){
    toast("先に「基本情報を保存」してください");
    return;
  }

  // 対象日付：点呼日時 or 日付入力から決める
  const dateFromTenko = normalizeDate($("tenkoAt")?.value || "");
  const date = dateFromTenko || ($("dailyDate")?.value || todayStr());

  // 今日（指定日）の最新 出発/帰着 を取得
  const tenkoAll = await idbGetAll(STORE_TENKO);
  const dep = tenkoAll
    .filter(r => normalizeDate(r.at)===date && r.type==="departure" && r.name===profile.name && r.base===profile.base)
    .sort((a,b)=> String(b.at).localeCompare(String(a.at)))[0] || null;

  const arr = tenkoAll
    .filter(r => normalizeDate(r.at)===date && r.type==="arrival" && r.name===profile.name && r.base===profile.base)
    .sort((a,b)=> String(b.at).localeCompare(String(a.at)))[0] || null;

  // 日報（任意）
  const daily = await idbGet(STORE_DAILY, "daily_"+date);

  // odoDiff
  let odoDiff = 0;
  if(dep && arr){
    odoDiff = safeNum(arr.odoEnd) - safeNum(dep.odoStart);
    if(odoDiff < 0) odoDiff = 0;
  }else{
    // 片方だけならそのまま0（嘘にならない）
    odoDiff = 0;
  }

  // 画像ファイル：端末保存しない。PDF生成時だけ使用
  const files = {
    licenseImg: $("licenseImg")?.files?.[0] || null,
    alcDepImg: $("alcDepImg")?.files?.[0] || null,
    alcArrImg: $("alcArrImg")?.files?.[0] || null,
  };

  // 日常点検NG写真（あれば）
  // ※PDFへ入れたい場合は pdf.js側を拡張するが、まずは安定優先。
  // const ngPhoto = $("checkNgPhoto")?.files?.[0] || null;

  await generateTodayPdf({ profile, dep, arr, daily, odoDiff, files });
  toast("PDFを作成しました（端末内生成）");
}

// =========================
// CSV出力（ワンクリック）
// =========================
async function exportCsvFromUI(){
  // 期間は入力があればそれを使う。無ければ全件
  const from = $("csvFrom")?.value || "";
  const to   = $("csvTo")?.value || "";
  const base = $("csvBase")?.value || "";
  const name = $("csvName")?.value || "";
  await exportCsvSearchResult({ from, to, base, name });
  toast("CSVを出力しました");
}

// =========================
// 履歴表示（端末内）
// =========================
async function renderHistory(){
  const box = $("historyBox");
  if(!box) return;

  const profile = window.__profile;
  if(!profile){
    box.innerHTML = `<div class="small">基本情報を保存すると履歴が表示されます</div>`;
    return;
  }

  const tenkoAll = await idbGetAll(STORE_TENKO);
  const dailyAll = await idbGetAll(STORE_DAILY);

  // 自分のみ表示
  const myTenko = tenkoAll
    .filter(r => r.name===profile.name && r.base===profile.base)
    .sort((a,b)=> String(b.at).localeCompare(String(a.at)))
    .slice(0, 50);

  const myDaily = dailyAll
    .filter(r => r.name===profile.name && r.base===profile.base)
    .sort((a,b)=> String(b.date).localeCompare(String(a.date)))
    .slice(0, 50);

  const tenkoHtml = myTenko.map(r=>{
    const d = normalizeDate(r.at);
    const t = (r.at||"").slice(11,16);
    const label = (r.type==="departure") ? "出発" : "帰着";
    const odo = (r.type==="departure") ? (r.odoStart||"") : (r.odoEnd||"");
    return `
      <div class="histRow">
        <div class="histL">
          <div class="histTitle">${d} ${t} / ${label}</div>
          <div class="histSub">案件:${r.mainProject||"-"} / ODO:${odo} / アルコール:${r.alcValue||"-"}</div>
        </div>
        <div class="histR">
          <button class="miniBtn" data-openpdf="${d}">PDF</button>
        </div>
      </div>
    `;
  }).join("");

  const dailyHtml = myDaily.map(r=>{
    return `
      <div class="histRow">
        <div class="histL">
          <div class="histTitle">${r.date} / 日報</div>
          <div class="histSub">案件:${r.mainProject||"-"} / 走行:${r.odoDiff||0}km / 売上:${r.salesTotal||0}</div>
        </div>
      </div>
    `;
  }).join("");

  box.innerHTML = `
    <div class="h2">履歴（最新50）</div>
    <div class="small">※端末内（IndexedDB）に保存。別端末には同期しません。</div>
    <div class="divider"></div>
    <div class="h3">点呼</div>
    ${tenkoHtml || `<div class="small">点呼履歴がありません</div>`}
    <div class="divider"></div>
    <div class="h3">日報</div>
    ${dailyHtml || `<div class="small">日報履歴がありません</div>`}
  `;

  // PDFボタン（履歴から該当日PDFを作る）
  box.querySelectorAll('button[data-openpdf]').forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      const d = btn.getAttribute("data-openpdf");
      // tenkoAt/dailyDateを一時的にセットしてPDF生成を使う
      if($("dailyDate")) $("dailyDate").value = d;
      await generateTodayPdfFromUI();
    });
  });
}

// =========================
// 画面モード（出発/帰着の明確化）
// =========================
function applyTenkoMode(){
  const typeLabel = $("tenkoType")?.value || "";
  const isDep = typeLabel === "出発";
  const isArr = typeLabel === "帰着";

  // 出発は出発ODO、帰着は帰着ODOのみ入力させる（嘘防止）
  if($("odoStartWrap")) $("odoStartWrap").style.display = isDep ? "block" : "none";
  if($("odoEndWrap"))   $("odoEndWrap").style.display   = isArr ? "block" : "none";

  // 睡眠/休憩の表示切替（idは sleep/rest）
  if($("sleepWrap")) $("sleepWrap").style.display = isDep ? "block" : "none";
  if($("restWrap"))  $("restWrap").style.display  = isArr ? "block" : "none";
}

// =========================
// 初期化
// =========================
async function initApp(){
  // tenkoAt は自動入力を「入れるだけ」(ユーザーが変更できる)
  if($("tenkoAt") && !$("tenkoAt").value) $("tenkoAt").value = nowLocalDatetimeValue();

  // 日付
  if($("dailyDate") && !$("dailyDate").value) $("dailyDate").value = todayStr();

  // プロファイル読み込み
  window.__profile = await loadProfile();
  setProfileBadge(window.__profile);

  // 日報側初期化（projects）
  if(typeof initDaily === "function") initDaily();

  // 点呼区分が変わったら表示制御
  if($("tenkoType")){
    $("tenkoType").addEventListener("change", applyTenkoMode);
    applyTenkoMode();
  }

  // ボタン紐付け（存在するものだけ）
  if($("btnSaveProfile")) $("btnSaveProfile").addEventListener("click", async ()=>{
    const ok = await saveProfile();
    if(ok){
      window.__profile = await loadProfile();
      await renderHistory();
    }
  });

  // 出発点呼保存
  if($("btnSaveDeparture")) $("btnSaveDeparture").addEventListener("click", async ()=>{
    // tenkoTypeを出発にセット（間違い防止）
    if($("tenkoType")) $("tenkoType").value = "出発";
    applyTenkoMode();
    await saveTenko("departure");
  });

  // 帰着点呼保存
  if($("btnSaveArrival")) $("btnSaveArrival").addEventListener("click", async ()=>{
    if($("tenkoType")) $("tenkoType").value = "帰着";
    applyTenkoMode();
    await saveTenko("arrival");
  });

  // 日報保存（任意）
  if($("btnSaveDaily")) $("btnSaveDaily").addEventListener("click", async ()=>{
    await saveDailyFromUI();
  });

  // PDF生成
  if($("btnPdfToday")) $("btnPdfToday").addEventListener("click", async ()=>{
    await generateTodayPdfFromUI();
  });

  // CSV出力（検索条件）
  if($("btnCsv")) $("btnCsv").addEventListener("click", async ()=>{
    await exportCsvFromUI();
  });

  // 今日の日報CSV（daily.jsの関数）
  if($("btnDailyCsvToday")) $("btnDailyCsvToday").addEventListener("click", async ()=>{
    if(typeof exportTodayDailyCsv === "function") await exportTodayDailyCsv();
  });

  // 履歴
  await renderHistory();
}

// 起動
document.addEventListener("DOMContentLoaded", initApp);

// グローバル公開（HTMLのonclickから呼ばれる場合の保険）
window.saveProfile = saveProfile;
window.generateTodayPdfFromUI = generateTodayPdfFromUI;
window.saveDailyFromUI = saveDailyFromUI;
