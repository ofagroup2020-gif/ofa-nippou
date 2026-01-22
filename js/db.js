// js/db.js
// IndexedDB wrapper（1000件超対応）
// - profile / tenko / daily を保存
// - 検索（期間・拠点・氏名）
// - 月報用グルーピング（氏名×拠点）
// ※ 管理者ページ（admin）でも同じDBを参照します（同一オリジン内）
//
// 使い方例：
//   await idbPut(STORE_TENKO, record)
//   const me = await idbGet(STORE_PROFILE, "me")
//   const {tenkoHit, dailyHit} = await searchRecords({from,to,base,name})
//   const groups = await searchMonthly({from,to,base,name})

const OFA_DB_NAME = "ofa_nippou_db";
const OFA_DB_VER  = 1;

const STORE_PROFILE = "profile"; // key: "me"
const STORE_TENKO   = "tenko";   // key: id
const STORE_DAILY   = "daily";   // key: id

function idbOpen(){
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(OFA_DB_NAME, OFA_DB_VER);

    req.onupgradeneeded = () => {
      const db = req.result;

      // profile
      if(!db.objectStoreNames.contains(STORE_PROFILE)){
        db.createObjectStore(STORE_PROFILE, { keyPath:"id" }); // id = "me"
      }

      // tenko
      if(!db.objectStoreNames.contains(STORE_TENKO)){
        const st = db.createObjectStore(STORE_TENKO, { keyPath:"id" });
        st.createIndex("by_at",   "at",   { unique:false });
        st.createIndex("by_name", "name", { unique:false });
        st.createIndex("by_base", "base", { unique:false });
        st.createIndex("by_type", "type", { unique:false }); // departure / arrival
      }

      // daily
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

async function idbPut(storeName, value){
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).put(value);
    tx.oncomplete = () => resolve(true);
    tx.onerror    = () => reject(tx.error);
  });
}

async function idbGet(storeName, key){
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const req = tx.objectStore(storeName).get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror   = () => reject(req.error);
  });
}

async function idbDelete(storeName, key){
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).delete(key);
    tx.oncomplete = () => resolve(true);
    tx.onerror    = () => reject(tx.error);
  });
}

async function idbGetAll(storeName){
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror   = () => reject(req.error);
  });
}

// ------------------------------------
// Utils
// ------------------------------------
function normalizeDate(d){
  // input: "2026-01-14" or "2026-01-14T15:28"
  if(!d) return "";
  return String(d).slice(0,10);
}

function inRange(dateStr, fromStr, toStr){
  const d = normalizeDate(dateStr);
  const f = fromStr ? normalizeDate(fromStr) : "";
  const t = toStr   ? normalizeDate(toStr)   : "";
  if(!d) return false;
  if(f && d < f) return false;
  if(t && d > t) return false;
  return true;
}

function includesLike(hay, needle){
  if(!needle) return true;
  return String(hay || "").toLowerCase().includes(String(needle).toLowerCase());
}

// ------------------------------------
// Search: tenko + daily
// filters: {from,to,base,name}
// ------------------------------------
async function searchRecords(filters){
  const f = filters || {};
  const tenko = await idbGetAll(STORE_TENKO);
  const daily = await idbGetAll(STORE_DAILY);

  const tenkoHit = (tenko || []).filter(r => {
    if((f.from || f.to) && !inRange(r.at, f.from, f.to)) return false;
    if(!includesLike(r.base, f.base)) return false;
    if(!includesLike(r.name, f.name)) return false;
    return true;
  }).sort((a,b)=> String(b.at).localeCompare(String(a.at)));

  const dailyHit = (daily || []).filter(r => {
    if((f.from || f.to) && !inRange(r.date, f.from, f.to)) return false;
    if(!includesLike(r.base, f.base)) return false;
    if(!includesLike(r.name, f.name)) return false;
    return true;
  }).sort((a,b)=> String(b.date).localeCompare(String(a.date)));

  return { tenkoHit, dailyHit };
}

// ------------------------------------
// Monthly: group by name+base within range
// returns [{name,base,tenko:[],daily:[]}...]
// ------------------------------------
async function searchMonthly(filters){
  const { tenkoHit, dailyHit } = await searchRecords(filters || {});

  const groups = new Map();

  (tenkoHit || []).forEach(t => {
    const key = `${t.name}__${t.base}`;
    if(!groups.has(key)) groups.set(key, { name:t.name, base:t.base, tenko:[], daily:[] });
    groups.get(key).tenko.push(t);
  });

  (dailyHit || []).forEach(d => {
    const key = `${d.name}__${d.base}`;
    if(!groups.has(key)) groups.set(key, { name:d.name, base:d.base, tenko:[], daily:[] });
    groups.get(key).daily.push(d);
  });

  // sort inside group
  for(const g of groups.values()){
    g.tenko.sort((a,b)=> String(a.at).localeCompare(String(b.at)));   // asc
    g.daily.sort((a,b)=> String(a.date).localeCompare(String(b.date))); // asc
  }

  return Array.from(groups.values());
}

// ------------------------------------
// Expose (browser global)
// ------------------------------------
window.OFA_DB_NAME = OFA_DB_NAME;
window.OFA_DB_VER  = OFA_DB_VER;

window.STORE_PROFILE = STORE_PROFILE;
window.STORE_TENKO   = STORE_TENKO;
window.STORE_DAILY   = STORE_DAILY;

window.idbOpen    = idbOpen;
window.idbPut     = idbPut;
window.idbGet     = idbGet;
window.idbDelete  = idbDelete;
window.idbGetAll  = idbGetAll;

window.normalizeDate = normalizeDate;
window.inRange       = inRange;
window.includesLike  = includesLike;

window.searchRecords = searchRecords;
window.searchMonthly = searchMonthly;
