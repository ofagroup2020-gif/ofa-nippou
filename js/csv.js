// js/csv.js
function csvEscape(v){
  const s = String(v ?? "");
  if(/[",\n]/.test(s)) return `"${s.replace(/"/g,'""')}"`;
  return s;
}

function downloadText(filename, text){
  const blob = new Blob([text], {type:"text/csv;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function buildTenkoCsv(rows){
  const header = [
    "種別","氏名","拠点","車両番号","免許番号","電話","メール",
    "点呼区分","点呼日時","点呼方法","睡眠時間(h)","体温(℃)","体調","疲労","服薬","服薬内容",
    "アルコール数値","アルコール判定","出発ODO","帰着ODO","走行距離(km)",
    "異常","異常内容","日常点検OK","日常点検NG","日常点検メモ"
  ];
  const lines = [header.map(csvEscape).join(",")];

  for(const r of rows){
    const ok = (r.checklist||[]).filter(x=>x.ok).map(x=>x.label).join(" / ");
    const ng = (r.checklist||[]).filter(x=>!x.ok).map(x=>x.label).join(" / ");
    lines.push([
      "点呼",
      r.name, r.base, r.carNo, r.licenseNo, r.phone, r.email,
      r.type==="departure"?"出発":"帰着",
      r.at, r.method, r.sleep, r.temp, r.condition, r.fatigue, r.med, r.medDetail,
      r.alcValue, r.alcJudge,
      r.odoStart, r.odoEnd, r.odoDiff,
      r.abnormal, r.abnormalDetail,
      ok, ng, r.checkMemo
    ].map(csvEscape).join(","));
  }
  return lines.join("\n");
}

function buildDailyCsv(rows){
  const header = [
    "種別","氏名","拠点","稼働日","案件(メイン)","走行距離(km)",
    "日当","インセンティブ","燃料","高速","駐車","その他経費","売上合計","差引(概算利益)","メモ",
    "複数案件(JSON)"
  ];
  const lines = [header.map(csvEscape).join(",")];

  for(const r of rows){
    lines.push([
      "日報",
      r.name, r.base, r.date, r.mainProject, r.odoDiff,
      r.payBase, r.incentive, r.fuel, r.highway, r.parking, r.otherCost,
      r.salesTotal, r.profit, r.memo,
      JSON.stringify(r.projects||[])
    ].map(csvEscape).join(","));
  }
  return lines.join("\n");
}

async function exportCsvSearchResult(filters){
  const { tenkoHit, dailyHit } = await searchRecords(filters);
  const tenkoCsv = buildTenkoCsv(tenkoHit);
  const dailyCsv = buildDailyCsv(dailyHit);

  // zipしないで別々に出す（iPhoneで確実）
  const dateKey = `${filters.from||"all"}_${filters.to||"all"}`;
  downloadText(`OFA_点呼_${dateKey}.csv`, tenkoCsv);
  downloadText(`OFA_日報_${dateKey}.csv`, dailyCsv);
}
