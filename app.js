/****************************************************
 * OFA 点呼ポータル（GitHub Pages側）完全版
 * - Googleログイン（GIS）→ id_token を localStorage に保存
 * - GASへは ?id_token= で渡す（GAS完全版と整合）
 ****************************************************/

/** ★あなたのGAS WebApp URL（最新に差し替え） */
const GAS_WEBAPP_URL =
  "https://script.google.com/macros/s/AKfycbyODZ_4fnYVkIMKCbVJZvIEwIEP20KMbbMqGdC1_ZmF9l9BE6ZxEGKs7ilmNpCb316Wiw/exec";

/** localStorage keys */
const LS = {
  token: "ofa_id_token",
  email: "ofa_user_email",
  adminKey: "ofa_admin_key",
};

const $ = (id) => document.getElementById(id);

function toast(msg, ng = false) {
  const el = $("toast");
  if (!el) return alert(msg);
  el.textContent = msg;
  el.className = "toast show" + (ng ? " ng" : "");
  setTimeout(() => el.classList.remove("show"), 1900);
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
function normalizeYMD(input) {
  return String(input || "").trim().replace(/\//g, "-");
}
function safeStr(v) {
  return v === undefined || v === null ? "" : String(v).trim();
}
function numOrBlank(v) {
  const s = safeStr(v);
  if (!s) return "";
  const n = Number(s);
  return Number.isFinite(n) ? n : "";
}
function token() {
  return localStorage.getItem(LS.token) || "";
}
function userEmail() {
  return localStorage.getItem(LS.email) || "";
}
function adminKey() {
  return localStorage.getItem(LS.adminKey) || "";
}
function setAdminKey(v) {
  localStorage.setItem(LS.adminKey, String(v || "").trim());
}
function logout() {
  localStorage.removeItem(LS.token);
  localStorage.removeItem(LS.email);
  toast("ログアウトしました");
  updateLoginUI();
}

/** Google ID token から email を軽く取り出す（表示用） */
function decodeJwtEmail(idToken) {
  try {
    const [, payload] = idToken.split(".");
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return json.email || "";
  } catch {
    return "";
  }
}

/** GIS callback */
window.onGoogleCredential = (resp) => {
  const idToken = resp && resp.credential ? resp.credential : "";
  if (!idToken) return toast("ログイン失敗", true);
  localStorage.setItem(LS.token, idToken);
  const email = decodeJwtEmail(idToken);
  if (email) localStorage.setItem(LS.email, email);
  toast("ログインOK");
  updateLoginUI();
};

function updateLoginUI() {
  const badge = $("loginBadge");
  const mail = $("loginMail");
  const btnOut = $("btnLogout");
  const btnInWrap = $("loginButtonWrap");
  const ok = !!token();

  if (badge) {
    badge.innerHTML = ok
      ? `<span class="dot ok"></span>ログイン中`
      : `<span class="dot ng"></span>未ログイン`;
  }
  if (mail) mail.textContent = ok ? (userEmail() || "（email取得中）") : "ログインしてください";
  if (btnOut) btnOut.style.display = ok ? "inline-flex" : "none";
  if (btnInWrap) btnInWrap.style.display = ok ? "none" : "block";

  // 未ログインなら、点呼ページ/出力ページで案内
  const need = document.body?.dataset?.needlogin === "1";
  const gate = $("needLoginGate");
  if (gate) gate.style.display = (!ok && need) ? "block" : "none";
}

function buildUrl(action, params = {}) {
  const u = new URL(GAS_WEBAPP_URL);
  u.searchParams.set("action", action);

  // 認証
  const t = token();
  if (t) u.searchParams.set("id_token", t);

  // 管理者パス（必要なページでだけ使用）
  const ak = adminKey();
  if (ak) u.searchParams.set("adminKey", ak);

  Object.entries(params).forEach(([k, v]) => {
    const s = String(v ?? "").trim();
    if (s !== "") u.searchParams.set(k, s);
  });
  return u.toString();
}

async function apiGet(action, params = {}) {
  const url = buildUrl(action, params);
  const res = await fetch(url, { method: "GET", cache: "no-store" });
  const json = await res.json().catch(() => null);
  return { url, json };
}

async function apiPost(payload) {
  // doPost は action 不要。id_token はURLで渡す
  const u = new URL(GAS_WEBAPP_URL);
  const t = token();
  if (t) u.searchParams.set("id_token", t);

  // 管理者運用での代行送信は基本しない想定だが、念のため
  const ak = adminKey();
  if (ak) u.searchParams.set("adminKey", ak);

  const res = await fetch(u.toString(), {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  });

  const json = await res.json().catch(() => null);
  return { json };
}

/** 画像圧縮 */
async function fileToCompressedDataURL(file, maxW = 1280, quality = 0.75) {
  if (!file) return null;
  if (!file.type || !file.type.startsWith("image/")) return null;

  const { im, url } = await new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () => resolve({ im, url });
    im.onerror = reject;
    im.src = url;
  });

  const w = im.naturalWidth || im.width;
  const h = im.naturalHeight || im.height;
  const scale = Math.min(1, maxW / w);
  const cw = Math.round(w * scale);
  const ch = Math.round(h * scale);

  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(im, 0, 0, cw, ch);

  URL.revokeObjectURL(url);
  return canvas.toDataURL("image/jpeg", quality);
}

async function collectFilesAsDataURLs(inputId, max = 6) {
  const el = $(inputId);
  if (!el || !el.files || !el.files.length) return [];
  const files = Array.from(el.files).slice(0, max);
  const out = [];
  for (const f of files) {
    const du = await fileToCompressedDataURL(f, 1280, 0.75);
    if (du) out.push(du);
  }
  return out;
}

function collectInspection() {
  const keys = [
    "insp_tire","insp_light","insp_brake","insp_wiper",
    "insp_engineOil","insp_coolant","insp_damage","insp_cargo",
  ];
  const obj = {};
  keys.forEach((id) => {
    const el = $(id);
    if (el) obj[id] = safeStr(el.value);
  });
  const note = $("insp_note");
  if (note) obj.note = safeStr(note.value);
  return obj;
}

/** 出発/帰着 送信 */
async function submitTenko(mode) {
  try {
    if (!token()) throw new Error("ログインしてください（Gmail）");

    const date = normalizeYMD(safeStr($("date")?.value));
    const time = safeStr($("time")?.value);

    const driverName = safeStr($("driverName")?.value);
    const driverPhone = safeStr($("driverPhone")?.value);
    const vehicleNo = safeStr($("vehicleNo")?.value);

    const managerName = safeStr($("managerName")?.value);
    const method = safeStr($("method")?.value);
    const place = safeStr($("place")?.value);
    const alcoholValue = safeStr($("alcoholValue")?.value);
    const alcoholBand = safeStr($("alcoholBand")?.value);
    const memo = safeStr($("memo")?.value);

    const odoStart = numOrBlank($("odoStart")?.value);
    const odoEnd = numOrBlank($("odoEnd")?.value);
    let odoTotal = "";
    if (odoStart !== "" && odoEnd !== "") odoTotal = Math.max(0, Number(odoEnd) - Number(odoStart));

    const licenseNo = safeStr($("licenseNo")?.value);

    // arrival（日報）
    const workType = safeStr($("workType")?.value);
    const workArea = safeStr($("workArea")?.value);
    const workHours = safeStr($("workHours")?.value);
    const deliveryCount = safeStr($("deliveryCount")?.value);
    const trouble = safeStr($("trouble")?.value);
    const dailyNote = safeStr($("dailyNote")?.value);

    const must = (v, name) => { if (!v) throw new Error(`未入力: ${name}`); };
    must(date, "日付");
    must(time, "時刻");
    must(driverName, "運転者氏名");
    must(vehicleNo, "車両番号");
    must(managerName, "点呼実施者");
    must(method, "点呼方法");
    must(alcoholValue, "アルコール測定値");
    must(alcoholBand, "酒気帯び");

    const inspection = collectInspection();
    const photos = await collectFilesAsDataURLs("tenkoPhotos", 6);
    const reportPhotos = await collectFilesAsDataURLs("reportPhotos", 6);
    const licensePhotos = await collectFilesAsDataURLs("licensePhotos", 6);

    const payload = {
      app: "OFA_TENKO",
      mode,
      data: {
        date, time,
        driverName, driverPhone, vehicleNo,
        managerName, method, place,
        alcoholValue, alcoholBand, memo,
        odoStart, odoEnd, odoTotal,
        licenseNo,
        inspection,

        workType, workArea, workHours, deliveryCount, trouble, dailyNote
      },
      photos,
      reportPhotos,
      licensePhotos,
    };

    $("btnSubmit") && ($("btnSubmit").disabled = true);
    toast("送信中…");

    const r = await apiPost(payload);
    if (!r.json || !r.json.ok) throw new Error(r.json?.message || "送信失敗");

    toast("送信OK（保存完了）");
    setTimeout(() => (location.href = "index.html"), 650);
  } catch (err) {
    toast(err.message || String(err), true);
    $("btnSubmit") && ($("btnSubmit").disabled = false);
  }
}

/** PDF/CSV出力 */
async function runExport(action, params) {
  try {
    if (!token()) throw new Error("ログインしてください（Gmail）");
    toast("作成中…");

    const r = await apiGet(action, params);
    if (!r.json || !r.json.ok || !r.json.url) {
      throw new Error(r.json?.message || "作成失敗");
    }

    const box = $("resultBox");
    if (box) {
      box.style.display = "block";
      box.innerHTML = `
        <div style="font-weight:900;margin-bottom:6px;">✅ 作成完了</div>
        <div>リンク：<a href="${r.json.url}" target="_blank" rel="noopener">${r.json.url}</a></div>
        <div class="pills" style="margin-top:8px;">
          <button class="btn small primary" onclick="window.open('${r.json.url}','_blank')">開く</button>
          <button class="btn small" onclick="navigator.clipboard.writeText('${r.json.url}'); toast('コピーしました');">コピー</button>
        </div>
      `;
    }

    window.open(r.json.url, "_blank");
  } catch (err) {
    toast(err.message || String(err), true);
  }
}

/** 履歴（月） */
async function loadHistory(month, name) {
  try {
    if (!token()) throw new Error("ログインしてください（Gmail）");
    toast("履歴取得中…");

    const r = await apiGet("historyDays", { month, name });
    if (!r.json || !r.json.ok || !Array.isArray(r.json.days)) {
      throw new Error(r.json?.message || "履歴取得失敗");
    }

    const days = r.json.days;
    $("historyBox").style.display = "block";
    $("historyCount").textContent = `${days.length}件`;

    const list = $("historyList");
    list.innerHTML = "";

    if (days.length === 0) {
      list.innerHTML = `<div class="note">データなし</div>`;
      return;
    }

    days.slice().reverse().forEach((d) => {
      const div = document.createElement("div");
      div.className = "result";
      div.innerHTML = `
        <div style="font-weight:900;margin-bottom:8px;">${d}</div>
        <div class="pills">
          <button class="btn small primary">日報PDF</button>
          <button class="btn small rain">APIリンク</button>
        </div>
      `;
      div.querySelectorAll("button")[0].addEventListener("click", () => {
        runExport("dailyPdf", { date: d, name });
      });
      div.querySelectorAll("button")[1].addEventListener("click", async () => {
        const url = buildUrl("dailyPdf", { date: d, name });
        await navigator.clipboard.writeText(url);
        toast("APIリンクをコピーしました");
      });
      list.appendChild(div);
    });

    toast("履歴表示OK");
  } catch (err) {
    toast(err.message || String(err), true);
  }
}

/** 管理者検索 */
async function adminSearch(params) {
  try {
    if (!token()) throw new Error("ログインしてください（Gmail）");
    if (!adminKey()) throw new Error("管理者パスワード（adminKey）を入力してください");

    toast("検索中…");
    const r = await apiGet("search", params);
    if (!r.json || !r.json.ok) throw new Error(r.json?.message || "検索失敗");

    return r.json;
  } catch (err) {
    toast(err.message || String(err), true);
    return null;
  }
}

/** ===== ページ初期化 ===== */
function initPage() {
  updateLoginUI();

  // 共通：戻る
  $("backBtn")?.addEventListener("click", () => {
    if (history.length > 1) history.back();
    else location.href = "index.html";
  });

  // ログアウト
  $("btnLogout")?.addEventListener("click", logout);

  // 管理者キー保存
  $("adminKey")?.addEventListener("input", (e) => setAdminKey(e.target.value));
  if ($("adminKey")) $("adminKey").value = adminKey();

  // departure/arrival
  const page = document.body?.dataset?.page || "";
  if (page === "departure" || page === "arrival") {
    if ($("date") && !$("date").value) $("date").value = toYMD();
    if ($("time") && !$("time").value) $("time").value = toHM();

    const calc = () => {
      const s = numOrBlank($("odoStart")?.value);
      const e = numOrBlank($("odoEnd")?.value);
      if ($("odoTotal")) $("odoTotal").value = (s !== "" && e !== "") ? Math.max(0, Number(e) - Number(s)) : "";
    };
    $("odoStart")?.addEventListener("input", calc);
    $("odoEnd")?.addEventListener("input", calc);

    $("btnSubmit")?.addEventListener("click", () => submitTenko(page));
  }

  // export
  if (page === "export") {
    $("dateDaily").value = toYMD();
    const d = new Date();
    $("month").value = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    $("historyMonth").value = $("month").value;

    $("btnDailyPdf")?.addEventListener("click", () => runExport("dailyPdf", {
      date: $("dateDaily").value,
      name: $("name").value
    }));
    $("btnMonthlyPdf")?.addEventListener("click", () => runExport("monthlyPdf", {
      month: $("month").value,
      name: $("name").value
    }));
    $("btnMonthlyCsv")?.addEventListener("click", () => runExport("monthlyCsv", {
      month: $("month").value,
      name: $("name").value
    }));
    $("btnCsvRange")?.addEventListener("click", () => runExport("csvRange", {
      from: $("fromDate").value,
      to: $("toDate").value,
      name: $("name").value
    }));
    $("btnLoadHistory")?.addEventListener("click", () => loadHistory(
      $("historyMonth").value,
      $("name").value
    ));

    $("gasUrlView").textContent = GAS_WEBAPP_URL;
  }

  // admin
  if (page === "admin") {
    $("gasUrlView").textContent = GAS_WEBAPP_URL;

    $("btnDoSearch")?.addEventListener("click", async () => {
      const out = await adminSearch({
        from: $("s_from").value,
        to: $("s_to").value,
        name: $("s_name").value,
        phone: $("s_phone").value,
        vehicleNo: $("s_vehicle").value,
        q: $("s_q").value
      });
      if (!out) return;

      $("searchCount").textContent = `${out.count}件（表示 ${out.returned}件）`;
      const box = $("searchResult");
      box.innerHTML = "";

      if (!out.rows || !out.rows.length) {
        box.innerHTML = `<div class="note">該当なし</div>`;
        return;
      }

      // テーブル表示（上限200）
      const table = document.createElement("table");
      table.className = "table";
      table.innerHTML = `
        <thead>
          <tr>
            <th>日付</th><th>時刻</th><th>区分</th><th>運転者</th><th>電話</th><th>車両</th><th>email</th><th>操作</th>
          </tr>
        </thead>
        <tbody></tbody>
      `;
      const tb = table.querySelector("tbody");

      out.rows.forEach(r => {
        const tr = document.createElement("tr");
        const date = r.date || "";
        const time = r.time || "";
        const mode = r.mode || "";
        const name = r.driverName || "";
        const phone = r.driverPhone || "";
        const vehicle = r.vehicleNo || "";
        const email = r.userEmail || "";

        tr.innerHTML = `
          <td>${date}</td>
          <td>${time}</td>
          <td>${mode}</td>
          <td>${name}</td>
          <td>${phone}</td>
          <td>${vehicle}</td>
          <td>${email}</td>
          <td>
            <div class="pills">
              <button class="btn small primary">日報PDF</button>
              <button class="btn small">API</button>
            </div>
          </td>
        `;
        tr.querySelectorAll("button")[0].addEventListener("click", () => runExport("dailyPdf", {
          date,
          name: "" // 管理者で個人絞り込みしたいなら name を入れる。ここでは日付の全内容を優先
        }));
        tr.querySelectorAll("button")[1].addEventListener("click", async () => {
          const url = buildUrl("dailyPdf", { date });
          await navigator.clipboard.writeText(url);
          toast("APIリンクをコピーしました");
        });

        tb.appendChild(tr);
      });

      box.appendChild(table);
      toast("検索完了");
    });
  }
}

window.addEventListener("DOMContentLoaded", initPage);
