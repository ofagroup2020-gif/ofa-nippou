// js/app.js
// OFA 点呼/日報（ドライバー）
// - 基本情報は必須 → tenko/daily に name/base/phone を必ず保存（管理側検索用）
// - 履歴を見やすく：カード化＋個別削除
// - 履歴をタップ：その日の「点呼＋日報」PDFを再出力（画像は過去分は保持しない仕様）
//
// 依存:
//   window.OFADB (db.js)
//   window.generateTodayPdf (pdf.js)

(() => {
  "use strict";

  const $ = (id)=> document.getElementById(id);

  // iOS/Chrome対策：clickとpointerup両方を拾う
  function bindTap(el, fn){
    if(!el) return;
    const handler = (e)=>{
      try{ e.preventDefault(); }catch{}
      try{ e.stopPropagation(); }catch{}
      fn();
    };
    el.addEventListener("click", handler, {passive:false});
    el.addEventListener("pointerup", handler, {passive:false});
  }

  function nowLocalInputValue(){
    const d = new Date();
    const pad = (n)=> String(n).padStart(2,"0");
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth()+1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const mi = pad(d.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
  }

  function ymdFromAny(v){
    if(!v) return "";
    return String(v).slice(0,10);
  }

  function num(v){
    const x = Number(v);
    return Number.isFinite(x) ? x : 0;
  }

  function normalizePhone(s){
    return String(s || "").replace(/[^\d]/g, "");
  }

  function setChip(dotId, textId, ok, text){
    const dot = $(dotId);
    const el = $(textId);
    if(dot){
      dot.classList.remove("ok");
      if(ok) dot.classList.add("ok");
    }
    if(el) el.textContent = text;
  }

  // ------------------------------
  // チェックリスト（必要なら増やしてOK）
  // ------------------------------
  const CHECK_ITEMS = [
    "タイヤ空気圧/亀裂",
    "ブレーキ",
    "ライト（前後/ウインカー）",
    "ワイパー/ウォッシャー",
    "ミラー",
    "積載状態/荷崩れ防止",
    "ドア/スライド/ロック",
    "オイル/冷却水漏れ",
    "車内清掃/視界確保",
  ];

  function renderChecklist(){
    const box = $("checkScroll");
    if(!box) return;

    const html = CHECK_ITEMS.map((label, idx)=>{
      const name = `check_${idx}`;
      return `
        <div class="checkRow" style="display:flex;align-items:center;border-top:1px solid #edf1f7">
          <div class="checkCol item" style="flex:1;padding:10px 6px">${label}</div>
          <div class="checkCol ok" style="width:64px;text-align:center;padding:10px 6px">
            <input type="radio" name="${name}" value="ok">
          </div>
          <div class="checkCol ng" style="width:64px;text-align:center;padding:10px 6px">
            <input type="radio" name="${name}" value="ng">
          </div>
        </div>
      `;
    }).join("");

    box.innerHTML = html;
  }

  function readChecklist(){
    return CHECK_ITEMS.map((label, idx)=>{
      const name = `check_${idx}`;
      const checked = document.querySelector(`input[name="${name}"]:checked`);
      return { label, ok: checked ? (checked.value === "ok") : true }; // 未選択はOK扱い（運用上ラク）
    });
  }

  // ------------------------------
  // 画面入力 → オブジェクト
  // ------------------------------
  function getProfileInputs(){
    return {
      name: $("p_name")?.value.trim(),
      base: $("p_base")?.value.trim(),
      carNo: $("p_carNo")?.value.trim(),
      licenseNo: $("p_licenseNo")?.value.trim(),
      phone: $("p_phone")?.value.trim(),
      phoneNorm: normalizePhone($("p_phone")?.value.trim()),
      email: $("p_email")?.value.trim(),
    };
  }

  function validateProfile(p){
    const missing = [];
    if(!p.name) missing.push("氏名");
    if(!p.base) missing.push("拠点");
    if(!p.carNo) missing.push("車両番号");
    if(!p.licenseNo) missing.push("免許証番号");
    if(!p.phone) missing.push("電話番号");
    if(!p.email) missing.push("メール");
    if(missing.length){
      alert("基本情報の必須が未入力です：\n" + missing.join(" / "));
      return false;
    }
    return true;
  }

  function getDepInputs(profile){
    return {
      type: "dep",
      // 検索用キー（必ず保存）
      name: profile.name,
      base: profile.base,
      phone: profile.phone,
      phoneNorm: profile.phoneNorm,

      // 本体
      at: $("d_at")?.value,
      method: $("d_method")?.value,
      sleep: $("d_sleep")?.value.trim(),
      temp: $("d_temp")?.value.trim(),
      condition: $("d_condition")?.value,
      fatigue: $("d_fatigue")?.value,
      med: $("d_med")?.value,
      medDetail: $("d_medDetail")?.value.trim(),
      drink: $("d_drink")?.value,
      alcState: $("d_alcState")?.value,
      alcValue: $("d_alcValue")?.value.trim(),
      alcJudge: $("d_alcJudge")?.value,
      projectMain: $("d_projectMain")?.value.trim(),
      area: $("d_area")?.value.trim(),
      danger: $("d_danger")?.value,
      odoStart: $("d_odoStart")?.value.trim(),
      abnormal: $("d_abnormal")?.value,
      abnormalDetail: $("d_abnormalDetail")?.value.trim(),
      checklist: readChecklist(),
      checkMemo: $("checkMemo")?.value.trim(),
    };
  }

  function getArrInputs(profile){
    return {
      type: "arr",
      // 検索用キー（必ず保存）
      name: profile.name,
      base: profile.base,
      phone: profile.phone,
      phoneNorm: profile.phoneNorm,

      // 本体
      at: $("a_at")?.value,
      method: $("a_method")?.value,
      breakMin: $("a_breakMin")?.value.trim(),
      temp: $("a_temp")?.value.trim(),
      condition: $("a_condition")?.value,
      fatigue: $("a_fatigue")?.value,
      med: $("a_med")?.value,
      medDetail: $("a_medDetail")?.value.trim(),
      alcState: $("a_alcState")?.value,
      alcValue: $("a_alcValue")?.value.trim(),
      alcJudge: $("a_alcJudge")?.value,
      odoEnd: $("a_odoEnd")?.value.trim(),
      abnormal: $("a_abnormal")?.value,
      abnormalDetail: $("a_abnormalDetail")?.value.trim(),
      checklist: readChecklist(),
      checkMemo: $("checkMemo")?.value.trim(),
    };
  }

  function validateTenkoCommon(t, isDep){
    const missing = [];
    if(!t.at) missing.push("点呼日時");
    if(!t.method) missing.push("点呼実施方法");
    if(!t.temp) missing.push("体温");
    if(!t.condition) missing.push("体調");
    if(!t.fatigue) missing.push("疲労");
    if(!t.med) missing.push("服薬・体調影響");
    if(!t.alcState) missing.push("酒気帯び有無");
    if(!t.alcValue) missing.push("アルコール数値");
    if(!t.alcJudge) missing.push("判定");
    if(!t.abnormal) missing.push("異常申告");

    if(isDep){
      if(!t.sleep) missing.push("睡眠時間");
      if(!t.projectMain) missing.push("稼働案件（メイン）");
      if(!t.area) missing.push("積込拠点/エリア");
      if(!t.danger) missing.push("危険物・高額品");
      if(!t.odoStart) missing.push("出発ODO");
    }else{
      if(!t.breakMin) missing.push("休憩時間");
      if(!t.odoEnd) missing.push("帰着ODO");
    }

    if(t.abnormal === "あり" && !t.abnormalDetail){
      missing.push("異常内容（異常ありの場合）");
    }

    if(missing.length){
      alert("必須が未入力です：\n" + missing.join(" / "));
      return false;
    }
    return true;
  }

  function getDailyInputs(profile){
    // 日報は任意：dateが空なら保存しない運用
    const date = $("r_date")?.value;
    const payBase = $("r_payBase")?.value.trim();
    const incentive = $("r_incentive")?.value.trim();

    const fuel = $("r_fuel")?.value.trim();
    const highway = $("r_highway")?.value.trim();
    const parking = $("r_parking")?.value.trim();
    const otherCost = $("r_otherCost")?.value.trim();

    const salesTotal = num(payBase) + num(incentive);
    const cost = num(fuel) + num(highway) + num(parking) + num(otherCost);
    const profit = salesTotal - cost;

    return {
      // 検索用キー（必ず保存）
      name: profile.name,
      base: profile.base,
      phone: profile.phone,
      phoneNorm: profile.phoneNorm,

      // 本体
      date: date || "",
      start: $("r_start")?.value || "",
      end: $("r_end")?.value || "",
      breakMin: $("r_break")?.value.trim(),
      count: $("r_count")?.value.trim(),
      absent: $("r_absent")?.value.trim(),
      redel: $("r_redel")?.value.trim(),
      returned: $("r_return")?.value.trim(),
      claim: $("r_claim")?.value || "",
      claimDetail: $("r_claimDetail")?.value.trim(),
      payBase: payBase,
      incentive: incentive,
      fuel: fuel,
      highway: highway,
      parking: parking,
      otherCost: otherCost,
      salesTotal,
      profit,
      memo: $("r_memo")?.value.trim(),
      mainProject: $("d_projectMain")?.value.trim() || "",
    };
  }

  // ------------------------------
  // PDF（任意の日付を出す）
  // 画像は「その時点の入力ファイル」しか使えないため、過去履歴PDFは画像なしで出す
  // ------------------------------
  async function makePdfForDayFromDb({ymd, name, phoneNorm, base}){
    const tenkoAll = await window.OFADB.allTenko();
    const dailyAll = await window.OFADB.allDaily();

    const matchPerson = (x)=>{
      const pn = normalizePhone(x.phoneNorm || x.phone);
      return (x.name === name) && (pn === phoneNorm) && (x.base === base);
    };

    const dep = tenkoAll
      .filter(t=> t.type==="dep" && ymdFromAny(t.at)===ymd && matchPerson(t))
      .sort((a,b)=> new Date(a.at).getTime() - new Date(b.at).getTime())
      .pop() || null;

    const arr = tenkoAll
      .filter(t=> t.type==="arr" && ymdFromAny(t.at)===ymd && matchPerson(t))
      .sort((a,b)=> new Date(a.at).getTime() - new Date(b.at).getTime())
      .pop() || null;

    const daily = dailyAll
      .filter(d=> (d.date===ymd) && matchPerson(d))
      .sort((a,b)=> new Date(a.createdAt||0).getTime() - new Date(b.createdAt||0).getTime())
      .pop() || null;

    // 走行距離
    let odoDiff = 0;
    if(dep?.odoStart && arr?.odoEnd){
      odoDiff = Math.max(0, num(arr.odoEnd) - num(dep.odoStart));
    }

    const profile = {
      name, base,
      carNo: "", licenseNo: "",
      phone: "", email: "",
    };

    // profileは端末の保存を優先（車両/免許/メールも反映）
    const saved = await window.OFADB.loadProfile();
    if(saved && saved.name === name && normalizePhone(saved.phoneNorm || saved.phone) === phoneNorm){
      profile.carNo = saved.carNo || "";
      profile.licenseNo = saved.licenseNo || "";
      profile.phone = saved.phone || "";
      profile.email = saved.email || "";
    }else{
      // tenkoの中に保存されてれば拾う（今後は入れていく）
      const sample = dep || arr || daily;
      if(sample){
        profile.phone = sample.phone || "";
      }
    }

    if(typeof window.generateTodayPdf !== "function"){
      alert("PDF生成関数が見つかりません（pdf.js読み込み確認）");
      return;
    }

    // 過去履歴PDFは画像なし（files空）
    await window.generateTodayPdf({
      profile,
      dep,
      arr,
      daily,
      odoDiff,
      files: {
        licenseImg: null,
        alcDepImg: null,
        alcArrImg: null,
      }
    });
  }

  // ------------------------------
  // 履歴UI
  // ------------------------------
  function tenkoCard(t){
    const dt = String(t.at||"").replace("T"," ").slice(0,16);
    const type = (t.type==="arr") ? "帰着" : "出発";
    const base = t.base || "";
    const name = t.name || "";
    const alc = (t.alcValue ?? 0);

    return `
      <div class="historyItem"
           data-kind="tenko"
           data-id="${t.id}"
           data-ymd="${ymdFromAny(t.at)}"
           data-name="${encodeURIComponent(name)}"
           data-base="${encodeURIComponent(base)}"
           data-phone="${encodeURIComponent(normalizePhone(t.phoneNorm || t.phone))}"
           style="display:flex;gap:10px;align-items:flex-start;justify-content:space-between;border:1px solid #e5eaf2;border-radius:16px;padding:12px;margin:10px 0;background:#fff;">
        <div style="flex:1;min-width:0">
          <div style="font-weight:900">点呼：${dt} / ${type}</div>
          <div style="opacity:.85;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
            ${name} / ${base} / alc:${alc} / ${(t.abnormal||"なし")}
          </div>
          <div style="opacity:.55;font-size:12px;margin-top:4px">
            ※タップでこの日のPDFを再出力（画像は過去分は無し）
          </div>
        </div>
        <button class="btn secondary btnDelOne" data-kind="tenko" data-id="${t.id}" style="width:auto;padding:8px 12px">削除</button>
      </div>
    `;
  }

  function dailyCard(d){
    const ymd = d.date || ymdFromAny(d.createdAt);
    const base = d.base || "";
    const name = d.name || "";
    const sales = d.salesTotal ?? 0;
    const profit = d.profit ?? 0;
    const km = d.km ?? d.distance ?? d.runKm ?? "";

    return `
      <div class="historyItem"
           data-kind="daily"
           data-id="${d.id}"
           data-ymd="${ymd}"
           data-name="${encodeURIComponent(name)}"
           data-base="${encodeURIComponent(base)}"
           data-phone="${encodeURIComponent(normalizePhone(d.phoneNorm || d.phone))}"
           style="display:flex;gap:10px;align-items:flex-start;justify-content:space-between;border:1px solid #e5eaf2;border-radius:16px;padding:12px;margin:10px 0;background:#fff;">
        <div style="flex:1;min-width:0">
          <div style="font-weight:900">日報：${ymd}</div>
          <div style="opacity:.85;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
            ${name} / ${base} / 売上:${sales} 利益:${profit} ${(km?`走行:${km}km`:"")}
          </div>
          <div style="opacity:.55;font-size:12px;margin-top:4px">
            ※タップでこの日のPDFを再出力（画像は過去分は無し）
          </div>
        </div>
        <button class="btn secondary btnDelOne" data-kind="daily" data-id="${d.id}" style="width:auto;padding:8px 12px">削除</button>
      </div>
    `;
  }

  async function renderHistory(){
    const box = $("historyBox");
    if(!box) return;

    const tenko = (await window.OFADB.allTenko())
      .slice()
      .sort((a,b)=> new Date(b.at||0).getTime() - new Date(a.at||0).getTime());

    const daily = (await window.OFADB.allDaily())
      .slice()
      .sort((a,b)=> new Date((b.date||b.createdAt)||0).getTime() - new Date((a.date||a.createdAt)||0).getTime());

    const tenkoHtml = tenko.length ? tenko.map(tenkoCard).join("") : `<div style="opacity:.7;padding:10px 0">点呼履歴：まだありません</div>`;
    const dailyHtml = daily.length ? daily.map(dailyCard).join("") : `<div style="opacity:.7;padding:10px 0">日報履歴：まだありません</div>`;

    box.innerHTML = `
      <div style="margin-top:8px">
        <div style="font-weight:900;margin:10px 0 6px 0">点呼履歴</div>
        ${tenkoHtml}
      </div>
      <div style="margin-top:14px">
        <div style="font-weight:900;margin:10px 0 6px 0">日報履歴</div>
        ${dailyHtml}
      </div>
    `;

    // 個別削除
    box.querySelectorAll(".btnDelOne").forEach(btn=>{
      bindTap(btn, async ()=>{
        const kind = btn.dataset.kind;
        const id = btn.dataset.id;
        if(!confirm("この履歴を削除しますか？")) return;

        if(kind === "tenko") await window.OFADB.deleteTenko(id);
        if(kind === "daily") await window.OFADB.deleteDaily(id);

        await renderHistory();
      });
    });

    // タップでPDF（削除ボタン以外）
    box.querySelectorAll(".historyItem").forEach(item=>{
      bindTap(item, async ()=>{
        // 削除ボタン押下はここに来ないように stopPropagation 済みだが、念のため
        const ymd = item.dataset.ymd;
        const name = decodeURIComponent(item.dataset.name || "");
        const base = decodeURIComponent(item.dataset.base || "");
        const phoneNorm = decodeURIComponent(item.dataset.phone || "");

        if(!ymd || !name || !base || !phoneNorm){
          alert("履歴データが不足しています");
          return;
        }
        try{
          await makePdfForDayFromDb({ymd, name, base, phoneNorm});
        }catch(e){
          console.error(e);
          alert("PDF再出力に失敗しました");
        }
      });
    });
  }

  // ------------------------------
  // 初期化
  // ------------------------------
  async function loadProfileToInputs(){
    const p = await window.OFADB.loadProfile();
    if(!p){
      setChip("dotProfile", "profileState", false, "未保存");
      return;
    }
    $("p_name").value = p.name || "";
    $("p_base").value = p.base || "";
    $("p_carNo").value = p.carNo || "";
    $("p_licenseNo").value = p.licenseNo || "";
    $("p_phone").value = p.phone || "";
    $("p_email").value = p.email || "";

    setChip("dotProfile", "profileState", true, "保存済み");
  }

  function computeOdoState(){
    const s = num($("d_odoStart")?.value);
    const e = num($("a_odoEnd")?.value);
    if(s>0 && e>0 && e>=s){
      setChip("dotOdo", "odoState", true, `走行距離：${e - s} km`);
    }else{
      setChip("dotOdo", "odoState", false, "走行距離：未計算");
    }
  }

  function wireOdoCalc(){
    ["d_odoStart","a_odoEnd"].forEach(id=>{
      const el = $(id);
      if(!el) return;
      el.addEventListener("input", computeOdoState);
      el.addEventListener("change", computeOdoState);
    });
  }

  document.addEventListener("DOMContentLoaded", async ()=>{
    // 日時の初期値（空なら入れる）
    if($("d_at") && !$("d_at").value) $("d_at").value = nowLocalInputValue();
    if($("a_at") && !$("a_at").value) $("a_at").value = nowLocalInputValue();

    renderChecklist();
    wireOdoCalc();

    await loadProfileToInputs();
    await renderHistory();

    // 基本情報 保存
    bindTap($("btnSaveProfile"), async ()=>{
      const p = getProfileInputs();
      if(!validateProfile(p)) return;
      await window.OFADB.saveProfile(p);
      setChip("dotProfile", "profileState", true, "保存済み");
      alert("基本情報を保存しました");
    });

    // 基本情報 読み込み
    bindTap($("btnLoadProfile"), async ()=>{
      await loadProfileToInputs();
      alert("読み込みました");
    });

    // 出発点呼 保存
    bindTap($("btnSaveDep"), async ()=>{
      const p = getProfileInputs();
      if(!validateProfile(p)) return;

      const t = getDepInputs(p);
      if(!validateTenkoCommon(t, true)) return;

      // 入力ファイルは保存しない（PDF生成時のみ）
      const id = await window.OFADB.addTenko(t);
      alert("出発点呼を保存しました");

      await renderHistory();
    });

    // 出発点呼 クリア
    bindTap($("btnClearDep"), ()=>{
      ["d_at","d_method","d_sleep","d_temp","d_condition","d_fatigue","d_med","d_medDetail","d_drink","d_alcState","d_alcValue","d_alcJudge","d_projectMain","d_area","d_danger","d_odoStart","d_abnormal","d_abnormalDetail"]
        .forEach(id=> { const el=$(id); if(el) el.value=""; });

      if($("d_at")) $("d_at").value = nowLocalInputValue();
      computeOdoState();
      alert("出発点呼をクリアしました");
    });

    // 帰着点呼 保存
    bindTap($("btnSaveArr"), async ()=>{
      const p = getProfileInputs();
      if(!validateProfile(p)) return;

      const t = getArrInputs(p);
      if(!validateTenkoCommon(t, false)) return;

      const id = await window.OFADB.addTenko(t);
      alert("帰着点呼を保存しました");

      await renderHistory();
      computeOdoState();
    });

    // 帰着点呼 クリア
    bindTap($("btnClearArr"), ()=>{
      ["a_at","a_method","a_breakMin","a_temp","a_condition","a_fatigue","a_med","a_medDetail","a_alcState","a_alcValue","a_alcJudge","a_odoEnd","a_abnormal","a_abnormalDetail"]
        .forEach(id=> { const el=$(id); if(el) el.value=""; });

      if($("a_at")) $("a_at").value = nowLocalInputValue();
      computeOdoState();
      alert("帰着点呼をクリアしました");
    });

    // 今日のPDF（点呼＋日報）
    bindTap($("btnMakePdf"), async ()=>{
      const p = getProfileInputs();
      if(!validateProfile(p)) return;

      // 今日扱い：画面入力を優先でPDF生成（画像あり）
      const dep = getDepInputs(p);
      const arr = getArrInputs(p);

      const daily = getDailyInputs(p);
      // 日報は任意：dateが無ければPDFには空扱いでOK
      const odoDiff = (dep.odoStart && arr.odoEnd) ? Math.max(0, num(arr.odoEnd) - num(dep.odoStart)) : 0;

      const files = {
        licenseImg: $("f_licenseImg")?.files?.[0] || null,
        alcDepImg: $("f_alcDepImg")?.files?.[0] || null,
        alcArrImg: $("f_alcArrImg")?.files?.[0] || null,
      };

      if(typeof window.generateTodayPdf !== "function"){
        alert("PDF生成が読み込まれていません（pdf.js）");
        return;
      }
      try{
        await window.generateTodayPdf({profile:p, dep, arr, daily:(daily.date?daily:null), odoDiff, files});
      }catch(e){
        console.error(e);
        alert("PDF生成に失敗しました");
      }
    });

    // CSV出力（全履歴） ※既存csv.jsがあるならそっちを使う
    bindTap($("btnMakeCsv"), async ()=>{
      if(typeof window.exportAllCsv === "function"){
        await window.exportAllCsv();
        return;
      }
      // 保険：JSONで保存
      const tenko = await window.OFADB.allTenko();
      const daily = await window.OFADB.allDaily();
      const blob = new Blob([JSON.stringify({tenko, daily}, null, 2)], {type:"application/json"});
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `OFA_all_${new Date().toISOString().slice(0,10)}.json`;
      a.click();
    });

    // 履歴 更新
    bindTap($("btnReloadHistory"), async ()=>{
      await renderHistory();
      alert("更新しました");
    });

    // 全削除（注意）
    bindTap($("btnClearAll"), async ()=>{
      if(!confirm("点呼・日報の履歴を全削除します。よろしいですか？")) return;
      await window.OFADB.clearAll();
      await renderHistory();
      alert("全削除しました（基本情報は残ります）");
    });
  });

})();
