// /admin/js/pdf.js
// 月報PDF（管理者）: OFAフォーマット / 日本語文字化け対策（HTML→canvas→PDF）
// ✅ typeゆれ吸収（dep/arr / departure/arrival / d/a）
// ✅ 氏名・拠点・電話を統一表示
// ✅ 複数ドライバー（groups）を1PDFでページ分割
// ✅ 点呼は出発/帰着ペアが揃った日だけODO差分加算

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
  await loadScriptOnce("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js");
  await loadScriptOnce("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
}

function esc(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function normalizeDate(d){
  if(!d) return "";
  return String(d).slice(0,10);
}

function safeNum(n){
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
}

function normalizePhone(s){
  return String(s||"").replaceAll("-","").replaceAll(" ","");
}

// typeの表記ゆれを統一（dep/arr）
function normalizeTenkoType(t){
  const raw = String(t?.type || "").toLowerCase();
  if(raw === "dep" || raw === "departure" || raw === "d" || raw === "start") return "dep";
  if(raw === "arr" || raw === "arrival" || raw === "a" || raw === "end") return "arr";
  // 旧：未指定なら at/odoの入り方で推定（あれば）
  if(t?.odoStart != null && t?.odoEnd == null) return "dep";
  if(t?.odoEnd != null && t?.odoStart == null) return "arr";
  return raw || "dep";
}

function fmtTime(at){
  if(!at) return "";
  const s = String(at);
  if(s.includes("T")) return s.slice(11,16);
  // "YYYY-MM-DD HH:mm" 形式も吸収
  if(s.length >= 16) return s.slice(11,16);
  return "";
}

function fmtDateTime(at){
  if(!at) return "";
  const s = String(at);
  if(s.includes("T")) return s.replace("T"," ").slice(0,16);
  return s.slice(0,16);
}

// 月報サマリ計算（1人分）
function calcMonthlySummary(group, filters){
  const days = new Set();

  (group.tenko||[]).forEach(t=>{
    const d = normalizeDate(t.at);
    if(d) days.add(d);
  });

  (group.daily||[]).forEach(d=>{
    const dd = normalizeDate(d.date || d.at || d.createdAt || d.updatedAt);
    if(dd) days.add(dd);
  });

  // 走行距離合計（dep+arrペア）
  const byDate = new Map();
  (group.tenko||[]).forEach(t=>{
    const d = normalizeDate(t.at);
    if(!d) return;
    if(!byDate.has(d)) byDate.set(d,{dep:null,arr:null});
    const tp = normalizeTenkoType(t);
    if(tp === "dep") byDate.get(d).dep = t;
    if(tp === "arr") byDate.get(d).arr = t;
  });

  let totalKm = 0;
  const missingDep = [];
  const missingArr = [];

  for(const [d,pair] of byDate){
    const dep = safeNum(pair.dep?.odoStart);
    const arr = safeNum(pair.arr?.odoEnd);
    if(pair.dep && pair.arr){
      const diff = arr - dep;
      if(diff > 0) totalKm += diff;
    }else{
      if(!pair.dep) missingDep.push(d);
      if(!pair.arr) missingArr.push(d);
    }
  }

  // 日報集計（キーゆれ吸収）
  let totalPay = 0;
  let totalCost = 0;
  let totalProfit = 0;

  (group.daily||[]).forEach(d=>{
    const sales = d.salesTotal ?? d.sales ?? d.uriage ?? d.total ?? d.payBase ?? 0;
    const cost  = d.costTotal ?? d.cost ?? d.expense ?? d.keihi ?? 0;
    const prof  = d.profit ?? d.rieki ?? (safeNum(sales) - safeNum(cost));
    totalPay    += safeNum(sales);
    totalCost   += safeNum(cost);
    totalProfit += safeNum(prof);
  });

  return {
    periodFrom: filters.from || filters.start || "",
    periodTo: filters.to || filters.end || "",
    workDays: days.size,
    totalKm,
    tenkoCount: (group.tenko||[]).length,
    dailyCount: (group.daily||[]).length,
    totalPay,
    totalCost,
    totalProfit,
    missingDep,
    missingArr,
  };
}

function buildMonthlyHtml(group, filters){
  const headerGrad = `linear-gradient(90deg,#20d3c2,#4a90ff,#9b5cff,#ff4d8d)`;
  const sum = calcMonthlySummary(group, filters);

  const name = esc(group.name || "");
  const base = esc(group.base || "");
  const phone = esc(group.phone || "");

  const tenkoSorted = (group.tenko||[]).slice().sort((a,b)=>{
    return new Date(a.at||0).getTime() - new Date(b.at||0).getTime();
  });

  const dailySorted = (group.daily||[]).slice().sort((a,b)=>{
    const da = new Date(a.date || a.at || a.createdAt || 0).getTime();
    const db = new Date(b.date || b.at || b.createdAt || 0).getTime();
    return da - db;
  });

  const tenkoRows = tenkoSorted.map(t=>{
    const d = normalizeDate(t.at);
    const tm = fmtTime(t.at);
    const tp = normalizeTenkoType(t);
    const kind = (tp === "dep") ? "出発" : "帰着";
    const odo = (tp === "dep") ? (t.odoStart ?? "") : (t.odoEnd ?? "");
    const method = t.method ?? "";
    const alc = (t.alcValue ?? "");
    const judge = t.alcJudge ?? "";
    const abn = t.abnormal ?? "";
    return `
      <tr>
        <td class="td">${esc(d)}</td>
        <td class="td">${kind}</td>
        <td class="td">${esc(tm)}</td>
        <td class="td">${esc(method)}</td>
        <td class="td">${esc(alc)}</td>
        <td class="td">${esc(judge)}</td>
        <td class="td">${esc(odo)}</td>
        <td class="td">${esc(abn)}</td>
      </tr>
    `;
  }).join("");

  const dailyRows = dailySorted.map(d=>{
    const day = normalizeDate(d.date || d.at || d.createdAt || d.updatedAt);
    const pj = d.mainProject ?? d.projectMain ?? d.project ?? "";
    const km = d.odoDiff ?? d.km ?? d.distance ?? d.runKm ?? "";
    const sales = d.salesTotal ?? d.sales ?? d.uriage ?? d.total ?? "";
    const cost  = d.costTotal ?? d.cost ?? d.expense ?? d.keihi ?? "";
    const prof  = d.profit ?? d.rieki ?? "";
    const memo  = (d.memo ?? d.r_memo ?? "").toString();
    return `
      <tr>
        <td class="td">${esc(day)}</td>
        <td class="td">${esc(pj)}</td>
        <td class="td">${esc(km)}</td>
        <td class="td">${esc(sales)}</td>
        <td class="td">${esc(cost)}</td>
        <td class="td">${esc(prof)}</td>
        <td class="td">${esc(memo.slice(0,40))}</td>
      </tr>
    `;
  }).join("");

  const missingBlock = `
    <div class="box">
      <div class="h3">点呼未実施日（検出）</div>
      <div class="p">
        出発が無い日：<b>${sum.missingDep.length}</b> 日
        ${sum.missingDep.length ? `<div class="mini">${esc(sum.missingDep.join(" / "))}</div>` : ""}
      </div>
      <div class="p" style="margin-top:8px">
        帰着が無い日：<b>${sum.missingArr.length}</b> 日
        ${sum.missingArr.length ? `<div class="mini">${esc(sum.missingArr.join(" / "))}</div>` : ""}
      </div>
    </div>
  `;

  return `
  <div id="ofaPdfRoot" style="width:794px;background:#fff;font-family:'Noto Sans JP',-apple-system,BlinkMacSystemFont,'Hiragino Kaku Gothic ProN','Helvetica Neue',Arial,sans-serif;color:#111;padding:16px">
    <div style="border:1px solid #e9eef5;border-radius:18px;overflow:hidden">
      <div style="background:${headerGrad};padding:14px;color:#fff;display:flex;justify-content:space-between;align-items:center">
        <div style="font-weight:900;font-size:18px">OFA GROUP</div>
        <div style="text-align:right">
          <div style="font-weight:900;font-size:14px">月報（管理者）</div>
          <div style="font-weight:700;font-size:12px;opacity:.95">期間：${esc(sum.periodFrom)} ～ ${esc(sum.periodTo)}</div>
        </div>
      </div>

      <div style="padding:14px">
        <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap">
          <div style="font-weight:900;font-size:16px">
            ${name} / ${base}
            ${phone ? `<span style="font-size:12px;font-weight:800;opacity:.9">（TEL: ${phone}）</span>` : ``}
          </div>
          <div style="font-size:12px;color:#555">生成：${esc(new Date().toLocaleString())}</div>
        </div>

        <style>
          .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:10px}
          .box{border:1px solid #e9eef5;border-radius:14px;padding:12px;background:#f7fbff}
          .h3{font-weight:900;margin:0 0 8px 0;font-size:13px}
          .p{margin:0;font-size:12px;color:#222}
          .mini{margin-top:6px;font-size:11px;color:#666;line-height:1.4;word-break:break-word}
          .sumline{display:flex;gap:10px;flex-wrap:wrap;font-size:13px}
          .sumline div{background:#fff;border:1px solid #e9eef5;border-radius:12px;padding:10px 12px}
          .tbl{width:100%;border-collapse:collapse;font-size:12px;margin-top:8px}
          .th{background:#f0fbff;border:1px solid #e9eef5;padding:8px;text-align:left}
          .td{border:1px solid #e9eef5;padding:8px;vertical-align:top}
          .secTitle{font-weight:900;margin-top:14px;font-size:13px}
          @media print{
            body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
          }
        </style>

        <div class="sumline" style="margin-top:10px">
          <div><b>稼働日数</b>：${sum.workDays} 日</div>
          <div><b>走行距離合計</b>：${sum.totalKm} km</div>
          <div><b>点呼件数</b>：${sum.tenkoCount}</div>
          <div><b>日報件数</b>：${sum.dailyCount}</div>
          <div><b>売上合計</b>：${sum.totalPay}</div>
          <div><b>経費合計</b>：${sum.totalCost}</div>
          <div><b>概算利益</b>：${sum.totalProfit}</div>
        </div>

        <div class="grid">
          ${missingBlock}
          <div class="box">
            <div class="h3">メモ</div>
            <p class="p">※日報の売上・経費は「任意入力」です。入力がある分のみ集計します。</p>
            <p class="p" style="margin-top:6px">※点呼は「出発」「帰着」で別入力。ODO差分は両方揃った日だけ計算します。</p>
          </div>
          <div class="box">
            <div class="h3">出力について</div>
            <p class="p">・このPDFは端末内データ（IndexedDB）から生成</p>
            <p class="p">・CSVは別ボタンでワンクリック出力</p>
          </div>
        </div>

        <div class="secTitle">点呼一覧</div>
        <table class="tbl">
          <tr>
            <th class="th">日付</th>
            <th class="th">区分</th>
            <th class="th">時刻</th>
            <th class="th">方法</th>
            <th class="th">アルコール</th>
            <th class="th">判定</th>
            <th class="th">ODO</th>
            <th class="th">異常</th>
          </tr>
          ${tenkoRows || `<tr><td class="td" colspan="8">点呼データがありません</td></tr>`}
        </table>

        <div class="secTitle">日報一覧（任意入力）</div>
        <table class="tbl">
          <tr>
            <th class="th">稼働日</th>
            <th class="th">案件</th>
            <th class="th">走行距離</th>
            <th class="th">売上</th>
            <th class="th">経費</th>
            <th class="th">利益</th>
            <th class="th">メモ</th>
          </tr>
          ${dailyRows || `<tr><td class="td" colspan="7">日報データがありません</td></tr>`}
        </table>

        <div style="margin-top:14px;border-top:1px solid #e9eef5;padding-top:10px;font-size:11px;color:#666;display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap">
          <div>© OFA GROUP</div>
          <div>※端末内で生成（アップロードなし）</div>
        </div>
      </div>
    </div>
  </div>
  `;
}

async function addHtmlPageToPdf(pdf, html){
  const holder = document.createElement("div");
  holder.style.position = "fixed";
  holder.style.left = "-10000px";
  holder.style.top = "0";
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

// groups: [{name, base, phone, tenko:[], daily:[]}, ...]
async function generateMonthlyPdf(groups, filters){
  await ensurePdfLibs();
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF("p", "pt", "a4");

  let first = true;
  for(const g of (groups||[])){
    if(!first) pdf.addPage();
    first = false;

    const html = buildMonthlyHtml(g, filters || {});
    await addHtmlPageToPdf(pdf, html);
  }

  const from = filters?.from || filters?.start || "all";
  const to   = filters?.to   || filters?.end   || "all";
  const key = `${from}_${to}`.replaceAll("/","-");

  pdf.save(`OFA_月報_${key}.pdf`);
}

// expose
window.generateMonthlyPdf = generateMonthlyPdf;
