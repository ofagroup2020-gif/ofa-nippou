/****************************************************
 * OFA Google Login (GIS)
 * - id_token を localStorage に保存
 * - GASへ送って本人判定（email取得・role判定）
 ****************************************************/

const OFA_GOOGLE_CLIENT_ID =
  "321435608721-vfrb8sgjnkqake7rgrscv8de798re2tl.apps.googleusercontent.com";

// ★あなたのGAS URL（最新のWebアプリURLへ）
const OFA_GAS_URL =
  "https://script.google.com/macros/s/AKfycbxa7fmk0rDDNmZ2p2GTEmE8g6yVaVJxy97J2vpw_NUuYr8lR3QbDNg6EDifoSoSFrKq9Q/exec";

const LS_TOKEN = "ofa_id_token";
const LS_ME    = "ofa_me"; // {email,name,role,driverName,phone,vehicleNo,plate}

const $ = (id)=>document.getElementById(id);

function ofaToast(msg, ok=true){
  const t = $("toast");
  if(!t){ alert(msg); return; }
  t.textContent = msg;
  t.classList.toggle("bad", !ok);
  t.classList.add("show");
  setTimeout(()=>t.classList.remove("show"), 1800);
}

function getToken(){ return localStorage.getItem(LS_TOKEN) || ""; }
function setToken(tok){ localStorage.setItem(LS_TOKEN, tok); }
function clearToken(){
  localStorage.removeItem(LS_TOKEN);
  localStorage.removeItem(LS_ME);
}

function getMe(){
  try{ return JSON.parse(localStorage.getItem(LS_ME) || "null"); }catch(e){ return null; }
}
function setMe(me){ localStorage.setItem(LS_ME, JSON.stringify(me||null)); }

async function gasWhoAmI(){
  const tok = getToken();
  if(!tok) return null;

  const url = new URL(OFA_GAS_URL);
  url.searchParams.set("action","whoami");
  url.searchParams.set("id_token", tok);

  const res = await fetch(url.toString(), { cache:"no-store" });
  const json = await res.json();
  if(!json.ok) throw new Error(json.message || "whoami failed");
  return json.me;
}

function renderLoginUI(){
  const box = $("loginBox");
  if(!box) return;

  const me = getMe();
  if(me){
    box.innerHTML = `
      <div class="kv">
        <span class="k">ログイン中</span>
        <span class="k">${escapeHtml(me.email||"")}</span>
        <span class="k">role:${escapeHtml(me.role||"driver")}</span>
      </div>
      <div style="margin-top:10px;display:flex;gap:10px;flex-wrap:wrap">
        <button class="btn dark" type="button" id="btnLogout">ログアウト</button>
      </div>
      <div class="small" style="margin-top:8px;">※この端末は自動ログインになります。</div>
    `;
    $("btnLogout")?.addEventListener("click", ()=>{
      clearToken();
      location.reload();
    });
    return;
  }

  box.innerHTML = `
    <div class="help">
      Googleでログインしてください（自動ログイン対応）<br>
      ・ドライバー：自分のデータのみ送信・出力<br>
      ・管理者：adminページでパス入力 → 全データ検索/出力
    </div>
    <div style="margin-top:12px" id="gBtn"></div>
  `;

  // GISボタン描画
  if(!window.google || !google.accounts || !google.accounts.id){
    ofaToast("GoogleログインSDKが未読み込みです", false);
    return;
  }

  google.accounts.id.initialize({
    client_id: OFA_GOOGLE_CLIENT_ID,
    callback: async (resp)=>{
      try{
        if(!resp.credential) throw new Error("no credential");
        setToken(resp.credential);
        ofaToast("ログイン確認中...", true);
        const me = await gasWhoAmI();
        setMe(me);
        ofaToast("ログイン完了", true);
        setTimeout(()=>location.reload(), 300);
      }catch(e){
        clearToken();
        ofaToast(e.message || String(e), false);
      }
    },
    auto_select: true,          // 自動ログイン
    cancel_on_tap_outside: false
  });

  google.accounts.id.renderButton($("gBtn"), {
    theme: "outline",
    size: "large",
    text: "signin_with",
    shape: "pill",
    width: 280
  });

  // 追加：ワンタップで出るように
  google.accounts.id.prompt();
}

function escapeHtml(s){
  return String(s??"")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#39;");
}

/** ログイン必須ページのガード */
async function requireLogin(){
  const me = getMe();
  if(me) return me;

  // tokenはあるがmeがない等 → whoamiで復旧
  const tok = getToken();
  if(tok){
    try{
      const me2 = await gasWhoAmI();
      setMe(me2);
      return me2;
    }catch(e){
      clearToken();
    }
  }
  // 未ログイン
  location.href = "./index.html";
  throw new Error("not logged in");
}
