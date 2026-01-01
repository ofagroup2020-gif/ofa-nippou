/****************************************************
 * OFA Google Login (Google Identity Services)
 * - id_token を localStorage に保存
 * - GASへ送って本人判定（email取得）
 ****************************************************/

// ★あなたのGAS URL（今動いてるやつに合わせてください）
const OFA_GAS_URL = "https://script.google.com/macros/s/AKfycbyODZ_4fnYVkIMKCbVJZvIEwIEP20KMbbMqGdC1_ZmF9l9BE6ZxEGKs7ilmNpCb316Wiw/exec";

const LS_TOKEN = "ofa_id_token";
const LS_EMAIL = "ofa_email";
const LS_NAME  = "ofa_name"; // Googleの表示名（取れない場合あり）

function $(id){ return document.getElementById(id); }

function ofaToast(msg, ok=true){
  const t = $("toast");
  if(!t){ alert(msg); return; }
  t.textContent = msg;
  t.classList.toggle("danger", !ok);
  t.classList.add("show");
  setTimeout(()=>t.classList.remove("show"), 1800);
}

// id_token を返す
function ofaGetToken(){
  return localStorage.getItem(LS_TOKEN) || "";
}

// ログアウト
function ofaLogout(){
  localStorage.removeItem(LS_TOKEN);
  localStorage.removeItem(LS_EMAIL);
  localStorage.removeItem(LS_NAME);
  try{
    if(window.google && google.accounts && google.accounts.id){
      google.accounts.id.disableAutoSelect(); // 次回また選ばせる
    }
  }catch(e){}
  location.reload();
}

// GASへ token を投げて本人(email)を確定
async function ofaFetchMe(){
  const idToken = ofaGetToken();
  if(!idToken) return { ok:false, message:"no token" };

  const u = new URL(OFA_GAS_URL);
  u.searchParams.set("action","me");
  u.searchParams.set("id_token", idToken);

  const res = await fetch(u.toString(), { method:"GET", cache:"no-store" });
  const json = await res.json().catch(()=>null);
  if(!json || !json.ok) return { ok:false, message: json?.message || "me failed" };
  return json; // {ok:true, email, isAdmin?}
}

// ログインUIを表示
function ofaRenderLogin(){
  const box = $("loginBox");
  if(!box) return;

  // 既にtokenがあれば先に確認してUIを切替
  const token = ofaGetToken();
  if(token){
    ofaFetchMe().then(me=>{
      if(me.ok){
        localStorage.setItem(LS_EMAIL, me.email || "");
        $("loginBox").style.display = "none";
        const info = $("loginInfo");
        if(info){
          info.style.display = "block";
          info.innerHTML = `
            <div style="font-weight:900">ログイン中</div>
            <div style="opacity:.8;font-size:12px;word-break:break-all">${me.email || ""}${me.isAdmin ? "（管理者）":""}</div>
            <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
              <button class="btn small" id="btnLogout">ログアウト</button>
            </div>
          `;
          $("btnLogout")?.addEventListener("click", ofaLogout);
        }
        return;
      }
      // token無効なら削除してログイン出し直し
      ofaLogout();
    });
    return;
  }

  // 初回ログイン（GIS）
  const clientId = window.OFA_GOOGLE_CLIENT_ID;
  if(!clientId){
    box.innerHTML = `<div style="color:red">CLIENT_IDが未設定です</div>`;
    return;
  }

  box.style.display = "block";

  google.accounts.id.initialize({
    client_id: clientId,
    callback: async (response) => {
      try{
        const idToken = response.credential; // ←これがJWT(id_token)
        if(!idToken) throw new Error("tokenが取得できません");

        localStorage.setItem(LS_TOKEN, idToken);

        // GASで検証して email を確定
        const me = await ofaFetchMe();
        if(!me.ok) throw new Error(me.message || "認証失敗");

        localStorage.setItem(LS_EMAIL, me.email || "");
        ofaToast("ログインOK", true);
        location.reload();
      }catch(err){
        console.error(err);
        localStorage.removeItem(LS_TOKEN);
        ofaToast(err.message || "ログイン失敗", false);
      }
    },
    auto_select: true,     // できれば自動選択
    cancel_on_tap_outside: false
  });

  google.accounts.id.renderButton(box, {
    type: "standard",
    theme: "filled_black",
    size: "large",
    text: "signin_with",
    shape: "pill",
    logo_alignment: "left",
    width: 320
  });

  // 可能ならワンタップも
  google.accounts.id.prompt();
}

// ページ保護（ログイン必須）
async function ofaRequireLogin(){
  const token = ofaGetToken();
  if(!token){
    ofaRenderLogin();
    throw new Error("not logged in");
  }
  const me = await ofaFetchMe();
  if(!me.ok){
    ofaRenderLogin();
    throw new Error("token invalid");
  }
  return me; // {ok:true,email,isAdmin}
}

// GASにGETを投げる（id_token付与）
async function ofaCallGAS(action, params={}){
  const idToken = ofaGetToken();
  const u = new URL(OFA_GAS_URL);
  u.searchParams.set("action", action);
  if(idToken) u.searchParams.set("id_token", idToken);
  Object.entries(params).forEach(([k,v])=>{
    if(v!==undefined && v!==null && String(v).trim()!==""){
      u.searchParams.set(k, String(v).trim());
    }
  });

  const res = await fetch(u.toString(), { method:"GET", cache:"no-store" });
  return res.json();
}

// GASにPOST（id_tokenをbodyに含める）
async function ofaPostGAS(payload){
  const idToken = ofaGetToken();
  payload = payload || {};
  if(idToken) payload.id_token = idToken;

  const res = await fetch(OFA_GAS_URL, {
    method:"POST",
    headers:{ "Content-Type":"text/plain;charset=utf-8" },
    body: JSON.stringify(payload)
  });
  return res.json();
}

// DOM readyで自動
window.addEventListener("DOMContentLoaded", ()=>{
  // login UIがあるページは自動描画
  if($("loginBox")) ofaRenderLogin();
});
