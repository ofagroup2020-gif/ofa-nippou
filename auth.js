/****************************************************
 * OFA Google Login（Google Identity Services）
 * - Googleログイン
 * - id_token を localStorage に保存
 * - GASへ送信して本人判定（email取得・権限判定）
 ****************************************************/

/** ========= 設定 ========= */

// ★あなたの本物の Google OAuth Client ID（差し替え済み）
window.OFA_GOOGLE_CLIENT_ID =
  "321435608721-vfrb8sgjnkqake7rgrscv8de798re2tl.apps.googleusercontent.com";

// ★あなたの GAS WebApp URL（今使っている /exec）
const OFA_GAS_URL =
  "https://script.google.com/macros/s/AKfycbyODZ_4fnYVkIMKCbVJZvIEwIEP20KMbbMqGdC1_ZmF9l9BE6ZxEGKs7ilmNpCb316Wiw/exec";

// localStorage keys
const LS_TOKEN = "ofa_id_token";
const LS_EMAIL = "ofa_email";
const LS_NAME  = "ofa_name";
const LS_ROLE  = "ofa_role"; // driver / admin

/** ========= 共通 ========= */
function $(id){
  return document.getElementById(id);
}

function ofaToast(msg, ok=true){
  const t = $("toast");
  if(!t){
    alert(msg);
    return;
  }
  t.textContent = msg;
  t.classList.toggle("danger", !ok);
  t.classList.add("show");
  setTimeout(()=>t.classList.remove("show"), 2200);
}

/** ========= ログインUI描画 ========= */
function renderLogin(){
  const box = $("loginBox");
  if(!box) return;

  box.innerHTML = `
    <div style="text-align:center">
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
    </div>
  `;
}

/** ========= Googleログイン成功時 ========= */
async function onGoogleLogin(response){
  try{
    const idToken = response.credential;
    if(!idToken){
      ofaToast("ログイン情報が取得できません", false);
      return;
    }

    // 仮保存
    localStorage.setItem(LS_TOKEN, idToken);

    ofaToast("ログイン確認中…");

    // GASへ送信して本人判定
    const res = await fetch(OFA_GAS_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        action: "whoami",
        id_token: idToken
      })
    });

    const json = await res.json();

    if(!json.ok){
      throw new Error(json.message || "認証に失敗しました");
    }

    // 保存
    localStorage.setItem(LS_EMAIL, json.email || "");
    localStorage.setItem(LS_NAME,  json.name  || "");
    localStorage.setItem(LS_ROLE,  json.role  || "driver");

    ofaToast("ログイン成功");

    showLoginInfo();

  }catch(err){
    console.error(err);
    ofaToast(err.message || "ログイン失敗", false);
  }
}

/** ========= ログイン後表示 ========= */
function showLoginInfo(){
  const box = $("loginInfo");
  if(!box) return;

  const email = localStorage.getItem(LS_EMAIL);
  const name  = localStorage.getItem(LS_NAME);
  const role  = localStorage.getItem(LS_ROLE);

  box.innerHTML = `
    <div style="padding:12px;border-radius:12px;background:#f5f5f5">
      <div><strong>${name || "ログインユーザー"}</strong></div>
      <div style="font-size:12px;color:#666">${email}</div>
      <div style="margin-top:6px;font-size:12px">
        権限：<strong>${role === "admin" ? "管理者" : "ドライバー"}</strong>
      </div>
      <button onclick="logout()" style="margin-top:10px">
        ログアウト
      </button>
    </div>
  `;
}

/** ========= ログアウト ========= */
function logout(){
  localStorage.removeItem(LS_TOKEN);
  localStorage.removeItem(LS_EMAIL);
  localStorage.removeItem(LS_NAME);
  localStorage.removeItem(LS_ROLE);

  ofaToast("ログアウトしました");
  location.reload();
}

/** ========= 初期化 ========= */
window.addEventListener("DOMContentLoaded", ()=>{
  const token = localStorage.getItem(LS_TOKEN);
  if(token){
    showLoginInfo();
  }else{
    renderLogin();
  }
});
