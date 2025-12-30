/* =========================================================
   OFA Tenko App (GitHub Pages) - Full Stable Version
   - Send to GAS (doPost) as JSON
   - Image resize/compress to dataURL
   - Report generator (daily/monthly pdf, monthly csv) via doPost(mode=report)
   - LINE share helper
========================================================= */

const GAS_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbzvyQxtaHQzeqBTchiNsq6aR85mh6-rh8mfBrLWE820oF6gfdO8Zwpa6X3hfHcPbSdoJg/exec";

const APP_ID = "OFA_TENKO";
const MAX_EDGE = 1280;     // 画像の長辺
const JPEG_QUALITY = 0.72; // 圧縮率（0-1）
const MAX_FILES_EACH = 6;  // 1枠あたりの最大枚数

/* -----------------------------
   Utils
------------------------------ */
function $(sel, root = document) { return root.querySelector(sel); }
function $all(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

function nowDateYYYYMMDD() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function nowHHMM() {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function toast(msg, ok = true) {
  let el = $("#toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.style.position = "fixed";
    el.style.left = "50%";
    el.style.bottom = "18px";
    el.style.transform = "translateX(-50%)";
    el.style.padding = "12px 14px";
    el.style.borderRadius = "12px";
    el.style.color = "#fff";
    el.style.zIndex = "9999";
    el.style.maxWidth = "92vw";
    el.style.boxShadow = "0 10px 30px rgba(0,0,0,.2)";
    el.style.fontSize = "14px";
    document.body.appendChild(el);
  }
  el.style.background = ok ? "rgba(22,163,74,.92)" : "rgba(220,38,38,.92)";
  el.textContent = msg;
  el.style.opacity = "1";
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => { el.style.opacity = "0"; }, 2600);
}

function setLoading(btn, loading) {
  if (!btn) return;
  btn.disabled = !!loading;
  btn.dataset._text = btn.dataset._text || btn.textContent;
  btn.textContent = loading ? "送信中..." : btn.dataset._text;
  btn.style.opacity = loading ? ".75" : "1";
}

function safeNum(v) {
  const s = String(v ?? "").trim();
  if (!s) return "";
  const n = Number(s);
  return Number.isFinite(n) ? n : "";
}

/* -----------------------------
   Image resize/compress => dataURL
------------------------------ */
async function fileToDataUrlCompressed(file) {
  // 画像以外は弾く
  if (!file.type || !file.type.startsWith("image/")) {
    throw new Error("画像ファイルのみ対応です");
  }

  const img = await new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = reject;
    im.src = URL.createObjectURL(file);
  });

  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;

  // リサイズ比率
  let nw = w, nh = h;
  const maxEdge = MAX_EDGE;
  if (Math.max(w, h) > maxEdge) {
    const ratio = maxEdge / Math.max(w, h);
    nw = Math.round(w * ratio);
    nh = Math.round(h * ratio);
  }

  const canvas = document.createElement("canvas");
  canvas.width = nw;
  canvas.height = nh;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, nw, nh);

  // JPEGで出力（容量安定）
  const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);

  // URL破棄
  try { URL.revokeObjectURL(img.src); } catch (_) {}
  return dataUrl;
}

async function filesInputToDataUrls(inputEl) {
  if (!inputEl || !inputEl.files) return [];
  const files = Array.from(inputEl.files).slice(0, MAX_FILES_EACH);
  const out = [];
  for (const f of files) {
    const du = await fileToDataUrlCompressed(f);
    out.push(du);
  }
  return out;
}

/* -----------------------------
   Collect form -> payload.data
------------------------------ */
function collectCommonFields(root) {
  return {
    date: ($("#date", root)?.value || "").trim(),
    time: ($("#time", root)?.value || "").trim(),

    driverName: ($("#driverName", root)?.value || "").trim(),
    vehicleNo: ($("#vehicleNo", root)?.value || "").trim(),

    managerName: ($("#managerName", root)?.value || "").trim(),
    method: ($("#method", root)?.value || "").trim(),
    place: ($("#place", root)?.value || "").trim(),

    alcoholValue: ($("#alcoholValue", root)?.value || "").trim(),
    alcoholBand: ($("#alcoholBand", root)?.value || "").trim(),
    memo: ($("#memo", root)?.value || "").trim(),

    odoStart: ($("#odoStart", root)?.value || "").trim(),
    odoEnd: ($("#odoEnd", root)?.value || "").trim(),
    odoTotal: ($("#odoTotal", root)?.value || "").trim(),

    licenseNo: ($("#licenseNo", root)?.value || "").trim(),
  };
}

function collectInspection(root) {
  // チェック項目はここで統一（PDFに必ず出る）
  const insp = {
    engineOil: ($("#insp_engineOil", root)?.value || "").trim(),
    brake: ($("#insp_brake", root)?.value || "").trim(),
    tire: ($("#insp_tire", root)?.value || "").trim(),
    light: ($("#insp_light", root)?.value || "").trim(),
    mirror: ($("#insp_mirror", root)?.value || "").trim(),
    wiper: ($("#insp_wiper", root)?.value || "").trim(),
    horn: ($("#insp_horn", root)?.value || "").trim(),
    loadLock: ($("#insp_loadLock", root)?.value || "").trim(),
    damage: ($("#insp_damage", root)?.value || "").trim(),
    note: ($("#insp_note", root)?.value || "").trim(),
  };

  // 未入力ばかりなら空にしてもOK（ただPDFは「未入力」と出る）
  return insp;
}

function collectDailyWork(root) {
  return {
    workType: ($("#workType", root)?.value || "").trim(),
    workArea: ($("#workArea", root)?.value || "").trim(),
    workHours: ($("#workHours", root)?.value || "").trim(),
    deliveryCount: ($("#deliveryCount", root)?.value || "").trim(),
    trouble: ($("#trouble", root)?.value || "").trim(),
    dailyNote: ($("#dailyNote", root)?.value || "").trim(),
  };
}

/* -----------------------------
   Validation (minimum)
------------------------------ */
function validateBase(data) {
  const required = [
    ["date", "日付"],
    ["time", "時刻"],
    ["driverName", "運転者名"],
    ["vehicleNo", "車両番号"],
    ["managerName", "点呼実施者"],
    ["method", "点呼方法"],
    ["alcoholValue", "アルコール測定値"],
    ["alcoholBand", "酒気帯び判定"],
  ];
  for (const [k, label] of required) {
    if (!String(data[k] ?? "").trim()) {
      throw new Error(`未入力: ${label}`);
    }
  }

  // odo自動計算（フロント側でもやる）
  const s = safeNum(data.odoStart);
  const e = safeNum(data.odoEnd);
  if (s !== "" && e !== "") {
    const total = Math.max(0, Number(e) - Number(s));
    data.odoTotal = String(total);
  }

  return data;
}

/* -----------------------------
   POST to GAS
------------------------------ */
async function postToGAS(payload) {
  const res = await fetch(GAS_WEBAPP_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" }, // GAS相性良い
    body: JSON.stringify(payload),
  });

  // 例外対策：JSONで返らない場合
  const txt = await res.text();
  let json;
  try { json = JSON.parse(txt); } catch (_) {
    throw new Error("GAS応答がJSONではありません: " + txt.slice(0, 180));
  }
  if (!json.ok) throw new Error(json.message || "GAS error");
  return json;
}

/* =========================================================
   Submit Tenko (departure / arrival)
========================================================= */
async function submitTenko(mode) {
  const root = document;
  const btn = $("#submitBtn");
  try {
    setLoading(btn, true);

    // collect
    let data = collectCommonFields(root);
    data = validateBase(data);
    data.inspection = collectInspection(root);

    // arrivalは日報も必須気味（でも運用上は空でも保存できるように）
    if (mode === "arrival") {
      Object.assign(data, collectDailyWork(root));
    }

    // photos
    const tenkoDataUrls = await filesInputToDataUrls($("#tenkoPhotos"));
    const reportDataUrls = await filesInputToDataUrls($("#reportPhotos"));
    const licenseDataUrls = await filesInputToDataUrls($("#licensePhotos"));

    const payload = {
      app: APP_ID,
      mode,
      data,
      photos: tenkoDataUrls,
      reportPhotos: reportDataUrls,
      licensePhotos: licenseDataUrls
    };

    const json = await postToGAS(payload);

    toast(`送信OK：${mode === "departure" ? "出発点呼" : "帰着点呼"} 保存完了`, true);

    // すぐ戻る
    const back = $("#backUrl")?.value || "index.html";
    setTimeout(() => { location.href = back; }, 700);
    return json;
  } catch (e) {
    toast(String(e.message || e), false);
    console.error(e);
  } finally {
    setLoading(btn, false);
  }
}

/* =========================================================
   Reports (daily/monthly pdf, monthly csv)
========================================================= */
async function createReport(action) {
  const btn = $("#genBtn");
  try {
    setLoading(btn, true);

    const name = ($("#rep_name")?.value || "").trim();
    const date = ($("#rep_date")?.value || "").trim();
    const month = ($("#rep_month")?.value || "").trim();

    const data = {};
    if (action === "dailyPdf") data.date = date;
    if (action === "monthlyPdf") data.month = month;
    if (action === "monthlyCsv") data.month = month;
    if (name) data.name = name;

    // validate
    if (action === "dailyPdf" && !date) throw new Error("日付(YYYY-MM-DD)を入れてください");
    if ((action === "monthlyPdf" || action === "monthlyCsv") && !month) throw new Error("月(YYYY-MM)を入れてください");

    const payload = { app: APP_ID, mode: "report", action, data };
    const json = await postToGAS(payload);

    const url = json.url || "";
    if (!url) throw new Error("URLが返ってきませんでした");

    $("#resultBox").classList.remove("hidden");
    $("#resultUrl").textContent = url;
    $("#resultUrl").href = url;

    // LINE共有リンク
    const line = `https://line.me/R/msg/text/?${encodeURIComponent(url)}`;
    $("#lineShare").href = line;

    toast("作成OK：リンクを発行しました", true);
  } catch (e) {
    toast(String(e.message || e), false);
    console.error(e);
  } finally {
    setLoading($("#genBtn"), false);
  }
}

/* =========================================================
   Auto wiring
========================================================= */
function initCommonDefaults() {
  const d = $("#date");
  const t = $("#time");
  if (d && !d.value) d.value = nowDateYYYYMMDD();
  if (t && !t.value) t.value = nowHHMM();

  // 走行距離 自動計算
  const s = $("#odoStart");
  const e = $("#odoEnd");
  const total = $("#odoTotal");
  function calc() {
    if (!s || !e || !total) return;
    const sv = safeNum(s.value);
    const ev = safeNum(e.value);
    if (sv !== "" && ev !== "") total.value = String(Math.max(0, Number(ev) - Number(sv)));
  }
  if (s) s.addEventListener("input", calc);
  if (e) e.addEventListener("input", calc);
}

document.addEventListener("DOMContentLoaded", () => {
  initCommonDefaults();

  // Departure / Arrival
  const mode = document.body.dataset.mode;
  if (mode === "departure" || mode === "arrival") {
    $("#submitBtn")?.addEventListener("click", () => submitTenko(mode));
  }

  // Reports
  if (document.body.dataset.page === "reports") {
    $("#rep_date") && ($("#rep_date").value = $("#rep_date").value || nowDateYYYYMMDD());
    $("#rep_month") && ($("#rep_month").value = $("#rep_month").value || nowDateYYYYMMDD().slice(0, 7));

    $("#btnDaily")?.addEventListener("click", () => createReport("dailyPdf"));
    $("#btnMonthlyPdf")?.addEventListener("click", () => createReport("monthlyPdf"));
    $("#btnMonthlyCsv")?.addEventListener("click", () => createReport("monthlyCsv"));
  }
});
