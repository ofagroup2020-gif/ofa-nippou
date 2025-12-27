(() => {
  const $ = (id) => document.getElementById(id);

  const els = {
    apiUrl: $("apiUrl"),
    btnPing: $("btnPing"),
    dot: $("dot"),
    statusText: $("statusText"),
    statusMsg: $("statusMsg"),
    linkArea: $("linkArea"),

    tabStart: $("tabStart"),
    tabEnd: $("tabEnd"),

    dailyDate: $("dailyDate"),
    monthYm: $("monthYm"),
    btnDailyPdf: $("btnDailyPdf"),
    btnMonthlyPdf: $("btnMonthlyPdf"),
    btnMonthlyCsv: $("btnMonthlyCsv"),

    driver: $("driver"),
    vehicle: $("vehicle"),
    phone: $("phone"),
    area: $("area"),
    route: $("route"),

    alcohol: $("alcohol"),
    alcoholValue: $("alcoholValue"),
    condition: $("condition"),
    fatigue: $("fatigue"),
    temp: $("temp"),
    sleep: $("sleep"),
    medicine: $("medicine"),
    healthMemo: $("healthMemo"),
    runMemo: $("runMemo"),

    inspection: $("inspection"),
    inspectionDetail: $("inspectionDetail"),
    meterStart: $("meterStart"),
    meterEnd: $("meterEnd"),

    chkTire: $("chkTire"),
    chkBrake: $("chkBrake"),
    chkLight: $("chkLight"),
    chkOil: $("chkOil"),
    chkCoolant: $("chkCoolant"),
    chkWiper: $("chkWiper"),
    chkHorn: $("chkHorn"),
    chkMirror: $("chkMirror"),
    chkLoad: $("chkLoad"),
    chkWarning: $("chkWarning"),

    photoInspection: $("photoInspection"),
    photoAlcohol: $("photoAlcohol"),
    photoMeter: $("photoMeter"),
    photoOther: $("photoOther"),

    memo: $("memo"),
    btnSubmit: $("btnSubmit"),
    submitMsg: $("submitMsg")
  };

  let mode = "start"; // start / end

  // ---- LocalStorage (API URL) ----
  const KEY = "ofa_api_url";
  function loadApiUrl(){
    const v = localStorage.getItem(KEY);
    if (v) els.apiUrl.value = v;
  }
  function saveApiUrl(){
    const v = (els.apiUrl.value || "").trim();
    localStorage.setItem(KEY, v);
  }

  // ---- Date init ----
  function initDates(){
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth()+1).padStart(2,"0");
    const d = String(today.getDate()).padStart(2,"0");
    els.dailyDate.value = `${y}-${m}-${d}`;
    els.monthYm.value = `${y}-${m}`;
  }

  // ---- Mode toggle (法令テンプレ: 必須切替) ----
  function setMode(next){
    mode = next;
    els.tabStart.classList.toggle("on", mode==="start");
    els.tabEnd.classList.toggle("on", mode==="end");

    // show/hide fields
    document.querySelectorAll(".onlyStart").forEach(el => el.style.display = (mode==="start" ? "" : "none"));
    document.querySelectorAll(".onlyEnd").forEach(el => el.style.display = (mode==="end" ? "" : "none"));

    // meter required
    els.meterStart.required = (mode==="start");
    els.meterEnd.required = (mode==="end");
  }

  // ---- UI status ----
  function setStatus(kind, text, msg=""){
    els.dot.classList.remove("gray","green","red");
    if (kind==="ok") els.dot.classList.add("green");
    else if (kind==="ng") els.dot.classList.add("red");
    else els.dot.classList.add("gray");

    els.statusText.textContent = text;
    els.statusMsg.textContent = msg;
  }

  function api(){
    const url = (els.apiUrl.value || "").trim();
    return url;
  }

  async function fetchJson(url, opt){
    const res = await fetch(url, opt);
    const txt = await res.text();
    let j = null;
    try { j = JSON.parse(txt); } catch(_) {}
    if (!res.ok) throw new Error(`HTTP ${res.status} ${txt.slice(0,200)}`);
    if (!j) throw new Error(`JSONではありません: ${txt.slice(0,200)}`);
    return j;
  }

  // ---- Connection test ----
  async function ping(){
    saveApiUrl();
    const url = api();
    if (!url){
      setStatus("ng","未設定","API URL を入れてください");
      return;
    }
    setStatus("mid","接続中…","");
    try{
      const j = await fetchJson(`${url}?ping=1`, { method:"GET" });
      if (j && j.ok){
        setStatus("ok","接続OK","接続できました。送信テストOKです。");
      }else{
        setStatus("ng","接続NG","URL/デプロイ設定を確認してください");
      }
    }catch(e){
      setStatus("ng","接続NG", String(e.message || e));
    }
  }

  // ---- Image -> base64 jpeg (HEICは弾く) ----
  async function fileToJpegDataUrl(file){
    if (!file) return "";
    const t = (file.type || "").toLowerCase();

    // HEIC/HEIF はブラウザで読めないことが多いので止めない（警告してスキップ）
    if (t.includes("heic") || t.includes("heif")){
      throw new Error("HEIC/HEIFは変換できない場合があります。JPEG/PNGで選択してください（写真なしでも送信できます）");
    }

    // 画像以外は不可
    if (!t.startsWith("image/")){
      throw new Error("画像ファイルを選択してください");
    }

    const dataUrl = await new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = () => reject(new Error("ファイル読込に失敗しました"));
      fr.readAsDataURL(file);
    });

    // すでにjpeg/pngならそのままでもOKだが、容量削減のためcanvasでjpeg化
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("画像の読み込みに失敗しました（HEICの可能性）"));
      i.src = dataUrl;
    });

    const max = 1600; // 長辺
    let w = img.width, h = img.height;
    const scale = Math.min(1, max / Math.max(w,h));
    w = Math.round(w*scale); h = Math.round(h*scale);

    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, w, h);

    // 0.78 くらいで十分きれい＆軽い
    return canvas.toDataURL("image/jpeg", 0.78);
  }

  async function multiFilesToDataUrls(fileList){
    if (!fileList || !fileList.length) return [];
    const out = [];
    for (const f of fileList){
      try{
        out.push(await fileToJpegDataUrl(f));
      }catch(e){
        // 変換失敗でも業務停止させない（メッセージだけ出す）
        out.push("");
        console.warn(e);
      }
    }
    return out.filter(Boolean);
  }

  function collectChecks(){
    return {
      tire: !!els.chkTire.checked,
      brake: !!els.chkBrake.checked,
      light: !!els.chkLight.checked,
      oil: !!els.chkOil.checked,
      coolant: !!els.chkCoolant.checked,
      wiper: !!els.chkWiper.checked,
      horn: !!els.chkHorn.checked,
      mirror: !!els.chkMirror.checked,
      load: !!els.chkLoad.checked,
      warning: !!els.chkWarning.checked,
    };
  }

  function validate(){
    const driver = (els.driver.value||"").trim();
    const vehicle = (els.vehicle.value||"").trim();

    if (!api()) return "API URL を入れてください";
    if (!driver) return "氏名は必須です";
    if (!vehicle) return "車両番号は必須です";

    if (mode==="start"){
      if (!(els.meterStart.value||"").trim()) return "メーター（出発）は必須です";
    }
    if (mode==="end"){
      if (!(els.meterEnd.value||"").trim()) return "メーター（帰着）は必須です";
    }

    // 異常ありなら内容推奨
    if (els.inspection.value==="異常あり" && !(els.inspectionDetail.value||"").trim()){
      return "異常ありの場合、異常内容を入力してください";
    }
    return "";
  }

  function setSubmitMsg(kind, text){
    els.submitMsg.classList.remove("ok","ng");
    if (kind==="ok") els.submitMsg.classList.add("ok");
    if (kind==="ng") els.submitMsg.classList.add("ng");
    els.submitMsg.textContent = text;
  }

  async function submit(){
    saveApiUrl();
    setSubmitMsg("", "");

    const err = validate();
    if (err){
      setSubmitMsg("ng", "✖ " + err);
      return;
    }

    els.btnSubmit.disabled = true;
    els.btnSubmit.textContent = "送信中…";

    // 写真は失敗しても送信は止めない（重要）
    let inspectionPhotoUrl = "";
    let alcoholPhotoUrl = "";
    let meterPhotoUrl = "";
    let otherPhotos = [];

    try{ inspectionPhotoUrl = await fileToJpegDataUrl(els.photoInspection.files[0]); }catch(e){ console.warn(e); }
    try{ alcoholPhotoUrl = await fileToJpegDataUrl(els.photoAlcohol.files[0]); }catch(e){ console.warn(e); }
    try{ meterPhotoUrl = await fileToJpegDataUrl(els.photoMeter.files[0]); }catch(e){ console.warn(e); }
    try{ otherPhotos = await multiFilesToDataUrls(els.photoOther.files); }catch(e){ console.warn(e); }

    const payload = {
      type: mode, // start / end
      ts: new Date().toISOString(),

      driver: (els.driver.value||"").trim(),
      vehicle: (els.vehicle.value||"").trim(),
      phone: (els.phone.value||"").trim(),
      area: (els.area.value||"").trim(),
      route: (els.route.value||"").trim(),

      alcohol: els.alcohol.value,
      alcoholValue: (els.alcoholValue.value||"").trim(),
      condition: els.condition.value,
      fatigue: els.fatigue.value,
      temp: (els.temp.value||"").trim(),
      sleep: (els.sleep.value||"").trim(),
      medicine: els.medicine.value,
      healthMemo: (els.healthMemo.value||"").trim(),
      runMemo: (els.runMemo?.value||"").trim(),

      inspection: els.inspection.value,
      inspectionDetail: (els.inspectionDetail.value||"").trim(),

      meterStart: (els.meterStart.value||"").trim(),
      meterEnd: (els.meterEnd.value||"").trim(),

      checks: collectChecks(),

      photos: {
        inspection: inspectionPhotoUrl,
        alcohol: alcoholPhotoUrl,
        meter: meterPhotoUrl,
        other: otherPhotos
      },

      memo: (els.memo.value||"").trim()
    };

    try{
      const j = await fetchJson(api(), {
        method:"POST",
        headers: { "Content-Type":"text/plain;charset=utf-8" },
        body: JSON.stringify(payload)
      });

      if (j.ok){
        setSubmitMsg("ok", "✅ 送信しました");
      }else{
        setSubmitMsg("ng", "✖ 送信に失敗しました（GASの権限/デプロイ/URLを確認）");
      }
    }catch(e){
      setSubmitMsg("ng", "✖ 送信に失敗しました（通信/権限/URL）：" + String(e.message || e));
    }finally{
      els.btnSubmit.disabled = false;
      els.btnSubmit.textContent = "送信";
    }
  }

  // ---- PDF/CSV ----
  function clearLinks(){
    els.linkArea.innerHTML = "";
  }
  function addLink(label, url){
    const a = document.createElement("a");
    a.href = url; a.target = "_blank"; a.rel="noopener";
    a.textContent = "▶ " + label;
    els.linkArea.appendChild(a);
  }

  async function dailyPdf(){
    saveApiUrl();
    clearLinks();
    const url = api();
    if (!url) return setSubmitMsg("ng","✖ API URL を入れてください");

    const date = els.dailyDate.value;
    const driver = (els.driver.value||"").trim();

    try{
      const j = await fetchJson(`${url}?action=dailyPdf&date=${encodeURIComponent(date)}&driver=${encodeURIComponent(driver)}`, { method:"GET" });
      if (j.ok && j.url){
        addLink("日報PDFを開く", j.url);
        setSubmitMsg("ok","✅ 日報PDFを作成しました");
      }else{
        setSubmitMsg("ng","✖ 日報PDF作成に失敗しました");
      }
    }catch(e){
      setSubmitMsg("ng","✖ 日報PDF作成に失敗：" + String(e.message||e));
    }
  }

  async function monthlyPdf(){
    saveApiUrl();
    clearLinks();
    const url = api();
    if (!url) return setSubmitMsg("ng","✖ API URL を入れてください");

    const ym = els.monthYm.value;
    const driver = (els.driver.value||"").trim();

    try{
      const j = await fetchJson(`${url}?action=monthlyPdf&ym=${encodeURIComponent(ym)}&driver=${encodeURIComponent(driver)}`, { method:"GET" });
      if (j.ok && j.url){
        addLink("月報PDFを開く", j.url);
        setSubmitMsg("ok","✅ 月報PDFを作成しました");
      }else{
        setSubmitMsg("ng","✖ 月報PDF作成に失敗しました");
      }
    }catch(e){
      setSubmitMsg("ng","✖ 月報PDF作成に失敗：" + String(e.message||e));
    }
  }

  async function monthlyCsv(){
    saveApiUrl();
    clearLinks();
    const url = api();
    if (!url) return setSubmitMsg("ng","✖ API URL を入れてください");

    const ym = els.monthYm.value;
    const driver = (els.driver.value||"").trim();

    try{
      const j = await fetchJson(`${url}?action=monthlyCsv&ym=${encodeURIComponent(ym)}&driver=${encodeURIComponent(driver)}`, { method:"GET" });
      if (j.ok && j.url){
        addLink("月次CSVをダウンロード", j.url);
        setSubmitMsg("ok","✅ 月次CSVを作成しました");
      }else{
        setSubmitMsg("ng","✖ 月次CSV作成に失敗しました");
      }
    }catch(e){
      setSubmitMsg("ng","✖ 月次CSV作成に失敗：" + String(e.message||e));
    }
  }

  // ---- Events ----
  els.apiUrl.addEventListener("change", () => { saveApiUrl(); setStatus("mid","未確認","接続テストを押してください"); });

  els.btnPing.addEventListener("click", ping);

  els.tabStart.addEventListener("click", () => setMode("start"));
  els.tabEnd.addEventListener("click", () => setMode("end"));

  els.btnSubmit.addEventListener("click", submit);

  els.btnDailyPdf.addEventListener("click", dailyPdf);
  els.btnMonthlyPdf.addEventListener("click", monthlyPdf);
  els.btnMonthlyCsv.addEventListener("click", monthlyCsv);

  // ---- Init ----
  loadApiUrl();
  initDates();
  setMode("start");
  setStatus("mid","未確認","接続テストを押してください");
})();
