window.Auth = (function(){
  const KEY = "ofa_session_v1";

  function getSession(){
    try { return JSON.parse(localStorage.getItem(KEY)||"null"); } catch(e){ return null; }
  }

  function setSession(role){
    const s = { role, at: Date.now() };
    localStorage.setItem(KEY, JSON.stringify(s));
    return s;
  }

  function logout(){ localStorage.removeItem(KEY); }

  function loginDriver(pass){
    if(pass === window.OFA_CONFIG.DRIVER_PASS) { setSession("driver"); return true; }
    return false;
  }

  function loginAdmin(pass){
    if(pass === window.OFA_CONFIG.ADMIN_PASS) { setSession("admin"); return true; }
    return false;
  }

  function requireLogin(){
    const s = getSession();
    if(!s) throw new Error("未ログインです。トップでログインしてください。");
    return s;
  }

  function requireRole(role){
    const s = requireLogin();
    if(s.role !== role) throw new Error("権限がありません。");
    return s;
  }

  return { getSession, loginDriver, loginAdmin, logout, requireLogin, requireRole };
})();
