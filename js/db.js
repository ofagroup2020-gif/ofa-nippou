// js/db.js
// IndexedDB wrapper (Driver + Admin 共通)
// DB名/Store名は固定（互換維持）

(function(){
  "use strict";

  const DB_NAME = "ofa_nippou_db";
  const DB_VER  = 1;

  const STORES = {
    profile: "profile", // key: "me"
    tenko:   "tenko",   // keyPath: "id" autoIncrement
    daily:   "daily",   // keyPath: "id" autoIncrement
  };

  function openDb(){
    return new Promise((resolve, reject)=>{
      const req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = (ev)=>{
        const db = req.result;

        if(!db.objectStoreNames.contains(STORES.profile)){
          db.createObjectStore(STORES.profile, { keyPath: "key" });
        }
        if(!db.objectStoreNames.contains(STORES.tenko)){
          db.createObjectStore(STORES.tenko, { keyPath: "id", autoIncrement: true });
        }
        if(!db.objectStoreNames.contains(STORES.daily)){
          db.createObjectStore(STORES.daily, { keyPath: "id", autoIncrement: true });
        }
      };
      req.onsuccess = ()=> resolve(req.result);
      req.onerror   = ()=> reject(req.error);
    });
  }

  async function tx(store, mode="readonly"){
    const db = await openDb();
    return db.transaction(store, mode).objectStore(store);
  }

  async function put(store, value){
    const os = await tx(store, "readwrite");
    return new Promise((resolve, reject)=>{
      const req = os.put(value);
      req.onsuccess = ()=> resolve(req.result);
      req.onerror = ()=> reject(req.error);
    });
  }

  async function add(store, value){
    const os = await tx(store, "readwrite");
    return new Promise((resolve, reject)=>{
      const req = os.add(value);
      req.onsuccess = ()=> resolve(req.result);
      req.onerror = ()=> reject(req.error);
    });
  }

  async function get(store, key){
    const os = await tx(store, "readonly");
    return new Promise((resolve, reject)=>{
      const req = os.get(key);
      req.onsuccess = ()=> resolve(req.result || null);
      req.onerror = ()=> reject(req.error);
    });
  }

  async function del(store, key){
    const os = await tx(store, "readwrite");
    return new Promise((resolve, reject)=>{
      const req = os.delete(key);
      req.onsuccess = ()=> resolve(true);
      req.onerror = ()=> reject(req.error);
    });
  }

  async function clear(store){
    const os = await tx(store, "readwrite");
    return new Promise((resolve, reject)=>{
      const req = os.clear();
      req.onsuccess = ()=> resolve(true);
      req.onerror = ()=> reject(req.error);
    });
  }

  async function getAll(store){
    const os = await tx(store, "readonly");
    return new Promise((resolve, reject)=>{
      const req = os.getAll();
      req.onsuccess = ()=> resolve(req.result || []);
      req.onerror = ()=> reject(req.error);
    });
  }

  // helper
  function nowIso(){
    return new Date().toISOString();
  }

  function normalizePhone(p){
    return String(p || "").replace(/[^0-9]/g, "");
  }

  // expose
  window.OFADB = {
    DB_NAME, DB_VER, STORES,
    openDb, put, add, get, del, clear, getAll,
    nowIso, normalizePhone
  };
})();
