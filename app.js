/****************************************************
 * OFA 点呼システム（GitHub Pages側）完成版
 * - Googleログイン（GIS）
 * - ドライバー：本人データのみ
 * - 管理者：パスワード（ofa-2026）で全件検索・全件出力
 * - 出発点呼 / 帰着点呼 / PDF / CSV / 履歴
 ****************************************************/

/** ★あなたのGAS WebApp URL（最新に合わせて差し替えOK） */
const GAS_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbxzybF-mqgkTGxRvJtu2OUs545l4oI5wudEqEnz0G-Qw9JmP6vd8pDKqR0xqlIDAMjdCw/exec";

/** ★あなたのGoogle OAuth Client ID（本物） */
const GOOGLE_CLIENT_ID = "321435608721-vfrb8sgjnkqake7rgrscv8de798re2tl.apps.googleusercontent.com";

/** アプリ識別（GAS側と一致） */
const APP_KEY = "OFA_TENKO";

/** 管理者パスワード（固定） */
const ADMIN_PASSWORD = "ofa-2026";

/** localStorage Keys */
const LS = {
  token: "ofa_id_token",
  profile: "ofa_profile",
  admin: "ofa_admin_ok",
};

/** ===== util ===== */
const $ = (id) => document.getElementById(id);

function toast(msg, danger = false) {
  const t = $("toast");
  if (!t) return alert(msg);
  t.textContent = msg;
  t.classList.toggle("danger", !!danger);
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 1800);
}

function safeStr(v) {
  return (v === undefined || v === null) ? "" : String(v).trim();
}

function toYMD(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
function toHM(d = new Date()) {
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}
function monthISO(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}
function normalizeYMD(input) {
  return safeStr(input).replace(/\//g, "-");
}
function numOrBlank(v) {
  const s = safeStr(v);
  if (!s) return "";
  const n = Number(s);
  return Number.isFinite(n) ? n : "";
}
function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** ===== Google Login (GIS) =====
 * GitHub Pagesに「埋め込み」= Google Identity Services を使うのが最も安定です
 */
function loadGoogleScript() {
  return new Promise((resolve, reject) => {
    if (window.google && window.google.accounts && window.google.accounts.id) return resolve();
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.defer = true;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

function decodeJwtPayload(idToken) {
  const parts = String(idToken || "").split(".");
  if (parts.length < 2) return null;
  const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  const json = decodeURIComponent(atob(b64).split("").map(c => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)).join(""));
  return JSON.parse(json);
}

function saveSession(idToken) {
  localStorage.setItem(LS.token, idToken);
  const p = decodeJwtPayload(idToken) || {};
  const profile = {
    email: p.email || "",
    name: p.name || p.given_name || "",
    picture: p.picture || "",
    sub: p.sub || "",
  };
  localStorage.setItem(LS.profile, JSON.stringify(profile));
  return profile;
}

function getProfile() {
  try {
    return JSON.parse(localStorage.getItem(LS.profile) || "null");
  } catch {
    return null;
  }
}
function getToken() {
  return localStorage.getItem(LS.token) || "";
}
function isLoggedIn() {
  const p = getProfile();
  return !!(p && p.email && getToken());
}

function logout() {
  localStorage.removeItem(LS.token);
  localStorage.removeItem(LS.profile);
  localStorage.removeItem(LS.admin);
  toast("ログアウトしました");
  setTimeout(() => location.href = "index.html", 400);
}

/** 管理者パス */
function isAdmin() {
  return localStorage.getItem(LS.admin) === "1";
}
function setAdminOk(ok) {
  localStorage.setItem(LS.admin, ok ? "1" : "0");
}

/** ===== 写真（圧縮してDataURLに） ===== */
async function fileToCompressedDataURL(file, maxW = 1280, quality = 0.75) {
  if (!file) return null;
  if (!file.type || !file.type.startsWith("image/")) return null;

  const { im, url } = await new Promise((resolve, reject) => {
    const u = URL.createObjectURL(file);
    const i = new Image();
    i.onload = () => resolve({ im: i, url: u });
    i.onerror = reject;
    i.src = u;
  });

  const w = im.naturalWidth || im.width;
  const h = im.naturalHeight || im.height;

  const scale = Math.min(1, maxW / w);
  const cw = Math.round(w * scale);
  const ch = Math.round(h * scale);

  const canvas = document.createElement("canvas");
  canvas.width = cw; canvas.height = ch;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(im, 0, 0, cw, ch);

  URL.revokeObjectURL(url);
  return canvas.toDataURL("image/jpeg", quality);
}

async function collectFilesAsDataURLs(inputId) {
  const el = $(inputId);
  if (!el || !el.files || !el.files.length) return [];
  const out = [];
  for (const f of Array.from(el.files)) {
    const du = await fileToCompressedDataURL(f, 1280, 0.75);
    if (du) out.push(du);
  }
  return out;
}

/** 点検項目（増量） */
function collectInspection() {
  const ids = [
    "insp_tire", "insp_light", "insp_brake", "insp_wiper",
    "insp_engineOil", "insp_coolant", "insp_battery",
    "insp_horn", "insp_mirror", "insp_damage",
    "insp_cargo", "insp_extinguisher", "insp_triangle"
  ];
  const obj = {};
  ids.forEach(id => { if ($(id)) obj[id] = safeStr($(id).value); });
  if ($("insp_note")) obj.note = safeStr($("insp_note").value);
  return obj;
}

/** ===== GAS呼び出し（POSTで統一：CORS/長いtoken対策）===== */
async function gasPost(payload) {
  const res = await fetch(GAS_WEBAPP_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => null);
  return json;
}

/** ===== 点呼送信 ===== */
async function submitTenko(mode) {
  try {
    if (!isLoggedIn()) throw new Error("ログインしてください");
    if (mode !== "departure" && mode !== "arrival") throw new Error("invalid mode");

    const token = getToken();
    const profile = getProfile();

    const date = normalizeYMD(safeStr($("date")?.value));
    const time = safeStr($("time")?.value);

    const driverName = safeStr($("driverName")?.value) || profile?.name || "";
    const driverEmail = profile?.email || "";
    const driverPhone = safeStr($("driverPhone")?.value);

    const vehicleNo = safeStr($("vehicleNo")?.value); // 車両番号/ナンバー
    const managerName = safeStr($("managerName")?.value);
    const method = safeStr($("method")?.value);
    const place = safeStr($("place")?.value);
    const alcoholValue = safeStr($("alcoholValue")?.value);
    const alcoholBand = safeStr($("alcoholBand")?.value);
    const memo = safeStr($("memo")?.value);

    // 走行距離
    const odoStart = numOrBlank($("odoStart")?.value);
    const odoEnd = numOrBlank($("odoEnd")?.value);
    let odoTotal = "";
    if (odoStart !== "" && odoEnd !== "") odoTotal = Math.max(0, Number(odoEnd) - Number(odoStart));

    // 免許
    const licenseNo = safeStr($("licenseNo")?.value);

    // 日報（帰着）
    const workType = safeStr($("workType")?.value);
    const workArea = safeStr($("workArea")?.value);
    const workHours = safeStr($("workHours")?.value);
    const deliveryCount = safeStr($("deliveryCount")?.value);
    const trouble = safeStr($("trouble")?.value);
    const dailyNote = safeStr($("dailyNote")?.value);

    // 必須
    const must = (v, name) => { if (!v) throw new Error(`未入力: ${name}`); };
    must(date, "日付");
    must(time, "時刻");
    must(driverName, "運転者氏名");
    must(driverEmail, "ログインメール");
    must(vehicleNo, "車両番号/ナンバー");
    must(managerName, "点呼実施者");
    must(method, "点呼方法");
    must(alcoholValue, "アルコール測定値");
    must(alcoholBand, "酒気帯び");

    const inspection = collectInspection();

    // 写真（任意）
    const tenkoPhotos = await collectFilesAsDataURLs("tenkoPhotos");
    const reportPhotos = await collectFilesAsDataURLs("reportPhotos");
    const licensePhotos = await collectFilesAsDataURLs("licensePhotos");

    $("btnSubmit") && ($("btnSubmit").disabled = true);
    toast("送信中…");

    const payload = {
      app: APP_KEY,
      action: "saveTenko",
      idToken: token,
      data: {
        mode,
        date, time,
        driverName, driverEmail, driverPhone,
        vehicleNo,
        managerName, method, place,
        alcoholValue, alcoholBand, memo,
        odoStart, odoEnd, odoTotal,
        licenseNo,
        inspection,
        workType, workArea, workHours, deliveryCount, trouble, dailyNote,
      },
      photos: tenkoPhotos,
      reportPhotos,
      licensePhotos,
    };

    const json = await gasPost(payload);
    if (!json || !json.ok) throw new Error(json?.message || "送信失敗");

    toast("送信OK（保存完了）");

    setTimeout(() => location.href = "index.html", 650);
  } catch (err) {
    toast(err.message || String(err), true);
    $("btnSubmit") && ($("btnSubmit").disabled = false);
  }
}

/** ===== 管理者ログイン（パスワード） ===== */
function adminLogin() {
  const pass = safeStr($("adminPass")?.value);
  if (!pass) return toast("管理者パスワードを入力", true);
  if (pass !== ADMIN_PASSWORD) return toast("パスワードが違います", true);
  setAdminOk(true);
  toast("管理者モードON ✅");
  renderLoginState();
}
function adminLogout() {
  setAdminOk(false);
  toast("管理者モードOFF");
  renderLoginState();
}

/** ===== 出力（PDF/CSV） ===== */
async function exportAction(action) {
  try {
    if (!isLoggedIn()) throw new Error("ログインしてください");

    const token = getToken();
    const profile = getProfile();

    const isAdminMode = isAdmin();
    const adminPass = isAdminMode ? ADMIN_PASSWORD : "";

    // 検索条件（管理者用）
    const qName = safeStr($("qName")?.value);
    const qPhone = safeStr($("qPhone")?.value);
    const qVehicle = safeStr($("qVehicle")?.value);

    // ドライバー本人だけ（管理者でない場合）
    const driverEmail = profile?.email || "";

    // 日報/履歴
    const date = normalizeYMD(safeStr($("dateDaily")?.value || $("date")?.value));
    // 月報
    const month = safeStr($("month")?.value || $("historyMonth")?.value || "");
    // 範囲CSV
    const from = normalizeYMD(safeStr($("fromDate")?.value));
    const to = normalizeYMD(safeStr($("toDate")?.value));

    const payload = {
      app: APP_KEY,
      action,
      idToken: token,
      adminPass,
      filter: {
        // 管理者検索
        qName, qPhone, qVehicle,
        // 日付/月/範囲
        date, month, from, to,
        // 本人制限（GAS側で強制）
        driverEmail,
        // 管理者かどうか（GAS側でパス一致したらtrue）
        admin: isAdminMode ? true : false,
      }
    };

    toast("作成中…");
    const json = await gasPost(payload);
    if (!json || !json.ok) throw new Error(json?.message || "作成失敗");

    const url = json.url;
    if (url) {
      const box = $("resultBox");
      if (box) {
        box.style.display = "block";
        box.innerHTML = `
          <div style="font-weight:950;margin-bottom:8px;">✅ 作成完了</div>
          <div style="font-size:12px;color:rgba(15,23,42,.70);margin-bottom:8px;">
            <a href="${url}" target="_blank" rel="noopener">ファイルを開く（印刷/LINE共有OK）</a>
          </div>
          <div class="btnrow">
            <button class="btn rainbow" onclick="window.open('${url}','_blank')">開く</button>
            <button class="btn" onclick="navigator.clipboard.writeText('${url}');toast('コピーしました')">コピー</button>
          </div>
        `;
      }
      toast("作成OK");
      window.open(url, "_blank");
    } else {
      toast("完了（URLなし）");
    }
  } catch (err) {
    toast(err.message || String(err), true);
  }
}

/** ===== 履歴（月内の日付一覧） ===== */
async function loadHistory() {
  try {
    if (!isLoggedIn()) throw new Error("ログインしてください");

    const token = getToken();
    const profile = getProfile();
    const isAdminMode = isAdmin();
    const adminPass = isAdminMode ? ADMIN_PASSWORD : "";

    const month = safeStr($("historyMonth")?.value);
    if (!month) throw new Error("履歴の月（YYYY-MM）が必要");

    // 管理者検索
    const qName = safeStr($("qName")?.value);
    const qPhone = safeStr($("qPhone")?.value);
    const qVehicle = safeStr($("qVehicle")?.value);

    const payload = {
      app: APP_KEY,
      action: "historyDays",
      idToken: token,
      adminPass,
      filter: {
        month,
        qName, qPhone, qVehicle,
        driverEmail: profile?.email || "",
        admin: isAdminMode ? true : false,
      }
    };

    toast("履歴取得中…");
    const json = await gasPost(payload);
    if (!json || !json.ok) throw new Error(json?.message || "取得失敗");

    const days = Array.isArray(json.days) ? json.days : [];
    $("historyBox") && ($("historyBox").style.display = "block");
    $("historyCount") && ($("historyCount").textContent = `${days.length}件`);
    const list = $("historyList");
    if (list) {
      list.innerHTML = "";
      if (!days.length) {
        list.innerHTML = `<div style="color:rgba(15,23,42,.55);font-size:12px;">データなし</div>`;
      } else {
        // 新しい順
        days.slice().sort().reverse().forEach(d => {
          const div = document.createElement("div");
          div.className = "item";
          div.innerHTML = `
            <div class="left">
              <div class="d">${escapeHtml(d)}</div>
              <div class="m">${isAdminMode ? "管理者モード：全件対象" : "本人データのみ"}</div>
            </div>
            <div class="right">
              <button class="btn rainbow">日報PDF</button>
              <button class="btn">URL</button>
            </div>
          `;
          const btnPdf = div.querySelectorAll("button")[0];
          const btnUrl = div.querySelectorAll("button")[1];
          btnPdf.addEventListener("click", () => {
            $("dateDaily") && ($("dateDaily").value = d);
            exportAction("dailyPdf");
          });
          btnUrl.addEventListener("click", async () => {
            // APIリンクは基本使わず（POST統一）なので、ここは「日報作成」を推奨
            await navigator.clipboard.writeText(d);
            toast("日付をコピーしました");
          });
          list.appendChild(div);
        });
      }
    }
    toast("履歴表示OK");
  } catch (err) {
    toast(err.message || String(err), true);
  }
}

/** ===== ログイン状態描画 ===== */
function renderLoginState() {
  const p = getProfile();
  const logged = isLoggedIn();

  // 表示
  if ($("loginState")) {
    $("loginState").innerHTML = logged
      ? `<span class="pill"><span class="dot"></span>ログイン中：${escapeHtml(p?.email || "")}</span>`
      : `<span class="pill ng"><span class="dot"></span>未ログイン</span>`;
  }

  if ($("adminState")) {
    $("adminState").innerHTML = isAdmin()
      ? `<span class="pill"><span class="dot"></span>管理者モード：ON</span>`
      : `<span class="pill ng"><span class="dot"></span>管理者モード：OFF</span>`;
  }

  if ($("logoutBtn")) $("logoutBtn").style.display = logged ? "inline-flex" : "none";
  if ($("goDeparture")) $("goDeparture").disabled = !logged;
  if ($("goArrival")) $("goArrival").disabled = !logged;
  if ($("goExport")) $("goExport").disabled = !logged;

  // exportページ：管理者検索欄の表示
  const adminBox = $("adminSearchBox");
  if (adminBox) adminBox.style.display = isAdmin() ? "block" : "none";
}

/** ===== index：Googleログインボタン生成 ===== */
async function initGoogleLoginUI() {
  await loadGoogleScript();

  if (!window.google?.accounts?.id) throw new Error("Google Login読み込み失敗");

  const btnWrap = $("googleBtn");
  if (!btnWrap) return;

  // Auto-select（可能なら自動ログイン）
  window.google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: (resp) => {
      try {
        const idToken = resp.credential;
        const profile = saveSession(idToken);
        toast(`ログインOK：${profile.email}`);
        renderLoginState();
      } catch (e) {
        toast("ログイン処理エラー", true);
      }
    },
    auto_select: true,
    cancel_on_tap_outside: false
  });

  // ボタン描画
  btnWrap.innerHTML = "";
  window.google.accounts.id.renderButton(btnWrap, {
    theme: "outline",
    size: "large",
    shape: "pill",
    width: 320,
    text: "continue_with",
  });

  // すでにログイン済なら表示更新
  renderLoginState();
}

/** ===== ページ別 init ===== */
function initIndexPage() {
  // links
  $("goDeparture")?.addEventListener("click", () => location.href = "departure.html");
  $("goArrival")?.addEventListener("click", () => location.href = "arrival.html");
  $("goExport")?.addEventListener("click", () => location.href = "export.html");

  $("logoutBtn")?.addEventListener("click", logout);

  $("adminLoginBtn")?.addEventListener("click", adminLogin);
  $("adminLogoutBtn")?.addEventListener("click", adminLogout);

  initGoogleLoginUI().catch(() => toast("Googleログイン設定を確認してください", true));
}

function bindOdoCalc() {
  const calc = () => {
    const s = numOrBlank($("odoStart")?.value);
    const e = numOrBlank($("odoEnd")?.value);
    if ($("odoTotal")) {
      $("odoTotal").value = (s !== "" && e !== "") ? Math.max(0, Number(e) - Number(s)) : "";
    }
  };
  $("odoStart")?.addEventListener("input", calc);
  $("odoEnd")?.addEventListener("input", calc);
}

function initDeparturePage() {
  if (!isLoggedIn()) { toast("ログインしてください", true); setTimeout(()=>location.href="index.html", 600); return; }

  // 初期値
  if ($("date") && !$("date").value) $("date").value = toYMD();
  if ($("time") && !$("time").value) $("time").value = toHM();

  // ログインプロフィールを自動反映
  const p = getProfile();
  if ($("driverName") && !$("driverName").value) $("driverName").value = p?.name || "";
  renderLoginState();

  bindOdoCalc();
  $("btnSubmit")?.addEventListener("click", () => submitTenko("departure"));
  $("backBtn")?.addEventListener("click", () => location.href = "index.html");
}

function initArrivalPage() {
  if (!isLoggedIn()) { toast("ログインしてください", true); setTimeout(()=>location.href="index.html", 600); return; }

  if ($("date") && !$("date").value) $("date").value = toYMD();
  if ($("time") && !$("time").value) $("time").value = toHM();

  const p = getProfile();
  if ($("driverName") && !$("driverName").value) $("driverName").value = p?.name || "";
  renderLoginState();

  bindOdoCalc();
  $("btnSubmit")?.addEventListener("click", () => submitTenko("arrival"));
  $("backBtn")?.addEventListener("click", () => location.href = "index.html");
}

function initExportPage() {
  if (!isLoggedIn()) { toast("ログインしてください", true); setTimeout(()=>location.href="index.html", 600); return; }

  renderLoginState();

  // 初期値
  if ($("dateDaily") && !$("dateDaily").value) $("dateDaily").value = toYMD();
  if ($("month") && !$("month").value) $("month").value = monthISO();
  if ($("historyMonth") && !$("historyMonth").value) $("historyMonth").value = monthISO();

  $("gasUrlView") && ($("gasUrlView").textContent = GAS_WEBAPP_URL);

  $("backBtn")?.addEventListener("click", () => location.href = "index.html");

  $("btnDailyPdf")?.addEventListener("click", () => exportAction("dailyPdf"));
  $("btnMonthlyPdf")?.addEventListener("click", () => exportAction("monthlyPdf"));
  $("btnMonthlyCsv")?.addEventListener("click", () => exportAction("monthlyCsv"));
  $("btnCsvRange")?.addEventListener("click", () => exportAction("csvRange"));

  $("btnLoadHistory")?.addEventListener("click", loadHistory);

  // 管理者の切替
  $("adminLoginBtn")?.addEventListener("click", adminLogin);
  $("adminLogoutBtn")?.addEventListener("click", adminLogout);

  // 管理者検索UI表示
  const adminBox = $("adminSearchBox");
  if (adminBox) adminBox.style.display = isAdmin() ? "block" : "none";
}

/** DOM Ready */
window.addEventListener("DOMContentLoaded", () => {
  const page = document.body?.dataset?.page || "";
  if (page === "index") initIndexPage();
  if (page === "departure") initDeparturePage();
  if (page === "arrival") initArrivalPage();
  if (page === "export") initExportPage();
});
