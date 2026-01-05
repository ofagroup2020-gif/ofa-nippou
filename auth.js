// auth.js
(function(){
  const KEY = "ofa_session_v1";

  function nowMs(){ return Date.now(); }

  function saveSession(role){
    const hours = (window.OFA_CONFIG?.SESSION_HOURS ?? 12);
    const exp = nowMs() + hours*60*60*1000;
    localStorage.setItem(KEY, JSON.stringify({ role, exp }));
  }
  function getSession(){
    try{
      const raw = localStorage.getItem(KEY);
      if(!raw) return null;
      const s = JSON.parse(raw);
      if(!s || !s.role || !s.exp) return null;
      if(nowMs() > s.exp){
        localStorage.removeItem(KEY);
        return null;
      }
      return s;
    }catch(e){ return null; }
  }
  function clearSession(){
    localStorage.removeItem(KEY);
  }
  function isRole(role){
    const s = getSession();
    return !!s && s.role === role;
  }

  function login(role, pass){
    const cfg = window.OFA_CONFIG;
    if(!cfg) throw new Error("config.js が読み込めていません");
    const ok = (role==="driver" && pass===cfg.DRIVER_PASS) || (role==="admin" && pass===cfg.ADMIN_PASS);
    if(!ok) return { ok:false, message:"パスワードが違います（LINE公式の最新を確認）" };
    saveSession(role);
    return { ok:true };
  }

  function requireRole(role){
    const s = getSession();
    if(!s){
      location.href = "index.html";
      return false;
    }
    if(role && s.role !== role){
      location.href = "index.html";
      return false;
    }
    return true;
  }

  function setLoginBadge(){
    const badge = document.querySelector("[data-login-badge]");
    if(!badge) return;
    const s = getSession();
    badge.textContent = s ? (s.role==="admin" ? "管理者ログイン中" : "ドライバーログイン中") : "未ログイン";
  }

  window.OFA_AUTH = {
    login, getSession, clearSession, isRole, requireRole, setLoginBadge
  };
})();
