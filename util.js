window.toast = function(msg){
  const t = document.getElementById("toast");
  if(!t) return alert(msg);
  t.textContent = msg;
  t.style.display = "block";
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(()=>{ t.style.display="none"; }, 2600);
};

window.fillNow = function(dateEl, timeEl){
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  const hh = String(d.getHours()).padStart(2,"0");
  const mi = String(d.getMinutes()).padStart(2,"0");
  if(dateEl && !dateEl.value) dateEl.value = `${yyyy}-${mm}-${dd}`;
  if(timeEl && !timeEl.value) timeEl.value = `${hh}:${mi}`;
};

// 画像を軽量化してbase64（任意項目：失敗しても送信は続行できるように）
window.fileToBase64Jpeg = async function(file, maxW=1280, quality=0.75){
  const img = document.createElement("img");
  const url = URL.createObjectURL(file);
  img.src = url;
  await new Promise((res,rej)=>{ img.onload=res; img.onerror=rej; });

  const w = img.naturalWidth, h = img.naturalHeight;
  const scale = Math.min(1, maxW / w);
  const cw = Math.round(w*scale), ch = Math.round(h*scale);

  const canvas = document.createElement("canvas");
  canvas.width = cw; canvas.height = ch;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, cw, ch);

  URL.revokeObjectURL(url);
  const dataUrl = canvas.toDataURL("image/jpeg", quality);
  return dataUrl.split(",")[1]; // base64部分
};
