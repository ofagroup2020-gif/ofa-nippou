/* ===== 端末完結（IndexedDB） ===== */
const DB_NAME = "ofa_nippou_db";
const DB_VER = 1;
const STORE = "records";
const STORE_PROFILE = "profile";

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const st = db.createObjectStore(STORE, { keyPath: "id" });
        st.createIndex("byType", "type", { unique: false });
        st.createIndex("byDate", "date", { unique: false });
        st.createIndex("byName", "name", { unique: false });
        st.createIndex("byBase", "base", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_PROFILE)) {
        db.createObjectStore(STORE_PROFILE, { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbPut(storeName, obj) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).put(obj);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

async function idbGet(storeName, key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const req = tx.objectStore(storeName).get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function idbGetAll() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function idbDeleteAll() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

/* ===== ユーティリティ ===== */
const $ = (id) => document.getElementById(id);
const nowISO = () => new Date().toISOString();
const pad2 = (n) => String(n).padStart(2, "0");

function localDateStr(d = new Date()) {
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
}
function localTimeStr(d = new Date()) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function setMiss(el, miss) {
  if (!el) return;
  el.classList.toggle("miss", !!miss);
}

function must(v) { return v !== null && v !== undefined && String(v).trim() !== ""; }

function calcDurationMin(startHHMM, endHHMM) {
  if (!startHHMM || !endHHMM) return 0;
  const [sh, sm] = startHHMM.split(":").map(Number);
  const [eh, em] = endHHMM.split(":").map(Number);
  let s = sh*60+sm, e = eh*60+em;
  // 日跨ぎ対応
  if (e < s) e += 24*60;
  return Math.max(0, e - s);
}

function downloadText(filename, text, mime="text/plain") {
  const blob = new Blob([text], {type: mime});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function toCSV(rows) {
  const esc = (s) => `"${String(s ?? "").replaceAll('"','""')}"`;
  const cols = Object.keys(rows[0] || {});
  const head = cols.map(esc).join(",");
  const body = rows.map(r => cols.map(c => esc(r[c])).join(",")).join("\n");
  return head + "\n" + body;
}

async function fileToDataUrl(file) {
  if (!file) return null;
  return new Promise((resolve) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.readAsDataURL(file);
  });
}

/* ===== 点検項目定義 ===== */
const INSPECT_A = [
  "タイヤ空気圧",
  "タイヤ溝/ひび割れ",
  "ホイールナット緩み",
  "ブレーキ効き",
  "パーキングブレーキ",
  "ハンドル操作",
  "ライト（前照灯/尾灯/ブレーキ/ウインカー/ハザード）",
  "ワイパー/ウォッシャー液",
  "ミラー/ガラス破損"
];
const INSPECT_B = [
  "エンジンオイル量",
  "冷却水",
  "バッテリー（警告灯含む）",
  "異音/異臭/異常振動",
  "漏れ（オイル/冷却水）",
  "外装破損",
  "積載状態（偏り/過積載なし）"
];
const INSPECT_C = [
  "消火器",
  "三角停止板",
  "反射ベスト",
  "ジャッキ/工具（任意でもOK）"
];

function renderChecklist(containerId, items, prefix) {
  const wrap = $(containerId);
  wrap.innerHTML = "";
  items.forEach((label, idx) => {
    const idOk = `${prefix}_${idx}_ok`;
    const idNg = `${prefix}_${idx}_ng`;
    const row = document.createElement("div");
    row.className = "check";
    row.innerHTML = `
      <label>${label}</label>
      <div class="mini">
        <label><input type="radio" name="${prefix}_${idx}" id="${idOk}" value="OK"> OK</label>
        <label><input type="radio" name="${prefix}_${idx}" id="${idNg}" value="NG"> NG</label>
      </div>
    `;
    wrap.appendChild(row);
  });
}

/* ===== 案件（複数） ===== */
function jobRowTemplate(i) {
  return `
  <div class="item" data-job="${i}">
    <div class="itemTop">
      <div class="badge">案件 #${i+1}</div>
      <button class="btn small danger ghost" type="button" data-deljob="${i}">削除</button>
    </div>
    <div class="grid2">
      <div>
        <label class="lbl">稼働案件名<span class="req">*</span></label>
        <input class="in" data-jname="${i}" placeholder="例：Amazon / ヤマト / スポット / 企業" />
      </div>
      <div>
        <label class="lbl">積込拠点/エリア<span class="req">*</span></label>
        <input class="in" data-jarea="${i}" placeholder="例：鹿児島市内 / 熊本南 / 博多" />
      </div>
      <div>
        <label class="lbl">危険物の有無<span class="req">*</span></label>
        <select class="in" data-jdanger="${i}">
          <option value="">選択</option>
          <option>なし</option>
          <option>あり</option>
        </select>
      </div>
      <div>
        <label class="lbl">高額品の有無<span class="req">*</span></label>
        <select class="in" data-jhigh="${i}">
          <option value="">選択</option>
          <option>なし</option>
          <option>あり</option>
        </select>
      </div>
    </div>
  </div>`;
}

function rebuildJobsUI(jobs) {
  const wrap = $("jobsWrap");
  wrap.innerHTML = "";
  jobs.forEach((_, i) => {
    const div = document.createElement("div");
    div.innerHTML = jobRowTemplate(i);
    wrap.appendChild(div.firstElementChild);
  });

  // 値復元
  jobs.forEach((j, i) => {
    document.querySelector(`[data-jname="${i}"]`).value = j.name || "";
    document.querySelector(`[data-jarea="${i}"]`).value = j.area || "";
    document.querySelector(`[data-jdanger="${i}"]`).value = j.danger || "";
    document.querySelector(`[data-jhigh="${i}"]`).value = j.high || "";
  });

  wrap.querySelectorAll("[data-deljob]").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.getAttribute("data-deljob"));
      jobs.splice(idx, 1);
      if (jobs.length === 0) jobs.push({name:"", area:"", danger:"", high:""});
      rebuildJobsUI(jobs);
    });
  });
}

/* ===== 状態 ===== */
let jobs = [{name:"", area:"", danger:"", high:""}];
let monthlyCache = null; // 月報計算結果

/* ===== 起動 ===== */
window.addEventListener("DOMContentLoaded", async () => {
  // tabs
  document.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tabpane").forEach(p => p.classList.remove("active"));
      btn.classList.add("active");
      $(`tab-${btn.dataset.tab}`).classList.add("active");
      if (btn.dataset.tab === "history") refreshHistory();
    });
  });

  // 点呼日時自動
  $("tenkoAt").value = `${localDateStr()} ${localTimeStr()}`;

  // 条件表示
  $("medication").addEventListener("change", () => {
    $("medicationDetailWrap").style.display = $("medication").value === "あり" ? "block" : "none";
  });
  $("abnormal").addEventListener("change", () => {
    $("abnormalDetailWrap").style.display = $("abnormal").value === "あり" ? "block" : "none";
  });
  $("claimFlag").addEventListener("change", () => {
    $("claimDetailWrap").style.display = $("claimFlag").value === "あり" ? "block" : "none";
  });
  $("accidentFlag").addEventListener("change", () => {
    $("accidentDetailWrap").style.display = $("accidentFlag").value === "あり" ? "block" : "none";
  });

  // 点検UI
  renderChecklist("inspectA", INSPECT_A, "A");
  renderChecklist("inspectB", INSPECT_B, "B");
  renderChecklist("inspectC", INSPECT_C, "C");

  // 点検NG集計
  document.addEventListener("change", (e) => {
    if (e.target && e.target.name && (e.target.name.startsWith("A_") || e.target.name.startsWith("B_") || e.target.name.startsWith("C_"))) {
      const ng = collectInspect().ngList;
      $("ngItems").value = ng.join(" / ");
    }
  });

  // 案件UI
  rebuildJobsUI(jobs);
  $("btnAddJob").addEventListener("click", () => {
    jobs.push({name:"", area:"", danger:"", high:""});
    rebuildJobsUI(jobs);
  });

  // 日報：利益自動
  ["payDaily","payIncentive","expToll","expParking","expFuel","expOther"].forEach(id => {
    $(id).addEventListener("input", updateProfit);
  });
  updateProfit();

  // 初期プロフィール読み込み
  await loadProfile();

  // 日報日付初期値
  $("workDate").value = localDateStr();

  // ボタン
  $("btnSaveTenko").addEventListener("click", saveTenko);
  $("btnTenkoPDF").addEventListener("click", makeTenkoPDF);
  $("btnTenkoCSV").addEventListener("click", exportTenkoCSV);

  $("btnSaveDaily").addEventListener("click", saveDaily);
  $("btnDailyPDF").addEventListener("click", makeDailyPDF);
  $("btnDailyCSV").addEventListener("click", exportDailyCSV);

  $("btnMakeMonthly").addEventListener("click", calcMonthly);
  $("btnMonthlyPDF").addEventListener("click", monthlyPDF);
  $("btnMonthlyCSV").addEventListener("click", monthlyCSV);

  $("btnWipe").addEventListener("click", async () => {
    if (!confirm("この端末の保存データを全削除します。よろしいですか？")) return;
    await idbDeleteAll();
    refreshHistory();
    alert("削除しました。");
  });

  // バックアップ export/import
  $("btnBackupExport").addEventListener("click", exportBackup);
  $("btnBackupImport").addEventListener("click", () => $("fileBackup").click());
  $("fileBackup").addEventListener("change", importBackup);

  // プロフィール自動保存
  ["profileName","profileBase","profileCarNo","profileLicenseNo"].forEach(id => {
    $(id).addEventListener("change", saveProfile);
  });

  $("pillStatus").textContent = "🟢 端末内保存：有効（サーバーなし）";
});

/* ===== プロフィール ===== */
async function saveProfile() {
  const licensePhoto = await fileToDataUrl($("profileLicensePhoto").files?.[0] || null);
  const obj = {
    key: "profile",
    name: $("profileName").value.trim(),
    base: $("profileBase").value,
    carNo: $("profileCarNo").value.trim(),
    licenseNo: $("profileLicenseNo").value.trim(),
    licensePhoto: licensePhoto || (await idbGet(STORE_PROFILE, "profile"))?.licensePhoto || null
  };
  await idbPut(STORE_PROFILE, obj);
}

async function loadProfile() {
  const p = await idbGet(STORE_PROFILE, "profile");
  if (!p) return;
  $("profileName").value = p.name || "";
  $("profileBase").value = p.base || "";
  $("profileCarNo").value = p.carNo || "";
  $("profileLicenseNo").value = p.licenseNo || "";
  // licensePhotoはプレビュー不要（PDF生成時に使う）
}

async function requireProfile() {
  const name = $("profileName").value.trim();
  const base = $("profileBase").value;
  const carNo = $("profileCarNo").value.trim();
  const licenseNo = $("profileLicenseNo").value.trim();

  setMiss($("profileName"), !must(name));
  setMiss($("profileBase"), !must(base));
  setMiss($("profileCarNo"), !must(carNo));
  setMiss($("profileLicenseNo"), !must(licenseNo));

  if (!must(name) || !must(base) || !must(carNo) || !must(licenseNo)) {
    alert("プロフィール（氏名/拠点/車両番号/免許証番号）は必須です。先に入力してください。");
    return null;
  }
  await saveProfile();
  const p = await idbGet(STORE_PROFILE, "profile");
  return p;
}

/* ===== 点検収集 ===== */
function collectInspect() {
  const all = [];
  const ngList = [];
  const pick = (items, prefix) => {
    items.forEach((label, idx) => {
      const name = `${prefix}_${idx}`;
      const v = document.querySelector(`input[name="${name}"]:checked`)?.value || "";
      all.push({label, result: v});
      if (v === "NG") ngList.push(label);
    });
  };
  pick(INSPECT_A, "A");
  pick(INSPECT_B, "B");
  pick(INSPECT_C, "C");
  return {all, ngList};
}

function validateInspect() {
  const {all, ngList} = collectInspect();
  const missing = all.filter(x => !x.result).length;
  if (missing > 0) {
    alert("日常点検（車両点検）は全項目必須です（OK/NGを全て選択してください）。");
    return false;
  }
  if (ngList.length > 0 && !$("ngMemo").value.trim()) {
    alert("点検NGがある場合は『NG詳細メモ』が必須です。");
    setMiss($("ngMemo"), true);
    return false;
  }
  setMiss($("ngMemo"), false);
  return true;
}

/* ===== 案件収集 ===== */
function collectJobs() {
  // UIから読み取る
  const out = [];
  const wrap = $("jobsWrap");
  const items = wrap.querySelectorAll("[data-job]");
  items.forEach((_, i) => {
    const name = document.querySelector(`[data-jname="${i}"]`)?.value?.trim() || "";
    const area = document.querySelector(`[data-jarea="${i}"]`)?.value?.trim() || "";
    const danger = document.querySelector(`[data-jdanger="${i}"]`)?.value || "";
    const high = document.querySelector(`[data-jhigh="${i}"]`)?.value || "";
    out.push({name, area, danger, high});
  });
  return out;
}

function validateJobs(list) {
  if (!list.length) return false;
  for (let i=0;i<list.length;i++){
    const j = list[i];
    if (!must(j.name) || !must(j.area) || !must(j.danger) || !must(j.high)) {
      alert("案件（複数）の必須項目が未入力です。全案件で『案件名/エリア/危険物/高額品』を入力してください。");
      return false;
    }
  }
  return true;
}

/* ===== 点呼保存 ===== */
async function saveTenko() {
  const profile = await requireProfile();
  if (!profile) return;

  // 必須
  const type = $("tenkoType").value;
  const at = $("tenkoAt").value.trim() || `${localDateStr()} ${localTimeStr()}`;

  const method = $("tenkoMethod").value;
  const sleep = $("sleepHours").value;
  const temp = $("bodyTemp").value;
  const cond = $("condition").value;
  const fat = $("fatigue").value;
  const med = $("medication").value;
  const medDetail = $("medicationDetail").value.trim();
  const drank = $("drank").value;
  const judge = $("alcoholJudge").value;
  const alcVal = $("alcoholValue").value;

  // バリデーション
  const misses = [];
  if (!must(method)) misses.push(["tenkoMethod", true]);
  if (!must(sleep)) misses.push(["sleepHours", true]);
  if (!must(temp)) misses.push(["bodyTemp", true]);
  if (!must(cond)) misses.push(["condition", true]);
  if (!must(fat)) misses.push(["fatigue", true]);
  if (!must(med)) misses.push(["medication", true]);
  if (med === "あり" && !must(medDetail)) misses.push(["medicationDetail", true]);
  if (!must(drank)) misses.push(["drank", true]);
  if (!must(judge)) misses.push(["alcoholJudge", true]);
  if (!must(alcVal)) misses.push(["alcoholValue", true]);

  misses.forEach(([id]) => setMiss($(id), true));
  ["tenkoMethod","sleepHours","bodyTemp","condition","fatigue","medication","medicationDetail","drank","alcoholJudge","alcoholValue"]
    .filter(id => !misses.find(m => m[0]===id)).forEach(id => setMiss($(id), false));

  if (misses.length) {
    alert("点呼の必須項目が未入力です（赤枠を確認してください）。");
    return;
  }

  // 異常
  const abnormal = $("abnormal").value;
  const abnormalDetail = $("abnormalDetail").value.trim();
  if (!must(abnormal)) {
    setMiss($("abnormal"), true);
    alert("異常の有無は必須です。");
    return;
  }
  setMiss($("abnormal"), false);
  if (abnormal === "あり" && !must(abnormalDetail)) {
    setMiss($("abnormalDetail"), true);
    alert("異常ありの場合、異常内容は必須です。");
    return;
  }
  setMiss($("abnormalDetail"), false);

  // 点検
  if (!validateInspect()) return;

  // 案件
  const jobList = collectJobs();
  if (!validateJobs(jobList)) return;

  // 写真（PDF用に保存）
  const alcoholPhoto = await fileToDataUrl($("alcoholPhoto").files?.[0] || null);
  const abnormalPhoto = await fileToDataUrl($("abnormalPhoto").files?.[0] || null);
  const ngPhoto = await fileToDataUrl($("ngPhoto").files?.[0] || null);

  const inspect = collectInspect();

  const dateKey = at.split(" ")[0] || localDateStr();
  const id = `tenko_${dateKey}_${type}_${Date.now()}`;

  const rec = {
    id,
    kind: "tenko",
    type: "tenko",
    tenkoType: type,
    atISO: nowISO(),
    atText: at,
    date: dateKey,
    name: profile.name,
    base: profile.base,
    carNo: profile.carNo,
    licenseNo: profile.licenseNo,

    method,
    sleepHours: Number(sleep),
    bodyTemp: Number(temp),
    condition: cond,
    fatigue: fat,
    medication: med,
    medicationDetail: med === "あり" ? medDetail : "",
    drank,
    alcoholJudge: judge,
    alcoholValue: Number(alcVal),

    jobs: jobList,
    abnormal,
    abnormalDetail: abnormal === "あり" ? abnormalDetail : "",

    inspectAll: inspect.all,
    inspectNG: inspect.ngList,
    ngMemo: $("ngMemo").value.trim(),
    ngItems: inspect.ngList.join(" / "),

    photos: {
      alcoholPhoto,
      abnormalPhoto,
      ngPhoto
    }
  };

  await idbPut(STORE, rec);
  alert("点呼を保存しました（端末内）。");
}

/* ===== 日報 ===== */
function updateProfit() {
  const d = Number($("payDaily").value || 0);
  const i = Number($("payIncentive").value || 0);
  const e = Number($("expToll").value || 0) + Number($("expParking").value || 0) + Number($("expFuel").value || 0) + Number($("expOther").value || 0);
  const p = d + i - e;
  $("profit").value = p.toLocaleString();
}

async function saveDaily() {
  const profile = await requireProfile();
  if (!profile) return;

  const workDate = $("workDate").value;
  const workCase = $("workCase").value.trim();
  const start = $("workStart").value;
  const end = $("workEnd").value;
  const breakMin = $("breakMin").value;

  const delivered = $("delivered").value;
  const claimFlag = $("claimFlag").value;
  const claimDetail = $("claimDetail").value.trim();
  const accidentFlag = $("accidentFlag").value;
  const accidentDetail = $("accidentDetail").value.trim();
  const delayReason = $("delayReason").value;
  const tomorrowPlan = $("tomorrowPlan").value;

  // 必須
  const reqs = [
    ["workDate", workDate],
    ["workCase", workCase],
    ["workStart", start],
    ["workEnd", end],
    ["breakMin", breakMin],
    ["delivered", delivered],
    ["claimFlag", claimFlag],
    ["accidentFlag", accidentFlag],
    ["delayReason", delayReason],
    ["tomorrowPlan", tomorrowPlan],
    ["payDaily", $("payDaily").value]
  ];
  let miss = false;
  reqs.forEach(([id, v]) => {
    const ok = must(v);
    setMiss($(id), !ok);
    if (!ok) miss = true;
  });
  if (claimFlag === "あり") {
    setMiss($("claimDetail"), !must(claimDetail));
    if (!must(claimDetail)) miss = true;
  } else setMiss($("claimDetail"), false);

  if (accidentFlag === "あり") {
    setMiss($("accidentDetail"), !must(accidentDetail));
    if (!must(accidentDetail)) miss = true;
  } else setMiss($("accidentDetail"), false);

  if (miss) {
    alert("日報の必須項目が未入力です（赤枠を確認してください）。");
    return;
  }

  const distanceKm = Number($("distanceKm").value || 0);
  const absent = Number($("absent").value || 0);
  const redelivery = Number($("redelivery").value || 0);
  const returned = Number($("returned").value || 0);

  const payDaily = Number($("payDaily").value || 0);
  const payIncentive = Number($("payIncentive").value || 0);
  const expToll = Number($("expToll").value || 0);
  const expParking = Number($("expParking").value || 0);
  const expFuel = Number($("expFuel").value || 0);
  const expOther = Number($("expOther").value || 0);
  const expTotal = expToll + expParking + expFuel + expOther;
  const profit = payDaily + payIncentive - expTotal;

  const dailyPhoto = await fileToDataUrl($("dailyPhoto").files?.[0] || null);

  const id = `daily_${workDate}_${Date.now()}`;
  const rec = {
    id,
    kind: "daily",
    type: "daily",
    date: workDate,
    name: profile.name,
    base: profile.base,
    carNo: profile.carNo,
    licenseNo: profile.licenseNo,

    workCase,
    workStart: start,
    workEnd: end,
    workMinutes: calcDurationMin(start, end),
    breakMin: Number(breakMin),

    distanceKm,
    delivered: Number(delivered),
    absent,
    redelivery,
    returned,

    claimFlag,
    claimDetail: claimFlag === "あり" ? claimDetail : "",

    payDaily,
    payIncentive,
    expToll,
    expParking,
    expFuel,
    expOther,
    expTotal,
    profit,

    accidentFlag,
    accidentDetail: accidentFlag === "あり" ? accidentDetail : "",

    delayReason,
    tomorrowPlan,

    photos: { dailyPhoto }
  };

  await idbPut(STORE, rec);
  alert("日報を保存しました（端末内）。");
}

/* ===== PDF/CSV ===== */
async function makeTenkoPDF() {
  const profile = await requireProfile();
  if (!profile) return;

  // 直近入力状態からPDF（保存しなくても作れる）
  const inspect = collectInspect();
  if (!validateInspect()) return;
  const jobList = collectJobs();
  if (!validateJobs(jobList)) return;

  const data = {
    profile,
    tenko: {
      tenkoType: $("tenkoType").value,
      atText: $("tenkoAt").value || `${localDateStr()} ${localTimeStr()}`,
      method: $("tenkoMethod").value,
      sleepHours: $("sleepHours").value,
      bodyTemp: $("bodyTemp").value,
      condition: $("condition").value,
      fatigue: $("fatigue").value,
      medication: $("medication").value,
      medicationDetail: $("medicationDetail").value.trim(),
      drank: $("drank").value,
      alcoholJudge: $("alcoholJudge").value,
      alcoholValue: $("alcoholValue").value,
      jobs: jobList,
      abnormal: $("abnormal").value,
      abnormalDetail: $("abnormalDetail").value.trim(),
      inspectAll: inspect.all,
      inspectNG: inspect.ngList,
      ngMemo: $("ngMemo").value.trim(),
      photos: {
        licensePhoto: (await idbGet(STORE_PROFILE, "profile"))?.licensePhoto || null,
        alcoholPhoto: await fileToDataUrl($("alcoholPhoto").files?.[0] || null),
        abnormalPhoto: await fileToDataUrl($("abnormalPhoto").files?.[0] || null),
        ngPhoto: await fileToDataUrl($("ngPhoto").files?.[0] || null),
      }
    }
  };

  await window.OFA_PDF.makeTenkoPDF(data);
}

async function makeDailyPDF() {
  const profile = await requireProfile();
  if (!profile) return;

  // 直近入力状態からPDF
  const payDaily = Number($("payDaily").value || 0);
  const payIncentive = Number($("payIncentive").value || 0);
  const expToll = Number($("expToll").value || 0);
  const expParking = Number($("expParking").value || 0);
  const expFuel = Number($("expFuel").value || 0);
  const expOther = Number($("expOther").value || 0);
  const expTotal = expToll + expParking + expFuel + expOther;
  const profit = payDaily + payIncentive - expTotal;

  const daily = {
    date: $("workDate").value,
    workCase: $("workCase").value.trim(),
    workStart: $("workStart").value,
    workEnd: $("workEnd").value,
    workMinutes: calcDurationMin($("workStart").value, $("workEnd").value),
    breakMin: Number($("breakMin").value || 0),
    distanceKm: Number($("distanceKm").value || 0),
    delivered: Number($("delivered").value || 0),
    absent: Number($("absent").value || 0),
    redelivery: Number($("redelivery").value || 0),
    returned: Number($("returned").value || 0),
    claimFlag: $("claimFlag").value,
    claimDetail: $("claimDetail").value.trim(),
    payDaily, payIncentive,
    expToll, expParking, expFuel, expOther,
    expTotal, profit,
    accidentFlag: $("accidentFlag").value,
    accidentDetail: $("accidentDetail").value.trim(),
    delayReason: $("delayReason").value,
    tomorrowPlan: $("tomorrowPlan").value,
    photos: { dailyPhoto: await fileToDataUrl($("dailyPhoto").files?.[0] || null) }
  };

  await window.OFA_PDF.makeDailyPDF({ profile, daily });
}

async function exportTenkoCSV() {
  const profile = await requireProfile();
  if (!profile) return;

  const inspect = collectInspect();
  const jobList = collectJobs();

  const row = {
    kind: "tenko",
    name: profile.name,
    base: profile.base,
    carNo: profile.carNo,
    licenseNo: profile.licenseNo,

    tenkoType: $("tenkoType").value,
    tenkoAt: $("tenkoAt").value || `${localDateStr()} ${localTimeStr()}`,
    method: $("tenkoMethod").value,
    sleepHours: $("sleepHours").value,
    bodyTemp: $("bodyTemp").value,
    condition: $("condition").value,
    fatigue: $("fatigue").value,
    medication: $("medication").value,
    medicationDetail: $("medicationDetail").value.trim(),
    drank: $("drank").value,
    alcoholJudge: $("alcoholJudge").value,
    alcoholValue: $("alcoholValue").value,

    jobs: JSON.stringify(jobList),
    abnormal: $("abnormal").value,
    abnormalDetail: $("abnormalDetail").value.trim(),

    inspectNG: inspect.ngList.join(" / "),
    ngMemo: $("ngMemo").value.trim(),
    createdAt: nowISO()
  };

  downloadText(`OFA_tenko_${localDateStr()}_${$("tenkoType").value}.csv`, toCSV([row]), "text/csv");
}

async function exportDailyCSV() {
  const profile = await requireProfile();
  if (!profile) return;

  const payDaily = Number($("payDaily").value || 0);
  const payIncentive = Number($("payIncentive").value || 0);
  const expToll = Number($("expToll").value || 0);
  const expParking = Number($("expParking").value || 0);
  const expFuel = Number($("expFuel").value || 0);
  const expOther = Number($("expOther").value || 0);
  const expTotal = expToll + expParking + expFuel + expOther;
  const profit = payDaily + payIncentive - expTotal;

  const row = {
    kind: "daily",
    date: $("workDate").value,
    name: profile.name,
    base: profile.base,
    carNo: profile.carNo,
    licenseNo: profile.licenseNo,

    workCase: $("workCase").value.trim(),
    workStart: $("workStart").value,
    workEnd: $("workEnd").value,
    workMinutes: calcDurationMin($("workStart").value, $("workEnd").value),
    breakMin: Number($("breakMin").value || 0),
    distanceKm: Number($("distanceKm").value || 0),

    delivered: Number($("delivered").value || 0),
    absent: Number($("absent").value || 0),
    redelivery: Number($("redelivery").value || 0),
    returned: Number($("returned").value || 0),

    claimFlag: $("claimFlag").value,
    claimDetail: $("claimDetail").value.trim(),

    payDaily,
    payIncentive,
    expToll, expParking, expFuel, expOther,
    expTotal,
    profit,

    accidentFlag: $("accidentFlag").value,
    accidentDetail: $("accidentDetail").value.trim(),
    delayReason: $("delayReason").value,
    tomorrowPlan: $("tomorrowPlan").value,

    createdAt: nowISO()
  };

  downloadText(`OFA_daily_${$("workDate").value || localDateStr()}.csv`, toCSV([row]), "text/csv");
}

/* ===== 履歴 ===== */
async function refreshHistory() {
  const list = await idbGetAll();
  list.sort((a,b) => (b.date || "").localeCompare(a.date || "") || (b.id||"").localeCompare(a.id||""));

  const wrap = $("historyList");
  wrap.innerHTML = "";

  if (!list.length) {
    wrap.innerHTML = `<div class="help">保存データがありません。</div>`;
    return;
  }

  list.slice(0, 200).forEach(rec => {
    const div = document.createElement("div");
    div.className = "item";
    const title = rec.kind === "tenko"
      ? `点呼：${rec.tenkoType === "departure" ? "出発" : "帰着"}`
      : `日報：${rec.workCase || ""}`;
    const sub = rec.kind === "tenko"
      ? `${rec.atText || rec.date} / NG:${(rec.inspectNG||[]).length}`
      : `${rec.date} / 配達:${rec.delivered} / 利益:${(rec.profit||0).toLocaleString()}`;
    div.innerHTML = `
      <div class="itemTop">
        <div class="badge">${title}</div>
        <div class="help">${sub}</div>
      </div>
    `;
    wrap.appendChild(div);
  });
}

/* ===== 月報 ===== */
async function calcMonthly() {
  const from = $("monthFrom").value;
  const to = $("monthTo").value;
  if (!from || !to) {
    alert("開始日・終了日を入れてください。");
    return;
  }

  const all = await idbGetAll();

  // 日報集計
  const dailies = all.filter(r => r.kind === "daily" && r.date >= from && r.date <= to);
  const tenkos = all.filter(r => r.kind === "tenko" && r.date >= from && r.date <= to);

  const daysSet = new Set(dailies.map(d => d.date));
  const days = daysSet.size;

  const sum = (arr, key) => arr.reduce((a,r)=>a+Number(r[key]||0),0);

  const totalWorkMin = sum(dailies, "workMinutes");
  const totalBreak = sum(dailies, "breakMin");
  const totalDist = sum(dailies, "distanceKm");
  const totalDeliv = sum(dailies, "delivered");
  const totalAbs = sum(dailies, "absent");
  const totalRed = sum(dailies, "redelivery");
  const totalClaim = dailies.filter(d => d.claimFlag === "あり").length;
  const totalAcc = dailies.filter(d => d.accidentFlag === "あり").length;
  const totalSales = sum(dailies, "payDaily") + sum(dailies, "payIncentive");
  const totalExp = sum(dailies, "expTotal");
  const totalProfit = sum(dailies, "profit");

  const avg = days ? (totalDeliv / days) : 0;
  const absRate = totalDeliv ? (totalAbs / totalDeliv * 100) : 0;
  const redRate = totalDeliv ? (totalRed / totalDeliv * 100) : 0;

  // 点呼未実施日（出発/帰着）
  const dayMap = new Map();
  tenkos.forEach(t => {
    const d = t.date;
    const m = dayMap.get(d) || {dep:false, arr:false};
    if (t.tenkoType === "departure") m.dep = true;
    if (t.tenkoType === "arrival") m.arr = true;
    dayMap.set(d, m);
  });

  const miss = [];
  // dailiesがある日を基準に「点呼不足」を見せる
  [...daysSet].sort().forEach(d => {
    const m = dayMap.get(d) || {dep:false, arr:false};
    if (!m.dep || !m.arr) {
      miss.push(`${d}(${!m.dep ? "出発×" : "出発○"}/${!m.arr ? "帰着×" : "帰着○"})`);
    }
  });

  monthlyCache = {
    from, to,
    days,
    totalWorkMin,
    totalBreak,
    totalDist,
    totalDeliv,
    avg,
    absRate,
    redRate,
    totalClaim,
    totalAcc,
    totalSales,
    totalExp,
    totalProfit,
    missText: miss.length ? miss.join(" / ") : "なし",
    dailies
  };

  $("monthlyBox").style.display = "block";
  $("btnMonthlyPDF").disabled = false;
  $("btnMonthlyCSV").disabled = false;

  $("m_days").textContent = String(days);
  $("m_work").textContent = `${Math.floor(totalWorkMin/60)}h${pad2(totalWorkMin%60)}m`;
  $("m_break").textContent = `${Math.floor(totalBreak/60)}h${pad2(totalBreak%60)}m`;
  $("m_dist").textContent = totalDist.toFixed(1);

  $("m_deliv").textContent = String(totalDeliv);
  $("m_avg").textContent = avg.toFixed(1);
  $("m_absRate").textContent = `${absRate.toFixed(1)}%`;
  $("m_redRate").textContent = `${redRate.toFixed(1)}%`;

  $("m_claim").textContent = String(totalClaim);
  $("m_acc").textContent = String(totalAcc);
  $("m_sales").textContent = totalSales.toLocaleString();
  $("m_exp").textContent = totalExp.toLocaleString();
  $("m_profit").textContent = totalProfit.toLocaleString();
  $("m_miss").textContent = monthlyCache.missText;
}

async function monthlyPDF() {
  const profile = await requireProfile();
  if (!profile) return;
  if (!monthlyCache) return;
  await window.OFA_PDF.makeMonthlyPDF({ profile, monthly: monthlyCache });
}

async function monthlyCSV() {
  if (!monthlyCache) return;
  const rows = monthlyCache.dailies.map(d => ({
    date: d.date,
    name: d.name,
    base: d.base,
    workCase: d.workCase,
    workMinutes: d.workMinutes,
    breakMin: d.breakMin,
    distanceKm: d.distanceKm,
    delivered: d.delivered,
    absent: d.absent,
    redelivery: d.redelivery,
    returned: d.returned,
    claimFlag: d.claimFlag,
    accidentFlag: d.accidentFlag,
    sales: (Number(d.payDaily||0)+Number(d.payIncentive||0)),
    exp: Number(d.expTotal||0),
    profit: Number(d.profit||0)
  }));
  downloadText(`OFA_monthly_${monthlyCache.from}_${monthlyCache.to}.csv`, toCSV(rows), "text/csv");
}

/* ===== バックアップ ===== */
async function exportBackup() {
  const profile = await idbGet(STORE_PROFILE, "profile");
  const records = await idbGetAll();
  const payload = { exportedAt: nowISO(), profile, records };
  downloadText(`OFA_backup_${localDateStr()}.json`, JSON.stringify(payload, null, 2), "application/json");
}

async function importBackup(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  const text = await file.text();
  let data;
  try { data = JSON.parse(text); } catch {
    alert("JSONが壊れています。");
    return;
  }
  if (data.profile) await idbPut(STORE_PROFILE, { key:"profile", ...data.profile, key:"profile" });
  if (Array.isArray(data.records)) {
    for (const r of data.records) {
      if (r && r.id) await idbPut(STORE, r);
    }
  }
  await loadProfile();
  alert("バックアップを取り込みました。");
  e.target.value = "";
}
