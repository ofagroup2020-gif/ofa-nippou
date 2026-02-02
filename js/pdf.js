// js/pdf.js
// OFA PDF生成（ドライバー）
// 単日PDF ＋ 期間指定（月報）PDF
"use strict";

/* ===== libs ===== */
async function loadScriptOnce(src){
  if(document.querySelector(`script[data-src="${src}"]`)) return;
  await new Promise((res,rej)=>{
    const s=document.createElement("script");
    s.src=src; s.async=true; s.dataset.src=src;
    s.onload=res; s.onerror=rej; document.head.appendChild(s);
  });
}
async function ensurePdf(){
  await loadScriptOnce("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js");
  await loadScriptOnce("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
}

/* ===== utils ===== */
const esc = s=>String(s??"").replace(/[&<>"']/g,m=>(
  {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]
));
const ymd = v=>String(v||"").slice(0,10);

/* ===== html builders ===== */
function oneDayHtml({p, dep, arr, daily, km}){
  return `
  <div style="width:794px;padding:16px;font-family:'Noto Sans JP',sans-serif">
    <h2>点呼・日報</h2>
    <p>${esc(p.name)} / ${esc(p.base)} / ${esc(p.phone)}</p>
    <hr/>
    <h3>出発</h3><p>${esc(dep?.at||"未入力")} / ODO:${esc(dep?.odoStart||"")}</p>
    <h3>帰着</h3><p>${esc(arr?.at||"未入力")} / ODO:${esc(arr?.odoEnd||"")}</p>
    <p>走行距離：${km||0} km</p>
    <hr/>
    <h3>日報</h3>
    <p>売上:${daily?.salesTotal||0} / 利益:${daily?.profit||0}</p>
    <p>${esc(daily?.memo||"")}</p>
  </div>`;
}

function periodHtml({p, from, to, tenko, daily, sum}){
  const rowsT = tenko.map(t=>`
    <tr><td>${esc(ymd(t.at))}</td><td>${t.type}</td><td>${esc(t.alcValue||"")}</td></tr>
  `).join("");
  const rowsD = daily.map(d=>`
    <tr><td>${esc(ymd(d.date))}</td><td>${d.salesTotal||0}</td><td>${d.profit||0}</td></tr>
  `).join("");
  return `
  <div style="width:794px;padding:16px;font-family:'Noto Sans JP',sans-serif">
    <h2>月報（期間）</h2>
    <p>${esc(p.name)} / ${esc(p.base)} / ${from}〜${to}</p>
    <p>売上合計:${sum.sales} / 利益合計:${sum.profit}</p>
    <h3>点呼</h3>
    <table border="1" cellpadding="6"><tr><th>日付</th><th>区分</th><th>ALC</th></tr>${rowsT}</table>
    <h3>日報</h3>
    <table border="1" cellpadding="6"><tr><th>日付</th><th>売上</th><th>利益</th></tr>${rowsD}</table>
  </div>`;
}

/* ===== render ===== */
async function htmlToPdf(html, filename){
  await ensurePdf();
  const holder=document.createElement("div");
  holder.style.position="fixed"; holder.style.left="-10000px";
  holder.innerHTML=html; document.body.appendChild(holder);
  const canvas=await html2canvas(holder.firstElementChild,{scale:2,backgroundColor:"#fff"});
  const img=canvas.toDataURL("image/png");
  const {jsPDF}=window.jspdf;
  const pdf=new jsPDF("p","pt","a4");
  const w=595, h=canvas.height*(w/canvas.width);
  let y=0, remain=h;
  while(remain>0){
    pdf.addImage(img,"PNG",0,y,w,h);
    remain-=842; if(remain>0){ pdf.addPage(); y-=842; }
  }
  document.body.removeChild(holder);
  pdf.save(filename);
}

/* ===== exposed ===== */
window.makeTodayPdf = async function({profile, dep, arr, daily, km}){
  await htmlToPdf(oneDayHtml({p:profile,dep,arr,daily,km}),
    `OFA_${ymd(dep?.at||arr?.at||new Date())}.pdf`);
};

window.makePeriodPdf = async function({profile, from, to, tenko, daily}){
  const sum = {
    sales: daily.reduce((a,b)=>a+(+b.salesTotal||0),0),
    profit: daily.reduce((a,b)=>a+(+b.profit||0),0),
  };
  await htmlToPdf(
    periodHtml({p:profile,from,to,tenko,daily,sum}),
    `OFA_${from}_${to}_月報.pdf`
  );
};
