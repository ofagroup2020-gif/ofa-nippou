// common.js
function $(id){ return document.getElementById(id); }
function val(id){ const el = $(id); return el ? (el.value ?? '') : ''; }

function showToast(toastEl, msg){
  if(!toastEl) return;
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  setTimeout(()=>toastEl.classList.remove('show'), 3000);
}

function setNow(dateId, timeId){
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');
  const hh = String(d.getHours()).padStart(2,'0');
  const mi = String(d.getMinutes()).padStart(2,'0');
  if($(dateId) && !$(dateId).value) $(dateId).value = `${yyyy}-${mm}-${dd}`;
  if($(timeId) && !$(timeId).value) $(timeId).value = `${hh}:${mi}`;
}

// ===== ログインガード =====
function guardLogin(){
  const role = sessionStorage.getItem('ofa_role');
  if(!role){
    alert('ログインが必要です（トップに戻ります）');
    location.href = './index.html';
  }
}
function guardAdmin(){
  const role = sessionStorage.getItem('ofa_role');
  if(role !== 'admin'){
    alert('管理者ログインが必要です（トップに戻ります）');
    location.href = './index.html';
  }
}

// ===== 画像を縮小してBase64（任意）=====
// - CORS回避のため、JSONではなくURLエンコードで送る
// - 重すぎ防止：最大 1280px / JPEG品質 0.75
async function fileToBase64Small(file){
  if(!file) return '';
  const dataUrl = await new Promise((resolve, reject)=>{
    const r = new FileReader();
    r.onload = ()=>resolve(String(r.result||''));
    r.onerror = reject;
    r.readAsDataURL(file);
  });

  const img = await new Promise((resolve, reject)=>{
    const i = new Image();
    i.onload = ()=>resolve(i);
    i.onerror = reject;
    i.src = dataUrl;
  });

  const max = 1280;
  let w = img.width, h = img.height;
  if(w > max || h > max){
    const r = Math.min(max/w, max/h);
    w = Math.round(w*r); h = Math.round(h*r);
  }
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  // JPEGに寄せて容量削減（pngでもdataurlは送れるが重い）
  return canvas.toDataURL('image/jpeg', 0.75);
}

// ===== 確実送信（CORSで落ちない）=====
// - mode:no-cors
// - Content-Type: application/x-www-form-urlencoded
// - 返事は読めない（opaque）→ “送信した” を成功扱い
async function postNoCors(payload){
  // GAS側で「type」を必須にしているので、ここで必ず入れる
  if(!payload || !payload.type) throw new Error('payload.type がありません（missing type対策）');

  const form = new URLSearchParams();
  Object.keys(payload).forEach(k=>{
    const v = payload[k];
    // undefined/nullは空
    form.append(k, (v === undefined || v === null) ? '' : String(v));
  });

  await fetch(GAS_WEBAPP_URL, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: form.toString()
  });
}
