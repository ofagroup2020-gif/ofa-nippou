/* ============================================================
   OFA 点呼・点検 / 日報（GitHub Pages フロント）
   - departure.html / arrival.html / reports.html 共通JS
   - GAS WebAppへ JSON送信（doPost）
   - 写真: 複数OK / 圧縮して dataURL 送信
   - 送信後: indexへ戻す
   - 端末に氏名・車番などを自動保存（次回入力を楽に）
   ============================================================ */

/** ★ここにGAS WebApp URL（あなたの最新） */
const GAS_WEBAPP_URL =
  "https://script.google.com/macros/s/AKfycbztIaekN2Mvy_qtoY2CsWYohZNcCf-mdW3o9RH8i1t4yYlzaguU3dv2JcWj1kyznlQJxQ/exec";

/** 送信タイムアウト(ms) */
const FETCH_TIMEOUT = 25000;

/** 写真圧縮（長辺px / JPEG品質） */
const IMG_MAX_EDGE = 1600;
const IMG_JPEG_QUALITY = 0.82;

/** ローカル保存キー */
const LS_KEY = "ofa_tenko_pref_v1";

/* ====================== 共通ユーティリティ ====================== */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function toast(msg, type = "info") {
  const el = $("#toast");
  if (!el) return alert(msg);
  el.textContent = msg;
  el.dataset.type = type;
  el.classList.add("show");
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove("show"), 2500);
}

function qs() {
  const p = new URLSearchParams(location.search);
  const obj = {};
  p.forEach((v, k) => (obj[k] = v));
  return obj;
}

function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function nowTimeStr() {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function loadPref() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || "{}") || {};
  } catch (e) {
    return {};
  }
}
function savePref(p) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(p || {}));
  } catch (e) {}
}

/** フォームの name/value を全部拾う（checkbox/radio対応） */
function serializeForm(form) {
  const data = {};
  const els = $$("[name]", form);

  for (const el of els) {
    const name = el.name;
    if (!name) continue;

    const tag = (el.tagName || "").toLowerCase();
    const type = (el.type || "").toLowerCase();

    // file は別処理
    if (type === "file") continue;

    if (type === "checkbox") {
      // 同名複数は配列
      if ($$(`[name="${CSS.escape(name)}"]`, form).length > 1) {
        if (!Array.isArray(data[name])) data[name] = [];
        if (el.checked) data[name].push(el.value || "on");
      } else {
        data[name] = !!el.checked;
      }
      continue;
    }

    if (type === "radio") {
      if (el.checked) data[name] = el.value;
      else if (data[name] == null) data[name] = ""; // 未選択でもキーは作る
      continue;
    }

    if (tag === "select") {
      data[name] = el.value ?? "";
      continue;
    }

    data[name] = (el.value ?? "").trim();
  }
  return data;
}

/** 必須チェック（空なら例外） */
function must(data, key, label = key) {
  const v = data[key];
  if (v == null) throw new Error(`${label} が未入力です`);
  if (typeof v === "string" && v.trim() === "") throw new Error(`${label} が未入力です`);
  return v;
}

/* ====================== 画像圧縮 / DataURL ====================== */

/** File -> 圧縮JPEG dataURL（画像以外なら元のdataURL） */
async function fileToCompressedDataURL(file) {
  if (!file) return null;

  // 画像以外（念のため）
  if (!file.type || !file.type.startsWith("image/")) {
    return await fileToDataURL(file);
  }

  const img = await loadImageFromFile(file);
  const { canvas, ctx } = createCanvasFit(img, IMG_MAX_EDGE);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", IMG_JPEG_QUALITY);
}

function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = () => reject(new Error("file read error"));
    r.readAsDataURL(file);
  });
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image load error"));
    };
    img.src = url;
  });
}

function createCanvasFit(img, maxEdge) {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;

  let nw = w, nh = h;
  const longEdge = Math.max(w, h);
  if (longEdge > maxEdge) {
    const scale = maxEdge / longEdge;
    nw = Math.round(w * scale);
    nh = Math.round(h * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = nw;
  canvas.height = nh;
  const ctx = canvas.getContext("2d", { alpha: false });
  return { canvas, ctx };
}

/** input[type=file] から dataURL[] を作る */
async function filesInputToDataURLs(inputEl) {
  if (!inputEl || !inputEl.files) return [];
  const files = Array.from(inputEl.files || []);
  const out = [];
  for (const f of files) {
    const durl = await fileToCompressedDataURL(f);
    if (durl) out.push(durl);
  }
  return out;
}

/* ====================== GAS 通信 ====================== */

async function postToGAS(payloadObj) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

  try {
    const res = await fetch(GAS_WEBAPP_URL, {
      method: "POST",
      mode: "cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payloadObj),
      signal: controller.signal,
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch (e) {}
    return json || { ok: false, message: "invalid response", raw: text };
  } finally {
    clearTimeout(t);
  }
}

/* ====================== ページ判定 / 初期化 ====================== */

function detectPage() {
  // 推奨: <body data-page="departure"> など
  const bodyPage = document.body?.dataset?.page;
  if (bodyPage) return bodyPage;

  // フォームIDで判定（どちらでもOK）
  if ($("#departureForm")) return "departure";
  if ($("#arrivalForm")) return "arrival";
  if ($("#reportsForm") || $("#dailyPdfBtn") || $("#monthlyPdfBtn")) return "reports";
  return "index";
}

function fillDefaultDateTime(form) {
  const dateEl = $('[name="date"]', form);
  const timeEl = $('[name="time"]', form);
  if (dateEl && !dateEl.value) dateEl.value = todayStr();
  if (timeEl && !timeEl.value) timeEl.value = nowTimeStr();
}

function applyPrefToForm(form) {
  const pref = loadPref();
  const map = [
    ["driverName", "driverName"],
    ["vehicleNo", "vehicleNo"],
    ["managerName", "managerName"],
    ["phone", "phone"],
    ["email", "email"],
    ["licenseNo", "licenseNo"],
  ];
  for (const [k, name] of map) {
    const el = $(`[name="${name}"]`, form);
    if (el && !el.value && pref[k]) el.value = pref[k];
  }
}

function savePrefFromData(data) {
  const pref = loadPref();
  // よく使う項目だけ保存
  if (data.driverName) pref.driverName = data.driverName;
  if (data.vehicleNo) pref.vehicleNo = data.vehicleNo;
  if (data.managerName) pref.managerName = data.managerName;
  if (data.phone) pref.phone = data.phone;
  if (data.email) pref.email = data.email;
  if (data.licenseNo) pref.licenseNo = data.licenseNo;
  savePref(pref);
}

/* ====================== 送信（departure / arrival） ====================== */

async function handleSubmit(mode) {
  const form =
    mode === "departure" ? $("#departureForm") :
    mode === "arrival" ? $("#arrivalForm") : null;

  if (!form) {
    toast("フォームが見つかりません", "error");
    return;
  }

  const btn = $('[data-action="submit"]', form) || $('button[type="submit"]', form);
  if (btn) {
    btn.disabled = true;
    btn.dataset.loading = "1";
  }

  try {
    const data = serializeForm(form);

    // date/time はフォームになければ補完
    if (!data.date) data.date = todayStr();
    if (!data.time) data.time = nowTimeStr();

    // ✅ 必須（あなたのGAS側mustと一致させる）
    must(data, "date", "日付");
    must(data, "time", "時刻");
    must(data, "driverName", "氏名");
    must(data, "vehicleNo", "車両番号");
    must(data, "managerName", "点呼実施者");
    must(data, "method", "点呼方法");
    must(data, "alcoholValue", "アルコール測定値");
    must(data, "alcoholBand", "酒気帯び");
    must(data, "memo", "メモ");

    if (mode === "arrival") {
      must(data, "workType", "業務内容");
      must(data, "dailyNote", "本日の業務内容");
    }

    // 写真（任意）: input名 or id どちらでも拾う
    const tenkoPhotosEl =
      $('[name="photos"]', form) || $("#photos", form) || $("#tenkoPhotos", form);
    const reportPhotosEl =
      $('[name="reportPhotos"]', form) || $("#reportPhotos", form) || $("#dailyPhotos", form);

    toast("写真を処理中…", "info");
    const photos = await filesInputToDataURLs(tenkoPhotosEl);
    const reportPhotos = await filesInputToDataURLs(reportPhotosEl);

    // 免許証写真（任意）: name="licensePhotos" or id="licensePhotos"
    const licensePhotosEl =
      $('[name="licensePhotos"]', form) || $("#licensePhotos", form);
    const licensePhotos = await filesInputToDataURLs(licensePhotosEl);

    // 走行距離の自動計算（あれば）
    // 例: odoStart / odoEnd / distance
    const odoS = Number(String(data.odoStart || "").replace(/[^\d.]/g, "")) || 0;
    const odoE = Number(String(data.odoEnd || "").replace(/[^\d.]/g, "")) || 0;
    if (!data.distance && odoS && odoE && odoE >= odoS) {
      data.distance = String(odoE - odoS);
    }

    // 点検チェック（checkbox群）: name="inspect_xxx" をまとめたJSONも作る
    const inspectKeys = Object.keys(data).filter(k => k.startsWith("inspect_"));
    if (inspectKeys.length) {
      const inspect = {};
      for (const k of inspectKeys) inspect[k] = data[k];
      data.inspectJson = JSON.stringify(inspect);
    }

    // ローカルに次回用保存
    savePrefFromData(data);

    const payload = {
      app: "OFA_TENKO",
      mode,
      data,
      photos,
      reportPhotos,
      licensePhotos, // ←GAS側で保存するなら対応させる
    };

    toast("送信中…", "info");
    const res = await postToGAS(payload);

    if (!res || !res.ok) {
      const msg = (res && (res.message || res.error)) ? (res.message || res.error) : "送信失敗";
      throw new Error(msg);
    }

    toast("保存しました ✅", "success");

    // 送信後の挙動：indexへ戻す（あなたの要望通り）
    setTimeout(() => {
      location.href = "index.html";
    }, 600);

  } catch (e) {
    toast(String(e.message || e), "error");
    console.error(e);
  } finally {
    if (btn) {
      btn.disabled = false;
      delete btn.dataset.loading;
    }
  }
}

/* ====================== reports（PDF/CSV） ====================== */

async function handleReports(action) {
  // reports.html 側は「GASに action を送る」だけでOKにしてる前提
  // action: dailyPdf / monthlyPdf / monthlyCsv
  const form = $("#reportsForm") || document;
  const date = ($('[name="date"]', form)?.value || todayStr()).trim();
  const ym = ($('[name="ym"]', form)?.value || "").trim();
  const driverName = ($('[name="driverName"]', form)?.value || "").trim();

  const payload = {
    app: "OFA_TENKO",
    mode: "report",
    action,
    date,
    ym,
    driverName,
  };

  toast("作成中…", "info");
  const res = await postToGAS(payload);

  if (!res || !res.ok) {
    toast(res?.message || "作成失敗", "error");
    return;
  }

  // url が返る想定
  if (res.url) {
    toast("URLを開きます", "success");
    setTimeout(() => window.open(res.url, "_blank"), 350);
  } else {
    toast("作成OK（URLなし）", "success");
  }
}

/* ====================== 初期化 ====================== */

document.addEventListener("DOMContentLoaded", () => {
  const page = detectPage();

  // 共通「戻る」ボタン（data-action="back"）
  $$('[data-action="back"]').forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      location.href = "index.html";
    });
  });

  // index のボタンが「飛ばない」対策：data-go があれば強制遷移
  $$("[data-go]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const to = btn.getAttribute("data-go");
      if (to) location.href = to;
    });
  });

  // departure / arrival
  if (page === "departure") {
    const form = $("#departureForm");
    if (form) {
      fillDefaultDateTime(form);
      applyPrefToForm(form);
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        handleSubmit("departure");
      });
      // 明示ボタンでもOK
      const sbtn = $('[data-action="submit"]', form);
      if (sbtn) sbtn.addEventListener("click", (e) => { e.preventDefault(); handleSubmit("departure"); });
    }
  }

  if (page === "arrival") {
    const form = $("#arrivalForm");
    if (form) {
      fillDefaultDateTime(form);
      applyPrefToForm(form);
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        handleSubmit("arrival");
      });
      const sbtn = $('[data-action="submit"]', form);
      if (sbtn) sbtn.addEventListener("click", (e) => { e.preventDefault(); handleSubmit("arrival"); });
    }
  }

  // reports
  if (page === "reports") {
    // ボタンIDでも data-action でも動くようにしてる
    $("#dailyPdfBtn")?.addEventListener("click", (e) => { e.preventDefault(); handleReports("dailyPdf"); });
    $("#monthlyPdfBtn")?.addEventListener("click", (e) => { e.preventDefault(); handleReports("monthlyPdf"); });
    $("#monthlyCsvBtn")?.addEventListener("click", (e) => { e.preventDefault(); handleReports("monthlyCsv"); });

    $$("[data-report]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const act = btn.getAttribute("data-report");
        if (act) handleReports(act);
      });
    });
  }
});
