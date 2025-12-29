/* =========================================================
  OFA 点呼・点検 (GitHub Pages front)
  - GitHub Pages → GAS WebApp（bridge iframe + postMessage）
  - 写真圧縮 → dataURL → GASへ送信
========================================================= */

const GAS_WEBAPP_URL =
  "https://script.google.com/macros/s/AKfycbzMON8kEVi2VJrhPGSGtnX5y0Q4yQCrOPM5afh2ph_X_M0_djtmQAmFTrhZhdp8GA69jA/exec";

// bridge用（GAS側 doGet?bridge=1 が返すHTML）
const GAS_BRIDGE_URL = `${GAS_WEBAPP_URL}?bridge=1`;

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function toast(msg, type = "info") {
  const el = $("#toast");
  if (!el) return alert(msg);
  el.textContent = msg;
  el.dataset.type = type;
  el.classList.add("show");
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => el.classList.remove("show"), 2500);
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

function safeStr(v) {
  return String(v ?? "").trim();
}

/* ========= bridge（CORS回避） ========= */
let bridgeReady = false;
let bridgeIframe = null;
let pending = new Map();

function ensureBridge() {
  if (bridgeIframe) return;

  bridgeIframe = document.createElement("iframe");
  bridgeIframe.src = GAS_BRIDGE_URL;
  bridgeIframe.style.display = "none";
  document.body.appendChild(bridgeIframe);

  window.addEventListener("message", (ev) => {
    // GAS側からの返信のみ処理（originはscript.google.com / googleusercontent）
    const data = ev.data;
    if (!data || typeof data !== "object") return;

    if (data.type === "bridge:ready") {
      bridgeReady = true;
      return;
    }

    if (data.type === "bridge:response") {
      const { id, ok, payload, message } = data;
      const p = pending.get(id);
      if (!p) return;
      pending.delete(id);
      ok ? p.resolve(payload) : p.reject(new Error(message || "bridge error"));
    }
  });
}

function callGas(method, args = []) {
  ensureBridge();
  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID();
    pending.set(id, { resolve, reject });

    // bridgeがまだでも投げる（ready前でも受け取れるようにGAS側は実装）
    bridgeIframe.contentWindow.postMessage(
      { type: "bridge:call", id, method, args },
      "*"
    );

    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error("タイムアウト：GAS応答なし"));
      }
    }, 25000);
  });
}

/* ========= 画像圧縮 ========= */
async function fileToDataUrl(file) {
  const buf = await file.arrayBuffer();
  const blob = new Blob([buf], { type: file.type || "image/jpeg" });
  return await new Promise((res) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.readAsDataURL(blob);
  });
}

async function compressImageDataUrl(dataUrl, maxW = 1280, quality = 0.8) {
  const img = new Image();
  img.src = dataUrl;

  await new Promise((r) => (img.onload = r));

  const w = img.width;
  const h = img.height;
  const scale = Math.min(1, maxW / w);
  const nw = Math.round(w * scale);
  const nh = Math.round(h * scale);

  const c = document.createElement("canvas");
  c.width = nw;
  c.height = nh;
  const ctx = c.getContext("2d");
  ctx.drawImage(img, 0, 0, nw, nh);

  // JPEGで統一
  return c.toDataURL("image/jpeg", quality);
}

/* ========= フォーム共通 ========= */
function bindCommonDefaults() {
  const dateEl = $("#date");
  const timeEl = $("#timeSelected");
  if (dateEl && !dateEl.value) dateEl.value = fmtDate();
  if (timeEl && !timeEl.value) timeEl.value = fmtTime();
}

/* ========= 写真UI ========= */
function bindPhotoPicker() {
  const input = $("#photos");
  const list = $("#photoList");
  if (!input || !list) return;

  input.addEventListener("change", async () => {
    list.innerHTML = "";
    const files = Array.from(input.files || []);
    if (!files.length) return;

    for (const f of files) {
      const li = document.createElement("div");
      li.className = "photoItem";
      li.textContent = `処理中… ${f.name}`;
      list.appendChild(li);

      try {
        const du = await fileToDataUrl(f);
        const compressed = await compressImageDataUrl(du, 1280, 0.8);

        li.textContent = f.name;
        li.dataset.dataUrl = compressed;
        li.dataset.filename = f.name;

        const img = document.createElement("img");
        img.src = compressed;
        li.appendChild(img);
      } catch (e) {
        li.textContent = `失敗: ${f.name}`;
      }
    }
  });
}

function collectPhotos() {
  const list = $("#photoList");
  if (!list) return [];
  const items = Array.from(list.querySelectorAll(".photoItem"));
  const out = [];
  items.forEach((it) => {
    const dataUrl = it.dataset.dataUrl;
    const filename = it.dataset.filename;
    if (dataUrl && filename) out.push({ dataUrl, filename });
  });
  return out;
}

/* ========= 保存 ========= */
async function submitTenko(mode) {
  // 必須
  const data = {
    mode,
    date: safeStr($("#date")?.value),
    timeSelected: safeStr($("#timeSelected")?.value),
    driverName: safeStr($("#driverName")?.value),
    vehicleNo: safeStr($("#vehicleNo")?.value),
    alcoholValue: safeStr($("#alcoholValue")?.value),

    phone: safeStr($("#phone")?.value),
    email: safeStr($("#email")?.value),
    licenseNo: safeStr($("#licenseNo")?.value),
    area: safeStr($("#area")?.value),
    route: safeStr($("#route")?.value),

    alcoholJudge: safeStr($("#alcoholJudge")?.value),
    condition: safeStr($("#condition")?.value),
    fatigue: safeStr($("#fatigue")?.value),
    temperature: safeStr($("#temperature")?.value),
    sleepHours: safeStr($("#sleepHours")?.value),
    medicine: safeStr($("#medicine")?.value),
    healthMemo: safeStr($("#healthMemo")?.value),

    checkBrakeTire: safeStr($("#checkBrakeTire")?.value),
    checkLights: safeStr($("#checkLights")?.value),
    checkMirror: safeStr($("#checkMirror")?.value),
    checkLockLoad: safeStr($("#checkLockLoad")?.value),
    checkOther: safeStr($("#checkOther")?.value),

    meterStart: safeStr($("#meterStart")?.value),
    meterEnd: safeStr($("#meterEnd")?.value),
    remarks: safeStr($("#remarks")?.value),

    photos: collectPhotos(),
  };

  const required = ["mode", "date", "timeSelected", "driverName", "vehicleNo", "alcoholValue"];
  for (const k of required) {
    if (!data[k]) throw new Error(`必須が未入力: ${k}`);
  }

  toast("保存中…", "info");

  // GAS側: saveTenkoRecord を呼ぶ
  const res = await callGas("saveTenkoRecord", [data]);

  if (res?.ok) {
    toast("✅ 保存しました", "success");
    $("#resultBox").classList.remove("hidden");
    $("#resultRecordId").textContent = res.recordId || "";
    $("#resultPhotoUrl").href = res.photoFolderUrl || "#";
    $("#resultPhotoUrl").textContent = res.photoFolderUrl ? "写真フォルダを開く" : "（写真なし）";

    // iPhone/LINE共有用に、結果をクリップボードにも出す
    const shareText =
      `OFA点呼保存OK\n` +
      `日付:${data.date} ${data.timeSelected}\n` +
      `区分:${data.mode}\n` +
      `氏名:${data.driverName}\n` +
      `車両:${data.vehicleNo}\n` +
      `記録ID:${res.recordId || ""}\n` +
      (res.photoFolderUrl ? `写真:${res.photoFolderUrl}\n` : "");

    $("#copyText").value = shareText;
  } else {
    throw new Error(res?.message || "保存失敗");
  }
}

/* ========= レポート ========= */
async function makeDailyPdf() {
  const date = safeStr($("#repDate")?.value);
  const name = safeStr($("#repName")?.value);
  if (!date) throw new Error("日付が必要です");
  toast("日報PDF作成中…", "info");

  // GAS側 createDailyPdf を呼ぶ
  const res = await callGas("createDailyPdf", [date, name]);
  if (!res?.ok) throw new Error(res?.message || "日報PDF失敗");

  $("#repOut").classList.remove("hidden");
  $("#repOutTitle").textContent = "日報PDF";
  $("#repOutUrl").href = res.url;
  $("#repOutUrl").textContent = res.url;
  toast("✅ 日報PDFできました", "success");
}

async function makeMonthlyPdf() {
  const ym = safeStr($("#repYm")?.value);
  const name = safeStr($("#repName2")?.value);
  if (!ym) throw new Error("YYYY-MM が必要です");
  toast("月報PDF作成中…", "info");

  const res = await callGas("createMonthlyPdf", [ym, name]);
  if (!res?.ok) throw new Error(res?.message || "月報PDF失敗");

  $("#repOut").classList.remove("hidden");
  $("#repOutTitle").textContent = "月報PDF";
  $("#repOutUrl").href = res.url;
  $("#repOutUrl").textContent = res.url;
  toast("✅ 月報PDFできました", "success");
}

async function makeMonthlyCsv() {
  const ym = safeStr($("#repYm2")?.value);
  const name = safeStr($("#repName3")?.value);
  if (!ym) throw new Error("YYYY-MM が必要です");
  toast("月CSV作成中…", "info");

  const res = await callGas("createMonthlyCsvText", [ym, name]);
  if (!res?.ok) throw new Error(res?.message || "月CSV失敗");

  const csv = res.csv || "";
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  $("#repOut").classList.remove("hidden");
  $("#repOutTitle").textContent = "月CSV（ダウンロード）";
  $("#repOutUrl").href = url;
  $("#repOutUrl").download = `OFA_月CSV_${ym}.csv`;
  $("#repOutUrl").textContent = "CSVをダウンロード";
  toast("✅ CSVできました", "success");
}

/* ========= ページごとの初期化 ========= */
window.addEventListener("load", () => {
  // bridgeを先に起動（遅延対策）
  ensureBridge();

  const page = document.body.dataset.page;

  if (page === "departure") {
    bindCommonDefaults();
    bindPhotoPicker();
    $("#submitBtn")?.addEventListener("click", async () => {
      try { await submitTenko("departure"); }
      catch (e) { toast(e.message || String(e), "error"); }
    });
  }

  if (page === "arrival") {
    bindCommonDefaults();
    bindPhotoPicker();
    $("#submitBtn")?.addEventListener("click", async () => {
      try { await submitTenko("arrival"); }
      catch (e) { toast(e.message || String(e), "error"); }
    });
  }

  if (page === "reports") {
    // デフォルト
    const d = new Date();
    $("#repDate").value = fmtDate(d);
    $("#repYm").value = fmtDate(d).slice(0, 7);
    $("#repYm2").value = fmtDate(d).slice(0, 7);

    $("#btnDailyPdf")?.addEventListener("click", async () => {
      try { await makeDailyPdf(); }
      catch (e) { toast(e.message || String(e), "error"); }
    });
    $("#btnMonthlyPdf")?.addEventListener("click", async () => {
      try { await makeMonthlyPdf(); }
      catch (e) { toast(e.message || String(e), "error"); }
    });
    $("#btnMonthlyCsv")?.addEventListener("click", async () => {
      try { await makeMonthlyCsv(); }
      catch (e) { toast(e.message || String(e), "error"); }
    });
  }
});
