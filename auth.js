/****************************************************
 * auth.js（パスログイン）
 * - driver pass: 202601
 * - admin  pass: ofa-2026
 ****************************************************/
const AUTH = {
  DRIVER_PASS: "202601",
  ADMIN_PASS: "ofa-2026",
  KEY_ROLE: "ofa_role",      // "driver" | "admin"
  KEY_NAME: "ofa_name",
  KEY_PASS: "ofa_pass"       // driver pass or admin pass
};

function authSet(role, name, pass){
  localStorage.setItem(AUTH.KEY_ROLE, role);
  localStorage.setItem(AUTH.KEY_NAME, name || "");
  localStorage.setItem(AUTH.KEY_PASS, pass || "");
}
function authClear(){
  localStorage.removeItem(AUTH.KEY_ROLE);
  localStorage.removeItem(AUTH.KEY_NAME);
  localStorage.removeItem(AUTH.KEY_PASS);
}
function authGet(){
  return {
    role: localStorage.getItem(AUTH.KEY_ROLE) || "",
    name: localStorage.getItem(AUTH.KEY_NAME) || "",
    pass: localStorage.getItem(AUTH.KEY_PASS) || ""
  };
}
function isAuthed(){
  const a = authGet();
  if (!a.role || !a.pass) return false;
  if (a.role === "driver") return a.pass === AUTH.DRIVER_PASS && !!a.name;
  if (a.role === "admin") return a.pass === AUTH.ADMIN_PASS;
  return false;
}

function requireAuth(allowAdmin=true){
  const a = authGet();
  if (!isAuthed()) {
    location.href = "./index.html";
    return null;
  }
  if (!allowAdmin && a.role === "admin") {
    // driver専用ページにadminで入った場合は許可する（実害なし）
  }
  return a;
}
