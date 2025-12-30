/* =========================================================
 * OFA 点呼・点検 / 日報・月報・CSV（GitHub Pages側 app.js フル版）
 * - departure.html / arrival.html：doPost 保存（mode=departure/arrival）
 * - export.html（出力ページ）：doGet action=dailyPdf/monthlyPdf/monthlyCsv
 * ========================================================= */

"use strict";

/** ★あなたのGAS WebApp URL（最新） */
const GAS_WEBAPP_URL =
  "https://script.google.com/macros/s/AKfycbzvyQxtaHQzeqBTchiNsq6aR85mh6-rh8mfBrLWE820oF6gfdO8Zwpa6X3hfHcPbSdoJg/exec";

/** アプリID（GAS側チェック用） */
const APP_ID = "OFA_TENKO";

/** 写真の自動圧縮設定（重いと送信失敗するので安全側） */
const IMG_MAX_W = 1280;
const IMG_JPEG_QUALITY = 0.72;
const MAX_FILES_EACH = 6;

/* -------------------------------
 * 共通UI
 * ------------------------------- */
function qs(sel) { return document.querySelector(sel); }
function qsa(sel) { return Array.from(document.querySelectorAll(sel)); }

function toast(msg, ms = 2500) {
  let el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.style.cssText = `
      position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%);
      background: rgba(220, 38, 38, .95); color: #fff;
      padding: 10px 14px; border-radius: 12px; font-size: 14px;
      z-index: 99999; max-width: 90vw; text-align: center;
      box-shadow: 0 10px 20px rgba(0,0,0,.25);
    `;
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.display = "block";
  clearTimeout(el._t);
  el._t = setTimeout(() => (el.style.display = "none"), ms);
}

function setBusy(isBusy) {
  qsa("button").forEach(b => (b.disabled = !!isBusy));
  document.body.style.opacity = isBusy ? "0.85" : "1";
}

/* -------------------------------
 * 画像 -> dataURL（圧縮）
 * ------------------------------- */
async function fileToDataUrlCompressed(file) {
  const dataUrl = await readAsDataURL(file);
  // 画像以外はそのまま
  if (!/^data:image\//.test(dataUrl)) return dataUrl;

  // iOS Safari対策でImage decode
  const img = await loadImage(dataUrl);
  const { w, h } = fitSize(img.width, img.height, IMG_MAX_W);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, w, h);

  // JPEGで再生成（容量削減）
  const out = canvas.toDataURL("image/jpeg", IMG_JPEG_QUALITY);
  return out;
}

function fitSize(w, h, maxW) {
  if (!maxW || w <= maxW) return { w, h };
  const r = maxW / w;
  return { w: Math.round(w * r), h: Math.round(h * r) };
}

function readAsDataURL(file) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(String(fr.result || ""));
    fr.onerror = rej;
    fr.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}

async function inputFilesToDataUrls(inputEl) {
  if (!inputEl || !inputEl.files) return [];
  const files = Array.from(inputEl.files).slice(0, MAX_FILES_EACH);
  const out = [];
  for (const f of files) {
    out.push(await fileToDataUrlCompressed(f));
  }
  return out;
}

/* -------------------------------
 * GAS通信
 * ------------------------------- */
async function gasPost(payload) {
  const r = await fetch(GAS_WEBAPP_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  });
  const txt = await r.text();
  try { return JSON.parse(txt); }
  catch { return { ok: false, message: "bad json", raw: txt }; }
}

async function gasGet(params) {
  const url = new URL(GAS_WEBAPP_URL);
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    const s = String(v).trim();
    if (!s) return;
    url.searchParams.set(k, s);
  });

  const r = await fetch(url.toString(), { method: "GET" });
  const txt = await r.text();
  try { return JSON.parse(txt); }
  catch { return { ok: false, message: "bad json", raw: txt }; }
}

/* =========================================================
 * departure.html / arrival.html 用
 * ========================================================= */
function bindTenkoForm(mode) {
  // mode は "departure" or "arrival"
  const form = qs("form");
  if (!form) return;

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();

    try {
      setBusy(true);

      // ---- 共通必須 ----
      const data = collectCommonFields(mode);

      // ---- 点検 ----
      data.inspection = collectInspection();

      // ---- 写真 ----
      const tenkoPhotos = await inputFilesToDataUrls(qs("#tenkoPhotos"));
      const reportPhotos = await inputFilesToDataUrls(qs("#reportPhotos"));   // arrivalのみ想定（無ければOK）
      const licensePhotos = await inputFilesToDataUrls(qs("#licensePhotos"));

      // ---- doPost payload ----
      const payload = {
        app: APP_ID,
        mode,
        data,
        photos: tenkoPhotos,
        reportPhotos,
        licensePhotos
      };

      const res = await gasPost(payload);
      if (!res || !res.ok) {
        toast(res && res.message ? res.message : "送信に失敗しました");
        return;
      }

      toast("保存しました ✅", 1800);

      // indexに戻す（あなたの仕様）
      setTimeout(() => {
        location.href = "index.html";
      }, 600);

    } catch (e) {
      toast("送信エラー: " + (e && e.message ? e.message : e));
    } finally {
      setBusy(false);
    }
  });
}

function collectCommonFields(mode) {
  const date = (qs("#date")?.value || "").trim();
  const time = (qs("#time")?.value || "").trim();

  const driverName = (qs("#driverName")?.value || "").trim();
  const vehicleNo = (qs("#vehicleNo")?.value || "").trim();
  const managerName = (qs("#managerName")?.value || "").trim();
  const method = (qs("#method")?.value || "").trim();
  const place = (qs("#place")?.value || "").trim();

  const alcoholValue = (qs("#alcoholValue")?.value || "").trim();
  const alcoholBand = (qs("#alcoholBand")?.value || "").trim();
  const memo = (qs("#memo")?.value || "").trim();

  const odoStart = (qs("#odoStart")?.value || "").trim();
  const odoEnd = (qs("#odoEnd")?.value || "").trim();
  const odoTotal = (qs("#odoTotal")?.value || "").trim();

  const licenseNo = (qs("#licenseNo")?.value || "").trim();

  // arrival（日報）
  const workType = (qs("#workType")?.value || "").trim();
  const workArea = (qs("#workArea")?.value || "").trim();
  const workHours = (qs("#workHours")?.value || "").trim();
  const deliveryCount = (qs("#deliveryCount")?.value || "").trim();
  const trouble = (qs("#trouble")?.value || "").trim();
  const dailyNote = (qs("#dailyNote")?.value || "").trim();

  // 最低必須チェック（軽く）
  if (!date) throw new Error("日付が未入力です");
  if (!time) throw new Error("時刻が未入力です");
  if (!driverName) throw new Error("氏名が未入力です");
  if (!vehicleNo) throw new Error("車両番号が未入力です");
  if (!managerName) throw new Error("点呼実施者が未入力です");
  if (!method) throw new Error("点呼方法が未入力です");
  if (!alcoholValue) throw new Error("アルコール測定値が未入力です");
  if (!alcoholBand) throw new Error("酒気帯び有無が未入力です");

  const data = {
    date, time,
    driverName, vehicleNo, managerName,
    method, place,
    alcoholValue, alcoholBand, memo,
    odoStart, odoEnd, odoTotal,
    licenseNo,
    workType, workArea, workHours, deliveryCount, trouble, dailyNote
  };

  // 出発/帰着で不足があっても落とさない（GAS側で必要なら弾く）
  return data;
}

function collectInspection() {
  // inspection の select などを data-inspection="key" で拾う
  const obj = {};
  qsa("[data-inspection]").forEach(el => {
    const k = el.getAttribute("data-inspection");
    if (!k) return;
    obj[k] = (el.value || "").trim();
  });
  const note = (qs("#inspectionNote")?.value || "").trim();
  if (note) obj.note = note;
  return obj;
}

/* =========================================================
 * export.html（出力ページ）用
 * ここが今回の「invalid mode」の原因だったので完全に分離
 * ========================================================= */
function bindExportPage() {
  const btnDaily = qs("#btnDailyPdf");
  const btnMonthly = qs("#btnMonthlyPdf");
  const btnCsv = qs("#btnMonthlyCsv");

  if (btnDaily) {
    btnDaily.addEventListener("click", async () => {
      try {
        setBusy(true);
        const date = (qs("#date")?.value || "").trim().replace(/\//g, "-");
        const name = (qs("#name")?.value || "").trim();
        if (!date) throw new Error("日付を入力してください");
        const res = await gasGet({ action: "dailyPdf", date, name });
        if (!res.ok) throw new Error(res.message || "日報PDF作成に失敗");
        openOrShowLink(res.url);
      } catch (e) {
        toast(String(e && e.message ? e.message : e));
      } finally {
        setBusy(false);
      }
    });
  }

  if (btnMonthly) {
    btnMonthly.addEventListener("click", async () => {
      try {
        setBusy(true);
        const month = (qs("#month")?.value || "").trim();
        const name = (qs("#name")?.value || "").trim();
        if (!month) throw new Error("月(YYYY-MM)を入力してください");
        const res = await gasGet({ action: "monthlyPdf", month, name });
        if (!res.ok) throw new Error(res.message || "月報PDF作成に失敗");
        openOrShowLink(res.url);
      } catch (e) {
        toast(String(e && e.message ? e.message : e));
      } finally {
        setBusy(false);
      }
    });
  }

  if (btnCsv) {
    btnCsv.addEventListener("click", async () => {
      try {
        setBusy(true);
        const month = (qs("#month")?.value || "").trim();
        const name = (qs("#name")?.value || "").trim();
        if (!month) throw new Error("月(YYYY-MM)を入力してください");
        const res = await gasGet({ action: "monthlyCsv", month, name });
        if (!res.ok) throw new Error(res.message || "月次CSV作成に失敗");
        openOrShowLink(res.url);
      } catch (e) {
        toast(String(e && e.message ? e.message : e));
      } finally {
        setBusy(false);
      }
    });
  }
}

function openOrShowLink(url) {
  if (!url) {
    toast("URLが取得できませんでした");
    return;
  }
  // 画面にリンク表示
  const out = qs("#result");
  if (out) {
    out.innerHTML = `<a href="${escapeHtmlAttr(url)}" target="_blank" rel="noopener">作成したファイルを開く</a><div style="font-size:12px;opacity:.8;margin-top:6px;">${escapeHtml(url)}</div>`;
  }
  // 新規タブで開く（iOSはブロックされる場合があるのでリンクも出す）
  try { window.open(url, "_blank"); } catch (_) {}
  toast("作成しました ✅");
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function escapeHtmlAttr(s) { return escapeHtml(s); }

/* =========================================================
 * ページ側から呼ぶ初期化（各HTMLで1行呼べばOK）
 * 例:
 *  departure.html → initDeparture();
 *  arrival.html   → initArrival();
 *  export.html    → initExport();
 * ========================================================= */
function initDeparture() { bindTenkoForm("departure"); }
function initArrival() { bindTenkoForm("arrival"); }
function initExport() { bindExportPage(); }

// グローバル公開（HTMLから呼べるように）
window.initDeparture = initDeparture;
window.initArrival = initArrival;
window.initExport = initExport;
