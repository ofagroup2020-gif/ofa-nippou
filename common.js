// common.js
(function(){
  const CFG = window.OFA_CONFIG || {};
  const KEY = "ofa_auth_mode"; // "driver" | "admin"
  const KEYT = "ofa_auth_time";
  const TTL_HOURS = 24; // 24時間でログイン切れ

  function now(){ return Date.now(); }

  function toast(msg){
    const el = document.getElementById("toast");
    if(!el){ alert(msg); return; }
    el.textContent = msg;
    el.classList.add("show");
    setTimeout(()=>el.classList.remove("show"), 2200);
  }

  function setAuth(mode){
    localStorage.setItem(KEY, mode);
    localStorage.setItem(KEYT, String(now()));
  }

  function clearAuth(){
    localStorage.removeItem(KEY);
    localStorage.removeItem(KEYT);
  }

  function getAuth(){
    const mode = localStorage.getItem(KEY);
    const t = Number(localStorage.getItem(KEYT) || "0");
    if(!mode) return null;
    if(!t || (now()-t) > TTL_HOURS*3600*1000){
      clearAuth();
      return null;
    }
    return mode;
  }

  function requireAuth(need){
    const mode = getAuth();
    if(!mode) location.href = "./index.html";
    if(need && mode !== need) location.href = "./index.html";
  }

  // 画像を縮小して base64 化（任意写真用）
  async function fileToDataURLResized(file, maxW=1280, quality=0.82){
    if(!file) return "";
    const dataUrl = await new Promise((res, rej)=>{
      const r = new FileReader();
      r.onload = ()=>res(String(r.result));
      r.onerror = rej;
      r.readAsDataURL(file);
    });

    // 画像以外はそのまま
    if(!/^data:image\//.test(dataUrl)) return dataUrl;

    const img = await new Promise((res, rej)=>{
      const i = new Image();
      i.onload = ()=>res(i);
      i.onerror = rej;
      i.src = dataUrl;
    });

    const scale = Math.min(1, maxW / img.width);
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);

    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0, w, h);

    return c.toDataURL("image/jpeg", quality);
  }

  function ymd(d){
    const z = (n)=>String(n).padStart(2,"0");
    return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}`;
  }
  function hm(d){
    const z = (n)=>String(n).padStart(2,"0");
    return `${z(d.getHours())}:${z(d.getMinutes())}`;
  }

  function setNowDateTime(dateId, timeId){
    const d = new Date();
    const dateEl = document.getElementById(dateId);
    const timeEl = document.getElementById(timeId);
    if(dateEl && !dateEl.value) dateEl.value = ymd(d);
    if(timeEl && !timeEl.value) timeEl.value = hm(d);
  }

  // ▼ CORSが起きない送信（hidden iframe + form POST）
  function postViaIframe(fields){
    return new Promise((resolve, reject)=>{
      const url = (CFG.WEBAPP_URL || "").trim();
      if(!url) return reject(new Error("WEBAPP_URL未設定"));

      // 既存を掃除
      const old = document.getElementById("ofaHiddenFrame");
      if(old) old.remove();
      const oldF = document.getElementById("ofaHiddenForm");
      if(oldF) oldF.remove();

      const iframe = document.createElement("iframe");
      iframe.name = "ofaHiddenFrame";
      iframe.id = "ofaHiddenFrame";
      iframe.style.display = "none";
      document.body.appendChild(iframe);

      const form = document.createElement("form");
      form.id = "ofaHiddenForm";
      form.method = "POST";
      form.action = url;
      form.target = "ofaHiddenFrame";
      form.enctype = "application/x-www-form-urlencoded";

      Object.keys(fields).forEach((k)=>{
        const inp = document.createElement("input");
        inp.type = "hidden";
        inp.name = k;
        inp.value = fields[k] == null ? "" : String(fields[k]);
        form.appendChild(inp);
      });

      document.body.appendChild(form);

      const timer = setTimeout(()=>{
        cleanup();
        reject(new Error("timeout"));
      }, 20000);

      function cleanup(){
        clearTimeout(timer);
        window.removeEventListener("message", onMsg);
      }

      function onMsg(ev){
        // Apps Script側が postMessage する
        if(!ev || !ev.data) return;
        if(ev.data.__ofa !== true) return;
        cleanup();
        if(ev.data.ok){
          resolve(ev.data);
        }else{
          reject(new Error(ev.data.error || "server_error"));
        }
      }

      window.addEventListener("message", onMsg);
      form.submit();
    });
  }

  // 文字の必須チェック
  function must(v){ return (v ?? "").toString().trim().length > 0; }

  window.OFA = {
    CFG,
    toast,
    setAuth,
    getAuth,
    clearAuth,
    requireAuth,
    setNowDateTime,
    fileToDataURLResized,
    postViaIframe,
    must
  };
})();
