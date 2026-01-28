const PDF_W_MM = 210;
const PDF_H_MM = 297;
const MARGIN_MM = 10; // 余白（印刷の見切れ対策）

function requiredCheck(){
  const missing = [];
  const need = [
    ["pref","拠点（都道府県）"],
    ["carNo","車両ナンバー"],
    ["frameNo","車台番号"],
    ["mileage","走行距離（km）"],
    ["fuel","給油状況"],
    ["userName","利用者氏名"],
    ["email","契約用メール"],
  ];
  need.forEach(([id,label])=>{
    const el=document.getElementById(id);
    if(!el) return;
    if(!String(el.value||"").trim()) missing.push(label);
  });

  // 同意
  if(!document.getElementById("agree").checked) missing.push("状態確認チェック");

  // 署名
  const sign = document.getElementById("sign");
  const signData = sign.toDataURL("image/png");
  // 白紙判定（ざっくり）
  if(signData.length < 5000) missing.push("署名");

  // 写真必須キー
  const reqPhotoKeys = [
    "lic","shaken","oil","fuelMeter",
    "front","rear","left","right","bed",
    "tlf","trf","tlr","trr"
  ];
  reqPhotoKeys.forEach(k=>{
    if(!state.photos[k]) missing.push(`写真：${k}`);
  });

  return missing;
}

function esc(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#39;");
}

function labelPhoto(key){
  const map = {
    lic:"運転免許証", shaken:"車検証", oil:"オイルステッカー", fuelMeter:"燃料計（メーター内）",
    front:"車両：前方", rear:"車両：後方", left:"車両：左側面", right:"車両：右側面", bed:"荷台（後ろから）",
    tlf:"タイヤ：左前", trf:"タイヤ：右前", tlr:"タイヤ：左後", trr:"タイヤ：右後",
  };
  return map[key] || key;
}

function buildPdfHtml(){
  const sign = document.getElementById("sign").toDataURL("image/png");

  // 日常点検
  const checks = [];
  document.querySelectorAll("#dailyCheck input[type=checkbox]").forEach((c,idx)=>{
    checks.push({ label: dailyItems[idx], ok: c.checked });
  });

  // 写真をグループ分け（見やすさ）
  const groupDocs = ["lic","shaken","oil","fuelMeter"];
  const groupCar  = ["front","rear","left","right","bed"];
  const groupTire = ["tlf","trf","tlr","trr"];

  function photoGrid(keys){
    return `
      <div class="grid">
        ${keys.map(k=>`
          <div class="pbox">
            <div class="pt">${esc(labelPhoto(k))}</div>
            <div class="pi">
              ${state.photos[k] ? `<img src="${state.photos[k]}">` : `<div class="ph">未添付</div>`}
            </div>
          </div>
        `).join("")}
      </div>
    `;
  }

  const html = `
  <div class="page">
    <div class="hd">
      <div class="h1">OFA GROUP 車両報告書</div>
      <div class="meta">
        <div>種別：${state.type==="loan"?"貸出":state.type==="return"?"返却":"定期点検"}</div>
        <div>管理番号：${esc(document.getElementById("manageId").value)}</div>
        <div>作成日時：${esc(document.getElementById("createdAt").value)}</div>
      </div>
    </div>

    <div class="sec">
      <div class="st">基本情報</div>
      <table class="tbl">
        <tr><th>拠点（都道府県）</th><td>${esc(document.getElementById("pref").value)}</td></tr>
        <tr><th>車両ナンバー</th><td>${esc(document.getElementById("carNo").value)}</td></tr>
        <tr><th>車台番号</th><td>${esc(document.getElementById("frameNo").value)}</td></tr>
        <tr><th>走行距離（km）</th><td>${esc(document.getElementById("mileage").value)}</td></tr>
        <tr><th>給油状況</th><td>${esc(document.getElementById("fuel").value)}</td></tr>
        <tr><th>利用者氏名</th><td>${esc(document.getElementById("userName").value)}</td></tr>
        <tr><th>契約用メール</th><td>${esc(document.getElementById("email").value)}</td></tr>
        <tr><th>電話番号（任意）</th><td>${esc(document.getElementById("tel").value)}</td></tr>
      </table>
    </div>

    <div class="sec">
      <div class="st">写真（書類）</div>
      ${photoGrid(groupDocs)}
    </div>

    <div class="sec">
      <div class="st">車両写真（外観）</div>
      ${photoGrid(groupCar)}
    </div>

    <div class="sec">
      <div class="st">タイヤ4箇所</div>
      ${photoGrid(groupTire)}
    </div>

    <div class="sec">
      <div class="st">日常点検（15項目）</div>
      <div class="check">
        ${checks.map(c=>`
          <div class="ci">
            <span class="cb ${c.ok?"ok":"ng"}">${c.ok?"✓":" "}</span>
            <span>${esc(c.label)}</span>
          </div>
        `).join("")}
      </div>
    </div>

    <div class="sec">
      <div class="st">車両状態の確認</div>
      <div class="note">
        上記内容を確認し、状態確認を行いました。
      </div>
    </div>

    <div class="sign">
      <div class="sl">署名</div>
      <img src="${sign}" class="sig">
    </div>
  </div>

  <style>
    .page{ width:794px; padding:28px; box-sizing:border-box; font-family:-apple-system,BlinkMacSystemFont,sans-serif; color:#111; }
    .hd{ border-bottom:3px solid #f5c400; padding-bottom:10px; margin-bottom:14px; }
    .h1{ font-size:22px; font-weight:800; }
    .meta{ margin-top:6px; color:#333; font-size:13px; line-height:1.6; display:flex; gap:14px; flex-wrap:wrap; }
    .sec{ margin:14px 0; }
    .st{ font-size:16px; font-weight:800; border-left:6px solid #f5c400; padding-left:10px; margin-bottom:8px; }
    .tbl{ width:100%; border-collapse:collapse; font-size:13px; }
    .tbl th{ width:170px; background:#f7f7f7; text-align:left; padding:8px; border:1px solid #ddd; }
    .tbl td{ padding:8px; border:1px solid #ddd; }
    .grid{ display:grid; grid-template-columns:1fr 1fr; gap:10px; }
    .pbox{ border:1px solid #ddd; border-radius:10px; overflow:hidden; }
    .pt{ background:#f7f7f7; padding:6px 8px; font-size:12px; font-weight:700; }
    .pi{ padding:8px; }
    .pi img{ width:100%; height:220px; object-fit:cover; border-radius:8px; }
    .ph{ height:220px; border:1px dashed #bbb; border-radius:8px; display:flex; align-items:center; justify-content:center; color:#888; }
    .check{ display:grid; grid-template-columns:1fr; gap:6px; font-size:13px; }
    .ci{ display:flex; gap:8px; align-items:flex-start; }
    .cb{ width:16px; height:16px; border:1px solid #333; display:inline-flex; align-items:center; justify-content:center; font-weight:900; line-height:1; margin-top:2px; }
    .cb.ok{ background:#eaffea; border-color:#0a7; color:#0a7; }
    .cb.ng{ background:#fff; }
    .note{ font-size:13px; color:#333; line-height:1.7; }
    /* 署名：PDF右下に小さく */
    .sign{ position:relative; margin-top:18px; height:110px; }
    .sl{ position:absolute; right:170px; bottom:70px; font-size:12px; color:#555; }
    .sig{ position:absolute; right:0; bottom:0; width:160px; height:70px; object-fit:contain; border:1px solid #ddd; border-radius:8px; background:#fff; padding:4px; box-sizing:border-box; }
  </style>
  `;
  return html;
}

async function htmlToPdf(){
  const pdfStage = document.getElementById("pdfStage");
  pdfStage.innerHTML = buildPdfHtml();

  const canvas = await html2canvas(pdfStage, {
    scale: 2,
    backgroundColor: "#ffffff",
    useCORS: true,
  });

  const imgData = canvas.toDataURL("image/jpeg", 0.92);

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF("p","mm","a4");

  const pageW = PDF_W_MM - MARGIN_MM*2;
  const pageH = PDF_H_MM - MARGIN_MM*2;

  // canvas(px) → pdf(mm) 変換
  const imgWmm = pageW;
  const imgHmm = (canvas.height * imgWmm) / canvas.width;

  // 1枚で収まるならそのまま
  if(imgHmm <= pageH){
    pdf.addImage(imgData, "JPEG", MARGIN_MM, MARGIN_MM, imgWmm, imgHmm);
    return pdf;
  }

  // 収まらない場合：縦にスライスして自動改ページ
  let remaining = imgHmm;
  let y = 0;

  // スライス用
  const pxPerMm = canvas.height / imgHmm;
  const pagePxH = pageH * pxPerMm;

  let page = 0;
  while(remaining > 0){
    // 1ページ分を切り出して描画
    const sliceCanvas = document.createElement("canvas");
    sliceCanvas.width = canvas.width;
    sliceCanvas.height = Math.min(canvas.height - y, pagePxH);

    const sctx = sliceCanvas.getContext("2d");
    sctx.fillStyle = "#fff";
    sctx.fillRect(0,0,sliceCanvas.width,sliceCanvas.height);
    sctx.drawImage(canvas, 0, y, canvas.width, sliceCanvas.height, 0, 0, canvas.width, sliceCanvas.height);

    const sliceData = sliceCanvas.toDataURL("image/jpeg", 0.92);
    const sliceHmm = (sliceCanvas.height * imgWmm) / sliceCanvas.width;

    if(page > 0) pdf.addPage();
    pdf.addImage(sliceData, "JPEG", MARGIN_MM, MARGIN_MM, imgWmm, sliceHmm);

    y += sliceCanvas.height;
    remaining -= pageH;
    page++;
  }

  return pdf;
}

document.getElementById("makePdf").addEventListener("click", async ()=>{
  const missing = requiredCheck();

  // missingの中に写真keyがあると見づらいので、写真は「不足あり」にまとめる
  const photoMissing = missing.filter(m=>m.startsWith("写真："));
  const otherMissing = missing.filter(m=>!m.startsWith("写真："));

  if(otherMissing.length || photoMissing.length){
    let msg = "";
    if(otherMissing.length){
      msg += "未入力/未チェック：\n" + otherMissing.join("\n") + "\n\n";
    }
    if(photoMissing.length){
      msg += `写真が未添付：${photoMissing.length}件\n（必要な写真をすべて添付してください）`;
    }
    alert(msg);
    return;
  }

  try{
    const pdf = await htmlToPdf();
    const filename = `OFA-${state.type==="loan"?"貸出":state.type==="return"?"返却":"点検"}-${document.getElementById("manageId").value}.pdf`;
    pdf.save(filename);
  }catch(err){
    console.error(err);
    alert("PDF作成に失敗しました。写真が多い場合は通信/端末負荷が原因のことがあります。もう一度お試しください。");
  }
});
