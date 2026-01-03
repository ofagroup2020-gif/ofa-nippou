/****************************************************
 * auth.js（GIS専用：旧OAuthリンクは一切使わない）
 ****************************************************/

// ✅ ここをあなたの client_id に置換
const CLIENT_ID = "__CLIENT_ID__";

function safeBase64UrlDecode(str){
  // base64url -> base64
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  // padding
  while (str.length % 4) str += "=";
  return atob(str);
}

function onGoogleLogin(res){
  try{
    const token = res.credential;
    const payload = JSON.parse(safeBase64UrlDecode(token.split(".")[1]));

    localStorage.setItem("ofa_token", token);
    localStorage.setItem("ofa_email", payload.email || "");
    localStorage.setItem("ofa_name", payload.name || "");
    localStorage.setItem("ofa_picture", payload.picture || "");

    // index.html用
    const pill = document.getElementById("loginPill");
    if(pill) pill.textContent = "ログイン済";

    const loginBox = document.getElementById("loginBox");
    const menuBox = document.getElementById("menuBox");
    if(loginBox && menuBox){
      loginBox.classList.add("hidden");
      menuBox.classList.remove("hidden");
    }

    // 各ページ共通
    const ls = document.getElementById("loginState");
    if(ls){
      ls.innerHTML = `ログイン中：<b>${payload.email || ""}</b>`;
    }

  }catch(e){
    alert("ログイン情報の解析に失敗しました");
  }
}

function logout(){
  localStorage.removeItem("ofa_token");
  localStorage.removeItem("ofa_email");
  localStorage.removeItem("ofa_name");
  localStorage.removeItem("ofa_picture");
  // 管理者もOFF
  localStorage.removeItem("ofa_admin");
  location.href = "./index.html";
}

window.addEventListener("DOMContentLoaded", ()=>{
  // __CLIENT_ID__ のままなら警告
  if(CLIENT_ID === "__CLIENT_ID__"){
    // 何もしない（画面は出るがログインは失敗する）
  }

  const token = localStorage.getItem("ofa_token");
  const email = localStorage.getItem("ofa_email");

  const pill = document.getElementById("loginPill");
  if(pill) pill.textContent = token ? "ログイン済" : "未ログイン";

  const ls = document.getElementById("loginState");
  if(ls){
    ls.innerHTML = token ? `ログイン中：<b>${email || ""}</b>` : "未ログイン（Googleでログインしてください）";
  }

  // indexのみ：ログインでメニュー表示
  const loginBox = document.getElementById("loginBox");
  const menuBox = document.getElementById("menuBox");
  if(loginBox && menuBox){
    if(token){
      loginBox.classList.add("hidden");
      menuBox.classList.remove("hidden");
    }else{
      loginBox.classList.remove("hidden");
      menuBox.classList.add("hidden");
    }
  }

  const logoutBtn = document.getElementById("logoutBtn");
  if(logoutBtn) logoutBtn.addEventListener("click", logout);

  // ✅ g_id_onload に client_id を強制注入（HTMLの置換忘れ対策）
  const onload = document.getElementById("g_id_onload");
  if(onload && CLIENT_ID !== "__CLIENT_ID__"){
    onload.setAttribute("data-client_id", CLIENT_ID);
  }
});
