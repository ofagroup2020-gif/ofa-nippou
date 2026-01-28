// ====== 基本セット ======
const $ = (id) => document.getElementById(id);
const state = {
  type: "loan",
  photos: {}, // dataURL
};

// 管理番号＆日時
function pad2(n){ return String(n).padStart(2,"0"); }
function nowStr(){
  const d=new Date();
  return `${d.getFullYear()}/${pad2(d.getMonth()+1)}/${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
function makeManageId(){
  const d=new Date();
  const y=d.getFullYear(), m=pad2(d.getMonth()+1), da=pad2(d.getDate());
  const hh=pad2(d.getHours()), mm=pad2(d.getMinutes()), ss=pad2(d.getSeconds());
  // 例：OFA-00-20260127-010203
  return `OFA-00-${y}${m}${da}-${hh}${mm}${ss}`;
}
$("manageId").value = makeManageId();
$("createdAt").value = nowStr();

// ====== タブ ======
document.querySelectorAll(".tab").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    document.querySelectorAll(".tab").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    state.type = btn.dataset.type;

    // タブ切替でリセット（前データ残さない）
    resetAll();
  });
});

function resetAll(){
  // 入力リセット
  ["pref","carNo","frameNo","mileage","fuel","userName","email","tel","agree"].forEach(id=>{
    const el=$(id);
    if(!el) return;
    if(el.type==="checkbox") el.checked=false;
    else el.value="";
  });

  // 写真リセット
  state.photos = {};
  document.querySelectorAll('input.photo').forEach(inp=>{
    inp.value = "";
  });

  // チェックリセット
  document.querySelectorAll("#dailyCheck input[type=checkbox]").forEach(c=>c.checked=false);

  // 署名リセット
  const canvas = $("sign");
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0,0,canvas.width,canvas.height);

  // 管理番号と日時は更新
  $("manageId").value = makeManageId();
  $("createdAt").value = nowStr();
}

// ====== 日常点検 15 ======
const dailyItems = [
  "1. ウインド・ウォッシャ液の量",
  "2. ブレーキ液の量",
  "3. バッテリー液の量",
  "4. 冷却水の量",
  "5. エンジンオイルの量",
  "6. タイヤの空気圧",
  "7. タイヤの亀裂、損傷および異状な摩耗",
  "8. タイヤの溝の深さ",
  "9. ランプ類の点灯、点滅およびレンズの汚れ、損傷",
  "10. ブレーキ・ペダルの踏みしろおよびブレーキの利き",
  "11. パーキング・ブレーキ・レバーの引きしろ",
  "12. ウインド・ウォッシャの噴射状態",
  "13. ワイパの拭き取りの状態",
  "14. エンジンのかかり具合および異音",
  "15. エンジンの低速および加速の状態",
];
const dailyBox = $("dailyCheck");
dailyBox.innerHTML = "";
dailyItems.forEach((t, idx)=>{
  const l=document.createElement("label");
  l.innerHTML = `<input type="checkbox" data-i="${idx}"> <span>${t}</span>`;
  dailyBox.appendChild(l);
});

// ====== 写真：DataURL化して保持 ======
async function fileToDataURL(file){
  return new Promise((resolve,reject)=>{
    const fr = new FileReader();
    fr.onload = ()=>resolve(fr.result);
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}

document.querySelectorAll("input.photo").forEach(inp=>{
  inp.addEventListener("change", async ()=>{
    const key = inp.dataset.key;
    const file = inp.files && inp.files[0];
    if(!key || !file) return;
    // 重すぎ防止：長辺1200px目安で縮小（免許証などは見える範囲のまま）
    const data = await fileToDataURL(file);
    state.photos[key] = data;
  });
});

// ====== 署名 ======
const canvas = $("sign");
const ctx = canvas.getContext("2d");
ctx.lineWidth = 2.2;
ctx.lineCap = "round";
ctx.strokeStyle = "#111";

let drawing = false;
let last = null;

function posFromTouch(e){
  const t=e.touches[0];
  const r=canvas.getBoundingClientRect();
  return { x: t.clientX - r.left, y: t.clientY - r.top };
}
canvas.addEventListener("touchstart", (e)=>{
  drawing = true;
  last = posFromTouch(e);
  ctx.beginPath();
  ctx.moveTo(last.x,last.y);
},{passive:true});

canvas.addEventListener("touchmove", (e)=>{
  if(!drawing) return;
  const p = posFromTouch(e);
  ctx.lineTo(p.x,p.y);
  ctx.stroke();
  last = p;
},{passive:true});

canvas.addEventListener("touchend", ()=>{
  drawing = false;
  last = null;
});

$("clearSign").addEventListener("click", ()=>{
  ctx.clearRect(0,0,canvas.width,canvas.height);
});

// ====== 下部バー：入力中は邪魔なので隠す ======
const bottomBar = $("bottomBar");
function hideBar(){ bottomBar.style.transform="translateY(110%)"; bottomBar.style.transition="transform .2s"; }
function showBar(){ bottomBar.style.transform="translateY(0)"; bottomBar.style.transition="transform .2s"; }

function attachFocusHide(){
  const targets = document.querySelectorAll("input, select, textarea");
  targets.forEach(el=>{
    el.addEventListener("focus", hideBar);
    el.addEventListener("blur", showBar);
  });
}
attachFocusHide();

// iOSのスクロール中も邪魔なら、スクロールで一時的に隠す
let scrollTimer=null;
window.addEventListener("scroll", ()=>{
  hideBar();
  clearTimeout(scrollTimer);
  scrollTimer=setTimeout(()=>showBar(), 220);
});
