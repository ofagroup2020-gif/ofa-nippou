/* =========================
   OFA Tenko & Inspection - Frontend
   - API URL: localStorage
   - Ping
   - Send (depart/arrive)
   - PDF/CSV links
   - Image compress to JPEG (HEIC warn)
========================= */

const $ = (id) => document.getElementById(id);

const ui = {
  apiUrl: $("apiUrl"),
  btnSaveUrl: $("btnSaveUrl"),
  btnClearUrl: $("btnClearUrl"),
  btnPing: $("btnPing"),
  connStatus: $("connStatus"),

  tabDepart: $("tabDepart"),
  tabArrive: $("tabArrive"),

  driver: $("driver"),
  vehicle: $("vehicle"),
  phone: $("phone"),
  area: $("area"),
  route: $("route"),

  alcohol: $("alcohol"),
  alcoholValue: $("alcoholValue"),
  condition: $("condition"),
  fatigue: $("fatigue"),
  temp: $("temp"),
  sleep: $("sleep"),
  medication: $("medication"),
  healthMemo: $("healthMemo"),

  inspection: $("inspection"),
  inspectionDetailWrap: $("inspectionDetailWrap"),
  inspectionDetail: $("inspectionDetail"),

  meterStartWrap: $("meterStartWrap"),
  meterEndWrap: $("meterEndWrap"),
  meterStartLabel: $("meterStartLabel"),
  meterEndLabel: $("meterEndLabel"),
  meterStart: $("meterStart"),
  meterEnd: $("meterEnd"),

  photoInspection: $("photoInspection"),
  photoAlcohol: $("photoAlcohol"),
  photoMeter: $("photoMeter"),
  photoOther: $("photoOther"),

  memo: $("memo"),
  btnSend: $("btnSend"),

  dayDate: $("dayDate"),
  monthYm: $("monthYm"),
  dayCsvDate: $("dayCsvDate"),
  monthCsvYm: $("monthCsvYm"),
  btnDayPdf: $("btnDayPdf"),
  btnMonthPdf: $("btnMonthPdf"),
  btnDayCsv: $("btnDayCsv"),
  btnMonthCsv: $("btnMonthCsv"),

  toast: $("toast"),
};

const LS = {
  apiUrl: "ofa_tenko_apiUrl",
  driver: "ofa_tenko_driver",
  vehicle: "ofa_tenko_vehicle",
  phone: "ofa_tenko_phone",
  area: "ofa_tenko_area",
  route: "ofa_tenko_route",
};

let mode = "depart"; // depart | arrive
let lastPingOk = false;

function toast(type, msg) {
  ui.toast.className = "toast " + (type || "");
  ui.toast.textContent = msg;
  ui.toast.style.display = "block";
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (ui.toast.style.display = "none"), 3500);
}

function setConn(ok, title, sub) {
  const dot = ui.connStatus.querySelector(".dot");
  dot.className = "dot " + (ok === true ? "dot-ok" : ok === false ? "dot-ng" : "dot-gray");
  ui.connStatus.querySelector(".status-title").textContent = title;
  ui.connStatus.querySelector(".status-sub").textContent = sub;
  lastPingOk = ok === true;
}

function getApiUrl() {
  return (ui.apiUrl.value || "").trim();
}

function saveApiUrl() {
  const url = getApiUrl();
  if (!url) return toast("ng", "API URLを入力してください");
  if (!/\/exec$/.test(url)) return toast("warn", "URLは /exec まで含めてください");
  localStorage.setItem(LS.apiUrl, url);
  toast("ok", "API URLを保存しました");
}

function clearApiUrl() {
  localStorage.removeItem(LS.apiUrl);
  ui.apiUrl.value = "";
  setConn(null, "未確認", "接続テストを押してください");
  toast("ok", "URLをクリアしました");
}

function saveProfile() {
  localStorage.setItem(LS.driver, ui.driver.value.trim());
  localStorage.setItem(LS.vehicle, ui.vehicle.value.trim());
  localStorage.setItem(LS.phone, ui.phone.value.trim());
  localStorage.setItem(LS.area, ui.area.value.trim());
  localStorage.setItem(LS.route, ui.route.value.trim());
}

function loadProfile() {
  ui.apiUrl.value = localStorage.getItem(LS.apiUrl) || "";
  ui.driver.value = localStorage.getItem(LS.driver) || "";
  ui.vehicle.value = localStorage.getItem(LS.vehicle) || "";
  ui.phone.value = localStorage.getItem(LS.phone) || "";
  ui.area.value = localStorage.getItem(LS.area) || "";
  ui.route.value = localStorage.getItem(LS.route) || "";

  // date defaults
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const ymd = `${yyyy}-${mm}-${dd}`;
  ui.dayDate.value = ymd;
  ui.dayCsvDate.value = ymd;
  ui.monthYm.value = `${yyyy}-${mm}`;
  ui.monthCsvYm.value = `${yyyy}-${mm}`;
}

function setMode(nextMode) {
  mode = nextMode;

  ui.tabDepart.classList.toggle("active", mode === "depart");
  ui.tabArrive.classList.toggle("active", mode === "arrive");
  ui.tabDepart.setAttribute("aria-selected", String(mode === "depart"));
  ui.tabArrive.setAttribute("aria-selected", String(mode === "arrive"));

  // Meter labels + required toggles
  if (mode === "depart") {
    ui.meterStartLabel.textContent = "メーター（出発）";
    ui.meterEndLabel.textContent = "メーター（帰着）";
    ui.meterStartWrap.style.display = "";
    ui.meterEndWrap.style.display = "none"; // 出発時は帰着不要
  } else {
    ui.meterStartLabel.textContent = "メーター（出発）";
    ui.meterEndLabel.textContent = "メーター（帰着）";
    ui.meterStartWrap.style.display = "none"; // 帰着時は出発不要
    ui.meterEndWrap.style.display = "";
  }
}

function setInspectionRule() {
  const val = ui.inspection.value;
  ui.inspectionDetailWrap.style.display = (val === "異常あり") ? "" : "";
  // 表示は残すが、必須判定は validate() で行う
}

function validate() {
  const driver = ui.driver.value.trim();
  const vehicle = ui.vehicle.value.trim();
  if (!driver) return "氏名（必須）が未入力です";
  if (!vehicle) return "車両番号（必須）が未入力です";

  // Law template: required differs by mode
  if (mode === "depart") {
    // 出発: meterStart required
    if (!ui.meterStart.value.trim()) return "メーター（出発）は必須です";
  } else {
    // 帰着: meterEnd required
    if (!ui.meterEnd.value.trim()) return "メーター（帰着）は必須です";
  }

  // Inspection abnormal requires detail
  if (ui.inspection.value === "異常あり" && !ui.inspectionDetail.value.trim()) {
    return "異常ありの場合は「異常内容」を入力してください";
  }

  // Tenko minimum: alcohol + condition already selected (always)
  return null;
}

function timeoutFetch(url, opts = {}, ms = 12000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(t));
}

async function ping() {
  const url = getApiUrl();
  if (!url) return toast("ng", "API URLを入力してください");
  if (!/\/exec$/.test(url)) return toast("warn", "URLは /exec まで含めてください");

  setConn(null, "確認中…", "サーバーへ接続しています");
  try {
    const res = await timeoutFetch(url + "?ping=1", { method: "GET" }, 12000);
    const txt = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    // try parse
    let j = null;
    try { j = JSON.parse(txt); } catch {}
    if (j && j.ok) {
      setConn(true, "接続OK", "接続できました。送信テストOKです。");
      toast("ok", "接続OK（到達）");
    } else {
      setConn(false, "接続NG", "応答はあるが形式が違います（GASコードを確認）");
      toast("ng", "接続NG（応答形式エラー）");
    }
  } catch (e) {
    setConn(false, "接続NG", "通信に失敗しました（URL/デプロイ設定を確認）");
    toast("ng", "接続NG（URL/デプロイ設定を確認）");
  }
}

async function fileToJpegDataUrl(file, { maxW = 1600, quality = 0.82 } = {}) {
  if (!file) return "";

  const name = (file.name || "").toLowerCase();
  const type = (file.type || "").toLowerCase();

  // HEIC warning (browsers often can't decode it)
  if (name.endsWith(".heic") || type.includes("heic")) {
    throw new Error("HEIC画像は変換できない場合があります。JPEGで選択してください（写真をスクショでもOK）");
  }

  // If browser can decode -> compress using canvas
  const blobUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error("画像を読み込めません（形式をJPEG/PNGにしてください）"));
      im.src = blobUrl;
    });

    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    let nw = w, nh = h;
    if (w > maxW) {
      nw = maxW;
      nh = Math.round(h * (maxW / w));
    }

    const canvas = document.createElement("canvas");
    canvas.width = nw;
    canvas.height = nh;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, nw, nh);

    return canvas.toDataURL("image/jpeg", quality);
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

function buildPayload(photoUrls) {
  return {
    type: mode, // depart|arrive
    driver: ui.driver.value.trim(),
    vehicle: ui.vehicle.value.trim(),
    phone: ui.phone.value.trim(),
    area: ui.area.value.trim(),
    route: ui.route.value.trim(),

    alcohol: ui.alcohol.value,
    alcoholValue: ui.alcoholValue.value.trim(),
    condition: ui.condition.value,
    fatigue: ui.fatigue.value,
    temp: ui.temp.value.trim(),
    sleep: ui.sleep.value.trim(),
    medication: ui.medication.value,
    healthMemo: ui.healthMemo.value.trim(),

    inspection: ui.inspection.value,
    inspectionDetail: ui.inspectionDetail.value.trim(),

    meterStart: ui.meterStart.value.trim(),
    meterEnd: ui.meterEnd.value.trim(),

    memo: ui.memo.value.trim(),

    photos: photoUrls, // dataURL strings
    client: {
      ua: navigator.userAgent,
      ts: new Date().toISOString(),
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
    }
  };
}

async function send() {
  const err = validate();
  if (err) return toast("ng", err);

  const url = getApiUrl();
  if (!url) return toast("ng", "API URLを入力してください");
  if (!/\/exec$/.test(url)) return toast("warn", "URLは /exec まで含めてください");

  // optional but recommended
  saveProfile();
  if (!lastPingOk) {
    toast("warn", "接続テストを推奨します（ただし送信は試行します）");
  }

  ui.btnSend.disabled = true;
  ui.btnSend.textContent = "送信中…";

  try {
    // photos -> compress
    const photos = {};
    const tasks = [
      ["inspectionPhoto", ui.photoInspection.files?.[0]],
      ["alcoholPhoto", ui.photoAlcohol.files?.[0]],
      ["meterPhoto", ui.photoMeter.files?.[0]],
      ["otherPhoto", ui.photoOther.files?.[0]],
    ];

    for (const [key, file] of tasks) {
      if (!file) { photos[key] = ""; continue; }
      photos[key] = await fileToJpegDataUrl(file, { maxW: 1600, quality: 0.82 });
    }

    const payload = buildPayload(photos);

    const res = await timeoutFetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    }, 20000);

    const txt = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    let j = null;
    try { j = JSON.parse(txt); } catch {}
    if (!j || !j.ok) {
      throw new Error(j?.error || "送信に失敗しました（GAS応答が不正）");
    }

    toast("ok", "✅ 送信しました");
  } catch (e) {
    toast("ng", "❌ 送信に失敗： " + (e?.message || String(e)));
  } finally {
    ui.btnSend.disabled = false;
    ui.btnSend.textContent = "送信";
  }
}

function openLink(url) {
  window.open(url, "_blank", "noopener");
}

function buildReportUrl(kind, params) {
  const base = getApiUrl();
  if (!base) return "";
  const u = new URL(base);
  Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v));
  return u.toString();
}

function normalizeYmd(d) { return d; } // already yyyy-mm-dd
function normalizeYm(m) { return m; } // yyyy-mm

function bind() {
  ui.btnSaveUrl.addEventListener("click", saveApiUrl);
  ui.btnClearUrl.addEventListener("click", clearApiUrl);
  ui.btnPing.addEventListener("click", ping);

  ui.tabDepart.addEventListener("click", () => setMode("depart"));
  ui.tabArrive.addEventListener("click", () => setMode("arrive"));

  ui.inspection.addEventListener("change", setInspectionRule);

  ["driver","vehicle","phone","area","route"].forEach(id=>{
    ui[id].addEventListener("change", saveProfile);
  });

  ui.btnSend.addEventListener("click", send);

  // PDF
  ui.btnDayPdf.addEventListener("click", () => {
    const ymd = normalizeYmd(ui.dayDate.value);
    const driver = ui.driver.value.trim();
    const link = buildReportUrl("pdfDay", { pdf: "day", date: ymd, driver });
    if (!link) return toast("ng", "API URLを入力してください");
    openLink(link);
  });

  ui.btnMonthPdf.addEventListener("click", () => {
    const ym = normalizeYm(ui.monthYm.value);
    const driver = ui.driver.value.trim();
    const link = buildReportUrl("pdfMonth", { pdf: "month", ym, driver });
    if (!link) return toast("ng", "API URLを入力してください");
    openLink(link);
  });

  // CSV
  ui.btnDayCsv.addEventListener("click", () => {
    const ymd = normalizeYmd(ui.dayCsvDate.value);
    const driver = ui.driver.value.trim();
    const link = buildReportUrl("csvDay", { csv: "day", date: ymd, driver });
    if (!link) return toast("ng", "API URLを入力してください");
    openLink(link);
  });

  ui.btnMonthCsv.addEventListener("click", () => {
    const ym = normalizeYm(ui.monthCsvYm.value);
    const driver = ui.driver.value.trim();
    const link = buildReportUrl("csvMonth", { csv: "month", ym, driver });
    if (!link) return toast("ng", "API URLを入力してください");
    openLink(link);
  });
}

(function init(){
  loadProfile();
  setMode("depart");
  setInspectionRule();
  setConn(null, "未確認", "接続テストを押してください");

  // auto ping if url exists
  if (getApiUrl()) {
    // do not spam; just set hint
    setConn(null, "未確認", "URLは保存済みです。接続テストを押してください");
  }
  bind();
})();
