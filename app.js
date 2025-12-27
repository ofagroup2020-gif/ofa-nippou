/* OFA 点呼・点検（フル版） */

const $ = (id) => document.getElementById(id);

const apiUrlEl = $('apiUrl');
const btnTest = $('btnTest');
const statusDot = $('statusDot');
const statusMain = $('statusMain');
const statusSub = $('statusSub');

const modeStartBtn = $('modeStart');
const modeEndBtn = $('modeEnd');

const btnSubmit = $('btnSubmit');
const toast = $('toast');

const btnDailyPdf = $('btnDailyPdf');
const btnMonthlyPdf = $('btnMonthlyPdf');
const dailyDate = $('dailyDate');
const monthlyYm = $('monthlyYm');

let mode = 'start'; // start/end

// 初期値（保存復元）
(function init() {
  apiUrlEl.value = localStorage.getItem('ofa_api_url') || '';
  $('driver').value = localStorage.getItem('ofa_driver') || '';
  $('vehicleNo').value = localStorage.getItem('ofa_vehicleNo') || '';
  $('phone').value = localStorage.getItem('ofa_phone') || '';

  const now = new Date();
  dailyDate.value = toISODate(now);
  monthlyYm.value = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;

  setMode('start');
})();

apiUrlEl.addEventListener('change', () => {
  localStorage.setItem('ofa_api_url', apiUrlEl.value.trim());
});

['driver','vehicleNo','phone'].forEach(id=>{
  $(id).addEventListener('change', ()=>{
    localStorage.setItem('ofa_'+id, $(id).value.trim());
  });
});

modeStartBtn.addEventListener('click', ()=>setMode('start'));
modeEndBtn.addEventListener('click', ()=>setMode('end'));

function setMode(m){
  mode = m;
  modeStartBtn.classList.toggle('active', mode==='start');
  modeEndBtn.classList.toggle('active', mode==='end');

  // 出発/帰着で入力必須にしたい項目（必要なら調整）
  $('meterStartWrap').style.display = (mode==='start') ? 'block' : 'none';
  $('meterEndWrap').style.display   = (mode==='end') ? 'block' : 'none';
}

btnTest.addEventListener('click', async ()=>{
  const api = apiUrlEl.value.trim();
  if(!api){ return setToast('API URL を入れてください', 'ng'); }
  localStorage.setItem('ofa_api_url', api);

  setStatus('gray','接続中…','pingを送っています');

  try{
    const res = await fetch(`${api}?ping=1`, { method:'GET' });
    const json = await res.json();
    if(json && json.ok){
      setStatus('green','接続OK','送信テストOKです');
      setToast('接続できました。', 'ok');
    }else{
      setStatus('red','接続NG','URL/デプロイ設定を確認');
      setToast('接続できませんでした（URL/デプロイ）', 'ng');
    }
  }catch(e){
    setStatus('red','接続NG','通信に失敗（URL/デプロイ設定を確認）');
    setToast('接続できません（通信エラー）', 'ng');
  }
});

btnDailyPdf.addEventListener('click', async ()=>{
  const api = apiUrlEl.value.trim();
  if(!api) return setToast('API URL が未設定です', 'ng');

  const date = dailyDate.value;
  const driver = $('driver').value.trim();
  if(!date) return setToast('日付を選んでください', 'ng');

  try{
    setToast('日報PDFを生成中…', '');
    const url = `${api}?action=dailyPdf&date=${encodeURIComponent(date)}&driver=${encodeURIComponent(driver)}`;
    const res = await fetch(url);
    const json = await res.json();
    if(json.ok && json.pdfUrl){
      window.open(json.pdfUrl, '_blank');
      setToast('日報PDFを開きました', 'ok');
    }else{
      setToast('PDF生成に失敗しました', 'ng');
    }
  }catch(e){
    setToast('PDF生成に失敗（通信）', 'ng');
  }
});

btnMonthlyPdf.addEventListener('click', async ()=>{
  const api = apiUrlEl.value.trim();
  if(!api) return setToast('API URL が未設定です', 'ng');

  const ym = monthlyYm.value;
  const driver = $('driver').value.trim();

  if(!ym) return setToast('年月を選んでください', 'ng');

  try{
    setToast('月報PDFを生成中…', '');
    const url = `${api}?action=monthlyPdf&ym=${encodeURIComponent(ym)}&driver=${encodeURIComponent(driver)}`;
    const res = await fetch(url);
    const json = await res.json();
    if(json.ok && json.pdfUrl){
      window.open(json.pdfUrl, '_blank');
      setToast('月報PDFを開きました', 'ok');
    }else{
      setToast('PDF生成に失敗しました', 'ng');
    }
  }catch(e){
    setToast('PDF生成に失敗（通信）', 'ng');
  }
});

btnSubmit.addEventListener('click', async ()=>{
  const api = apiUrlEl.value.trim();
  if(!api){ return setToast('API URL を入れてください', 'ng'); }

  // 必須
  const driver = $('driver').value.trim();
  const vehicleNo = $('vehicleNo').value.trim();
  if(!driver) return setToast('氏名は必須です', 'ng');
  if(!vehicleNo) return setToast('車両番号は必須です', 'ng');

  // 送信データ（フル）
  const payload = {
    mode,
    tenkoType: (mode==='start') ? '出発' : '帰着',
    date: toISODate(new Date()),
    time: toTime(new Date()),
    datetime: new Date().toISOString(),

    driver,
    vehicleNo,
    phone: $('phone').value.trim(),
    area: $('area').value.trim(),
    route: $('route').value.trim(),

    alcoholResult: $('alcoholResult').value,
    alcoholValue: $('alcoholValue').value.trim(),
    temperature: $('temperature').value.trim(),
    sleepHours: $('sleepHours').value.trim(),
    condition: $('condition').value,
    fatigueLevel: $('fatigueLevel').value,
    medication: $('medication').value,
    notesHealth: $('notesHealth').value.trim(),

    inspectionResult: $('inspectionResult').value,
    inspectionDetail: $('inspectionDetail').value.trim(),

    meterStart: $('meterStart').value.trim(),
    meterEnd: $('meterEnd').value.trim(),

    checks: {
      tires: $('c_tires').checked,
      lights: $('c_lights').checked,
      brake: $('c_brake').checked,
      wiper: $('c_wiper').checked,
      oil: $('c_oil').checked,
      coolant: $('c_coolant').checked,
      fuel: $('c_fuel').checked,
      battery: $('c_battery').checked,
      damage: $('c_damage').checked,
      loadSecure: $('c_loadSecure').checked,
      other: $('c_other').checked,
    },

    memo: $('memo').value.trim(),
    photos: {}
  };

  // モード別で「最低限」チェック（好みで変えられる）
  if(mode==='start' && payload.meterStart === ''){
    // 出発は任意にしてもいいが、運用で必須ならここを必須に
  }
  if(mode==='end' && payload.meterEnd === ''){
    // 帰着メーター必須運用なら必須に
    // return setToast('帰着メーターは必須です', 'ng');
  }

  try{
    setToast('画像を準備中…', '');
    // 画像（圧縮してdataURL化）
    const exterior = await fileToDataUrlSafe($('photoExterior').files[0]);
    const alcohol  = await fileToDataUrlSafe($('photoAlcohol').files[0]);
    const meter    = await fileToDataUrlSafe($('photoMeter').files[0]);
    const other    = await fileToDataUrlSafe($('photoOther').files[0]);

    if(exterior) payload.photos.exterior = exterior;
    if(alcohol)  payload.photos.alcohol  = alcohol;
    if(meter)    payload.photos.meter    = meter;
    if(other)    payload.photos.other    = other;

    setToast('送信中…', '');
    setStatus('gray','送信中…','ログに書き込みしています');

    const res = await fetch(api, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    });

    const json = await res.json();
    if(json && json.ok){
      setStatus('green','送信OK','記録しました');
      setToast('✅ 送信しました', 'ok');
      // 入力を少し残したいならここは消さない
    }else{
      setStatus('red','送信NG','GAS側のエラー/権限を確認');
      setToast(`送信に失敗：${json && json.error ? json.error : 'unknown'}`, 'ng');
    }
  }catch(e){
    setStatus('red','送信NG','通信/画像変換エラー');
    setToast(`送信に失敗（通信/画像変換）：${String(e)}`, 'ng');
  }
});

/* ===== utilities ===== */

function setStatus(color, main, sub){
  statusDot.classList.remove('gray','green','red');
  statusDot.classList.add(color);
  statusMain.textContent = main;
  statusSub.textContent = sub;
}

function setToast(msg, type){
  toast.textContent = msg || '';
  toast.classList.remove('ok','ng');
  if(type==='ok') toast.classList.add('ok');
  if(type==='ng') toast.classList.add('ng');
}

function toISODate(d){
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}

function toTime(d){
  const hh = String(d.getHours()).padStart(2,'0');
  const mm = String(d.getMinutes()).padStart(2,'0');
  const ss = String(d.getSeconds()).padStart(2,'0');
  return `${hh}:${mm}:${ss}`;
}

/**
 * iPhoneのHEICが混じるとCanvas変換で落ちることがあるので、
 *  - heic/heif は弾いてメッセージ（JPEGで選んで）
 *  - それ以外は最大1280px、JPEG 0.78で圧縮
 */
async function fileToDataUrlSafe(file){
  if(!file) return '';

  const name = (file.name || '').toLowerCase();
  const type = (file.type || '').toLowerCase();

  if(type.includes('heic') || type.includes('heif') || name.endsWith('.heic') || name.endsWith('.heif')){
    // ここは“確実に”案内を出す
    setToast('HEIC画像は変換に失敗する場合があります。写真を「JPEG」で選択してください。', 'ng');
    return '';
  }

  // 読み込み
  const dataUrl = await readAsDataURL(file);

  // 画像なら圧縮、非画像なら無視
  if(!dataUrl.startsWith('data:image/')) return '';

  // 圧縮
  const compressed = await compressImageDataUrl(dataUrl, 1280, 0.78);
  return compressed;
}

function readAsDataURL(file){
  return new Promise((resolve, reject)=>{
    const fr = new FileReader();
    fr.onload = ()=> resolve(fr.result);
    fr.onerror = ()=> reject(fr.error || new Error('FileReader error'));
    fr.readAsDataURL(file);
  });
}

function compressImageDataUrl(dataUrl, maxSize, quality){
  return new Promise((resolve, reject)=>{
    const img = new Image();
    img.onload = ()=>{
      try{
        let w = img.width;
        let h = img.height;

        if(w > h && w > maxSize){
          h = Math.round(h * (maxSize / w));
          w = maxSize;
        } else if(h >= w && h > maxSize){
          w = Math.round(w * (maxSize / h));
          h = maxSize;
        }

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);

        // JPEGで統一（容量削減）
        const out = canvas.toDataURL('image/jpeg', quality);
        resolve(out);
      }catch(e){
        reject(e);
      }
    };
    img.onerror = ()=> reject(new Error('Image decode error'));
    img.src = dataUrl;
  });
}
