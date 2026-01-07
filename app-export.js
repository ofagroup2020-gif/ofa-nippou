// app-export.js
import { auth, db, watchAuth } from "./app-auth.js";
import { $, toast, monthISO, csvDownload } from "./app-common.js";

import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

function monthRange(month){
  const [y,m] = month.split("-").map(Number);
  const from = new Date(y, m-1, 1);
  const to = new Date(y, m, 1);
  const fromISO = from.toISOString().slice(0,10);
  const toISO = to.toISOString().slice(0,10);
  return {fromISO, toISO};
}

async function fetchDailyByRange(uid, fromISO, toISO){
  const q = query(
    collection(db,"daily"),
    where("uid","==", uid),
    where("workDate", ">=", fromISO),
    where("workDate", "<", toISO)
  );
  const snap = await getDocs(q);
  const arr=[];
  snap.forEach(d=>{
    const r = d.data();
    arr.push({
      id: d.id,
      workDate: r.workDate || "",
      driverName: r.driverName || "",
      projects: (r.projects||[]).map(p=>`${p.name}:${p.area}`).join(" | "),
      startTime: r.startTime || "",
      endTime: r.endTime || "",
      workMinutes: r.workMinutes ?? "",
      breakMinutes: r.breakMinutes ?? "",
      deliveries: r.deliveries ?? "",
      absent: r.absent ?? "",
      redelivery: r.redelivery ?? "",
      returns: r.returns ?? "",
      claimFlag: r.claimFlag || "",
      claimDetail: r.claimDetail || "",
      payTotal: r.payTotal ?? "",
      costTotal: r.costTotal ?? "",
      profit: r.profit ?? "",
      accidentFlag: r.accidentFlag || "",
      delayReason: r.delayReason || "",
      tomorrowPlan: r.tomorrowPlan || ""
    });
  });
  // 日付昇順
  arr.sort((a,b)=> (a.workDate||"").localeCompare(b.workDate||""));
  return arr;
}

function buildMonthlySummary(dailyRows){
  let days=0, totalPay=0, totalCost=0, totalDeliver=0, totalWorkMin=0, totalBreak=0;
  let claims=0, accidents=0;
  dailyRows.forEach(r=>{
    days++;
    totalPay += Number(r.payTotal||0);
    totalCost += Number(r.costTotal||0);
    totalDeliver += Number(r.deliveries||0);
    totalWorkMin += Number(r.workMinutes||0);
    totalBreak += Number(r.breakMinutes||0);
    if((r.claimFlag||"")==="あり") claims++;
    if((r.accidentFlag||"")==="あり") accidents++;
  });
  const profit = totalPay-totalCost;
  const avgDeliver = days ? (totalDeliver/days) : 0;
  return {
    days,
    totalWorkHours: Math.round((totalWorkMin/60)*10)/10,
    totalBreakMin: totalBreak,
    totalDeliver,
    avgDeliver: Math.round(avgDeliver*10)/10,
    totalPay,
    totalCost,
    profit,
    claims,
    accidents
  };
}

function renderMonthly(summary){
  $("monthlyBox").innerHTML = `
    <table class="table">
      <tr><th>稼働日数</th><td>${summary.days}</td></tr>
      <tr><th>総稼働時間</th><td>${summary.totalWorkHours} h</td></tr>
      <tr><th>総休憩</th><td>${summary.totalBreakMin} 分</td></tr>
      <tr><th>総配達個数</th><td>${summary.totalDeliver} / 平均 ${summary.avgDeliver}</td></tr>
      <tr><th>売上合計</th><td>${summary.totalPay.toLocaleString()} 円</td></tr>
      <tr><th>経費合計</th><td>${summary.totalCost.toLocaleString()} 円</td></tr>
      <tr><th>概算利益</th><td><b>${summary.profit.toLocaleString()} 円</b></td></tr>
      <tr><th>クレーム件数</th><td>${summary.claims}</td></tr>
      <tr><th>事故件数</th><td>${summary.accidents}</td></tr>
    </table>
  `;
}

async function csvMonth(){
  const user = auth.currentUser;
  if(!user) return toast("ログインしてください");
  const month = ($("month").value||"").trim();
  if(!month) return toast("月を選択してください");

  const {fromISO,toISO} = monthRange(month);
  toast("作成中…");
  const rows = await fetchDailyByRange(user.uid, fromISO, toISO);
  csvDownload(`OFA_daily_${month}_${user.uid}.csv`, rows);
  toast("CSVを出力しました", true);
}

async function csvRange(){
  const user = auth.currentUser;
  if(!user) return toast("ログインしてください");
  const from = ($("from").value||"").trim();
  const to = ($("to").value||"").trim();
  if(!from || !to) return toast("from/to を入力してください");
  if(from > to) return toast("from が to より後です");

  // to は当日含めたいので +1日
  const toDate = new Date(to);
  toDate.setDate(toDate.getDate()+1);
  const toISO = toDate.toISOString().slice(0,10);

  toast("作成中…");
  const rows = await fetchDailyByRange(user.uid, from, toISO);
  csvDownload(`OFA_daily_${from}_to_${to}_${user.uid}.csv`, rows);
  toast("CSVを出力しました", true);
}

async function makeMonthly(){
  const user = auth.currentUser;
  if(!user) return toast("ログインしてください");
  const month = ($("month").value||"").trim();
  if(!month) return toast("月を選択してください");

  const {fromISO,toISO} = monthRange(month);
  toast("集計中…");
  const rows = await fetchDailyByRange(user.uid, fromISO, toISO);
  const summary = buildMonthlySummary(rows);
  renderMonthly(summary);

  // 月報CSV（集計）
  const out = [{
    month,
    uid: user.uid,
    email: user.email||"",
    days: summary.days,
    totalWorkHours: summary.totalWorkHours,
    totalBreakMin: summary.totalBreakMin,
    totalDeliver: summary.totalDeliver,
    avgDeliver: summary.avgDeliver,
    totalPay: summary.totalPay,
    totalCost: summary.totalCost,
    profit: summary.profit,
    claims: summary.claims,
    accidents: summary.accidents
  }];
  try{
    csvDownload(`OFA_monthly_${month}_${user.uid}.csv`, out);
  }catch(e){}

  toast("月報を作成しました", true);
}

function printMonthly(){
  const month = ($("month").value||"").trim();
  if(!month) return toast("月を選択してください");
  location.href = `./print.html?month=${encodeURIComponent(month)}`;
}

watchAuth((user)=>{
  $("dot").classList.remove("ng"); $("dot").classList.add("ok");
  $("state").textContent="ログイン中";
  $("who").textContent=user.email||"(no email)";
}, ()=>location.href="./index.html");

document.addEventListener("DOMContentLoaded", ()=>{
  $("backBtn").addEventListener("click", ()=>location.href="./index.html");
  $("month").value = monthISO();
  $("csvMonthBtn").addEventListener("click", csvMonth);
  $("csvRangeBtn").addEventListener("click", csvRange);
  $("monthlyBtn").addEventListener("click", makeMonthly);
  $("printMonthlyBtn").addEventListener("click", printMonthly);
});
