// /admin/js/pdf.js
// 月報PDF（管理者）: OFAフォーマット / 日本語文字化け対策（HTML→canvas→PDF）
// 2026-01-24: dep/arr / departure/arrival 両対応（互換）
// - tenko.type: "dep"|"arr" または "departure"|"arrival" を吸収
// - odo: dep→odoStart / arr→odoEnd
// - 日報: salesTotal / profit / costTotal(無ければ推定) など吸収

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

function normalizeDate(d){
  if(!d) return "";
  return String(d).slice(0,10);
}

function safeNum(n){
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
}

function tenkoKind(t){
  const ty = (t?.type || "").toLowerCase();
  if(ty === "dep" || ty === "departure") return "dep";
  if(ty === "arr" || ty === "arrival") return "arr";
  // フォールバック：文字が入ってたら判定
  if(String(t?.type||"").includes("出")) return "dep";
  if(String(t?.type||"").includes("帰")) return "arr";
  return "dep";
}

function pickSalesTotal(d){
  return safeNum(d.salesTotal ?? d.sales ?? d.uriage ?? d.total ?? (safeNum(d.payBase)+safeNum(d.incentive)));
}
function pickProfit(d){
  return safeNum(d.profit ?? d.rieki ?? (pickSalesTotal(d) - pickCostTotal(d)));
}
function pickCostTotal(d){
  // costTotalが無い場合は燃料等から推定
  const direct = d.costTotal ?? d.cost ?? null;
  if(direct !== null && direct !== undefined && direct !== "") return safeNum(direct);
  return safeNum(d.fuel) + safeNum(d.highway) + safeNum(d.parking) + safeNum(d.otherCost);
}
function pickKm(d){
  return safeNum(d.km ?? d.distance ?? d.runKm ?? d.odoDiff ?? 0);
}

function calcMonthlySummary(group, filters){
  const days = new Set();
  (group.tenko || []).forEach(t=>{
    const d = normalizeDate(t.at);
    if(d) days.add(d);
  });
  (group.daily || []).forEach(d=>{
    const dd = normalizeDate(d.date || d.at || d.createdAt || d.updatedAt);
    if(dd) days.add(dd);
  });

  // 走行距離合計（dep+arrペアで計算）
  const byDate = new Map();
  (group.tenko || []).forEach(t=>{
    const d = normalizeDate(t.at);
    if(!d) return;
    if(!byDate.has(d)) byDate.set(d,{dep:null,arr:null});
    const k = tenkoKind(t);
    if(k === "dep") byDate.get(d).dep = t;
    if(k === "arr") byDate.get(d).arr = t;
  });

  let totalKm = 0;
  let missingDep = [];
  let missingArr = [];

  for(const [d,pair] of byDate){
    if(pair.dep && pair.arr){
      const dep = safeNum(pair.dep.odoStart);
      const arr = safeNum(pair.arr.odoEnd);
      const diff = arr - dep;
      if(diff > 0) totalKm += diff;
    }else{
      if(!pair.dep) missingDep.push(d);
      if(!pair.arr) missingArr.push(d);
    }
  }

  // 日報集計
  let totalPay = 0;
  let totalCost = 0;
  let totalProfit = 0;

  (group.daily || []).forEach(d=>{
    const sales = pickSalesTotal(d);
    const cost  = pickCostTotal(d);
    const profit = pickProfit(d);

    totalPay    += sales;
    totalCost   += cost;
    totalProfit += profit;
  });

  return {
    periodFrom: filters.from || filters.start || "",
    periodTo: filters.to || filters.end || "",
    workDays: days.size,
    totalKm,
    tenkoCount: (group.tenko || []).length,
    dailyCount: (group.daily || []).length,
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

  const tenko = (group.tenko || []).slice().sort((a,b)=> new Date(a.at||0)-new Date(b.at||0));
  const daily = (group.daily || []).slice().sort((a,b)=> new Date((a.date||a.createdAt)||0)-new Date((b.date||b.createdAt)||0));

  // 点呼行
  const tenkoRows = tenko.map(t=>{
    const d = normalizeDate(t.at);
    const tm = (t.at || "").slice(11,16);
    const k = tenkoKind(t);
    const kind = (k === "dep") ? "出発" : "帰着";
    const odo = (k === "dep") ? (t.odoStart || "") : (t.odoEnd || "");
    return `
      <tr>
        <td class="td">${d}</td>
        <td class="td">${kind}</td>
        <td class="td">${tm}</td>
        <td class="td">${t.method || ""}</td>
        <td class="td">${t.alcValue ?? ""}</td>
        <td class="td">${t.alcJudge || ""}</td>
        <td class="td">${odo}</td>
        <td class="td">${t.abnormal || ""}</td>
      </tr>
    `;
  }).join("");

  // 日報行
  const dailyRows = daily.map(d=>{
    const dt = normalizeDate(d.date || d.at || d.createdAt || d.updatedAt);
    const sales = pickSalesTotal(d);
    const cost  = pickCostTotal(d);
    const profit = pickProfit(d);
    const km = pickKm(d);
    return `
      <tr>
        <td class="td">${dt}</td>
        <td class="td">${d.mainProject || ""}</td>
        <td class="td">${km || ""}</td>
        <td class="td">${sales || ""}</td>
        <td class="td">${cost || ""}</td>
        <td class="td">${profit || ""}</td>
        <td class="td">${(d.memo || "").slice(0,40)}</td>
      </tr>
    `;
  }).join("");

  const missingBlock = `
    <div class="box">
      <div class="h3">点呼未実施日（検出）</div>
      <div class="p">
        出発が無い日：<b>${sum.missingDep.length}</b> 日
        ${sum.missingDep.length ? `<div class="mini">${sum.missingDep.join(" / ")}</div>` : ""}
      </div>
      <div class="p" style="margin-top:8px">
        帰着が無い日：<b>${sum.missingArr.length}</b> 日
        ${sum.missingArr.length ? `<div class="mini">${sum.missingArr.join(" / ")}</div>` : ""}
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
          <div style="font-weight:700;font-size:12px;opacity:.95">期間：${sum.periodFrom} ～ ${sum.periodTo}</div>
        </div>
      </div>

      <div style="padding:14px">
        <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap">
          <div style="font-weight:900;font-size:16px">${group.name} / ${group.base}</div>
          <div style="font-size:12px;color:#555">生成：${new Date().toLocaleString()}</div>
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

async function generateMonthlyPdf(groups, filters){
  await ensurePdfLibs();
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF("p", "pt", "a4");

  let first = true;
  for(const g of groups){
    if(!first) pdf.addPage();
    first = false;

    const html = buildMonthlyHtml(g, filters);
    await addHtmlPageToPdf(pdf, html);
  }

  const key = `${(filters.from||filters.start||"all")}_${(filters.to||filters.end||"all")}`;
  pdf.save(`OFA_月報_${key}.pdf`);
}

// expose
window.generateMonthlyPdf = generateMonthlyPdf;
