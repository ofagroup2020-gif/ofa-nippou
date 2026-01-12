/* global OFA_PDF */
const $ = (id)=>document.getElementById(id);

let adminRows = [];   // daily CSV rows
let adminMonthly = null;

function parseCSV(text){
  const lines = text.split(/\r?\n/).filter(l=>l.trim().length);
  if (!lines.length) return [];
  const parseLine = (line) => {
    const out = [];
    let cur = "", inQ = false;
    for (let i=0;i<line.length;i++){
      const ch = line[i];
      if (ch === '"' ) {
        if (inQ && line[i+1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (ch === "," && !inQ) {
        out.push(cur); cur = "";
      } else cur += ch;
    }
    out.push(cur);
    return out;
  };
  const header = parseLine(lines[0]).map(s=>s.replaceAll(/^"|"$/g,""));
  return lines.slice(1).map(l=>{
    const cols = parseLine(l);
    const obj = {};
    header.forEach((h,idx)=>{
      obj[h] = (cols[idx] ?? "").replaceAll(/^"|"$/g,"");
    });
    return obj;
  });
}

function num(x){ return Number(x||0); }

function setDisabled(){
  $("btnAdminCalc").disabled = adminRows.length === 0;
}

window.addEventListener("DOMContentLoaded", ()=>{
  $("adminCsvFiles").addEventListener("change", handleFiles);
  $("btnAdminCalc").addEventListener("click", calcAdmin);
  $("btnAdminPDF").addEventListener("click", adminPDF);
  $("btnAdminCSV").addEventListener("click", adminCSV);
});

async function handleFiles(e){
  const files = [...(e.target.files||[])];
  adminRows = [];
  for (const f of files){
    const t = await f.text();
    const rows = parseCSV(t);

    // dailyだけ拾う（kind=daily）
    rows.forEach(r=>{
      if ((r.kind||"").toLowerCase() === "daily") adminRows.push(r);
    });
  }
  setDisabled();
  alert(`取込み完了：日報 ${adminRows.length}件`);
}

function inRange(d, from, to){
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

function calcAdmin(){
  const from = $("aFrom").value;
  const to = $("aTo").value;
  const base = $("aBase").value.trim();
  const name = $("aName").value.trim();

  const rows = adminRows.filter(r=>{
    const d = r.date || "";
    if (!inRange(d, from, to)) return false;
    if (base && (r.base||"") !== base) return false;
    if (name && !(r.name||"").includes(name)) return false;
    return true;
  });

  const days = new Set(rows.map(r=>r.date)).size;
  const totalWorkMin = rows.reduce((a,r)=>a+num(r.workMinutes),0);
  const totalBreak = rows.reduce((a,r)=>a+num(r.breakMin),0);
  const totalDist = rows.reduce((a,r)=>a+num(r.distanceKm),0);
  const totalDeliv = rows.reduce((a,r)=>a+num(r.delivered),0);
  const totalAbs = rows.reduce((a,r)=>a+num(r.absent),0);
  const totalRed = rows.reduce((a,r)=>a+num(r.redelivery),0);
  const totalClaim = rows.filter(r=>r.claimFlag==="あり").length;
  const totalAcc = rows.filter(r=>r.accidentFlag==="あり").length;

  const totalSales = rows.reduce((a,r)=>a + num(r.payDaily) + num(r.payIncentive),0);
  const totalExp = rows.reduce((a,r)=>a + num(r.expTotal),0);
  const totalProfit = rows.reduce((a,r)=>a + num(r.profit),0);

  const avg = days ? totalDeliv/days : 0;
  const absRate = totalDeliv ? totalAbs/totalDeliv*100 : 0;
  const redRate = totalDeliv ? totalRed/totalDeliv*100 : 0;

  adminMonthly = {
    from: from || "-",
    to: to || "-",
    days,
    totalWorkMin,
    totalBreak,
    totalDist,
    totalDeliv,
    avg,
    absRate,
    redRate,
    totalClaim,
    totalAcc,
    totalSales,
    totalExp,
    totalProfit,
    rows
  };

  $("adminMonthlyBox").style.display = "block";
  $("btnAdminPDF").disabled = false;
  $("btnAdminCSV").disabled = false;

  $("am_days").textContent = String(days);
  $("am_work").textContent = `${Math.floor(totalWorkMin/60)}h${String(totalWorkMin%60).padStart(2,"0")}m`;
  $("am_break").textContent = `${Math.floor(totalBreak/60)}h${String(totalBreak%60).padStart(2,"0")}m`;
  $("am_dist").textContent = totalDist.toFixed(1);

  $("am_deliv").textContent = String(totalDeliv);
  $("am_avg").textContent = avg.toFixed(1);
  $("am_absRate").textContent = `${absRate.toFixed(1)}%`;
  $("am_redRate").textContent = `${redRate.toFixed(1)}%`;

  $("am_claim").textContent = String(totalClaim);
  $("am_acc").textContent = String(totalAcc);
  $("am_sales").textContent = totalSales.toLocaleString();
  $("am_exp").textContent = totalExp.toLocaleString();
  $("am_profit").textContent = totalProfit.toLocaleString();
}

async function adminPDF(){
  if (!adminMonthly) return;
  // 管理者PDFは「名前/拠点」を検索条件で出す（代表値）
  const profile = {
    name: $("aName").value.trim() || "（検索条件：全員）",
    base: $("aBase").value.trim() || "（全拠点）",
    carNo: "",
    licenseNo: ""
  };
  await OFA_PDF.makeMonthlyPDF({ profile, monthly: {
    ...adminMonthly,
    missText: "（サーバー無し運用のため、点呼未実施はCSVに含まれない場合があります）"
  }});
}

function adminCSV(){
  if (!adminMonthly) return;
  const rows = adminMonthly.rows.map(r=>({
    date: r.date,
    name: r.name,
    base: r.base,
    workCase: r.workCase,
    delivered: r.delivered,
    absent: r.absent,
    redelivery: r.redelivery,
    sales: (num(r.payDaily)+num(r.payIncentive)),
    exp: num(r.expTotal),
    profit: num(r.profit)
  }));
  const esc = (s) => `"${String(s ?? "").replaceAll('"','""')}"`;
  const cols = Object.keys(rows[0]||{});
  const csv = cols.map(esc).join(",") + "\n" + rows.map(o=>cols.map(c=>esc(o[c])).join(",")).join("\n");

  const blob = new Blob([csv], {type:"text/csv"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `OFA_admin_aggregate_${adminMonthly.from}_${adminMonthly.to}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}
