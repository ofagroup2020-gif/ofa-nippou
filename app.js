/****************************************************
 * OFA 点呼アプリ（GitHub Pages側）完全版
 * - departure.html / arrival.html 送信（doPost）
 * - export.html
 *    日報PDF / 月報PDF / 月次CSV / 範囲CSV / 日報PDF履歴一覧（doGet action）
 ****************************************************/

/** ★あなたのGAS WebApp URL（最新）※ここ超重要 */
const GAS_WEBAPP_URL =
  "https://script.google.com/macros/s/AKfycbxa7fmk0rDDNmZ2p2GTEmE8g6yVaVJxy97J2vpw_NUuYr8lR3QbDNg6EDifoSoSFrKq9Q/exec";

/** アプリ識別（GAS側と一致） */
const APP_KEY = "OFA_TENKO";

/** ===== 共通ユーティリティ ===== */
function $(id) {
  return document.getElementById(id);
}

function toast(msg, ok = false) {
  const el = $("toast");
  if (!el) {
    alert(msg);
    return;
  }
  el.textContent = msg;
  el.className = "toast " + (ok ? "ok" : "ng");
  el.style.display = "block";
  setTimeout(() => (el.style.display = "none"), 2600);
}

function toYMD(dateObj = new Date()) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, "0");
  const d = String(dateObj.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function toHM(dateObj = new Date()) {
  const h = String(dateObj.getHours()).padStart(2, "0");
  const m = String(dateObj.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

function normalizeYMD(input) {
  // "2025/12/30" → "2025-12-30" , "2025-12-30"はそのまま
  return String(input || "")
    .trim()
    .replace(/\//g, "-");
}

function safeStr(v) {
  return (v === undefined || v === null) ? "" : String(v).trim();
}

function numOrBlank(v) {
  const s = safeStr(v);
  if (!s) return "";
  const n = Number(s);
  return Number.isFinite(n) ? n : "";
}

/** yyyy-mm 用に整形 */
function normalizeYM(input) {
  const s = safeStr(input).replace(/\//g, "-");
  // "2025-12" 想定。 "2025" が来たらそのまま返す（GAS側で対応してるならOK）
  return s;
}

/** 画像を圧縮してDataURLに（スマホ送信重い対策） */
async function fileToCompressedDataURL(file, maxW = 1280, quality = 0.75) {
  if (!file) return null;
  if (!file.type || !file.type.startsWith("image/")) return null;

  const img = await new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () => resolve({ im, url });
    im.onerror = reject;
    im.src = url;
  });

  const { im, url } = img;
  const w = im.naturalWidth || im.width;
  const h = im.naturalHeight || im.height;

  const scale = Math.min(1, maxW / w);
  const cw = Math.round(w * scale);
  const ch = Math.round(h * scale);

  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(im, 0, 0, cw, ch);

  URL.revokeObjectURL(url);

  // JPEG固定（軽い）
  return canvas.toDataURL("image/jpeg", quality);
}

/** input[type=file] multiple → dataURL配列 */
async function collectFilesAsDataURLs(inputId) {
  const el = $(inputId);
  if (!el || !el.files || !el.files.length) return [];
  const files = Array.from(el.files);
  const out = [];
  for (const f of files) {
    const du = await fileToCompressedDataURL(f, 1280, 0.75);
    if (du) out.push(du);
  }
  return out;
}

/** ===== 点検項目をまとめる ===== */
function collectInspection() {
  // selectのID一覧（departure/arrival共通）
  const keys = [
    "insp_tire",
    "insp_light",
    "insp_brake",
    "insp_wiper",
    "insp_engineOil",
    "insp_coolant",
    "insp_damage",
    "insp_cargo",
  ];

  const obj = {};
  keys.forEach((id) => {
    const el = $(id);
    if (el) obj[id] = safeStr(el.value);
  });

  const note = $("insp_note");
  if (note) obj.note = safeStr(note.value);

  return obj;
}

/** ===== 出発/帰着 送信（doPost）===== */
async function submitTenko(mode) {
  try {
    if (mode !== "departure" && mode !== "arrival") {
      toast("invalid mode");
      return;
    }

    const date = normalizeYMD(safeStr($("date")?.value));
    const time = safeStr($("time")?.value);
    const driverName = safeStr($("driverName")?.value);
    const vehicleNo = safeStr($("vehicleNo")?.value);
    const managerName = safeStr($("managerName")?.value);
    const method = safeStr($("method")?.value);
    const place = safeStr($("place")?.value);
    const alcoholValue = safeStr($("alcoholValue")?.value);
    const alcoholBand = safeStr($("alcoholBand")?.value);
    const memo = safeStr($("memo")?.value);

    // 走行距離
    const odoStart = numOrBlank($("odoStart")?.value);
    const odoEnd = numOrBlank($("odoEnd")?.value);
    let odoTotal = "";
    if (odoStart !== "" && odoEnd !== "") {
      odoTotal = Math.max(0, Number(odoEnd) - Number(odoStart));
    }

    // 免許番号（任意）
    const licenseNo = safeStr($("licenseNo")?.value);

    // arrival only：日報
    const workType = safeStr($("workType")?.value);
    const workArea = safeStr($("workArea")?.value);
    const workHours = safeStr($("workHours")?.value);
    const deliveryCount = safeStr($("deliveryCount")?.value);
    const trouble = safeStr($("trouble")?.value);
    const dailyNote = safeStr($("dailyNote")?.value);

    // 必須チェック（最低限）
    const must = (v, name) => {
      if (!v) throw new Error(`未入力: ${name}`);
    };
    must(date, "日付");
    must(time, "時刻");
    must(driverName, "運転者氏名");
    must(vehicleNo, "車両番号");
    must(managerName, "点呼実施者");
    must(method, "点呼方法");
    must(alcoholValue, "アルコール測定値");
    must(alcoholBand, "酒気帯び");

    // 点検
    const inspection = collectInspection();

    // 写真（任意）
    const photos = await collectFilesAsDataURLs("tenkoPhotos");
    const reportPhotos = await collectFilesAsDataURLs("reportPhotos"); // arrival想定だがあってもOK
    const licensePhotos = await collectFilesAsDataURLs("licensePhotos");

    const payload = {
      app: APP_KEY,
      mode,
      data: {
        date,
        time,
        driverName,
        vehicleNo,
        managerName,
        method,
        place,
        alcoholValue,
        alcoholBand,
        memo,
        odoStart,
        odoEnd,
        odoTotal,
        licenseNo,
        inspection,
        workType,
        workArea,
        workHours,
        deliveryCount,
        trouble,
        dailyNote,
      },
      photos,
      reportPhotos,
      licensePhotos,
    };

    $("btnSubmit") && ($("btnSubmit").disabled = true);
    toast("送信中…", true);

    const res = await fetch(GAS_WEBAPP_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });

    const json = await res.json().catch(() => null);
    if (!json || !json.ok) {
      const msg = json?.message || "送信失敗";
      throw new Error(msg);
    }

    toast("送信OK（保存完了）", true);

    setTimeout(() => {
      window.location.href = "index.html";
    }, 650);
  } catch (err) {
    toast(err.message || String(err));
    $("btnSubmit") && ($("btnSubmit").disabled = false);
  }
}

/** ===== export 共通（doGet action）===== */
async function callExportApi(url) {
  const res = await fetch(url, { method: "GET" });
  const json = await res.json().catch(() => null);
  if (!json || !json.ok) {
    const msg = json?.message || "作成失敗";
    throw new Error(msg);
  }
  return json;
}

function renderResultLink(title, url) {
  const out = $("result");
  if (!out) return;

  out.innerHTML = `
    <div class="resultBox">
      <div class="resultTitle">✅ ${title}</div>
      <div class="resultLink"><a href="${url}" target="_blank" rel="noopener">ファイルを開く（Drive）</a></div>
      <div class="resultSmall">※印刷は「共有→印刷」またはDriveの印刷機能でOK</div>
    </div>
  `;
}

/** ===== 日報PDF / 月報PDF / 月次CSV ===== */
async function runExport(action) {
  try {
    const dateRaw = safeStr($("date")?.value);
    const monthRaw = safeStr($("month")?.value);
    const name = safeStr($("name")?.value);

    const date = normalizeYMD(dateRaw);
    const month = normalizeYM(monthRaw);

    let url = `${GAS_WEBAPP_URL}?action=${encodeURIComponent(action)}`;

    if (action === "dailyPdf") {
      if (!date) throw new Error("日付（YYYY-MM-DD）が必要です");
      url += `&date=${encodeURIComponent(date)}`;
      if (name) url += `&name=${encodeURIComponent(name)}`;
    } else if (action === "monthlyPdf" || action === "monthlyCsv") {
      if (!month) throw new Error("月（YYYY-MM）が必要です");
      url += `&month=${encodeURIComponent(month)}`;
      if (name) url += `&name=${encodeURIComponent(name)}`;
    } else {
      throw new Error("invalid action");
    }

    toast("作成中…（数秒かかります）", true);
    const json = await callExportApi(url);

    const title =
      action === "dailyPdf" ? "日報PDF 作成完了" :
      action === "monthlyPdf" ? "月報PDF 作成完了" :
      "月次CSV 作成完了";

    renderResultLink(title, json.url);
    toast("作成OK（リンクを表示）", true);
  } catch (err) {
    toast(err.message || String(err));
  }
}

/** ===== 範囲CSV（from/to）===== */
async function runRangeCsv() {
  try {
    const fromRaw = safeStr($("from")?.value);
    const toRaw = safeStr($("to")?.value);
    const name = safeStr($("name")?.value);

    const from = normalizeYMD(fromRaw);
    const to = normalizeYMD(toRaw);
    if (!from || !to) throw new Error("開始日(from) / 終了日(to) を入力してください");

    let url = `${GAS_WEBAPP_URL}?action=rangeCsv&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
    if (name) url += `&name=${encodeURIComponent(name)}`;

    toast("CSV作成中…", true);
    const json = await callExportApi(url);
    renderResultLink("範囲CSV 作成完了", json.url);
    toast("作成OK（リンクを表示）", true);
  } catch (err) {
    toast(err.message || String(err));
  }
}

/** ===== 日報PDF 履歴（一覧）===== */
async function loadDailyHistory() {
  try {
    const monthRaw = safeStr($("histMonth")?.value); // YYYY-MM
    const name = safeStr($("name")?.value);

    const month = normalizeYM(monthRaw);
    if (!month) throw new Error("履歴対象月（YYYY-MM）を入れてください");

    let url = `${GAS_WEBAPP_URL}?action=dailyList&month=${encodeURIComponent(month)}`;
    if (name) url += `&name=${encodeURIComponent(name)}`;

    toast("履歴読み込み中…", true);
    const json = await callExportApi(url);

    const list = Array.isArray(json.items) ? json.items : [];
    const box = $("history");
    if (!box) return;

    if (!list.length) {
      box.innerHTML = `<div class="historyEmpty">データなし</div>`;
      toast("履歴: 0件", true);
      return;
    }

    // クリックでその日のPDFを作る
    const html = list.map(it => {
      const d = safeStr(it.date);
      const label = safeStr(it.label) || d;
      return `
        <button class="historyItem" data-date="${d}">
          <div class="historyDate">${label}</div>
          <div class="historySub">タップで日報PDFを作成</div>
        </button>
      `;
    }).join("");

    box.innerHTML = html;

    box.querySelectorAll(".historyItem").forEach(btn => {
      btn.addEventListener("click", async () => {
        const d = btn.getAttribute("data-date");
        if (!d) return;
        // 作成→リンク表示
        $("date") && ($("date").value = d);
        await runExport("dailyPdf");
      });
    });

    toast(`履歴: ${list.length}件`, true);
  } catch (err) {
    toast(err.message || String(err));
  }
}

/** ===== ページ初期化 ===== */
function initDeparturePage() {
  if ($("date") && !$("date").value) $("date").value = toYMD();
  if ($("time") && !$("time").value) $("time").value = toHM();

  const calc = () => {
    const s = numOrBlank($("odoStart")?.value);
    const e = numOrBlank($("odoEnd")?.value);
    if ($("odoTotal")) {
      if (s !== "" && e !== "") $("odoTotal").value = Math.max(0, Number(e) - Number(s));
      else $("odoTotal").value = "";
    }
  };
  $("odoStart")?.addEventListener("input", calc);
  $("odoEnd")?.addEventListener("input", calc);

  $("btnSubmit")?.addEventListener("click", () => submitTenko("departure"));
}

function initArrivalPage() {
  if ($("date") && !$("date").value) $("date").value = toYMD();
  if ($("time") && !$("time").value) $("time").value = toHM();

  const calc = () => {
    const s = numOrBlank($("odoStart")?.value);
    const e = numOrBlank($("odoEnd")?.value);
    if ($("odoTotal")) {
      if (s !== "" && e !== "") $("odoTotal").value = Math.max(0, Number(e) - Number(s));
      else $("odoTotal").value = "";
    }
  };
  $("odoStart")?.addEventListener("input", calc);
  $("odoEnd")?.addEventListener("input", calc);

  $("btnSubmit")?.addEventListener("click", () => submitTenko("arrival"));
}

function initExportPage() {
  if ($("date") && !$("date").value) $("date").value = toYMD();

  if ($("month") && !$("month").value) {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    $("month").value = `${y}-${m}`;
  }

  if ($("histMonth") && !$("histMonth").value) {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    $("histMonth").value = `${y}-${m}`;
  }

  $("btnDailyPdf")?.addEventListener("click", () => runExport("dailyPdf"));
  $("btnMonthlyPdf")?.addEventListener("click", () => runExport("monthlyPdf"));
  $("btnMonthlyCsv")?.addEventListener("click", () => runExport("monthlyCsv"));

  $("btnRangeCsv")?.addEventListener("click", () => runRangeCsv());
  $("btnLoadHistory")?.addEventListener("click", () => loadDailyHistory());
}

/** DOM Ready */
window.addEventListener("DOMContentLoaded", () => {
  const page = document.body?.dataset?.page || "";
  if (page === "departure") initDeparturePage();
  if (page === "arrival") initArrivalPage();
  if (page === "export") initExportPage();
});
