/* ============================
   OFA 点呼・点検（GitHub版 / 埋め込み固定）
   ============================ */

// ★ここだけ固定（ドライバーに見せない）
const API_URL = "https://script.google.com/macros/s/AKfycbxIxPZsvFz1vwoLbJYecza8W1UAV3n_1Tpia2pzB0YpDY2Bo6O039pDfVMqgVnQj6X4yA/exec";

// Local history key
const LS_KEY = "ofa_tenko_history_v1";

const $ = (id) => document.getElementById(id);

let mode = "departure"; // "departure" | "arrival"

function nowTimeStr(){
  const d = new Date();
  const hh = String(d.getHours()).padStart(2,"0");
  const mm = String(d.getMinutes()).padStart(2,"0");
  return `${hh}:${mm}`;
}

function todayStr(){
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${dd}`;
}

function monthStr(){
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  return `${y}-${m}`;
}

function setBadge(type, text){
  const b = $("pingBadge");
  b.classList.remove("ok","ng","neutral");
  b.classList.add(type);
  b.textContent = text;
}

function setStatus(type, text){
  const s = $("status");
  s.classList.remove("ok","ng","neutral");
  s.classList.add(type);
  s.textContent = text;
}

function switchMode(next){
  mode = next;

  $("modeDeparture").classList.toggle("active", mode==="departure");
  $("modeArrival").classList.toggle("active", mode==="arrival");

  // 出発：点検必須パネル表示 / 帰着：帰着パネル表示
  $("inspectPanel").style.display = (mode==="departure") ? "block" : "none";
  $("arrivalPanel").style.display = (mode==="arrival") ? "block" : "none";

  // 必須の説明を更新
  if(mode==="departure"){
    setStatus("neutral","出発点呼モード：点検写真＋メーター（出発）は必須");
  }else{
    setStatus("neutral","帰着点呼モード：メーター（帰着）は必須（写真は任意）");
  }
}

function tabSwitch(tab){
  document.querySelectorAll(".tab").forEach(t=>{
    t.classList.toggle("active", t.dataset.tab===tab);
  });
  $("tab-input").classList.toggle("active", tab==="input");
  $("tab-history").classList.toggle("active", tab==="history");
  if(tab==="history") renderHistory();
}

// ---------- Image helpers (compress to JPEG) ----------
async function fileToJpegDataUrl(file, maxW=1280, quality=0.8){
  if(!file) return null;

  // Some HEIC won't decode in browser -> throw, we catch and show message
  const img = await new Promise((resolve, reject)=>{
    const i = new Image();
    i.onload = ()=>resolve(i);
    i.onerror = ()=>reject(new Error("画像の読み込みに失敗しました（HEICの可能性）"));
    i.src = URL.createObjectURL(file);
  });

  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;

  const scale = Math.min(1, maxW / Math.max(w, h));
  const cw = Math.round(w * scale);
  const ch = Math.round(h * scale);

  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;

  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, cw, ch);

  // Convert to JPEG dataURL
  const dataUrl = canvas.toDataURL("image/jpeg", quality);
  return dataUrl;
}

function previewFile(fileInput, previewDiv){
  const div = $(previewDiv);
  div.innerHTML = "";
  const file = fileInput.files && fileInput.files[0];
  if(!file) return;
  const url = URL.createObjectURL(file);
  const img = document.createElement("img");
  img.src = url;
  div.appendChild(img);
}

// ---------- Validation ----------
function required(v){ return (v ?? "").toString().trim().length > 0; }

function validate(){
  const date = $("date").value;
  const name = $("driverName").value;
  const vehicle = $("vehicleNo").value;

  if(!required(date)) return "日付（必須）を入力してください";
  if(!required(name)) return "氏名（必須）を入力してください";
  if(!required(vehicle)) return "車両番号（必須）を入力してください";

  // Mode-specific
  if(mode==="departure"){
    if(!required($("meterStart").value)) return "メーター（出発・必須）を入力してください";
    if($("inspectResult").value === "異常あり" && !required($("inspectAbnormal").value)){
      return "異常ありの場合、異常内容（必須）を入力してください";
    }
    const photo = $("photoInspect").files && $("photoInspect").files[0];
    if(!photo) return "点検写真（必須）を選択してください";
  }else{
    if(!required($("meterEnd").value)) return "メーター（帰着・必須）を入力してください";
  }

  // Alcohol required always
  if(!required($("alcoholCheck").value)) return "アルコールチェック（必須）を選択してください";
  if(!required($("condition").value)) return "体調（必須）を選択してください";

  return null;
}

// ---------- Build payload ----------
function buildCommon(){
  return {
    date: $("date").value,
    time: $("time").value,
    driverName: $("driverName").value.trim(),
    vehicleNo: $("vehicleNo").value.trim(),
    phone: $("phone").value.trim(),
    area: $("area").value.trim(),
    route: $("route").value.trim(),
    alcoholCheck: $("alcoholCheck").value,
    alcoholValue: $("alcoholValue").value.trim(),
    condition: $("condition").value,
    fatigue: $("fatigue").value,
    temperature: $("temperature").value,
    sleepHours: $("sleepHours").value,
    medication: $("medication").value,
    healthMemo: $("healthMemo").value.trim(),
    note: $("note").value.trim(),
  };
}

function buildDeparture(){
  const checks = {
    tire: $("ckTire").checked,
    brake: $("ckBrake").checked,
    light: $("ckLight").checked,
    oil: $("ckOil").checked,
    wiper: $("ckWiper").checked,
    horn: $("ckHorn").checked,
    mirror: $("ckMirror").checked,
    load: $("ckLoad").checked,
    warn: $("ckWarn").checked,
    etc: $("ckEtc").checked,
  };

  return {
    ...buildCommon(),
    mode: "departure",
    inspectResult: $("inspectResult").value,
    inspectAbnormal: $("inspectAbnormal").value.trim(),
    inspectLevel: $("inspectLevel").value,
    inspectChecks: checks,
    inspectMemo: $("inspectMemo").value.trim(),
    meterStart: $("meterStart").value,
  };
}

function buildArrival(){
  return {
    ...buildCommon(),
    mode: "arrival",
    meterEnd: $("meterEnd").value,
    alcoholAfter: $("alcoholAfter").value,
    arrivalMemo: $("arrivalMemo").value.trim(),
  };
}

// ---------- Local history ----------
function loadHistory(){
  try{
    const raw = localStorage.getItem(LS_KEY);
    if(!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  }catch(e){
    return [];
  }
}

function saveHistory(item){
  const arr = loadHistory();
  arr.unshift(item);
  // limit
  const trimmed = arr.slice(0, 100);
  localStorage.setItem(LS_KEY, JSON.stringify(trimmed));
}

function clearHistory(){
  localStorage.removeItem(LS_KEY);
}

function renderHistory(){
  const list = $("historyList");
  const arr = loadHistory();

  if(arr.length===0){
    list.innerHTML = `<div class="subnote">履歴はまだありません。</div>`;
    return;
  }

  list.innerHTML = "";
  arr.forEach((it, idx)=>{
    const div = document.createElement("div");
    div.className = "hitem";

    const modeLabel = (it.mode==="departure") ? "出発点呼" : "帰着点呼";
    div.innerHTML = `
      <div class="hhead">
        <div class="hmode">${modeLabel}：${escapeHtml(it.driverName || "")}</div>
        <div class="hdate">${escapeHtml(it.date || "")} ${escapeHtml(it.time || "")}</div>
      </div>
      <div class="hmeta">
        車両：${escapeHtml(it.vehicleNo || "")}<br/>
        状態：${escapeHtml(it._status || "")}
      </div>
      <div class="hbtns">
        <button class="hbtn" data-idx="${idx}" data-act="openDrive">Driveフォルダ</button>
        <button class="hbtn" data-idx="${idx}" data-act="dailyPdf">日報PDF</button>
      </div>
    `;
    list.appendChild(div);
  });

  list.querySelectorAll("button.hbtn").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const idx = Number(btn.dataset.idx);
      const act = btn.dataset.act;
      const it = loadHistory()[idx];
      if(!it) return;
      if(act==="openDrive"){
        if(it.driveFolderUrl) window.open(it.driveFolderUrl, "_blank");
        else alert("DriveフォルダURLがありません（保存に失敗した可能性）");
      }
      if(act==="dailyPdf"){
        const name = encodeURIComponent(it.driverName || "");
        const d = encodeURIComponent(it.date || "");
        window.open(`${API_URL}?pdf=${d}&name=${name}`, "_blank");
      }
    });
  });
}

function escapeHtml(s){
  return (s??"").toString()
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

// ---------- API calls ----------
async function ping(){
  setBadge("neutral","確認中…");
  try{
    const res = await fetch(`${API_URL}?ping=1`, { method:"GET" });
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = await res.json();
    if(j && j.ok){
      setBadge("ok","接続OK");
      setStatus("ok","接続OK（保存できます）");
    }else{
      setBadge("ng","接続NG");
      setStatus("ng","接続NG：URLまたはデプロイ設定を確認");
    }
  }catch(e){
    setBadge("ng","接続NG");
    setStatus("ng","接続NG：通信に失敗しました（URL/デプロイ/権限）");
  }
}

async function postJson(payload){
  const res = await fetch(API_URL, {
    method:"POST",
    headers: { "Content-Type":"application/json" },
    body: JSON.stringify(payload),
  });
  if(!res.ok){
    const t = await res.text().catch(()=> "");
    throw new Error(`HTTP ${res.status} ${t}`);
  }
  const j = await res.json();
  return j;
}

async function save(){
  const err = validate();
  if(err){
    setStatus("ng", `✖ ${err}`);
    return;
  }

  $("btnSave").disabled = true;
  setStatus("neutral","送信中…（写真を圧縮しています）");

  try{
    const base = (mode==="departure") ? buildDeparture() : buildArrival();

    // Images
    const images = {};
    if(mode==="departure"){
      // required: photoInspect
      images.inspectPhoto = await fileToJpegDataUrl($("photoInspect").files[0], 1400, 0.80);
      // optional: alcohol photo
      if($("photoAlcohol").files && $("photoAlcohol").files[0]){
        images.alcoholPhoto = await fileToJpegDataUrl($("photoAlcohol").files[0], 1400, 0.80);
      }
    }else{
      if($("photoArrival").files && $("photoArrival").files[0]){
        images.arrivalPhoto = await fileToJpegDataUrl($("photoArrival").files[0], 1400, 0.80);
      }
    }

    const payload = {
      ...base,
      images,
      client: {
        ua: navigator.userAgent,
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
        app: "ofa-tenko-github",
        version: "1.0.0",
      }
    };

    const result = await postJson(payload);

    if(result && result.ok){
      setStatus("ok","✅ 保存完了（Drive保存＋ログ追記OK）");
      saveHistory({
        ...base,
        _status: "保存完了",
        driveFolderUrl: result.driveFolderUrl || "",
        driveFileUrls: result.driveFileUrls || {},
      });
    }else{
      setStatus("ng", `✖ 保存失敗：${(result && result.message) ? result.message : "unknown"}`);
      saveHistory({ ...base, _status:"保存失敗" });
    }
  }catch(e){
    const msg = (e && e.message) ? e.message : "送信エラー";
    // HEIC decode hint
    if(msg.includes("HEIC")){
      setStatus("ng","✖ 画像変換に失敗（HEICの可能性）→ 写真をJPEGで共有/保存して選択してください");
    }else{
      setStatus("ng", `✖ 送信失敗：${msg}`);
    }
    // store local
    const base = (mode==="departure") ? buildDeparture() : buildArrival();
    saveHistory({ ...base, _status:"送信失敗" });
  }finally{
    $("btnSave").disabled = false;
  }
}

// ---------- Export buttons ----------
function openDailyPdf(){
  const d = $("pdfDate").value || $("date").value || todayStr();
  const name = encodeURIComponent(($("driverName").value || "").trim());
  window.open(`${API_URL}?pdf=${encodeURIComponent(d)}&name=${name}`, "_blank");
}

function openMonthlyPdf(){
  const ym = $("pdfMonth").value || monthStr();
  const name = encodeURIComponent(($("driverName").value || "").trim());
  window.open(`${API_URL}?mpdf=${encodeURIComponent(ym)}&name=${name}`, "_blank");
}

function openMonthlyCsv(){
  const ym = $("pdfMonth").value || monthStr();
  const name = encodeURIComponent(($("driverName").value || "").trim());
  window.open(`${API_URL}?csv=${encodeURIComponent(ym)}&name=${name}`, "_blank");
}

// ---------- UI bindings ----------
function bind(){
  // default values
  $("date").value = todayStr();
  $("pdfDate").value = todayStr();
  $("pdfMonth").value = monthStr();
  $("time").value = nowTimeStr();
  setInterval(()=> $("time").value = nowTimeStr(), 15000);

  // tabs
  document.querySelectorAll(".tab").forEach(t=>{
    t.addEventListener("click", ()=> tabSwitch(t.dataset.tab));
  });

  // modes
  $("modeDeparture").addEventListener("click", ()=> switchMode("departure"));
  $("modeArrival").addEventListener("click", ()=> switchMode("arrival"));

  // inspect abnormal
  $("inspectResult").addEventListener("change", ()=>{
    const on = $("inspectResult").value === "異常あり";
    $("inspectAbnormalBox").style.display = on ? "block" : "none";
  });

  // previews
  $("photoInspect").addEventListener("change", ()=> previewFile($("photoInspect"), "prevInspect"));
  $("photoAlcohol").addEventListener("change", ()=> previewFile($("photoAlcohol"), "prevAlcohol"));
  $("photoArrival").addEventListener("change", ()=> previewFile($("photoArrival"), "prevArrival"));

  // actions
  $("btnPing").addEventListener("click", ping);
  $("btnSave").addEventListener("click", save);

  $("btnDailyPdf").addEventListener("click", openDailyPdf);
  $("btnMonthlyPdf").addEventListener("click", openMonthlyPdf);
  $("btnMonthlyCsv").addEventListener("click", openMonthlyCsv);

  $("btnClearLocal").addEventListener("click", ()=>{
    if(confirm("この端末の履歴を全て削除します。よろしいですか？")){
      clearHistory();
      setStatus("ok","✅ この端末の履歴を削除しました");
    }
  });

  // initial mode
  switchMode("departure");
}

document.addEventListener("DOMContentLoaded", bind);
