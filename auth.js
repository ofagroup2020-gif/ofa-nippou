/****************************************************
 * auth.js（入口振り分け・ログイン必須）
 ****************************************************/

// ログインパス
const DRIVER_PASS = "202601";
const ADMIN_PASS  = "ofa-2026";

// GASに送るトークン（サーバー側でも検証するため）
// ※この2つは Code.gs と一致させる
const DRIVER_TOKEN = "DRIVER_TOKEN_202601";
const ADMIN_TOKEN  = "ADMIN_TOKEN_ofa-2026";

// storage keys
const KEY_ROLE = "ofa_role";        // "driver" | "admin"
const KEY_NAME = "ofa_driver_name"; // driverのみ
const KEY_TOKEN = "ofa_token";      // GAS検証用
const KEY_TS = "ofa_login_ts";

function loginDriver(name, pass){
  if((pass||"").trim() !== DRIVER_PASS) return false;
  localStorage.setItem(KEY_ROLE, "driver");
  localStorage.setItem(KEY_NAME, (name||"").trim());
  localStorage.setItem(KEY_TOKEN, DRIVER_TOKEN);
  localStorage.setItem(KEY_TS, String(Date.now()));
  return true;
}

function loginAdmin(pass){
  if((pass||"").trim() !== ADMIN_PASS) return false;
  localStorage.setItem(KEY_ROLE, "admin");
  localStorage.removeItem(KEY_NAME);
  localStorage.setItem(KEY_TOKEN, ADMIN_TOKEN);
  localStorage.setItem(KEY_TS, String(Date.now()));
  return true;
}

function logoutAll(){
  localStorage.removeItem(KEY_ROLE);
  localStorage.removeItem(KEY_NAME);
  localStorage.removeItem(KEY_TOKEN);
  localStorage.removeItem(KEY_TS);
}

function getRole(){ return localStorage.getItem(KEY_ROLE) || ""; }
function isDriver(){ return getRole()==="driver"; }
function isAdmin(){ return getRole()==="admin"; }
function getDriverName(){ return localStorage.getItem(KEY_NAME) || ""; }
function getToken(){ return localStorage.getItem(KEY_TOKEN) || ""; }

function requireLogin(){
  const role = getRole();
  const token = getToken();
  if(!role || !token){
    location.replace("./login.html");
    return false;
  }
  if(role==="driver" && !getDriverName()){
    location.replace("./login.html");
    return false;
  }
  return true;
}

// 管理者だけ許可
function requireAdmin(){
  if(!requireLogin()) return false;
  if(!isAdmin()){
    alert("管理者ログインが必要です。");
    location.replace("./login.html");
    return false;
  }
  return true;
}
