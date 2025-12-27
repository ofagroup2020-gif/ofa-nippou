/* OFA Tenko & Inspection - Frontend (GitHub Pages)
   - API URL saved in localStorage
   - Connection test ?ping=1
   - POST JSON with compressed JPEG base64 images
   - Daily/Monthly PDF & Monthly CSV buttons
   - Local history on device
*/

const LS = {
  api: "ofa_tenko_api_url",
  mode: "ofa_tenko_mode",
  history: "ofa_tenko_history_v1",
};

const $ = (id) => document.getElementById(id);

const el = {
  apiUrl: $("apiUrl"),
  btnPing: $("btnPing"),
  connDot: $("connDot"),
  connText: $("connText"),
  connBox: $("connBox"),

  pdfDate: $("pdfDate"),
  pdfMonth: $("pdfMonth"),
  btnDailyPdf: $("btnDailyPdf"),
  btnMonthlyPdf: $("btnMonthlyPdf"),
  btnMonthlyCsv: $("btnMonthlyCsv"),

  modeDeparture: $("modeDeparture"),
  modeArrival: $("modeArrival"),

  date: $("date"),
  driver: $("driver"),
  company: $("company"),
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
  meds: $("meds"),
  healthMemo: $("healthMemo"),

  startAlcoholPhoto: $("startAlcoholPhoto"),
  endAlcoholPhoto: $("endAlcoholPhoto"),
  prevStartAlcohol: $("prevStartAlcohol"),
  prevEndAlcohol: $("prevEndAlcohol"),
  labelStartAlcohol: $("labelStartAlcohol"),
  labelEndAlcohol: $("labelEndAlcohol"),

  inspection: $("inspection"),
  inspectionDetailWrap: $("inspectionDetailWrap"),
  inspectionDetail: $("inspectionDetail"),
  inspectionLevel: $("inspectionLevel"),
  inspectionPhoto: $("inspectionPhoto"),
  prevInspection: $("prevInspection"),

  meterStartWrap: $("meterStartWrap"),
  meterEndWrap: $("meterEndWrap"),
  meterStart: $("meterStart"),
  meterEnd: $("meterEnd"),
  meterPhoto: $("meterPhoto"),
  otherPhoto: $("otherPhoto"),
  prevMeter: $("prevMeter"),
  prevOther: $("prevOther"),

  memo: $("memo"),

  btnSave: $("btnSave"),
  resultBox: $("resultBox"),

  btnClearLocal: $("btnClearLocal"),
  btnExportLocal: $("btnExportLocal"),
  historyList: $("historyList"),
};

let mode = "departure"; // or "arrival"
let imageCache = {
  startAlcoholPhoto: null,
  endAlcoholPhoto: null,
  inspectionPhoto: null,
  meterPhoto: null,
  otherPhoto: null,
};

function setConn(state, text){
  const dot = el.connDot;
  dot.style.background = state === "ok" ? "#16a34a" : state === "ng" ? "#ef4444" : state === "warn" ? "#f59e0b" : "#94a3b8";
  dot.style.boxShadow = state === "ok" ? "0 0 0 5px rgba(22,163,74,.18)"
    : state === "ng" ? "0 0 0 5px rgba(239,68,68,.18)"
    : state === "warn" ? "0 0 0 5px rgba(245,158,11,.18)"
    : "0 0 0 5px rgba(148,163,184,.20)";
  el.connText.textContent = text;
}

function setResult(kind, text){
  el.resultBox.className = "result " + (kind || "");
  el.resultBox.textContent = text;
}

function loadLS(){
  const savedApi = localStorage.getItem(LS.api) || "";
  el.apiUrl.value = savedApi;

  const savedMode = localStorage.getItem(LS.mode);
  if(savedMode === "arrival") mode = "arrival";
  applyModeUI();

  // defaults
  const now = new Date();
  el.date.value = toDateInput(now);
  el.pdfDate.value = toDateInput(now);
  el.pdfMonth.value = toMonthInput(now);
}

function saveApiUrl(){
  const v = (el.apiUrl.value || "").trim();
  localStorage.setItem(LS.api, v);
}

function getApiUrl(){
  return (localStorage.getItem(LS.api) || el.apiUrl.value || "").trim();
}

function toDateInput(d){
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  return `${yyyy}-${mm}-${dd}`;
}
function toMonthInput(d){
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  return `${yyyy}-${mm}`;
}

function applyModeUI(){
  el.modeDeparture.classList.toggle("active", mode==="departure");
  el.modeArrival.classList.toggle("active", mode==="arrival");

  // required meter: departure -> meterStart required, arrival -> meterEnd required
  el.meterStartWrap.style.display = mode==="departure" ? "block" : "none";
  el.meterEndWrap.style.display = mode==="arrival" ? "block" : "none";

  // photo labels
  el.labelStartAlcohol.textContent = `アルコール検知器写真（出発・任意）`;
  el.labelEndAlcohol.textContent = `アルコール検知器写真（帰着・任意）`;

  localStorage.setItem(LS.mode, mode);
}

async function ping(){
  saveApiUrl();
  const api = getApiUrl();
  if(!api){
    setConn("ng","API URLを入力してください");
    return;
  }
  setConn("warn","接続確認中...");
  try{
    const u = new URL(api);
    u.searchParams.set("ping","1");
    const res = await fetch(u.toString(), { method:"GET" });
    const json = await res.json().catch(()=>null);
    if(res.ok && json && json.ok){
      setConn("ok","接続OK：送信できます");
    }else{
      setConn("ng","接続NG：URL/デプロイ設定を確認");
    }
  }catch(e){
    setConn("ng","接続NG：通信に失敗しました");
  }
}

function validate(){
  const must = (v) => (v || "").trim().length > 0;

  if(!must(getApiUrl())) return "API URLを入力してください";
  if(!must(el.date.value)) return "日付が未入力です";
  if(!must(el.driver.value)) return "ドライバー名が未入力です";
  if(!must(el.company.value)) return "所属会社が未入力です";
  if(!must(el.vehicle.value)) return "車両番号が未入力です";
  if(!must(el.alcohol.value)) return "アルコールチェックが未入力です";
  if(!must(el.condition.value)) return "体調が未入力です";
  if(!must(el.inspection.value)) return "点検結果が未入力です";

  if(el.inspection.value.includes("異常あり") && !must(el.inspectionDetail.value)){
    return "点検で「異常あり」の場合は異常内容を入力してください";
  }

  // inspection photo required
  if(!imageCache.inspectionPhoto) return "点検写真（必須）が未選択です";

  // meter required by mode
  if(mode==="departure"){
    if(!must(el.meterStart.value)) return "出発メーター（必須）が未入力です";
  }else{
    if(!must(el.meterEnd.value)) return "帰着メーター（必須）が未入力です";
  }
  return null;
}

function buildPayload(){
  return {
    type: mode === "departure" ? "出発点呼" : "帰着点呼",
    date: el.date.value,
    driver: el.driver.value.trim(),
    company: el.company.value.trim(),
    vehicle: el.vehicle.value.trim(),
    phone: el.phone.value.trim(),
    area: el.area.value.trim(),
    route: el.route.value.trim(),

    alcohol: el.alcohol.value,
    alcoholValue: el.alcoholValue.value.trim(),
    condition: el.condition.value,
    fatigue: el.fatigue.value,
    temp: el.temp.value.trim(),
    sleep: el.sleep.value.trim(),
    meds: el.meds.value,
    healthMemo: el.healthMemo.value.trim(),

    inspection: el.inspection.value,
    inspectionDetail: el.inspectionDetail.value.trim(),
    inspectionLevel: el.inspectionLevel.value,

    meterStart: el.meterStart.value.trim(),
    meterEnd: el.meterEnd.value.trim(),
    memo: el.memo.value.trim(),

    // base64 images (JPEG)
    startAlcoholPhoto: imageCache.startAlcoholPhoto,
    endAlcoholPhoto: imageCache.endAlcoholPhoto,
    inspectionPhoto: imageCache.inspectionPhoto,
    meterPhoto: imageCache.meterPhoto,
    otherPhoto: imageCache.otherPhoto,
  };
}

async function postJSON(payload){
  const api = getApiUrl();
  const res = await fetch(api, {
    method: "POST",
    headers: { "Content-Type":"text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(()=>null);
  return { res, json };
}

// ---- image compress ----
function clearPreview(node){
  node.innerHTML = "";
}
function addPreview(node, dataUrl){
  const img = document.createElement("img");
  img.src = dataUrl;
  node.appendChild(img);
}

async function fileToCompressedJpegBase64(file, maxW=1280, quality=0.82){
  // HEIC fallback: browser often can't decode -> throw
  const bitmap = await createImageBitmap(file).catch(()=>null);
  if(!bitmap){
    throw new Error("画像を読み込めません（HEICの可能性）。JPEG/PNGで選択してください。");
  }
  const { width, height } = bitmap;
  const scale = Math.min(1, maxW / Math.max(width, height));
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0, w, h);

  const dataUrl = canvas.toDataURL("image/jpeg", quality);
  // return base64 body only, and preview
  const base64 = dataUrl.split(",")[1];
  return { base64, preview: dataUrl };
}

function bindFile(inputEl, previewEl, key){
  inputEl.addEventListener("change", async () => {
    clearPreview(previewEl);
    imageCache[key] = null;

    const f = inputEl.files && inputEl.files[0];
    if(!f) return;

    try{
      setResult("warn","画像を圧縮中...");
      const { base64, preview } = await fileToCompressedJpegBase64(f, 1280, 0.82);
      imageCache[key] = base64;
      addPreview(previewEl, preview);
      setResult("", "準備OK");
    }catch(e){
      setResult("ng", `画像変換エラー：${e.message || e}`);
    }
  });
}

// ---- local history ----
function getHistory(){
  try{
    return JSON.parse(localStorage.getItem(LS.history) || "[]");
  }catch{
    return [];
  }
}
function setHistory(list){
  localStorage.setItem(LS.history, JSON.stringify(list));
}
function addHistory(item){
  const list = getHistory();
  list.unshift(item);
  setHistory(list.slice(0, 100)); // keep last 100
  renderHistory();
}
function renderHistory(){
  const list = getHistory();
  el.historyList.innerHTML = "";
  if(list.length === 0){
    el.historyList.innerHTML = `<div class="help">履歴はまだありません。</div>`;
    return;
  }
  list.forEach((it, idx)=>{
    const div = document.createElement("div");
    div.className = "hItem";
    div.innerHTML = `
      <div class="hTop">
        <div>${escapeHtml(it.date || "")} / ${escapeHtml(it.type || "")}</div>
        <div>${escapeHtml(it.driver || "")}</div>
      </div>
      <div class="hSub">
        車両：${escapeHtml(it.vehicle||"")} / 会社：${escapeHtml(it.company||"")}<br/>
        結果：${escapeHtml(it.status||"")}<br/>
        ${it.driveUrl ? `Drive：${escapeHtml(it.driveUrl)}` : ""}
      </div>
      <div class="hBtns">
        <button class="btn ghost" data-act="copy" data-idx="${idx}">データをコピー</button>
        <button class="btn danger" data-act="del" data-idx="${idx}">削除</button>
      </div>
    `;
    el.historyList.appendChild(div);
  });

  el.historyList.querySelectorAll("button").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      const idx = Number(btn.dataset.idx);
      const act = btn.dataset.act;
      const list2 = getHistory();
      const row = list2[idx];
      if(!row) return;

      if(act==="copy"){
        await navigator.clipboard.writeText(JSON.stringify(row.raw || row, null, 2)).catch(()=>{});
        alert("コピーしました");
      }
      if(act==="del"){
        list2.splice(idx,1);
        setHistory(list2);
        renderHistory();
      }
    });
  });
}

function escapeHtml(s){
  return String(s||"").replace(/[&<>"']/g, (m)=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[m]));
}

// ---- output links ----
function openUrl(u){
  window.open(u, "_blank", "noopener,noreferrer");
}

function buildOutputUrl(kind, params){
  const api = getApiUrl();
  const u = new URL(api);
  // GAS側が ?pdf=... ?csv=... を受ける仕様に合わせる
  if(kind==="pdf") u.searchParams.set("pdf", params.pdf || "");
  if(kind==="csv") u.searchParams.set("csv", params.csv || "");
  if(params.date) u.searchParams.set("date", params.date);
  if(params.ym) u.searchParams.set("ym", params.ym);
  if(params.driver) u.searchParams.set("driver", params.driver);
  return u.toString();
}

// ---- tabs ----
function bindTabs(){
  document.querySelectorAll(".tab").forEach(t=>{
    t.addEventListener("click", ()=>{
      document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));
      t.classList.add("active");

      const key = t.dataset.tab;
      document.querySelectorAll(".panel").forEach(p=>p.classList.remove("active"));
      $("tab-"+key).classList.add("active");
      if(key==="history") renderHistory();
    });
  });
}

// ---- init bindings ----
function bind(){
  // api save
  el.apiUrl.addEventListener("change", saveApiUrl);
  el.apiUrl.addEventListener("blur", saveApiUrl);

  el.btnPing.addEventListener("click", ping);

  el.modeDeparture.addEventListener("click", ()=>{ mode="departure"; applyModeUI(); });
  el.modeArrival.addEventListener("click", ()=>{ mode="arrival"; applyModeUI(); });

  // inspection detail show/hide
  const toggleInspectionDetail = ()=>{
    const on = el.inspection.value.includes("異常あり");
    el.inspectionDetailWrap.style.display = on ? "block" : "none";
    if(!on) el.inspectionDetail.value = "";
  };
  el.inspection.addEventListener("change", toggleInspectionDetail);
  toggleInspectionDetail();

  // file binds
  bindFile(el.startAlcoholPhoto, el.prevStartAlcohol, "startAlcoholPhoto");
  bindFile(el.endAlcoholPhoto, el.prevEndAlcohol, "endAlcoholPhoto");
  bindFile(el.inspectionPhoto, el.prevInspection, "inspectionPhoto");
  bindFile(el.meterPhoto, el.prevMeter, "meterPhoto");
  bindFile(el.otherPhoto, el.prevOther, "otherPhoto");

  // save
  el.btnSave.addEventListener("click", async ()=>{
    setResult("", "");
    const err = validate();
    if(err){
      setResult("ng", err);
      return;
    }
    setResult("warn", "送信中...（写真をDriveへ保存しています）");
    try{
      const payload = buildPayload();
      const { res, json } = await postJSON(payload);
      if(res.ok && json && json.ok){
        setResult("ok", "✅ 保存完了（Drive保存＋ログ追記OK）");
        addHistory({
          date: payload.date,
          type: payload.type,
          driver: payload.driver,
          company: payload.company,
          vehicle: payload.vehicle,
          status: "OK",
          driveUrl: json.driveUrl || json.url || "",
          sheetId: json.sheetId || json.savedSheetId || "",
          raw: payload
        });
        // keep connection status
        setConn("ok","接続OK：送信できます");
      }else{
        const msg = (json && (json.error || json.message)) ? (json.error || json.message) : "送信に失敗しました";
        setResult("ng", `❌ 送信失敗：${msg}`);
        addHistory({
          date: payload.date, type: payload.type, driver: payload.driver,
          company: payload.company, vehicle: payload.vehicle,
          status: "NG", raw: payload
        });
        setConn("ng","送信エラー：APIの実行権限/デプロイ設定を確認");
      }
    }catch(e){
      setResult("ng", `❌ 送信失敗：${e.message || e}`);
      setConn("ng","送信エラー：通信に失敗しました");
    }
  });

  // outputs
  el.btnDailyPdf.addEventListener("click", ()=>{
    saveApiUrl();
    const api = getApiUrl();
    if(!api){ setResult("ng","API URLを入力してください"); return; }
    const date = el.pdfDate.value;
    const driver = (el.driver.value||"").trim();
    if(!date){ setResult("ng","日付を選択してください"); return; }
    const url = buildOutputUrl("pdf", { pdf:"daily", date, driver });
    openUrl(url);
  });

  el.btnMonthlyPdf.addEventListener("click", ()=>{
    saveApiUrl();
    const api = getApiUrl();
    if(!api){ setResult("ng","API URLを入力してください"); return; }
    const ym = el.pdfMonth.value;
    const driver = (el.driver.value||"").trim();
    if(!ym){ setResult("ng","年月を選択してください"); return; }
    const url = buildOutputUrl("pdf", { pdf:"monthly", ym, driver });
    openUrl(url);
  });

  el.btnMonthlyCsv.addEventListener("click", ()=>{
    saveApiUrl();
    const api = getApiUrl();
    if(!api){ setResult("ng","API URLを入力してください"); return; }
    const ym = el.pdfMonth.value;
    const driver = (el.driver.value||"").trim();
    if(!ym){ setResult("ng","年月を選択してください"); return; }
    const url = buildOutputUrl("csv", { csv:"monthly", ym, driver });
    openUrl(url);
  });

  // local history tools
  el.btnClearLocal.addEventListener("click", ()=>{
    if(!confirm("この端末の履歴を全て削除します。よろしいですか？")) return;
    localStorage.removeItem(LS.history);
    renderHistory();
    alert("削除しました");
  });

  el.btnExportLocal.addEventListener("click", ()=>{
    const data = getHistory();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type:"application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "ofa_tenko_history.json";
    a.click();
    URL.revokeObjectURL(a.href);
  });

  // set default pdf date/month on form date change
  el.date.addEventListener("change", ()=>{
    if(el.date.value) el.pdfDate.value = el.date.value;
  });

  bindTabs();
  renderHistory();
}

// boot
loadLS();
bind();
setResult("", "準備OK");

// quick helper: try ping if api already set
if(getApiUrl()){
  setTimeout(()=>ping(), 300);
}
