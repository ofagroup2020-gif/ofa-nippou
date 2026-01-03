/****************************************************
 * OFA 点呼システム auth.js（GIS）
 ****************************************************/

// ★あなたの本物の Client ID
const GOOGLE_CLIENT_ID = "321435608721-vfrb8sgjnkqake7rgrscv8de798re2tl.apps.googleusercontent.com";

const LS_TOKEN = "ofa_id_token";
const LS_EMAIL = "ofa_email";
const LS_NAME  = "ofa_name";

function getToken(){ return localStorage.getItem(LS_TOKEN) || ""; }
function getEmail(){ return localStorage.getItem(LS_EMAIL) || ""; }
function getName(){ return localStorage.getItem(LS_NAME) || ""; }

function setLoginFromToken(token){
  try{
    const payload = JSON.parse(atob(token.split(".")[1]));
    localStorage.setItem(LS_TOKEN, token);
    localStorage.setItem(LS_EMAIL, payload.email || "");
    localStorage.setItem(LS_NAME, payload.name || payload.given_name || "");
    return true;
  }catch(e){
    return false;
  }
}

function logout(){
  localStorage.removeItem(LS_TOKEN);
  localStorage.removeItem(LS_EMAIL);
  localStorage.removeItem(LS_NAME);
  location.reload();
}

function renderLoginState(){
  const box = document.getElementById("loginState");
  if(!box) return;

  const token = getToken();
  const email = getEmail();
  const name  = getName();

  box.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.className = "loginBox";

  if(token && email){
    wrap.innerHTML = `
      <div class="loginRow">
        <div>
          <div class="loginTitle">ログイン中</div>
          <div class="loginUser">${escapeHtml(name || "")}</div>
          <div class="loginMail">${escapeHtml(email)}</div>
        </div>
        <button class="btn ghost" type="button" id="btnLogout">ログアウト</button>
      </div>
      <small class="hint">※送信はログイン必須です</small>
    `;
    box.appendChild(wrap);
    const b = document.getElementById("btnLogout");
    if(b) b.addEventListener("click", logout);
    return;
  }

  wrap.innerHTML = `
    <div class="loginTitle">Googleでログイン</div>
    <div id="gBtn"></div>
    <small class="hint">※ログインできない場合は「Authorized JavaScript origins」にGitHub Pages URLが必要です</small>
  `;
  box.appendChild(wrap);

  // GIS読み込み → ボタン描画
  loadGis(() => {
    /* global google */
    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: (res) => {
        if(setLoginFromToken(res.credential)){
          location.reload();
        }else{
          alert("ログイン情報の解析に失敗しました");
        }
      },
      auto_select: false
    });

    google.accounts.id.renderButton(
      document.getElementById("gBtn"),
      { theme: "outline", size: "large", text: "signin_with" }
    );
  });
}

function loadGis(done){
  if(window.google && window.google.accounts && window.google.accounts.id){
    done(); return;
  }
  const id = "gis_script";
  if(document.getElementById(id)){
    const t = setInterval(()=>{
      if(window.google && window.google.accounts && window.google.accounts.id){
        clearInterval(t); done();
      }
    }, 200);
    return;
  }
  const s = document.createElement("script");
  s.id = id;
  s.src = "https://accounts.google.com/gsi/client";
  s.async = true;
  s.defer = true;
  s.onload = done;
  document.head.appendChild(s);
}

function escapeHtml(str){
  return (str||"").replace(/[&<>"']/g, (m)=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[m]));
}

window.addEventListener("DOMContentLoaded", renderLoginState);
