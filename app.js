/* =========================================================
   OFA 点呼・点検（GitHub Pagesフロント）
   - 出発/帰着 点呼フォーム
   - 写真複数アップロード（圧縮→dataURL）
   - GAS WebAppに保存（google.script側）
   - 日報PDF / 月報PDF / 月CSV 出力
   - スマホ最適 / 使いやすさ重視
========================================================= */

const GAS_WEBAPP_URL =
  "https://script.google.com/macros/s/AKfycbzMON8kEVi2VJrhPGSGtnX5y0Q4yQCrOPM5afh2ph_X_M0_djtmQAmFTrhZhdp8GA69jA/exec";

// ====== 共通 ======
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
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
function fmtTime(d = new Date()) {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function savePref(key, value) {
  localStorage.setItem(key, value ?? "");
}
function loadPref(key) {
  return localStorage.getItem(key) || "";
}

// ====== 画像圧縮 → dataURL ======
async function fileToCompressedDataURL(file, maxW = 1600, quality = 0.72) {
  // 画像以外は弾く
  if (!file.type.startsWith("image/")) throw new Error("画像ファイルではありません");

  const img = document.createElement("img");
  const url = URL.createObjectURL(file);
  img.src = url;
  await img.decode();

  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const scale = Math.min(1, maxW / w);
  const nw = Math.round(w * scale);
  const nh = Math.round(h * scale);

  const canvas = document.createElement("canvas");
  canvas.width = nw;
  canvas.height = nh;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, nw, nh);

  URL.revokeObjectURL(url);

  // jpegに寄せて軽量化（pngでもOK）
  const mime = "image/jpeg";
  const dataUrl = canvas.toDataURL(mime, quality);
  return dataUrl;
}

async function collectPhotos(inputEl) {
  const files = Array.from(inputEl?.files || []);
  if (!files.length) return [];

  const out = [];
  for (const f of files) {
    const dataUrl = await fileToCompressedDataURL(f);
    out.push({
      filename: (f.name || "photo.jpg").replace(/[\\/:*?"<>|]/g, "_"),
      dataUrl,
    });
  }
  return out;
}

// ====== GAS呼び出し ======
async function postJSON(url, bodyObj) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(bodyObj),
  });
  const txt = await res.text();
  // GASはJSON返す想定
  try {
    return JSON.parse(txt);
  } catch {
    return { ok: false, message: "JSON parse failed", raw: txt };
  }
}

async function getText(url) {
  const res = await fetch(url, { method: "GET" });
  return await res.text();
}

// ====== 画面初期化 ======
function initCommon() {
  // フッター年
  const y = $("#year");
  if (y) y.textContent = new Date().getFullYear();

  // 端末により「戻る」でフォームが残るので整える
  window.addEventListener("pageshow", () => {});
}

// ====== index ======
function initIndex() {
  initCommon();

  const pingBtn = $("#btnPing");
  if (pingBtn) {
    pingBtn.addEventListener("click", async () => {
      try {
        const t = await getText(`${GAS_WEBAPP_URL}?ping=1`);
        toast(`GAS疎通OK: ${t}`, "ok");
      } catch (e) {
        toast(`疎通NG: ${String(e)}`, "ng");
      }
    });
  }
}

// ====== 出発/帰着フォーム共通 ======
function fillDefaults(form) {
  const date = form.querySelector('[name="date"]');
  const time = form.querySelector('[name="timeSelected"]');
  if (date && !date.value) date.value = fmtDate();
  if (time && !time.value) time.value = fmtTime();

  // 前回値
  const driverName = form.querySelector('[name="driverName"]');
  const vehicleNo = form.querySelector('[name="vehicleNo"]');
  const phone = form.querySelector('[name="phone"]');
  const area = form.querySelector('[name="area"]');

  if (driverName) driverName.value ||= loadPref("driverName");
  if (vehicleNo) vehicleNo.value ||= loadPref("vehicleNo");
  if (phone) phone.value ||= loadPref("phone");
  if (area) area.value ||= loadPref("area");
}

function validateForm(form) {
  const must = ["date", "timeSelected", "driverName", "vehicleNo", "alcoholValue"];
  for (const k of must) {
    const el = form.querySelector(`[name="${k}"]`);
    if (!el || !String(el.value || "").trim()) {
      el?.focus?.();
      throw new Error(`必須項目が未入力: ${k}`);
    }
  }
  const av = Number(String(form.querySelector('[name="alcoholValue"]').value).trim());
  if (!isFinite(av)) throw new Error("アルコール数値は数字で入力してください");
}

function formToObject(form) {
  const fd =
