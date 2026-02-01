// js/csv.js
// CSV export helpers (Driver + Admin 共通)

(function(){
  "use strict";

  function escCsv(v){
    const s = String(v ?? "");
    if(/[",\n]/.test(s)) return '"' + s.replaceAll('"','""') + '"';
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

  function tenkoToRow(t){
    return [
      t.id ?? "",
      t.at ?? "",
      t.type ?? "",
      t.name ?? "",
      t.base ?? "",
      t.phone ?? "",
      t.method ?? "",
      t.sleep ?? "",
      t.temp ?? "",
      t.condition ?? "",
      t.fatigue ?? "",
      t.alcState ?? "",
      t.alcValue ?? "",
      t.alcJudge ?? "",
      t.odoStart ?? "",
      t.odoEnd ?? "",
      t.breakMin ?? "",
      t.abnormal ?? "",
      t.abnormalDetail ?? "",
      t.createdAt ?? ""
    ];
  }

  function dailyToRow(d){
    return [
      d.id ?? "",
      d.date ?? "",
      d.name ?? "",
      d.base ?? "",
      d.phone ?? "",
      d.mainProject ?? "",
      d.salesTotal ?? "",
      d.profit ?? "",
      d.km ?? "",
      d.memo ?? "",
      d.createdAt ?? ""
    ];
  }

  async function exportAllCsv(){
    const tenko = await window.OFADB.getAll(window.OFADB.STORES.tenko);
    const daily = await window.OFADB.getAll(window.OFADB.STORES.daily);

    const lines = [];
    lines.push(["[TENKO]"].join(","));
    lines.push([
      "id","at","type","name","base","phone","method","sleep","temp","condition","fatigue","alcState","alcValue","alcJudge",
      "odoStart","odoEnd","breakMin","abnormal","abnormalDetail","createdAt"
    ].join(","));
    tenko.forEach(t=> lines.push(tenkoToRow(t).map(escCsv).join(",")));

    lines.push("");
    lines.push(["[DAILY]"].join(","));
    lines.push(["id","date","name","base","phone","mainProject","salesTotal","profit","km","memo","createdAt"].join(","));
    daily.forEach(d=> lines.push(dailyToRow(d).map(escCsv).join(",")));

    downloadText("OFA_all_history.csv", lines.join("\n"));
  }

  async function exportSearchCsv({tenko=[], daily=[], title="OFA_search"}){
    const lines = [];
    lines.push(["[TENKO]"].join(","));
    lines.push([
      "id","at","type","name","base","phone","method","sleep","temp","condition","fatigue","alcState","alcValue","alcJudge",
      "odoStart","odoEnd","breakMin","abnormal","abnormalDetail","createdAt"
    ].join(","));
    tenko.forEach(t=> lines.push(tenkoToRow(t).map(escCsv).join(",")));

    lines.push("");
    lines.push(["[DAILY]"].join(","));
    lines.push(["id","date","name","base","phone","mainProject","salesTotal","profit","km","memo","createdAt"].join(","));
    daily.forEach(d=> lines.push(dailyToRow(d).map(escCsv).join(",")));

    downloadText(`${title}.csv`, lines.join("\n"));
  }

  window.OFACSV = { exportAllCsv, exportSearchCsv };
})();
