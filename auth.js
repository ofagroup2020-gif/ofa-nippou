// auth.js
(function(){
  const OFA = window.OFA;
  if(!OFA) { console.error("config.js が先に読み込まれていません"); return; }

  const $ = (id)=>document.getElementById(id);

  function toast(msg, ok=true){
    const t = $("toast");
    if(!t){ alert(msg); return; }
    t.textContent = msg;
    t.classList.toggle("danger", !ok);
    t.classList.add("show");
    setTimeout(()=>t.classList.remove("show"), 2000);
  }

  function setSession({token,email,name,role}){
    localStorage.setItem(OFA.LS_TOKEN, token || "");
    localStorage.setItem(OFA.LS_EMAIL, email || "");
    localStorage.setItem(OFA.LS_NAME, name || "");
    localStorage.setItem(OFA.LS_ROLE, role || "driver");
  }
  function clearSession(){
    localStorage.removeItem(OFA.LS_TOKEN);
    localStorage.removeItem(OFA.LS_EMAIL);
    localStorage.removeItem(OFA.LS_NAME);
    localStorage.removeItem(OFA.LS_ROLE);
  }

  async function verifyWithGAS(idToken){
    const url = new URL(OFA.GAS_WEBAPP_URL);
    url.searchParams.set("action","verify");
    // CORSが環境でブロックされる事があるので、POSTに寄せる
    const res = await fetch(OFA.GAS_WEBAPP_URL, {
      method:"POST",
      headers:{ "Content-Type":"text/plain;charset=utf-8" },
      body: JSON.stringify({ app: OFA.APP_KEY, mode:"verify", idToken })
    });
    const json = await res.json().catch(()=>null);
    if(!json || !json.ok) throw new Error(json?.message || "verify失敗");
    return json;
  }

  function renderLogin(){
    const box = $("loginBox");
    if(!box) return;

    box.innerHTML = `
      <div class="note" style="margin-bottom:12px;">
        <b>点呼の重要ルール（必読）</b><br>
        1) 酒気帯びの有無を対面（または電話）で確認し、記録を1年間保存<br>
        2) ブレーキ・タイヤ・灯火類など運行前点検を必ず実施<br>
        3) 体調不良・睡眠不足がある場合は必ず管理者へ報告
      </div>

      <div class="pill">✅ Googleログイン必須（本人のみ出力） / 管理者は全検索・全出力</div>
      <div style="height:10px"></div>
      <div id="gsiBtn"></div>
      <div style="height:10px"></div>
      <button class="btn dark" id="logoutBtn" style="display:none;">ログアウト</button>
      <div id="loginInfo" style="margin-top:10px;color:#5b677a;font-size:12px;"></div>
    `;

    // ログイン済みなら表示切替
    const email = localStorage.getItem(OFA.LS_EMAIL) || "";
    const name  = localStorage.getItem(OFA.LS_NAME) || "";
    const role  = localStorage.getItem(OFA.LS_ROLE) || "";
    if(email){
      $("logoutBtn").style.display = "block";
      $("loginInfo").innerHTML = `ログイン中：<b>${escapeHtml(name||"")}</b>（${escapeHtml(email)}） / role=${escapeHtml(role)}`;
      $("logoutBtn").addEventListener("click", ()=>{
        clearSession();
        toast("ログアウトしました");
        location.reload();
      });
    }

    // Google Identity Services
    if(!window.google || !google.accounts || !google.accounts.id){
      toast("Google Login ライブラリ未読込", false);
      return;
    }

    google.accounts.id.initialize({
      client_id: OFA.GOOGLE_CLIENT_ID,
      callback: async (resp)=>{
        try{
          const idToken = resp.credential;
          toast("ログイン確認中…");
          const v = await verifyWithGAS(idToken);
          setSession({
            token: idToken,
            email: v.email,
            name: v.name || v.email,
            role: v.role || "driver"
          });
          toast("ログインOK");
          // メニュー等を更新
          setTimeout(()=>location.reload(), 400);
        }catch(e){
          console.error(e);
          toast(e.message || "ログイン失敗", false);
        }
      },
      auto_select: true, // 自動ログイン（できる環境は勝手にログイン）
      cancel_on_tap_outside: false
    });

    google.accounts.id.renderButton(
      $("gsiBtn"),
      { theme:"outline", size:"large", text:"signin_with", shape:"pill", width: 320 }
    );
  }

  function escapeHtml(s){
    return String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;")
      .replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
  }

  // 公開
  window.OFA_AUTH = {
    toast,
    renderLogin,
    getEmail: ()=>localStorage.getItem(OFA.LS_EMAIL)||"",
    getName:  ()=>localStorage.getItem(OFA.LS_NAME)||"",
    getRole:  ()=>localStorage.getItem(OFA.LS_ROLE)||"driver",
    getToken: ()=>localStorage.getItem(OFA.LS_TOKEN)||"",
    requireLogin: ()=>{
      const t = localStorage.getItem(OFA.LS_TOKEN)||"";
      if(!t) throw new Error("ログインしてください");
      return t;
    }
  };
})();
