// ==============================
// OFA 点呼・日報 IndexedDB
// ==============================

const OFA_DB_NAME = "ofa_nippou_db";
const OFA_DB_VER  = 1;

// store names
const STORE_PROFILE = "profile"; // id = "me"
const STORE_TENKO   = "tenko";   // 出発 / 帰着
const STORE_DAILY   = "daily";   // 日報（任意）

/* ==============================
   DB open
============================== */
function idbOpen(){
  return new Promise((resolve, reject)=>{
    const req = indexedDB.open(OFA_DB_NAME, OFA_DB_VER);

    req.onupgradeneeded = () => {
      const db = req.result;

      // プロフィール
      if(!db.objectStoreNames.contains(STORE_PROFILE)){
        db.createObjectStore(STORE_PROFILE, { keyPath:"id" });
      }

      // 点呼
      if(!db.objectStoreNames.contains(STORE_TENKO)){
        const st = db.createObjectStore(STORE_TENKO, { keyPath:"id" });
        st.createIndex("by_at",   "at",   { unique:false });
        st.createIndex("by_date", "date", { unique:false });
        st.createIndex("by_name", "name", { unique:false });
        st.createIndex("by_base", "base", { unique:false });
        st.createIndex("by_type", "type", { unique:false }); // departure / arrival
      }

      // 日報
      if(!db.objectStoreNames.contains(STORE_DAILY)){
        const sd = db.createObjectStore(STORE_DAILY, { keyPath:"id" });
        sd.createIndex("by_date", "date", { unique:false });
        sd.createIndex("by_name", "name", { unique:false });
        sd.createIndex("by_base", "base", { unique:false });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

/* ==============================
   Basic CRUD
============================== */
async function idbPut(store, value){
  const db = await idbOpen();
  return new Promise((resolve, reject)=>{
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).put(value);
    tx.oncomplete = ()=> resolve(true);
    tx.onerror    = ()=> reject(tx.error);
  });
}

async function idbGet(store, key){
  const db = await idbOpen();
  return new Promise((resolve, reject)=>{
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).get(key);
    req.onsuccess = ()=> resolve(req.result || null);
    req.onerror   = ()=> reject(req.error);
  });
}

async function idbDelete(store, key){
  const db = await idbOpen();
  return new Promise((resolve, reject)=>{
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).delete(key);
    tx.oncomplete = ()=> resolve(true);
    tx.onerror    = ()=> reject(tx.error);
  });
}

async function idbGetAll(store){
  const db = await idbOpen();
  return new Promise((resolve, reject)=>{
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).getAll();
    req.onsuccess = ()=> resolve(req.result || []);
    req.onerror   = ()=> reject(req.error);
  });
}

/* ==============================
   Utils
============================== */
function normalizeDate(v){
  if(!v) return "";
  return String(v).slice(0,10); // yyyy-mm-dd
}

function inRange(dateStr, from, to){
  const d = normalizeDate(dateStr);
  if(!d) return false;
  if(from && d < normalizeDate(from)) return false;
  if(to   && d > normalizeDate(to))   return false;
  return true;
}

function includesLike(hay, needle){
  if(!needle) return true;
  return String(hay||"").toLowerCase().includes(String(needle).toLowerCase());
}

function safeNum(n){
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
}

/* ==============================
   Save helpers
============================== */

// 点呼保存（出発 / 帰着）
async function saveTenko(data){
  // idは「日付 + type + timestamp」で衝突回避
  if(!data.id){
    const d = normalizeDate(data.at);
    data.id = `${d}_${data.type}_${Date.now()}`;
  }
  data.date = normalizeDate(data.at);
  await idbPut(STORE_TENKO, data);
}

// 日報保存
async function saveDaily(data){
  if(!data.id){
    data.id = `${data.date}_${data.name}_${Date.now()}`;
  }
  await idbPut(STORE_DAILY, data);
}

/* ==============================
   Search (管理者 / CSV / PDF)
============================== */
async function searchRecords(filters){
  const tenkoAll = await idbGetAll(STORE_TENKO);
  const dailyAll = await idbGetAll(STORE_DAILY);

  const tenkoHit = tenkoAll.filter(r=>{
    if(filters.from || filters.to){
      if(!inRange(r.at, filters.from, filters.to)) return false;
    }
    if(!includesLike(r.base, filters.base)) return false;
    if(!includesLike(r.name, filters.name)) return false;
    return true;
  }).sort((a,b)=> String(b.at).localeCompare(String(a.at)));

  const dailyHit = dailyAll.filter(r=>{
    if(filters.from || filters.to){
      if(!inRange(r.date, filters.from, filters.to)) return false;
    }
    if(!includesLike(r.base, filters.base)) return false;
    if(!includesLike(r.name, filters.name)) return false;
    return true;
  }).sort((a,b)=> String(b.date).localeCompare(String(a.date)));

  return { tenkoHit, dailyHit };
}

/* ==============================
   Monthly grouping（核心）
============================== */
async function searchMonthly(filters){
  const { tenkoHit, dailyHit } = await searchRecords(filters);

  // name + base 単位でまとめる
  const groups = new Map();

  function ensureGroup(name, base){
    const key = `${name}__${base}`;
    if(!groups.has(key)){
      groups.set(key, {
        name,
        base,
        tenko: [],
        daily: []
      });
    }
    return groups.get(key);
  }

  tenkoHit.forEach(t=>{
    ensureGroup(t.name, t.base).tenko.push(t);
  });

  dailyHit.forEach(d=>{
    ensureGroup(d.name, d.base).daily.push(d);
  });

  // 日付順に整理 + 出発帰着ペアリング
  for(const g of groups.values()){
    g.tenko.sort((a,b)=> String(a.at).localeCompare(String(b.at)));
    g.daily.sort((a,b)=> String(a.date).localeCompare(String(b.date)));

    // date -> {dep, arr}
    const byDate = new Map();
    g.tenko.forEach(t=>{
      const d = normalizeDate(t.at);
      if(!byDate.has(d)) byDate.set(d, {dep:null, arr:null});
      if(t.type === "departure") byDate.get(d).dep = t;
      if(t.type === "arrival")   byDate.get(d).arr = t;
    });

    g.byDate = byDate;

    // 走行距離合計
    let totalKm = 0;
    for(const pair of byDate.values()){
      const km = safeNum(pair.arr?.odoEnd) - safeNum(pair.dep?.odoStart);
      if(km > 0) totalKm += km;
    }
    g.totalKm = totalKm;
  }

  return Array.from(groups.values());
}

/* ==============================
   Expose (global)
============================== */
window.OFA_DB = {
  idbOpen,
  idbPut,
  idbGet,
  idbDelete,
  idbGetAll,
  saveTenko,
  saveDaily,
  searchRecords,
  searchMonthly,
  normalizeDate,
  safeNum
};
