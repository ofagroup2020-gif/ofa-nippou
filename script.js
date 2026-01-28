// 管理番号生成
document.getElementById("manageId").value =
  "OFA-" + new Date().getTime();

document.getElementById("createdAt").value =
  new Date().toLocaleString();

// 日常点検15項目
const items = [
  "ウォッシャー液","ブレーキ液","バッテリー液","冷却水","エンジンオイル",
  "タイヤ空気圧","タイヤ損傷","タイヤ溝","ランプ類","ブレーキ効き",
  "パーキングブレーキ","ウォッシャ噴射","ワイパー","エンジン始動","加速状態"
];

const box = document.getElementById("dailyCheck");
items.forEach(t=>{
  const l=document.createElement("label");
  l.innerHTML=`<input type="checkbox"> ${t}`;
  box.appendChild(l);
});

// 署名
const canvas = document.getElementById("sign");
const ctx = canvas.getContext("2d");
let drawing=false;

canvas.addEventListener("touchstart",()=>drawing=true);
canvas.addEventListener("touchend",()=>drawing=false);
canvas.addEventListener("touchmove",e=>{
  if(!drawing) return;
  const t=e.touches[0];
  const r=canvas.getBoundingClientRect();
  ctx.lineTo(t.clientX-r.left,t.clientY-r.top);
  ctx.stroke();
});

document.getElementById("clearSign").onclick=()=>{
  ctx.clearRect(0,0,canvas.width,canvas.height);
};
