/* ==========================
   OFA Vehicle Report - PDF
   日本語文字化け回避：HTMLを画像化→A4自動改ページ
   ========================== */

window.OFA_PDF = (function(){
  async function makeA4PdfFromStage({ stageId, filenameBase }){
    const stage = document.getElementById(stageId);
    if(!stage) throw new Error("pdf stage not found");

    // 画質：2.0（iPhoneでも破綻しにくい。重い場合は1.6に下げる）
    const scale = 2.0;

    // html2canvasでステージを丸ごと1枚の巨大キャンバスに
    const canvas = await html2canvas(stage, {
      backgroundColor: "#ffffff",
      scale,
      useCORS: true,
      allowTaint: true,
      logging: false,
      windowWidth: stage.scrollWidth,
      windowHeight: stage.scrollHeight,
    });

    const imgData = canvas.toDataURL("image/jpeg", 0.92);

    // jsPDF
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({
      orientation: "p",
      unit: "mm",
      format: "a4",
      compress: true
    });

    const pageW = 210;
    const pageH = 297;

    // キャンバス比率からPDFに収める
    const imgW = pageW;
    const imgH = canvas.height * (imgW / canvas.width);

    // 1ページに入る画像高さ（mm）
    let positionY = 0;

    // 画像が複数ページに渡る場合は、同じ画像をYオフセットで分割表示
    // jsPDFは「負のy」で上を切って表示できるのでそれを利用
    pdf.addImage(imgData, "JPEG", 0, positionY, imgW, imgH);

    let remaining = imgH - pageH;
    while(remaining > 0){
      pdf.addPage();
      positionY = positionY - pageH; // 上方向にずらして表示
      pdf.addImage(imgData, "JPEG", 0, positionY, imgW, imgH);
      remaining -= pageH;
    }

    const filename = `${filenameBase}.pdf`;

    const blob = pdf.output("blob");
    return { blob, filename };
  }

  return { makeA4PdfFromStage };
})();
