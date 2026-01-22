// js/tenko.js
// 出発点呼／帰着点呼を完全分離
// 点呼フル項目 + 日常点検フル + 画像（任意）ありでも保存できる設計
// 保存先：IndexedDB（STORE_TENKO）
// 依存：js/db.js（idbGet/idbPut/idbGetAll/searchRecords/normalizeDate など）
// 依存：js/csv.js（buildTenkoCsv/downloadText があるとCSV出力できる）

(function(){
  const $ = (id)=> document.getElementById(id);

  // =========================
  // ✅ 日常点検（フル）定義
  // =========================
  const CHECKLIST_A = [
    "タイヤ空気圧",
    "タイヤ溝 / ひび割れ",
    "ホイールナット緩み",
    "ブレーキ効き",
    "パーキングブレーキ",
    "ハンドル操作",
    "ライト（前照灯/尾灯/ブレーキ/ウインカー/ハザード）",
    "ワイパー / ウォッシャー液",
    "ミラー / ガラス破損"
  ];
  const CHECKLIST_B = [
    "エンジンオイル量",
    "冷却水",
    "バッテリー（警告灯含む）",
    "異音 / 異臭 / 異常振動",
    "漏れ（オイル/冷却水）",
    "外装破損",
    "積載状態（偏り/過積載なし）"
  ];
  const CHECKLIST_C = [
    "消火器",
    "三角停止板",
    "反射ベスト",
    "ジャッキ/工具（任意でもOK）"
  ];

  // =========================
  // util
  // =========================
  function toast(msg){
    const t = $("toast");
    if(!t){ alert(msg); return; }
    t.textContent = msg;
    t.style.display = "block";
    clearTimeout(toast._tm);
    toast._tm = setTimeout(()=> t.style.display="none", 2400);
  }
  function n(v){
    const x = Number(v);
    return Number.isFinite(x) ? x : 0;
  }
  function s(v){
    return (v===null || v===undefined) ? "" : String(v);
  }
  function normDate(v){
    return (v||"").toString().slice(0,10);
  }
  function nowIso(){
    return new Date().toISOString();
  }
  function todayStr(){
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,"0");
    const dd = String(d.getDate()).padStart(2,"0");
    return `${y}-${m}-${dd}`;
  }

  // =========================
  // ✅ 画像：圧縮してDataURL化（iPhoneの巨大画像で保存失敗するのを防ぐ）
  // =========================
  async function fileToDataUrlCompressed(file, maxW=1280, quality=0.78){
    if(!file) return "";

    // 画像以外はそのまま（基本は画像のみ想定）
    if(!/^image\//.test(file.type)){
      return await new Promise((resolve,reject)=>{
        const fr = new FileReader();
        fr.onload = ()=> resolve(fr.result);
        fr.onerror = reject;
        fr.readAsDataURL(file);
      });
    }

    const dataUrl = await new Promise((resolve,reject)=>{
      const fr = new FileReader();
      fr.onload = ()=> resolve(fr.result);
      fr.onerror = reject;
      fr.readAsDataURL(file);
    });

    // 圧縮（Canvas）
    return await new Promise((resolve)=>{
      const img = new Image();
      img.onload = ()=>{
        try{
          const w = img.width;
          const h = img.height;
          const scale = Math.min(1, maxW / w);
          const cw = Math.round(w * scale);
          const ch = Math.round(h * scale);

          const canvas = document.createElement("canvas");
          canvas.width = cw;
          canvas.height = ch;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, cw, ch);

          // JPEGで軽くする（透過不要ならOK）
          const out = canvas.toDataURL("image/jpeg", quality);
          resolve(out);
        }catch(e){
          // 圧縮失敗時は元のdataUrlで返す（保存失敗しないように try/catch）
          resolve(dataUrl);
        }
      };
      img.onerror = ()=> resolve(dataUrl);
      img.src = dataUrl;
    });
  }

  // =========================
  // profile（基本情報）
  // =========================
  async function loadProfile(){
    try{
      const p = await idbGet("profile", "me");
      return p || null;
    }catch(e){
      console.error(e);
      return null;
    }
  }

  // =========================
  // ✅ 日常点検UI生成（スクロール入力）
  //  - コンテナが空なら自動で作る
  // =========================
  function buildChecklistHtml(title, items, prefix){
    // prefix: "A" "B" "C" など
    return `
      <div class="checkBlock">
        <div class="checkTitle">${title}</div>
        ${items.map((label, i)=>{
          const key = `${prefix}_${i}`;
          return `
            <div class="checkRow" data-key="${key}" data-label="${label}">
              <div class="checkLabel">${label}</div>
              <div class="checkBtns">
                <button type="button" class="miniBtn ok"  data-val="OK">OK</button>
                <button type="button" class="miniBtn ng"  data-val="NG">NG</button>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

  function ensureChecklistUI(){
    const wrap = $("dailyCheckWrap") || $("dailyCheck") || $("checklistWrap");
    if(!wrap) return null;

    // 既に中身があるならそのまま使う（ただし data-label が無い場合は生成して上書き）
    const hasRows = wrap.querySelector(".checkRow");
    if(!hasRows){
      wrap.innerHTML = `
        <div class="checklist" style="max-height:260px;overflow:auto;border:1px solid #ddd;border-radius:10px;padding:10px;background:#fff">
          ${buildChecklistHtml("A. 安全走行に直結（必須）", CHECKLIST_A, "A")}
          ${buildChecklistHtml("B. 車両状態（必須）", CHECKLIST_B, "B")}
          ${buildChecklistHtml("C. 装備（必須）", CHECKLIST_C, "C")}
        </div>
      `;
    }

    // 初期状態：全てOK（クリックで切替）
    wrap.querySelectorAll(".checkRow").forEach(row=>{
      if(!row.dataset.state){
        row.dataset.state = "OK";
      }
      applyRowState(row);

      row.querySelectorAll("button[data-val]").forEach(btn=>{
        btn.addEventListener("click", ()=>{
          row.dataset.state = btn.dataset.val;
          applyRowState(row);
        });
      });
    });

    return wrap;
  }

  function applyRowState(row){
    const st = row.dataset.state || "OK";
    row.classList.toggle("isOK", st==="OK");
    row.classList.toggle("isNG", st==="NG");
    row.querySelectorAll("button[data-val]").forEach(btn=>{
      const on = (btn.dataset.val === st);
      btn.classList.toggle("active", on);
    });
  }

  function readChecklist(){
    const wrap = $("dailyCheckWrap") || $("dailyCheck") || $("checklistWrap");
    if(!wrap) return [];

    const rows = Array.from(wrap.querySelectorAll(".checkRow"));
    if(rows.length===0){
      // フォールバック：旧HTMLが checkbox 形式の場合
      const cbs = Array.from(wrap.querySelectorAll('input[type="checkbox"]'));
      if(cbs.length){
        return cbs.map(cb=>({ label: cb.parentElement?.innerText?.trim() || "項目", ok: !!cb.checked }));
      }
      return [];
    }

    return rows.map(r=>{
      return {
        label: r.dataset.label || "",
        ok: (r.dataset.state || "OK") === "OK"
      };
    });
  }

  function checklistNgLabels(list){
    return (list||[]).filter(x=>!x.ok).map(x=>x.label);
  }

  // =========================
  // ✅ 点呼フォーム読み取り
  // =========================
  function readTenkoForm(){
    const type = s($("tenkoType")?.value || $("tenko_type")?.value || ""); // "出発" or "帰着" or internal
    const at   = s($("tenkoAt")?.value || $("tenko_at")?.value || "");     // 手入力（datetime-local推奨）
    const method = s($("method")?.value || "");
    const sleep  = s($("sleep")?.value || "");
    const temp   = s($("temp")?.value || "");
    const condition = s($("condition")?.value || "");
    const fatigue   = s($("fatigue")?.value || "");

    const med = s($("med")?.value || ""); // なし/あり
    const medDetail = s($("medDetail")?.value || "");

    const drink = s($("drink")?.value || ""); // なし/あり
    const alcJudge = s($("alcJudge")?.value || "");
    const alcValue = s($("alcValue")?.value || $("alc")?.value || "");

    const base = s($("base")?.value || $("profile_base")?.value || "");
    const carNo = s($("carNo")?.value || $("carNoTenko")?.value || $("carNoTenko2")?.value || "");
    const licenseNo = s($("licenseNo")?.value || $("licenseNoTenko")?.value || "");

    // 出発／帰着ODO（同時入力はさせない運用）
    const odoStart = s($("odoStart")?.value || "");
    const odoEnd   = s($("odoEnd")?.value || "");

    // 業務
    const mainProject = s($("mainProject")?.value || $("tenkoProject")?.value || "");
    const loadArea    = s($("loadArea")?.value || $("tenkoArea")?.value || "");
    const danger      = s($("danger")?.value || $("dangerFlag")?.value || ""); // 有/無

    // 異常
    const abnormal = s($("abnormal")?.value || "");
    const abnormalDetail = s($("abnormalDetail")?.value || $("abnormalMemo")?.value || "");

    // 日常点検
    const checklist = readChecklist();
    const checkMemo = s($("checkMemo")?.value || $("memo")?.value || "");

    // 画像ファイル（任意）
    const alcImgEl = $("alcImg") || $("alcPhoto") || $("alcImage");
    const abnormalImgEl = $("abnormalImg") || $("abnormalPhoto") || $("abnormalImage");

    const files = {
      alcImg: alcImgEl?.files?.[0] || null,
      abnormalImg: abnormalImgEl?.files?.[0] || null
    };

    // type normalize → internal ("departure"/"arrival")
    let typeKey = "";
    if(type==="出発" || type==="出発（業務開始前）" || type==="start" || type==="departure") typeKey = "departure";
    else if(type==="帰着" || type==="帰着（業務終了後）" || type==="end" || type==="arrival") typeKey = "arrival";

    return {
      typeLabel: type,
      typeKey,
      at, method, sleep, temp, condition, fatigue,
      med, medDetail,
      drink,
      alcJudge, alcValue,
      base, carNo, licenseNo,
      odoStart, odoEnd,
      mainProject, loadArea, danger,
      abnormal, abnormalDetail,
      checklist, checkMemo,
      files
    };
  }

  // =========================
  // ✅ 点呼の必須チェック（フル仕様）
  //  - 日報や売上は別。点呼の必須のみチェック。
  //  - ODOは出発＝odoStart必須、帰着＝odoEnd必須
  // =========================
  function validateTenko(t){
    // 基本情報
    if(!t.typeKey){
      toast("点呼区分（出発/帰着）を選択してください");
      return false;
    }
    if(!t.at){
      toast("点呼日時（手入力）が必須です");
      return false;
    }
    if(!t.base){
      toast("拠点（47都道府県 or 自由記入）が必須です");
      return false;
    }
    if(!t.carNo){
      toast("車両番号（ナンバー）が必須です");
      return false;
    }
    if(!t.licenseNo){
      toast("運転免許証番号が必須です");
      return false;
    }

    // 健康
    if(t.typeKey==="departure"){
      // 出発点呼：睡眠時間が必須
      if(!t.sleep){
        toast("睡眠時間が必須です（出発点呼）");
        return false;
      }
    }
    if(!t.temp){
      toast("体温が必須です");
      return false;
    }
    if(!t.condition){
      toast("体調が必須です");
      return false;
    }
    if(!t.fatigue){
      toast("疲労が必須です");
      return false;
    }

    // 服薬
    if(!t.med){
      toast("服薬（なし/あり）が必須です");
      return false;
    }
    if(t.med==="あり" && !t.medDetail){
      toast("服薬内容を入力してください（服薬ありの場合）");
      return false;
    }

    // 飲酒
    if(!t.drink){
      toast("飲酒の有無（なし/あり）が必須です");
      return false;
    }

    // アルコール
    if(!t.alcJudge){
      toast("酒気帯び判定（なし/疑い/あり or OK/NG）が必須です");
      return false;
    }
    if(t.alcValue === "" || t.alcValue === null || t.alcValue === undefined){
      toast("アルコール数値が必須です（0.00でも入力）");
      return false;
    }
    // 数値として妥当か（空文字を弾いた上で）
    if(!Number.isFinite(Number(t.alcValue))){
      toast("アルコール数値が数値ではありません");
      return false;
    }

    // ODO（出発/帰着で分離）
    if(t.typeKey==="departure"){
      if(!t.odoStart){
        toast("出発ODOが必須です（出発点呼）");
        return false;
      }
      if(!Number.isFinite(Number(t.odoStart))){
        toast("出発ODOが数値ではありません");
        return false;
      }
    }else{
      if(!t.odoEnd){
        toast("帰着ODOが必須です（帰着点呼）");
        return false;
      }
      if(!Number.isFinite(Number(t.odoEnd))){
        toast("帰着ODOが数値ではありません");
        return false;
      }
    }

    // 業務（必須）
    if(!t.mainProject){
      toast("稼働案件（メイン）が必須です");
      return false;
    }
    if(!t.loadArea){
      toast("積込拠点/エリアが必須です");
      return false;
    }
    if(!t.danger){
      toast("危険物・高額品の有無が必須です");
      return false;
    }

    // 異常（必須）
    if(!t.abnormal){
      toast("異常の有無（なし/あり）が必須です");
      return false;
    }
    if(t.abnormal==="あり" && !t.abnormalDetail){
      toast("異常内容を入力してください（異常ありの場合）");
      return false;
    }

    // 日常点検（必須）
    const list = t.checklist || [];
    if(list.length < (CHECKLIST_A.length + CHECKLIST_B.length + CHECKLIST_C.length) / 2){
      // 生成UIが無い/少ない場合の保険（基本は full を生成している）
      // ただし「保存を止めない」設計にし、警告のみ出す
      console.warn("checklist seems short:", list.length);
    }

    // NGルール：NGがあるならメモ必須
    const ng = checklistNgLabels(list);
    if(ng.length && !t.checkMemo){
      toast("日常点検でNGがある場合、NG詳細メモが必須です");
      return false;
    }

    return true;
  }

  // =========================
  // ✅ 点呼保存（画像があっても落ちない）
  // =========================
  async function saveTenko(){
    const profile = await loadProfile();
    if(!profile){
      toast("基本情報が未保存です。先に基本情報を保存してください。");
      return;
    }

    // checklist UI ensure
    ensureChecklistUI();

    const t = readTenkoForm();

    // プロフィールから入れる（フォームに無い場合もあるので強制セット）
    t.name = profile.name || "";
    t.base = t.base || profile.base || "";
    t.phone = profile.phone || "";
    t.email = profile.email || "";
    t.licenseNo = t.licenseNo || profile.licenseNo || "";

    if(!validateTenko(t)) return;

    // 画像は任意。圧縮して保存（失敗しても保存は続行）
    let alcImgDataUrl = "";
    let abnormalImgDataUrl = "";
    try{
      if(t.files.alcImg){
        alcImgDataUrl = await fileToDataUrlCompressed(t.files.alcImg, 1280, 0.78);
      }
    }catch(e){
      console.warn("alc image failed:", e);
      alcImgDataUrl = "";
    }
    try{
      if(t.files.abnormalImg){
        abnormalImgDataUrl = await fileToDataUrlCompressed(t.files.abnormalImg, 1280, 0.78);
      }
    }catch(e){
      console.warn("abnormal image failed:", e);
      abnormalImgDataUrl = "";
    }

    // IDは「日付 + 出発/帰着」で分離（同日に出発と帰着を1件ずつ持てる）
    const day = normDate(t.at);
    const id = `${day}_${t.name}_${t.base}_${t.typeKey}`; // 1日1件（出発/帰着別）上書き運用

    // ODO差分（両方揃っている時だけ後で計算）
    // ここでは一旦0。保存後に相方があれば計算して両方に反映する
    const record = {
      id,
      uid: profile.uid || "",
      name: t.name,
      base: t.base,
      phone: t.phone,
      email: t.email,

      carNo: t.carNo,
      licenseNo: t.licenseNo,

      type: t.typeKey,               // "departure" / "arrival"
      at: t.at,                      // datetime-local string
      method: t.method,

      // health
      sleep: t.sleep,                // departure必須
      temp: t.temp,
      condition: t.condition,
      fatigue: t.fatigue,
      med: t.med,
      medDetail: t.medDetail,
      drink: t.drink,

      // alcohol
      alcJudge: t.alcJudge,
      alcValue: s(t.alcValue),
      alcImgDataUrl,                 // 任意

      // odo
      odoStart: t.typeKey==="departure" ? s(t.odoStart) : "",
      odoEnd:   t.typeKey==="arrival"   ? s(t.odoEnd)   : "",

      // business
      mainProject: t.mainProject,
      loadArea: t.loadArea,
      danger: t.danger,

      // abnormal
      abnormal: t.abnormal,
      abnormalDetail: t.abnormalDetail,
      abnormalImgDataUrl,            // 任意

      // daily check
      checklist: t.checklist || [],
      checkMemo: t.checkMemo || "",

      // computed
      odoDiff: 0,

      updatedAt: nowIso()
    };

    try{
      await idbPut("tenko", record);

      // ✅ 相方がある場合：ODO差分を計算して両方に反映
      await updateOdoDiffIfPaired(record);

      toast("点呼を保存しました（IndexedDB）");
      await refreshTenkoHistory();
    }catch(e){
      console.error(e);
      toast("保存に失敗しました： " + (e?.message || e));
    }
  }

  async function updateOdoDiffIfPaired(saved){
    try{
      const day = normDate(saved.at);
      const name = saved.name;
      const base = saved.base;

      const depId = `${day}_${name}_${base}_departure`;
      const arrId = `${day}_${name}_${base}_arrival`;

      const dep = await idbGet("tenko", depId);
      const arr = await idbGet("tenko", arrId);

      if(dep && arr){
        const diff = n(arr.odoEnd) - n(dep.odoStart);
        const odoDiff = (Number.isFinite(diff) && diff > 0) ? diff : 0;

        dep.odoDiff = odoDiff;
        arr.odoDiff = odoDiff;
        dep.updatedAt = nowIso();
        arr.updatedAt = nowIso();

        await idbPut("tenko", dep);
        await idbPut("tenko", arr);
      }
    }catch(e){
      console.warn("updateOdoDiffIfPaired failed:", e);
    }
  }

  // =========================
  // 履歴表示（自分のみ）
  // =========================
  function renderTenkoHistory(rows){
    const box = $("tenkoHistoryList");
    if(!box) return;

    if(!rows || rows.length===0){
      box.innerHTML = `<div class="note">点呼履歴がありません</div>`;
      return;
    }

    box.innerHTML = rows.map(r=>{
      const day = normDate(r.at);
      const hhmm = s(r.at).slice(11,16);
      const typeJ = r.type==="departure" ? "出発" : "帰着";
      const odo = r.type==="departure" ? (r.odoStart||"") : (r.odoEnd||"");
      const km = r.odoDiff ? ` / ${r.odoDiff}km` : "";
      const alc = (r.alcValue!=="" && r.alcValue!==null && r.alcValue!==undefined) ? ` / Alc:${r.alcValue}` : "";
      const ng = checklistNgLabels(r.checklist||[]);
      const ngTag = ng.length ? ` / 点検NG:${ng.length}` : "";

      return `
        <div class="histItem">
          <div class="histTop">
            <div class="histDate">${day} ${hhmm} / ${typeJ}${km}${alc}${ngTag}</div>
            <button class="miniBtn" data-act="load" data-id="${r.id}">呼出</button>
          </div>
          <div class="histSub">
            車両:${s(r.carNo)} / ODO:${s(odo)} / 案件:${s(r.mainProject)}
          </div>
        </div>
      `;
    }).join("");

    box.querySelectorAll('button[data-act="load"]').forEach(btn=>{
      btn.addEventListener("click", async ()=>{
        const id = btn.dataset.id;
        await loadTenkoToForm(id);
      });
    });
  }

  async function refreshTenkoHistory(){
    const profile = await loadProfile();
    if(!profile) return;

    try{
      const { tenkoHit } = await searchRecords({
        from: "",
        to: "",
        base: profile.base || "",
        name: profile.name || ""
      });

      const mine = (tenkoHit||[]).filter(t => t.name===profile.name && t.base===profile.base)
                                .sort((a,b)=> String(b.at).localeCompare(String(a.at)))
                                .slice(0, 200);

      renderTenkoHistory(mine);
    }catch(e){
      console.error(e);
      renderTenkoHistory([]);
    }
  }

  // =========================
  // 呼出（フォームに反映）
  // =========================
  async function loadTenkoToForm(id){
    try{
      const r = await idbGet("tenko", id);
      if(!r){ toast("データが見つかりません"); return; }

      // type
      const tenkoTypeEl = $("tenkoType") || $("tenko_type");
      if(tenkoTypeEl){
        tenkoTypeEl.value = (r.type==="departure") ? "出発" : "帰着";
      }

      $("tenkoAt") && ($("tenkoAt").value = r.at || "");
      $("tenko_at") && ($("tenko_at").value = r.at || "");

      $("method") && ($("method").value = r.method || "");
      $("sleep") && ($("sleep").value = r.sleep || "");
      $("temp") && ($("temp").value = r.temp || "");
      $("condition") && ($("condition").value = r.condition || "");
      $("fatigue") && ($("fatigue").value = r.fatigue || "");

      $("med") && ($("med").value = r.med || "");
      $("medDetail") && ($("medDetail").value = r.medDetail || "");

      $("drink") && ($("drink").value = r.drink || "");

      $("alcJudge") && ($("alcJudge").value = r.alcJudge || "");
      $("alcValue") && ($("alcValue").value = r.alcValue ?? "");
      $("alc") && ($("alc").value = r.alcValue ?? "");

      $("base") && ($("base").value = r.base || "");
      $("carNo") && ($("carNo").value = r.carNo || "");
      $("licenseNo") && ($("licenseNo").value = r.licenseNo || "");

      // odo (分離)
      $("odoStart") && ($("odoStart").value = r.odoStart || "");
      $("odoEnd") && ($("odoEnd").value = r.odoEnd || "");

      // business
      $("mainProject") && ($("mainProject").value = r.mainProject || "");
      $("tenkoProject") && ($("tenkoProject").value = r.mainProject || "");
      $("loadArea") && ($("loadArea").value = r.loadArea || "");
      $("tenkoArea") && ($("tenkoArea").value = r.loadArea || "");
      $("danger") && ($("danger").value = r.danger || "");
      $("dangerFlag") && ($("dangerFlag").value = r.danger || "");

      // abnormal
      $("abnormal") && ($("abnormal").value = r.abnormal || "");
      $("abnormalDetail") && ($("abnormalDetail").value = r.abnormalDetail || "");
      $("abnormalMemo") && ($("abnormalMemo").value = r.abnormalDetail || "");

      // checklist
      ensureChecklistUI();
      const wrap = $("dailyCheckWrap") || $("dailyCheck") || $("checklistWrap");
      if(wrap){
        const map = new Map((r.checklist||[]).map(x=>[x.label, x.ok]));
        wrap.querySelectorAll(".checkRow").forEach(row=>{
          const label = row.dataset.label || "";
          if(map.has(label)){
            row.dataset.state = map.get(label) ? "OK" : "NG";
            applyRowState(row);
          }
        });
      }
      $("checkMemo") && ($("checkMemo").value = r.checkMemo || "");
      $("memo") && ($("memo").value = r.checkMemo || "");

      toast("点呼を呼び出しました");
    }catch(e){
      console.error(e);
      toast("呼出に失敗： " + (e?.message || e));
    }
  }

  // =========================
  // CSV（自分の点呼を出力）
  // =========================
  async function exportMyTenkoCsv(){
    if(typeof buildTenkoCsv !== "function" || typeof downloadText !== "function"){
      toast("CSV機能が未読み込みです（js/csv.js を確認）");
      return;
    }

    const profile = await loadProfile();
    if(!profile){
      toast("基本情報が未保存です");
      return;
    }

    try{
      const { tenkoHit } = await searchRecords({
        from: "", to: "",
        base: profile.base || "",
        name: profile.name || ""
      });

      const mine = (tenkoHit||[]).filter(t => t.name===profile.name && t.base===profile.base)
                                .sort((a,b)=> String(a.at).localeCompare(String(b.at)));

      const csv = buildTenkoCsv(mine);
      const key = `${profile.name}_${profile.base}`;
      downloadText(`OFA_点呼_${key}.csv`, csv);
      toast("点呼CSVを出力しました");
    }catch(e){
      console.error(e);
      toast("CSV出力に失敗： " + (e?.message || e));
    }
  }

  // =========================
  // UI：出発/帰着を明確に分ける（入力欄の表示制御）
  //  - 出発 → odoStart表示 / odoEnd隠す
  //  - 帰着 → odoEnd表示 / odoStart隠す
  // =========================
  function applyTypeVisibility(){
    const typeEl = $("tenkoType") || $("tenko_type");
    const type = s(typeEl?.value || "");

    const isDep = (type==="出発" || type==="出発（業務開始前）" || type==="departure" || type==="start");
    const isArr = (type==="帰着" || type==="帰着（業務終了後）" || type==="arrival" || type==="end");

    const depBox = $("odoStartWrap") || $("odoStartBox") || $("wrapOdoStart");
    const arrBox = $("odoEndWrap") || $("odoEndBox") || $("wrapOdoEnd");

    // 無ければ input だけでもOK
    const odoStartEl = $("odoStart");
    const odoEndEl   = $("odoEnd");

    if(depBox) depBox.style.display = isDep ? "block" : (isArr ? "none" : "block");
    if(arrBox) arrBox.style.display = isArr ? "block" : (isDep ? "none" : "block");

    if(!depBox && odoStartEl) odoStartEl.style.display = isArr ? "none" : "block";
    if(!arrBox && odoEndEl)   odoEndEl.style.display   = isDep ? "none" : "block";
  }

  // =========================
  // init
  // =========================
  async function init(){
    // checklist UI
    ensureChecklistUI();

    // 初期値
    if(($("tenkoAt") || $("tenko_at"))){
      // 手入力を邪魔しない：空なら「今」に寄せる（勝手に確定はしない）
      const el = $("tenkoAt") || $("tenko_at");
      if(el && !el.value){
        // datetime-local形式（YYYY-MM-DDTHH:MM）
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth()+1).padStart(2,"0");
        const dd = String(d.getDate()).padStart(2,"0");
        const hh = String(d.getHours()).padStart(2,"0");
        const mm = String(d.getMinutes()).padStart(2,"0");
        el.value = `${y}-${m}-${dd}T${hh}:${mm}`;
      }
    }

    // 出発/帰着の表示制御
    const typeEl = $("tenkoType") || $("tenko_type");
    if(typeEl){
      typeEl.addEventListener("change", ()=>{
        applyTypeVisibility();
      });
    }
    applyTypeVisibility();

    // 保存ボタン
    const btnSave = $("btnTenkoSave") || $("submitTenko") || $("btnTenko");
    if(btnSave){
      btnSave.addEventListener("click", saveTenko);
    }

    // CSVボタン
    const btnCsv = $("btnTenkoCsv");
    if(btnCsv){
      btnCsv.addEventListener("click", exportMyTenkoCsv);
    }

    // 履歴更新
    await refreshTenkoHistory();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
