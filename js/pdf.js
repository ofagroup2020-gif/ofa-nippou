/* global jspdf */
(function(){
  const { jsPDF } = (window.jspdf || {});
  if (!jsPDF) {
    console.warn("jsPDFが読み込めていません（CDNがブロックの可能性）");
  }

  function mm(n){ return n; }

  async function dataUrlToJpegDataUrl(dataUrl, maxW=900, quality=0.78){
    if(!dataUrl) return null;
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const ratio = Math.min(1, maxW / img.width);
        const w = Math.floor(img.width * ratio);
        const h = Math.floor(img.height * ratio);
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#fff";
        ctx.fillRect(0,0,w,h);
        ctx.drawImage(img,0,0,w,h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    });
  }

  function header(doc, title){
    // カラーバー
    doc.setFillColor(32,211,176); doc.rect(0,0,210,10,"F");
    doc.setFillColor(76,154,255); doc.rect(70,0,70,10,"F");
    doc.setFillColor(176,97,255); doc.rect(140,0,40,10,"F");
    doc.setFillColor(255,77,141); doc.rect(180,0,30,10,"F");

    doc.setFont("helvetica","bold");
    doc.setTextColor(11,18,32);
    doc.setFontSize(14);
    doc.text(title, 12, 20);

    doc.setDrawColor(220,229,240);
    doc.line(12, 23, 198, 23);
  }

  function kv(doc, x, y, k, v){
    doc.setFont("helvetica","bold"); doc.setFontSize(10);
    doc.setTextColor(91,103,122);
    doc.text(k, x, y);
    doc.setFont("helvetica","bold"); doc.setFontSize(12);
    doc.setTextColor(11,18,32);
    doc.text(String(v ?? ""), x, y+6);
    doc.setDrawColor(220,229,240);
    doc.roundedRect(x-2, y-6, 90, 16, 3,3);
  }

  function wrapText(doc, text, x, y, maxW, lineH=5){
    const lines = doc.splitTextToSize(String(text||""), maxW);
    lines.forEach((ln,i)=>doc.text(ln,x,y+i*lineH));
    return y + lines.length*lineH;
  }

  async function addPhotoBlock(doc, title, dataUrl, x, y, w=90, h=50){
    doc.setFont("helvetica","bold"); doc.setFontSize(10);
    doc.setTextColor(91,103,122);
    doc.text(title, x, y);
    doc.setDrawColor(220,229,240);
    doc.roundedRect(x-2, y+2, w+4, h+4, 3,3);

    const jpeg = await dataUrlToJpegDataUrl(dataUrl, 1200, 0.78);
    if (jpeg) {
      try {
        doc.addImage(jpeg, "JPEG", x, y+4, w, h);
      } catch {
        doc.setFontSize(10);
        doc.setTextColor(255,59,48);
        doc.text("画像の埋め込みに失敗", x, y+12);
      }
    } else {
      doc.setFontSize(10);
      doc.setTextColor(91,103,122);
      doc.text("画像なし", x, y+12);
    }
  }

  async function makeTenkoPDF(payload){
    const doc = new jsPDF({unit:"mm", format:"a4"});
    const { profile, tenko } = payload;

    header(doc, `点呼報告書（${tenko.tenkoType === "departure" ? "出発" : "帰着"}）`);

    kv(doc, 12, 30, "氏名", profile.name);
    kv(doc, 108, 30, "拠点", profile.base);
    kv(doc, 12, 52, "車両番号", profile.carNo);
    kv(doc, 108, 52, "点呼日時", tenko.atText);
    kv(doc, 12, 74, "免許証番号", profile.licenseNo);
    kv(doc, 108, 74, "点呼実施方法", tenko.method);

    doc.setFont("helvetica","bold"); doc.setFontSize(12);
    doc.setTextColor(11,18,32);
    doc.text("健康・状態", 12, 102);
    doc.setDrawColor(220,229,240); doc.line(12,104,198,104);

    doc.setFont("helvetica","normal"); doc.setFontSize(11);
    doc.setTextColor(11,18,32);
    const health = [
      `睡眠時間：${tenko.sleepHours}h`,
      `体温：${tenko.bodyTemp}℃`,
      `体調：${tenko.condition}`,
      `疲労：${tenko.fatigue}`,
      `服薬：${tenko.medication}${tenko.medication==="あり" ? "（"+tenko.medicationDetail+"）":""}`,
      `飲酒：${tenko.drank}`,
      `酒気帯び：${tenko.alcoholJudge}`,
      `アルコール数値：${tenko.alcoholValue}`
    ];
    let y = 112;
    health.forEach((t,i)=>doc.text(t, 12 + (i%2)*96, y + Math.floor(i/2)*7));

    doc.setFont("helvetica","bold"); doc.setFontSize(12);
    doc.text("稼働案件（複数）", 12, 146);
    doc.setDrawColor(220,229,240); doc.line(12,148,198,148);

    doc.setFont("helvetica","normal"); doc.setFontSize(10);
    y = 156;
    (tenko.jobs || []).forEach((j, idx) => {
      const line = `#${idx+1} ${j.name} / エリア:${j.area} / 危険物:${j.danger} / 高額品:${j.high}`;
      y = wrapText(doc, line, 12, y, 186, 5) + 2;
    });

    doc.setFont("helvetica","bold"); doc.setFontSize(12);
    doc.text("異常申告", 12, y+6);
    doc.setDrawColor(220,229,240); doc.line(12,y+8,198,y+8);
    doc.setFont("helvetica","normal"); doc.setFontSize(11);
    doc.text(`異常：${tenko.abnormal}`, 12, y+18);
    if (tenko.abnormal === "あり") {
      y = wrapText(doc, `内容：${tenko.abnormalDetail}`, 12, y+26, 186, 5) + 2;
    } else {
      y = y + 26;
    }

    doc.setFont("helvetica","bold"); doc.setFontSize(12);
    doc.text("日常点検（車両点検）", 12, y+8);
    doc.setDrawColor(220,229,240); doc.line(12,y+10,198,y+10);

    doc.setFont("helvetica","normal"); doc.setFontSize(9);
    const ng = tenko.inspectNG || [];
    doc.text(`NG項目：${ng.length ? ng.join(" / ") : "なし"}`, 12, y+18);
    if (ng.length) {
      y = wrapText(doc, `NG詳細：${tenko.ngMemo || ""}`, 12, y+26, 186, 5) + 2;
    } else {
      y = y + 26;
    }

    // 写真ページ
    doc.addPage();
    header(doc, "添付写真（PDF埋め込み / アップロードなし）");

    await addPhotoBlock(doc, "運転免許証", tenko.photos?.licensePhoto, 12, 28, 90, 55);
    await addPhotoBlock(doc, "アルコール測定", tenko.photos?.alcoholPhoto, 108, 28, 90, 55);
    await addPhotoBlock(doc, "異常写真", tenko.photos?.abnormalPhoto, 12, 95, 90, 55);
    await addPhotoBlock(doc, "点検NG写真", tenko.photos?.ngPhoto, 108, 95, 90, 55);

    doc.setFont("helvetica","normal"); doc.setFontSize(10);
    doc.setTextColor(91,103,122);
    doc.text("© OFA GROUP", 12, 285);

    const fname = `OFA_TENKO_${tenko.atText.replaceAll(":","-").replaceAll(" ","_")}_${tenko.tenkoType}.pdf`;
    doc.save(fname);
  }

  async function makeDailyPDF(payload){
    const doc = new jsPDF({unit:"mm", format:"a4"});
    const { profile, daily } = payload;

    header(doc, "日報（業務実績）報告書");

    kv(doc, 12, 30, "氏名", profile.name);
    kv(doc, 108, 30, "拠点", profile.base);
    kv(doc, 12, 52, "車両番号", profile.carNo);
    kv(doc, 108, 52, "稼働日", daily.date);
    kv(doc, 12, 74, "案件", daily.workCase);
    kv(doc, 108, 74, "稼働時間", `${daily.workStart}〜${daily.workEnd}`);

    doc.setFont("helvetica","bold"); doc.setFontSize(12);
    doc.setTextColor(11,18,32);
    doc.text("実績", 12, 102);
    doc.setDrawColor(220,229,240); doc.line(12,104,198,104);

    doc.setFont("helvetica","normal"); doc.setFontSize(11);
    const r1 = [
      `稼働：${Math.floor(daily.workMinutes/60)}h${String(daily.workMinutes%60).padStart(2,"0")}m`,
      `休憩：${Math.floor(daily.breakMin/60)}h${String(daily.breakMin%60).padStart(2,"0")}m`,
      `走行距離：${Number(daily.distanceKm||0).toFixed(1)}km`,
      `配達個数：${daily.delivered}`,
      `不在：${daily.absent} / 再配達：${daily.redelivery} / 返品：${daily.returned}`
    ];
    let y = 114;
    r1.forEach(t => { y = wrapText(doc, t, 12, y, 186, 6) + 1; });

    doc.setFont("helvetica","bold"); doc.setFontSize(12);
    doc.text("売上 / 経費 / 利益", 12, y+8);
    doc.setDrawColor(220,229,240); doc.line(12,y+10,198,y+10);

    doc.setFont("helvetica","normal"); doc.setFontSize(11);
    const sales = Number(daily.payDaily||0) + Number(daily.payIncentive||0);
    const exp = Number(daily.expTotal||0);
    const prof = Number(daily.profit||0);
    doc.text(`売上合計：${sales.toLocaleString()}円（固定:${daily.payDaily} / ｲﾝｾﾝ:${daily.payIncentive}）`, 12, y+20);
    doc.text(`経費合計：${exp.toLocaleString()}円（高速:${daily.expToll} / 駐車:${daily.expParking} / 燃料:${daily.expFuel} / 他:${daily.expOther}）`, 12, y+28);
    doc.setFont("helvetica","bold"); doc.setFontSize(12);
    doc.text(`概算利益：${prof.toLocaleString()}円`, 12, y+38);

    doc.setFont("helvetica","normal"); doc.setFontSize(11);
    doc.text(`クレーム：${daily.claimFlag}${daily.claimFlag==="あり" ? "（"+daily.claimDetail+"）":""}`, 12, y+52);
    doc.text(`事故/物損：${daily.accidentFlag}${daily.accidentFlag==="あり" ? "（"+daily.accidentDetail+"）":""}`, 12, y+60);
    doc.text(`遅延理由：${daily.delayReason}`, 12, y+68);
    doc.text(`明日の稼働：${daily.tomorrowPlan}`, 12, y+76);

    // 写真ページ
    doc.addPage();
    header(doc, "日報 添付写真（PDF埋め込み）");
    await addPhotoBlock(doc, "日報写真", daily.photos?.dailyPhoto, 12, 28, 186, 120);

    doc.setFont("helvetica","normal"); doc.setFontSize(10);
    doc.setTextColor(91,103,122);
    doc.text("© OFA GROUP", 12, 285);

    doc.save(`OFA_DAILY_${daily.date}.pdf`);
  }

  async function makeMonthlyPDF(payload){
    const doc = new jsPDF({unit:"mm", format:"a4"});
    const { profile, monthly } = payload;

    header(doc, "月報（集計）");

    kv(doc, 12, 30, "氏名", profile.name);
    kv(doc, 108, 30, "拠点", profile.base);
    kv(doc, 12, 52, "期間", `${monthly.from} 〜 ${monthly.to}`);
    kv(doc, 108, 52, "稼働日数", monthly.days);

    doc.setFont("helvetica","bold"); doc.setFontSize(12);
    doc.setTextColor(11,18,32);
    doc.text("指標", 12, 82);
    doc.setDrawColor(220,229,240); doc.line(12,84,198,84);

    doc.setFont("helvetica","normal"); doc.setFontSize(11);
    const lines = [
      `総稼働時間：${Math.floor(monthly.totalWorkMin/60)}h${String(monthly.totalWorkMin%60).padStart(2,"0")}m`,
      `総休憩：${Math.floor(monthly.totalBreak/60)}h${String(monthly.totalBreak%60).padStart(2,"0")}m`,
      `総走行距離：${Number(monthly.totalDist||0).toFixed(1)}km`,
      `総配達個数：${monthly.totalDeliv}（1日平均：${Number(monthly.avg||0).toFixed(1)}）`,
      `不在率：${Number(monthly.absRate||0).toFixed(1)}% / 再配達率：${Number(monthly.redRate||0).toFixed(1)}%`,
      `クレーム件数：${monthly.totalClaim} / 事故件数：${monthly.totalAcc}`,
      `売上合計：${Number(monthly.totalSales||0).toLocaleString()}円`,
      `経費合計：${Number(monthly.totalExp||0).toLocaleString()}円`,
      `概算利益：${Number(monthly.totalProfit||0).toLocaleString()}円`,
    ];
    let y = 96;
    lines.forEach(t => { y = wrapText(doc, t, 12, y, 186, 6) + 2; });

    doc.setFont("helvetica","bold"); doc.setFontSize(12);
    doc.text("点呼未実施日", 12, y+8);
    doc.setDrawColor(220,229,240); doc.line(12,y+10,198,y+10);
    doc.setFont("helvetica","normal"); doc.setFontSize(10);
    y = wrapText(doc, monthly.missText || "なし", 12, y+20, 186, 5);

    doc.setFont("helvetica","normal"); doc.setFontSize(10);
    doc.setTextColor(91,103,122);
    doc.text("© OFA GROUP", 12, 285);

    doc.save(`OFA_MONTHLY_${monthly.from}_${monthly.to}.pdf`);
  }

  window.OFA_PDF = { makeTenkoPDF, makeDailyPDF, makeMonthlyPDF };
})();
