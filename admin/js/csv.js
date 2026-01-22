// /admin/js/csv.js
// CSVワンクリック出力（検索結果）
// - iPhoneで確実に動かすためZIPは使わない（点呼CSV / 日報CSV を個別ダウンロード）
// - 日本語ヘッダー

function csvEscape(v){
  const s = String(v ?? "");
  if(/[",\n]/.test(s)) return `"${s.replace(/"/g,'""')}"`;
  return s;
}

function downloadText(filename, text){
  // Excel等で文字化けしにくいようにBOM付与
  const bom = "\uFEFF";
  const blob = new Blob([bom + text], {type:"text/csv;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function normalizeDate(d){
  if(!d) return "";
  return String(d).slice(0,10);
}

function safeNum(n){
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
}

// ---- 点呼CSV ----
function buildTenkoCsv(rows){
  const header = [
    "種別","ID",
    "氏名","拠点","車両番号","免許番号","電話","メール",
    "点呼区分","点呼日時","点呼方法",
    "睡眠時間(h)","体温(℃)","体調","疲労",
    "服薬","服薬内容",
    "飲酒の有無","酒気帯び有無",
    "アルコール数値","アルコール判定",
    "稼働案件（メイン）","稼働案件（複数）",
    "積込拠点/エリア","危険物・高額品",
    "出発ODO","帰着ODO","走行距離(km)",
    "異常","異常内容",
    "日常点検OK","日常点検NG","日常点検メモ"
  ];
  const lines = [header.map(csvEscape).join(",")];

  for(const r of rows){
    const ok = (r.checklist||[]).filter(x=>x.ok).map(x=>x.label).join(" / ");
    const ng = (r.checklist||[]).filter(x=>!x.ok).map(x=>x.label).join(" / ");

    // 複数案件はJSONのまま残す（後で集計しやすい）
    const projectsJson = r.projects ? JSON.stringify(r.projects) : "";

    lines.push([
      "点呼",
      r.id || "",
      r.name || "", r.base || "", r.carNo || "", r.licenseNo || "", r.phone || "", r.email || "",
      (r.type==="departure" ? "出発" : (r.type==="arrival" ? "帰着" : "")),
      r.at || "", r.method || "",
      r.sleep || "", r.temp || "", r.condition || "", r.fatigue || "",
      r.med || "", r.medDetail || "",
      r.drink || "", r.drinkJudge || "",
      r.alcValue ?? "", r.alcJudge || "",
      r.mainProject || "", projectsJson,
      r.area || "", r.danger || "",
      r.odoStart || "", r.odoEnd || "", r.odoDiff ?? "",
      r.abnormal || "", r.abnormalDetail || "",
      ok, ng, r.checkMemo || ""
    ].map(csvEscape).join(","));
  }
  return lines.join("\n");
}

// ---- 日報CSV（任意入力） ----
function buildDailyCsv(rows){
  const header = [
    "種別","ID",
    "氏名","拠点",
    "稼働日","案件（メイン）","複数案件(JSON)",
    "稼働開始","稼働終了","休憩(分)",
    "走行距離(km)",
    "配達個数","不在数","再配達数","返品/持戻り数",
    "クレーム有無","クレーム内容",
    "事故/物損有無","事故/物損内容",
    "遅延理由",
    "明日の稼働予定",
    "日当","インセンティブ",
    "燃料","高速","駐車","その他経費","経費合計",
    "売上合計","差引(概算利益)",
    "メモ"
  ];
  const lines = [header.map(csvEscape).join(",")];

  for(const r of rows){
    const projectsJson = r.projects ? JSON.stringify(r.projects) : "";

    lines.push([
      "日報",
      r.id || "",
      r.name || "", r.base || "",
      r.date || "", r.mainProject || "", projectsJson,
      r.workStart || "", r.workEnd || "", r.breakMin ?? "",
      r.odoDiff ?? "",
      r.boxes ?? "", r.absent ?? "", r.redelivery ?? "", r.returned ?? "",
      r.claim || "", r.claimDetail || "",
      r.accident || "", r.accidentDetail || "",
      r.delayReason || "",
      r.tomorrow || "",
      r.payBase ?? "", r.incentive ?? "",
      r.fuel ?? "", r.highway ?? "", r.parking ?? "", r.otherCost ?? "", r.costTotal ?? "",
      r.salesTotal ?? "", r.profit ?? "",
      r.memo || ""
    ].map(csvEscape).join(","));
  }
  return lines.join("\n");
}

// ---- 公開API：検索結果をCSV出力 ----
// ※ searchRecords は /admin/js/db.js 側で定義されている想定
async function exportCsvSearchResult(filters){
  const { tenkoHit, dailyHit } = await searchRecords(filters);

  // 点呼CSV
  const tenkoCsv = buildTenkoCsv(tenkoHit);
  // 日報CSV
  const dailyCsv = buildDailyCsv(dailyHit);

  const key = `${filters.from||"all"}_${filters.to||"all"}`;
  downloadText(`OFA_点呼_${key}.csv`, tenkoCsv);
  downloadText(`OFA_日報_${key}.csv`, dailyCsv);
}

// 管理者画面側のボタンから直接呼べるように window に公開
window.exportCsvSearchResult = exportCsvSearchResult;
