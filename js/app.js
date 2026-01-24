// js/app.js
// OFA 点呼/日報（ドライバー）
// - IndexedDB保存（profile / tenko / daily）
// - PDF生成：window.generateTodayPdf を使用（pdf.js）
// - CSV：window.exportAllCsv があれば使う（csv.js）
// - 履歴タップで「過去日PDFを再出力」対応

(() => {
  // ------------------------------
  // DOM helpers
  // ------------------------------
  const $ = (id) => document.getElementById(id);
  const val = (id) => ($(id) ? $(id).value : "");
  const setVal = (id, v) => { if ($(id)) $(id).value = v ?? ""; };

  const alertMsg = (msg) => {
    try { window.alert(msg); } catch(e) { console.log(msg); }
  };

  const fmt = (v) => {
    if (!v) return "";
    return String(v).replace("T", " ").slice(0, 16);
  };

  const dateOnly = (v) => {
    if (!v) return "";
    // v: "YYYY-MM-DDTHH:mm" or "YYYY-MM-DD"
    return String(v).slice(0, 10);
  };

  const normalizePhone = (s) => String(s || "").replace(/[^\d]/g, "");
  const safeNum = (n) => {
    const x = Number(n);
    return Number.isFinite(x) ? x : 0;
  };

  // ------------------------------
  // IndexedDB minimal wrapper
  // db.js に idbOpen / STORE_* がある前提
  // 無い場合でも落ちないようガード
  // ------------------------------
  async function openDb() {
    if (typeof idbOpen === "function") return idbOpen();
    // フォールバック（万一）
    return new Promise((resolve, reject) => {
      const req = indexedDB.open("ofa_nippou_db", 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("profile")) db.createObjectStore("profile", { keyPath: "id" });
        if (!db.objectStoreNames.contains("tenko")) db.createObjectStore("tenko", { keyPath: "id" });
        if (!db.objectStoreNames.contains("daily")) db.createObjectStore("daily", { keyPath: "id" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  const STORE_PROFILE_SAFE = (typeof STORE_PROFILE !== "undefined") ? STORE_PROFILE : "profile";
  const STORE_TENKO_SAFE   = (typeof STORE_TENKO   !== "undefined") ? STORE_TENKO   : "tenko";
  const STORE_DAILY_SAFE   = (typeof STORE_DAILY   !== "undefined") ? STORE_DAILY   : "daily";

  async function tx(storeName, mode, fn) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const t = db.transaction([storeName], mode);
      const st = t.objectStore(storeName);
      let out;
      Promise.resolve()
        .then(() => fn(st))
        .then((r) => { out = r; })
        .catch(reject);

      t.oncomplete = () => resolve(out);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  }

  async function dbPut(storeName, obj) {
    return tx(storeName, "readwrite", (st) => new Promise((res, rej) => {
      const req = st.put(obj);
      req.onsuccess = () => res(true);
      req.onerror = () => rej(req.error);
    }));
  }

  async function dbGet(storeName, key) {
    return tx(storeName, "readonly", (st) => new Promise((res, rej) => {
      const req = st.get(key);
      req.onsuccess = () => res(req.result || null);
      req.onerror = () => rej(req.error);
    }));
  }

  async function dbGetAll(storeName) {
    return tx(storeName, "readonly", (st) => new Promise((res, rej) => {
      const req = st.getAll();
      req.onsuccess = () => res(req.result || []);
      req.onerror = () => rej(req.error);
    }));
  }

  async function dbDelete(storeName, key) {
    return tx(storeName, "readwrite", (st) => new Promise((res, rej) => {
      const req = st.delete(key);
      req.onsuccess = () => res(true);
      req.onerror = () => rej(req.error);
    }));
  }

  async function dbClear(storeName) {
    return tx(storeName, "readwrite", (st) => new Promise((res, rej) => {
      const req = st.clear();
      req.onsuccess = () => res(true);
      req.onerror = () => rej(req.error);
    }));
  }

  // ------------------------------
  // Checklist（簡易：必要なら増やしてOK）
  // ※ UIは index.html の #checkScroll に動的生成
  // ------------------------------
  const CHECK_ITEMS = [
    "タイヤ空気圧",
    "タイヤ溝",
    "ライト（前）",
    "ライト（後）",
    "ウインカー",
    "ブレーキ",
    "ワイパー",
    "ミラー",
    "ホーン",
    "オイル漏れ",
    "冷却水",
    "バッテリー",
    "積載状態",
    "車内清掃",
    "その他異常"
  ];

  function renderChecklist() {
    const wrap = $("checkScroll");
    if (!wrap) return;
    wrap.innerHTML = "";

    CHECK_ITEMS.forEach((label, idx) => {
      const row = document.createElement("div");
      row.className = "checkRow";
      row.style.display = "grid";
      row.style.gridTemplateColumns = "1fr 72px 72px";
      row.style.gap = "8px";
      row.style.alignItems = "center";
      row.style.padding = "10px 0";
      row.style.borderBottom = "1px solid #eef2f7";

      const item = document.createElement("div");
      item.className = "checkItem";
      item.textContent = label;

      const ok = document.createElement("input");
      ok.type = "radio";
      ok.name = `ck_${idx}`;
      ok.value = "ok";

      const ng = document.createElement("input");
      ng.type = "radio";
      ng.name = `ck_${idx}`;
      ng.value = "ng";

      const okBox = document.createElement("label");
      okBox.style.display = "flex";
      okBox.style.justifyContent = "center";
      okBox.style.alignItems = "center";
      okBox.style.gap = "6px";
      okBox.innerHTML = `<span style="font-weight:700">OK</span>`;
      okBox.prepend(ok);

      const ngBox = document.createElement("label");
      ngBox.style.display = "flex";
      ngBox.style.justifyContent = "center";
      ngBox.style.alignItems = "center";
      ngBox.style.gap = "6px";
      ngBox.innerHTML = `<span style="font-weight:700">NG</span>`;
      ngBox.prepend(ng);

      row.appendChild(item);
      row.appendChild(okBox);
      row.appendChild(ngBox);
      wrap.appendChild(row);
    });
  }

  function readChecklist() {
    const list = CHECK_ITEMS.map((label, idx) => {
      const ok = document.querySelector(`input[name="ck_${idx}"][value="ok"]`)?.checked || false;
      const ng = document.querySelector(`input[name="ck_${idx}"][value="ng"]`)?.checked || false;
      // 未選択は null 扱い
      let state = null;
      if (ok) state = true;
      if (ng) state = false;
      return { label, ok: state };
    }).filter(x => x.ok !== null);

    const memo = val("checkMemo");
    return { list, memo };
  }

  // ------------------------------
  // Profile
  // ------------------------------
  async function saveProfile() {
    const p = {
      id: "me",
      name: val("p_name").trim(),
      base: val("p_base").trim(),
      carNo: val("p_carNo").trim(),
      licenseNo: val("p_licenseNo").trim(),
      phone: val("p_phone").trim(),
      email: val("p_email").trim(),
      updatedAt: new Date().toISOString()
    };

    // 必須チェック
    const miss = [];
    if (!p.name) miss.push("氏名");
    if (!p.base) miss.push("拠点");
    if (!p.carNo) miss.push("車両番号");
    if (!p.licenseNo) miss.push("免許証番号");
    if (!p.phone) miss.push("電話番号");
    if (!p.email) miss.push("メールアドレス");

    if (miss.length) {
      alertMsg(`未入力があります：${miss.join(" / ")}`);
      return;
    }

    await dbPut(STORE_PROFILE_SAFE, p);
    setProfileState(true);
    alertMsg("基本情報を保存しました");
  }

  async function loadProfile() {
    const p = await dbGet(STORE_PROFILE_SAFE, "me");
    if (!p) {
      setProfileState(false);
      alertMsg("まだ保存がありません");
      return null;
    }
    setVal("p_name", p.name);
    setVal("p_base", p.base);
    setVal("p_carNo", p.carNo);
    setVal("p_licenseNo", p.licenseNo);
    setVal("p_phone", p.phone);
    setVal("p_email", p.email);
    setProfileState(true);
    return p;
  }

  function setProfileState(saved) {
    const dot = $("dotProfile");
    const st = $("profileState");
    if (dot) {
      dot.className = "dot" + (saved ? " ok" : "");
    }
    if (st) {
      st.textContent = saved ? "保存済み" : "未保存";
    }
  }

  // ------------------------------
  // Tenko（dep/arr）
  // ------------------------------
  async function requireProfile() {
    const p = await dbGet(STORE_PROFILE_SAFE, "me");
    if (!p) {
      alertMsg("先に「基本情報を保存」してください。");
      throw new Error("no profile");
    }
    return p;
  }

  function calcOdoDiff(dep, arr) {
    if (!dep || !arr) return 0;
    const d = safeNum(arr.odoEnd) - safeNum(dep.odoStart);
    return d > 0 ? d : 0;
  }

  async function saveDep() {
    const profile = await requireProfile();

    const ck = readChecklist();

    const obj = {
      id: `tenko|${dateOnly(val("d_at"))}|${normalizePhone(profile.phone)}|dep|${val("d_at") || ""}`,
      type: "dep",
      at: val("d_at"),
      method: val("d_method"),
      sleep: val("d_sleep"),
      temp: val("d_temp"),
      condition: val("d_condition"),
      fatigue: val("d_fatigue"),
      med: val("d_med"),
      medDetail: val("d_medDetail"),
      drink: val("d_drink"),
      alcState: val("d_alcState"),
      alcValue: val("d_alcValue"),
      alcJudge: val("d_alcJudge"),
      projectMain: val("d_projectMain"),
      area: val("d_area"),
      danger: val("d_danger"),
      odoStart: val("d_odoStart"),
      abnormal: val("d_abnormal"),
      abnormalDetail: val("d_abnormalDetail"),
      checklist: ck.list,
      checkMemo: ck.memo,

      // ★検索キー（必須情報）
      name: profile.name,
      base: profile.base,
      phone: profile.phone,

      updatedAt: new Date().toISOString()
    };

    // 必須最低限（あなたの運用に合わせてOK）
    const miss = [];
    if (!obj.at) miss.push("点呼日時（出発）");
    if (!obj.method) miss.push("方法（出発）");
    if (!obj.sleep) miss.push("睡眠（出発）");
    if (!obj.temp) miss.push("体温（出発）");
    if (!obj.condition) miss.push("体調（出発）");
    if (!obj.fatigue) miss.push("疲労（出発）");
    if (!obj.med) miss.push("服薬（出発）");
    if (!obj.drink) miss.push("飲酒（出発）");
    if (!obj.alcState) miss.push("酒気帯び（出発）");
    if (!obj.alcValue) miss.push("アルコール数値（出発）");
    if (!obj.alcJudge) miss.push("判定（出発）");
    if (!obj.projectMain) miss.push("稼働案件（出発）");
    if (!obj.area) miss.push("積込拠点/エリア（出発）");
    if (!obj.danger) miss.push("危険物（出発）");
    if (!obj.odoStart) miss.push("出発ODO（出発）");
    if (!obj.abnormal) miss.push("異常申告（出発）");
    if (obj.abnormal === "あり" && !obj.abnormalDetail) miss.push("異常内容（出発）");

    if (miss.length) {
      alertMsg(`未入力があります：\n${miss.join("\n")}`);
      return;
    }

    await dbPut(STORE_TENKO_SAFE, obj);
    await reloadHistory();
    alertMsg("出発点呼を保存しました");
  }

  async function saveArr() {
    const profile = await requireProfile();

    const ck = readChecklist();

    const obj = {
      id: `tenko|${dateOnly(val("a_at"))}|${normalizePhone(profile.phone)}|arr|${val("a_at") || ""}`,
      type: "arr",
      at: val("a_at"),
      method: val("a_method"),
      breakMin: val("a_breakMin"),
      temp: val("a_temp"),
      condition: val("a_condition"),
      fatigue: val("a_fatigue"),
      med: val("a_med"),
      medDetail: val("a_medDetail"),
      alcState: val("a_alcState"),
      alcValue: val("a_alcValue"),
      alcJudge: val("a_alcJudge"),
      odoEnd: val("a_odoEnd"),
      abnormal: val("a_abnormal"),
      abnormalDetail: val("a_abnormalDetail"),
      checklist: ck.list,
      checkMemo: ck.memo,

      // ★検索キー（必須情報）
      name: profile.name,
      base: profile.base,
      phone: profile.phone,

      updatedAt: new Date().toISOString()
    };

    const miss = [];
    if (!obj.at) miss.push("点呼日時（帰着）");
    if (!obj.method) miss.push("方法（帰着）");
    if (!obj.breakMin) miss.push("休憩（帰着）");
    if (!obj.temp) miss.push("体温（帰着）");
    if (!obj.condition) miss.push("体調（帰着）");
    if (!obj.fatigue) miss.push("疲労（帰着）");
    if (!obj.med) miss.push("服薬（帰着）");
    if (!obj.alcState) miss.push("酒気帯び（帰着）");
    if (!obj.alcValue) miss.push("アルコール数値（帰着）");
    if (!obj.alcJudge) miss.push("判定（帰着）");
    if (!obj.odoEnd) miss.push("帰着ODO（帰着）");
    if (!obj.abnormal) miss.push("異常申告（帰着）");
    if (obj.abnormal === "あり" && !obj.abnormalDetail) miss.push("異常内容（帰着）");

    if (miss.length) {
      alertMsg(`未入力があります：\n${miss.join("\n")}`);
      return;
    }

    await dbPut(STORE_TENKO_SAFE, obj);
    await updateOdoChip();
    await reloadHistory();
    alertMsg("帰着点呼を保存しました");
  }

  function clearDep() {
    [
      "d_at","d_method","d_sleep","d_temp","d_condition","d_fatigue","d_med","d_medDetail",
      "d_drink","d_alcState","d_alcValue","d_alcJudge","d_projectMain","d_area","d_danger",
      "d_odoStart","d_abnormal","d_abnormalDetail"
    ].forEach(id => setVal(id, ""));
  }

  function clearArr() {
    [
      "a_at","a_method","a_breakMin","a_temp","a_condition","a_fatigue","a_med","a_medDetail",
      "a_alcState","a_alcValue","a_alcJudge","a_odoEnd","a_abnormal","a_abnormalDetail"
    ].forEach(id => setVal(id, ""));
  }

  async function updateOdoChip() {
    const chipDot = $("dotOdo");
    const chipText = $("odoState");
    if (!chipText) return;

    const tenko = await dbGetAll(STORE_TENKO_SAFE);
    // 最新日っぽいもの同士でざっくり算出
    const deps = tenko.filter(x => x.type === "dep" && x.at).sort((a,b)=> (b.at||"").localeCompare(a.at||""));
    const arrs = tenko.filter(x => x.type === "arr" && x.at).sort((a,b)=> (b.at||"").localeCompare(a.at||""));

    const dep = deps[0] || null;
    const arr = arrs[0] || null;

    const diff = calcOdoDiff(dep, arr);
    chipText.textContent = diff ? `走行距離：${diff} km` : "走行距離：未計算";
    if (chipDot) chipDot.className = "dot" + (diff ? " ok" : "");
  }

  // ------------------------------
  // Daily（任意）
  // ------------------------------
  function buildDaily(profile) {
    const date = val("r_date") || dateOnly(new Date().toISOString());
    const payBase = safeNum(val("r_payBase"));
    const incentive = safeNum(val("r_incentive"));
    const salesTotal = payBase + incentive;

    const costFuel = safeNum(val("r_fuel"));
    const costHigh = safeNum(val("r_highway"));
    const costPark = safeNum(val("r_parking"));
    const costOther = safeNum(val("r_otherCost"));
    const costs = costFuel + costHigh + costPark + costOther;

    const profit = salesTotal - costs;

    return {
      id: `daily|${date}|${normalizePhone(profile.phone)}`,
      date,
      start: val("r_start"),
      end: val("r_end"),
      breakMin: val("r_break"),
      count: val("r_count"),
      absent: val("r_absent"),
      redel: val("r_redel"),
      returnCount: val("r_return"),
      claim: val("r_claim"),
      claimDetail: val("r_claimDetail"),
      payBase,
      incentive,
      salesTotal,
      fuel: costFuel,
      highway: costHigh,
      parking: costPark,
      otherCost: costOther,
      costs,
      profit,
      memo: val("r_memo"),

      // ★検索キー（必須情報）
      name: profile.name,
      base: profile.base,
      phone: profile.phone,

      updatedAt: new Date().toISOString()
    };
  }

  // ------------------------------
  // PDF（今日 / 過去日）
  // ------------------------------
  async function makePdfForDate(targetDate, profile) {
    // その日の dep/arr/daily を集める（電話番号で絞る）
    const phoneN = normalizePhone(profile.phone);
    const tenkoAll = await dbGetAll(STORE_TENKO_SAFE);
    const dailyAll = await dbGetAll(STORE_DAILY_SAFE);

    const tenko = tenkoAll.filter(x =>
      dateOnly(x.at) === targetDate && normalizePhone(x.phone) === phoneN
    );

    const dep = tenko.filter(x => x.type === "dep").sort((a,b)=> (a.at||"").localeCompare(b.at||""))[0] || null;
    const arr = tenko.filter(x => x.type === "arr").sort((a,b)=> (a.at||"").localeCompare(b.at||""))[0] || null;

    const daily = dailyAll.find(x =>
      (x.date === targetDate) && normalizePhone(x.phone) === phoneN
    ) || null;

    const odoDiff = calcOdoDiff(dep, arr);

    if (typeof window.generateTodayPdf !== "function") {
      alertMsg("PDF機能が読み込めていません（pdf.js）");
      return;
    }

    // 過去日のため、ファイルは保存していない → 空で渡す（画像なしPDF）
    const files = {
      licenseImg: null,
      alcDepImg: null,
      alcArrImg: null,
    };

    await window.generateTodayPdf({
      profile,
      dep,
      arr,
      daily,
      odoDiff,
      files
    });
  }

  async function makeTodayPdf() {
    const profile = await requireProfile();

    // 今日扱いの日付は「日報日付があればそれ」「なければ出発 or 帰着の日付」
    const dDate = val("r_date");
    let keyDate = dDate || "";

    // 今日の入力から一時オブジェクトを組み立て（DBの有無に依存しない）
    // ただしPDFは “保存済み” のデータを基本に出すほうが安全なので、
    // まずはDBから該当日のデータを拾う。
    if (!keyDate) {
      keyDate = dateOnly(val("d_at")) || dateOnly(val("a_at")) || dateOnly(new Date().toISOString());
    }

    await makePdfForDate(keyDate, profile);
  }

  // ------------------------------
  // 履歴表示（タップでPDF再出力）
  // ------------------------------
  function buildTenkoLine(x) {
    const typeLabel = x.type === "dep" ? "出発" : "帰着";
    const alc = (x.alcValue ?? "");
    const abn = (x.abnormal ?? "");
    const abnText = abn ? (abn === "あり" ? "あり" : "なし") : "";
    return `
      <div class="historyRow" data-kind="tenko" data-id="${x.id}" style="
        border:1px solid #e7edf6;border-radius:16px;padding:12px 12px;
        display:flex;align-items:flex-start;justify-content:space-between;gap:10px;
        margin:10px 0; background:#fff;">
        <div style="flex:1; min-width:0;">
          <div style="font-weight:900; font-size:15px;">点呼：${fmt(x.at)} / ${typeLabel}</div>
          <div style="margin-top:6px; color:#445; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
            ${x.name || ""} / ${x.base || ""} / alc:${alc} / ${abnText}
          </div>
          <div style="margin-top:6px; color:#2f6; font-weight:800; font-size:12px;">
            タップでこの日のPDFを出力
          </div>
        </div>
        <button class="btn secondary" data-del="1" style="padding:8px 10px; border-radius:12px;">削除</button>
      </div>
    `;
  }

  function buildDailyLine(x) {
    return `
      <div class="historyRow" data-kind="daily" data-id="${x.id}" style="
        border:1px solid #e7edf6;border-radius:16px;padding:12px 12px;
        display:flex;align-items:flex-start;justify-content:space-between;gap:10px;
        margin:10px 0; background:#fff;">
        <div style="flex:1; min-width:0;">
          <div style="font-weight:900; font-size:15px;">日報：${x.date}</div>
          <div style="margin-top:6px; color:#445; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
            ${x.name || ""} / ${x.base || ""} / 売上:${x.salesTotal || 0} 利益:${x.profit || 0}
          </div>
          <div style="margin-top:6px; color:#2f6; font-weight:800; font-size:12px;">
            タップでこの日のPDFを出力
          </div>
        </div>
        <button class="btn secondary" data-del="1" style="padding:8px 10px; border-radius:12px;">削除</button>
      </div>
    `;
  }

  async function reloadHistory() {
    const box = $("historyBox");
    if (!box) return;

    const profile = await dbGet(STORE_PROFILE_SAFE, "me");
    const phoneN = profile ? normalizePhone(profile.phone) : "";

    const tenkoAll = await dbGetAll(STORE_TENKO_SAFE);
    const dailyAll = await dbGetAll(STORE_DAILY_SAFE);

    // 自端末＆自分の電話番号で絞る（誤爆防止）
    const tenko = phoneN
      ? tenkoAll.filter(x => normalizePhone(x.phone) === phoneN)
      : tenkoAll;

    const daily = phoneN
      ? dailyAll.filter(x => normalizePhone(x.phone) === phoneN)
      : dailyAll;

    // 新しい順
    tenko.sort((a,b)=> (b.at||"").localeCompare(a.at||""));
    daily.sort((a,b)=> (b.date||"").localeCompare(a.date||""));

    let html = "";

    // 点呼履歴
    html += `<div class="h3" style="font-weight:900;margin:10px 0 6px;">点呼履歴</div>`;
    if (!tenko.length) html += `<div class="small" style="color:#666;">まだありません</div>`;
    else html += tenko.slice(0, 200).map(buildTenkoLine).join("");

    // 日報履歴
    html += `<div class="h3" style="font-weight:900;margin:18px 0 6px;">日報履歴</div>`;
    if (!daily.length) html += `<div class="small" style="color:#666;">まだありません</div>`;
    else html += daily.slice(0, 200).map(buildDailyLine).join("");

    box.innerHTML = html;

    // クリック/タップ処理（イベント委譲）
    box.onclick = async (ev) => {
      const row = ev.target.closest(".historyRow");
      if (!row) return;

      const delBtn = ev.target.closest('button[data-del="1"]');
      const id = row.dataset.id;
      const kind = row.dataset.kind;

      // 削除
      if (delBtn) {
        ev.preventDefault();
        ev.stopPropagation();
        const ok = confirm("この履歴を削除しますか？");
        if (!ok) return;

        if (kind === "tenko") await dbDelete(STORE_TENKO_SAFE, id);
        if (kind === "daily") await dbDelete(STORE_DAILY_SAFE, id);

        await reloadHistory();
        return;
      }

      // タップでPDF再出力
      try {
        const profile = await requireProfile();

        if (kind === "tenko") {
          // tenko の日付でPDF
          const tenkoAll = await dbGetAll(STORE_TENKO_SAFE);
          const t = tenkoAll.find(x => x.id === id);
          if (!t) return;
          const d = dateOnly(t.at);
          if (!d) {
            alertMsg("日付が取得できませんでした");
            return;
          }
          await makePdfForDate(d, profile);
        }

        if (kind === "daily") {
          const dailyAll = await dbGetAll(STORE_DAILY_SAFE);
          const d = dailyAll.find(x => x.id === id);
          if (!d) return;
          await makePdfForDate(d.date, profile);
        }
      } catch (e) {
        console.error(e);
      }
    };
  }

  async function clearAll() {
    const ok = confirm("全履歴を削除します。よろしいですか？");
    if (!ok) return;
    await dbClear(STORE_TENKO_SAFE);
    await dbClear(STORE_DAILY_SAFE);
    await reloadHistory();
    alertMsg("全履歴を削除しました");
  }

  // ------------------------------
  // CSV
  // ------------------------------
  async function exportCsvAll() {
    // 既存csv.jsに関数があればそれを優先
    if (typeof window.exportAllCsv === "function") {
      await window.exportAllCsv();
      return;
    }
    alertMsg("CSV機能が読み込めていません（csv.js）");
  }

  // ------------------------------
  // Projects（任意・簡易：画面だけ追加）
  // ※ DB保存は daily に入れたければ後で拡張OK
  // ------------------------------
  function addProjectRow() {
    const box = $("projectsBox");
    if (!box) return;
    const row = document.createElement("div");
    row.style.border = "1px solid #e7edf6";
    row.style.borderRadius = "14px";
    row.style.padding = "10px";
    row.style.margin = "10px 0";
    row.innerHTML = `
      <div class="row">
        <div style="flex:1">
          <label>案件名</label>
          <input class="p_name" placeholder="例：Amazon / 企業便" />
        </div>
        <div style="flex:1">
          <label>売上（任意）</label>
          <input class="p_sales" inputmode="decimal" placeholder="例：15000" />
        </div>
      </div>
      <button class="btn secondary p_del" style="margin-top:8px">この案件を削除</button>
    `;
    row.querySelector(".p_del").onclick = () => row.remove();
    box.appendChild(row);
  }

  // ------------------------------
  // Init
  // ------------------------------
  function bind() {
    // Chrome(iOS含む)でたまに click が死ぬ時の保険：pointerupも付ける
    const onTap = (el, fn) => {
      if (!el) return;
      el.addEventListener("click", (e) => { e.preventDefault(); fn(); }, { passive: false });
      el.addEventListener("pointerup", (e) => { e.preventDefault(); fn(); }, { passive: false });
    };

    onTap($("btnSaveProfile"), saveProfile);
    onTap($("btnLoadProfile"), loadProfile);

    onTap($("btnSaveDep"), saveDep);
    onTap($("btnClearDep"), () => { clearDep(); alertMsg("出発点呼をクリアしました"); });

    onTap($("btnSaveArr"), saveArr);
    onTap($("btnClearArr"), () => { clearArr(); alertMsg("帰着点呼をクリアしました"); });

    onTap($("btnMakePdf"), makeTodayPdf);
    onTap($("btnMakeCsv"), exportCsvAll);

    onTap($("btnReloadHistory"), reloadHistory);
    onTap($("btnClearAll"), clearAll);

    onTap($("btnAddProject"), addProjectRow);
  }

  async function bootstrap() {
    renderChecklist();
    bind();
    await loadProfile().catch(()=>{});
    await updateOdoChip().catch(()=>{});
    await reloadHistory().catch(()=>{});
  }

  document.addEventListener("DOMContentLoaded", bootstrap);
})();
