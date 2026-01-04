window.GasSender = (function(){
  function ensureFrame(){
    let f = document.getElementById("gas_iframe");
    if(!f){
      f = document.createElement("iframe");
      f.name = "gas_iframe";
      f.id = "gas_iframe";
      f.style.display = "none";
      document.body.appendChild(f);
    }
    return f;
  }

  function post(payload){
    return new Promise((resolve,reject)=>{
      try{
        const url = window.OFA_CONFIG.WEBAPP_URL;
        if(!url) throw new Error("WEBAPP_URLが未設定です");

        ensureFrame();

        const form = document.createElement("form");
        form.method = "POST";
        form.action = url;
        form.target = "gas_iframe";
        form.style.display = "none";

        // GAS側はJSON文字列を1つ受け取るだけ（確実）
        const inp = document.createElement("input");
        inp.type = "hidden";
        inp.name = "payload";
        inp.value = JSON.stringify(payload);
        form.appendChild(inp);

        document.body.appendChild(form);

        const timer = setTimeout(()=>{
          cleanup();
          reject(new Error("送信タイムアウト（回線/URL）"));
        }, 25000);

        // iframe onload はCORS関係なく発火する（ただしレスポンス本文は読めない）
        const iframe = document.getElementById("gas_iframe");
        const onload = ()=>{
          clearTimeout(timer);
          iframe.removeEventListener("load", onload);
          cleanup();
          resolve({ok:true});
        };
        iframe.addEventListener("load", onload);

        function cleanup(){
          try{ document.body.removeChild(form); }catch(e){}
        }

        form.submit();
      }catch(err){
        reject(err);
      }
    });
  }

  return { post };
})();
