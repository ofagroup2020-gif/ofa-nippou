// app-common.js
export function $(id){ return document.getElementById(id); }

export function toast(msg, ok=false){
  const el = $("toast");
  if(!el){ alert(msg); return; }
  el.textContent = msg;
  el.className = "toast " + (ok ? "ok" : "ng");
  el.style.display = "block";
  setTimeout(()=> el.style.display="none", 2000);
}

export function todayISO(){
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${dd}`;
}
export function nowTime(){
  const d = new Date();
  const hh = String(d.getHours()).padStart(2,"0");
  const mm = String(d.getMinutes()).padStart(2,"0");
  return `${hh}:${mm}`;
}
export function monthISO(){
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  return `${y}-${m}`;
}

export function clearErrors(root=document){
  root.querySelectorAll(".isError").forEach(el=>el.classList.remove("isError"));
}
export function markError(el){
  if(el) el.classList.add("isError");
}
export function requireValue(el, label="必須項目"){
  const v = (el?.value ?? "").toString().trim();
  if(!v){ markError(el); throw new Error(`${label}を入力してください`); }
  return v;
}
export function requireNumber(el, label="必須項目"){
  const v = requireValue(el, label);
  const n = Number(v);
  if(Number.isNaN(n)){ markError(el); throw new Error(`${label}は数値で入力してください`); }
  return n;
}
export function boolFromSelect(el){
  const v = (el?.value ?? "").toString().trim();
  if(v === "あり" || v === "OK" || v === "yes" || v === "true") return true;
  if(v === "なし" || v === "NG" || v === "no" || v === "false") return false;
  return null;
}

export function csvDownload(filename, rows){
  // rows: array of objects (same keys)
  if(!rows || rows.length===0) throw new Error("出力データがありません");
  const keys = Object.keys(rows[0]);
  const esc = (s)=> `"${String(s??"").replaceAll('"','""')}"`;
  const lines = [
    keys.map(esc).join(","),
    ...rows.map(r=> keys.map(k=>esc(r[k])).join(","))
  ];
  const blob = new Blob(["\ufeff"+lines.join("\n")], {type:"text/csv;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function toMinutes(hhmm){
  const s = (hhmm||"").trim();
  if(!s) return 0;
  const [h,m] = s.split(":").map(x=>Number(x));
  if(Number.isNaN(h)||Number.isNaN(m)) return 0;
  return h*60+m;
}
