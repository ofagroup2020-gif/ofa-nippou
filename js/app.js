/* /ofa-nippou/js/app.js
   OFA 点呼/日報 ドライバー用
   - DOMContentLoadedで確実にイベント登録（Chrome対策）
   - クリックが効かない問題（null要素・古いJS掴み）を防止
   - IndexedDB(db.js) を使用
*/

(function () {
  "use strict";

  // ===== helpers =====
  const $ = (id) => document.getElementById(id);

  function toast(msg) {
    // iOS Safari / Chrome どちらでも見える最低限
    try {
      alert(msg);
    } catch (e) {
      console.log(msg);
    }
  }

  function num(v) {
    const x = Number(v);
    return Number.isFinite(x) ? x : 0;
  }

  function trim(v) {
    return String(v ?? "").trim();
  }

  function nowDateKey() {
    // YYYY-MM-DD
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  }

  function normalizeDate(d) {
    if (!d) return "";
    return String(d).slice(0, 10);
  }

  function toISODateTimeLocal(v) {
    // datetime-local -> keep "YYYY-MM-DDTHH:mm"
    if (!v) return "";
    return String(v).slice(0, 16);
  }

  // ===== checklist master =====
  const CHECK_ITEMS = [
    "タイヤ（空気圧・溝）",
    "ホイールナットの緩み",
    "ブレーキの効き",
    "ライト（前照灯）",
    "ウインカー",
    "ハザード",
    "ブレーキランプ",
    "ワイパー",
    "ウォッシャー液",
    "ミラー",
    "クラクション",
    "シートベルト",
    "バックカメラ/ドラレコ",
    "積載物の固定",
    "荷台・扉の施錠",
    "車内整理（足元）",
    "燃料残量",
    "警告灯（メーター）",
    "オイル漏れ",
    "クーラント漏れ",
    "異音・異臭",
  ];

  function buildChecklistUI() {
    const box = $("checkScroll");
    if (!box) return;

    box.innerHTML = "";
    CHECK_ITEMS.forEach((label, idx) => {
      const row = document.createElement("div");
      row.className = "checkRow";

      const item = document.createElement("div");
      item.className = "checkCol item";
      item.textContent = label;

      const ok = document.createElement("div");
      ok.className = "checkCol ok";

      const ng = document.createElement("div");
      ng.className = "checkCol ng";

      const name = `chk_${idx}`;
      ok.innerHTML = `
        <label class="radioWrap">
          <input type="radio" name="${name}" value="OK">
          <span>OK</span>
        </label>
      `;
      ng.innerHTML = `
        <label class="radioWrap">
          <input type="radio" name="${name}" value="NG">
          <span>NG</span>
        </label>
      `;

      row.appendChild(item);
      row.appendChild(ok);
      row.appendChild(ng);
      box.appendChild(row);
    });
  }

  function readChecklist() {
    const list = [];
    CHECK_ITEMS.forEach((label, idx) => {
      const name = `chk_${idx}`;
      const picked = document.querySelector(`input[name="${name}"]:checked`);
      const v = picked ? picked.value : "";
      list.push({ label, ok: v === "OK" });
    });
    return list;
  }

  function setChecklist(list) {
    if (!Array.isArray(list)) return;
    list.forEach((x, idx) => {
      const name = `chk_${idx}`;
      const v = x && x.ok ? "OK" : "NG";
      const el = document.querySelector(`input[name="${name}"][value="${v}"]`);
      if (el) el.checked = true;
    });
  }

  // ===== profile =====
  async function saveProfile() {
    const name = trim($("p_name")?.value);
    const base = trim($("p_base")?.value);
    const carNo = trim($("p_carNo")?.value);
    const licenseNo = trim($("p_licenseNo")?.value);
    const phone = trim($("p_phone")?.value);
    const email = trim($("p_email")?.value);

    if (!name || !base || !carNo || !licenseNo || !phone || !email) {
      toast("基本情報が未入力です（*必須をすべて入力してください）");
      return;
    }

    const profile = {
      id: "me",
      name,
      base,
      carNo,
      licenseNo,
      phone,
      email,
      updatedAt: new Date().toISOString(),
    };

    try {
      await idbPut("profile", profile);
      setProfileState(true, "保存済み");
      toast("基本情報を保存しました");
    } catch (e) {
      console.error(e);
      toast("保存に失敗しました（IndexedDBが使えない可能性）");
    }
  }

  async function loadProfile() {
    try {
      const p = await idbGet("profile", "me");
      if (!p) {
        setProfileState(false, "未保存");
        toast("まだ保存がありません");
        return;
      }
      $("p_name").value = p.name || "";
      $("p_base").value = p.base || "";
      $("p_carNo").value = p.carNo || "";
      $("p_licenseNo").value = p.licenseNo || "";
      $("p_phone").value = p.phone || "";
      $("p_email").value = p.email || "";
      setProfileState(true, "保存済み（読み込み完了）");
      toast("基本情報を読み込みました");
    } catch (e) {
      console.error(e);
      toast("読み込みに失敗しました");
    }
  }

  function setProfileState(ok, text) {
    const dot = $("dotProfile");
    const st = $("profileState");
    if (dot) {
      dot.classList.toggle("ok", !!ok);
      dot.classList.toggle("ng", !ok);
    }
    if (st) st.textContent = text || (ok ? "保存済み" : "未保存");
  }

  // ===== tenko (dep/arr) =====
  async function getProfileOrFail() {
    const p = await idbGet("profile", "me");
    if (!p) {
      toast("先に① 基本情報を保存してください");
      throw new Error("no profile");
    }
    return p;
  }

  function buildCommonTenkoPayload(profile, type) {
    return {
      id: "", // later
      type, // departure / arrival
      name: profile.name,
      base: profile.base,
      carNo: profile.carNo,
      licenseNo: profile.licenseNo,
      phone: profile.phone,
      email: profile.email,
    };
  }

  async function saveDeparture() {
    const profile = await getProfileOrFail();

    const at = toISODateTimeLocal($("d_at")?.value);
    const method = trim($("d_method")?.value);
    const sleep = trim($("d_sleep")?.value);
    const temp = trim($("d_temp")?.value);
    const condition = trim($("d_condition")?.value);
    const fatigue = trim($("d_fatigue")?.value);
    const med = trim($("d_med")?.value);
    const medDetail = trim($("d_medDetail")?.value);

    const drink = trim($("d_drink")?.value);
    const alcState = trim($("d_alcState")?.value);
    const alcValue = trim($("d_alcValue")?.value);
    const alcJudge = trim($("d_alcJudge")?.value);

    const mainProject = trim($("d_projectMain")?.value);
    const area = trim($("d_area")?.value);
    const danger = trim($("d_danger")?.value);

    const odoStart = trim($("d_odoStart")?.value);
    const abnormal = trim($("d_abnormal")?.value);
    const abnormalDetail = trim($("d_abnormalDetail")?.value);

    if (!at || !method || !sleep || !temp || !condition || !fatigue || !med || !drink || !alcState || !alcValue || !alcJudge || !mainProject || !area || !danger || !odoStart || !abnormal) {
      toast("出発点呼：必須項目が未入力です（*）");
      return;
    }
    if (abnormal === "あり" && !abnormalDetail) {
      toast("異常ありの場合は「異常内容」を入力してください");
      return;
    }

    const checklist = readChecklist();
    const checkMemo = trim($("checkMemo")?.value);

    const dateKey = normalizeDate(at);
    const id = `dep_${dateKey}_${Date.now()}`;

    const payload = {
      ...buildCommonTenkoPayload(profile, "departure"),
      id,
      at,
      method,
      sleep,
      temp,
      condition,
      fatigue,
      med,
      medDetail,
      drink,
      alcState,
      alcValue,
      alcJudge,
      mainProject,
      area,
      danger,
      odoStart,
      abnormal,
      abnormalDetail,
      checklist,
      checkMemo,
      createdAt: new Date().toISOString(),
    };

    try {
      await idbPut("tenko", payload);
      toast("出発点呼を保存しました");
      await reloadHistory();
    } catch (e) {
      console.error(e);
      toast("保存に失敗しました");
    }
  }

  async function saveArrival() {
    const profile = await getProfileOrFail();

    const at = toISODateTimeLocal($("a_at")?.value);
    const method = trim($("a_method")?.value);
    const breakMin = trim($("a_breakMin")?.value);
    const temp = trim($("a_temp")?.value);
    const condition = trim($("a_condition")?.value);
    const fatigue = trim($("a_fatigue")?.value);
    const med = trim($("a_med")?.value);
    const medDetail = trim($("a_medDetail")?.value);

    const alcState = trim($("a_alcState")?.value);
    const alcValue = trim($("a_alcValue")?.value);
    const alcJudge = trim($("a_alcJudge")?.value);

    const odoEnd = trim($("a_odoEnd")?.value);
    const abnormal = trim($("a_abnormal")?.value);
    const abnormalDetail = trim($("a_abnormalDetail")?.value);

    if (!at || !method || !breakMin || !temp || !condition || !fatigue || !med || !alcState || !alcValue || !alcJudge || !odoEnd || !abnormal) {
      toast("帰着点呼：必須項目が未入力です（*）");
      return;
    }
    if (abnormal === "あり" && !abnormalDetail) {
      toast("異常ありの場合は「異常内容」を入力してください");
      return;
    }

    const checklist = readChecklist();
    const checkMemo = trim($("checkMemo")?.value);

    const dateKey = normalizeDate(at);
    const id = `arr_${dateKey}_${Date.now()}`;

    const payload = {
      ...buildCommonTenkoPayload(profile, "arrival"),
      id,
      at,
      method,
      breakMin,
      temp,
      condition,
      fatigue,
      med,
      medDetail,
      alcState,
      alcValue,
      alcJudge,
      odoEnd,
      abnormal,
      abnormalDetail,
      checklist,
      checkMemo,
      createdAt: new Date().toISOString(),
    };

    try {
      await idbPut("tenko", payload);
      toast("帰着点呼を保存しました");
      await reloadHistory();
      updateOdoChip(); // 最新から計算
    } catch (e) {
      console.error(e);
      toast("保存に失敗しました");
    }
  }

  function clearDeparture() {
    ["d_at","d_method","d_sleep","d_temp","d_condition","d_fatigue","d_med","d_medDetail","d_drink","d_alcState","d_alcValue","d_alcJudge","d_projectMain","d_area","d_danger","d_odoStart","d_abnormal","d_abnormalDetail"].forEach(id=>{
      const el = $(id);
      if (!el) return;
      if (el.tagName === "SELECT") el.value = "";
      else el.value = "";
    });
    toast("出発点呼をクリアしました");
  }

  function clearArrival() {
    ["a_at","a_method","a_breakMin","a_temp","a_condition","a_fatigue","a_med","a_medDetail","a_alcState","a_alcValue","a_alcJudge","a_odoEnd","a_abnormal","a_abnormalDetail"].forEach(id=>{
      const el = $(id);
      if (!el) return;
      if (el.tagName === "SELECT") el.value = "";
      else el.value = "";
    });
    toast("帰着点呼をクリアしました");
  }

  // ===== daily report =====
  function calcDaily(profile, odoDiff) {
    const r_date = $("r_date")?.value || "";
    const mainProject = $("d_projectMain")?.value || ""; // 出発側のメイン案件を優先
    const memo = trim($("r_memo")?.value);

    const payBase = num($("r_payBase")?.value);
    const incentive = num($("r_incentive")?.value);
    const fuel = num($("r_fuel")?.value);
    const highway = num($("r_highway")?.value);
    const parking = num($("r_parking")?.value);
    const otherCost = num($("r_otherCost")?.value);

    const salesTotal = payBase + incentive;
    const profit = salesTotal - (fuel + highway + parking + otherCost);

    const projects = readProjects();

    return {
      id: `daily_${normalizeDate(r_date || nowDateKey())}_${Date.now()}`,
      name: profile.name,
      base: profile.base,
      date: normalizeDate(r_date || nowDateKey()),
      mainProject: trim(mainProject),
      odoDiff: num(odoDiff),
      payBase,
      incentive,
      fuel,
      highway,
      parking,
      otherCost,
      salesTotal,
      profit,
      memo,
      projects,
      createdAt: new Date().toISOString(),
    };
  }

  // ===== multi projects =====
  function readProjects() {
    const box = $("projectsBox");
    if (!box) return [];
    const rows = Array.from(box.querySelectorAll(".projRow"));
    return rows.map((r) => {
      const name = r.querySelector(".projName")?.value ?? "";
      const amount = r.querySelector(".projAmount")?.value ?? "";
      const memo = r.querySelector(".projMemo")?.value ?? "";
      return { name: trim(name), amount: num(amount), memo: trim(memo) };
    }).filter(x => x.name || x.amount || x.memo);
  }

  function addProjectRow(prefill) {
    const box = $("projectsBox");
    if (!box) return;

    const row = document.createElement("div");
    row.className = "projRow";
    row.style.marginBottom = "10px";
    row.innerHTML = `
      <div class="row">
        <div>
          <label>案件名（任意）</label>
          <input class="projName" placeholder="例：企業便A" value="${prefill?.name ?? ""}">
        </div>
        <div>
          <label>金額（任意）</label>
          <input class="projAmount" inputmode="decimal" placeholder="例：5000" value="${prefill?.amount ?? ""}">
        </div>
      </div>
      <label>メモ（任意）</label>
      <input class="projMemo" placeholder="任意" value="${prefill?.memo ?? ""}">
      <div class="actions" style="margin-top:8px">
        <button class="btn secondary btnRemoveProj" type="button">この案件を削除</button>
      </div>
      <div class="divider"></div>
    `;

    row.querySelector(".btnRemoveProj").addEventListener("click", () => {
      row.remove();
    });

    box.appendChild(row);
  }

  // ===== odo chip calc =====
  async function updateOdoChip() {
    const tenko = await idbGetAll("tenko");
    if (!tenko || tenko.length === 0) {
      setOdoState(false, "走行距離：未計算");
      return;
    }

    // 最新日の dep+arr を探して差分計算
    const byDate = new Map(); // date -> {dep, arr}
    tenko.forEach(t => {
      const d = normalizeDate(t.at);
      if (!d) return;
      if (!byDate.has(d)) byDate.set(d, { dep: null, arr: null });
      if (t.type === "departure") byDate.get(d).dep = t;
      if (t.type === "arrival") byDate.get(d).arr = t;
    });

    const dates = Array.from(byDate.keys()).sort(); // asc
    const latest = dates[dates.length - 1];
    const pair = byDate.get(latest);
    const dep = pair?.dep?.odoStart;
    const arr = pair?.arr?.odoEnd;
    const diff = num(arr) - num(dep);

    if (diff > 0) setOdoState(true, `走行距離：${diff} km（${latest}）`);
    else setOdoState(false, `走行距離：未計算（${latest}）`);
  }

  function setOdoState(ok, text) {
    const dot = $("dotOdo");
    const st = $("odoState");
    if (dot) {
      dot.classList.toggle("ok", !!ok);
      dot.classList.toggle("ng", !ok);
    }
    if (st) st.textContent = text || (ok ? "走行距離：OK" : "走行距離：未計算");
  }

  // ===== export =====
  async function makeTodayPdf() {
    try {
      const profile = await getProfileOrFail();

      // 今日の日付で dep/arr を探す（無ければ最新）
      const tenko = await idbGetAll("tenko");
      const dailyAll = await idbGetAll("daily");

      const today = nowDateKey();

      const pickTenko = (dateKey) => {
        const dep = tenko
          .filter(t => t.type === "departure" && normalizeDate(t.at) === dateKey && t.name === profile.name && t.base === profile.base)
          .sort((a,b)=> String(b.at).localeCompare(String(a.at)))[0] || null;
        const arr = tenko
          .filter(t => t.type === "arrival" && normalizeDate(t.at) === dateKey && t.name === profile.name && t.base === profile.base)
          .sort((a,b)=> String(b.at).localeCompare(String(a.at)))[0] || null;
        return { dep, arr };
      };

      let { dep, arr } = pickTenko(today);

      // fallback: 最新日
      if (!dep && !arr) {
        const dates = Array.from(new Set(tenko.map(t => normalizeDate(t.at)).filter(Boolean))).sort();
        const latest = dates[dates.length - 1];
        if (latest) ({ dep, arr } = pickTenko(latest));
      }

      const odoDiff = Math.max(0, num(arr?.odoEnd) - num(dep?.odoStart));

      // 日報は r_date指定があればそれ、なければ今日
      const wantedDailyDate = normalizeDate($("r_date")?.value || today);
      const daily = dailyAll
        .filter(d => normalizeDate(d.date) === wantedDailyDate && d.name === profile.name && d.base === profile.base)
        .sort((a,b)=> String(b.createdAt).localeCompare(String(a.createdAt)))[0] || null;

      const files = {
        licenseImg: $("f_licenseImg")?.files?.[0] || null,
        alcDepImg: $("f_alcDepImg")?.files?.[0] || null,
        alcArrImg: $("f_alcArrImg")?.files?.[0] || null,
      };

      await generateTodayPdf({
        profile,
        dep,
        arr,
        daily,
        odoDiff,
        files,
      });

    } catch (e) {
      console.error(e);
      // getProfileOrFail が投げるので alertはそっちで出る
    }
  }

  async function makeAllCsv() {
    try {
      const tenko = await idbGetAll("tenko");
      const daily = await idbGetAll("daily");

      // 既存のcsv.jsの関数を流用
      const tenkoCsv = buildTenkoCsv(tenko || []);
      const dailyCsv = buildDailyCsv(daily || []);

      downloadText(`OFA_点呼_ALL.csv`, tenkoCsv);
      downloadText(`OFA_日報_ALL.csv`, dailyCsv);

      toast("CSVを出力しました（2ファイル）");
    } catch (e) {
      console.error(e);
      toast("CSV出力に失敗しました");
    }
  }

  // ===== history =====
  async function reloadHistory() {
    const box = $("historyBox");
    if (!box) return;

    const tenko = await idbGetAll("tenko");
    const daily = await idbGetAll("daily");

    // newest first
    tenko.sort((a,b)=> String(b.at).localeCompare(String(a.at)));
    daily.sort((a,b)=> String(b.date).localeCompare(String(a.date)));

    const html = [];

    html.push(`<div class="note"><b>点呼</b>：${tenko.length}件 / <b>日報</b>：${daily.length}件</div>`);

    if (tenko.length > 0) {
      html.push(`<div class="h2" style="margin-top:10px">点呼履歴</div>`);
      tenko.slice(0, 50).forEach(t => {
        html.push(`
          <div class="item">
            <span class="k">${normalizeDate(t.at)} ${(t.at||"").slice(11,16)} / ${t.type==="departure"?"出発":"帰着"}</span><br>
            <span class="v">${t.name} / ${t.base} / alc:${t.alcValue||""} / ${t.abnormal||""}</span>
          </div>
        `);
      });
      if (tenko.length > 50) html.push(`<div class="small">※表示は最新50件まで（保存は全件）</div>`);
    }

    if (daily.length > 0) {
      html.push(`<div class="h2" style="margin-top:14px">日報履歴</div>`);
      daily.slice(0, 50).forEach(d => {
        html.push(`
          <div class="item">
            <span class="k">${normalizeDate(d.date)} / ${d.name} / ${d.base}</span><br>
            <span class="v">売上:${d.salesTotal||0} 利益:${d.profit||0} 走行:${d.odoDiff||0}km</span>
          </div>
        `);
      });
      if (daily.length > 50) html.push(`<div class="small">※表示は最新50件まで（保存は全件）</div>`);
    }

    box.innerHTML = html.join("");

    await updateOdoChip();
  }

  async function clearAll() {
    if (!confirm("端末内データを全削除します。よろしいですか？")) return;
    try {
      const tenko = await idbGetAll("tenko");
      const daily = await idbGetAll("daily");
      const p = await idbGet("profile", "me");

      // delete all records
      for (const t of tenko) await idbDelete("tenko", t.id);
      for (const d of daily) await idbDelete("daily", d.id);
      if (p) await idbDelete("profile", "me");

      toast("全削除しました");
      setProfileState(false, "未保存");
      await reloadHistory();
    } catch (e) {
      console.error(e);
      toast("削除に失敗しました");
    }
  }

  // ===== save daily (optional) =====
  async function saveDailyOptional() {
    const profile = await getProfileOrFail();

    // odoDiff: 最新日の dep/arr から拾う（なければ0）
    const tenko = await idbGetAll("tenko");
    const dates = Array.from(new Set(tenko.map(t => normalizeDate(t.at)).filter(Boolean))).sort();
    const latest = dates[dates.length - 1] || nowDateKey();

    const dep = tenko
      .filter(t => t.type==="departure" && normalizeDate(t.at)===latest && t.name===profile.name && t.base===profile.base)
      .sort((a,b)=> String(b.at).localeCompare(String(a.at)))[0] || null;

    const arr = tenko
      .filter(t => t.type==="arrival" && normalizeDate(t.at)===latest && t.name===profile.name && t.base===profile.base)
      .sort((a,b)=> String(b.at).localeCompare(String(a.at)))[0] || null;

    const odoDiff = Math.max(0, num(arr?.odoEnd) - num(dep?.odoStart));
    const daily = calcDaily(profile, odoDiff);

    try {
      await idbPut("daily", daily);
      toast("日報を保存しました（任意）");
      await reloadHistory();
    } catch (e) {
      console.error(e);
      toast("日報保存に失敗しました");
    }
  }

  // ===== init events (IMPORTANT for Chrome) =====
  function bindEvents() {
    // profile
    const btnSaveProfile = $("btnSaveProfile");
    const btnLoadProfile = $("btnLoadProfile");

    if (btnSaveProfile) btnSaveProfile.addEventListener("click", saveProfile, { passive: true });
    if (btnLoadProfile) btnLoadProfile.addEventListener("click", loadProfile, { passive: true });

    // dep/arr
    const btnSaveDep = $("btnSaveDep");
    const btnClearDep = $("btnClearDep");
    const btnSaveArr = $("btnSaveArr");
    const btnClearArr = $("btnClearArr");

    if (btnSaveDep) btnSaveDep.addEventListener("click", () => saveDeparture().catch(()=>{}));
    if (btnClearDep) btnClearDep.addEventListener("click", clearDeparture);

    if (btnSaveArr) btnSaveArr.addEventListener("click", () => saveArrival().catch(()=>{}));
    if (btnClearArr) btnClearArr.addEventListener("click", clearArrival);

    // projects
    const btnAddProject = $("btnAddProject");
    if (btnAddProject) btnAddProject.addEventListener("click", () => addProjectRow());

    // export
    const btnMakePdf = $("btnMakePdf");
    const btnMakeCsv = $("btnMakeCsv");

    if (btnMakePdf) btnMakePdf.addEventListener("click", () => makeTodayPdf().catch(()=>{}));
    if (btnMakeCsv) btnMakeCsv.addEventListener("click", () => makeAllCsv().catch(()=>{}));

    // history
    const btnReloadHistory = $("btnReloadHistory");
    const btnClearAll = $("btnClearAll");

    if (btnReloadHistory) btnReloadHistory.addEventListener("click", () => reloadHistory().catch(()=>{}));
    if (btnClearAll) btnClearAll.addEventListener("click", () => clearAll().catch(()=>{}));

    // 追加：日報を自動保存したい場合のフック（ボタンが無いなら無視）
    const btnSaveDaily = $("btnSaveDaily");
    if (btnSaveDaily) btnSaveDaily.addEventListener("click", () => saveDailyOptional().catch(()=>{}));
  }

  async function boot() {
    buildChecklistUI();
    bindEvents();

    // 初期状態
    try {
      const p = await idbGet("profile", "me");
      if (p) setProfileState(true, "保存済み");
      else setProfileState(false, "未保存");
    } catch (e) {
      console.error(e);
      setProfileState(false, "未保存");
    }

    await reloadHistory();
  }

  // Chrome対策：必ずDOM準備後にboot
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

})();
