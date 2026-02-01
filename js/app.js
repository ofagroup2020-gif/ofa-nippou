// js/app.js
// Driver UI logic

(function(){
  "use strict";

  const $ = (id)=> document.getElementById(id);

  const state = {
    profile: null,
    monthly: { tenko: [], daily: [], filters: null }
  };

  function toast(msg){
    alert(msg);
  }

  function setDot(id, kind){
    const el = $(id);
    if(!el) return;
    el.classList.remove("ok","warn");
    if(kind==="ok") el.classList.add("ok");
    if(kind==="warn") el.classList.add("warn");
  }

  function todayYmd(){
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,"0");
    const dd= String(d.getDate()).padStart(2,"0");
    return `${y}-${m}-${dd}`;
  }

  function guessNowLocal(){
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,"0");
    const dd= String(d.getDate()).padStart(2,"0");
    const hh= String(d.getHours()).padStart(2,"0");
    const mm= String(d.getMinutes()).padStart(2,"0");
    return `${y}-${m}-${dd}T${hh}:${mm}`;
  }

  function getProfileFromForm(){
    return {
      key: "me",
      name: $("p_name").value.trim(),
      base: $("p_base").value.trim(),
      carNo: $("p_carNo").value.trim(),
      licenseNo: $("p_licenseNo").value.trim(),
      phone: $("p_phone").value.trim(),
      phoneN: window.OFADB.normalizePhone($("p_phone").value),
      email: $("p_email").value.trim(),
      updatedAt: window.OFADB.nowIso()
    };
  }

  function fillProfileForm(p){
    $("p_name").value = p?.name || "";
    $("p_base").value = p?.base || "";
    $("p_carNo").value = p?.carNo || "";
    $("p_licenseNo").value = p?.licenseNo || "";
    $("p_phone").value = p?.phone || "";
    $("p_email").value = p?.email || "";
  }

  async function loadProfile(){
    const p = await window.OFADB.get(window.OFADB.STORES.profile, "me");
    state.profile = p ? {
      name:p.name, base:p.base, carNo:p.carNo, licenseNo:p.licenseNo, phone:p.phone, phoneN:p.phoneN, email:p.email
    } : null;

    if(p){
      fillProfileForm(p);
      $("profileState").textContent = "ä¿å­æ¸ã¿";
      setDot("dotProfile","ok");
    }else{
      $("profileState").textContent = "æªä¿å­";
      setDot("dotProfile","warn");
    }
    return p;
  }

  function validateProfile(p){
    if(!p.name || !p.base || !p.carNo || !p.licenseNo || !p.phone || !p.email) return false;
    return true;
  }

  function depFromForm(){
    return {
      at: $("d_at").value,
      type: "dep",
      method: $("d_method").value,
      sleep: $("d_sleep").value,
      temp: $("d_temp").value,
      condition: $("d_condition").value,
      fatigue: $("d_fatigue").value,
      drink: $("d_drink").value,
      alcState: $("d_alcState").value,
      alcValue: $("d_alcValue").value,
      alcJudge: $("d_alcJudge").value,
      projectMain: $("d_projectMain").value,
      area: $("d_area").value,
      odoStart: $("d_odoStart").value,
      abnormal: $("d_abnormal").value,
      abnormalDetail: $("d_abnormalDetail").value,
      createdAt: window.OFADB.nowIso()
    };
  }

  function arrFromForm(){
    return {
      at: $("a_at").value,
      type: "arr",
      method: $("a_method").value,
      breakMin: $("a_breakMin").value,
      temp: $("a_temp").value,
      condition: $("a_condition").value,
      fatigue: $("a_fatigue").value,
      alcState: $("a_alcState").value,
      alcValue: $("a_alcValue").value,
      alcJudge: $("a_alcJudge").value,
      odoEnd: $("a_odoEnd").value,
      abnormal: $("a_abnormal").value,
      abnormalDetail: $("a_abnormalDetail").value,
      createdAt: window.OFADB.nowIso()
    };
  }

  function dailyFromForm(){
    return {
      date: $("r_date").value,
      mainProject: $("r_mainProject").value.trim(),
      salesTotal: Number($("r_salesTotal").value || 0),
      profit: Number($("r_profit").value || 0),
      km: Number($("r_km").value || 0),
      memo: $("r_memo").value.trim(),
      createdAt: window.OFADB.nowIso()
    };
  }

  function clearDep(){
    $("d_at").value = guessNowLocal();
    $("d_method").value = "";
    $("d_sleep").value = "";
    $("d_temp").value = "";
    $("d_condition").value = "";
    $("d_fatigue").value = "";
    $("d_drink").value = "";
    $("d_alcState").value = "";
    $("d_alcValue").value = "";
    $("d_alcJudge").value = "";
    $("d_projectMain").value = "";
    $("d_area").value = "";
    $("d_odoStart").value = "";
    $("d_abnormal").value = "";
    $("d_abnormalDetail").value = "";
  }

  function clearArr(){
    $("a_at").value = guessNowLocal();
    $("a_method").value = "";
    $("a_breakMin").value = "";
    $("a_temp").value = "";
    $("a_condition").value = "";
    $("a_fatigue").value = "";
    $("a_alcState").value = "";
    $("a_alcValue").value = "";
    $("a_alcJudge").value = "";
    $("a_odoEnd").value = "";
    $("a_abnormal").value = "";
    $("a_abnormalDetail").value = "";
    updateOdoState();
  }

  function clearDaily(){
    $("r_date").value = todayYmd();
    $("r_mainProject").value = "";
    $("r_salesTotal").value = "";
    $("r_profit").value = "";
    $("r_km").value = "";
    $("r_memo").value = "";
  }

  function updateOdoState(){
    const s = Number($("d_odoStart").value || 0);
    const e = Number($("a_odoEnd").value || 0);
    if(s>0 && e>0 && e>=s){
      const diff = e - s;
      $("odoState").textContent = `èµ°è¡è·é¢ï¼${diff} km`;
      setDot("dotOdo","ok");
    }else{
      $("odoState").textContent = "èµ°è¡è·é¢ï¼æªè¨ç®";
      setDot("dotOdo","warn");
    }
  }

  function enrichWithProfile(obj){
    const p = state.profile || {};
    return {
      ...obj,
      name: p.name || "",
      base: p.base || "",
      phone: p.phone || "",
      phoneN: p.phoneN || window.OFADB.normalizePhone(p.phone || "")
    };
  }

  async function saveProfile(){
    const p = getProfileFromForm();
    if(!validateProfile(p)){
      toast("åºæ¬æå ±ï¼å¿é ï¼ããã¹ã¦å¥åãã¦ãã ããã");
      return;
    }
    await window.OFADB.put(window.OFADB.STORES.profile, p);
    await loadProfile();
    toast("åºæ¬æå ±ãä¿å­ãã¾ããã");
  }

  function validateDep(d){
    const need = ["at","method","sleep","temp","condition","fatigue","drink","alcState","alcValue","alcJudge","projectMain","area","odoStart","abnormal"];
    for(const k of need){
      if(!String(d[k] ?? "").trim()) return false;
    }
    if(d.abnormal==="ãã" && !String(d.abnormalDetail||"").trim()) return false;
    return true;
  }
  function validateArr(a){
    const need = ["at","method","breakMin","temp","condition","fatigue","alcState","alcValue","alcJudge","odoEnd","abnormal"];
    for(const k of need){
      if(!String(a[k] ?? "").trim()) return false;
    }
    if(a.abnormal==="ãã" && !String(a.abnormalDetail||"").trim()) return false;
    return true;
  }

  async function saveDep(){
    if(!state.profile){ await loadProfile(); }
    if(!state.profile || !state.profile.name){
      toast("åã«ãåºæ¬æå ±ããä¿å­ãã¦ãã ããã");
      return;
    }
    const d = enrichWithProfile(depFromForm());
    if(!validateDep(d)){
      toast("åºçºç¹å¼ã®å¿é é ç®ãå¥åãã¦ãã ãããï¼ç°å¸¸ããã®å ´åã¯ç°å¸¸åå®¹ãå¿é ï¼");
      return;
    }
    await window.OFADB.add(window.OFADB.STORES.tenko, d);
    toast("åºçºç¹å¼ãä¿å­ãã¾ããã");
    await renderHistory();
  }

  async function saveArr(){
    if(!state.profile){ await loadProfile(); }
    if(!state.profile || !state.profile.name){
      toast("åã«ãåºæ¬æå ±ããä¿å­ãã¦ãã ããã");
      return;
    }
    const a = enrichWithProfile(arrFromForm());
    if(!validateArr(a)){
      toast("å¸°çç¹å¼ã®å¿é é ç®ãå¥åãã¦ãã ãããï¼ç°å¸¸ããã®å ´åã¯ç°å¸¸åå®¹ãå¿é ï¼");
      return;
    }
    await window.OFADB.add(window.OFADB.STORES.tenko, a);
    toast("å¸°çç¹å¼ãä¿å­ãã¾ããã");
    await renderHistory();
  }

  async function saveDaily(){
    if(!state.profile){ await loadProfile(); }
    if(!state.profile || !state.profile.name){
      toast("åã«ãåºæ¬æå ±ããä¿å­ãã¦ãã ããã");
      return;
    }
    const r = enrichWithProfile(dailyFromForm());
    // ä»»æï¼å¨é¨ç©ºãªãä¿å­ããªã
    const hasAny = !!(r.date || r.mainProject || r.salesTotal || r.profit || r.km || r.memo);
    if(!hasAny){
      toast("æ¥å ±ã¯ä»»æã§ããä½ãå¥åãã¦ããä¿å­ãã¦ãã ããã");
      return;
    }
    if(!r.date) r.date = todayYmd();
    await window.OFADB.add(window.OFADB.STORES.daily, r);
    toast("æ¥å ±ãä¿å­ãã¾ããã");
    await renderHistory();
  }

  async function getDayBundle(ymd, profileFallback){
    const tenko = await window.OFADB.getAll(window.OFADB.STORES.tenko);
    const daily = await window.OFADB.getAll(window.OFADB.STORES.daily);

    const sameDayTenko = tenko.filter(t=> (t.at||"").slice(0,10) === ymd).sort((a,b)=> (a.at||"").localeCompare(b.at||""));
    const dep = sameDayTenko.find(x=>x.type==="dep") || null;
    const arr = sameDayTenko.slice().reverse().find(x=>x.type==="arr") || null;

    const dayDaily = daily.filter(d=> (d.date||"") === ymd).sort((a,b)=> (a.createdAt||"").localeCompare(b.createdAt||""));
    const d = dayDaily.length ? dayDaily[dayDaily.length-1] : null;

    const profile = state.profile || profileFallback || {};
    const odoDiff = (dep && arr) ? (Number(arr.odoEnd||0) - Number(dep.odoStart||0)) : "";
    return {profile, dep, arr, daily:d, odoDiff};
  }

  async function makeTodayPdf(){
    if(!state.profile){ await loadProfile(); }
    if(!state.profile){ toast("åºæ¬æå ±ãä¿å­ãã¦ãã ããã"); return; }

    const ymd = todayYmd();
    const bundle = await getDayBundle(ymd, state.profile);

    const files = {
      licenseImg: $("f_licenseImg").files?.[0] || null,
      alcDepImg:  $("f_alcDepImg").files?.[0] || null,
      alcArrImg:  $("f_alcArrImg").files?.[0] || null,
    };

    await window.generateTodayPdf({...bundle, files});
  }

  async function makeHistoryDayPdf(ymd){
    if(!state.profile){ await loadProfile(); }
    const bundle = await getDayBundle(ymd, state.profile);

    // å±¥æ­´PDFã¯åçãªãï¼éå»ãåçæããããï¼
    await window.generateTodayPdf({
      ...bundle,
      files: { licenseImg:null, alcDepImg:null, alcArrImg:null }
    });
  }

  function groupByDay(items, getKey){
    const map = new Map();
    for(const it of items){
      const k = getKey(it);
      if(!k) continue;
      if(!map.has(k)) map.set(k, []);
      map.get(k).push(it);
    }
    return map;
  }

  async function renderHistory(){
    const box = $("historyBox");
    box.innerHTML = "";

    const tenko = await window.OFADB.getAll(window.OFADB.STORES.tenko);
    const daily = await window.OFADB.getAll(window.OFADB.STORES.daily);

    // group by day
    const tenkoByDay = groupByDay(tenko, t=> (t.at||"").slice(0,10));
    const dailyByDay = groupByDay(daily, d=> d.date);

    const days = new Set([...tenkoByDay.keys(), ...dailyByDay.keys()]);
    const dayList = Array.from(days).sort((a,b)=> b.localeCompare(a));

    if(!dayList.length){
      box.innerHTML = `<div class="note">å±¥æ­´ãããã¾ãã</div>`;
      return;
    }

    for(const day of dayList){
      const tList = (tenkoByDay.get(day) || []).slice().sort((a,b)=> (a.at||"").localeCompare(b.at||""));
      const dList = (dailyByDay.get(day) || []).slice().sort((a,b)=> (a.createdAt||"").localeCompare(b.createdAt||""));

      const dep = tList.find(x=>x.type==="dep");
      const arr = tList.slice().reverse().find(x=>x.type==="arr");
      const odoDiff = (dep && arr) ? (Number(arr.odoEnd||0) - Number(dep.odoStart||0)) : null;

      const el = document.createElement("div");
      el.className = "histItem";

      const title = document.createElement("div");
      title.className = "histTop";

      const left = document.createElement("div");
      left.innerHTML = `<div class="histTitle">${day}</div>`;

      const right = document.createElement("div");
      const btnDel = document.createElement("button");
      btnDel.className = "miniBtn danger";
      btnDel.textContent = "åé¤";
      btnDel.addEventListener("click", async (ev)=>{
        ev.stopPropagation();
        if(!confirm(`${day} ã®å±¥æ­´ï¼ç¹å¼/æ¥å ±ï¼ãåé¤ãã¾ããï¼`)) return;

        // delete all that day
        for(const t of tList){ await window.OFADB.del(window.OFADB.STORES.tenko, t.id); }
        for(const d of dList){ await window.OFADB.del(window.OFADB.STORES.daily, d.id); }
        await renderHistory();
      });
      right.appendChild(btnDel);

      title.appendChild(left);
      title.appendChild(right);

      const body = document.createElement("div");
      body.className = "histBody";
      body.innerHTML = `
        ç¹å¼ï¼${tList.length}ä»¶ / æ¥å ±ï¼${dList.length}ä»¶<br/>
        èµ°è¡è·é¢ï¼${odoDiff==null ? "æªè¨ç®" : (odoDiff + " km")}
        <div class="histHint">ã¿ããã§ãã®æ¥ã®PDFãä½æ</div>
      `;

      el.appendChild(title);
      el.appendChild(body);

      el.addEventListener("click", async ()=>{
        await makeHistoryDayPdf(day);
      });

      box.appendChild(el);
    }
  }

  async function clearAll(){
    if(!confirm("ç«¯æ«åã®å±¥æ­´ï¼ç¹å¼ã»æ¥å ±ï¼ãå¨ã¦åé¤ãã¾ããããããã§ããï¼")) return;
    await window.OFADB.clear(window.OFADB.STORES.tenko);
    await window.OFADB.clear(window.OFADB.STORES.daily);
    toast("å¨åé¤ãã¾ããã");
    await renderHistory();
  }

  // ---- Monthly (Driver) ----
  function getMonthlyFilters(){
    const start = $("m_start").value;
    const end = $("m_end").value;
    if(!start || !end) return null;
    return {
      start, end,
      base: state.profile?.base || "",
      name: state.profile?.name || "",
      phone: state.profile?.phone || ""
    };
  }

  function inRange(dateStr, start, end){
    if(!dateStr) return false;
    return dateStr >= start && dateStr <= end;
  }

  async function monthlySearch(){
    if(!state.profile){ await loadProfile(); }
    if(!state.profile){ toast("åºæ¬æå ±ãä¿å­ãã¦ãã ããã"); return; }

    const f = getMonthlyFilters();
    if(!f){ toast("æéï¼éå§/çµäºï¼ãå¥åãã¦ãã ããã"); return; }

    const tenko = await window.OFADB.getAll(window.OFADB.STORES.tenko);
    const daily = await window.OFADB.getAll(window.OFADB.STORES.daily);

    const nameKey = (state.profile.name||"").trim();
    const phoneKey = window.OFADB.normalizePhone(state.profile.phone||"");

    // driver criteria: match name OR phone
    const tenkoHit = tenko.filter(t=>{
      const d = (t.at||"").slice(0,10);
      if(!inRange(d, f.start, f.end)) return false;
      const okName = nameKey && (t.name||"").includes(nameKey);
      const okPhone = phoneKey && (t.phoneN||window.OFADB.normalizePhone(t.phone||"")).includes(phoneKey);
      return okName || okPhone;
    });

    const dailyHit = daily.filter(r=>{
      const d = (r.date||"").slice(0,10);
      if(!inRange(d, f.start, f.end)) return false;
      const okName = nameKey && (r.name||"").includes(nameKey);
      const okPhone = phoneKey && (r.phoneN||window.OFADB.normalizePhone(r.phone||"")).includes(phoneKey);
      return okName || okPhone;
    });

    state.monthly = { tenko: tenkoHit, daily: dailyHit, filters: f };

    // render mini summary
    const sumSales = dailyHit.reduce((a,r)=> a + (Number(r.salesTotal)||0), 0);
    const sumProfit = dailyHit.reduce((a,r)=> a + (Number(r.profit)||0), 0);
    const sumKm = dailyHit.reduce((a,r)=> a + (Number(r.km)||0), 0);

    $("monthlyState").textContent = `æ¤ç´¢çµæï¼ç¹å¼ ${tenkoHit.length}ä»¶ / æ¥å ± ${dailyHit.length}ä»¶ / å£²ä¸ ${sumSales} / å©ç ${sumProfit} / èµ°è¡ ${sumKm}km`;

    const box = $("monthlyBox");
    box.innerHTML = "";
    const row = document.createElement("div");
    row.className = "monthRow";
    row.innerHTML = `
      <div class="top">
        <div style="font-weight:900">${f.start} ã ${f.end}</div>
        <div class="meta">${state.profile.name} / ${state.profile.base}</div>
      </div>
      <div class="kpi">
        <span>ç¹å¼ï¼${tenkoHit.length}</span>
        <span>æ¥å ±ï¼${dailyHit.length}</span>
        <span>å£²ä¸ï¼${sumSales}</span>
        <span>å©çï¼${sumProfit}</span>
        <span>èµ°è¡ï¼${sumKm}km</span>
      </div>
      <div class="note" style="margin-top:8px">ãæéPDFï¼æå ±ï¼ãã§PDFåºåã§ãã¾ã</div>
    `;
    box.appendChild(row);
  }

  async function monthlyPdf(){
    if(!state.monthly?.filters){
      await monthlySearch();
      if(!state.monthly?.filters) return;
    }
    await window.createMonthlyPdf({
      tenko: state.monthly.tenko,
      daily: state.monthly.daily,
      filters: state.monthly.filters,
      title: "OFA_æéPDF"
    });
  }

  // init
  async function init(){
    // set defaults
    $("d_at").value = guessNowLocal();
    $("a_at").value = guessNowLocal();
    $("r_date").value = todayYmd();

    // monthly defaults: this month
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth()+1, 0);
    const f = (d)=> `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    $("m_start").value = f(start);
    $("m_end").value = f(end);

    await loadProfile();
    updateOdoState();

    $("btnSaveProfile").addEventListener("click", saveProfile);
    $("btnLoadProfile").addEventListener("click", loadProfile);

    $("btnSaveDep").addEventListener("click", saveDep);
    $("btnClearDep").addEventListener("click", ()=>{ clearDep(); toast("åºçºç¹å¼ãã¯ãªã¢ãã¾ãã"); });

    $("btnSaveArr").addEventListener("click", saveArr);
    $("btnClearArr").addEventListener("click", ()=>{ clearArr(); toast("å¸°çç¹å¼ãã¯ãªã¢ãã¾ãã"); });

    $("btnSaveDaily").addEventListener("click", saveDaily);
    $("btnClearDaily").addEventListener("click", ()=>{ clearDaily(); toast("æ¥å ±ãã¯ãªã¢ãã¾ãã"); });

    $("d_odoStart").addEventListener("input", updateOdoState);
    $("a_odoEnd").addEventListener("input", updateOdoState);

    $("btnMakePdf").addEventListener("click", makeTodayPdf);
    $("btnMakeCsv").addEventListener("click", ()=> window.OFACSV.exportAllCsv());

    $("btnReloadHistory").addEventListener("click", renderHistory);
    $("btnClearAll").addEventListener("click", clearAll);

    $("btnMonthlySearch").addEventListener("click", monthlySearch);
    $("btnMonthlyPdf").addEventListener("click", monthlyPdf);

    await renderHistory();
  }

  window.addEventListener("DOMContentLoaded", init);
})();
