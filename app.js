// app.js
(function(){
  const cfg = () => window.OFA_CONFIG;

  function toast(msg, ms=2200){
    const el = document.createElement("div");
    el.className="toast";
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(()=>{ el.remove(); }, ms);
  }

  function qs(sel){ return document.querySelector(sel); }
  function qsa(sel){ return Array.from(document.querySelectorAll(sel)); }

  function setVersion(){
    qsa("[data-version]").forEach(el => el.textContent = cfg()?.VERSION || "");
    qsa("[data-appname]").forEach(el => el.textContent = cfg()?.APP_NAME || "OFA");
  }

  function todayYMD(){
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,"0");
    const da = String(d.getDate()).padStart(2,"0");
    return `${y}-${m}-${da}`;
  }

  async function fileToBase64(file){
    if(!file) return null;
    return new Promise((resolve,reject)=>{
      const r = new FileReader();
      r.onload = () => {
        const res = String(r.result || "");
        const base64 = res.split(",")[1] || "";
        resolve({
          name: file.name,
          type: file.type || "application/octet-stream",
          size: file.size || 0,
          base64
        });
      };
      r.onerror = () => reject(new Error("ファイル読込失敗"));
      r.readAsDataURL(file);
    });
  }

  // -------- API --------
  async function apiPost(payload){
    const url = cfg()?.GAS_URL;
    if(!url) throw new Error("GAS_URL 未設定");
    const res = await fetch(url, {
      method:"POST",
      mode:"cors",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify(payload)
    });
    const text = await res.text();
    let data=null;
    try{ data = JSON.parse(text); }catch(e){
      throw new Error("サーバー応答がJSONではありません: " + text.slice(0,120));
    }
    if(!data.ok) throw new Error(data.message || "サーバーエラー");
    return data;
  }

  // 共通：フォーム送信（type必須）
  async function submitForm(type, form){
    // typeは必須：ここが missing/unknown の原因なので、必ずセット
    if(!type) throw new Error("missing type");

    const fd = new FormData(form);

    // 必須フィールドざっくりチェック（HTML側 required もあるが念のため）
    const driverName = (fd.get("driverName")||"").toString().trim();
    if(!driverName) throw new Error("氏名が未入力です");

    const date = (fd.get("date")||"").toString().trim();
    if(!date) throw new Error("日付が未入力です");

    const alcoholValue = (fd.get("alcoholValue")||"").toString().trim();
    if(alcoholValue==="") throw new Error("アルコール数値が未入力です");

    const licenseNo = (fd.get("licenseNo")||"").toString().trim();
    if(!licenseNo) throw new Error("免許証番号が未入力です");

    // ファイル（任意）
    const files = {};
    for(const key of ["alcoholPhoto","licensePhoto","tenkoPhoto","abnormalPhoto","dailyPhoto"]){
      const f = fd.get(key);
      if(f && f instanceof File && f.size>0){
        files[key] = await fileToBase64(f);
      }
    }

    // チェック項目は「insp_」で拾う
    const inspections = {};
    for(const [k,v] of fd.entries()){
      if(String(k).startsWith("insp_")){
        inspections[k] = String(v);
      }
    }

    // 点呼項目は「tenko_」で拾う
    const tenko = {};
    for(const [k,v] of fd.entries()){
      if(String(k).startsWith("tenko_")){
        tenko[k] = String(v);
      }
    }

    const payload = {
      action: "submit",
      type, // departure / arrival
      driverName,
      date,
      // 共通
      phone: (fd.get("phone")||"").toString(),
      company: (fd.get("company")||"OFA").toString(),
      project: (fd.get("project")||"").toString(),
      area: (fd.get("area")||"").toString(),
      method: (fd.get("method")||"対面").toString(),

      // 必須
      alcoholValue: Number(alcoholValue),
      alcoholJudge: (fd.get("alcoholJudge")||"なし").toString(),
      licenseNo,

      // 出発：睡眠 / 帰着：休憩
      sleepHours: (fd.get("sleepHours")||"").toString(),
      restHours: (fd.get("restHours")||"").toString(),

      // 体調系（tenkoに入れてもOKだが一覧化）
      temperature: (fd.get("temperature")||"").toString(),
      condition: (fd.get("condition")||"良好").toString(),
      fatigue: (fd.get("fatigue")||"なし").toString(),
      medication: (fd.get("medication")||"なし").toString(),

      // メーター等（任意）
      odoStart: (fd.get("odoStart")||"").toString(),
      odoEnd: (fd.get("odoEnd")||"").toString(),

      // 日報（arrivalのみ）
      workContent: (fd.get("workContent")||"").toString(),
      workingTime: (fd.get("workingTime")||"").toString(),
      deliveryCount: (fd.get("deliveryCount")||"").toString(),
      trouble: (fd.get("trouble")||"").toString(),
      dailyMemo: (fd.get("dailyMemo")||"").toString(),

      // 点検メモ
      inspMemo: (fd.get("inspMemo")||"").toString(),

      // まとめ
      tenko,
      inspections,
      files
    };

    return await apiPost(payload);
  }

  async function generateDailyPdf(date, driverName){
    return await apiPost({ action:"generateDailyPdf", date, driverName });
  }
  async function generateMonthlyCsv(ym, driverName){
    return await apiPost({ action:"generateMonthlyCsv", ym, driverName });
  }
  async function generateMonthlyPdf(ym, driverName){
    return await apiPost({ action:"generateMonthlyPdf", ym, driverName });
  }
  async function listMy(dateFrom, dateTo, driverName){
    return await apiPost({ action:"listMy", dateFrom, dateTo, driverName });
  }
  async function adminSearch(dateFrom, dateTo, keyword){
    return await apiPost({ action:"adminSearch", dateFrom, dateTo, keyword });
  }

  // ---- export ----
  window.OFA_APP = {
    toast, setVersion, todayYMD, submitForm,
    generateDailyPdf, generateMonthlyCsv, generateMonthlyPdf,
    listMy, adminSearch
  };
})();
