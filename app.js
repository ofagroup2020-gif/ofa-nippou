/* =========================================================
  OFA 点呼・点検（GitHub Pages front）
  確実動作版 / GAS doPost 連携
========================================================= */

/* ★ あなたの GAS WebApp URL をここに埋め込み済み */
const GAS_WEBAPP_URL =
  "https://script.google.com/macros/s/AKfycbyTwsUHSuJ_CPGqI5dEdp6JHGnMKYllnEqZINg4ZfsR40RoJyoaGe1yeNmtncpxTf4F5w/exec";

/* ---------------- 基本ユーティリティ ---------------- */
const $ = (sel, root = document) => root.querySelector(sel);

function toast(msg) {
  alert(msg); // 確実に表示される
}

function nowISO() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(
    d.getHours()
  )}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/* ---------------- 画像処理 ---------------- */
function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

async function collectImages(input) {
  const files = Array.from(input?.files || []);
  const out = [];
  for (const f of files) {
    if (!f.type.startsWith("image/")) continue;
    const dataUrl = await fileToDataURL(f);
    out.push({
      name: f.name,
      dataUrl: dataUrl,
    });
    if (out.length >= 5) break; // 重くしない
  }
  return out;
}

/* ---------------- 送信処理 ---------------- */
async function submitTenko(mode) {
  try {
    const form = document.getElementById("tenkoForm");
    if (!form) throw "フォームが見つかりません";

    const data = {
      date: form.date.value,
      time: form.time.value,
      driverName: form.driverName.value,
      vehicleNo: form.vehicleNo.value,
      managerName: form.managerName.value,
      method: form.method.value,
      place: form.place.value,
      alcoholValue: form.alcoholValue.value,
      alcoholBand: form.alcoholBand.value,
      memo: form.memo.value,

      /* 日報（帰着） */
      workType: form.workType?.value || "",
      area: form.area?.value || "",
      workHours: form.workHours?.value || "",
      delivered: form.delivered?.value || "",
      dailyNote: form.dailyNote?.value || "",
      operationStatus: form.operationStatus?.value || "",
      handover: form.handover?.value || "",
    };

    /* 必須チェック */
    if (!data.date || !data.time || !data.driverName || !data.vehicleNo) {
      throw "必須項目が未入力です";
    }

    const photos = await collectImages(
      document.getElementById("photos")
    );
    const reportPhotos = await collectImages(
      document.getElementById("reportPhotos")
    );

    const payload = {
      app: "OFA_TENKO",
      ts: nowISO(),
      mode: mode, // departure / arrival
      data: data,
      photos: photos,
      reportPhotos: reportPhotos,
    };

    const res = await fetch(GAS_WEBAPP_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });

    const json = await res.json();
    if (!json.ok) throw json.message || "保存に失敗しました";

    toast("保存しました");
    location.href = "./index.html";
  } catch (e) {
    console.error(e);
    toast(e);
  }
}

/* ---------------- ページ起動確認 ---------------- */
window.addEventListener("DOMContentLoaded", () => {
  fetch(GAS_WEBAPP_URL + "?ping=1")
    .then(() => console.log("GAS OK"))
    .catch(() => console.warn("GAS unreachable"));
});
