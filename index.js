function toast(msg){
  const t=document.getElementById("toast");
  if(!t){ alert(msg); return; }
  t.textContent=msg;
  t.classList.add("show");
  clearTimeout(window.__toastTimer);
  window.__toastTimer=setTimeout(()=>t.classList.remove("show"), 2600);
}

function getRole(){
  const ok = localStorage.getItem(LS_SESSION_PASS)==="1";
  const role = localStorage.getItem(LS_SESSION_ROLE);
  return (ok && role) ? role : "";
}

function updateUI(){
  const role = getRole();
  const badge = document.getElementById("badgeLogin");
  const goDeparture = document.getElementById("goDeparture");
  const goArrival = document.getElementById("goArrival");
  const goAdmin = document.getElementById("goAdmin");

  if(!role){
    badge.textContent = "未ログイン";
    badge.classList.remove("ok");
    goDeparture.disabled = true;
    goArrival.disabled = true;
    goAdmin.disabled = true;
    return;
  }

  badge.textContent = (role==="admin") ? "管理者ログイン中" : "ドライバーログイン中";
  badge.classList.add("ok");

  goDeparture.disabled = false;
  goArrival.disabled = false;
  goAdmin.disabled = (role!=="admin");
}

window.addEventListener("load", ()=>{
  // 必須：config.js が読み込まれてるか確認（落ちる原因1位）
  if(typeof EXEC_URL === "undefined"){
    alert("config.js が読み込めていません。ファイル名/配置/読み込み順を確認してください。");
    return;
  }

  const passInput = document.getElementById("passInput");

  document.getElementById("btnLoginDriver").addEventListener("click", ()=>{
    const pass = (passInput.value||"").trim();
    if(loginDriver(pass)){
      toast("ドライバーでログインしました");
      passInput.value = "";
      updateUI();
    }else{
      toast("パスワードが違います");
    }
  });

  document.getElementById("btnLoginAdmin").addEventListener("click", ()=>{
    const pass = (passInput.value||"").trim();
    if(loginAdmin(pass)){
      toast("管理者でログインしました");
      passInput.value = "";
      updateUI();
    }else{
      toast("パスワードが違います");
    }
  });

  document.getElementById("btnLogout").addEventListener("click", ()=>{
    clearSession();
    toast("ログアウトしました");
    updateUI();
  });

  document.getElementById("goDeparture").addEventListener("click", ()=>{
    if(!getRole()) return toast("先にログインしてください");
    location.href = "./departure.html";
  });

  document.getElementById("goArrival").addEventListener("click", ()=>{
    if(!getRole()) return toast("先にログインしてください");
    location.href = "./arrival.html";
  });

  document.getElementById("goAdmin").addEventListener("click", ()=>{
    if(getRole()!=="admin") return toast("管理者ログインが必要です");
    location.href = "./admin.html";
  });

  updateUI();
});
