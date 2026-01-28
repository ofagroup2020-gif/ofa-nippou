document.getElementById("makePdf").onclick = async () => {
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF("p","mm","a4");

  pdf.text("OFA GROUP 車両報告書", 10, 10);
  pdf.text("管理番号: "+manageId.value, 10, 20);
  pdf.text("作成日時: "+createdAt.value, 10, 28);

  // 署名（右下）
  const img = sign.toDataURL("image/png");
  pdf.addImage(img,"PNG",140,260,50,20);

  pdf.save("OFA-report.pdf");
};
