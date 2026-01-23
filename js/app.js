/* /js/app.js
   OFA 点呼/日報（ドライバー）
   - ボタン反応の確実化（DOMContentLoaded）
   - 履歴見やすく（点呼/日報をカード化）
   - 個別削除対応
*/

(() => {
  "use strict";

  // ===== DB 定義（db.jsと合わせる） =====
  const OFA_DB_NAME = "ofa_nippou_db";
  const OFA_DB_VER  = 1;

  const STORE_PROFILE = "profile";
  const STORE_TENKO   = "tenko";
  const STORE_DAILY   = "daily";

  // ===== ユーティリティ =====
  const $ = (id) => document.getElementById(id);

  const esc = (s) => String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const pad2 = (n) => String(n).padStart(2, "0");

  function toLocalInputValue(d = new Date()) {
    const yyyy = d.getFullYear();
    const mm = pad2(d.getMonth() + 1);
    const dd = pad2(d.getDate());
    const hh = pad2(d.getHours());
    const mi = pad2(d.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
  }

  function parseDateLike(x) {
    if (!x) return null;
    // datetime-local: "2026-01-24T03:25"
    // date: "2026-01-24"
    // ISO: etc
    const d = new Date(x);
    if (Number.isNaN(d.getTime())) return null;
    return d;
  }

  function fmtYMD(d) {
    if (!(d instanceof Date)) d = parseDateLike(d);
    if (!d) return "";
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }

  function fmtYMDHM(d) {
    if (!(d instanceof Date)) d = parseDateLike(d);
    if (!d) return "";
    return `${fmtYMD(d)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }

  function uid() {
    return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  function numOrNull(v) {
    const n = Number(String(v ?? "").replaceAll(",", "").trim());
    return Number.isFinite(n) ? n : null;
  }

  // ===== IndexedDB（db.jsが無い/違っても動く保険） =====
  function idbOpen() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(OFA_DB_NAME, OFA_DB_VER);
      req.onupgradeneeded = () => {
        const db = req.result;

        if (!db.objectStoreNames.contains(STORE_PROFILE)) {
          db.createObjectStore(STORE_PROFILE, { keyPath: "id" }); // id="me"
        }
        if (!db.objectStoreNames.contains(STORE_TENKO)) {
          const st = db.createObjectStore(STORE_TENKO, { keyPath: "id" });
          st.createIndex("by_at", "at", { unique: false });
          st.createIndex("by_name", "name", { unique: false });
          st.createIndex("by_base", "base", { unique: false });
          st.createIndex("by_type", "type", { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_DAILY)) {
          const sd = db.createObjectStore(STORE_DAILY, { keyPath: "id" });
          sd.createIndex("by_date", "date", { unique: false });
          sd.createIndex("by_name", "name", { unique: false });
          sd.createIndex("by_base", "base", { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function idbPut(store, value) {
    const db = await idbOpen();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, "readwrite");
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
      tx.objectStore(store).put(value);
    });
  }

  async function idbGet(store, key) {
    const db = await idbOpen();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, "readonly");
      const req = tx.objectStore(store).get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  }

  async function idbGetAll(store) {
    const db = await idbOpen();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, "readonly");
      const req = tx.objectStore(store).getAll();
      req.onsuccess = () => resolve(req.result ?? []);
      req.onerror = () => reject(req.error);
    });
  }

  async function idbDelete(store, key) {
    const db = await idbOpen();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, "readwrite");
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
      tx.objectStore(store).delete(key);
    });
  }

  async function idbClear(store) {
    const db = await idbOpen();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, "readwrite");
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
      tx.objectStore(store).clear();
    });
  }

  // ===== db.jsが提供している関数を優先して使う（存在すれば） =====
  const DB = {
    saveProfile: async (obj) => {
      // db.js側に関数があればそっち
      if (typeof window.saveProfile === "function") return window.saveProfile(obj);
      if (typeof window.dbSaveProfile === "function") return window.dbSaveProfile(obj);
      // 保険（直叩き）
      return idbPut(STORE_PROFILE, obj);
    },
    loadProfile: async () => {
      if (typeof window.loadProfile === "function") return window.loadProfile();
      if (typeof window.dbLoadProfile === "function") return window.dbLoadProfile();
      return idbGet(STORE_PROFILE, "me");
    },

    addTenko: async (obj) => {
      if (typeof window.addTenko === "function") return window.addTenko(obj);
      if (typeof window.dbAddTenko === "function") return window.dbAddTenko(obj);
      return idbPut(STORE_TENKO, obj);
    },
    addDaily: async (obj) => {
      if (typeof window.addDaily === "function") return window.addDaily(obj);
      if (typeof window.dbAddDaily === "function") return window.dbAddDaily(obj);
      return idbPut(STORE_DAILY, obj);
    },

    getTenkoAll: async () => {
      if (typeof window.getTenkoAll === "function") return window.getTenkoAll();
      if (typeof window.dbGetTenkoAll === "function") return window.dbGetTenkoAll();
      return idbGetAll(STORE_TENKO);
    },
    getDailyAll: async () => {
      if (typeof window.getDailyAll === "function") return window.getDailyAll();
      if (typeof window.dbGetDailyAll === "function") return window.dbGetDailyAll();
      return idbGetAll(STORE_DAILY);
    },

    deleteTenko: async (id) => {
      if (typeof window.deleteTenko === "function") return window.deleteTenko(id);
      if (typeof window.dbDeleteTenko === "function") return window.dbDeleteTenko(id);
      return idbDelete(STORE_TENKO, id);
    },
    deleteDaily: async (id) => {
      if (typeof window.deleteDaily === "function") return window.deleteDaily(id);
      if (typeof window.dbDeleteDaily === "function") return window.dbDeleteDaily(id);
      return idbDelete(STORE_DAILY, id);
    },

    clearAll: async () => {
      if (typeof window.clearAll === "function") return window.clearAll();
      if (typeof window.dbClearAll === "function") return window.dbClearAll();
      await idbClear(STORE_TENKO);
      await idbClear(STORE_DAILY);
      // profileは残す運用が多いので消さない（必要なら追加で消してOK）
      return true;
    },
  };

  // ===== UI（状態チップ） =====
  function setDot(id, ok) {
    const el = $(id);
    if (!el) return;
    el.classList.toggle("ok", !!ok);
    el.classList.toggle("ng", !ok);
  }

  function setText(id, text) {
    const el = $(id);
    if (el) el.textContent = text;
  }

  // ===== 基本情報 =====
  function readProfileForm() {
    return {
      id: "me",
      name: ($("p_name")?.value ?? "").trim(),
      base: ($("p_base")?.value ?? "").trim(),
      carNo: ($("p_carNo")?.value ?? "").trim(),
      licenseNo: ($("p_licenseNo")?.value ?? "").trim(),
      phone: ($("p_phone")?.value ?? "").trim(),
      email: ($("p_email")?.value ?? "").trim(),
      updatedAt: Date.now(),
    };
  }

  function fillProfileForm(p) {
    if (!p) return;
    if ($("p_name")) $("p_name").value = p.name ?? "";
    if ($("p_base")) $("p_base").value = p.base ?? "";
    if ($("p_carNo")) $("p_carNo").value = p.carNo ?? "";
    if ($("p_licenseNo")) $("p_licenseNo").value = p.licenseNo ?? "";
    if ($("p_phone")) $("p_phone").value = p.phone ?? "";
    if ($("p_email")) $("p_email").value = p.email ?? "";
  }

  function validateProfile(p) {
    const miss = [];
    if (!p.name) miss.push("氏名");
    if (!p.base) miss.push("拠点");
    if (!p.carNo) miss.push("車両番号");
    if (!p.licenseNo) miss.push("免許証番号");
    if (!p.phone) miss.push("電話番号");
    if (!p.email) miss.push("メールアドレス");
    return miss;
  }

  async function onSaveProfile() {
    try {
      const p = readProfileForm();
      const miss = validateProfile(p);
      if (miss.length) {
        alert(`未入力があります：${miss.join(" / ")}`);
        return;
      }
      await DB.saveProfile(p);
      setDot("dotProfile", true);
      setText("profileState", "保存済み");
      alert("基本情報を保存しました");
      await reloadHistory(); // ついでに更新
    } catch (e) {
      console.error(e);
      alert("保存に失敗しました。ブラウザの設定（プライベート/制限）を確認してください。");
    }
  }

  async function onLoadProfile() {
    try {
      const p = await DB.loadProfile();
      if (!p) {
        setDot("dotProfile", false);
        setText("profileState", "未保存");
        alert("まだ保存がありません");
        return;
      }
      fillProfileForm(p);
      setDot("dotProfile", true);
      setText("profileState", "保存済み");
      alert("基本情報を読み込みました");
    } catch (e) {
      console.error(e);
      alert("読み込みに失敗しました");
    }
  }

  // ===== 点呼（出発/帰着） =====
  function readDep() {
    const at = $("d_at")?.value;
    return {
      id: uid(),
      type: "dep",
      at: at || toLocalInputValue(new Date()),
      name: ($("p_name")?.value ?? "").trim(),
      base: ($("p_base")?.value ?? "").trim(),
      sleep: numOrNull($("d_sleep")?.value),
      temp: numOrNull($("d_temp")?.value),
      method: ($("d_method")?.value ?? "").trim(),
      condition: ($("d_condition")?.value ?? "").trim(),
      fatigue: ($("d_fatigue")?.value ?? "").trim(),
      med: ($("d_med")?.value ?? "").trim(),
      medDetail: ($("d_medDetail")?.value ?? "").trim(),
      drink: ($("d_drink")?.value ?? "").trim(),
      alcState: ($("d_alcState")?.value ?? "").trim(),
      alcValue: numOrNull($("d_alcValue")?.value) ?? 0,
      alcJudge: ($("d_alcJudge")?.value ?? "").trim(),
      projectMain: ($("d_projectMain")?.value ?? "").trim(),
      area: ($("d_area")?.value ?? "").trim(),
      danger: ($("d_danger")?.value ?? "").trim(),
      odoStart: numOrNull($("d_odoStart")?.value),
      abnormal: ($("d_abnormal")?.value ?? "").trim(),
      abnormalDetail: ($("d_abnormalDetail")?.value ?? "").trim(),
      createdAt: Date.now(),
    };
  }

  function readArr() {
    const at = $("a_at")?.value;
    return {
      id: uid(),
      type: "arr",
      at: at || toLocalInputValue(new Date()),
      name: ($("p_name")?.value ?? "").trim(),
      base: ($("p_base")?.value ?? "").trim(),
      breakMin: numOrNull($("a_breakMin")?.value),
      temp: numOrNull($("a_temp")?.value),
      method: ($("a_method")?.value ?? "").trim(),
      condition: ($("a_condition")?.value ?? "").trim(),
      fatigue: ($("a_fatigue")?.value ?? "").trim(),
      med: ($("a_med")?.value ?? "").trim(),
      medDetail: ($("a_medDetail")?.value ?? "").trim(),
      alcState: ($("a_alcState")?.value ?? "").trim(),
      alcValue: numOrNull($("a_alcValue")?.value) ?? 0,
      alcJudge: ($("a_alcJudge")?.value ?? "").trim(),
      odoEnd: numOrNull($("a_odoEnd")?.value),
      abnormal: ($("a_abnormal")?.value ?? "").trim(),
      abnormalDetail: ($("a_abnormalDetail")?.value ?? "").trim(),
      createdAt: Date.now(),
    };
  }

  function validateTenkoCommon(t) {
    const miss = [];
    if (!t.name) miss.push("氏名（基本情報）");
    if (!t.base) miss.push("拠点（基本情報）");
    if (!t.at) miss.push("点呼日時");
    if (!t.method) miss.push("点呼実施方法");
    if (!t.condition) miss.push("体調");
    if (!t.fatigue) miss.push("疲労");
    if (!t.med) miss.push("服薬");
    if (!t.alcState) miss.push("酒気帯び");
    if (!t.alcJudge) miss.push("判定");
    if (t.abnormal === "あり" && !t.abnormalDetail) miss.push("異常内容");
    return miss;
  }

  async function onSaveDep() {
    try {
      const t = readDep();
      const miss = validateTenkoCommon(t);
      if (!t.sleep && t.sleep !== 0) miss.push("睡眠時間");
      if (!t.temp && t.temp !== 0) miss.push("体温");
      if (!t.projectMain) miss.push("稼働案件（メイン）");
      if (!t.area) miss.push("積込拠点/エリア");
      if (!t.danger) miss.push("危険物・高額品");
      if (!t.odoStart && t.odoStart !== 0) miss.push("出発ODO");

      if (miss.length) {
        alert(`未入力があります：\n${miss.join("\n")}`);
        return;
      }

      await DB.addTenko(t);
      alert("出発点呼を保存しました");
      await reloadHistory();
    } catch (e) {
      console.error(e);
      alert("保存に失敗しました");
    }
  }

  async function onSaveArr() {
    try {
      const t = readArr();
      const miss = validateTenkoCommon(t);
      if (!t.breakMin && t.breakMin !== 0) miss.push("休憩時間");
      if (!t.temp && t.temp !== 0) miss.push("体温");
      if (!t.odoEnd && t.odoEnd !== 0) miss.push("帰着ODO");

      if (miss.length) {
        alert(`未入力があります：\n${miss.join("\n")}`);
        return;
      }

      await DB.addTenko(t);
      alert("帰着点呼を保存しました");
      await reloadHistory();
      await updateOdoState();
    } catch (e) {
      console.error(e);
      alert("保存に失敗しました");
    }
  }

  function clearDep() {
    ["d_at","d_method","d_sleep","d_temp","d_condition","d_fatigue","d_med","d_medDetail","d_drink","d_alcState","d_alcValue","d_alcJudge","d_projectMain","d_area","d_danger","d_odoStart","d_abnormal","d_abnormalDetail"]
      .forEach(id => { if ($(id)) $(id).value = ""; });
    alert("出発点呼をクリアしました");
  }

  function clearArr() {
    ["a_at","a_method","a_breakMin","a_temp","a_condition","a_fatigue","a_med","a_medDetail","a_alcState","a_alcValue","a_alcJudge","a_odoEnd","a_abnormal","a_abnormalDetail"]
      .forEach(id => { if ($(id)) $(id).value = ""; });
    alert("帰着点呼をクリアしました");
  }

  // ===== 日報（今回は“履歴表示・削除”が主。登録は既存運用があればそれを尊重） =====
  // ※あなたの既存日報保存ロジックが別にある場合でも、
  //   ここは壊さず、履歴読み出し/削除だけ確実に動かす。

  // ===== 履歴：見やすく＋個別削除 =====
  function buildHistoryHtml(tenko, daily) {
    const tenkoSorted = [...tenko].sort((a,b) => (parseDateLike(b.at)?.getTime() ?? 0) - (parseDateLike(a.at)?.getTime() ?? 0));
    const dailySorted = [...daily].sort((a,b) => (parseDateLike(b.date)?.getTime() ?? 0) - (parseDateLike(a.date)?.getTime() ?? 0));

    const tenkoItems = tenkoSorted.map(t => {
      const when = fmtYMDHM(t.at);
      const typeLabel = t.type === "arr" ? "帰着" : "出発";
      const alc = (t.alcValue ?? 0);
      const abn = (t.abnormal ?? "");
      return `
        <div class="histCard">
          <div class="histTop">
            <div class="histTitle">点呼：${esc(when)} / ${esc(typeLabel)}</div>
            <button class="histDel" data-kind="tenko" data-id="${esc(t.id)}">削除</button>
          </div>
          <div class="histMeta">${esc(t.name)} / ${esc(t.base)} / alc:${esc(alc)} / ${esc(abn || "なし")}</div>
        </div>
      `;
    }).join("");

    const dailyItems = dailySorted.map(d => {
      const day = fmtYMD(d.date);
      const sales = d.sales ?? d.uriage ?? d.total ?? "";
      const profit = d.profit ?? d.rieki ?? "";
      const km = d.km ?? d.distance ?? "";
      return `
        <div class="histCard">
          <div class="histTop">
            <div class="histTitle">日報：${esc(day)}</div>
            <button class="histDel" data-kind="daily" data-id="${esc(d.id)}">削除</button>
          </div>
          <div class="histMeta">${esc(d.name)} / ${esc(d.base)}</div>
          <div class="histMeta small">売上:${esc(sales)} 利益:${esc(profit)} 走行:${esc(km)}</div>
        </div>
      `;
    }).join("");

    const emptyTenko = tenkoItems ? "" : `<div class="small">点呼履歴：まだありません</div>`;
    const emptyDaily = dailyItems ? "" : `<div class="small">日報履歴：まだありません</div>`;

    return `
      <div class="histSection">
        <div class="histSectionTitle">点呼履歴</div>
        ${emptyTenko}
        ${tenkoItems}
      </div>

      <div class="divider"></div>

      <div class="histSection">
        <div class="histSectionTitle">日報履歴</div>
        ${emptyDaily}
        ${dailyItems}
      </div>

      <style>
        .histSectionTitle{font-weight:900;margin:6px 0 10px 0}
        .histCard{border:1px solid rgba(0,0,0,.08); border-radius:14px; padding:10px; margin:8px 0; background:#fff}
        .histTop{display:flex; align-items:center; justify-content:space-between; gap:10px}
        .histTitle{font-weight:800; font-size:14px}
        .histMeta{font-size:13px; opacity:.85; margin-top:4px; line-height:1.4}
        .histMeta.small{font-size:12px; opacity:.7}
        .histDel{border:none; padding:8px 10px; border-radius:12px; background:rgba(0,0,0,.08); font-weight:800}
      </style>
    `;
  }

  async function reloadHistory() {
    const box = $("historyBox");
    if (!box) return;

    try {
      const [tenko, daily] = await Promise.all([DB.getTenkoAll(), DB.getDailyAll()]);
      box.innerHTML = buildHistoryHtml(tenko, daily);

      // 個別削除（イベント委譲）
      box.onclick = async (ev) => {
        const btn = ev.target?.closest?.(".histDel");
        if (!btn) return;
        const kind = btn.getAttribute("data-kind");
        const id = btn.getAttribute("data-id");
        if (!id) return;

        if (!confirm("この1件を削除しますか？")) return;

        try {
          if (kind === "tenko") await DB.deleteTenko(id);
          if (kind === "daily") await DB.deleteDaily(id);
          await reloadHistory();
        } catch (e) {
          console.error(e);
          alert("削除に失敗しました");
        }
      };

      await updateOdoState(tenko);
    } catch (e) {
      console.error(e);
      box.innerHTML = `<div class="small">履歴の読み込みに失敗しました（IndexedDB権限/制限を確認）</div>`;
    }
  }

  async function updateOdoState(tenkoOpt) {
    try {
      const tenko = tenkoOpt ?? await DB.getTenkoAll();
      // 最新の出発ODOと帰着ODOを見て距離を表示（同日/同人の厳密突合は管理側で）
      const dep = [...tenko].filter(x => x.type === "dep" && x.odoStart != null)
        .sort((a,b) => (parseDateLike(b.at)?.getTime() ?? 0) - (parseDateLike(a.at)?.getTime() ?? 0))[0];
      const arr = [...tenko].filter(x => x.type === "arr" && x.odoEnd != null)
        .sort((a,b) => (parseDateLike(b.at)?.getTime() ?? 0) - (parseDateLike(a.at)?.getTime() ?? 0))[0];

      if (!dep || !arr) {
        setDot("dotOdo", false);
        setText("odoState", "走行距離：未計算");
        return;
      }

      const dist = (arr.odoEnd ?? 0) - (dep.odoStart ?? 0);
      setDot("dotOdo", Number.isFinite(dist) && dist >= 0);
      setText("odoState", `走行距離：${Number.isFinite(dist) ? dist : "-"} km（直近）`);
    } catch {
      // ignore
    }
  }

  async function onClearAll() {
    if (!confirm("点呼/日報の履歴を全削除します。よろしいですか？")) return;
    try {
      await DB.clearAll();
      alert("全削除しました");
      await reloadHistory();
    } catch (e) {
      console.error(e);
      alert("全削除に失敗しました");
    }
  }

  // ===== 初期化 =====
  function bindOnce(id, fn) {
    const el = $(id);
    if (!el) return;
    el.addEventListener("click", (e) => {
      e.preventDefault();
      fn();
    }, { passive: false });
  }

  document.addEventListener("DOMContentLoaded", async () => {
    // ボタン

    bindOnce("btnSaveProfile", onSaveProfile);
    bindOnce("btnLoadProfile", onLoadProfile);

    bindOnce("btnSaveDep", onSaveDep);
    bindOnce("btnClearDep", clearDep);

    bindOnce("btnSaveArr", onSaveArr);
    bindOnce("btnClearArr", clearArr);

    bindOnce("btnReloadHistory", reloadHistory);
    bindOnce("btnClearAll", onClearAll);

    // 初期状態
    if ($("d_at") && !$("d_at").value) $("d_at").value = toLocalInputValue(new Date());
    if ($("a_at") && !$("a_at").value) $("a_at").value = toLocalInputValue(new Date());

    // プロファイル状態だけ反映
    try {
      const p = await DB.loadProfile();
      if (p) {
        setDot("dotProfile", true);
        setText("profileState", "保存済み");
      } else {
        setDot("dotProfile", false);
        setText("profileState", "未保存");
      }
    } catch {}

    await reloadHistory();
  });

})();
