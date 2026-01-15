// js/db.js
// IndexedDB wrapper (1000件超対応)

const OFA_DB_NAME = "ofa_nippou_db";
const OFA_DB_VER = 1;

const STORE_PROFILE = "profile";
const STORE_TENKO   = "tenko";
const STORE_DAILY   = "daily";

function idbOpen(){
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(OFA_DB_NAME, OFA_DB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;

      if(!db.objectStoreNames.contains(STORE_PROFILE)){
        db.createObjectStore(STORE_PROFILE, { keyPath:"id" }); // id = "me"
      }
      if(!db.objectStoreNames.contains(STORE_TENKO)){
        const st = db.createObjectStore(STORE_TENKO, { keyPath:"id" });
        st.createIndex("by_at", "at", { unique:false });
        st.createIndex("by_name", "name", { unique:false });
        st.createIndex("by_base", "base", { unique:false });
        st.createIndex("by_type", "type", { unique:false });
      }
      if(!db.objectStoreNames.contains(STORE_DAILY)){
        const sd = db.createObjectStore(STORE_DAILY, { keyPath:"id" });
        sd.createIndex("by_date", "date", { unique:false });
        sd.createIndex("by_name", "name", { unique:false });
        sd.createIndex("by_base", "base", { unique:false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbPut(storeName, value){
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).put(value);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

async function idbGet(storeName, key){
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const req = tx.objectStore(storeName).get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function idbDelete(storeName, key){
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).delete(key);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

async function idbGetAll(storeName){
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

function normalizeDate(d){
  // input: "2026-01-14" or "2026-01-14T15:28"
  if(!d) return "";
  return String(d).slice(0,10);
}

function inRange(dateStr, fromStr, toStr){
  const d = normalizeDate(dateStr);
  const f = fromStr ? normalizeDate(fromStr) : "";
  const t = toStr ? normalizeDate(toStr) : "";
  if(!d) return false;
  if(f && d < f) return false;
  if(t && d > t) return false;
  return true;
}

function includesLike(hay, needle){
  if(!needle) return true;
  return String(hay || "").toLowerCase().includes(String(needle).toLowerCase());
}

// Search tenko + daily by filters
async function searchRecords(filters){
  const tenko = await idbGetAll(STORE_TENKO);
  const daily = await idbGetAll(STORE_DAILY);

  const tenkoHit = tenko.filter(r => {
    if(filters.from || filters.to){
      if(!inRange(r.at, filters.from, filters.to)) return false;
    }
    if(!includesLike(r.base, filters.base)) return false;
    if(!includesLike(r.name, filters.name)) return false;
    return true;
  }).sort((a,b)=> String(b.at).localeCompare(String(a.at)));

  const dailyHit = daily.filter(r => {
    if(filters.from || filters.to){
      if(!inRange(r.date, filters.from, filters.to)) return false;
    }
    if(!includesLike(r.base, filters.base)) return false;
    if(!includesLike(r.name, filters.name)) return false;
    return true;
  }).sort((a,b)=> String(b.date).localeCompare(String(a.date)));

  return { tenkoHit, dailyHit };
}

// For monthly report: gather by person/base within range
async function searchMonthly(filters){
  const { tenkoHit, dailyHit } = await searchRecords(filters);

  // Map daily by date
  const dailyByDate = new Map();
  dailyHit.forEach(d => dailyByDate.set(normalizeDate(d.date), d));

  // group by (name|base)
  const groups = new Map();
  tenkoHit.forEach(t => {
    const key = `${t.name}__${t.base}`;
    if(!groups.has(key)) groups.set(key, { name:t.name, base:t.base, tenko:[], daily:[] });
    groups.get(key).tenko.push(t);
  });
  dailyHit.forEach(d => {
    const key = `${d.name}__${d.base}`;
    if(!groups.has(key)) groups.set(key, { name:d.name, base:d.base, tenko:[], daily:[] });
    groups.get(key).daily.push(d);
  });

  // sort inside group
  for(const g of groups.values()){
    g.tenko.sort((a,b)=> String(a.at).localeCompare(String(b.at)));
    g.daily.sort((a,b)=> String(a.date).localeCompare(String(b.date)));
  }

  return Array.from(groups.values());
}
