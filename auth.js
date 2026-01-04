// auth.js
(function(){
  const CFG = window.OFA_CFG;

  function setSession(type){
    localStorage.setItem("ofa_session", type); // "driver" | "admin"
    localStorage.setItem("ofa_session_ts", String(Date.now()));
  }
  function clearSession(){
    localStorage.removeItem("ofa_session");
    localStorage.removeItem("ofa_session_ts");
  }
  function getSession(){
    return localStorage.getItem("ofa_session") || "";
  }

  // 30日で自動ログアウト（任意）
  function sessionValid(){
    const ts = Number(localStorage.getItem("ofa_session_ts") || "0");
    if(!ts) return false;
    const days = (Date.now() - ts) / (1000*60*60*24);
    return days <= 30;
  }

  window.OFA_AUTH = {
    loginDriver(pass){
      if(String(pass||"").trim() !== CFG.DRIVER_PASS) return false;
      setSession("driver"); return true;
    },
    loginAdmin(pass){
      if(String(pass||"").trim() !== CFG.ADMIN_PASS) return false;
      setSession("admin"); return true;
    },
    logout(){
      clearSession();
    },
    requireLogin(){
      const s = getSession();
      if(!s || !sessionValid()){
        clearSession();
        location.href = "./index.html";
        return false;
      }
      return true;
    },
    isAdmin(){
      return getSession() === "admin" && sessionValid();
    },
    authToken(){
      // GASへ渡す認証トークン（サーバ側でも弾く）
      return (getSession()==="admin") ? CFG.ADMIN_PASS : CFG.DRIVER_PASS;
    },
    sessionType(){
      const s = getSession();
      return (s && sessionValid()) ? s : "";
    }
  };
})();
