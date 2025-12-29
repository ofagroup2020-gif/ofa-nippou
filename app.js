/* =========================================================
  OFA 点呼・点検（GitHub Pages front）
  - departure / arrival を GAS doPost へ送信
  - 写真は圧縮 → dataURL で送信
  - 走行距離：end-start 自動計算（画面表示）
  - 送信成功後 700ms で index.html に戻る
========================================================= */

const GAS_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbyTwsUHSuJ_CPGqI5dEdp6JHGnMKYllnEqZINg4ZfsR40RoJyoaGe1yeNmtncpxTf4F5w/exec";

// ===== DOM helper =====
const $ = (sel) => document.querySelector(sel);

function toast(msg, type = "info") {
  const el = $("#toast");
  if (!el) return alert(msg);
  el.textContent = msg;
  el.dataset.type = type;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2600);
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

function val(id) {
  const el = document.getElementById(id);
  return el ? (el.value ?? "").toString().trim() : "";
}
function numVal(id) {
  const s = val(id);
  if (!s) return "";
  const n = Number(s);
  return Number.isFinite(n) ? String(n) : "";
}

// ===== image compress =====
async function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}

async function compressImageDataUrl(dataUrl, maxW = 1280, quality = 0.8) {
  const img = new Image();
  img.src = dataUrl;
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });

  const scale = Math.min(1, maxW / img.width);
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, w, h);

  return canvas.toDataURL("image/jpeg", quality);
}

async function getDataUrlsFromInput(inputId, limit = 8) {
  const el = document.getElementById(inputId);
  if (!el || !el.files || el.files.length === 0) return [];
  const files = Array.from(el.files).slice(0, limit);

  const out = [];
  for (const f of files) {
    const du = await fileToDataUrl(f);
    const c = await compressImageDataUrl(du, 1280, 0.8);
    out.push(c);
  }
  return out;
}

// ===== common validations =====
function mustField(label, v) {
  if (!v) throw new Error(`${label} を入力してください`);
}

// ===== inspection collect =====
function collectInspection() {
  // チェック欄（select or input）
  const get = (id) => val(id);
  return {
    tire: get("insp_tire"),
    brake: get("insp_brake"),
    light: get("insp_light"),
    blinker: get("insp_blinker"),
    wiper: get("insp_wiper"),
    oil: get("insp_oil"),
    coolant: get("insp_coolant"),
    damage: get("insp_damage"),
    loadSecure: get("insp_loadSecure"),
    other: get("insp_other")
  };
}

// ===== distance auto =====
function autoDistance() {
  const s = Number(val("odoStart"));
  const e = Number(val("odoEnd"));
  const el = document.getElementById("distanceAuto");
  if (!el) return;
  if (!Number.isFinite(s) || !Number.isFinite(e)) { el.textContent = ""; return; }
  el.textContent = String(Math.max(0, e - s));
}

function bindDistanceAuto() {
  const a = document.getElementById("odoStart");
  const b = document.getElementById("odoEnd");
  if (a) a.addEventListener("input", autoDistance);
  if (b) b.addEventListener("input", autoDistance);
  autoDistance();
}

// ===== submit =====
async function postToGAS(payload) {
  const res = await fetch(GAS_WEBAPP_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload)
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch (e) { throw new Error("GAS応答が不正です: " + text); }
  if (!json.ok) throw new Error(json.message || "保存に失敗しました");
  return json;
}

async function submitDeparture() {
  try {
    // 必須
    const date = val("date");
    const time = val("time");
    const driverName = val("driverName");
    const vehicleNo = val("vehicleNo");
    const managerName = val("managerName");
    const method = val("method");
    const place = val("place");
    const alcoholValue = val("alcoholValue");
    const alcoholBand = val("alcoholBand");
    const healthRisk = val("healthRisk");
    const memo = val("memo");
    const odoStart = val("odoStart");
    const licenseNo = val("licenseNo");

    mustField("日付", date);
    mustField("時刻", time);
    mustField("運転者氏名", driverName);
    mustField("車両番号", vehicleNo);
    mustField("点呼実施者", managerName);
    mustField("点呼方法", method);
    mustField("アルコール測定値", alcoholValue);
    mustField("酒気帯び", alcoholBand);
    mustField("その他必要事項", memo);
    mustField("開始走行距離", odoStart);

    toast("送信中...", "info");

    const photos = await getDataUrlsFromInput("photos", 8);
    const licensePhotos = await getDataUrlsFromInput("licensePhotos", 2);

    const payload = {
      app: "OFA_TENKO",
      mode: "departure",
      data: {
        date, time, driverName, vehicleNo, managerName, method, place,
        alcoholValue, alcoholBand, healthRisk, memo,
        odoStart,
        odoEnd: "", // 出発は空
        workType: "", area: "", dailyNote: "", workTime: "", countDelivered: "", countReturn: "",
        licenseNo,
        inspection: collectInspection()
      },
      photos,
      reportPhotos: [],
      licensePhotos
    };

    await postToGAS(payload);

    toast("保存しました（出発点呼）", "ok");
    setTimeout(() => location.href = "./index.html", 700);

  } catch (err) {
    toast(String(err.message || err), "err");
  }
}

async function submitArrival() {
  try {
    const date = val("date");
    const time = val("time");
    const driverName = val("driverName");
    const vehicleNo = val("vehicleNo");
    const managerName = val("managerName");
    const method = val("method");
    const place = val("place");
    const alcoholValue = val("alcoholValue");
    const alcoholBand = val("alcoholBand");
    const healthRisk = val("healthRisk");
    const memo = val("memo");
    const odoEnd = val("odoEnd");
    const odoStart = val("odoStart"); // 任意（両方入ると距離計算）
    const licenseNo = val("licenseNo");

    const workType = val("workType");
    const area = val("area");
    const dailyNote = val("dailyNote");
    const workTime = val("workTime");
    const countDelivered = val("countDelivered");
    const countReturn = val("countReturn");

    mustField("日付", date);
    mustField("時刻", time);
    mustField("運転者氏名", driverName);
    mustField("車両番号", vehicleNo);
    mustField("点呼実施者", managerName);
    mustField("点呼方法", method);
    mustField("アルコール測定値", alcoholValue);
    mustField("酒気帯び", alcoholBand);
    mustField("その他必要事項", memo);
    mustField("終了走行距離", odoEnd);

    // 日報（厚くする）
    mustField("業務内容", workType);
    mustField("本日の業務内容", dailyNote);

    toast("送信中...", "info");

    const photos = await getDataUrlsFromInput("photos", 8);
    const reportPhotos = await getDataUrlsFromInput("reportPhotos", 8);
    const licensePhotos = await getDataUrlsFromInput("licensePhotos", 2);

    const payload = {
      app: "OFA_TENKO",
      mode: "arrival",
      data: {
        date, time, driverName, vehicleNo, managerName, method, place,
        alcoholValue, alcoholBand, healthRisk, memo,
        odoStart, odoEnd,
        workType, area, dailyNote, workTime, countDelivered, countReturn,
        licenseNo,
        inspection: collectInspection()
      },
      photos,
      reportPhotos,
      licensePhotos
    };

    await postToGAS(payload);

    toast("保存しました（帰着点呼/日報）", "ok");
    setTimeout(() => location.href = "./index.html", 700);

  } catch (err) {
    toast(String(err.message || err), "err");
  }
}

// ===== init =====
function initCommonDefaults() {
  const d = document.getElementById("date");
  const t = document.getElementById("time");
  if (d && !d.value) d.value = fmtDate();
  if (t && !t.value) t.value = fmtTime();
  bindDistanceAuto();
}

window.addEventListener("DOMContentLoaded", () => {
  initCommonDefaults();

  const btnDep = document.getElementById("submitDeparture");
  if (btnDep) btnDep.addEventListener("click", submitDeparture);

  const btnArr = document.getElementById("submitArrival");
  if (btnArr) btnArr.addEventListener("click", submitArrival);

  // departureが開けない系は、リンク先が古い or ファイル名違いが多いので、
  // ここに来れている時点でOK。必要なら index.html のリンクも後で直します。
});
