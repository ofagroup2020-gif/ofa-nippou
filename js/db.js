// js/db.js
// OFA 点呼・日報 IndexedDB 管理
// ・Driver / Admin 共通
// ・端末内保存のみ（サーバー送信なし）
// ・Chrome / Safari 対応

"use strict";

/* =========================
   DB 定義
========================= */
const OFA_DB_NAME = "ofa_nippou_db";
const OFA_DB_VERSION = 1;

// store 名
const STORE_PROFILE = "profile"; // 基本情報（1件）
const STORE_TENKO   = "tenko";   // 出発 / 帰着 点呼
const STORE_DAILY   = "daily";   // 日報

/* =========================
   DB Open
========================= */
function openDb(){
  return new Promise((resolve, reject)=>{
    const req = indexedDB.open(OFA_DB_NAME, OFA_DB_VERSION);

    req.onupgradeneeded = (e)=>{
      const db = e.target.result;

      // profile（1件想定）
      if(!db.objectStoreNames.contains(STORE_PROFILE)){
        db.createObjectStore(STORE_PROFILE, { keyPath: "id" });
      }

      // tenko（複数）
      if(!db.objectStoreNames.contains(STORE_TENKO)){
        const store = db.createObjectStore(STORE_TENKO, {
          keyPath: "id",
          autoIncrement: true
        });
        store.createIndex("at", "at", { unique:false });
        store.createIndex("name", "name", { unique:false });
        store.createIndex("base", "base", { unique:false });
      }

      // daily（複数）
      if(!db.objectStoreNames.contains(STORE_DAILY)){
        const store = db.createObjectStore(STORE_DAILY, {
          keyPath: "id",
          autoIncrement: true
        });
        store.createIndex("date", "date", { unique:false });
        store.createIndex("name", "name", { unique:false });
        store.createIndex("base", "base", { unique:false });
      }
    };

    req.onsuccess = ()=> resolve(req.result);
    req.onerror   = ()=> reject(req.error);
  });
}

/* =========================
   汎用 Helper
========================= */
async function withStore(storeName, mode, callback){
  const db = await openDb();
  return new Promise((resolve, reject)=>{
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const res = callback(store);
    tx.oncomplete = ()=> resolve(res);
    tx.onerror    = ()=> reject(tx.error);
  });
}

/* =========================
   Profile（基本情報）
========================= */
async function saveProfile(profile){
  profile.id = "singleton"; // 常に1件
  profile.updatedAt = new Date().toISOString();
  return withStore(STORE_PROFILE, "readwrite", store=>{
    store.put(profile);
  });
}

async function loadProfile(){
  return withStore(STORE_PROFILE, "readonly", store=>{
    return new Promise((resolve)=>{
      const req = store.get("singleton");
      req.onsuccess = ()=> resolve(req.result || null);
      req.onerror   = ()=> resolve(null);
    });
  });
}

/* =========================
   Tenko（点呼）
========================= */
async function addTenko(data){
  data.createdAt = new Date().toISOString();
  return withStore(STORE_TENKO, "readwrite", store=>{
    store.add(data);
  });
}

async function getAllTenko(){
  return withStore(STORE_TENKO, "readonly", store=>{
    return new Promise(resolve=>{
      const req = store.getAll();
      req.onsuccess = ()=> resolve(req.result || []);
      req.onerror   = ()=> resolve([]);
    });
  });
}

async function deleteTenko(id){
  return withStore(STORE_TENKO, "readwrite", store=>{
    store.delete(id);
  });
}

async function clearTenko(){
  return withStore(STORE_TENKO, "readwrite", store=>{
    store.clear();
  });
}

/* =========================
   Daily（日報）
========================= */
async function addDaily(data){
  data.createdAt = new Date().toISOString();
  return withStore(STORE_DAILY, "readwrite", store=>{
    store.add(data);
  });
}

async function getAllDaily(){
  return withStore(STORE_DAILY, "readonly", store=>{
    return new Promise(resolve=>{
      const req = store.getAll();
      req.onsuccess = ()=> resolve(req.result || []);
      req.onerror   = ()=> resolve([]);
    });
  });
}

async function deleteDaily(id){
  return withStore(STORE_DAILY, "readwrite", store=>{
    store.delete(id);
  });
}

async function clearDaily(){
  return withStore(STORE_DAILY, "readwrite", store=>{
    store.clear();
  });
}

/* =========================
   全削除（注意）
========================= */
async function clearAll(){
  await clearTenko();
  await clearDaily();
  return true;
}

/* =========================
   検索（期間・拠点・氏名・電話）
   ※ Admin / Driver 共通で使える
========================= */
function includesPartial(hay, needle){
  if(!needle) return true;
  return String(hay || "").includes(String(needle));
}

function parseDateSafe(v){
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

async function searchRecords({ start, end, base, name, phone }){
  const d0 = start ? new Date(start + "T00:00:00") : null;
  const d1 = end   ? new Date(end   + "T23:59:59") : null;

  const [tenkoAll, dailyAll] = await Promise.all([
    getAllTenko(),
    getAllDaily()
  ]);

  const tenko = tenkoAll.filter(t=>{
    const dt = parseDateSafe(t.at);
    if(d0 && dt && dt < d0) return false;
    if(d1 && dt && dt > d1) return false;
    if(!includesPartial(t.base, base)) return false;
    if(!includesPartial(t.name, name)) return false;
    if(!includesPartial(t.phone, phone)) return false;
    return true;
  });

  const daily = dailyAll.filter(r=>{
    const dt = parseDateSafe(r.date || r.createdAt);
    if(d0 && dt && dt < d0) return false;
    if(d1 && dt && dt > d1) return false;
    if(!includesPartial(r.base, base)) return false;
    if(!includesPartial(r.name, name)) return false;
    if(!includesPartial(r.phone, phone)) return false;
    return true;
  });

  return { tenko, daily };
}

/* =========================
   expose（グローバル）
========================= */
window.dbApi = {
  // profile
  saveProfile,
  loadProfile,

  // tenko
  addTenko,
  getAllTenko,
  deleteTenko,
  clearTenko,

  // daily
  addDaily,
  getAllDaily,
  deleteDaily,
  clearDaily,

  // util
  clearAll,
  searchRecords,
};
