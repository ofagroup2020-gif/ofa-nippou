// ==============================
// OFA PDF Generator
// 日本語文字化け対策：HTML → canvas → jsPDF
// ==============================

// ---- 外部ライブラリ動的ロード ----
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

// ---- Utility ----
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
    fr.onload  = ()=> resolve(fr.result);
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}

// ---- PDF HTML Builder ----
function buildOfaPdfHtml({ profile, dep, arr, daily, images }){

  const headerGrad = `linear-gradient(90deg,#20d3c2,#4a90ff,#9b5cff,#ff4d8d)`;

  // 走行距離は「両方ある時だけ」
  let odoDiff = "";
  if(dep?.odoStart && arr?.odoEnd){
    const diff = safeNum(arr.odoEnd) - safeNum(dep.odoStart);
    odoDiff = diff > 0 ? `${diff} km` : "";
  }

  const imgBlock = (title, dataUrl)=>{
    if(!dataUrl) return "";
    return `
      <div style="margin-top:10px">
        <div style="font-weight:800;margin-bottom:6px">${title}</div>
        <img src="${dataUrl}"
          style="width:100%;max-height:260px;object-fit:contain;
          border:1px solid #e9eef5;border-radius:12px">
      </div>
    `;
  };

  const depRow = dep ? `
    <tr><th colspan="4" class="secHead dep">出発点呼（業務開始前）</th></tr>
    <tr><th>日時</th><td>${fmtDateTime(dep.at)}</td><th>方法</th><td>${dep.method||""}</td></tr>
    <tr><th>睡眠(h)</th><td>${dep.sleep||""}</td><th>体温(℃)</th><td>${dep.temp||""}</td></tr>
    <tr><th>体調</th><td>${dep.condition||""}</td><th>疲労</th><td>${dep.fatigue||""}</td></tr>
    <tr><th>服薬</th><td>${dep.med||""}</td><th>服薬内容</th><td>${dep.medDetail||""}</td></tr>
    <tr><th>アルコール</th><td>${dep.alcValue||""}</td><th>判定</th><td>${dep.alcJudge||""}</td></tr>
    <tr><th>出発ODO</th><td>${dep.odoStart||""}</td><th>異常</th><td>${dep.abnormal||""}</td></tr>
    <tr><th>異常内容</th><td colspan="3">${dep.abnormalDetail||""}</td></tr>
  ` : `
    <tr><th colspan="4" class="secHead dep">出発点呼</th></tr>
    <tr><td colspan="4">未入力</td></tr>
  `;

  const arrRow = arr ? `
    <tr><th colspan="4" class="secHead arr">帰着点呼（業務終了後）</th></tr>
    <tr><th>日時</th><td>${fmtDateTime(arr.at)}</td><th>方法</th><td>${arr.method||""}</td></tr>
    <tr><th>睡眠(h)</th><td>${arr.sleep||""}</td><th>体温(℃)</th><td>${arr.temp||""}</td></tr>
    <tr><th>体調</th><td>${arr.condition||""}</td><th>疲労</th><td>${arr.fatigue||""}</td></tr>
    <tr><th>服薬</th><td>${arr.med||""}</td><th>服薬内容</th><td>${arr.medDetail||""}</td></tr>
    <tr><th>アルコール</th><td>${arr.alcValue||""}</td><th>判定</th><td>${arr.alcJudge||""}</td></tr>
    <tr><th>帰着ODO</th><td>${arr.odoEnd||""}</td><th>異常</th><td>${arr.abnormal||""}</td></tr>
    <tr><th>異常内容</th><td colspan="3">${arr.abnormalDetail||""}</td></tr>
  ` : `
    <tr><th colspan="4" class="secHead arr">帰着点呼</th></tr>
    <tr><td colspan="4">未入力</td></tr>
  `;

  const dailyRow = daily ? `
    <tr><th colspan="4" class="secHead daily">日報（任意）</th></tr>
    <tr><th>稼働日</th><td>${daily.date||""}</td><th>案件</th><td>${daily.mainProject||""}</td></tr>
    <tr><th>売上合計</th><td>${daily.salesTotal||""}</td><th>差引</th><td>${daily.profit||""}</td></tr>
    <tr><th>メモ</th><td colspan="3">${daily.memo||""}</td></tr>
  ` : `
    <tr><th colspan="4" class="secHead daily">日報（任意）</th></tr>
    <tr><td colspan="4">未入力（オプション）</td></tr>
  `;

  return `
<div id="ofaPdfRoot" style="width:794px;background:#fff;
font-family:'Noto Sans JP',-apple-system,BlinkMacSystemFont,
'Hiragino Kaku Gothic ProN','Helvetica Neue',Arial,sans-serif;
color:#222;padding:18px">

  <div style="border-radius:18px;overflow:hidden;border:1px solid #e9eef5">

    <div style="padding:14px;background:${headerGrad};
    color:#fff;display:flex;justify-content:space-between">
      <div style="font-weight:900;font-size:18px">OFA GROUP</div>
      <div style="font-weight:800;font-size:13px">点呼・日報</div>
    </div>

    <div style="padding:14px">

      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <tr><th class="th">氏名</th><td>${profile.name||""}</td>
            <th class="th">拠点</th><td>${profile.base||""}</td></tr>
        <tr><th class="th">車両番号</th><td>${profile.carNo||""}</td>
            <th class="th">免許番号</th><td>${profile.licenseNo||""}</td></tr>
      </table>

      ${imgBlock("運転免許証", images.license)}

      <table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:12px">
        ${depRow}
        ${arrRow}
        <tr>
          <th class="th">走行距離</th>
          <td colspan="3">${odoDiff || "—"}</td>
        </tr>
        ${dailyRow}
      </table>

      <div style="display:flex;gap:12px;margin-top:12px">
        <div style="flex:1">${imgBlock("アルコール（出発）", images.alcDep)}</div>
        <div style="flex:1">${imgBlock("アルコール（帰着）", images.alcArr)}</div>
      </div>

      <div style="margin-top:12px;font-size:12px;color:#666">
        ※ 本PDFは端末内で生成（サーバー送信なし）
      </div>

    </div>
  </div>
</div>
`;
}

// ---- PDF生成 ----
async function generateTodayPdf({ profile, dep, arr, daily, files }){
  await ensurePdfLibs();

  const images = {
    license : await fileToDataUrl(files?.licenseImg),
    alcDep  : await fileToDataUrl(files?.alcDepImg),
    alcArr  : await fileToDataUrl(files?.alcArrImg)
  };

  const html = buildOfaPdfHtml({ profile, dep, arr, daily, images });

  const holder = document.createElement("div");
  holder.style.position = "fixed";
  holder.style.left = "-10000px";
  holder.innerHTML = html;
  document.body.appendChild(holder);

  const canvas = await html2canvas(holder.querySelector("#ofaPdfRoot"),
    { scale:2, backgroundColor:"#fff" });

  const img = canvas.toDataURL("image/png");
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF("p","pt","a4");

  const w = 595;
  const h = (canvas.height * w) / canvas.width;
  pdf.addImage(img,"PNG",0,0,w,h);

  document.body.removeChild(holder);

  const key = (daily?.date || dep?.at || "").slice(0,10) || "today";
  pdf.save(`OFA_${key}_点呼日報.pdf`);
}

// ---- expose ----
window.OFA_PDF = {
  generateTodayPdf
};
