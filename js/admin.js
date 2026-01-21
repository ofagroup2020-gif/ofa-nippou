// ==============================
// js/main.js
// ドライバー側：
// ・基本情報保存
// ・出発点呼 / 帰着点呼（完全分離）
// ・日常点検（スクロール）
// ・日報（任意）
// ・IndexedDB保存
// ・今日のPDF生成
// ==============================

(() => {
  const $ = (id) => document.getElementById(id);

  // ====== Elements ======
  const btnSaveProfile = $("btnSaveProfile");
  const btnSaveDeparture = $("btnSaveDeparture");
  const btnSaveArrival = $("btnSaveArrival");
  const btnSaveDaily = $("btnSaveDaily");
  const btnTodayPdf = $("btnTodayPdf");

  // ====== Helpers ======
  function uid(){
    return Date.now().toString() + "_" + Math.random().toString(36).slice(2,8);
  }

  function getProfile(){
    return JSON.parse(localStorage.getItem("ofa_profile") || "{}");
  }

  function setProfile(p){
    localStorage.setItem("ofa_profile", JSON.stringify(p));
  }

  function must(v, msg){
    if(!v){
      alert(msg);
      throw new Error(msg);
    }
  }

  function today(){
    return new Date().toISOString().slice(0,10);
  }

  function nowLocal(){
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0,16);
  }

  // ====== 基本情報 ======
  async function saveProfile(){
    const p = {
      id: "me",
      name: $("name").value.trim(),
      base: $("base").value.trim(),
      carNo: $("carNo").value.trim(),
      licenseNo: $("licenseNo").value.trim(),
      phone: $("phone").value.trim(),
      email: $("email").value.trim(),
      savedAt: new Date().toISOString()
    };

    must(p.name, "氏名は必須です");
    must(p.base, "拠点は必須です");
    must(p.licenseNo, "免許証番号は必須です");
    must(p.phone, "電話番号は必須です");
    must(p.email, "メールは必須です");

    await idbPut(STORE_PROFILE, p);
    setProfile(p);
    alert("基本情報を保存しました");
  }

  btnSaveProfile?.addEventListener("click", saveProfile);

  // ====== 日常点検 ======
  function readChecklist(){
    const list = [];
    document.querySelectorAll("#dailyCheck input[type=checkbox]").forEach(chk => {
      list.push({
        label: chk.dataset.label || chk.parentElement.textContent.trim(),
        ok: chk.checked
      });
    });
    return list;
  }

  // ====== 出発点呼 ======
  async function saveDeparture(){
    const profile = getProfile();
    must(profile.name, "先に基本情報を保存してください");

    const at = $("dep_at").value;
    must(at, "出発点呼の日時を入力してください");

    const rec = {
      id: uid(),
      type: "departure",
      at,
      name: profile.name,
      base: profile.base,
      carNo: profile.carNo,
      licenseNo: profile.licenseNo,
      phone: profile.phone,
      email: profile.email,

      method: $("dep_method").value,
      sleep: $("dep_sleep").value,
      temp: $("dep_temp").value,
      condition: $("dep_condition").value,
      fatigue: $("dep_fatigue").value,

      med: $("dep_med").value,
      medDetail: $("dep_med_detail").value,

      alcValue: $("dep_alc").value,
      alcJudge: $("dep_alc_judge").value,

      odoStart: $("dep_odo").value,

      abnormal: $("dep_abnormal").value,
      abnormalDetail: $("dep_abnormal_detail").value,

      checklist: readChecklist(),
      checkMemo: $("checkMemo").value,

      createdAt: new Date().toISOString()
    };

    await idbPut(STORE_TENKO, rec);
    alert("出発点呼を保存しました");
  }

  btnSaveDeparture?.addEventListener("click", saveDeparture);

  // ====== 帰着点呼 ======
  async function saveArrival(){
    const profile = getProfile();
    must(profile.name, "先に基本情報を保存してください");

    const at = $("arr_at").value;
    must(at, "帰着点呼の日時を入力してください");

    const rec = {
      id: uid(),
      type: "arrival",
      at,
      name: profile.name,
      base: profile.base,
      carNo: profile.carNo,
      licenseNo: profile.licenseNo,
      phone: profile.phone,
      email: profile.email,

      method: $("arr_method").value,
      sleep: $("arr_sleep").value,
      temp: $("arr_temp").value,
      condition: $("arr_condition").value,
      fatigue: $("arr_fatigue").value,

      med: $("arr_med").value,
      medDetail: $("arr_med_detail").value,

      alcValue: $("arr_alc").value,
      alcJudge: $("arr_alc_judge").value,

      odoEnd: $("arr_odo").value,

      abnormal: $("arr_abnormal").value,
      abnormalDetail: $("arr_abnormal_detail").value,

      checklist: readChecklist(),
      checkMemo: $("checkMemo").value,

      createdAt: new Date().toISOString()
    };

    await idbPut(STORE_TENKO, rec);
    alert("帰着点呼を保存しました");
  }

  btnSaveArrival?.addEventListener("click", saveArrival);

  // ====== 日報（任意） ======
  async function saveDaily(){
    const profile = getProfile();
    must(profile.name, "先に基本情報を保存してください");

    const date = $("daily_date").value || today();

    const rec = {
      id: uid(),
      date,
      name: profile.name,
      base: profile.base,

      mainProject: $("daily_project").value,

      payBase: $("daily_pay").value,
      incentive: $("daily_incentive").value,
      fuel: $("daily_fuel").value,
      highway: $("daily_highway").value,
      parking: $("daily_parking").value,
      otherCost: $("daily_other").value,

      salesTotal: $("daily_total").value,
      profit: $("daily_profit").value,

      memo: $("daily_memo").value,
      createdAt: new Date().toISOString()
    };

    await idbPut(STORE_DAILY, rec);
    alert("日報（任意）を保存しました");
  }

  btnSaveDaily?.addEventListener("click", saveDaily);

  // ====== 今日のPDF ======
  async function makeTodayPdf(){
    const profile = getProfile();
    must(profile.name, "基本情報が未保存です");

    const allTenko = await idbGetAll(STORE_TENKO);
    const allDaily = await idbGetAll(STORE_DAILY);

    const todayKey = today();

    const dep = allTenko.find(t => t.type==="departure" && t.at?.startsWith(todayKey));
    const arr = allTenko.find(t => t.type==="arrival" && t.at?.startsWith(todayKey));
    const daily = allDaily.find(d => d.date === todayKey);

    let odoDiff = "";
    if(dep?.odoStart && arr?.odoEnd){
      odoDiff = Number(arr.odoEnd) - Number(dep.odoStart);
    }

    const files = {
      licenseImg: $("licenseImg")?.files?.[0] || null,
      alcDepImg: $("dep_alc_img")?.files?.[0] || null,
      alcArrImg: $("arr_alc_img")?.files?.[0] || null
    };

    await generateTodayPdf({
      profile,
      dep,
      arr,
      daily,
      odoDiff,
      files
    });
  }

  btnTodayPdf?.addEventListener("click", makeTodayPdf);

})();
