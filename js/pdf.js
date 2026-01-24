// js/pdf.js
// OFA PDF生成（文字化け対策）
// 方針：HTML → html2canvas → jsPDF
// ・日本語OK
// ・ロゴ/カラー/表レイアウト
// ・出発/帰着 分離
// ・日報は任意（未入力でもOK）
// ・月報（検索結果）対応（複数ページ）

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

function esc(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function ymdFromAny(v){
  if(!v) return "";
  // "2026-01-24T03:25" / "2026-01-24"
  return String(v).slice(0,10);
}

function byAtAsc(a,b){
  const da = new Date(a?.at || a?.date || 0).getTime();
  const db = new Date(b?.at || b?.date || 0).getTime();
  return da - db;
}

// ------------------------------
// PDF用HTML生成（単日）
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
    <tr><th>日時</th><td>${fmtDateTime(dep.at)}</td><th>方法</th><td>${esc(dep.method||"")}</td></tr>
    <tr><th>睡眠(h)</th><td>${esc(dep.sleep||"")}</td><th>体温</th><td>${esc(dep.temp||"")}</td></tr>
    <tr><th>体調</th><td>${esc(dep.condition||"")}</td><th>疲労</th><td>${esc(dep.fatigue||"")}</td></tr>
    <tr><th>アルコール</th><td>${esc(dep.alcValue||"")}</td><th>判定</th><td>${esc(dep.alcJudge||"")}</td></tr>
    <tr><th>出発ODO</th><td>${esc(dep.odoStart||"")}</td><th>異常</th><td>${esc(dep.abnormal||"")}</td></tr>
    <tr><th>異常内容</th><td colspan="3">${esc(dep.abnormalDetail||"")}</td></tr>
  ` : `
    <tr><th colspan="4" style="background:#e9fbff">出発点呼</th></tr>
    <tr><td colspan="4">未入力</td></tr>
  `;

  const arrRow = arr ? `
    <tr><th colspan="4" style="background:#fff2f8">帰着点呼（業務終了後）</th></tr>
    <tr><th>日時</th><td>${fmtDateTime(arr.at)}</td><th>方法</th><td>${esc(arr.method||"")}</td></tr>
    <tr><th>休憩(分)</th><td>${esc(arr.breakMin||"")}</td><th>体温</th><td>${esc(arr.temp||"")}</td></tr>
    <tr><th>体調</th><td>${esc(arr.condition||"")}</td><th>疲労</th><td>${esc(arr.fatigue||"")}</td></tr>
    <tr><th>アルコール</th><td>${esc(arr.alcValue||"")}</td><th>判定</th><td>${esc(arr.alcJudge||"")}</td></tr>
    <tr><th>帰着ODO</th><td>${esc(arr.odoEnd||"")}</td><th>異常</th><td>${esc(arr.abnormal||"")}</td></tr>
    <tr><th>異常内容</th><td colspan="3">${esc(arr.abnormalDetail||"")}</td></tr>
  ` : `
    <tr><th colspan="4" style="background:#fff2f8">帰着点呼</th></tr>
    <tr><td colspan="4">未入力</td></tr>
  `;

  const dailyRow = daily ? `
    <tr><th colspan="4" style="background:#f7fbff">日報（任意）</th></tr>
    <tr><th>稼働日</th><td>${esc(daily.date||"")}</td><th>案件</th><td>${esc(daily.mainProject||"")}</td></tr>
    <tr><th>売上</th><td>${esc(daily.salesTotal||0)}</td><th>概算利益</th><td>${esc(daily.profit||0)}</td></tr>
    <tr><th>メモ</th><td colspan="3">${esc(daily.memo||"")}</td></tr>
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
          <tr><th style="width:25%">氏名</th><td>${esc(profile.name||"")}</td><th>拠点</th><td>${esc(profile.base||"")}</td></tr>
          <tr><th>車両</th><td>${esc(profile.carNo||"")}</td><th>免許</th><td>${esc(profile.licenseNo||"")}</td></tr>
          <tr><th>電話</th><td>${esc(profile.phone||"")}</td><th>メール</th><td>${esc(profile.email||"")}</td></tr>

          ${depRow}
          ${arrRow}

          <tr>
            <th>走行距離</th>
            <td>${esc(odoDiff)} km</td>
            <th>点検NG</th>
            <td>${esc(checklistText(dep?.checklist || arr?.checklist, false) || "なし")}</td>
          </tr>
          <tr>
            <th>点検OK</th>
            <td colspan="3">${esc(checklistText(dep?.checklist || arr?.checklist, true))}</td>
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

  const pageW = 595; // A4 pt
  const pageH = 842;
  const imgH = canvas.height * (pageW / canvas.width);

  // 1ページで足りない場合にも一応対応
  let y = 0;
  let remaining = imgH;
  while(remaining > 0){
    pdf.addImage(imgData, "PNG", 0, y, pageW, imgH);
    remaining -= pageH;
    if(remaining > 0){
      pdf.addPage();
      y -= pageH; // 上にずらして描画（見えてる範囲が次ページになる）
    }
  }

  document.body.removeChild(holder);

  const key = (daily?.date || dep?.at || arr?.at || "").slice(0,10) || "today";
  pdf.save(`OFA_${key}_点呼日報.pdf`);
}

// expose（単日）
window.generateTodayPdf = generateTodayPdf;

// =====================================================
// 月報PDF（検索結果）
// =====================================================

// 月報用HTML（tenko/dailyの一覧）
function buildMonthlyPdfHtml({filters, tenko, daily, title}){
  const headerGrad = `linear-gradient(90deg,#20d3c2,#4a90ff,#9b5cff,#ff4d8d)`;

  const f = filters || {};
  const period = `${esc(f.start||"")} 〜 ${esc(f.end||"")}`;
  const base = esc(f.base||"");
  const name = esc(f.name||"");

  const tenkoSorted = (Array.isArray(tenko)?tenko:[]).slice().sort(byAtAsc);
  const dailySorted = (Array.isArray(daily)?daily:[]).slice().sort(byAtAsc);

  const tenkoRows = tenkoSorted.map(t=>{
    const dt = esc(fmtDateTime(t.at));
    const type = t.type === "arr" ? "帰着" : "出発";
    const alc = esc((t.alcValue ?? 0));
    const abn = esc(t.abnormal || "なし");
    return `
      <tr>
        <td>${dt}</td>
        <td>${esc(t.name||"")}</td>
        <td>${esc(t.base||"")}</td>
        <td style="text-align:center">${type}</td>
        <td style="text-align:right">${alc}</td>
        <td>${abn}</td>
      </tr>
    `;
  }).join("");

  // 日報はあなたの保存形式が複数パターンあり得るので、よくあるキーを吸収
  const dailyRows = dailySorted.map(r=>{
    const dt = esc(ymdFromAny(r.date || r.at || r.createdAt || r.updatedAt));
    const sales = r.salesTotal ?? r.sales ?? r.uriage ?? r.total ?? "";
    const profit = r.profit ?? r.rieki ?? "";
    const km = r.km ?? r.distance ?? r.runKm ?? "";
    const memo = r.memo ?? r.r_memo ?? "";
    return `
      <tr>
        <td>${dt}</td>
        <td>${esc(r.name||"")}</td>
        <td>${esc(r.base||"")}</td>
        <td style="text-align:right">${esc(sales)}</td>
        <td style="text-align:right">${esc(profit)}</td>
        <td style="text-align:right">${esc(km)}</td>
        <td>${esc(memo)}</td>
      </tr>
    `;
  }).join("");

  // サマリ
  const tenkoCount = tenkoSorted.length;
  const dailyCount = dailySorted.length;

  // 日報合計（数値っぽい時だけ足す）
  const sumSales = dailySorted.reduce((acc,r)=> acc + safeNum(r.salesTotal ?? r.sales ?? r.uriage ?? r.total), 0);
  const sumProfit = dailySorted.reduce((acc,r)=> acc + safeNum(r.profit ?? r.rieki), 0);
  const sumKm = dailySorted.reduce((acc,r)=> acc + safeNum(r.km ?? r.distance ?? r.runKm), 0);

  return `
  <div id="ofaMonthlyRoot" style="width:794px;background:#fff;font-family:-apple-system,BlinkMacSystemFont,'Hiragino Kaku Gothic ProN','Noto Sans JP','Helvetica Neue',Arial,sans-serif;color:#222;padding:18px">
    <div style="border-radius:18px;overflow:hidden;border:1px solid #e5eaf2">
      <div style="padding:14px;background:${headerGrad};color:#fff;display:flex;justify-content:space-between;align-items:center">
        <div style="font-weight:900">OFA GROUP</div>
        <div style="font-weight:800">${esc(title || "月報")}</div>
      </div>

      <div style="padding:14px">
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px">
          <div style="background:#f3f6ff;border:1px solid #e5eaf2;border-radius:12px;padding:8px 10px;font-weight:700">期間：${period}</div>
          <div style="background:#f3f6ff;border:1px solid #e5eaf2;border-radius:12px;padding:8px 10px;font-weight:700">拠点：${base || "-"}</div>
          <div style="background:#f3f6ff;border:1px solid #e5eaf2;border-radius:12px;padding:8px 10px;font-weight:700">氏名：${name || "-"}</div>
        </div>

        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px">
          <div style="background:#fff;border:1px solid #e5eaf2;border-radius:12px;padding:8px 10px">
            <div style="font-weight:900">点呼件数</div>
            <div style="font-size:18px;font-weight:900">${tenkoCount}</div>
          </div>
          <div style="background:#fff;border:1px solid #e5eaf2;border-radius:12px;padding:8px 10px">
            <div style="font-weight:900">日報件数</div>
            <div style="font-size:18px;font-weight:900">${dailyCount}</div>
          </div>
          <div style="background:#fff;border:1px solid #e5eaf2;border-radius:12px;padding:8px 10px">
            <div style="font-weight:900">売上合計</div>
            <div style="font-size:18px;font-weight:900">${sumSales}</div>
          </div>
          <div style="background:#fff;border:1px solid #e5eaf2;border-radius:12px;padding:8px 10px">
            <div style="font-weight:900">利益合計</div>
            <div style="font-size:18px;font-weight:900">${sumProfit}</div>
          </div>
          <div style="background:#fff;border:1px solid #e5eaf2;border-radius:12px;padding:8px 10px">
            <div style="font-weight:900">走行合計(km)</div>
            <div style="font-size:18px;font-weight:900">${sumKm}</div>
          </div>
        </div>

        <div style="font-weight:900;margin:12px 0 8px 0">点呼一覧</div>
        <div style="overflow:hidden;border:1px solid #e5eaf2;border-radius:14px">
          <table style="width:100%;border-collapse:collapse;font-size:12px">
            <thead>
              <tr style="background:#e9fbff">
                <th style="padding:8px;text-align:left">日時</th>
                <th style="padding:8px;text-align:left">氏名</th>
                <th style="padding:8px;text-align:left">拠点</th>
                <th style="padding:8px;text-align:center">区分</th>
                <th style="padding:8px;text-align:right">アルコール</th>
                <th style="padding:8px;text-align:left">異常</th>
              </tr>
            </thead>
            <tbody>
              ${tenkoRows || `<tr><td colspan="6" style="padding:10px;opacity:.7">該当なし</td></tr>`}
            </tbody>
          </table>
        </div>

        <div style="font-weight:900;margin:16px 0 8px 0">日報一覧</div>
        <div style="overflow:hidden;border:1px solid #e5eaf2;border-radius:14px">
          <table style="width:100%;border-collapse:collapse;font-size:12px">
            <thead>
              <tr style="background:#f7fbff">
                <th style="padding:8px;text-align:left">日付</th>
                <th style="padding:8px;text-align:left">氏名</th>
                <th style="padding:8px;text-align:left">拠点</th>
                <th style="padding:8px;text-align:right">売上</th>
                <th style="padding:8px;text-align:right">利益</th>
                <th style="padding:8px;text-align:right">走行</th>
                <th style="padding:8px;text-align:left">メモ</th>
              </tr>
            </thead>
            <tbody>
              ${dailyRows || `<tr><td colspan="7" style="padding:10px;opacity:.7">該当なし</td></tr>`}
            </tbody>
          </table>
        </div>

        <div style="margin-top:12px;font-size:11px;color:#666;display:flex;justify-content:space-between">
          <div>© OFA GROUP</div>
          <div>端末内生成PDF（検索結果）</div>
        </div>
      </div>
    </div>
  </div>
  `;
}

// HTML→PDF（複数ページ対応）
async function makePdfFromHtml(html, filename){
  await ensurePdfLibs();

  const holder = document.createElement("div");
  holder.style.position = "fixed";
  holder.style.left = "-10000px";
  holder.innerHTML = html;
  document.body.appendChild(holder);

  const root = holder.firstElementChild;

  const canvas = await html2canvas(root, {scale:2, backgroundColor:"#fff"});
  const imgData = canvas.toDataURL("image/png");

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF("p","pt","a4");

  const pageW = 595;
  const pageH = 842;

  const imgW = pageW;
  const imgH = canvas.height * (imgW / canvas.width);

  let y = 0;
  let remaining = imgH;

  while(remaining > 0){
    pdf.addImage(imgData, "PNG", 0, y, imgW, imgH);
    remaining -= pageH;
    if(remaining > 0){
      pdf.addPage();
      y -= pageH;
    }
  }

  document.body.removeChild(holder);

  pdf.save(filename || "OFA.pdf");
}

async function createMonthlyPdf({tenko, daily, filters, title}){
  // title は admin 側から来る（例：OFA_月報_開始_終了_拠点_氏名）
  const html = buildMonthlyPdfHtml({
    tenko: Array.isArray(tenko)?tenko:[],
    daily: Array.isArray(daily)?daily:[],
    filters: filters || {},
    title: title || "月報"
  });

  const f = filters || {};
  const start = (f.start||"").replaceAll("-","");
  const end   = (f.end||"").replaceAll("-","");
  const file = `${title || "OFA_月報"}_${start}_${end}.pdf`;

  await makePdfFromHtml(html, file);
}

// expose（月報＋汎用）
window.makePdfFromHtml = makePdfFromHtml;
window.createMonthlyPdf = createMonthlyPdf;
