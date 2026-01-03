// auth.js (Google Identity Services)
// ✅ ここをあなたの「本物のClient ID」に差し替え
const GOOGLE_CLIENT_ID = "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com";

// ローカル保存キー
const LS = {
  email: "ofa_email",
  name: "ofa_name",
  picture: "ofa_picture"
};

function getProfile(){
  return {
    email: localStorage.getItem(LS.email) || "",
    name: localStorage.getItem(LS.name) || "",
    picture: localStorage.getItem(LS.picture) || ""
  };
}

function setProfile(p){
  localStorage.setItem(LS.email, p.email || "");
  localStorage.setItem(LS.name, p.name || "");
  localStorage.setItem(LS.picture, p.picture || "");
}

function isLoggedIn(){
  const p = getProfile();
  return !!p.email;
}

function logout(){
  localStorage.removeItem(LS.email);
  localStorage.removeItem(LS.name);
  localStorage.removeItem(LS.picture);
}

function decodeJwtPayload(token){
  const base64Url = token.split(".")[1];
  const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  const jsonPayload = decodeURIComponent(
    atob(base64).split("").map(c => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)).join("")
  );
  return JSON.parse(jsonPayload);
}

function ensureGoogleScriptLoaded(){
  return new Promise((resolve, reject)=>{
    if(window.google && google.accounts && google.accounts.id) return resolve();
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true; s.defer = true;
    s.onload = ()=> resolve();
    s.onerror = ()=> reject(new Error("Google script load failed"));
    document.head.appendChild(s);
  });
}

// ページにログインUIを出し、ログイン済みならコールバックへ
async function requireLogin({buttonElId="gBtn", onAuthed} = {}){
  await ensureGoogleScriptLoaded();

  const btnEl = document.getElementById(buttonElId);
  if(!btnEl) return;

  // 既ログインなら即進む
  if(isLoggedIn()){
    onAuthed && onAuthed(getProfile());
    return;
  }

  // GIS init（✅ “勝手に別画面へ遷移”しない構成）
  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: (res)=>{
      try{
        const payload = decodeJwtPayload(res.credential);
        setProfile({
          email: payload.email,
          name: payload.name || payload.given_name || "",
          picture: payload.picture || ""
        });
        onAuthed && onAuthed(getProfile());
      }catch(e){
        console.error(e);
        alert("Googleログインの解析に失敗しました");
      }
    }
  });

  // ボタン描画
  btnEl.innerHTML = "";
  google.accounts.id.renderButton(btnEl, {
    theme: "outline",
    size: "large",
    shape: "pill",
    width: 260,
    text: "signin_with"
  });

  // OneTap は iPhoneで挙動がブレやすいのでオフ（必要なら true に）
  // google.accounts.id.prompt();
}
