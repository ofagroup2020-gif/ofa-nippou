// js/pdf.js
// PDF: OFAフォーマット（ロゴ・カラー・表） / 日本語文字化け対策：HTML→canvas→PDF

// 外部ライブラリ（index.html内でCDN読み込みしていないので、ここで動的ロード）
async function loadScriptOnce(src){
  if(document.querySelector(`script[data-src="${src}"]`)) return;
  await new Promise((resolve, reject) => {
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
  // html2canvas + jsPDF
  await loadScriptOnce("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js");
  await loadScriptOnce("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
}

function fmtDateTime(v){
  if(!v) return "";
  // "2026-01-14T15:28"
  return v.replace("T"," ").slice(0,16);
}

function safeNum(n){
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
}

function buildOfaPdfHtml({profile, dep, arr, daily, odoDiff, images}){
  // images: {licenseDataUrl?, alcDepDataUrl?, alcArrDataUrl?}
  const logoText = "OFA GROUP"; // 画像ロゴが無い場合の保険
  const headerGrad = `linear-gradient(90deg,#20d3c2,#4a90ff,#9b5cff,#ff4d8d)`;

  const depRow = dep ? `
    <tr><th colspan="4" style="background:#e9fbff">出発点呼（業務開始前）</th></tr>
    <tr>
      <th>日時</th><td>${fmtDateTime(dep.at)}</td>
      <th>方法</th><td>${dep.method||""}</td>
    </tr>
    <tr>
      <th>睡眠(h)</th><td>${dep.sleep||""}</td>
      <th>体温(℃)</th><td>${dep.temp||""}</td>
    </tr>
    <tr>
      <th>体調</th><td>${dep.condition||""}</td>
      <th>疲労</th><td>${dep.fatigue||""}</td>
    </tr>
    <tr>
      <th>服薬</th><td>${dep.med||""}</td>
      <th>服薬内容</th><td>${dep.medDetail||""}</td>
    </tr>
    <tr>
      <th>アルコール数値</th><td>${dep.alcValue||""}</td>
      <th>判定</th><td>${dep.alcJudge||""}</td>
    </tr>
    <tr>
      <th>出発ODO</th><td>${dep.odoStart||""}</td>
      <th>異常</th><td>${dep.abnormal||""}</td>
    </tr>
    <tr><th>異常内容</th><td colspan="3">${(dep.abnormalDetail||"")}</td></tr>
  ` : `<tr><th colspan="4" style="background:#e9fbff">出発点呼</th></tr><tr><td colspan="4">未入力</td></tr>`;

  const arrRow = arr ? `
    <tr><th colspan="4" style="background:#fff2f8">帰着点呼（業務終了後）</th></tr>
    <tr>
      <th>日時</th><td>${fmtDateTime(arr.at)}</td>
      <th>方法</th><td>${arr.method||""}</td>
    </tr>
    <tr>
      <th>睡眠(h)</th><td>${arr.sleep||""}</td>
      <th>体温(℃)</th><td>${arr.temp||""}</td>
    </tr>
    <tr>
      <th>体調</th><td>${arr.condition||""}</td>
      <th>疲労</th><td>${arr.fatigue||""}</td>
    </tr>
    <tr>
      <th>服薬</th><td>${arr.med||""}</td>
      <th>服薬内容</th><td>${arr.medDetail||""}</td>
    </tr>
    <tr>
      <th>アルコール数値</th><td>${arr.alcValue||""}</td>
      <th>判定</th><td>${arr.alcJudge||""}</td>
    </tr>
    <tr>
      <th>帰着ODO</th><td>${arr.odoEnd||""}</td>
      <th>異常</th><td>${arr.abnormal||""}</td>
    </tr>
    <tr><th>異常内容</th><td colspan="3">${(arr.abnormalDetail||"")}</td></tr>
  ` : `<tr><th colspan="4" style="background:#fff2f8">帰着点呼</th></tr><tr><td colspan="4">未入力</td></tr>`;

  const dailyRow = daily ? `
    <tr><th colspan="4" style="background:#f7fbff">日報（任意）</th></tr>
    <tr>
      <th>稼働日</th><td>${daily.date||""}</td>
      <th>案件（メイン）</th><td>${daily.mainProject||""}</td>
    </tr>
    <tr>
      <th>売上合計</th><td>${daily.salesTotal||0}</td>
      <th>差引（概算利益）</th><td>${daily.profit||0}</td>
    </tr>
    <tr><th>メモ</th><td colspan="3">${daily.memo||""}</td></tr>
  ` : `<tr><th colspan="4" style="background:#f7fbff">日報（任意）</th></tr><tr><td colspan="4">未入力（オプション）</td></tr>`;

  const imageBlock = (title, dataUrl) => {
    if(!dataUrl) return "";
    return `
      <div style="margin-top:10px">
        <div style="font-weight:800;margin:6px 0">${title}</div>
        <img src="${dataUrl}" style="width:100%;max-height:280px;object-fit:contain;border:1px solid #e9eef5;border-radius:12px">
      </div>
    `;
  };

  const checklist = (dep?.checklist || arr?.checklist || []);
  const checkOk = checklist.filter(x=>x.ok).map(x=>x.label);
  const checkNg = checklist.filter(x=>!x.ok).map(x=>x.label);

  return `
  <div id="ofaPdfRoot" style="width:794px;background:#fff;font-family:'Noto Sans JP',-apple-system,BlinkMacSystemFont,'Hiragino Kaku Gothic ProN','Helvetica Neue',Arial,sans-serif;color:#222;padding:18px">
    <div style="border-radius:18px;overflow:hidden;border:1px solid #e9eef5">
      <div style="padding:14px;background:${headerGrad};color:#fff;display:flex;align-items:center;justify-content:space-between">
        <div style="font-weight:900;font-size:18px">${logoText}</div>
        <div style="font-weight:800;font-size:13px">点呼・日報 PDF</div>
      </div>

      <div style="padding:14px">
        <div style="display:flex;gap:12px;align-items:flex-start">
          <div style="flex:1">
            <div style="font-weight:900;font-size:16px;margin-bottom:8px">基本情報</div>
            <table style="width:100%;border-collapse:collapse;font-size:13px">
              <tr><th style="width:24%;text-align:left;background:#f7fbff;border:1px solid #e9eef5;padding:8px">氏名</th><td style="border:1px solid #e9eef5;padding:8px">${profile.name||""}</td></tr>
              <tr><th style="text-align:left;background:#f7fbff;border:1px solid #e9eef5;padding:8px">拠点</th><td style="border:1px solid #e9eef5;padding:8px">${profile.base||""}</td></tr>
              <tr><th style="text-align:left;background:#f7fbff;border:1px solid #e9eef5;padding:8px">車両番号</th><td style="border:1px solid #e9eef5;padding:8px">${profile.carNo||""}</td></tr>
              <tr><th style="text-align:left;background:#f7fbff;border:1px solid #e9eef5;padding:8px">免許番号</th><td style="border:1px solid #e9eef5;padding:8px">${profile.licenseNo||""}</td></tr>
              <tr><th style="text-align:left;background:#f7fbff;border:1px solid #e9eef5;padding:8px">電話</th><td style="border:1px solid #e9eef5;padding:8px">${profile.phone||""}</td></tr>
              <tr><th style="text-align:left;background:#f7fbff;border:1px solid #e9eef5;padding:8px">メール</th><td style="border:1px solid #e9eef5;padding:8px">${profile.email||""}</td></tr>
            </table>
          </div>

          <div style="width:240px">
            ${imageBlock("運転免許証（PDF埋め込み）", images.licenseDataUrl)}
          </div>
        </div>

        <div style="margin-top:14px;border-top:1px solid #e9eef5;padding-top:12px">
          <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap">
            <div style="font-weight:900;font-size:16px">点呼・日報</div>
            <div style="font-size:12px;color:#555">走行距離：<span style="font-weight:900">${odoDiff} km</span>（出発ODO/帰着ODOから自動）</div>
          </div>

          <table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:10px">
            ${depRow}
            ${arrRow}
            <tr>
              <th style="background:#f0fbff;border:1px solid #e9eef5;padding:8px">走行距離（ODO差分）</th>
              <td style="border:1px solid #e9eef5;padding:8px">${odoDiff} km</td>
              <th style="background:#f0fbff;border:1px solid #e9eef5;padding:8px">日常点検NG</th>
              <td style="border:1px solid #e9eef5;padding:8px">${checkNg.join(" / ") || "なし"}</td>
            </tr>
            <tr>
              <th style="background:#f0fbff;border:1px solid #e9eef5;padding:8px">日常点検OK</th>
              <td colspan="3" style="border:1px solid #e9eef5;padding:8px">${checkOk.join(" / ") || ""}</td>
            </tr>
            <tr>
              <th style="background:#f0fbff;border:1px solid #e9eef5;padding:8px">日常点検メモ</th>
              <td colspan="3" style="border:1px solid #e9eef5;padding:8px">${(dep?.checkMemo || arr?.checkMemo || "")}</td>
            </tr>
            ${dailyRow}
          </table>

          <div style="display:flex;gap:12px;margin-top:12px">
            <div style="flex:1">${imageBlock("アルコール写真（出発）", images.alcDepDataUrl)}</div>
            <div style="flex:1">${imageBlock("アルコール写真（帰着）", images.alcArrDataUrl)}</div>
          </div>
        </div>

        <div style="margin-top:14px;border-top:1px solid #e9eef5;padding-top:10px;font-size:12px;color:#666;display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap">
          <div>© OFA GROUP</div>
          <div>※本PDFは端末内で生成（アップロードなし）</div>
        </div>
      </div>
    </div>
  </div>
  `;
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

async function makePdfFromHtml(html, filename){
  await ensurePdfLibs();
  const holder = document.createElement("div");
  holder.style.position = "fixed";
  holder.style.left = "-10000px";
  holder.style.top = "0";
  holder.innerHTML = html;
  document.body.appendChild(holder);

  const root = holder.querySelector("#ofaPdfRoot");

  const canvas = await html2canvas(root, { scale:2, backgroundColor:"#ffffff" });
  const imgData = canvas.toDataURL("image/png");

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF("p", "pt", "a4"); // 595x842pt
  const pageW = 595;
  const pageH = 842;

  // fit
  const imgW = pageW;
  const imgH = (canvas.height * imgW) / canvas.width;

  let y = 0;
  let remain = imgH;

  // 1ページで収まる想定（ほぼ収まるレイアウト）
  // もし長くなれば分割
  if(imgH <= pageH){
    pdf.addImage(imgData, "PNG", 0, 0, imgW, imgH);
  }else{
    // multi-page split
    let position = 0;
    while(remain > 0){
      pdf.addImage(imgData, "PNG", 0, position, imgW, imgH);
      remain -= pageH;
      position -= pageH;
      if(remain > 0) pdf.addPage();
    }
  }

  document.body.removeChild(holder);
  pdf.save(filename);
}

// Public API
async function generateTodayPdf({ profile, dep, arr, daily, odoDiff, files }){
  const images = {
    licenseDataUrl: await fileToDataUrl(files.licenseImg),
    alcDepDataUrl: await fileToDataUrl(files.alcDepImg),
    alcArrDataUrl: await fileToDataUrl(files.alcArrImg),
  };
  const html = buildOfaPdfHtml({ profile, dep, arr, daily, odoDiff, images });
  const dateKey = (daily?.date || dep?.at || arr?.at || "").toString().slice(0,10) || "today";
  await makePdfFromHtml(html, `OFA_${dateKey}_点呼日報.pdf`);
}

async function generateMonthlyPdf(groups, filters){
  // 管理者用：グループごとに1つのPDFにまとめる（ページ分割）
  await ensurePdfLibs();
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF("p", "pt", "a4");

  let first = true;
  for(const g of groups){
    if(!first) pdf.addPage();
    first = false;

    const holder = document.createElement("div");
    holder.style.position = "fixed";
    holder.style.left = "-10000px";
    holder.style.top = "0";

    // monthly summary calc
    const days = new Set();
    let totalKm = 0;
    g.tenko.forEach(t=>{
      const d = (t.at||"").slice(0,10);
      if(d) days.add(d);
    });

    // km by pairing dep+arr per date
    const byDate = new Map();
    g.tenko.forEach(t=>{
      const d = (t.at||"").slice(0,10);
      if(!byDate.has(d)) byDate.set(d,{dep:null,arr:null});
      if(t.type==="departure") byDate.get(d).dep = t;
      if(t.type==="arrival")   byDate.get(d).arr = t;
    });
    for(const [d,pair] of byDate){
      const dep = pair.dep?.odoStart;
      const arr = pair.arr?.odoEnd;
      const diff = safeNum(arr) - safeNum(dep);
      if(diff>0) totalKm += diff;
    }

    const headerGrad = `linear-gradient(90deg,#20d3c2,#4a90ff,#9b5cff,#ff4d8d)`;

    const html = `
      <div id="ofaPdfRoot" style="width:794px;background:#fff;font-family:'Noto Sans JP',-apple-system,BlinkMacSystemFont,'Hiragino Kaku Gothic ProN','Helvetica Neue',Arial,sans-serif;color:#222;padding:18px">
        <div style="border-radius:18px;overflow:hidden;border:1px solid #e9eef5">
          <div style="padding:14px;background:${headerGrad};color:#fff;display:flex;align-items:center;justify-content:space-between">
            <div style="font-weight:900;font-size:18px">OFA GROUP</div>
            <div style="font-weight:800;font-size:13px">月報（管理者）</div>
          </div>
          <div style="padding:14px">
            <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap">
              <div style="font-weight:900;font-size:16px">${g.name} / ${g.base}</div>
              <div style="font-size:12px;color:#555">期間：${filters.from||""} ～ ${filters.to||""}</div>
            </div>

            <div style="margin-top:10px;border:1px solid #e9eef5;border-radius:14px;padding:12px;background:#f7fbff">
              <div style="display:flex;gap:14px;flex-wrap:wrap;font-size:13px">
                <div><b>稼働日数</b>：${days.size} 日</div>
                <div><b>走行距離合計</b>：${totalKm} km</div>
                <div><b>点呼件数</b>：${g.tenko.length}</div>
                <div><b>日報件数</b>：${g.daily.length}</div>
              </div>
            </div>

            <div style="margin-top:12px;font-weight:900">点呼一覧</div>
            <table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:8px">
              <tr>
                <th style="background:#f0fbff;border:1px solid #e9eef5;padding:8px">日付</th>
                <th style="background:#f0fbff;border:1px solid #e9eef5;padding:8px">区分</th>
                <th style="background:#f0fbff;border:1px solid #e9eef5;padding:8px">時刻</th>
                <th style="background:#f0fbff;border:1px solid #e9eef5;padding:8px">アルコール</th>
                <th style="background:#f0fbff;border:1px solid #e9eef5;padding:8px">ODO</th>
                <th style="background:#f0fbff;border:1px solid #e9eef5;padding:8px">異常</th>
              </tr>
              ${g.tenko.map(t=>`
                <tr>
                  <td style="border:1px solid #e9eef5;padding:8px">${(t.at||"").slice(0,10)}</td>
                  <td style="border:1px solid #e9eef5;padding:8px">${t.type==="departure"?"出発":"帰着"}</td>
                  <td style="border:1px solid #e9eef5;padding:8px">${(t.at||"").slice(11,16)}</td>
                  <td style="border:1px solid #e9eef5;padding:8px">${t.alcValue||""}</td>
                  <td style="border:1px solid #e9eef5;padding:8px">${t.type==="departure"?(t.odoStart||""):(t.odoEnd||"")}</td>
                  <td style="border:1px solid #e9eef5;padding:8px">${t.abnormal||""}</td>
                </tr>
              `).join("")}
            </table>

            <div style="margin-top:14px;border-top:1px solid #e9eef5;padding-top:10px;font-size:12px;color:#666;display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap">
              <div>© OFA GROUP</div>
              <div>※端末内データから月報生成</div>
            </div>
          </div>
        </div>
      </div>
    `;

    holder.innerHTML = html;
    document.body.appendChild(holder);
    const root = holder.querySelector("#ofaPdfRoot");
    const canvas = await html2canvas(root, { scale:2, backgroundColor:"#ffffff" });
    const imgData = canvas.toDataURL("image/png");

    const pageW = 595, pageH = 842;
    const imgW = pageW;
    const imgH = (canvas.height * imgW) / canvas.width;

    if(imgH <= pageH){
      pdf.addImage(imgData, "PNG", 0, 0, imgW, imgH);
    }else{
      // split
      let remain = imgH;
      let pos = 0;
      while(remain > 0){
        pdf.addImage(imgData, "PNG", 0, pos, imgW, imgH);
        remain -= pageH;
        pos -= pageH;
        if(remain > 0) pdf.addPage();
      }
    }
    document.body.removeChild(holder);
  }

  pdf.save(`OFA_月報_${filters.from||""}_${filters.to||""}.pdf`);
}
