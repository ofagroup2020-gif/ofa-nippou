// /admin/js/db.js
// 管理者用 IndexedDB wrapper
// ドライバー側と同じDBを参照して「検索・月報集計」する
//
// 依存関数として admin.js / csv.js / pdf.js から呼ばれる：
// - searchRecords(filters)  => { tenkoHit, dailyHit }
// - searchMonthly(filters)  => groups[]
//
// filters: { from:"YYYY-MM-DD", to:"YYYY-MM-DD", base:"", name:"" }

const OFA_DB_NAME = "ofa_nippou_db";
const OFA_DB_VER  = 1;

const STORE_PROFILE = "profile";
const STORE_TENKO   = "tenko";
const STORE_DAILY   = "daily";

// ===== IndexedDB Open =====
function idbOpen(){
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(OFA_DB_NAME, OFA_DB_VER);

    // admin側は基本「読む」だけだが、DBが無い端末に入った時のために作成もできるようにしておく
    req.onupgradeneeded = () => {
      const db = req.result;

      if(!db.objectStoreNames.contains(STORE_PROFILE)){
        db.createObjectStore(STORE_PROFILE, { keyPath:"id" }); // id="me"
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
    req.onerror   = () => reject(req.error);
  });
}

// ===== Basic ops (adminでは主に読むだけ) =====
async function idbGetAll(storeName){
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror   = () => reject(req.error);
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

// ===== Helpers =====
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

function safeStr(v){ return String(v ?? ""); }

function sortDesc(a, b){
  // ISOに近い文字列を想定して降順
  return safeStr(b).localeCompare(safeStr(a));
}

// ===== Search: Tenko + Daily =====
async function searchRecords(filters){
  const f = filters || {};
  const tenko = await idbGetAll(STORE_TENKO);
  const daily = await idbGetAll(STORE_DAILY);

  const tenkoHit = (tenko || []).filter(r => {
    if((f.from || f.to) && !inRange(r.at, f.from, f.to)) return false;
    if(!includesLike(r.base, f.base)) return false;
    if(!includesLike(r.name, f.name)) return false;
    return true;
  }).sort((a,b)=> sortDesc(a.at, b.at));

  const dailyHit = (daily || []).filter(r => {
    if((f.from || f.to) && !inRange(r.date, f.from, f.to)) return false;
    if(!includesLike(r.base, f.base)) return false;
    if(!includesLike(r.name, f.name)) return false;
    return true;
  }).sort((a,b)=> sortDesc(a.date, b.date));

  return { tenkoHit, dailyHit };
}

// ===== Monthly grouping =====
// 月報は「入力」ではなく、点呼・日報データから集計して出す
async function searchMonthly(filters){
  const { tenkoHit, dailyHit } = await searchRecords(filters);

  // group by name+base
  const groups = new Map();

  (tenkoHit || []).forEach(t => {
    const key = `${t.name || ""}__${t.base || ""}`;
    if(!groups.has(key)){
      groups.set(key, { name: t.name || "", base: t.base || "", tenko: [], daily: [] });
    }
    groups.get(key).tenko.push(t);
  });

  (dailyHit || []).forEach(d => {
    const key = `${d.name || ""}__${d.base || ""}`;
    if(!groups.has(key)){
      groups.set(key, { name: d.name || "", base: d.base || "", tenko: [], daily: [] });
    }
    groups.get(key).daily.push(d);
  });

  // sort inside group（昇順で揃える：PDF内の時系列が綺麗）
  for(const g of groups.values()){
    g.tenko.sort((a,b)=> safeStr(a.at).localeCompare(safeStr(b.at)));
    g.daily.sort((a,b)=> safeStr(a.date).localeCompare(safeStr(b.date)));
  }

  // グループ一覧は「氏名→拠点」昇順
  const arr = Array.from(groups.values());
  arr.sort((a,b)=>{
    const na = `${a.name}__${a.base}`.toLowerCase();
    const nb = `${b.name}__${b.base}`.toLowerCase();
    return na.localeCompare(nb);
  });

  return arr;
}

// ====== Optional: expose for debugging (必要ならコンソールで見れる) ======
window.OFA_ADMIN_DB = {
  idbOpen,
  idbGetAll,
  idbGet,
  searchRecords,
  searchMonthly,
  normalizeDate,
  inRange
};
