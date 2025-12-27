const $ = (id) => document.getElementById(id);

const state = {
  mode: "start", // start | end
};

function setStatus(kind, title, sub) {
  const dot = $("dot");
  const t = $("statusTitle");
  const s = $("statusSub");
  t.textContent = title;
  s.textContent = sub;

  if (kind === "ok") dot.style.background = "#16b36a";
  else if (kind === "ng") dot.style.background = "#e14b4b";
  else dot.style.background = "#9aa7b5";
}

function toast(kind, msg) {
  const box = $("toast");
  box.className = "toast " + (kind === "ok" ? "ok" : "ng");
  box.textContent = msg;
  box.style.display = "block";
  setTimeout(() => (box.style.display = "none"), 4200);
}

function getApiUrl() {
  return ($("apiUrl").value || "").trim();
}
function saveApiUrl(v) {
  localStorage.setItem("ofa_tenko_api", v);
}
function loadApiUrl() {
  const v = localStorage.getItem("ofa_tenko_api") || "";
  $("apiUrl").value = v;
}

function setMode(mode) {
  state.mode = mode;
  $("modeStart").classList.toggle("active", mode === "start");
  $("modeEnd").classList.toggle("active", mode === "end");

  // 必須項目を切替（法令テンプレ）
  // 出発：メーター（出発）必須、帰着：メーター（帰着）必須
  $("meterStartWrap").style.display = mode === "start" ? "block" : "none";
  $("meterEndWrap").style.display = mode === "end" ? "block" : "none";
}

function todayLocalDateStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function thisMonthStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

// 画像：HEICなどはブラウザ側で JPEG に変換して dataURL を作る（できる範囲で）
async function fileToDataUrlSmart(file) {
  if (!file) return "";

  // 一部環境でHEICはそのまま読めない→FileReaderが失敗する場合あり
  // 可能なら画像として読み込み→canvas→jpeg化
  const readAsDataURL = (f) =>
    new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(new Error("FileReader error"));
      r.readAsDataURL(f);
    });

  // まず素直にdataURL化
  try {
    const raw = await readAsDataURL(file);
    // jpeg/png/webp等はこれでOK
    if (typeof raw === "string" && raw.startsWith("data:image/")) return raw;
  } catch (e) {
    // fallthrough
  }

  // 画像として読み込んでcanvasでjpeg化
  const blobUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("image decode error"));
      i.src = blobUrl;
    });

    const maxW = 1600; // 軽量化（通信量削減）
    const scale = Math.min(1, maxW / img.width);
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, w, h);

    const jpegUrl = canvas.toDataURL("image/jpeg", 0.82);
    return jpegUrl;
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

function validate() {
  const apiUrl = getApiUrl();
  if (!apiUrl) return "API URL を入れてください";

  const driver = ($("driver").value || "").trim();
  const vehicle = ($("vehicle").value || "").trim();
  if (!driver) return "氏名は必須です";
  if (!vehicle) return "車両番号は必須です";

  const alcohol = $("alcohol").value;
  const condition = $("condition").value;
  const inspection = $("inspection").value;

  if (!alcohol) return "アルコールチェックを選択してください";
  if (!condition) return "体調を選択してください";
  if (!inspection) return "点検（異常有無）を選択してください";

  // mode別必須
  if (state.mode === "start") {
    const ms = ($("meterStart").value || "").trim();
    if (!ms) return "メーター（出発）は必須です";
  } else {
    const me = ($("meterEnd").value || "").trim();
    if (!me) return "メーター（帰着）は必須です";
  }

  // 異常ありは内容推奨
  if (inspection === "異常あり") {
    const detail = ($("inspectionDetail").value || "").trim();
    if (!detail) return "異常ありの場合は、異常内容を入力してください";
  }

  return "";
}

async function ping() {
  const apiUrl = getApiUrl();
  if (!apiUrl) {
    setStatus("ng", "接続NG", "API URL を入れてください");
    return;
  }
  saveApiUrl(apiUrl);

  setStatus("idle", "確認中…", apiUrl);

  try {
    const u = new URL(apiUrl);
    u.searchParams.set("ping", "1");
    const res = await fetch(u.toString(), { method: "GET" });
    const json = await res.json();

    if (json && json.ok) {
      setStatus("ok", "接続OK", "接続できました。送信テストOKです。");
    } else {
      setStatus("ng", "接続NG", (json && json.error) ? json.error : "応答が不正です");
    }
  } catch (e) {
    setStatus("ng", "接続NG", "通信に失敗しました（URL/デプロイ設定を確認）");
  }
}

async function send() {
  const err = validate();
  if (err) {
    toast("ng", err);
    return;
  }

  const apiUrl = getApiUrl();
  saveApiUrl(apiUrl);

  const payload = {
    type: state.mode, // start | end
    driver: ($("driver").value || "").trim(),
    vehicle: ($("vehicle").value || "").trim(),
    alcohol: $("alcohol").value,
    condition: $("condition").value,
    temp: ($("temp").value || "").trim(),
    sleep: ($("sleep").value || "").trim(),
    inspection: $("inspection").value,
    inspectionDetail: ($("inspectionDetail").value || "").trim(),

    chk: {
      tire: $("chkTire").value,
      brake: $("chkBrake").value,
      light: $("chkLight").value,
      fluid: $("chkFluid").value,
      load: $("chkLoad").value,
      warn: $("chkWarn").value
    },

    meterStart: ($("meterStart").value || "").trim(),
    meterEnd: ($("meterEnd").value || "").trim(),
    memo: ($("memo").value || "").trim(),

    photos: {}
  };

  // 写真をdataURL化（HEICは自動変換を試す）
  try {
    payload.photos.inspect = await fileToDataUrlSmart($("photoInspect").files[0]);
    payload.photos.alcohol = await fileToDataUrlSmart($("photoAlcohol").files[0]);
    payload.photos.meter = await fileToDataUrlSmart($("photoMeter").files[0]);
    payload.photos.other = await fileToDataUrlSmart($("photoOther").files[0]);
  } catch (e) {
    toast("ng", "写真の変換に失敗しました。JPEGで選択してください。");
    return;
  }

  $("btnSend").disabled = true;
  $("btnSend").textContent = "送信中…";

  try {
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();

    if (json && json.ok) {
      toast("ok", "✅ 送信しました");
      setStatus("ok", "接続OK", "最新送信：OK");
    } else {
      toast("ng", "送信に失敗しました：" + ((json && json.error) ? json.error : "不明"));
      setStatus("ng", "送信NG", "GASの権限/デプロイ/URLを確認");
    }
  } catch (e) {
    toast("ng", "送信に失敗しました（通信エラー）");
    setStatus("ng", "送信NG", "通信に失敗しました（URL/デプロイ設定を確認）");
  } finally {
    $("btnSend").disabled = false;
    $("btnSend").textContent = "送信";
  }
}

async function makePdf(kind) {
  const apiUrl = getApiUrl();
  if (!apiUrl) {
    toast("ng", "API URL を入れてください");
    return;
  }
  saveApiUrl(apiUrl);

  const driver = ($("driver").value || "").trim();
  if (!driver) {
    toast("ng", "PDFは氏名が必要です（氏名を入力してください）");
    return;
  }

  let dateStr = "";
  if (kind === "daily") {
    dateStr = $("dailyDate").value || todayLocalDateStr();
  } else {
    dateStr = $("monthlyYm").value || thisMonthStr();
  }

  const body = { action: kind === "daily" ? "pdf_daily" : "pdf_monthly", driver, date: dateStr };

  try {
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (json && json.ok && json.url) {
      window.open(json.url, "_blank");
      toast("ok", "PDFを作成しました（新しいタブで開きます）");
    } else {
      toast("ng", "PDF作成に失敗：" + ((json && json.error) ? json.error : "不明"));
    }
  } catch (e) {
    toast("ng", "PDF作成：通信エラー");
  }
}

function init() {
  loadApiUrl();

  $("dailyDate").value = todayLocalDateStr();
  $("monthlyYm").value = thisMonthStr();

  $("apiUrl").addEventListener("change", () => saveApiUrl(getApiUrl()));
  $("btnPing").addEventListener("click", ping);

  $("modeStart").addEventListener("click", () => setMode("start"));
  $("modeEnd").addEventListener("click", () => setMode("end"));
  setMode("start");

  $("btnSend").addEventListener("click", send);
  $("btnDailyPdf").addEventListener("click", () => makePdf("daily"));
  $("btnMonthlyPdf").addEventListener("click", () => makePdf("monthly"));
}

document.addEventListener("DOMContentLoaded", init);
