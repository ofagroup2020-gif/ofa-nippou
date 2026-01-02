/****************************************************
 * OFA 点呼システム app.js（反応しない問題を潰した版）
 ****************************************************/

const GAS_WEBAPP_URL =
  "https://script.google.com/macros/s/AKfycby36HAYkaJwC3K6-8LogpFZ56iplXwvrp38IskarnrLZrHguoCzeOGLSB-S3Kcjo_Uf_w/exec";

const APP_KEY = "OFA_TENKO";
const ADMIN_PASS = "ofa-2026";

function $(id){ return document.getElementById(id); }

function toast(msg, ok=false){
  const el = $("toast");
  if(!el){ alert(msg); return; }
  el.textContent = msg;
  el.className = "toast " + (ok ? "ok":"ng");
  el.style.display = "block";
  setTimeout(()=> el.style.display="none", 2200);
}

// ✅ 管理者フラグを保存
function setAdmin(enabled){
  localStorage.setItem("ofa_admin", enabled ? "1" : "0");
}
function isAdmin(){
  return localStorage.getItem("ofa_admin")==="1";
}

function initIndexPage(){
  const on = $("btnAdminOn");
  const off = $("btnAdminOff");
  const pass = $("adminPass");
  if(on){
    on.addEventListener("click", ()=>{
      const v = (pass?.value||"").trim();
      if(v !== ADMIN_PASS){
        setAdmin(false);
        toast("管理者パスワードが違います");
        return;
      }
      setAdmin(true);
      toast("管理者モードON", true);
    });
  }
  if(off){
    off.addEventListener("click", ()=>{
      setAdmin(false);
      toast("管理者モードOFF", true);
      if(pass) pass.value="";
    });
  }
}

window.addEventListener("DOMContentLoaded", ()=>{
  // ✅ data-page無しでも、要素があれば必ず初期化
  if($("btnAdminOn") || $("btnAdminOff") || $("adminPass")) initIndexPage();

  // ここに departure / arrival / export の初期化を今後追加していく（必要ならこちらで統合）
});
