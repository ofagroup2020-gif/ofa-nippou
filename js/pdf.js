// js/pdf.js
// OFA PDF生成（文字化け対策）
// 方針：HTML → html2canvas → jsPDF
// ・日本語OK
// ・ロゴ/カラー/表レイアウト
// ・出発/帰着 分離
// ・日報は任意（未入力でもOK）

// ------------------------------
// 外部ライブラリの動的ロード
// ------------------------------
async function loadScriptOnce(src){
  if(document.querySelector(`script[data-src="${src}"]`)) return;
  await new Promise((resolve, reject)=>{
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.dataset.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function ensurePdfLibs(){
  await loadScriptOnce("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js");
  await loadScriptOnce("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
}

// ------------------------------
// Utils
// ------------------------------
function fmtDateTime(v){
  if(!v) return "";
  return String(v).replace("T"," ").slice(0,16);
}
function safeNum(n){
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
}

async function fileToDataUrl(file){
  if(!file) return "";
  return new Promise((resolve, reject)=>{
    const fr = new FileReader();
    fr.onload = ()=> resolve(fr.result);
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}

// ------------------------------
// PDF用HTML生成
// ------------------------------
function buildOfaPdfHtml({profile, dep, arr, daily, odoDiff, images}){
  const headerGrad = `linear-gradient(90deg,#20d3c2,#4a90ff,#9b5cff,#ff4d8d)`;

  const imgBlock = (title, dataUrl)=>{
    if(!dataUrl) return "";
    return `
      <div style="margin-top:8px">
        <div style="font-weight:700;margin-bottom:4px">${title}</div>
        <img src="${dataUrl}" style="width:100%;max-height:260px;object-fit:contain;border:1px solid #e5eaf2;border-radius:10px">
      </div>
    `;
  };

  const checklistText = (list, ok)=>{
    if(!Array.isArray(list)) return "";
    return list.filter(x=>x.ok===ok).map(x=>x.label).join(" / ");
  };

  const depRow = dep ? `
    <tr><th colspan="4" style="background:#e9fbff">出発点呼（業務開始前）</th></tr>
    <tr><th>日時</th><td>${fmtDateTime(dep.at)}</td><th>方法</th><td>${dep.method||""}</td></tr>
    <tr><th>睡眠(h)</th><td>${dep.sleep||""}</td><th>体温</th><td>${dep.temp||""}</td></tr>
    <tr><th>体調</th><td>${dep.condition||""}</td><th>疲労</th><td>${dep.fatigue||""}</td></tr>
    <tr><th>アルコール</th><td>${dep.alcValue||""}</td><th>判定</th><td>${dep.alcJudge||""}</td></tr>
    <tr><th>出発ODO</th><td>${dep.odoStart||""}</td><th>異常</th><td>${dep.abnormal||""}</td></tr>
    <tr><th>異常内容</th><td colspan="3">${dep.abnormalDetail||""}</td></tr>
  ` : `
    <tr><th colspan="4" style="background:#e9fbff">出発点呼</th></tr>
    <tr><td colspan="4">未入力</td></tr>
  `;

  const arrRow = arr ? `
    <tr><th colspan="4" style="background:#fff2f8">帰着点呼（業務終了後）</th></tr>
    <tr><th>日時</th><td>${fmtDateTime(arr.at)}</td><th>方法</th><td>${arr.method||""}</td></tr>
    <tr><th>睡眠(h)</th><td>${arr.sleep||""}</td><th>体温</th><td>${arr.temp||""}</td></tr>
    <tr><th>体調</th><td>${arr.condition||""}</td><th>疲労</th><td>${arr.fatigue||""}</td></tr>
    <tr><th>アルコール</th><td>${arr.alcValue||""}</td><th>判定</th><td>${arr.alcJudge||""}</td></tr>
    <tr><th>帰着ODO</th><td>${arr.odoEnd||""}</td><th>異常</th><td>${arr.abnormal||""}</td></tr>
    <tr><th>異常内容</th><td colspan="3">${arr.abnormalDetail||""}</td></tr>
  ` : `
    <tr><th colspan="4" style="background:#fff2f8">帰着点呼</th></tr>
    <tr><td colspan="4">未入力</td></tr>
  `;

  const dailyRow = daily ? `
    <tr><th colspan="4" style="background:#f7fbff">日報（任意）</th></tr>
    <tr><th>稼働日</th><td>${daily.date||""}</td><th>案件</th><td>${daily.mainProject||""}</td></tr>
    <tr><th>売上</th><td>${daily.salesTotal||0}</td><th>概算利益</th><td>${daily.profit||0}</td></tr>
    <tr><th>メモ</th><td colspan="3">${daily.memo||""}</td></tr>
  ` : `
    <tr><th colspan="4" style="background:#f7fbff">日報（任意）</th></tr>
    <tr><td colspan="4">未入力</td></tr>
  `;

  return `
  <div id="ofaPdfRoot" style="width:794px;background:#fff;font-family:-apple-system,BlinkMacSystemFont,'Hiragino Kaku Gothic ProN','Noto Sans JP','Helvetica Neue',Arial,sans-serif;color:#222;padding:18px">
    <div style="border-radius:18px;overflow:hidden;border:1px solid #e5eaf2">
      <div style="padding:14px;background:${headerGrad};color:#fff;display:flex;justify-content:space-between">
        <div style="font-weight:900">OFA GROUP</div>
        <div style="font-weight:700">点呼・日報</div>
      </div>

      <div style="padding:14px">
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <tr><th style="width:25%">氏名</th><td>${profile.name||""}</td><th>拠点</th><td>${profile.base||""}</td></tr>
          <tr><th>車両</th><td>${profile.carNo||""}</td><th>免許</th><td>${profile.licenseNo||""}</td></tr>
          <tr><th>電話</th><td>${profile.phone||""}</td><th>メール</th><td>${profile.email||""}</td></tr>

          ${depRow}
          ${arrRow}

          <tr>
            <th>走行距離</th>
            <td>${odoDiff} km</td>
            <th>点検NG</th>
            <td>${checklistText(dep?.checklist || arr?.checklist, false) || "なし"}</td>
          </tr>
          <tr>
            <th>点検OK</th>
            <td colspan="3">${checklistText(dep?.checklist || arr?.checklist, true)}</td>
          </tr>

          ${dailyRow}
        </table>

        <div style="display:flex;gap:12px;margin-top:12px">
          <div style="flex:1">${imgBlock("免許証", images.licenseDataUrl)}</div>
          <div style="flex:1">${imgBlock("アルコール（出発）", images.alcDepDataUrl)}</div>
          <div style="flex:1">${imgBlock("アルコール（帰着）", images.alcArrDataUrl)}</div>
        </div>

        <div style="margin-top:12px;font-size:11px;color:#666;display:flex;justify-content:space-between">
          <div>© OFA GROUP</div>
          <div>端末内生成PDF</div>
        </div>
      </div>
    </div>
  </div>
  `;
}

// ------------------------------
// PDF出力（単日）
// ------------------------------
async function generateTodayPdf({profile, dep, arr, daily, odoDiff, files}){
  await ensurePdfLibs();

  const images = {
    licenseDataUrl: await fileToDataUrl(files.licenseImg),
    alcDepDataUrl:  await fileToDataUrl(files.alcDepImg),
    alcArrDataUrl:  await fileToDataUrl(files.alcArrImg),
  };

  const html = buildOfaPdfHtml({profile, dep, arr, daily, odoDiff, images});

  const holder = document.createElement("div");
  holder.style.position = "fixed";
  holder.style.left = "-10000px";
  holder.innerHTML = html;
  document.body.appendChild(holder);

  const canvas = await html2canvas(holder.firstElementChild, {scale:2, backgroundColor:"#fff"});
  const imgData = canvas.toDataURL("image/png");

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF("p","pt","a4");

  const w = 595;
  const h = canvas.height * (w / canvas.width);
  pdf.addImage(imgData,"PNG",0,0,w,h);

  document.body.removeChild(holder);

  const key = (daily?.date || dep?.at || arr?.at || "").slice(0,10) || "today";
  pdf.save(`OFA_${key}_点呼日報.pdf`);
}

// expose
window.generateTodayPdf = generateTodayPdf;
