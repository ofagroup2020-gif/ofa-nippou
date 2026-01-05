// auth.js（必ずプロジェクト直下 / ファイル名は auth.js 固定）

function _normalizePass(s){
  s = (s ?? "").toString();

  // 全角→半角（０-９、Ａ-Ｚ、ａ-ｚ、記号も一部）
  s = s.replace(/[！-～]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0));
  s = s.replace(/　/g, " "); // 全角スペース→半角

  // 前後空白除去 + 中間の空白も除去（コピペ事故対策）
  s = s.trim().replace(/\s+/g, "");
  return s;
}

function clearSession(){
  localStorage.removeItem(LS_SESSION_ROLE);
  localStorage.removeItem(LS_SESSION_PASS);
}

function getSessionRole(){
  const ok = localStorage.getItem(LS_SESSION_PASS) === "1";
  const role = localStorage.getItem(LS_SESSION_ROLE) || "";
  return (ok && role) ? role : "";
}

function loginDriver(pass){
  // config.js 読み込みチェック
  if(typeof PASS_DRIVER === "undefined"){
    alert("config.js が読み込めていません（PASS_DRIVER 未定義）");
    return false;
  }
  const input = _normalizePass(pass);
  const expect = _normalizePass(PASS_DRIVER);

  if(input === expect){
    localStorage.setItem(LS_SESSION_ROLE, "driver");
    localStorage.setItem(LS_SESSION_PASS, "1");
    return true;
  }
  return false;
}

function loginAdmin(pass){
  if(typeof PASS_ADMIN === "undefined"){
    alert("config.js が読み込めていません（PASS_ADMIN 未定義）");
    return false;
  }
  const input = _normalizePass(pass);
  const expect = _normalizePass(PASS_ADMIN);

  if(input === expect){
    localStorage.setItem(LS_SESSION_ROLE, "admin");
    localStorage.setItem(LS_SESSION_PASS, "1");
    return true;
  }
  return false;
}
