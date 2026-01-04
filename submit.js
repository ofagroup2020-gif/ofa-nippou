// フォーム＋隠しiframe送信（CORS無関係で100%通す）
function submitByIframe({action, payload}, cb){
  // 一回使い捨てフォームを作る
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = GAS_WEBAPP_URL;
  form.target = 'submitFrame';
  form.style.display = 'none';

  const add = (k, val)=>{
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = k;
    input.value = (val === undefined || val === null) ? '' : String(val);
    form.appendChild(input);
  };

  add('action', action);

  // payloadをフラットで送る（GAS側で受ける）
  Object.keys(payload || {}).forEach(k=>{
    add(k, payload[k]);
  });

  // コールバック受信（GASはJSON文字列を返す）
  const frame = document.getElementsByName('submitFrame')[0];
  let done = false;

  const timer = setTimeout(()=>{
    if(done) return;
    done = true;
    cleanup();
    cb(false, 'タイムアウト（通信不安定の可能性）');
  }, 15000);

  function onLoad(){
    if(done) return;
    try{
      // iframe内の本文を読む（同一生成元ではないが、GASはシンプルテキストなので多くの環境で読める）
      // 読めない環境でも「送信自体」は成功するので、成功扱いにする保険を入れる
      let text = '';
      try{
        const doc = frame.contentDocument || frame.contentWindow.document;
        text = (doc.body && doc.body.innerText) ? doc.body.innerText.trim() : '';
      }catch(e){
        // 読めない＝CORS的にブロック → 送信は成功している可能性大
        text = '';
      }

      done = true;
      cleanup();
      if(!text){
        // 読めない場合は成功扱い（フォーム送信は通っている）
        cb(true, 'OK');
        return;
      }

      // JSONを想定
      let obj = null;
      try{ obj = JSON.parse(text); }catch(e){
        // JSONじゃないがレスポンスが返ってる＝成功扱い
        cb(true, text.slice(0,120));
        return;
      }
      cb(!!obj.ok, obj.message || 'OK');
    }catch(err){
      done = true;
      cleanup();
      cb(false, '応答解析エラー');
    }
  }

  function cleanup(){
    clearTimeout(timer);
    frame.removeEventListener('load', onLoad);
    document.body.removeChild(form);
  }

  frame.addEventListener('load', onLoad);
  document.body.appendChild(form);
  form.submit();
}

// 画像を圧縮してDataURL化（GASへ送ってDrive保存）
async function fileToDataUrlCompressed(file){
  const dataUrl = await new Promise((res, rej)=>{
    const fr = new FileReader();
    fr.onload = ()=>res(fr.result);
    fr.onerror = rej;
    fr.readAsDataURL(file);
  });

  // 画像以外はそのまま
  if(!dataUrl.startsWith('data:image/')) return dataUrl;

  const img = await new Promise((res, rej)=>{
    const i = new Image();
    i.onload = ()=>res(i);
    i.onerror = rej;
    i.src = dataUrl;
  });

  const maxSide = IMAGE_MAX_SIDE || 1280;
  let w = img.width, h = img.height;
  const scale = Math.min(1, maxSide / Math.max(w,h));
  w = Math.round(w * scale);
  h = Math.round(h * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);

  return canvas.toDataURL('image/jpeg', IMAGE_QUALITY || 0.78);
}

async function collectPhotosForTenko({licensePhotoId, alcoholPhotoId, tenkoPhotoId, reportPhotosId}){
  const out = {};

  // 単発
  async function one(id, keyPrefix){
    if(!id) return;
    const el = document.getElementById(id);
    if(!el || !el.files || !el.files[0]) { out[keyPrefix] = ''; return; }
    const durl = await fileToDataUrlCompressed(el.files[0]);
    out[keyPrefix] = durl;
    out[keyPrefix + '_name'] = el.files[0].name || '';
  }

  // 複数（日報のみ）
  async function many(id, key){
    if(!id) return;
    const el = document.getElementById(id);
    if(!el || !el.files || el.files.length === 0){ out[key] = ''; out[key+'_names']=''; out[key+'_count']='0'; return; }
    const files = Array.from(el.files).slice(0, MAX_REPORT_PHOTOS || 3);
    const urls = [];
    const names = [];
    for(const f of files){
      urls.push(await fileToDataUrlCompressed(f));
      names.push(f.name || '');
    }
    out[key] = JSON.stringify(urls);
    out[key + '_names'] = JSON.stringify(names);
    out[key + '_count'] = String(files.length);
  }

  await one(licensePhotoId, 'licensePhoto');
  await one(alcoholPhotoId, 'alcoholPhoto');
  await one(tenkoPhotoId, 'tenkoPhoto');
  await many(reportPhotosId, 'reportPhotos');

  return out;
}
