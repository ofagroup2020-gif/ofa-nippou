const GAS_URL =
"https://script.google.com/macros/s/AKfycbxAJa6S3-t-MHs4BraAYWqkW8mVi3QyPNRmCybCKbOrpmBn6HefQND3BBHCVYRcu0bfAg/exec";

function send(type){
  fetch(GAS_URL,{
    method:"POST",
    body:JSON.stringify({
      type,
      email:localStorage.getItem("ofa_email"),
      name:localStorage.getItem("ofa_name"),
      time:new Date().toISOString()
    })
  }).then(r=>r.text())
    .then(()=>alert("送信完了"));
}
