/****************************************************
 * OFA Google Login（Google Identity Services）
 * - Googleログイン
 * - id_token を localStorage に保存
 * - GASへ送って email/role を取得
 ****************************************************/

// ✅ 本物Client ID（あなたが送ってくれたID）
window.OFA_GOOGLE_CLIENT_ID =
  "321435608721-vfrb8sgjnkqake7rgrscv8de798re2tl.apps.googleusercontent.com";

// ✅ 今動いている GAS WebApp
window.OFA_GAS_URL =
  "https://script.google.com/macros/s/AKfycbyODZ_4fnYVkIMKCbVJZvIEwIEP20KMbbMqGdC1_ZmF9l9BE6ZxEGKs7ilmNpCb316Wiw/exec";

// localStorage keys
const LS_TOKEN = "ofa_id_token";
const LS_EMAIL = "ofa_email";
const LS_NAME  = "ofa_name";
const LS_ROLE  = "ofa_role"; // driver/admin

const $ = (id)=>document.getElementById(id);

function ofaToast(msg, ok=true){
  const t = $("toast");
  if(!t){ alert(msg); return; }
  t.textContent = msg;
  t.classList.toggle("danger", !ok);
  t.classList.add("show");
  setTimeout(()=>t.classList.remove("show"), 2200);
}

function isLoggedIn(){
  return !!localStorage.getItem(LS_TOKEN);
}
function getRole(){
  return localStorage.getItem(LS_ROLE) || "driver";
}
function getEmail(){
  return localStorage.getItem(LS_EMAIL) || "";
}
function getName(){
  return localStorage.getItem(LS_NAME) || "";
}

function renderLogin(){
  const box = $("loginBox");
  if(!box) return;

  box.innerHTML = `
    <div class="card" style="margin-top:12px;">
      <div class="cardHead">
        <div style="font-weight:1000;">Googleログイン</div>
        <div class="sub">点呼ポータル利用にはログインが必要です。</div>
      </div>
      <div class="cardBody" style="text-align:center;">
        <div id="g_id_onload"
          data-client_id="${window.OFA_GOOGLE_CLIENT_ID}"
          data-callback="onGoogleLogin"
          data-auto_prompt="false">
        </div>

        <div class="g_id_signin"
          data-type="standard"
          data-size="large"
          data-theme="outline"
          data-text="signin_with"
          data-shape="pill"
          data-logo_alignment="left">
        </div>

        <div class="help" style="text-align:left;margin-top:14px;">
          ・ログイン後、ドライバーは自分のデータのみ出力<br>
          ・管理者は権限（role=admin）で全データ検索・出力が可能
        </div>
      </div>
    </div>
  `;
}

async function onGoogleLogin(response){
  try{
    const idToken = response.credential;
    if(!idToken) throw new Error("id_tokenが取得できません");

    localStorage.setItem(LS_TOKEN, idToken);
    ofaToast("ログイン確認中…");

    // GASへ whoami
    const res = await fetch(window.OFA_GAS_URL, {
      method:"POST",
      headers:{ "Content-Type":"text/plain;charset=utf-8" },
      body: JSON.stringify({ action:"whoami", id_token:idToken })
    });

    const json = await res.json();
    if(!json.ok) throw new Error(json.message || "認証に失敗しました");

    localStorage.setItem(LS_EMAIL, json.email || "");
    localStorage.setItem(LS_NAME,  json.name  || "");
    localStorage.setItem(LS_ROLE,  json.role  || "driver");

    ofaToast("ログイン成功");
    location.reload();
  }catch(err){
    console.error(err);
    ofaToast(err.message || "ログイン失敗", false);
    localStorage.removeItem(LS_TOKEN);
  }
}

function renderLoginInfo(){
  const info = $("loginInfo");
  if(!info) return;

  const role = getRole();
  const name = getName();
  const email= getEmail();

  info.innerHTML = `
    <div class="card" style="margin-top:12px;">
      <div class="cardHead">
        <div style="font-weight:1000;">ログイン中</div>
        <div class="sub">${role==="admin" ? "管理者モード" : "ドライバーモード"}</div>
      </div>
      <div class="cardBody">
        <div class="badge">👤 ${escapeHtml(name || "ユーザー")}</div>
        <div style="height:8px;"></div>
        <div class="badge">📧 ${escapeHtml(email || "-")}</div>
        <div class="hr"></div>
        <button class="btn small dark" onclick="ofaLogout()">ログアウト</button>
      </div>
    </div>
  `;
}

function escapeHtml(s){
  return String(s??"")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#39;");
}

function ofaLogout(){
  localStorage.removeItem(LS_TOKEN);
  localStorage.removeItem(LS_EMAIL);
  localStorage.removeItem(LS_NAME);
  localStorage.removeItem(LS_ROLE);
  ofaToast("ログアウトしました");
  setTimeout(()=>location.reload(), 400);
}

// 他JSから使えるように公開
window.OFA_AUTH = {
  isLoggedIn,
  getRole,
  getEmail,
  getName,
  toast: ofaToast,
  logout: ofaLogout
};

window.addEventListener("DOMContentLoaded", ()=>{
  // ログインUI
  if(isLoggedIn()){
    renderLoginInfo();
  }else{
    renderLogin();
  }
});
