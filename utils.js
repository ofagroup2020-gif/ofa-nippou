// utils.js
window.$ = (sel, root = document) => root.querySelector(sel);

window.toast = function (msg, type = "info") {
  let el = $("#toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    document.body.appendChild(el);
  }
  el.className = `toast ${type}`;
  el.textContent = msg;
  el.style.display = "block";
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => (el.style.display = "none"), 2600);
};

window.todayISO = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
};

window.nowTime = () => {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
};

window.ymFromISO = (isoDate) => {
  // 2026-01-05 -> 2026-01
  return (isoDate || "").slice(0, 7);
};

window.safeVal = (v) => (v == null ? "" : String(v).trim());

async function fileToDataURL(file, maxW, quality) {
  const dataURL = await new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result);
    fr.onerror = rej;
    fr.readAsDataURL(file);
  });

  // 画像以外はそのまま
  if (!file.type.startsWith("image/")) return dataURL;

  const img = await new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = dataURL;
  });

  const w = img.width;
  const h = img.height;
  const scale = Math.min(1, maxW / w);
  const cw = Math.round(w * scale);
  const ch = Math.round(h * scale);

  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, cw, ch);

  return canvas.toDataURL("image/jpeg", quality);
}

window.pickFilesAsDataURLs = async function (inputEl) {
  const files = inputEl?.files ? Array.from(inputEl.files) : [];
  const maxW = window.OFA_CONFIG.IMAGE_MAX_W;
  const q = window.OFA_CONFIG.IMAGE_JPEG_QUALITY;

  const out = [];
  for (const f of files) {
    const url = await fileToDataURL(f, maxW, q);
    out.push({
      name: f.name,
      type: "image/jpeg",
      dataUrl: url,
    });
  }
  return out;
};
