// js/db.js
// OFA 点呼/日報 IndexedDB（統一版）
// - DB名: ofa_nippou_db / ver:1
// - stores: profile(固定1件), tenko(履歴), daily(履歴)
// - tenko/daily には必ず name/base/phone をコピーして保存（検索安定）
// - 個別削除 / 全削除 / 取得APIを window.OFA_DB に公開

(function(){
  "use strict";

  const DB_NAME = "ofa_nippou_db";
  const DB_VER  = 1;

  const STORE_PROFILE = "profile"; // id固定: "default"
  const STORE_TENKO   = "tenko";   // keyPath: "id" autoIncrement
  const STORE_DAILY   = "daily";   // keyPath: "id" autoIncrement

  const PROFILE_ID = "default";

  const nowIso = ()=> new Date().toISOString();

  function normalizePhone(s){
    return String(s || "")
      .replaceAll("-", "")
      .replaceAll(" ", "")
      .replaceAll("　", "")
      .trim();
  }

  function safeObj(x){
    return (x && typeof x === "object") ? x : {};
  }

  function cloneJson(x){
    return JSON.parse(JSON.stringify(x ?? null));
  }

  function openDb(){
    return new Promise((resolve, reject)=>{
      const req = indexedDB.open(DB_NAME, DB_VER);

      req.onupgradeneeded = (e)=>{
        const db = req.result;

        // profile（固定）
        if(!db.objectStoreNames.contains(STORE_PROFILE)){
          const s = db.createObjectStore(STORE_PROFILE, { keyPath:"id" });
          s.createIndex("updatedAt","updatedAt",{unique:false});
        }

        // tenko（履歴）
        if(!db.objectStoreNames.contains(STORE_TENKO)){
          const s = db.createObjectStore(STORE_TENKO, { keyPath:"id", autoIncrement:true });
          s.createIndex("at","at",{unique:false});
          s.createIndex("date","date",{unique:false});   // YYYY-MM-DD
          s.createIndex("name","name",{unique:false});
          s.createIndex("base","base",{unique:false});
          s.createIndex("phone","phone",{unique:false});
          s.createIndex("type","type",{unique:false});   // "dep"/"arr" 推奨
        }

        // daily（履歴）
        if(!db.objectStoreNames.contains(STORE_DAILY)){
          const s = db.createObjectStore(STORE_DAILY, { keyPath:"id", autoIncrement:true });
          s.createIndex("date","date",{unique:false});   // YYYY-MM-DD
          s.createIndex("name","name",{unique:false});
          s.createIndex("base","base",{unique:false});
          s.createIndex("phone","phone",{unique:false});
          s.createIndex("updatedAt","updatedAt",{unique:false});
        }
      };

      req.onsuccess = ()=> resolve(req.result);
      req.onerror = ()=> reject(req.error);
    });
  }

  async function withStore(storeName, mode, fn){
    const db = await openDb();
    return new Promise((resolve, reject)=>{
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);

      let out;
      try { out = fn(store, tx); }
      catch(err){ reject(err); return; }

      tx.oncomplete = ()=> resolve(out);
      tx.onerror = ()=> reject(tx.error);
      tx.onabort = ()=> reject(tx.error);
    });
  }

  async function getProfile(){
    return await withStore(STORE_PROFILE, "readonly", (store)=>{
      return new Promise((resolve, reject)=>{
        const req = store.get(PROFILE_ID);
        req.onsuccess = ()=> resolve(req.result || null);
        req.onerror = ()=> reject(req.error);
      });
    });
  }

  async function saveProfile(profile){
    const p = safeObj(profile);
    const data = {
      id: PROFILE_ID,
      name: (p.name || "").trim(),
      base: (p.base || "").trim(),
      carNo: (p.carNo || "").trim(),
      licenseNo: (p.licenseNo || "").trim(),
      phone: (p.phone || "").trim(),
      phoneN: normalizePhone(p.phone || ""),
      email: (p.email || "").trim(),
      updatedAt: nowIso(),
      createdAt: p.createdAt || nowIso(),
    };

    await withStore(STORE_PROFILE, "readwrite", (store)=>{
      store.put(data);
    });
    return data;
  }

  // tenko/daily 保存時に profile を必ず付与（検索の安定化）
  function attachProfileMeta(record, profile){
    const r = safeObj(record);
    const p = safeObj(profile);

    const name = (r.name || p.name || "").trim();
    const base = (r.base || p.base || "").trim();
    const phone = (r.phone || p.phone || "").trim();

    return {
      ...cloneJson(r),
      name,
      base,
      phone,
      phoneN: normalizePhone(phone),
      carNo: (r.carNo || p.carNo || "").trim(),
      licenseNo: (r.licenseNo || p.licenseNo || "").trim(),
      email: (r.email || p.email || "").trim(),
    };
  }

  function ymdFromAt(at){
    if(!at) return "";
    // "2026-01-24T12:34" / ISO / etc.
    return String(at).slice(0,10);
  }

  async function addTenko(tenko, profile){
    const t0 = attachProfileMeta(tenko, profile);

    // 統一フィールド（type）
    // - driver側UIの都合で dep/arr どっちでも受ける
    let type = (t0.type || "").trim();
    if(type === "departure") type = "dep";
    if(type === "arrival") type = "arr";
    if(!type){
      // 既存互換: "dep"/"arr" 以外なら推測しない（空でOK）
      type = "dep";
    }

    const at = t0.at || t0.datetime || nowIso();

    const data = {
      ...t0,
      type,
      at,
      date: ymdFromAt(at),

      // 監査用
      createdAt: t0.createdAt || nowIso(),
      updatedAt: nowIso(),
    };

    const id = await withStore(STORE_TENKO, "readwrite", (store)=>{
      return new Promise((resolve, reject)=>{
        const req = store.add(data);
        req.onsuccess = ()=> resolve(req.result);
        req.onerror = ()=> reject(req.error);
      });
    });

    data.id = id;
    return data;
  }

  async function addDaily(daily, profile){
    const d0 = attachProfileMeta(daily, profile);

    const date = (d0.date || "").trim() || ymdFromAt(d0.at || d0.createdAt || nowIso());
    const data = {
      ...d0,
      date,

      createdAt: d0.createdAt || nowIso(),
      updatedAt: nowIso(),
    };

    const id = await withStore(STORE_DAILY, "readwrite", (store)=>{
      return new Promise((resolve, reject)=>{
        const req = store.add(data);
        req.onsuccess = ()=> resolve(req.result);
        req.onerror = ()=> reject(req.error);
      });
    });

    data.id = id;
    return data;
  }

  async function getAllTenko(){
    return await withStore(STORE_TENKO, "readonly", (store)=>{
      return new Promise((resolve, reject)=>{
        const req = store.getAll();
        req.onsuccess = ()=> resolve(req.result || []);
        req.onerror = ()=> reject(req.error);
      });
    });
  }

  async function getAllDaily(){
    return await withStore(STORE_DAILY, "readonly", (store)=>{
      return new Promise((resolve, reject)=>{
        const req = store.getAll();
        req.onsuccess = ()=> resolve(req.result || []);
        req.onerror = ()=> reject(req.error);
      });
    });
  }

  async function deleteTenkoById(id){
    if(id === undefined || id === null) return false;
    await withStore(STORE_TENKO, "readwrite", (store)=> store.delete(Number(id)));
    return true;
  }

  async function deleteDailyById(id){
    if(id === undefined || id === null) return false;
    await withStore(STORE_DAILY, "readwrite", (store)=> store.delete(Number(id)));
    return true;
  }

  async function clearStore(storeName){
    await withStore(storeName, "readwrite", (store)=> store.clear());
  }

  async function clearAll(){
    await Promise.all([
      clearStore(STORE_TENKO),
      clearStore(STORE_DAILY),
      // profile は残す運用でもいいが、全削除ボタンの期待に合わせて消す
      clearStore(STORE_PROFILE),
    ]);
    return true;
  }

  // 既存データに name/base/phone が無い古いデータがあっても、
  // 「新規保存分は必ず入る」ので検索が徐々に安定する。
  // 必要なら将来ここで migration を追加可能。

  // ===== 公開API =====
  window.OFA_DB = {
    DB_NAME,
    DB_VER,
    STORE_PROFILE,
    STORE_TENKO,
    STORE_DAILY,

    normalizePhone,

    getProfile,
    saveProfile,

    addTenko,
    addDaily,

    getAllTenko,
    getAllDaily,

    deleteTenkoById,
    deleteDailyById,

    clearAll,
  };

})();
