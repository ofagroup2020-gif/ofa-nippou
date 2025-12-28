/* ==========================
  OFA 点呼・点検（完全版）
  ✅ API URL 埋め込み（ドライバー入力不要）
  ✅ 出発点呼 / 帰着点呼 分離
  ✅ 端末に共通情報を保存/復元
  ✅ PDF/CSV 出力ボタン（APIへGET）
========================== */

// ★あなたのGAS WebアプリURL（/exec）を埋め込み
const API_URL = "https://script.google.com/macros/s/AKfycbwh73384H_iIizFTE01dcETTGxQZ29fKN_UhgKA3iCMcuiHVOiXeybRgg9nRT6Jzh9EMg/exec";

// localStorageキー
const LS_KEY = "ofa_tenko_common_v1";

const $ = (id) => document.getElementById(id);

function todayISO(){
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const day = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}

function setDefaultDates(){
  $("commonDate").value = todayISO();
  $("dailyDate").value = todayISO();

  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  $("monthYm").value = `${y}-${m}`;
}

function showResult(el, kind, msg){
  el.classList.remove("ok","ng","neutral");
  el.classList.add(kind);
  el.textContent = msg;
}

function setPing(kind, msg){
  const el = $("pingStatus");
  el.classList.remove("ok","ng","neutral");
  el.classList.add(kind);
  el.textContent = msg;
}

function toBase64(file){
  return new Promise((resolve,reject)=>{
    if(!file) return resolve(null);
    const reader = new FileReader();
    reader.onload = () => {
      const res = String(reader.result || "");
      // "data:image/jpeg;base64,...."
      const idx = res.indexOf("base64,");
      if(idx === -1) return resolve({name:file.name, mime:file.type, b64:null, dataUrl:res});
      resolve({
        name: file.name,
        mime: file.type || "application/octet-stream",
        b64: res.slice(idx + 7),
        size: file.size
      });
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function validateCommon(){
  const date = $("commonDate").value;
  const name = $("driverName").value.trim();
  const car = $("vehicleNo").value.trim();
  if(!date) return "日付が未入力です";
  if(!name) return "氏名が未入力です";
  if(!car) return "車両番号が未入力です";
  return null;
}

function commonPayload(){
  return {
    date: $("commonDate").value,
    driverName: $("driverName").value.trim(),
    vehicleNo: $("vehicleNo").value.trim(),
    phone: $("phone").value.trim(),
    area: $("area").value.trim(),
    route: $("route").value.trim(),
    device: navigator.userAgent
  };
}

function saveCommonToLocal(){
  const data = {
    driverName: $("driverName").value.trim(),
    vehicleNo: $("vehicleNo").value.trim(),
    phone: $("phone").value.trim(),
    area: $("area").value.trim(),
    route: $("route").value.trim()
  };
  localStorage.setItem(LS_KEY, JSON.stringify(data));
  alert("この端末に保存しました（次回復元できます）");
}

function loadCommonFromLocal(){
  const raw = localStorage.getItem(LS_KEY);
  if(!raw){ alert("保存データがありません"); return; }
  try{
    const d = JSON.parse(raw);
    $("driverName").value = d.driverName || "";
    $("vehicleNo").value = d.vehicleNo || "";
    $("phone").value = d.phone || "";
    $("area").value = d.area || "";
    $("route").value = d.route || "";
    alert("この端末の保存データから復元しました");
  }catch(e){
    alert("復元に失敗しました");
  }
}

function clearLocal(){
  localStorage.removeItem(LS_KEY);
  alert("この端末の保存データを削除しました");
}

async function apiPing(){
  try{
    setPing("neutral","確認中…");
    const url = `${API_URL}?ping=1&ts=${Date.now()}`;
    const res = await fetch(url, { method:"GET" });
    const j = await res.json().catch(()=>null);
    if(res.ok && j && j.ok){
      setPing("ok","接続OK");
      return true;
    }
    setPing("ng","接続NG");
    return false;
  }catch(e){
    setPing("ng","接続NG");
    return false;
  }
}

function openExport(type){
  const name = $("driverName").value.trim();
  const date = $("dailyDate").value;   // yyyy-mm-dd
  const ym = $("monthYm").value;       // yyyy-mm

  // API側の実装に合わせてクエリを投げる（あなたのGASは hint に ?csv ?pdf がある）
  // ここは「APIが受け取るパラメータ名」に合わせてあります（date/ym/name/type）
  const q = new URLSearchParams();
  q.set("type", type);
  if(name) q.set("name", name);
  if(type === "dailyPdf"){
    q.set("date", date || todayISO());
  }
  if(type === "monthPdf" || type === "monthCsv"){
    q.set("ym", ym || $("monthYm").value);
  }

  const url = `${API_URL}?${q.toString()}`;
  window.open(url, "_blank");
}

async function postJson(payload){
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type":"text/plain;charset=utf-8" }, // GASが受け取りやすい
    body: JSON.stringify(payload),
  });
  const j = await res.json().catch(()=>null);
  if(!res.ok){
    throw new Error((j && j.error) ? j.error : `HTTP ${res.status}`);
  }
  if(j && j.ok === false){
    throw new Error(j.error || "API error");
  }
  return j;
}

/* ====== 出発送信 ====== */
async function submitDeparture(){
  const err = validateCommon();
  if(err){ showResult($("depResult"),"ng",`✖ ${err}`); return; }

  // 必須チェック
  if(!$("depMeterStart").value.trim()){
    showResult($("depResult"),"ng","✖ メーター（出発）が未入力です");
    return;
  }
  if(!$("depPhotoInspect").files[0]){
    showResult($("depResult"),"ng","✖ 点検写真（必須）が未選択です");
    return;
  }
  if($("depInspectResult").value === "異常あり" && !$("depInspectIssue").value.trim()){
    showResult($("depResult"),"ng","✖ 異常ありの場合は『異常内容』を入力してください");
    return;
  }

  showResult($("depResult"),"neutral","送信中…");

  try{
    const photoInspect = await toBase64($("depPhotoInspect").files[0]);
    const photoAlcohol = await toBase64($("depPhotoAlcohol").files[0]);

    // チェック項目
    const checks = {
      tire: $("depChkTire").checked,
      brake: $("depChkBrake").checked,
      light: $("depChkLight").checked,
      wiper: $("depChkWiper").checked,
      oil: $("depChkOil").checked,
      battery: $("depChkBattery").checked,
      horn: $("depChkHorn").checked,
      mirror: $("depChkMirror").checked,
      load: $("depChkLoad").checked,
      other: $("depChkOther").checked,
      memo: $("depChkMemo").value.trim(),
    };

    const payload = {
      kind: "departure",
      ...commonPayload(),

      // 点呼
      alcohol: $("depAlcohol").value,
      alcoholValue: $("depAlcoholValue").value.trim(),
      condition: $("depCondition").value,
      fatigue: $("depFatigue").value,
      temp: $("depTemp").value.trim(),
      sleep: $("depSleep").value.trim(),
      meds: $("depMeds").value,
      healthMemo: $("depHealthMemo").value.trim(),

      // 点検
      inspectResult: $("depInspectResult").value,
      inspectIssue: $("depInspectIssue").value.trim(),
      checklist: checks,

      // メーター
      meterStart: $("depMeterStart").value.trim(),

      // 写真
      photos: {
        inspect: photoInspect,
        alcohol: photoAlcohol,
      },

      remark: $("depRemark").value.trim(),
      ts: new Date().toISOString()
    };

    const j = await postJson(payload);
    showResult($("depResult"),"ok","✅ 保存完了（Drive保存＋ログ追記OK）");
  }catch(e){
    showResult($("depResult"),"ng",`✖ 送信失敗：${e.message || e}`);
  }
}

/* ====== 帰着送信 ====== */
async function submitArrival(){
  const err = validateCommon();
  if(err){ showResult($("arrResult"),"ng",`✖ ${err}`); return; }

  if(!$("arrMeterEnd").value.trim()){
    showResult($("arrResult"),"ng","✖ メーター（帰着）が未入力です");
    return;
  }
  if($("arrInspectResult").value === "異常あり" && !$("arrInspectIssue").value.trim()){
    showResult($("arrResult"),"ng","✖ 異常ありの場合は『異常内容』を入力してください");
    return;
  }

  showResult($("arrResult"),"neutral","送信中…");

  try{
    const photoMeter = await toBase64($("arrPhotoMeter").files[0]);
    const photoAlcohol = await toBase64($("arrPhotoAlcohol").files[0]);
    const photoOther = await toBase64($("arrPhotoOther").files[0]);

    const checks = {
      damage: $("arrChkDamage").checked,
      warning: $("arrChkWarning").checked,
      cargo: $("arrChkCargo").checked,
      claim: $("arrChkClaim").checked,
      accident: $("arrChkAccident").checked,
      fuel: $("arrChkFuel").checked,
      other: $("arrChkOther").checked,
      memo: $("arrChkMemo").value.trim(),
    };

    const payload = {
      kind: "arrival",
      ...commonPayload(),

      alcohol: $("arrAlcohol").value,
      alcoholValue: $("arrAlcoholValue").value.trim(),
      condition: $("arrCondition").value,
      fatigue: $("arrFatigue").value,
      temp: $("arrTemp").value.trim(),
      sleep: $("arrSleep").value.trim(),
      meds: $("arrMeds").value,
      healthMemo: $("arrHealthMemo").value.trim(),

      inspectResult: $("arrInspectResult").value,
      inspectIssue: $("arrInspectIssue").value.trim(),
      checklist: checks,

      meterEnd: $("arrMeterEnd").value.trim(),

      photos: {
        meter: photoMeter,
        alcohol: photoAlcohol,
        other: photoOther,
      },

      remark: $("arrRemark").value.trim(),
      ts: new Date().toISOString()
    };

    const j = await postJson(payload);
    showResult($("arrResult"),"ok","✅ 保存完了（Drive保存＋ログ追記OK）");
  }catch(e){
    showResult($("arrResult"),"ng",`✖ 送信失敗：${e.message || e}`);
  }
}

/* ====== タブ ====== */
function setupTabs(){
  document.querySelectorAll(".tab").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      document.querySelectorAll(".tab").forEach(b=>b.classList.remove("active"));
      btn.classList.add("active");

      const tab = btn.dataset.tab;
      $("tab-dep").classList.toggle("show", tab==="dep");
      $("tab-arr").classList.toggle("show", tab==="arr");
    });
  });
}

/* ====== 起動 ====== */
window.addEventListener("load", ()=>{
  setDefaultDates();
  setupTabs();

  $("btnPing").addEventListener("click", apiPing);

  $("btnSaveLocal").addEventListener("click", saveCommonToLocal);
  $("btnLoadLocal").addEventListener("click", loadCommonFromLocal);
  $("btnClearLocal").addEventListener("click", clearLocal);

  $("btnSubmitDep").addEventListener("click", submitDeparture);
  $("btnSubmitArr").addEventListener("click", submitArrival);

  $("btnDailyPdf").addEventListener("click", ()=>openExport("dailyPdf"));
  $("btnMonthPdf").addEventListener("click", ()=>openExport("monthPdf"));
  $("btnMonthCsv").addEventListener("click", ()=>openExport("monthCsv"));

  // 画面開いたら軽くping（任意）
  apiPing();
});
