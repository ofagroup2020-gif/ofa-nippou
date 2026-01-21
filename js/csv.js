// ==============================
// OFA CSV Export
// ==============================

// CSV安全化
function csvEscape(v){
  const s = String(v ?? "");
  if(/[",\n]/.test(s)) return `"${s.replace(/"/g,'""')}"`;
  return s;
}

// iPhone/ Safari 安定のテキストDL
function downloadText(filename, text){
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url  = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;

  document.body.appendChild(a);
  a.click();
  a.remove();

  setTimeout(()=> URL.revokeObjectURL(url), 1500);
}

// checklist整形
function checklistToText(list, ok=true){
  const arr = (list || []).filter(x => !!x && (ok ? x.ok : !x.ok)).map(x => x.label);
  return arr.join(" / ");
}

// ------------------------------
// 点呼CSV（tenko）
// ------------------------------
function buildTenkoCsv(rows){
  const header = [
    "種別",
    "氏名","拠点","車両番号","免許番号","電話","メール",
    "点呼区分","点呼日時","日付",
    "点呼方法",
    "睡眠時間(h)","体温(℃)","体調","疲労",
    "服薬","服薬内容",
    "アルコール数値","アルコール判定",
    "出発ODO","帰着ODO","走行距離(km)",
    "異常","異常内容",
    "日常点検OK","日常点検NG","日常点検メモ"
  ];

  const lines = [ header.map(csvEscape).join(",") ];

  for(const r of (rows || [])){
    const okText = checklistToText(r.checklist, true);
    const ngText = checklistToText(r.checklist, false);

    lines.push([
      "点呼",
      r.name, r.base, r.carNo, r.licenseNo, r.phone, r.email,
      (r.type === "departure" ? "出発" : "帰着"),
      r.at,
      r.date || (r.at ? String(r.at).slice(0,10) : ""),
      r.method,
      r.sleep, r.temp, r.condition, r.fatigue,
      r.med, r.medDetail,
      r.alcValue, r.alcJudge,
      r.odoStart, r.odoEnd,
      r.odoDiff, // ここは app側でセットしておく or 0/空でもOK
      r.abnormal, r.abnormalDetail,
      okText, ngText, r.checkMemo
    ].map(csvEscape).join(","));
  }

  return lines.join("\n");
}

// ------------------------------
// 日報CSV（daily）
// ------------------------------
function buildDailyCsv(rows){
  const header = [
    "種別",
    "氏名","拠点","稼働日",
    "案件(メイン)",
    "走行距離(km)",
    "日当","インセンティブ",
    "燃料","高速","駐車","その他経費",
    "売上合計","差引(概算利益)",
    "メモ",
    "複数案件(JSON)"
  ];

  const lines = [ header.map(csvEscape).join(",") ];

  for(const r of (rows || [])){
    lines.push([
      "日報",
      r.name, r.base, r.date,
      r.mainProject,
      r.odoDiff,              // 任意（空でもOK）
      r.payBase, r.incentive, // 任意
      r.fuel, r.highway, r.parking, r.otherCost, // 任意
      r.salesTotal, r.profit, // 任意
      r.memo,
      JSON.stringify(r.projects || [])
    ].map(csvEscape).join(","));
  }

  return lines.join("\n");
}

// ------------------------------
// 検索結果CSVを出力（管理者/履歴用）
// ------------------------------
async function exportCsvSearchResult(filters){
  const { tenkoHit, dailyHit } = await OFA_DB.searchRecords(filters);

  // 走行距離(odoDiff)を tenko に補完（同日dep/arrのペアで差分を埋める）
  // ※ CSVで見たときに「出発行にも km を入れてほしい」要望対応
  const byKey = new Map(); // key = name__base__date => {dep, arr}

  for(const t of tenkoHit){
    const date = t.date || (t.at ? String(t.at).slice(0,10) : "");
    const key = `${t.name}__${t.base}__${date}`;
    if(!byKey.has(key)) byKey.set(key, { dep:null, arr:null });
    if(t.type === "departure") byKey.get(key).dep = t;
    if(t.type === "arrival")   byKey.get(key).arr = t;
  }

  for(const [key, pair] of byKey){
    const km = OFA_DB.safeNum(pair.arr?.odoEnd) - OFA_DB.safeNum(pair.dep?.odoStart);
    const val = (km > 0) ? km : "";
    if(pair.dep) pair.dep.odoDiff = val;
    if(pair.arr) pair.arr.odoDiff = val;
  }

  // 日報にも同じ km を補完（同日・同人物のペアで差分を入れる）
  const kmByPersonDate = new Map(); // k = name__base__date => km
  for(const [key, pair] of byKey){
    const km = OFA_DB.safeNum(pair.arr?.odoEnd) - OFA_DB.safeNum(pair.dep?.odoStart);
    kmByPersonDate.set(key, (km > 0) ? km : "");
  }
  for(const d of dailyHit){
    const key = `${d.name}__${d.base}__${d.date}`;
    if(d.odoDiff == null || d.odoDiff === "") d.odoDiff = kmByPersonDate.get(key) ?? "";
  }

  const tenkoCsv = buildTenkoCsv(tenkoHit);
  const dailyCsv = buildDailyCsv(dailyHit);

  const dateKey = `${filters.from || "all"}_${filters.to || "all"}`;
  downloadText(`OFA_点呼_${dateKey}.csv`, tenkoCsv);

  // 2つ目は少し遅らせる（iPhoneでDL競合しにくい）
  setTimeout(()=>{
    downloadText(`OFA_日報_${dateKey}.csv`, dailyCsv);
  }, 500);
}

// ------------------------------
// Expose
// ------------------------------
window.OFA_CSV = {
  csvEscape,
  downloadText,
  buildTenkoCsv,
  buildDailyCsv,
  exportCsvSearchResult
};
