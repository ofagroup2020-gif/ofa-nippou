/* ============================================================
   OFA 点呼・点検（GitHub Pages Front）
   - departure.html / arrival.html / reports.html 共通
   - GAS WebAppへ JSON送信（doPost）
   - 写真：複数OK（圧縮して dataURL 化）
   - 送信後：indexへ戻す
   ============================================================ */

const GAS_WEBAPP_URL =
  "https://script.google.com/macros/s/AKfycbz1slZySaYGQEQGh3UVncCzo23o3B3v-30XzGqXTQYxI2BAV-Z4VaR8OS4eD5ZRbEHX5g/exec";

// ---- 共通DOM ----
const $ = (sel) => document.querySelector(sel);

function toast(msg, type = "info") {
  const el = $("#toast");
  if (!el) return alert(msg);
  el.textContent = msg;
  el.dataset.type = type;
  el.classList.add("show");
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
}

function fmtDate(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function fmtTime(d = new Date()) {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

// ---- 画像圧縮（iPhoneでも安定）----
async function fileToDataURL(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result || ""));
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

async function compressDataURL(dataURL, maxW = 1280, quality = 0.72) {
  // dataURL -> Image -> canvas -> jpeg dataURL
  const img = await new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = dataURL;
  });

  const w = img.width;
  const h = img.height;
  const scale = Math.min(1, maxW / w);
  const cw = Math.max(1, Math.floor(w * scale));
  const ch = Math.max(1, Math.floor(h * scale));

  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, cw, ch);
  return canvas.toDataURL("image/jpeg", quality);
}

async function filesToCompressedDataURLs(fileList, maxCount = 6) {
  const files = Array.from(fileList || []).slice(0, maxCount);
  const out = [];
  for (const f of files) {
    const dataUrl = await fileToDataURL(f);
    const compressed = await compressDataURL(dataUrl);
    out.push(compressed);
  }
  return out;
}

// ---- GAS送信 ----
async function postToGAS(payload) {
  const res = await fetch(GAS_WEBAPP_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  });
  const txt = await res.text();
  let json;
  try {
    json = JSON.parse(txt);
  } catch (e) {
    throw new Error("GAS応答がJSONではありません: " + txt);
  }
  if (!json.ok) throw new Error(json.message || "GAS error");
  return json;
}

// ---- 入力取得（departure/arrival 共通）----
function getVal(id) {
  const el = document.getElementById(id);
  if (!el) return "";
  return (el.value || "").trim();
}
function setVal(id, v) {
  const el = document.getElementById(id);
  if (!el) return;
  el.value = v;
}

function ensureDefaults() {
  // date/time が空なら埋める
  if (document.getElementById("date") && !getVal("date")) setVal("date", fmtDate());
  if (document.getElementById("time") && !getVal("time")) setVal("time", fmtTime());
}

// departure/arrivalの必須項目統一（GAS側must_に合わせる）
function collectCommonData() {
  return {
    date: getVal("date"),
    time: getVal("time"),
    driverName: getVal("driverName"),
    vehicleNo: getVal("vehicleNo"),
    managerName: getVal("managerName"),
    method: getVal("method"),
    place: getVal("place"), // 任意
    alcoholValue: getVal("alcoholValue"),
    alcoholBand: getVal("alcoholBand"),
    healthRisk: getVal("healthRisk"), // 任意
    deviceCheck: getVal("deviceCheck"), // 任意
    instruction: getVal("instruction"), // 任意
    notAllowedReason: getVal("notAllowedReason"), // 任意
    memo: getVal("memo"), // 必須（メモでもOK）
  };
}

function collectArrivalDaily() {
  // 帰着点呼 + 日報
  return {
    workType: getVal("workType"),
    dailyNote: getVal("dailyNote"),
    area: getVal("area"),
    workTime: getVal("workTime"),
    countDelivered: getVal("countDelivered"),
    countReturn: getVal("countReturn"),
  };
}

function validateCommon(d) {
  const req = (k, label) => {
    if (!String(d[k] || "").trim()) throw new Error(`未入力：${label}`);
  };
  req("date", "日付");
  req("time", "時刻");
  req("driverName", "氏名");
  req("vehicleNo", "車両番号");
  req("managerName", "点呼実施者");
  req("method", "点呼方法");
  req("alcoholValue", "アルコール測定値");
  req("alcoholBand", "酒気帯び");
  req("memo", "その他必要事項（メモ）");
}

function validateArrival(d) {
  const req = (k, label) => {
    if (!String(d[k] || "").trim()) throw new Error(`未入力：${label}`);
  };
  req("workType", "業務内容（例：Amazon宅配など）");
  req("dailyNote", "本日の業務内容（自由記述）");
}

// ---- ページ判定 ----
function pageMode() {
  const path = location.pathname.toLowerCase();
  if (path.endsWith("departure.html")) return "departure";
  if (path.endsWith("arrival.html")) return "arrival";
  if (path.endsWith("reports.html")) return "reports";
  return "index";
}

// ---- 送信ハンドラ ----
async function handleSubmit(mode) {
  try {
    ensureDefaults();

    const common = collectCommonData();
    validateCommon(common);

    let data = { ...common };
    let reportPhotos = [];

    // 点呼写真
    const photoInput = document.getElementById("photos");
    const photos = photoInput ? await filesToCompressedDataURLs(photoInput.files, 6) : [];

    if (mode === "arrival") {
      const daily = collectArrivalDaily();
      validateArrival(daily);
      data = { ...data, ...daily };

      const rptInput = document.getElementById("reportPhotos");
      reportPhotos = rptInput ? await filesToCompressedDataURLs(rptInput.files, 6) : [];
    }

    const payload = {
      app: "OFA_TENKO",
      mode,
      data,
      photos,
      reportPhotos,
    };

    toast("送信中…", "info");
    const result = await postToGAS(payload);
    toast("保存完了 ✅", "ok");

    // 送信後は index へ戻す（あなたの運用）
    setTimeout(() => {
      location.href = "./index.html";
    }, 700);

    return result;
  } catch (err) {
    toast(String(err.message || err), "err");
  }
}

// ---- reports（PDF/CSV）----
async function callReportApi(params) {
  const url = new URL(GAS_WEBAPP_URL);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString());
  const json = await res.json();
  if (!json.ok) throw new Error(json.message || "report error");
  return json.url;
}

async function makeDailyPdf() {
  try {
    const date = getVal("reportDate") || fmtDate();
    const name = getVal("reportName") || "";
    toast("日報PDF作成中…", "info");
    const url = await callReportApi({ action: "dailyPdf", date, name });
    toast("作成OK ✅", "ok");
    window.open(url, "_blank");
  } catch (e) {
    toast(String(e.message || e), "err");
  }
}

async function makeMonthlyPdf() {
  try {
    const ym = getVal("reportYm") || fmtDate().slice(0, 7);
    const name = getVal("reportName2") || "";
    toast("月報PDF作成中…", "info");
    const url = await callReportApi({ action: "monthlyPdf", ym, name });
    toast("作成OK ✅", "ok");
    window.open(url, "_blank");
  } catch (e) {
    toast(String(e.message || e), "err");
  }
}

async function makeMonthlyCsv() {
  try {
    const ym = getVal("csvYm") || fmtDate().slice(0, 7);
    const name = getVal("csvName") || "";
    toast("月CSV作成中…", "info");
    const url = await callReportApi({ action: "monthlyCsv", ym, name });
    toast("作成OK ✅", "ok");
    window.open(url, "_blank");
  } catch (e) {
    toast(String(e.message || e), "err");
  }
}

// ---- 初期化 ----
window.addEventListener("DOMContentLoaded", () => {
  ensureDefaults();

  const mode = pageMode();

  // departure
  const depBtn = document.getElementById("submitDeparture");
  if (depBtn) depBtn.addEventListener("click", () => handleSubmit("departure"));

  // arrival
  const arrBtn = document.getElementById("submitArrival");
  if (arrBtn) arrBtn.addEventListener("click", () => handleSubmit("arrival"));

  // reports
  const dailyBtn = document.getElementById("btnDailyPdf");
  if (dailyBtn) dailyBtn.addEventListener("click", makeDailyPdf);

  const monBtn = document.getElementById("btnMonthlyPdf");
  if (monBtn) monBtn.addEventListener("click", makeMonthlyPdf);

  const csvBtn = document.getElementById("btnMonthlyCsv");
  if (csvBtn) csvBtn.addEventListener("click", makeMonthlyCsv);

  // 疎通
  if (mode !== "index") {
    // 必要ならここでpingチェックも可能（今は重くしない）
  }
});
