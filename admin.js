(function(){
  const GAS = (window.OFA_GAS_URL || "").trim();

  function toast(msg, ok=true){
    const t = document.getElementById("toast");
    if(!t){ alert(msg); return; }
    t.style.display = "block";
    t.textContent = msg;
    t.className = "toast " + (ok ? "ok" : "ng");
    setTimeout(()=>{ t.style.display="none"; }, 2600);
  }

  // JSONP 呼び出し（CORS回避）
  function jsonp(params){
    return new Promise((resolve, reject)=>{
      const cb = "cb_" + Date.now() + "_" + Math.floor(Math.random()*100000);
      window[cb] = (data)=>{
        try{ resolve(data); } finally {
          delete window[cb];
          script.remove();
        }
      };
      const qs = new URLSearchParams({ ...params, callback: cb }).toString();
      const url = GAS + "?" + qs;

      const script = document.createElement("script");
      script.src = url;
      script.onerror = ()=>{ reject(new Error("JSONP error")); };
      document.body.appendChild(script);
    });
  }

  async function changePass(){
    const cur = (document.getElementById("currentPass").value || "").trim();
    const np1 = (document.getElementById("newPass").value || "").trim();
    const np2 = (document.getElementById("newPass2").value || "").trim();

    if(!GAS) return toast("GAS URLが未設定です", false);
    if(!cur) return toast("現在のパスワードを入力してください", false);
    if(!np1 || np1.length < 6) return toast("新しいパスワードは6文字以上にしてください", false);
    if(np1 !== np2) return toast("新しいパスワード（確認）が一致しません", false);

    try{
      const res = await jsonp({
        fn: "admin.setPassword",
        currentPass: cur,
        newPass: np1
      });
      if(res && res.ok){
        toast("変更しました ✅ 以後は新しいパスワードを使ってください", true);
        document.getElementById("currentPass").value = "";
        document.getElementById("newPass").value = "";
        document.getElementById("newPass2").value = "";
      }else{
        toast((res && res.message) ? res.message : "変更できませんでした", false);
      }
    }catch(e){
      toast("通信エラー：GASのURL/公開設定を確認してください", false);
    }
  }

  window.addEventListener("load", ()=>{
    const b = document.getElementById("btnChange");
    if(b) b.addEventListener("click", changePass);
  });
})();
