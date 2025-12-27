(() => {
  const KEY_API = "ofa_tenko_api_url_v1";

  const $ = (id) => document.getElementById(id);

  const elApi = $("apiUrl");
  const elStatus = $("status");
  const elStatusText = $("statusText");
  const elMsg = $("msg");

  const elModeStart = $("modeStart");
  const elModeEnd = $("modeEnd");
  const elMeterLabel = $("meterLabel");

  const elInspection = $("inspection");
  const elInspectionDetailWrap = $("inspectionDetailWrap");
  const elInspectionDetail = $("inspectionDetail");

  const form = $("tenkoForm");

  const setMsg = (type, text) => {
    elMsg.className = "msg " + (type === "ok" ? "ok" : "ng");
    elMsg.textContent = text;
    elMsg.style.display = "block";
  };

  const clearMsg = () => {
    elMsg.style.display = "none";
    elMsg.textContent = "";
    elMsg.className = "msg";
  };

  const setStatus = (kind, text) => {
    elStatus.className = "status " + (kind === "ok" ? "status-ok" : kind === "ng" ? "status-ng" : "status-idle");
    elStatusText.textContent = text;
  };

  const normalizeApiUrl = (u) => {
    if (!u) return "";
    u = u.trim();
    // 末尾スラッシュや空白を吸収
    u = u.replace(/\s+/g, "");
    // /exec が無ければ付けない（ユーザーの意図を尊重）
    return u;
  };

  const getApiUrl = () => normalizeApiUrl(elApi.value || localStorage.getItem(KEY_API) || "");
  const saveApiUrl = () => {
    const u = normalizeApiUrl(elApi.value);
    localStorage.setItem(KEY_API, u);
    elApi.value = u;
    setStatus("idle", "保存しました（接続テストを押してください）");
  };

  const apiGet = async (url, qsObj) => {
    const qs = new URLSearchParams(qsObj || {}).toString();
    const full = qs ? `${url}?${qs}` : url;
    const res = await fetch(full, { method: "GET" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.ok === false) throw new Error(json.error || `GET失敗: ${res.status}`);
    return json;
  };

  const apiPost = async (url, bodyObj) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" }, // GAS安定
      body: JSON.stringify(bodyObj),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.ok === false) throw new Error(json.error || `POST失敗: ${res.status}`);
    return json;
  };

  const toISODate = (d) => {
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  const toISOMonth = (d) => {
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  };

  // 画像圧縮（HEICはブラウザが読めない場合あり→その時はnullで返して注意）
  const compressToDataUrl = (file, max = 1600, quality = 0.82) =>
    new Promise((resolve) => {
      if (!file) return resolve(null);

      // HEICは type が image/heic のことが多い
      const isHeic = (file.type || "").toLowerCase().includes("heic") || file.name.toLowerCase().endsWith(".heic");
      if (isHeic) {
        // 送らずに注意（落ちない）
        return resolve({ error: "HEIC画像は変換できない場合があります。JPEGを選択してください。", dataUrl: null });
      }

      const img = new Image();
      const fr = new FileReader();
      fr.onload = () => (img.src = fr.result);
      fr.onerror = () => resolve({ error: "画像読み込みに失敗しました。", dataUrl: null });

      img.onload = () => {
        const w = img.width, h = img.height;
        const scale = Math.min(1, max / Math.max(w, h));
        const tw = Math.round(w * scale);
        const th = Math.round(h * scale);

        const canvas = document.createElement("canvas");
        canvas.width = tw;
        canvas.height = th;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, tw, th);
        try {
          const dataUrl = canvas.toDataURL("image/jpeg", quality);
          resolve({ error: null, dataUrl });
        } catch (e) {
          resolve({ error: "画像変換に失敗しました。別の画像（JPEG）で試してください。", dataUrl: null });
        }
      };

      img.onerror = () => resolve({ error: "画像の形式が非対応の可能性があります（JPEG推奨）。", dataUrl: null });

      fr.readAsDataURL(file);
    });

  const modeState = { mode: "start" };

  const setMode = (mode) => {
    modeState.mode = mode;

    const onStart = mode === "start";
    elModeStart.classList.toggle("is-on", onStart);
    elModeEnd.classList.toggle("is-on", !onStart);

    elMeterLabel.textContent = onStart ? "メーター（出発）" : "メーター（帰着）";
    $("meter").placeholder = onStart ? "例：12345" : "例：12580";

    // 帰着は「帰着メーター必須」運用に寄せる（どちらも必須にしたいならここを調整）
    $("meter").required = true;
  };

  const updateInspectionDetail = () => {
    const v = elInspection.value;
    const show = v === "異常あり";
    elInspectionDetailWrap.style.display = show ? "block" : "none";
    elInspectionDetail.required = show;
    if (!show) elInspectionDetail.value = "";
  };

  const ensureDefaultDates = () => {
    const now = new Date();
    const d = $("pdfDate");
    const m = $("pdfMonth");
    if (!d.value) d.value = toISODate(now);
    if (!m.value) m.value = toISOMonth(now);
  };

  const validateApiUrl = () => {
    const u = getApiUrl();
    if (!u) throw new Error("API URL を入れてください");
    if (!/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec/.test(u)) {
      // ライブラリURLや途中URLを誤入力しがちなので強めに弾く
      throw new Error("API URL が正しくありません（.../macros/s/XXXX/exec の形）");
    }
    return u;
  };

  const ping = async () => {
    clearMsg();
    const api = validateApiUrl();
    setStatus("idle", "接続確認中…");
    const json = await apiGet(api, { ping: "1" });
    setStatus("ok", `接続OK（到達）`);
    return json;
  };

  const buildPayload = async () => {
    const mode = modeState.mode; // start/end
    const payload = {
      type: mode === "start" ? "出発" : "帰着",
      driver: $("driver").value.trim(),
      vehicle: $("vehicle").value.trim(),
      phone: $("phone").value.trim(),
      area: $("area").value.trim(),
      route: $("route").value.trim(),

      alcohol: $("alcohol").value,
      alcoholValue: $("alcoholValue").value.trim(),
      condition: $("condition").value,
      fatigue: $("fatigue").value,
      temp: $("temp").value.trim(),
      sleep: $("sleep").value.trim(),
      medication: $("medication").value,
      healthMemo: $("healthMemo").value.trim(),

      inspection: $("inspection").value,
      inspectionDetail: $("inspectionDetail").value.trim(),
      meter: $("meter").value.trim(),

      memo: $("memo").value.trim(),

      // 写真は dataUrl として送る（GAS側でDrive保存してURL化）
      photos: {}
    };

    // 画像（HEICは落とさない）
    const files = {
      inspectionPhoto: $("photoInspection").files[0],
      alcoholPhoto: $("photoAlcohol").files[0],
      meterPhoto: $("photoMeter").files[0],
      otherPhoto: $("photoOther").files[0],
    };

    let warn = [];
    for (const [k, f] of Object.entries(files)) {
      if (!f) continue;
      const out = await compressToDataUrl(f);
      if (out?.error) warn.push(out.error);
      if (out?.dataUrl) payload.photos[k] = out.dataUrl;
    }

    return { payload, warn };
  };

  const submit = async (ev) => {
    ev.preventDefault();
    clearMsg();

    try {
      const api = validateApiUrl();

      // 入力チェック（最低限）
      if (!$("driver").value.trim()) throw new Error("氏名を入力してください");
      if (!$("vehicle").value.trim()) throw new Error("車両番号を入力してください");
      if (!$("meter").value.trim()) throw new Error("メーターを入力してください");

      if ($("inspection").value === "異常あり" && !$("inspectionDetail").value.trim()) {
        throw new Error("異常内容を入力してください");
      }

      $("btnSubmit").disabled = true;
      $("btnSubmit").textContent = "送信中…";

      const { payload, warn } = await buildPayload();

      const res = await apiPost(api, payload);

      const extra = warn.length ? `\n（注意）${warn.join(" / ")}` : "";
      setMsg("ok", `✅ 送信しました${extra}`);

      // 写真選択だけクリア（入力は運用次第：ここは残す）
      $("photoInspection").value = "";
      $("photoAlcohol").value = "";
      $("photoMeter").value = "";
      $("photoOther").value = "";

      // 異常時はUI側でも目立たせる
      if (payload.alcohol !== "問題なし" || payload.condition === "不良" || payload.inspection === "異常あり") {
        // 何もしない（GAS側通知に任せる）
      }

      // 接続状態はOKのまま
      setStatus("ok", "接続OK（送信OK）");
    } catch (e) {
      setMsg("ng", `❌ 送信に失敗しました：${e.message || e}`);
      setStatus("ng", "接続NG（URL/権限/画像形式を確認）");
    } finally {
      $("btnSubmit").disabled = false;
      $("btnSubmit").textContent = "送信";
    }
  };

  const dailyPdf = async () => {
    clearMsg();
    const api = validateApiUrl();
    const name = $("driver").value.trim();
    const date = $("pdfDate").value;
    if (!date) throw new Error("日付を選択してください");

    const json = await apiGet(api, { pdf: "daily", date, name });
    if (json.url) window.open(json.url, "_blank");
    setMsg("ok", "✅ 日報PDFを作成しました（Driveに保存済み）");
  };

  const monthlyPdf = async () => {
    clearMsg();
    const api = validateApiUrl();
    const name = $("driver").value.trim();
    const ym = $("pdfMonth").value; // YYYY-MM
    if (!ym) throw new Error("年月を選択してください");

    const json = await apiGet(api, { pdf: "monthly", ym, name });
    if (json.url) window.open(json.url, "_blank");
    setMsg("ok", "✅ 月報PDFを作成しました（Driveに保存済み）");
  };

  const monthlyCsv = async () => {
    clearMsg();
    const api = validateApiUrl();
    const name = $("driver").value.trim();
    const ym = $("pdfMonth").value;
    if (!ym) throw new Error("年月を選択してください");

    const json = await apiGet(api, { csv: "monthly", ym, name });
    if (json.url) window.open(json.url, "_blank");
    setMsg("ok", "✅ 月次CSVを作成しました（Driveに保存済み）");
  };

  // init
  document.addEventListener("DOMContentLoaded", async () => {
    // API URL復元
    const saved = localStorage.getItem(KEY_API) || "";
    if (saved) elApi.value = saved;

    ensureDefaultDates();
    setMode("start");
    updateInspectionDetail();

    $("btnSaveApi").addEventListener("click", () => {
      saveApiUrl();
      clearMsg();
    });

    $("btnPing").addEventListener("click", async () => {
      try { await ping(); clearMsg(); }
      catch(e){ setMsg("ng", `❌ ${e.message || e}`); }
    });

    elModeStart.addEventListener("click", () => { setMode("start"); clearMsg(); });
    elModeEnd.addEventListener("click", () => { setMode("end"); clearMsg(); });

    elInspection.addEventListener("change", updateInspectionDetail);

    $("btnDailyPdf").addEventListener("click", async () => {
      try { await dailyPdf(); } catch(e){ setMsg("ng", `❌ ${e.message || e}`); }
    });
    $("btnMonthlyPdf").addEventListener("click", async () => {
      try { await monthlyPdf(); } catch(e){ setMsg("ng", `❌ ${e.message || e}`); }
    });
    $("btnMonthlyCsv").addEventListener("click", async () => {
      try { await monthlyCsv(); } catch(e){ setMsg("ng", `❌ ${e.message || e}`); }
    });

    form.addEventListener("submit", submit);

    // いきなり勝手にpingしない（通信失敗で不安にさせるので）
    setStatus("idle", saved ? "未確認（接続テストを押してください）" : "API URL を入力してください");
  });
})();
