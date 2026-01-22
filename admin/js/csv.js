// /admin/js/csv.js
// 管理者：検索結果をCSVワンクリック出力（日本語表記 / Excel文字化け対策BOM付き）
//
// 依存：/admin/js/db.js の searchRecords(), searchMonthly(), normalizeDate(), inRange() など
// ※このファイルは「ダウンロード処理」だけに集中

function csvEscape(v){
  const s = String(v ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g,'""')}"`;
  return s;
}

// Excelで日本語が化けないように BOM を付ける
function downloadCsv(filename, csvText){
  const bom = "\uFEFF";
  const blob = new Blob([bom + csvText], { type: "text/csv;charset=utf-8" });
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
  // rows: tenkoHit（出発/帰着点呼）
  const header = [
    "種別","氏名","拠点","車両番号","免許番号","電話","メール",
    "点呼区分","点呼日時","点呼方法",
    "睡眠時間(h)","体温(℃)","体調","疲労",
    "服薬","服薬内容",
    "飲酒の有無","酒気帯び","アルコール数値","アルコール判定",
    "稼働案件（メイン）","積込拠点/エリア","危険物・高額品",
    "出発ODO","帰着ODO","走行距離(km)",
    "異常","異常内容",
    "日常点検OK","日常点検NG","日常点検メモ",
    "作成ID"
  ];

  const lines = [header.map(csvEscape).join(",")];

  for(const r of rows){
    const checklist = Array.isArray(r.checklist) ? r.checklist : [];
    const ok = checklist.filter(x=>x && x.ok).map(x=>x.label).join(" / ");
    const ng = checklist.filter(x=>x && !x.ok).map(x=>x.label).join(" / ");

    const typeJP = (r.type === "departure") ? "出発" : (r.type === "arrival") ? "帰着" : (r.type || "");

    lines.push([
      "点呼",
      r.name, r.base, r.carNo, r.licenseNo, r.phone, r.email,
      typeJP,
      r.at, r.method,
      r.sleep, r.temp, r.condition, r.fatigue,
      r.med, r.medDetail,
      r.drink, r.alcFlag, r.alcValue, r.alcJudge,
      r.mainProject, r.loadingArea, r.dangerous,
      r.odoStart, r.odoEnd, r.odoDiff,
      r.abnormal, r.abnormalDetail,
      ok, ng, r.checkMemo,
      r.id
    ].map(csvEscape).join(","));
  }

  return lines.join("\n");
}

function buildDailyCsv(rows){
  // rows: dailyHit（日報）
  const header = [
    "種別","氏名","拠点","稼働日","案件（メイン）",
    "稼働開始","稼働終了","休憩時間(分)",
    "走行距離(km)","配達個数","不在数","再配達数","返品/持戻り","クレーム有無","クレーム内容",
    "日当","インセンティブ",
    "燃料","高速","駐車","その他経費",
    "売上合計","差引（概算利益）",
    "事故/物損","遅延理由","明日の稼働予定",
    "メモ",
    "複数案件(JSON)",
    "作成ID"
  ];

  const lines = [header.map(csvEscape).join(",")];

  for(const r of rows){
    lines.push([
      "日報",
      r.name, r.base, r.date, r.mainProject,
      r.workStart, r.workEnd, r.breakMin,
      r.odoDiff, r.deliverCount, r.absentCount, r.redeliverCount, r.returnCount, r.claimFlag, r.claimDetail,
      r.payBase, r.incentive,
      r.fuel, r.highway, r.parking, r.otherCost,
      r.salesTotal, r.profit,
      r.accidentFlag, r.delayReason, r.tomorrowPlan,
      r.memo,
      JSON.stringify(r.projects || []),
      r.id
    ].map(csvEscape).join(","));
  }

  return lines.join("\n");
}

/**
 * 管理者：期間・拠点・氏名で検索した「点呼 + 日報」をCSV出力（2ファイル）
 * filters: { from:"YYYY-MM-DD", to:"YYYY-MM-DD", base:"", name:"" }
 */
async function exportCsvSearchResult(filters){
  const { tenkoHit, dailyHit } = await searchRecords(filters);

  const dateKey = `${filters.from || "all"}_${filters.to || "all"}`;
  const tenkoCsv = buildTenkoCsv(tenkoHit);
  const dailyCsv = buildDailyCsv(dailyHit);

  // iPhoneでも確実に：ZIPにせず2本出す
  downloadCsv(`OFA_点呼_${dateKey}.csv`, tenkoCsv);
  downloadCsv(`OFA_日報_${dateKey}.csv`, dailyCsv);
}

/**
 * 管理者：月報集計CSV（検索結果グループごと）
 * - searchMonthly(filters) の groups を渡す
 */
function buildMonthlySummaryCsv(groups, filters){
  const header = [
    "種別","氏名","拠点","期間開始","期間終了",
    "稼働日数","点呼件数","日報件数",
    "走行距離合計(km)","出発点呼不足日","帰着点呼不足日",
    "売上合計","経費合計","概算利益合計"
  ];
  const lines = [header.map(csvEscape).join(",")];

  for(const g of groups){
    // 稼働日数（点呼 or 日報の日付の集合）
    const daySet = new Set();
    for(const t of (g.tenko || [])){
      const d = String(t.at || "").slice(0,10);
      if(d) daySet.add(d);
    }
    for(const d0 of (g.daily || [])){
      const d = String(d0.date || "").slice(0,10);
      if(d) daySet.add(d);
    }

    // 出発/帰着の欠けチェック（日別にペアを見る）
    const map = new Map(); // date -> {dep:boolean, arr:boolean, depOdo, arrOdo}
    for(const t of (g.tenko || [])){
      const d = String(t.at || "").slice(0,10);
      if(!d) continue;
      if(!map.has(d)) map.set(d, {dep:false, arr:false, depOdo:null, arrOdo:null});
      const o = map.get(d);
      if(t.type === "departure"){ o.dep = true; o.depOdo = t.odoStart; }
      if(t.type === "arrival"){   o.arr = true; o.arrOdo = t.odoEnd; }
    }

    let missingDep = 0;
    let missingArr = 0;
    let totalKm = 0;

    for(const d of daySet){
      const o = map.get(d);
      if(!o){
        // 点呼自体がない日：出発/帰着とも不足扱い
        missingDep++;
        missingArr++;
        continue;
      }
      if(!o.dep) missingDep++;
      if(!o.arr) missingArr++;

      // 走行距離（depODO/arrODO が揃った日のみ）
      const dep = Number(o.depOdo);
      const arr = Number(o.arrOdo);
      if(Number.isFinite(dep) && Number.isFinite(arr) && arr >= dep){
        totalKm += (arr - dep);
      }
    }

    // 売上/経費/利益（日報から合計）
    let sales = 0;
    let cost = 0;
    let profit = 0;

    for(const d0 of (g.daily || [])){
      const s = Number(d0.salesTotal);
      const c = Number(d0.costTotal);
      const p = Number(d0.profit);

      if(Number.isFinite(s)) sales += s;
      if(Number.isFinite(c)) cost += c;
      if(Number.isFinite(p)) profit += p;
    }

    lines.push([
      "月報集計",
      g.name, g.base,
      filters.from || "", filters.to || "",
      daySet.size,
      (g.tenko || []).length,
      (g.daily || []).length,
      totalKm,
      missingDep,
      missingArr,
      sales,
      cost,
      profit
    ].map(csvEscape).join(","));
  }

  return lines.join("\n");
}

async function exportMonthlySummaryCsv(filters){
  const groups = await searchMonthly(filters);
  const csv = buildMonthlySummaryCsv(groups, filters);
  const dateKey = `${filters.from || "all"}_${filters.to || "all"}`;
  downloadCsv(`OFA_月報集計_${dateKey}.csv`, csv);
}
