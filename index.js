// index.js（トップページ用：ログイン制御 + 画面切替を100%保証）

(function () {
  // --- Service Worker を強制解除（古いJSが出続ける最大原因を潰す）
  (async () => {
    try {
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (const reg of regs) await reg.unregister();
      }
    } catch (e) {}
  })();

  // --- DOM
  const elPass = document.getElementById("password"); // input
  const btnDriver = document.getElementById("btnDriverLogin");
  const btnAdmin = document.getElementById("btnAdminLogin");
  const btnLogout = document.getElementById("btnLogout");

  const btnGoDeparture = document.getElementById("btnGoDeparture");
  const btnGoArrival = document.getElementById("btnGoArrival");
  const btnGoAdmin = document.getElementById("btnGoAdmin");

  const elStatus = document.getElementById("loginState"); // 画面に出す状態表示（無ければ作る）
  const elBadge = document.getElementById("badgeMode"); // ドライバー/管理者

  // --- ユーティリティ
  function setText(el, text) {
    if (!el) return;
    el.textContent = text;
  }

  function setDisabled(el, disabled) {
    if (!el) return;
    el.disabled = !!disabled;
    if (disabled) el.classList.add("disabled");
    else el.classList.remove("disabled");
  }

  function showError(msg) {
    // 画面に出す（存在しなければ alert）
    if (elStatus) {
      elStatus.style.color = "#d11";
      elStatus.style.fontWeight = "700";
      elStatus.textContent = msg;
    } else {
      alert(msg);
    }
  }

  function showOk(msg) {
    if (elStatus) {
      elStatus.style.color = "#0a7";
      elStatus.style.fontWeight = "700";
      elStatus.textContent = msg;
    }
  }

  function normalize(s) {
    // auth.jsと同じ思想：全角→半角 + 空白除去
    s = (s ?? "").toString();
    s = s.replace(/[！-～]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0));
    s = s.replace(/　/g, " ");
    s = s.trim().replace(/\s+/g, "");
    return s;
  }

  // --- config.js / auth.js 読み込みチェック（ここが原因なら即表示）
  function sanityCheck() {
    const missing = [];
    if (typeof EXEC_URL === "undefined") missing.push("EXEC_URL");
    if (typeof PASS_DRIVER === "undefined") missing.push("PASS_DRIVER");
    if (typeof PASS_ADMIN === "undefined") missing.push("PASS_ADMIN");
    if (typeof loginDriver !== "function") missing.push("loginDriver()");
    if (typeof loginAdmin !== "function") missing.push("loginAdmin()");
    if (typeof getSessionRole !== "function") missing.push("getSessionRole()");
    if (typeof clearSession !== "function") missing.push("clearSession()");

    if (missing.length) {
      showError("読み込み不足: " + missing.join(", ") + "（scriptの順番/パス/キャッシュ確認）");
      return false;
    }
    return true;
  }

  // --- UI反映（ログイン状態で必ず切り替える）
  function render() {
    if (!sanityCheck()) {
      // 全部ロック
      setDisabled(btnGoDeparture, true);
      setDisabled(btnGoArrival, true);
      setDisabled(btnGoAdmin, true);
      return;
    }

    const role = getSessionRole(); // "driver" | "admin" | ""

    if (!role) {
      setText(elBadge, "未ログイン");
      setText(elStatus, "未ログイン");
      if (elStatus) elStatus.style.color = "#666";

      setDisabled(btnGoDeparture, true);
      setDisabled(btnGoArrival, true);
      setDisabled(btnGoAdmin, true);
      return;
    }

    if (role === "driver") {
      setText(elBadge, "ドライバー");
      showOk("ログイン中（ドライバー）");

      setDisabled(btnGoDeparture, false);
      setDisabled(btnGoArrival, false);
      setDisabled(btnGoAdmin, true);
      return;
    }

    if (role === "admin") {
      setText(elBadge, "管理者");
      showOk("ログイン中（管理者）");

      setDisabled(btnGoDeparture, false);
      setDisabled(btnGoArrival, false);
      setDisabled(btnGoAdmin, false);
      return;
    }
  }

  // --- クリック処理（成功したら必ず render）
  function handleLogin(kind) {
    if (!sanityCheck()) return;

    const pass = normalize(elPass ? elPass.value : "");
    if (!pass) {
      showError("パスワードを入力してください");
      return;
    }

    let ok = false;
    if (kind === "driver") ok = loginDriver(pass);
    if (kind === "admin") ok = loginAdmin(pass);

    if (!ok) {
      showError("パスワードが違います（全角/空白混入も確認）");
      return;
    }

    // 成功 → UI更新
    render();
  }

  // --- 遷移（あなたの構成に合わせてファイル名をここで固定）
  function go(url) {
    // キャッシュ対策クエリ
    const v = Date.now();
    location.href = url + (url.includes("?") ? "&" : "?") + "v=" + v;
  }

  // --- イベント設定
  if (btnDriver) btnDriver.addEventListener("click", () => handleLogin("driver"));
  if (btnAdmin) btnAdmin.addEventListener("click", () => handleLogin("admin"));

  if (btnLogout) {
    btnLogout.addEventListener("click", () => {
      if (typeof clearSession === "function") clearSession();
      if (elPass) elPass.value = "";
      render();
    });
  }

  if (btnGoDeparture) btnGoDeparture.addEventListener("click", () => go("./departure.html"));
  if (btnGoArrival) btnGoArrival.addEventListener("click", () => go("./arrival.html"));
  if (btnGoAdmin) btnGoAdmin.addEventListener("click", () => go("./admin.html"));

  // 初期描画
  render();

  // ページ復帰時も反映（iPhoneで戻る/進むが強い）
  window.addEventListener("pageshow", render);
})();
