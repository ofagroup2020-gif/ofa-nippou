const $ = (id) => document.getElementById(id);

const state = {
  role: sessionStorage.getItem("ofa_role") || "",
  name: sessionStorage.getItem("ofa_name") || ""
};

function toast(msg){
  const t = $("toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  setTimeout(()=>t.classList.add("hidden"), 1800);
}

function setLoginUI(){
  const loggedIn = !!state.role;

  $("loginState").textContent = loggedIn ? (state.role === "admin" ? "管理者ログイン中" : "ドライバーログイン中") : "未ログイン";

  $("goDeparture").disabled = !loggedIn;
  $("goArrival").disabled = !loggedIn;
  $("goDriverHistory").disabled = !loggedIn;

  // 管理者のみ
  $("goAdmin").disabled = !(loggedIn && state.role === "admin");

  $("logoutBtn").style.display = loggedIn ? "inline-block" : "none";
}

function hideAllViews(){
  ["viewDeparture","viewArrival","viewDriverHistory","viewAdmin"].forEach(v=>$(v).classList.add("hidden"));
}

function showView(id){
  hideAllViews();
  $(id).classList.remove("hidden");
  window.scrollTo({top:0, behavior:"smooth"});
}

function todayISO(){
  const d = new Date();
  const tz = new Date(d.getTime() - d.getTimezoneOffset()*60000);
  return tz.toISOString().slice(0,10);
}

function getStore(){
  try{
    return JSON.parse(localStorage.getItem("ofa_records") || "[]");
  }catch(e){
    return [];
  }
}
function setStore(list){
  localStorage.setItem("ofa_records", JSON.stringify(list));
}

function validateRequired(pairs){
  for(const [label, value] of pairs){
    if(String(value || "").trim() === ""){
      return `${label} を入力してください`;
    }
  }
  return "";
}

function addRecord(type, data){
  const list = getStore();
  list.unshift({
    id: crypto.randomUUID(),
    type,
    createdAt: new Date().toISOString(),
    role: state.role,
    ...data
  });
  setStore(list);
}

function renderHistory(){
  const list = getStore();
  const box = $("historyList");
  if(!list.length){
    box.innerHTML = `<div class="item"><div class="meta">履歴がありません</div></div>`;
    return;
  }
  box.innerHTML = list.slice(0,50).map(r=>{
    const when = new Date(r.createdAt).toLocaleString("ja-JP");
    return `
      <div class="item">
        <div class="meta">${when} / ${r.type}</div>
        <b>${r.name || "-"} / ${r.date || "-"}</b><br/>
        <span style="color:#6b7280;font-size:12px;">${(r.memo||r.work||"").toString().slice(0,80)}</span>
      </div>
    `;
  }).join("");
}

function exportCSV(){
  const list = getStore();
  if(!list.length){ toast("データがありません"); return; }

  const headers = ["createdAt","type","name","date","sleep","break","alcohol","judge","license","method","work","memo"];
  const rows = [headers.join(",")];

  for(const r of list){
    const row = [
      r.createdAt,
      r.type,
      r.name || "",
      r.date || "",
      r.sleep || "",
      r.break || "",
      r.alcohol || "",
      r.judge || "",
      r.license || "",
      r.method || "",
      r.work || "",
      (r.memo || "").replace(/\n/g," ").replace(/"/g,'""')
    ].map(v => `"${String(v ?? "")}"`);
    rows.push(row.join(","));
  }

  const blob = new Blob([rows.join("\n")], {type:"text/csv;charset=utf-8;"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `OFA_records_${todayISO()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast("CSVを出力しました");
}

window.addEventListener("load", () => {
  // 初期日付
  $("dep_date").value = todayISO();
  $("arr_date").value = todayISO();

  setLoginUI();

  // ログイン
  $("driverLoginBtn").addEventListener("click", () => {
    const pw = $("pw").value.trim();
    if(pw === window.OFA_CONFIG.DRIVER_PASSWORD){
      state.role = "driver";
      sessionStorage.setItem("ofa_role", state.role);
      $("loginMsg").textContent = "";
      toast("ドライバーでログインしました");
      setLoginUI();
    }else{
      $("loginMsg").textContent = "パスワードが違います";
    }
  });

  $("adminLoginBtn").addEventListener("click", () => {
    const pw = $("pw").value.trim();
    if(pw === window.OFA_CONFIG.ADMIN_PASSWORD){
      state.role = "admin";
      sessionStorage.setItem("ofa_role", state.role);
      $("loginMsg").textContent = "";
      toast("管理者でログインしました");
      setLoginUI();
    }else{
      $("loginMsg").textContent = "管理者パスワードが違います";
    }
  });

  $("logoutBtn").addEventListener("click", () => {
    sessionStorage.removeItem("ofa_role");
    state.role = "";
    toast("ログアウトしました");
    setLoginUI();
    hideAllViews();
  });

  // 画面遷移
  $("goDeparture").addEventListener("click", ()=>showView("viewDeparture"));
  $("goArrival").addEventListener("click", ()=>showView("viewArrival"));
  $("goDriverHistory").addEventListener("click", ()=>{
    renderHistory();
    showView("viewDriverHistory");
  });
  $("goAdmin").addEventListener("click", ()=>showView("viewAdmin"));

  document.querySelectorAll("[data-back]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      hideAllViews();
      window.scrollTo({top:0, behavior:"smooth"});
    });
  });

  // 出発保存
  $("saveDeparture").addEventListener("click", ()=>{
    const data = {
      name: $("dep_name").value.trim(),
      date: $("dep_date").value,
      sleep: $("dep_sleep").value,
      alcohol: $("dep_alc").value,
      judge: $("dep_judge").value,
      license: $("dep_license").value.trim(),
      method: $("dep_method").value,
      memo: $("dep_memo").value.trim()
    };

    const err = validateRequired([
      ["氏名", data.name],
      ["日付", data.date],
      ["睡眠時間", data.sleep],
      ["アルコール数値", data.alcohol],
      ["酒気帯び判定", data.judge],
      ["免許証番号", data.license]
    ]);
    if(err){ $("depMsg").textContent = err; return; }

    $("depMsg").textContent = "";
    addRecord("departure", data);
    toast("出発点呼を保存しました");
  });

  // 帰着保存
  $("saveArrival").addEventListener("click", ()=>{
    const data = {
      name: $("arr_name").value.trim(),
      date: $("arr_date").value,
      break: $("arr_break").value,
      alcohol: $("arr_alc").value,
      judge: $("arr_judge").value,
      license: $("arr_license").value.trim(),
      work: $("arr_work").value.trim(),
      memo: $("arr_memo").value.trim()
    };

    const err = validateRequired([
      ["氏名", data.name],
      ["日付", data.date],
      ["休憩時間", data.break],
      ["アルコール数値", data.alcohol],
      ["酒気帯び判定", data.judge],
      ["免許証番号", data.license],
      ["業務内容", data.work]
    ]);
    if(err){ $("arrMsg").textContent = err; return; }

    $("arrMsg").textContent = "";
    addRecord("arrival", data);
    toast("帰着点呼・日報を保存しました");
  });

  $("printPdf").addEventListener("click", ()=>{
    toast("印刷→PDF保存できます");
    setTimeout(()=>window.print(), 300);
  });

  $("exportCsv").addEventListener("click", exportCSV);

  $("clearLocal").addEventListener("click", ()=>{
    if(confirm("端末内データを削除します。よろしいですか？")){
      localStorage.removeItem("ofa_records");
      renderHistory();
      toast("削除しました");
    }
  });
});
