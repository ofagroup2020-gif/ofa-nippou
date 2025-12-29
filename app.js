/* =========================================================
  OFA 点呼・点検（GitHub Pages front）
  - departure.html / arrival.html から送信
  - 写真は圧縮して dataURL にして GAS へ送る
  - GAS（doPost）で Sheet 保存 + Drive 保存
========================================================= */

const GAS_WEBAPP_URL =
  "https://script.google.com/macros/s/AKfycbyIDH-hK7hrDepgPMFtEfzgwXMQ6ml3fDEcQS0yxAszqdFy7Q8O-tpBQbWetbN212rfgw/exec";

// ---- tiny helpers ----
const $ = (sel, root = document) => root.querySelector(sel);

function toast(msg, type = "info") {
  const el = $("#toast");
  if (!el) return alert(msg);
  el.textContent = msg;
  el.dataset.type = type;
  el.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove("show"), 2200);
}

function fmtNowISO() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function sanitizeStr(v) {
  return String(v ?? "").trim();
}

function getFormValue(form, name) {
  const el = form.elements[name];
  if (!el) return "";
  if (el.type === "checkbox") return el.checked ? "1" : "0";
  return sanitizeStr(el.value);
}

// ---- localStorage (fast input) ----
const LS_KEY = "ofa_tenko_profile_v1";
function loadProfile() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || "{}");
  } catch {
    return {};
  }
}
function saveProfile(p) {
  localStorage.setItem(LS_KEY, JSON.stringify(p));
}
function fillProfile(form) {
  const p = loadProfile();
  const keys = ["driverName", "vehicleNo", "managerName", "place"];
  keys.forEach((k) => {
    if (form.elements[k] && !form.elements[k].value && p[k]) {
      form.elements[k].value = p[k];
    }
  });
}
function updateProfileFromForm(form) {
  const p = loadProfile();
  ["driverName", "vehicleNo", "managerName", "place"].forEach((k) => {
    const v = getFormValue(form, k);
    if (v) p[k] = v;
  });
  saveProfile(p);
}

// ---- image compress -> dataURL ----
async function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(new Error("ファイル読み込みに失敗しました"));
    fr.readAsDataURL(file);
  });
}

// 画像のみ圧縮（videoは送らない＝確実運用。必要なら次で拡張）
async function compressImageToJpegDataUrl(file, maxW = 1600, quality = 0.72) {
  const dataUrl = await fileToDataUrl(file);
  const img = new Image();
  img.decoding = "async";
  img.src = dataUrl;

  await new Promise((r, e) => {
    img.onload = r;
    img.onerror = () => e(new Error("画像の読み込みに失敗しました"));
  });

  const ratio = img.width > maxW ? maxW / img.width : 1;
  const w = Math.round(img.width * ratio);
  const h = Math.round(img.height * ratio);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, w, h);

  const out = canvas.toDataURL("image/jpeg", quality);
  return out;
}

async function collectPhotosFromInput(inputEl, label) {
  const files = Array.from(inputEl?.files || []);
  if (!files.length) return [];

  const photos = [];
  for (const f of files) {
    const mime = f.type || "";
    if (mime.startsWith("image/")) {
      const dataUrl = await compressImageToJpegDataUrl(f);
      photos.push({
        name: f.name || `${label || "photo"}.jpg`,
        mime: "image/jpeg",
        dataUrl,
        originalMime: mime,
      });
    } else {
      // video/* は “確実運用” のため送らない（容量・タイムアウト事故防止）
      // 必要なら次の段階で Drive 直アップ方式にします
    }
    if (photos.length >= 6) break; // 送信を重くしない上限
  }
  return photos;
}

// ---- validation ----
function must(form, name, label) {
  const v = getFormValue(form, name);
  if (!v) throw new Error(`${label} は必須です`);
  return v;
}

// ---- POST to GAS ----
async function postJson(url, bodyObj, timeoutMs = 45000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "POST",
      mode: "cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" }, // GASで安定
      body: JSON.stringify(bodyObj),
      signal: controller.signal,
    });
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(`GAS応答がJSONではありません: ${text.slice(0, 120)}`);
    }
    if (!res.ok) throw new Error(json?.message || `HTTP ${res.status}`);
    if (!json.ok) throw new Error(json?.message || "保存に失敗しました");
    return json;
  } finally {
    clearTimeout(t);
  }
}

// ---- main submit ----
async function submitTenko(mode, form) {
  try {
    toast("送信準備中…");

    // 必須項目（departure/arrival 共通）
    const date = must(form, "date", "日付");
    const time = must(form, "time", "時刻");
    const driverName = must(form, "driverName", "運転者氏名");
    const vehicleNo = must(form, "vehicleNo", "車両番号/車番");
    const managerName = must(form, "managerName", "点呼実施者");
    const method = must(form, "method", "点呼方法");
    const alcoholValue = must(form, "alcoholValue", "アルコール測定値");
    const alcoholBand = must(form, "alcoholBand", "酒気帯び");
    const memo = must(form, "memo", "メモ");

    // mode別：arrival は日報必須
    let workType = "";
    let dailyNote = "";
    if (mode === "arrival") {
      workType = must(form, "workType", "本日の業務内容");
      dailyNote = must(form, "dailyNote", "本日の特記事項");
    }

    // 写真 input id はフォーム側で固定（departure.html/arrival.html に合わせる）
    const photos = await collectPhotosFromInput(form.querySelector("#photos"), "tenko");
    const reportPhotos = await collectPhotosFromInput(
      form.querySelector("#reportPhotos"),
      "report"
    );

    updateProfileFromForm(form);

    toast("送信中…（回線状況で数秒）");

    const payload = {
      v: 1,
      app: "OFA_TENKO",
      ts: fmtNowISO(),
      mode, // "departure" or "arrival"
      data: {
        date,
        time,
        driverName,
        vehicleNo,
        managerName,
        method,
        place: getFormValue(form, "place"),
        alcoholValue,
        alcoholBand,
        // departure additional
        temp: getFormValue(form, "temp"),
        bp: getFormValue(form, "bp"),
        fatigue: getFormValue(form, "fatigue"),
        vehicleCheck: getFormValue(form, "vehicleCheck"),
        notfit: getFormValue(form, "notfit"),
        // arrival additional（日報）
        workType,
        area: getFormValue(form, "area"),
        workHours: getFormValue(form, "workHours"),
        delivered: getFormValue(form, "delivered"),
        dailyNote,
        operationStatus: getFormValue(form, "operationStatus"),
        handover: getFormValue(form, "handover"),
        memo,
      },
      photos,
      reportPhotos,
      client: {
        ua: navigator.userAgent,
        lang: navigator.language,
      },
    };

    const json = await postJson(GAS_WEBAPP_URL, payload);

    toast("保存しました ✅", "ok");

    // 送信後：トップへ
    setTimeout(() => {
      location.href = "./index.html";
    }, 650);

    return json;
  } catch (err) {
    console.error(err);
    toast(err?.message || "エラーが発生しました", "error");
    alert(err?.message || "エラーが発生しました");
  }
}

// ---- boot: auto bind ----
window.submitTenko = submitTenko;

window.addEventListener("DOMContentLoaded", () => {
  const form = $("#tenkoForm");
  if (form) fillProfile(form);

  // ping（GASが生きてるか軽く確認。重いと感じたら削除OK）
  fetch(`${GAS_WEBAPP_URL}?ping=1`, { mode: "cors" })
    .then((r) => r.text())
    .then(() => {})
    .catch(() => {});
});
