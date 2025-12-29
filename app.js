/* =========================================================
   OFA 点呼・点検 (GitHub Pages Front)
   - departure.html / arrival.html / reports.html
   - GAS WebApp に保存（Google Drive/Sheet/PDF/CSV）
   ========================================================= */

const GAS_WEBAPP_URL =
  "https://script.google.com/macros/s/AKfycbwBeBa0ZAJfZzelyOoZmoJl62LJNTxIaPkxXx0vGgZA9V0Kb6WWOyC9VdLpK0sGy41glw/exec";

// ===== 共通 =====
const $ = (sel) => document.querySelector(sel);

function toast(msg, type = "info") {
  const el = $("#toast");
  if (!el) return alert(msg);
  el.textContent = msg;
  el.dataset.type = type;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2400);
}

function fmtDate(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}

function fmtTime(d = new Date()) {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function qs() {
  const p = new URLSearchParams(location.search);
  const o = {};
  for (const [k, v] of p.entries()) o[k] = v;
  return o;
}

function getLocal(key, defVal = "") {
  try {
    const v = localStorage.getItem(key);
    return v == null ? defVal : v;
  } catch {
    return defVal;
  }
}

function setLocal(key, val) {
  try {
    localStorage.setItem(key, val);
  } catch {}
}

// ===== GAS呼び出し（CORS回避：GAS側 doPost JSON）=====
async function gasPost(payload) {
  const res = await fetch(GAS_WEBAPP_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  });
  const txt = await res.text();
  try {
    return JSON.parse(txt);
  } catch (e) {
    return { ok: false, message: "GAS応答がJSONではありません", raw: txt };
  }
}

// ===== 画像圧縮 -> dataURL =====
async function fileToDataUrl(file, maxW = 1280, quality = 0.82) {
  const img = await loadImageFromFile(file);
  const { canvas, ctx, w, h } = fitToCanvas(img, maxW);
  ctx.drawImage(img, 0, 0, w, h);
  const dataUrl = canvas.toDataURL("image/jpeg", quality);
  return dataUrl;
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = fr.result;
    };
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}

function fitToCanvas(img, maxW) {
  const ratio = img.width / img.height;
  const w = Math.min(img.width, maxW);
  const h = Math.round(w / ratio);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  return { canvas, ctx, w, h };
}

// ===== ページ別初期化 =====
document.addEventListener("DOMContentLoaded", () => {
  const page = document.body.dataset.page;

  if (page === "index") initIndex();
  if (page === "departure") initForm("departure");
  if (page === "arrival") initForm("arrival");
  if (page === "reports") initReports();
});

// ===== index =====
function initIndex() {
  const btnDep = $("#btnDeparture");
  const btnArr = $("#btnArrival");
  const btnRep = $("#btnReports");

  if (btnDep) btnDep.addEventListener("click", () => (location.href = "./departure.html"));
  if (btnArr) btnArr.addEventListener("click", () => (location.href = "./arrival.html"));
  if (btnRep) btnRep.addEventListener("click", () => (location.href = "./reports.html"));

  // ping確認（任意）
  const ping = $("#pingStatus");
  if (ping) {
    fetch(GAS_WEBAPP_URL + "?ping=1")
      .then((r) => r.text())
      .then((t) => {
        ping.textContent = "接続OK";
      })
      .catch(() => {
        ping.textContent = "接続NG";
      });
  }
}

// ===== departure/arrival 共通フォーム =====
function initForm(mode) {
  // 初期値
  $("#date").value = fmtDate(new Date());
  $("#timeSelected").value = fmtTime(new Date());

  // ローカル記憶（入力が楽になる）
  $("#driverName").value = getLocal("ofa_driverName");
  $("#vehicleNo").value = getLocal("ofa_vehicleNo");
  $("#phone").value = getLocal("ofa_phone");
  $("#email").value = getLocal("ofa_email");
  $("#licenseNo").value = getLocal("ofa_licenseNo");
  $("#area").value = getLocal("ofa_area");

  // 写真プレビュー
  const photoInput = $("#photos");
  const preview = $("#photoPreview");
  let photoFiles = [];

  if (photoInput) {
    photoInput.addEventListener("change", () => {
      photoFiles = Array.from(photoInput.files || []);
      if (!preview) return;
      preview.innerHTML = "";
      photoFiles.forEach((f) => {
        const div = document.createElement("div");
        div.className = "thumb";
        div.textContent = f.name;
        preview.appendChild(div);
      });
      toast(`写真 ${photoFiles.length}枚 選択`, "info");
    });
  }

  // 送信
  $("#btnSubmit").addEventListener("click", async () => {
    try {
      $("#btnSubmit").disabled = true;
      toast("送信中…", "info");

      // 必須
      const payload = collectPayload(mode);

      // ローカル保存
      setLocal("ofa_driverName", payload.driverName);
      setLocal("ofa_vehicleNo", payload.vehicleNo);
      setLocal("ofa_phone", payload.phone);
      setLocal("ofa_email", payload.email);
      setLocal("ofa_licenseNo", payload.licenseNo);
      setLocal("ofa_area", payload.area);

      // 写真を dataURL 化（最大6枚推奨）
      const photos = [];
      const limit = Math.min(photoFiles.length, 6);
      for (let i = 0; i < limit; i++) {
        const f = photoFiles[i];
        const dataUrl = await fileToDataUrl(f);
        photos.push({ filename: f.name || `photo_${i + 1}.jpg`, dataUrl });
      }
      payload.photos = photos;

      const res = await gasPost(payload);
      if (!res.ok) throw new Error(res.message || "保存に失敗しました");

      toast("保存完了！", "success");

      // 結果表示
      if ($("#result")) {
        $("#result").innerHTML =
          `<div class="resultBox">
            <div><b>保存OK</b> recordId: ${res.recordId}</div>
            ${res.photoFolderUrl ? `<div>写真: <a target="_blank" href="${res.photoFolderUrl}">Driveフォルダ</a>（${res.photoCount}枚）</div>` : ""}
          </div>`;
      }

      // 次アクション
      if ($("#btnToTop")) {
        $("#btnToTop").classList.remove("hidden");
      }
    } catch (e) {
      toast(String(e.message || e), "error");
    } finally {
      $("#btnSubmit").disabled = false;
    }
  });

  // トップへ
  const topBtn = $("#btnToTop");
  if (topBtn) topBtn.addEventListener("click", () => (location.href = "./index.html"));
}

function collectPayload(mode) {
  const required = (id, label) => {
    const v = ($(id).value || "").trim();
    if (!v) throw new Error(`${label} を入力してください`);
    return v;
  };

  const val = (id) => (($(id) && $(id).value) ? $(id).value.trim() : "");

  // アルコール
  const alcoholValue = required("#alcoholValue", "アルコール数値");
  const alcoholJudge = (() => {
    const n = parseFloat(alcoholValue);
    if (isNaN(n)) return "";
    return n <= 0.0 ? "OK" : "NG";
  })();

  return {
    mode,
    date: required("#date", "日付"),
    timeSelected: required("#timeSelected", "時刻"),
    driverName: required("#driverName", "氏名"),
    vehicleNo: required("#vehicleNo", "車両番号"),
    alcoholValue,
    alcoholJudge,

    phone: val("#phone"),
    email: val("#email"),
    licenseNo: val("#licenseNo"),
    area: val("#area"),
    route: val("#route"),

    condition: val("#condition"),
    fatigue: val("#fatigue"),
    temperature: val("#temperature"),
    sleepHours: val("#sleepHours"),
    medicine: val("#medicine"),
    healthMemo: val("#healthMemo"),

    checkBrakeTire: val("#checkBrakeTire"),
    checkLights: val("#checkLights"),
    checkMirror: val("#checkMirror"),
    checkLockLoad: val("#checkLockLoad"),
    checkOther: val("#checkOther"),

    meterStart: val("#meterStart"),
    meterEnd: val("#meterEnd"),
    remarks: val("#remarks"),
  };
}

// ===== reports =====
function initReports() {
  // 初期値
  $("#repDate").value = fmtDate(new Date());
  $("#repYm").value = fmtDate(new Date()).slice(0, 7);
  $("#repName").value = getLocal("ofa_driverName");

  // 日報PDF
  $("#btnDailyPdf").addEventListener("click", async () => {
    try {
      toast("日報PDF作成中…", "info");
      const date = ($("#repDate").value || "").trim();
      const name = ($("#repName").value || "").trim();
      const res = await gasPost({ mode: "createDailyPdf", date, name });
      if (!res.ok) throw new Error(res.message || "失敗");
      showLink("日報PDF", res.url);
    } catch (e) {
      toast(String(e.message || e), "error");
    }
  });

  // 月報PDF
  $("#btnMonthlyPdf").addEventListener("click", async () => {
    try {
      toast("月報PDF作成中…", "info");
      const ym = ($("#repYm").value || "").trim();
      const name = ($("#repName").value || "").trim();
      const res = await gasPost({ mode: "createMonthlyPdf", ym, name });
      if (!res.ok) throw new Error(res.message || "失敗");
      showLink("月報PDF", res.url);
    } catch (e) {
      toast(String(e.message || e), "error");
    }
  });

  // 月CSV
  $("#btnMonthlyCsv").addEventListener("click", async () => {
    try {
      toast("月CSV生成中…", "info");
      const ym = ($("#repYm").value || "").trim();
      const name = ($("#repName").value || "").trim();
      const res = await gasPost({ mode: "createMonthlyCsvText", ym, name });
      if (!res.ok) throw new Error(res.message || "失敗");
      downloadText(`OFA_${ym}_tenko.csv`, res.csv || "");
      toast("CSVをダウンロードしました", "success");
    } catch (e) {
      toast(String(e.message || e), "error");
    }
  });

  $("#btnToTop").addEventListener("click", () => (location.href = "./index.html"));
}

function showLink(label, url) {
  const box = $("#repResult");
  if (!box) return;
  box.innerHTML =
    `<div class="resultBox">
      <div><b>${label}</b></div>
      <div><a target="_blank" href="${url}">${url}</a></div>
      <div class="small">※iPhoneなら「共有」→ LINE で送れます</div>
    </div>`;
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 500);
}
