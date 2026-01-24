// js/db.js
// OFA 点呼/日報 IndexedDB（端末内）
// - DB名: ofa_nippou_db / ver: 1
// - store: profile(1件想定), tenko(出発/帰着), daily(日報)
// - admin検索が使う: tenko / daily を必ず維持

(() => {
  "use strict";

  const DB_NAME = "ofa_nippou_db";
  const DB_VER  = 1;

  const STORE_PROFILE = "profile";
  const STORE_TENKO   = "tenko";
  const STORE_DAILY   = "daily";

  function openDb(){
    return new Promise((resolve, reject)=>{
      const req = indexedDB.open(DB_NAME, DB_VER);

      req.onupgradeneeded = (e)=>{
        const db = req.result;

        // profile
        if(!db.objectStoreNames.contains(STORE_PROFILE)){
          db.createObjectStore(STORE_PROFILE, { keyPath: "id" }); // id固定 "me"
        }

        // tenko
        if(!db.objectStoreNames.contains(STORE_TENKO)){
          const st = db.createObjectStore(STORE_TENKO, { keyPath: "id", autoIncrement: true });
          st.createIndex("at", "at", { unique:false });
          st.createIndex("name", "name", { unique:false });
          st.createIndex("phone", "phone", { unique:false });
          st.createIndex("base", "base", { unique:false });
        }

        // daily
        if(!db.objectStoreNames.contains(STORE_DAILY)){
          const sd = db.createObjectStore(STORE_DAILY, { keyPath: "id", autoIncrement: true });
          sd.createIndex("date", "date", { unique:false });
          sd.createIndex("name", "name", { unique:false });
          sd.createIndex("phone", "phone", { unique:false });
          sd.createIndex("base", "base", { unique:false });
        }
      };

      req.onsuccess = ()=> resolve(req.result);
      req.onerror = ()=> reject(req.error);
    });
  }

  function txDone(tx){
    return new Promise((resolve, reject)=>{
      tx.oncomplete = ()=> resolve();
      tx.onerror = ()=> reject(tx.error);
      tx.onabort = ()=> reject(tx.error);
    });
  }

  async function put(storeName, value){
    const db = await openDb();
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).put(value);
    await txDone(tx);
    db.close();
    return true;
  }

  async function add(storeName, value){
    const db = await openDb();
    const tx = db.transaction(storeName, "readwrite");
    const req = tx.objectStore(storeName).add(value);
    const id = await new Promise((resolve, reject)=>{
      req.onsuccess = ()=> resolve(req.result);
      req.onerror = ()=> reject(req.error);
    });
    await txDone(tx);
    db.close();
    return id;
  }

  async function get(storeName, key){
    const db = await openDb();
    const tx = db.transaction(storeName, "readonly");
    const req = tx.objectStore(storeName).get(key);
    const res = await new Promise((resolve, reject)=>{
      req.onsuccess = ()=> resolve(req.result || null);
      req.onerror = ()=> reject(req.error);
    });
    db.close();
    return res;
  }

  async function getAll(storeName){
    const db = await openDb();
    const tx = db.transaction(storeName, "readonly");
    const req = tx.objectStore(storeName).getAll();
    const res = await new Promise((resolve, reject)=>{
      req.onsuccess = ()=> resolve(req.result || []);
      req.onerror = ()=> reject(req.error);
    });
    db.close();
    return res;
  }

  async function del(storeName, key){
    const db = await openDb();
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).delete(key);
    await txDone(tx);
    db.close();
    return true;
  }

  async function clear(storeName){
    const db = await openDb();
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).clear();
    await txDone(tx);
    db.close();
    return true;
  }

  // ------------------------------
  // API（windowへ）
  // ------------------------------
  async function saveProfile(profile){
    // id固定
    profile.id = "me";
    profile.updatedAt = new Date().toISOString();
    await put(STORE_PROFILE, profile);
    return true;
  }

  async function loadProfile(){
    return await get(STORE_PROFILE, "me");
  }

  async function addTenko(record){
    record.createdAt = new Date().toISOString();
    return await add(STORE_TENKO, record);
  }

  async function addDaily(record){
    record.createdAt = new Date().toISOString();
    return await add(STORE_DAILY, record);
  }

  async function allTenko(){
    return await getAll(STORE_TENKO);
  }

  async function allDaily(){
    return await getAll(STORE_DAILY);
  }

  async function deleteTenko(id){
    return await del(STORE_TENKO, Number(id));
  }

  async function deleteDaily(id){
    return await del(STORE_DAILY, Number(id));
  }

  async function clearAll(){
    await clear(STORE_TENKO);
    await clear(STORE_DAILY);
    // profile は残す（必要なら消すボタン別途）
    return true;
  }

  window.OFADB = {
    DB_NAME, DB_VER,
    STORE_PROFILE, STORE_TENKO, STORE_DAILY,
    saveProfile, loadProfile,
    addTenko, addDaily,
    allTenko, allDaily,
    deleteTenko, deleteDaily,
    clearAll,
  };
})();
