function onGoogleLogin(res){
  const token = res.credential;
  const payload = JSON.parse(atob(token.split(".")[1]));

  localStorage.setItem("ofa_token", token);
  localStorage.setItem("ofa_email", payload.email);
  localStorage.setItem("ofa_name", payload.name);

  document.getElementById("loginArea").classList.add("hidden");
  document.getElementById("menu").classList.remove("hidden");
}

window.onload = () => {
  if(localStorage.getItem("ofa_token")){
    document.getElementById("loginArea").classList.add("hidden");
    document.getElementById("menu").classList.remove("hidden");
  }
};
