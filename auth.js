/****************************************************
 * auth.js（Googleログイン / 自動ログイン / ガード）
 ****************************************************/

const GOOGLE_CLIENT_ID =
  "321435608721-vfrb8sgjnkqake7rgrscv8de798re2tl.apps.googleusercontent.com";

/** 取得 */
function getLogin(){
  return {
    token: localStorage.getItem("ofa_token") || "",
    email: localStorage.getItem("ofa_email") || "",
    name:  localStorage.getItem("ofa_name")  || ""
  };
}

/** ログイン必須ガード（index以外） */
function requireLoginOrRedirect(){
  const page = document.body?.dataset?.page || "";
  if(page === "index") return;
  const me = getLogin();
  if(!me.token){
    location.href = "./index.html";
  }
}

/** 表示更新 */
function renderLoginState(){
  const me = getLogin();
  const st = document.getElementById("loginState");
  if(st){
    st.innerHTML = me.token
      ? `ログイン中：<b>${escapeHtml(me.name || "-")}</b><br><span class="muted">${escapeHtml(me.email || "")}</span>`
      : `未ログイン（トップでログインしてください）`;
  }
  const who = document.getElementById("whoami");
  if(who) who.textContent = me.token ? `${me.name}（${me.email}）` : "-";

  // フォームに自動入力
  if(me.token && document.getElementById("driverName") && !document.getElementById("driverName").value){
    document.getElementById("driverName").value = me.name || "";
  }
}

/** ログアウト */
function logout(){
  localStorage.removeItem("ofa_token");
  localStorage.removeItem("ofa_email");
  localStorage.removeItem("ofa_name");
  localStorage.removeItem("ofa_admin");
  location.href = "./index.html";
}

/** Google callback */
function onGoogleLogin(res){
  try{
    const token = res.credential;
    const payload = JSON.parse(atob(token.split(".")[1]));

    localStorage.setItem("ofa_token", token);
    localStorage.setItem("ofa_email", payload.email || "");
    localStorage.setItem("ofa_name", payload.name || "");

    // index UI
    const loginArea = document.getElementById("loginArea");
    const menu = document.getElementById("menu");
    const btnLogout = document.getElementById("btnLogout");
    const hint = document.getElementById("loginHint");

    if(loginArea) loginArea.style.display = "none";
    if(menu) menu.style.display = "block";
    if(btnLogout) btnLogout.style.display = "inline-flex";
    if(hint) hint.textContent = "";

    renderLoginState();
  }catch(e){
    const hint = document.getElementById("loginHint");
    if(hint) hint.textContent = "ログイン処理に失敗しました。もう一度お試しください。";
  }
}

/** Googleボタン表示（index） */
function initGoogleButton(){
  const holder = document.getElementById("gSignIn");
  if(!holder) return;

  const me = getLogin();
  const loginArea = document.getElementById("loginArea");
  const menu = document.getElementById("menu");
  const btnLogout = document.getElementById("btnLogout");

  // 既にログイン済みならメニュー表示
  if(me.token){
    if(loginArea) loginArea.style.display = "none";
    if(menu) menu.style.display = "block";
    if(btnLogout) btnLogout.style.display = "inline-flex";
    renderLoginState();
    return;
  }

  // Google GIS 初期化
  if(!(window.google && google.accounts && google.accounts.id)){
    const hint = document.getElementById("loginHint");
    if(hint) hint.textContent = "Googleログインの読み込み中…（少し待ってください）";
    setTimeout(initGoogleButton, 600);
    return;
  }

  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: onGoogleLogin,
    auto_select: true,        // 自動ログインを狙う
    cancel_on_tap_outside: false
  });

  google.accounts.id.renderButton(holder, {
    theme: "outline",
    size: "large",
    shape: "pill",
    text: "continue_with",
    width: 280
  });

  // できる環境はワンタップ
  google.accounts.id.prompt();
}

function escapeHtml(s){
  return String(s ?? "")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#39;");
}

/** 起動 */
document.addEventListener("DOMContentLoaded", ()=>{
  requireLoginOrRedirect();
  renderLoginState();

  // indexだけボタン生成
  if(document.body?.dataset?.page === "index"){
    initGoogleButton();
    const btn = document.getElementById("btnLogout");
    if(btn) btn.addEventListener("click", logout);
  }
});
