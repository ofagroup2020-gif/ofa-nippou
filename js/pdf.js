import jsPDF from "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.es.min.js";

export function createDailyPDF(data) {
  const pdf = new jsPDF();
  pdf.text("OFA 日報", 10, 10);

  let y = 20;
  Object.entries(data).forEach(([k, v]) => {
    pdf.text(`${k}: ${v}`, 10, y);
    y += 8;
  });

  pdf.save(`daily_${Date.now()}.pdf`);
}
