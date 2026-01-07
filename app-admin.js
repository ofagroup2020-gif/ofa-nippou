// app-admin.js
import { auth, db, watchAuth, isAdminEmail } from "./app-auth.js";
import { ADMIN_FRONT_PASS } from "./config.js";
import { $, toast, csvDownload } from "./app-common.js";

import {
  collection, query, orderBy, limit, getDocs, where
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const LS_ADMIN = "ofa_admin_mode";

function setAdminMode(on){
  localStorage.setItem(LS_ADMIN, on ? "1":"0");
}
function getAdminMode(){
  return localStorage.getItem(LS_ADMIN)==="1";
}
function reflectAdminUI(){
  const on = getAdminMode();
  $("adminState").textContent = on ? "ON" : "OFF";
  $("adminTools").style.display = on ? "block" : "none";
}

async function loadSessions(){
  try{
    const q = query(collection(db,"sessions"), orderBy("updatedAt","desc"), limit(80));
    const snap = await getDocs(q);
    if(snap.empty){
      $("sessionsBox").innerHTML = "セッションなし";
      return;
    }
    const rows=[];
    snap.forEach(d=>{
      const s=d.data()||{};
      rows.push(`<tr>
        <td>${(s.email||"(no email)")}</td>
        <td>${(s.uid||d.id)}</td>
        <td>${s.updatedAt?.toDate ? s.updatedAt.toDate().toLocaleString() : "-"}</td>
      </tr>`);
    });
    $("sessionsBox").innerHTML = `
      <table class="table">
        <tr><th>email</th><th>uid</th><th>updatedAt</th></tr>
        ${rows.join("")}
      </table>
    `;
  }catch(e){
    $("sessionsBox").textContent = `読み込み失敗：${e?.message||e}`;
  }
}

let lastSearchRows = [];

async function adminSearch(){
  const user = auth.currentUser;
  if(!user) return toast("ログインしてください");
  if(!getAdminMode()) return toast("管理者モードをONにしてください");
  if(!isAdminEmail(user) && !getAdminMode()) return toast("管理者のみ");

  const qName = ($("qName").value||"").trim();
  const qVehicle = ($("qVehicle").value||"").trim();
  const qMonth = ($("qMonth").value||"").trim();

  // シンプル検索：tenko を月で絞り、name/vehicle を contains 風に（Firestoreはcontainsが弱いので、まず月で絞る）
  // 月が未指定なら直近100件
  let snap;

  if(qMonth){
    const [y,m] = qMonth.split("-").map(Number);
    const from = new Date(y, m-1, 1).toISOString().slice(0,10);
    const to = new Date(y, m, 1).toISOString().slice(0,10);

    // datetimeText は "YYYY-MM-DD HH:MM" なので、日付部分で範囲絞りにするため createdAt を使うのが理想
    // ここでは簡易に「workDateがあるdaily」も検索対象にする（まずは daily を対象）
    // 管理者検索は daily を中心に（出力は一番必要）
    const q = query(
      collection(db,"daily"),
      where("workDate", ">=", from),
      where("workDate", "<", to),
      orderBy("workDate","asc"),
      limit(500)
    );
    snap = await getDocs(q);
    const arr=[];
    snap.forEach(d=>{
      const r=d.data()||{};
      arr.push({
        id:d.id,
        type:"daily",
        workDate:r.workDate||"",
        driverName:r.driverName||"",
        vehicleNo:"", // dailyには持たせてない（必要なら追加可能）
        projects:(r.projects||[]).map(p=>`${p.name}:${p.area}`).join(" | "),
        deliveries:r.deliveries??"",
        payTotal:r.payTotal??"",
        costTotal:r.costTotal??"",
        profit:r.profit??""
      });
    });

    // contains filter
    const filtered = arr.filter(r=>{
      const okName = !qName || (r.driverName||"").includes(qName);
      const okVeh = !qVehicle || (r.vehicleNo||"").includes(qVehicle);
      return okName && okVeh;
    });
    lastSearchRows = filtered;
  }else{
    // 月未指定：sessions だけ案内
    lastSearchRows = [];
    $("resultBox").innerHTML = "月を指定してください（全件は重くなるため）";
    return;
  }

  if(lastSearchRows.length===0){
    $("resultBox").innerHTML = "該当なし";
    return;
  }

  $("resultBox").innerHTML = `
    <div class="small">件数：${lastSearchRows.length}</div>
    <table class="table" style="margin-top:8px;">
      <tr><th>日付</th><th>氏名</th><th>案件</th><th>配達</th><th>売上</th><th>経費</th><th>利益</th></tr>
      ${lastSearchRows.slice(0,80).map(r=>`
        <tr>
          <td>${r.workDate}</td>
          <td>${r.driverName}</td>
          <td>${r.projects}</td>
          <td>${r.deliveries}</td>
          <td>${r.payTotal}</td>
          <td>${r.costTotal}</td>
          <td>${r.profit}</td>
        </tr>
      `).join("")}
    </table>
    <div class="small">※表示は最大80件（CSVは全件）</div>
  `;
}

function exportAllCsv(){
  if(!getAdminMode()) return toast("管理者モードONが必要です");
  if(!lastSearchRows.length) return toast("検索結果がありません");
  csvDownload(`OFA_admin_search.csv`, lastSearchRows);
  toast("CSVを出力しました", true);
}

watchAuth((user)=>{
  $("dot").classList.remove("ng"); $("dot").classList.add("ok");
  $("state").textContent="ログイン中";
  $("who").textContent=user.email||"(no email)";

  // admin email の場合は admin モードONでもOK（ただしツール表示はフロントパス運用に合わせる）
  reflectAdminUI();
}, ()=>location.href="./index.html");

document.addEventListener("DOMContentLoaded", ()=>{
  $("backBtn").addEventListener("click", ()=>location.href="./index.html");

  $("adminOnBtn").addEventListener("click", ()=>{
    const v = ($("adminPass").value||"").trim();
    if(v !== ADMIN_FRONT_PASS){
      setAdminMode(false);
      reflectAdminUI();
      return toast("管理者パスワードが違います");
    }
    setAdminMode(true);
    reflectAdminUI();
    toast("管理者モードON", true);
  });

  $("adminOffBtn").addEventListener("click", ()=>{
    setAdminMode(false);
    $("adminPass").value="";
    reflectAdminUI();
    toast("OFF", true);
  });

  $("reloadSessions").addEventListener("click", loadSessions);
  $("searchBtn").addEventListener("click", adminSearch);
  $("exportAllCsvBtn").addEventListener("click", exportAllCsv);

  reflectAdminUI();
  loadSessions();
});
