// /admin/js/csv.js
// 管理者：検索結果CSV出力（日本語表記必須 / iPhone・Excel対策）
//
// 依存：/admin/js/db.js の searchRecords(filters)
// 使い方：admin.js から exportCsvSearchResult(filters) を呼ぶだけ

function csvEscape(v){
  const s = String(v ?? "");
  // カンマ/改行/ダブルクォートを含む場合は "..." で囲み、" は "" に
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toIsoLike(v){
  // datetime-local 文字列などをそのまま出す（日本語PDFは別）
  return String(v ?? "");
}

function safeNum(v){
  const x = Number(v);
  return Number.isFinite(x) ? x : "";
}

function joinChecklist(list, ok){
  const arr = Array.isArray(list) ? list : [];
  return arr
    .filter(x => !!x && !!x.label && (ok ? x.ok : !x.ok))
    .map(x => x.label)
    .join(" / ");
}

function downloadText(filename, text){
  // UTF-8 BOM付き（Excelで文字化けしにくい）
  const bom = "\uFEFF";
  const blob = new Blob([bom, text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function buildTenkoCsv(rows){
  // ✅ 日本語ヘッダ
  const header = [
    "種別",
    "氏名",
    "拠点",
    "車両番号",
    "運転免許証番号",
    "電話番号",
    "メールアドレス",
    "点呼区分",
    "点呼日時",
    "点呼方法",
    "睡眠時間(h)",
    "体温(℃)",
    "体調",
    "疲労",
    "服薬",
    "服薬内容",
    "飲酒の有無",
    "酒気帯び有無",
    "アルコール数値",
    "アルコール判定",
    "出発ODO",
    "帰着ODO",
    "走行距離(km)",
    "稼働案件(メイン)",
    "積込拠点/エリア",
    "危険物・高額品",
    "異常の有無",
    "異常内容",
    "日常点検OK",
    "日常点検NG",
    "日常点検メモ",
    "画像添付(免許)",
    "画像添付(アルコール)",
    "画像添付(異常)"
  ];

  const lines = [header.map(csvEscape).join(",")];

  for(const r of (rows || [])){
    const ok = joinChecklist(r.checklist, true);
    const ng = joinChecklist(r.checklist, false);

    const tenkoTypeJa =
      r.type === "departure" ? "出発" :
      r.type === "arrival"   ? "帰着" : (r.tenkoType || "");

    const odoStart = r.odoStart ?? "";
    const odoEnd   = r.odoEnd ?? "";
    const odoDiff  = (r.odoDiff ?? (safeNum(odoEnd) - safeNum(odoStart))) || "";

    // 画像は「保存済みならあり/なし」だけ（iPhoneで運用しやすい）
    const hasLicenseImg = r.hasLicenseImg ? "あり" : "なし";
    const hasAlcImg     = r.hasAlcImg ? "あり" : "なし";
    const hasAbnImg     = r.hasAbnImg ? "あり" : "なし";

    lines.push([
      "点呼",
      r.name,
      r.base,
      r.carNo,
      r.licenseNo,
      r.phone,
      r.email,
      tenkoTypeJa,
      toIsoLike(r.at),
      r.method,
      r.sleep,
      r.temp,
      r.condition,
      r.fatigue,
      r.med,
      r.medDetail,
      r.drink,        // 飲酒の有無（なし/あり）
      r.alcBand,      // 酒気帯び有無（なし/疑い/あり）
      r.alcValue,
      r.alcJudge,
      odoStart,
      odoEnd,
      odoDiff,
      r.mainProject,
      r.area,
      r.danger,
      r.abnormal,
      r.abnormalDetail,
      ok,
      ng,
      r.checkMemo,
      hasLicenseImg,
      hasAlcImg,
      hasAbnImg
    ].map(csvEscape).join(","));
  }

  return lines.join("\n");
}

function buildDailyCsv(rows){
  const header = [
    "種別",
    "氏名",
    "拠点",
    "稼働日",
    "案件(メイン)",
    "稼働開始",
    "稼働終了",
    "休憩時間(分)",
    "走行距離(km)",
    "配達個数",
    "不在数",
    "再配達数",
    "返品/持戻り数",
    "クレーム",
    "クレーム内容",
    "事故/物損",
    "事故/物損内容",
    "遅延理由",
    "明日の稼働予定",
    "日当(固定)",
    "インセンティブ",
    "燃料",
    "高速",
    "駐車",
    "その他経費",
    "売上合計",
    "差引(概算利益)",
    "メモ",
    "複数案件(JSON)",
    "写真添付(有無)"
  ];

  const lines = [header.map(csvEscape).join(",")];

  for(const r of (rows || [])){
    const hasPhotos = r.hasReportPhotos ? "あり" : "なし";
    lines.push([
      "日報",
      r.name,
      r.base,
      r.date,
      r.mainProject,
      r.workStart,
      r.workEnd,
      r.breakMin,
      r.odoDiff,
      r.deliveryCount,
      r.absentCount,
      r.redeliveryCount,
      r.returnCount,
      r.claim,
      r.claimDetail,
      r.accident,
      r.accidentDetail,
      r.delayReason,
      r.nextDayPlan,
      r.payBase,
      r.incentive,
      r.fuel,
      r.highway,
      r.parking,
      r.otherCost,
      r.salesTotal,
      r.profit,
      r.memo,
      JSON.stringify(r.projects || []),
      hasPhotos
    ].map(csvEscape).join(","));
  }

  return lines.join("\n");
}

async function exportCsvSearchResult(filters){
  // filters: {from,to,base,name}
  const f = filters || {};
  const { tenkoHit, dailyHit } = await searchRecords(f);

  // iPhoneで確実：zipにせず別ファイルで落とす
  const key = `${f.from || "all"}_${f.to || "all"}`;

  const tenkoCsv = buildTenkoCsv(tenkoHit);
  const dailyCsv = buildDailyCsv(dailyHit);

  downloadText(`OFA_点呼_${key}.csv`, tenkoCsv);
  downloadText(`OFA_日報_${key}.csv`, dailyCsv);
}

// グローバル公開（admin.js から呼ぶ）
window.exportCsvSearchResult = exportCsvSearchResult;
