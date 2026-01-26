// /admin/js/app.js
// 管理画面ロジック（検索 → グループ化 → 月報PDF）
// IndexedDB 直読み / Chrome・Safari 安定版

(function(){
  "use strict";

  const DB_NAME = "ofa_nippou_db";
  const DB_VER  = 1;
  const STORE_TENKO = "tenko";
  const STORE_DAILY = "daily";

  const $ = (id)=>document.getElementById(id);

  // -------------------------
  // IndexedDB helpers
  // -------------------------
  function openDB(){
    return new Promise((resolve, reject)=>{
      const req = indexedDB.open(DB_NAME, DB_VER);
      req.onsuccess = ()=>resolve(req.result);
      req.onerror   = ()=>reject(req.error);
    });
  }

  async function getAll(store){
    const db = await openDB();
    return new Promise((resolve, reject)=>{
      const tx = db.transaction(store,"readonly");
      const req = tx.objectStore(store).getAll();
      req.onsuccess = ()=>resolve(req.result||[]);
      req.onerror   = ()=>reject(req.error);
    });
  }

  // -------------------------
  // utils
  // -------------------------
  function normalizePhone(v){
    return String(v||"").replace(/[-\s]/g,"");
  }

  function inPeriod(at, from, to){
    const d = new Date(at);
    if(Number.isNaN(d.getTime())) return false;
    return d >= from && d <= to;
  }

  function includesPartial(hay, needle){
    if(!needle) return true;
    return String(hay||"").includes(needle);
  }

  // -------------------------
  // 検索本体
  // -------------------------
  async function search(){
    const start = $("q_start").value;
    const end   = $("q_end").value;
    if(!start || !end){
      alert("期間を指定してください");
      return;
    }

    const baseQ  = $("q_base").value.trim();
    const nameQ  = $("q_name").value.trim();
    const phoneQ = $("q_phone") ? normalizePhone($("q_phone").value.trim()) : "";

    const from = new Date(start+"T00:00:00");
    const to   = new Date(end+"T23:59:59");

    const [tenkoAll, dailyAll] = await Promise.all([
      getAll(STORE_TENKO),
      getAll(STORE_DAILY)
    ]);

    // ---- フィルタ ----
    const tenko = tenkoAll.filter(t=>{
      if(!inPeriod(t.at, from, to)) return false;
      if(!includesPartial(t.base, baseQ)) return false;
      if(!includesPartial(t.name, nameQ)) return false;
      if(phoneQ && normalizePhone(t.phone) !== phoneQ) return false;
      return true;
    });

    const daily = dailyAll.filter(d=>{
      const at = d.date || d.at || d.createdAt;
      if(!inPeriod(at, from, to)) return false;
      if(!includesPartial(d.base, baseQ)) return false;
      if(!includesPartial(d.name, nameQ)) return false;
      if(phoneQ && normalizePhone(d.phone) !== phoneQ) return false;
      return true;
    });

    // ---- グループ化（name + phone をキー）----
    const map = new Map();

    function keyOf(o){
      return `${o.name||""}__${normalizePhone(o.phone)}`;
    }

    tenko.forEach(t=>{
      const k = keyOf(t);
      if(!map.has(k)){
        map.set(k,{
          name: t.name||"",
          base: t.base||"",
          phone: t.phone||"",
          tenko: [],
          daily: []
        });
      }
      map.get(k).tenko.push(t);
    });

    daily.forEach(d=>{
      const k = keyOf(d);
      if(!map.has(k)){
        map.set(k,{
          name: d.name||"",
          base: d.base||"",
          phone: d.phone||"",
          tenko: [],
          daily: []
        });
      }
      map.get(k).daily.push(d);
    });

    const groups = Array.from(map.values());

    renderResult(groups);
    window.__monthlyGroups = groups;
    window.__monthlyFilters = { start, end, base:baseQ, name:nameQ, phone:phoneQ };

    return groups;
  }

  // -------------------------
  // 結果表示
  // -------------------------
  function renderResult(groups){
    $("resultSummary").textContent =
      `検索結果：${groups.length} 名`;

    const html = groups.map(g=>{
      return `
        <div class="histItem">
          <div class="histTop">
            <div class="histTitle">
              ${g.name} / ${g.base}
            </div>
          </div>
          <div class="histBody">
            TEL：${g.phone || "-"}<br>
            点呼：${g.tenko.length} 件 / 日報：${g.daily.length} 件
          </div>
        </div>
      `;
    }).join("");

    $("resultBox").innerHTML = html || `<div class="small">該当なし</div>`;
  }

  // -------------------------
  // PDF
  // -------------------------
  async function makePdf(){
    if(!window.__monthlyGroups || !window.__monthlyGroups.length){
      alert("先に検索してください");
      return;
    }
    await window.generateMonthlyPdf(
      window.__monthlyGroups,
      window.__monthlyFilters
    );
  }

  // -------------------------
  // bind
  // -------------------------
  document.addEventListener("DOMContentLoaded", ()=>{
    $("btnSearch").addEventListener("click", e=>{
      e.preventDefault();
      search().catch(err=>{
        console.error(err);
        alert("検索に失敗しました");
      });
    });

    $("btnMonthlyPdf").addEventListener("click", e=>{
      e.preventDefault();
      makePdf().catch(err=>{
        console.error(err);
        alert("PDF作成に失敗しました");
      });
    });
  });

})();
