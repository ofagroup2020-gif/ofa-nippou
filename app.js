/* =====================================================
   OFA 点呼・日報アプリ（GitHub Pages）
   - 出発点呼 / 帰着点呼
   - 写真アップロード（Base64）
   - GAS WebApp に保存
   - 日報 / 月報 出力
===================================================== */

/* ===== 設定 ===== */
const GAS_WEBAPP_URL =
  "https://script.google.com/macros/s/AKfycbyIDH-hK7hrDepgPMFtEfzgwXMQ6ml3fDEcQS0yxAszqdFy7Q8O-tpBQbWetbN212rfgw/exec";

/* ===== 共通 ===== */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function toast(msg) {
  alert(msg);
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

/* ===== 画面遷移 ===== */
function goDeparture() {
  location.href = "departure.html";
}
function goArrival() {
  location.href = "arrival.html";
}
function goReports() {
  location.href = "reports.html";
}

/* ===== 画像 Base64 化 ===== */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

/* ===== 点呼送信 ===== */
async function submitTenko(mode) {
  const name = $("#name")?.value || "";
  const vehicle = $("#vehicle")?.value || "";
  const memo = $("#memo")?.value || "";
  const files = $("#photo")?.files || [];

  if (!name) {
    toast("氏名を入力してください");
    return;
  }

  const photos = [];
  for (const f of files) {
    const b64 = await fileToBase64(f);
    photos.push(b64);
  }

  const payload = {
    type: "tenko",
    mode: mode,              // departure / arrival
    date: todayStr(),
    name: name,
    vehicle: vehicle,
    memo: memo,
    photos: photos,
    ua: navigator.userAgent
  };

  await postToGAS(payload);
  toast("送信しました");
  location.href = "index.html";
}

/* ===== GAS POST ===== */
async function postToGAS(data) {
  const res = await fetch(GAS_WEBAPP_URL, {
    method: "POST",
    mode: "cors",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(data)
  });

  if (!res.ok) {
    throw new Error("GAS送信エラー");
  }
  return await res.json();
}

/* ===== レポート取得 ===== */
async function loadReports() {
  const url = `${GAS_WEBAPP_URL}?type=report`;
  const res = await fetch(url);
  const json = await res.json();

  const area = $("#reportArea");
  if (!area) return;

  area.innerHTML = "";

  json.rows.forEach(r => {
    const div = document.createElement("div");
    div.className = "report-card";
    div.innerHTML = `
      <div><b>${r.date}</b> ${r.mode}</div>
      <div>${r.name} / ${r.vehicle}</div>
      <div>${r.memo || ""}</div>
    `;
    area.appendChild(div);
  });
}

/* ===== PDF / CSV ===== */
function downloadCSV() {
  window.open(`${GAS_WEBAPP_URL}?type=csv`, "_blank");
}
function downloadPDF() {
  window.open(`${GAS_WEBAPP_URL}?type=pdf`, "_blank");
}

/* ===== ページ別初期化 ===== */
document.addEventListener("DOMContentLoaded", () => {
  if ($("#reportArea")) {
    loadReports();
  }
});
