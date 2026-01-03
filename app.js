/****************************************************
 * OFA 点呼システム app.js（完全動作版）
 ****************************************************/

const GAS_WEBAPP_URL =
  "https://script.google.com/macros/s/AKfycbyBhHOjpzOlfOIVANlELi4sbJtT_DWd7ApCEX8f_chBXl4xfCtYo9nJE008vLwtKcqO_w/exec";

const ADMIN_PASS = "ofa-2026";

function $(id){ return document.getElementById(id); }

function toast(msg, ok=false){
  const el = $("toast");
  if(!el){ alert(msg); return; }
  el.textContent = msg;
  el.className = "toast " + (ok ? "ok":"ng");
  el.style.display = "block";
  setTimeout(()=> el.style.display="none", 2200);
}

function setBusy(btn, busy){
  if(!btn) return;
  btn.disabled = !!busy;
  btn.style.opacity = busy ? "0.6" : "1";
  btn.style.pointerEvents = busy ? "none" : "auto";
}

function setAdmin(enabled){
  localStorage.setItem("ofa_admin", enabled ? "1" : "0");
}
function isAdmin(){
  return localStorage.getItem("ofa_admin")==="1";
}

function pageName(){
  return document.body?.dataset?.page || "";
}

function nowLocalDateTime(){
  const d = new Date();
  const pad = (n)=> String(n).padStart(2,"0");
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
    iso: d.toISOString()
  };
}

function setDefaultDateTime(){
  const n = nowLocalDateTime();
  if($("date") && !$("date").value) $("date").value = n.date;
  if($("time") && !$("time").value) $("time").value = n.time;
}

function bindBack(){
  const b = $("backBtn");
  if(b) b.addEventListener("click", ()=> history.length>1 ? history.back() : (location.href="./index.html"));
}

function calcOdo(){
  const s = Number(($("odoStart")?.value||"").toString().replace(/[^\d.]/g,""));
  const e = Number(($("odoEnd")?.value||"").toString().replace(/[^\d.]/g,""));
  if(!isFinite(s) || !isFinite(e) || s<=0 || e<=0 || e<s){
    if($("odoTotal")) $("odoTotal").value = "";
    return;
  }
  if($("odoTotal")) $("odoTotal").value = String(e - s);
}

function bindOdo(){
  const a = $("odoStart");
  const b = $("odoEnd");
  if(a) a.addEventListener("input", calcOdo);
  if(b) b.addEventListener("input", calcOdo);
}

function anyInspectionNG(){
  const ids = [
    "insp_tire","insp_light","insp_brake","insp_wiper","insp_engineOil","insp_coolant",
    "insp_battery","insp_horn","insp_mirror","insp_damage","insp_cargo","insp_extinguisher","insp_triangle"
  ];
  return ids.some(id => ($(`${id}`)?.value||"") === "NG");
}

function updateInspPhotoRequirement(){
  const block = $("inspPhotoBlock");
  if(!block) return;
  const need = anyInspectionNG();
  block.style.display = need ? "block" : "none";
}

function bindInspection(){
  const ids = [
    "insp_tire","insp_light","insp_brake","insp_wiper","insp_engineOil","insp_coolant",
    "insp_battery","insp_horn","insp_mirror","insp_damage","insp_cargo","insp_extinguisher","insp_triangle"
  ];
  ids.forEach(id=>{
    const el = $(id);
    if(el) el.addEventListener("change", updateInspPhotoRequirement);
  });
  updateInspPhotoRequirement();
}

function clearErrMarks(){
  document.querySelectorAll(".err").forEach(el=> el.classList.remove("err"));
}

function markErr(el){
  if(!el) return;
  el.classList.add("err");
  el.scrollIntoView({behavior:"smooth", block:"center"});
}

function validateRequired(){
  clearErrMarks();

  // data-req=1 を必須として扱う
  const reqEls = Array.from(document.querySelectorAll("[data-req='1']"));
  for(const el of reqEls){
    const v = (el.value ?? "").toString().trim();
    if(!v){
      markErr(el);
      toast("未入力の必須項目があります");
      return false;
    }
  }

  // 点検NGなら異常箇所写真必須
  if(anyInspectionNG()){
    const files = $("inspPhotos")?.files;
    if(!files || files.length === 0){
      markErr($("inspPhotos"));
      toast("点検NGがあるため「異常箇所写真」が必須です");
      return false;
    }
    // NGなら点検メモも推奨（空でも許容はするが、赤枠にするなら必須化）
    const note = ($("insp_note")?.value||"").trim();
    if(!note){
      markErr($("insp_note"));
      toast("点検NGのため「点検メモ（詳細）」も入力してください");
      return false;
    }
  }

  // 走行距離の簡易チェック
  const s = Number(($("odoStart")?.value||"").toString().replace(/[^\d.]/g,""));
  const e = $("odoEnd") ? Number(($("odoEnd").value||"").toString().replace(/[^\d.]/g,"")) : NaN;
  if(isFinite(s) && isFinite(e) && e>0 && e<s){
    markErr($("odoEnd"));
    toast("終了メーターが開始メーターより小さいです");
    return false;
  }

  return true;
}

// ファイルを base64 で読む（容量が大きすぎる場合は弾く）
async function filesToBase64(fileList, maxFiles=6, maxTotalMB=12){
  if(!fileList || fileList.length===0) return [];
  const files = Array.from(fileList).slice(0, maxFiles);

  let total = 0;
  for(const f of files){ total += f.size; }
  const totalMB = total / (1024*1024);
  if(totalMB > maxTotalMB){
    throw new Error(`添付が大きすぎます（合計 ${totalMB.toFixed(1)}MB）。写真枚数を減らしてください。`);
  }

  const readOne = (file)=> new Promise((resolve, reject)=>{
    const fr = new FileReader();
    fr.onload = ()=> {
      const dataUrl = String(fr.result||"");
      const comma = dataUrl.indexOf(",");
      const base64 = comma>=0 ? dataUrl.slice(comma+1) : "";
      resolve({
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
        base64
      });
    };
    fr.onerror = ()=> reject(new Error("ファイル読み込み失敗"));
    fr.readAsDataURL(file);
  });

  const out = [];
  for(const f of files){
    out.push(await readOne(f));
  }
  return out;
}

// ✅ プリフライト回避：Content-Type を text/plain にして JSON文字列送信
async function postToGAS(payload){
  const res = await fetch(GAS_WEBAPP_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload)
  });
  const text = await res.text();
  let json;
  try{ json = JSON.parse(text); }catch(e){
    throw new Error("GAS応答がJSONではありません: " + text.slice(0,200));
  }
  if(!json.ok){
    throw new Error(json.error || "GASでエラーが発生しました");
  }
  return json;
}

function setLoginUI(profile){
  const s = $("loginState");
  if(s){
    s.innerHTML = `ログイン中： <b>${profile.name || "ユーザー"}</b><br><span class="note mini">${profile.email}</span>`;
  }
}

// ===== Departure/Arrival common =====
async function submitTenko(kind){
  if(!validateRequired()) return;

  // ログイン必須
  const profile = (typeof getProfile === "function") ? getProfile() : {email:"",name:""};
  if(!profile.email){
    toast("Googleログインが必要です");
    return;
  }

  const btn = $("btnSubmit");
  setBusy(btn, true);
  toast("送信中…");

  try{
    const inspections = {
      tire: $("insp_tire")?.value||"",
      light: $("insp_light")?.value||"",
      brake: $("insp_brake")?.value||"",
      wiper: $("insp_wiper")?.value||"",
      engineOil: $("insp_engineOil")?.value||"",
      coolant: $("insp_coolant")?.value||"",
      battery: $("insp_battery")?.value||"",
      horn: $("insp_horn")?.value||"",
      mirror: $("insp_mirror")?.value||"",
      damage: $("insp_damage")?.value||"",
      cargo: $("insp_cargo")?.value||"",
      extinguisher: $("insp_extinguisher")?.value||"",
      triangle: $("insp_triangle")?.value||""
    };

    // 添付（必要な分だけ）
    const licensePhotos = await filesToBase64($("licensePhotos")?.files);
    const tenkoPhotos = await filesToBase64($("tenkoPhotos")?.files);
    const inspPhotos   = await filesToBase64($("inspPhotos")?.files);

    const payload = {
      action: "submitTenko",
      kind, // "departure" or "arrival"
      profile,
      data: {
        date: $("date")?.value||"",
        time: $("time")?.value||"",
        driverName: $("driverName")?.value||"",
        driverPhone: $("driverPhone")?.value||"",
        vehicleNo: $("vehicleNo")?.value||"",
        managerName: $("managerName")?.value||"",
        method: $("method")?.value||"",
        place: $("place")?.value||"",
        alcoholValue: $("alcoholValue")?.value||"",
        alcoholBand: $("alcoholBand")?.value||"",
        sleepHours: $("sleepHours")?.value||"",
        sleepNote: $("sleepNote")?.value||"",
        memo: $("memo")?.value||"",
        odoStart: $("odoStart")?.value||"",
        odoEnd: $("odoEnd")?.value||"",
        odoTotal: $("odoTotal")?.value||"",
        inspections,
        insp_note: $("insp_note")?.value||"",
        licenseNo: $("licenseNo")?.value||"",
      },
      files: {
        licensePhotos,
        tenkoPhotos,
        inspPhotos
      }
    };

    // arrival only fields
    if(kind === "arrival"){
      const reportPhotos = await filesToBase64($("reportPhotos")?.files);
      payload.data.workType = $("workType")?.value||"";
      payload.data.workArea = $("workArea")?.value||"";
      payload.data.workHours = $("workHours")?.value||"";
      payload.data.deliveryCount = $("deliveryCount")?.value||"";
      payload.data.trouble = $("trouble")?.value||"";
      payload.data.dailyNote = $("dailyNote")?.value||"";
      payload.files.reportPhotos = reportPhotos;
    }

    const json = await postToGAS(payload);
    toast("送信完了！保存しました", true);

    // トップへ
    setTimeout(()=> location.href="./index.html", 700);

  }catch(e){
    console.error(e);
    toast("送信失敗: " + (e?.message || e));
  }finally{
    setBusy(btn, false);
  }
}

// ===== Export =====
function exportAdminUI(){
  const adminState = $("adminState");
  const box = $("adminSearchBox");
  if(adminState){
    adminState.textContent = isAdmin() ? "管理者ON" : "管理者OFF";
  }
  if(box){
    box.style.display = isAdmin() ? "block" : "none";
  }
}

async function exportAction(action, extra = {}){
  const profile = getProfile();
  if(!profile.email){
    toast("Googleログインが必要です");
    return;
  }

  const payload = {
    action,
    profile,
    admin: isAdmin() ? 1 : 0,
    adminPass: isAdmin() ? (localStorage.getItem("ofa_admin_pass") || "") : "",
    query: {
      name: $("qName")?.value||"",
      phone: $("qPhone")?.value||"",
      vehicle: $("qVehicle")?.value||""
    },
    ...extra
  };

  toast("処理中…");
  const json = await postToGAS(payload);

  // 結果表示
  const box = $("resultBox");
  if(box){
    box.style.display = "block";
    if(json.url){
      box.innerHTML = `✅ 完了<br><a href="${json.url}" target="_blank" rel="noopener">結果を開く</a>`;
    }else if(json.csv){
      box.innerHTML = `✅ 完了<br><a href="${json.csv}" target="_blank" rel="noopener">CSVを開く</a>`;
    }else{
      box.innerHTML = `✅ 完了`;
    }
  }

  return json;
}

async function loadHistory(){
  const m = $("historyMonth")?.value || "";
  if(!m){ toast("履歴対象月を選んでください"); return; }

  const json = await exportAction("listHistory", { month: m });
  const list = json.items || [];
  const box = $("historyBox");
  const cnt = $("historyCount");
  const ul = $("historyList");

  if(cnt) cnt.textContent = `${list.length}件`;
  if(ul){
    ul.innerHTML = "";
    list.forEach(item=>{
      const div = document.createElement("div");
      div.className = "item";
      div.innerHTML = `<div><b>${item.date}</b><div class="note mini">${item.driverName || ""}</div></div><div>作成</div>`;
      div.addEventListener("click", async ()=>{
        $("dateDaily").value = item.date;
        await exportAction("createDailyPdf", { date: item.date });
      });
      ul.appendChild(div);
    });
  }
  if(box) box.style.display = "block";
}

// ===== Init per page =====
window.addEventListener("DOMContentLoaded", async ()=>{
  bindBack();

  const p = pageName();

  // index は何もしない（リンクのみ）
  if(p === "") return;

  // departure/arrival/export はログイン必須
  if(typeof requireLogin !== "function"){
    toast("auth.js が読み込まれていません");
    return;
  }

  await requireLogin({
    buttonElId: "gBtn",
    onAuthed: (profile)=>{
      // ✅ ログイン後も“勝手に別ページへ行かない”
      setLoginUI(profile);

      const loginCard = $("loginCard");
      const formCard = $("formCard");
      const exportCard = $("exportCard");

      if(p === "departure" || p === "arrival"){
        if(loginCard) loginCard.style.display = "none";
        if(formCard) formCard.style.display = "block";

        setDefaultDateTime();
        bindOdo();
        bindInspection();

        const submitBtn = $("btnSubmit");
        if(submitBtn){
          submitBtn.addEventListener("click", ()=> submitTenko(p));
        }
      }

      if(p === "export"){
        if(loginCard) loginCard.style.display = "none";
        if(exportCard) exportCard.style.display = "block";

        // admin ON/OFF
        exportAdminUI();

        const onBtn = $("adminLoginBtn");
        const offBtn = $("adminLogoutBtn");
        const pass = $("adminPass");

        if(onBtn){
          onBtn.addEventListener("click", ()=>{
            const v = (pass?.value||"").trim();
            if(v !== ADMIN_PASS){
              setAdmin(false);
              localStorage.removeItem("ofa_admin_pass");
              exportAdminUI();
              toast("管理者パスワードが違います");
              return;
            }
            setAdmin(true);
            localStorage.setItem("ofa_admin_pass", v);
            exportAdminUI();
            toast("管理者モードON", true);
          });
        }
        if(offBtn){
          offBtn.addEventListener("click", ()=>{
            setAdmin(false);
            localStorage.removeItem("ofa_admin_pass");
            if(pass) pass.value="";
            exportAdminUI();
            toast("管理者モードOFF", true);
          });
        }

        // export buttons
        $("btnDailyPdf")?.addEventListener("click", async ()=>{
          const d = $("dateDaily")?.value || "";
          if(!d){ toast("日報の日付を選んでください"); return; }
          await exportAction("createDailyPdf", { date: d });
        });

        $("btnMonthlyPdf")?.addEventListener("click", async ()=>{
          const m = $("month")?.value || "";
          if(!m){ toast("月報の月を選んでください"); return; }
          await exportAction("createMonthlyPdf", { month: m });
        });

        $("btnMonthlyCsv")?.addEventListener("click", async ()=>{
          const m = $("month")?.value || "";
          if(!m){ toast("月を選んでください"); return; }
          await exportAction("createMonthlyCsv", { month: m });
        });

        $("btnCsvRange")?.addEventListener("click", async ()=>{
          const from = $("fromDate")?.value || "";
          const to = $("toDate")?.value || "";
          if(!from || !to){ toast("開始日と終了日を入力してください"); return; }
          await exportAction("createRangeCsv", { from, to });
        });

        $("btnLoadHistory")?.addEventListener("click", loadHistory);
      }
    }
  });

});
