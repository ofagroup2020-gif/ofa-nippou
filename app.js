/* =========================================================
   OFA 点呼・点検（GitHub Pages Front）
   - departure.html / arrival.html / reports.html 共通JS
   - フォーム自動検出 → GAS WebApp(doPost)へ保存
   - 写真：複数OK / 自動圧縮 → dataURL
   - 免許：番号入力 or 写真アップどちらでもOK
   ========================================================= */

/** ★ここだけあなたの最新GAS URLに統一 */
const GAS_WEBAPP_URL =
  "https://script.google.com/macros/s/AKfycbzvyQxtaHQzeqBTchiNsq6aR85mh6-rh8mfBrLWE820oF6gfdO8Zwpa6X3hfHcPbSdoJg/exec";

/** 画像圧縮設定（安全寄り） */
const IMG_CFG = {
  maxEdge: 1280,           // 長辺最大
  quality: 0.78,           // JPEG品質
  maxEachBytes: 900 * 1024,// 1枚あたり目安
  maxCount: 6              // 送る枚数上限（GAS側も上限推奨）
};

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function toast(msg, type = "info") {
  const el = $("#toast");
  if (!el) return alert(msg);
  el.textContent = msg;
  el.dataset.type = type;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2600);
}

/** 文字列整形 */
function s(v) {
  return (v == null ? "" : String(v)).trim();
}

/** yyyy-mm-dd */
function fmtDate(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}
/** hh:mm */
function fmtTime(d = new Date()) {
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

/** ページ種別（departure/arrival/reports）を推定 */
function detectMode() {
  // 1) body data-mode
  const bm = document.body && document.body.dataset ? document.body.dataset.mode : "";
  if (bm) return bm;

  // 2) hidden input name=mode
  const mi = $('input[name="mode"]');
  if (mi && mi.value) return mi.value;

  // 3) URL/ファイル名で推定
  const p = location.pathname.toLowerCase();
  if (p.includes("departure")) return "departure";
  if (p.includes("arrival")) return "arrival";
  if (p.includes("reports")) return "reports";

  // 4) タイトルで推定
  const t = (document.title || "").toLowerCase();
  if (t.includes("出発")) return "departure";
  if (t.includes("帰着")) return "arrival";
  if (t.includes("日報") || t.includes("月報")) return "reports";

  return "";
}

/** formから input/select/textarea を集めて object 化（name優先） */
function collectFormData(form) {
  const data = {};
  const els = $$("input, select, textarea", form);

  for (const el of els) {
    if (!el.name) continue;

    // fileは別処理
    if (el.type === "file") continue;

    if (el.type === "checkbox") {
      data[el.name] = el.checked ? "1" : "0";
      continue;
    }
    if (el.type === "radio") {
      if (!el.checked) continue;
      data[el.name] = s(el.value);
      continue;
    }

    data[el.name] = s(el.value);
  }

  // date/timeが空なら自動
  if (!data.date) data.date = fmtDate();
  if (!data.time) data.time = fmtTime();

  return data;
}

/** file input 取得（複数候補で拾う） */
function findFileInputs(form) {
  // よくあるname/idを優先的に拾う（無ければ file 全部）
  const by = (sel) => $$(sel, form).filter((x) => x && x.files);

  const tenko =
    by('input[type="file"][name="photos"]')
      .concat(by('input[type="file"]#photos'))
      .concat(by('input[type="file"][name="tenkoPhotos"]'))
      .concat(by('input[type="file"]#tenkoPhotos'));

  const report =
    by('input[type="file"][name="reportPhotos"]')
      .concat(by('input[type="file"]#reportPhotos'))
      .concat(by('input[type="file"][name="dailyPhotos"]'))
      .concat(by('input[type="file"]#dailyPhotos'));

  const license =
    by('input[type="file"][name="licensePhotos"]')
      .concat(by('input[type="file"]#licensePhotos'))
      .concat(by('input[type="file"][name="licensePhoto"]'))
      .concat(by('input[type="file"]#licensePhoto'));

  // 重複排除
  const uniq = (arr) => Array.from(new Set(arr));

  const tenkoU = uniq(tenko);
  const reportU = uniq(report);
  const licenseU = uniq(license);

  // どれにも入らない file input があれば tenko扱いに寄せる
  const allFiles = by('input[type="file"]');
  const known = new Set([...tenkoU, ...reportU, ...licenseU]);
  for (const f of allFiles) {
    if (!known.has(f)) tenkoU.push(f);
  }

  return { tenkoInputs: tenkoU, reportInputs: reportU, licenseInputs: licenseU };
}

/** 画像ファイル → 圧縮dataURL */
async function fileToCompressedDataUrl(file) {
  // 画像以外は拒否
  if (!file || !file.type || !file.type.startsWith("image/")) {
    throw new Error("画像ファイルではありません");
  }

  const img = await loadImage(file);
  const { canvas, ctx, w, h } = fitToCanvas(img, IMG_CFG.maxEdge);

  // 描画
  ctx.drawImage(img, 0, 0, w, h);

  // JPEG化
  let q = IMG_CFG.quality;
  let dataUrl = canvas.toDataURL("image/jpeg", q);

  // サイズが大きい場合は品質を落とす（安全弁）
  for (let i = 0; i < 6; i++) {
    const bytes = estimateDataUrlBytes(dataUrl);
    if (bytes <= IMG_CFG.maxEachBytes) break;
    q = Math.max(0.45, q - 0.08);
    dataUrl = canvas.toDataURL("image/jpeg", q);
  }

  return dataUrl;
}

function estimateDataUrlBytes(dataUrl) {
  // base64 -> bytes だいたい 3/4
  const m = String(dataUrl).match(/base64,(.*)$/);
  if (!m) return 0;
  const b64 = m[1];
  return Math.floor((b64.length * 3) / 4);
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => reject(new Error("画像を読み込めませんでした"));
    img.src = url;
  });
}

function fitToCanvas(img, maxEdge) {
  const ow = img.naturalWidth || img.width;
  const oh = img.naturalHeight || img.height;
  let w = ow, h = oh;

  const edge = Math.max(ow, oh);
  if (edge > maxEdge) {
    const scale = maxEdge / edge;
    w = Math.round(ow * scale);
    h = Math.round(oh * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  return { canvas, ctx, w, h };
}

/** file input (複数) → dataURL配列（上限つき） */
async function compressFilesFromInputs(inputs) {
  const files = [];
  for (const input of inputs) {
    if (!input || !input.files) continue;
    for (const f of Array.from(input.files)) files.push(f);
  }
  const limited = files.slice(0, IMG_CFG.maxCount);

  const out = [];
  for (const f of limited) {
    const du = await fileToCompressedDataUrl(f);
    out.push(du);
  }
  return out;
}

/** GASへPOST（CORS回避のため no-cors でも送れる形に寄せる）
    - GAS側は JSON.parse(e.postData.contents) で受け取る想定 */
async function postToGAS(payload) {
  // 失敗検知のため通常CORSで試す → だめなら no-cors で送る（iOS/Chrome差分対策）
  const body = JSON.stringify(payload);

  // 1) 通常
  try {
    const res = await fetch(GAS_WEBAPP_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body
    });
    // GASはJSONを返す想定
    const txt = await res.text();
    try {
      return JSON.parse(txt);
    } catch {
      // JSONじゃなくても「送信成功」とみなすケースあり
      return { ok: res.ok, raw: txt };
    }
  } catch (e) {
    // 2) no-cors fallback（レスポンス読めないが送信はできる）
    await fetch(GAS_WEBAPP_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body
    });
    return { ok: true, message: "sent(no-cors)" };
  }
}

/** ping（接続確認） */
async function pingGAS() {
  try {
    const u = GAS_WEBAPP_URL + "?ping=1";
    const r = await fetch(u, { cache: "no-store" });
    const t = await r.text();
    if (t.includes("pong") || t.includes('"pong"')) {
      toast("GAS接続OK（pong）", "ok");
    } else {
      toast("GAS応答あり（pongではない）", "info");
    }
  } catch {
    toast("GAS接続NG（URL/公開設定を確認）", "ng");
  }
}

/** 必須チェック（最低限） */
function validate(mode, data) {
  const required = ["date", "time"];

  // 共通（あなたのGAS must() と合わせる）
  required.push("driverName", "vehicleNo", "managerName", "method", "alcoholValue", "alcoholBand", "memo");

  // arrival は日報系も必須にしている構成が多い
  if (mode === "arrival") {
    // ここは arrival.html 側の name に合わせてください（存在しないなら無視されます）
    // 例: workType / dailyNote を必須扱いにする
    required.push("workType", "dailyNote");
  }

  for (const k of required) {
    if (!s(data[k])) return { ok: false, message: `未入力：${k}` };
  }
  return { ok: true };
}

/** 送信中 UI */
function setSending(isSending) {
  $$("button, input, select, textarea").forEach((el) => {
    if (el.dataset.keepEnabled === "1") return;
    el.disabled = !!isSending;
  });
  const sp = $("#sending");
  if (sp) sp.style.display = isSending ? "block" : "none";
}

/** 送信処理（departure/arrival共通） */
async function handleSubmit(form, mode) {
  try {
    setSending(true);

    const data = collectFormData(form);

    // バリデーション
    const v = validate(mode, data);
    if (!v.ok) {
      toast(v.message, "ng");
      setSending(false);
      return;
    }

    // 写真処理
    const { tenkoInputs, reportInputs, licenseInputs } = findFileInputs(form);

    toast("写真を圧縮中…", "info");
    const photos = await compressFilesFromInputs(tenkoInputs);
    const reportPhotos = await compressFilesFromInputs(reportInputs);
    const licensePhotos = await compressFilesFromInputs(licenseInputs);

    // 写真有無フラグ（PDF/月次で使える）
    data.hasTenkoPhotos = photos.length ? "1" : "0";
    data.hasReportPhotos = reportPhotos.length ? "1" : "0";
    data.hasLicensePhotos = licensePhotos.length ? "1" : "0";

    // payload
    const payload = {
      app: "OFA_TENKO",
      mode,
      data,
      photos,
      reportPhotos,
      licensePhotos,
      ua: navigator.userAgent,
      ts: Date.now()
    };

    toast("送信中…", "info");
    const res = await postToGAS(payload);

    if (res && res.ok) {
      toast("保存OK ✅", "ok");
      // 送信後にトップへ戻す（要望どおり）
      setTimeout(() => {
        location.href = "./index.html";
      }, 600);
    } else {
      toast(`保存NG：${(res && (res.message || res.error)) || "unknown"}`, "ng");
      setSending(false);
    }
  } catch (e) {
    toast(`エラー：${e.message || e}`, "ng");
    setSending(false);
  }
}

/** reports.html（PDF/CSVボタン） */
async function handleReports() {
  // 日報/月報/CSV 生成ボタンを data-action で拾う
  // 例: <button data-action="dailyPdf">…</button>
  const btns = $$("[data-action]");
  if (!btns.length) return;

  btns.forEach((btn) => {
    btn.addEventListener("click", async (ev) => {
      ev.preventDefault();
      const action = btn.dataset.action;

      // reportsの入力欄（nameを拾う）
      const form = btn.closest("form") || document;
      const data = {};
      $$("input, select, textarea", form).forEach((el) => {
        if (!el.name || el.type === "file") return;
        data[el.name] = s(el.value);
      });

      // date / ym など補完
      if (!data.date) data.date = fmtDate();
      if (!data.ym) {
        const now = new Date();
        data.ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      }

      setSending(true);
      toast("作成中…", "info");

      const payload = {
        app: "OFA_TENKO",
        mode: "report",
        action,      // dailyPdf / monthlyPdf / monthlyCsv など
        data,
        ts: Date.now()
      };

      const res = await postToGAS(payload);
      setSending(false);

      if (res && res.ok) {
        if (res.url) {
          toast("作成OK（URLを表示）", "ok");
          // URL表示エリア
          const out = $("#resultUrl");
          if (out) {
            out.value = res.url;
            out.style.display = "block";
          } else {
            // ない場合はalert
            alert(res.url);
          }
        } else {
          toast("作成OK", "ok");
        }
      } else {
        toast(`作成NG：${(res && (res.message || res.error)) || "unknown"}`, "ng");
      }
    });
  });
}

/** 初期化 */
window.addEventListener("load", async () => {
  // GAS接続確認ボタン（任意）
  const pingBtn = $("#pingBtn");
  if (pingBtn) pingBtn.addEventListener("click", (e) => (e.preventDefault(), pingGAS()));

  const mode = detectMode();

  // departure / arrival
  const form = $("#tenkoForm") || $("form");
  if ((mode === "departure" || mode === "arrival") && form) {
    // submitボタン (id=submitBtn) があればクリックでも送れるように
    const submitBtn = $("#submitBtn") || $('[type="submit"]');
    if (submitBtn) submitBtn.dataset.keepEnabled = "1"; // 送信中disable除外したいなら

    form.addEventListener("submit", (ev) => {
      ev.preventDefault();
      handleSubmit(form, mode);
    });

    // submitボタンが type=button の場合にも対応
    if (submitBtn && submitBtn.type === "button") {
      submitBtn.addEventListener("click", (ev) => {
        ev.preventDefault();
        handleSubmit(form, mode);
      });
    }

    // date/timeが空なら自動セット（入力補助）
    const dateEl = $('input[name="date"]');
    const timeEl = $('input[name="time"]');
    if (dateEl && !dateEl.value) dateEl.value = fmtDate();
    if (timeEl && !timeEl.value) timeEl.value = fmtTime();

    // 簡易：戻るボタン（class=backBtn or id=backBtn）
    const backBtn = $("#backBtn") || $(".backBtn");
    if (backBtn) {
      backBtn.addEventListener("click", (e) => {
        e.preventDefault();
        location.href = "./index.html";
      });
    }

    return;
  }

  // reports
  if (mode === "reports") {
    handleReports();
    return;
  }
});
