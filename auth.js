function onGoogleLogin(response) {
  const token = response.credential;
  const payload = JSON.parse(atob(token.split(".")[1]));

  // ログイン情報保存
  localStorage.setItem("ofa_login", "1");
  localStorage.setItem("ofa_name", payload.name);
  localStorage.setItem("ofa_email", payload.email);

  // ✅ ここが重要：勝手にPDFやGASに飛ばさない
  window.location.href = "./menu.html";
}
