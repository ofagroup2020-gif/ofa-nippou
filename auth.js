/****************************************************
 * auth.js - OFA 点呼システム（パスワード方式）
 ****************************************************/

const APP_KEY = "OFA_TENKO_V2";
const DRIVER_PASS = "202601";
const ADMIN_PASS  = "ofa-2026";

function $(id){ return document.getElementById(id); }

function toast(msg, ok=false){
  const el = $("toast");
  if(!el){ alert(msg); return; }
  el.textContent = msg;
  el.className = "toast " + (ok ? "ok":"ng");
  el.style.display = "block";
  setTimeout(()=> el.style.display="none", 2500);
}

function setSession(role){
  const s = { role, at: Date.now() };
  localStorage.setItem(APP_KEY, JSON.stringify(s));
}
function getSession(){
  try{
    return JSON.parse(localStorage.getItem(APP_KEY) || "null");
  }catch(e){ return null; }
}
function logout(){
  localStorage.removeItem(APP_KEY);
}

function requireLogin(allowAdmin=false){
  const s = getSession();
  if(!s || !s.role){
    location.href = "./index.html";
    return null;
  }
  if(!allowAdmin && s.role === "admin"){
    // adminは全ページ使えるが、ここでは特に制限しない
  }
  return s;
}

/* index.html 用 */
function initIndexAuth(){
  const pass = $("passcode");
  const btnDriver = $("btnDriverLogin");
  const btnAdmin = $("btnAdminLogin");
  const btnLogout = $("btnLogout");
  const badge = $("loginBadge");
  const menu = $("menuArea");
  const login = $("loginArea");

  const refreshUI = ()=>{
    const s = getSession();
    if(s && s.role){
      login.classList.add("hidden");
      menu.classList.remove("hidden");
      badge.textContent = (s.role==="admin") ? "管理者ログイン済" : "ドライバーログイン済";
      badge.className = "badge " + ((s.role==="admin") ? "admin":"driver");
      $("btnExport").textContent = (s.role==="admin") ? "PDF / 月報 / CSV（管理者）" : "PDF / 月報 / CSV（本人）";
    }else{
      menu.classList.add("hidden");
      login.classList.remove("hidden");
      badge.textContent = "未ログイン";
      badge.className = "badge";
    }
  };

  if(btnDriver){
    btnDriver.addEventListener("click", ()=>{
      const v = (pass.value||"").trim();
      if(v !== DRIVER_PASS){
        toast("ドライバー用パスワードが違います");
        return;
      }
      setSession("driver");
      toast("ドライバーでログインしました", true);
      refreshUI();
    });
  }

  if(btnAdmin){
    btnAdmin.addEventListener("click", ()=>{
      const v = (pass.value||"").trim();
      if(v !== ADMIN_PASS){
        toast("管理者パスワードが違います");
        return;
      }
      setSession("admin");
      toast("管理者でログインしました", true);
      refreshUI();
    });
  }

  if(btnLogout){
    btnLogout.addEventListener("click", ()=>{
      logout();
      if(pass) pass.value="";
      toast("ログアウトしました", true);
      refreshUI();
    });
  }

  refreshUI();
}

/* export.html で管理者モード切替（追加パス入力） */
function adminGate(){
  const s = getSession();
  if(!s) return false;
  return s.role === "admin";
}

window.addEventListener("DOMContentLoaded", ()=>{
  if(document.body?.dataset?.page === "index") initIndexAuth();
});
