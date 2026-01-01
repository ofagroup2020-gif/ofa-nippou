:root{
  --bg:#ffffff;
  --text:#0b1220;
  --muted:#5b6475;
  --card:#ffffff;
  --line:rgba(15,23,42,.10);
  --shadow: 0 14px 40px rgba(2,6,23,.10);

  --ofa-yellow:#f6c700;
  --ofa-black:#111827;

  --g1: linear-gradient(90deg,#ff4d4d,#ff9f1c,#ffd93d,#4cd964,#36c9ff,#5b5bff,#c154ff);
  --g2: linear-gradient(135deg,rgba(255,77,77,.14),rgba(255,159,28,.12),rgba(255,217,61,.12),rgba(76,217,100,.10),rgba(54,201,255,.12),rgba(91,91,255,.12),rgba(193,84,255,.12));
}

*{box-sizing:border-box}
html,body{height:100%}
body{
  margin:0;
  font-family: system-ui, -apple-system, "Hiragino Kaku Gothic ProN", "Noto Sans JP", Meiryo, sans-serif;
  background:
    radial-gradient(900px 600px at 10% 0%, rgba(246,199,0,.14), transparent 60%),
    radial-gradient(900px 600px at 90% 10%, rgba(54,201,255,.12), transparent 60%),
    radial-gradient(900px 700px at 50% 100%, rgba(193,84,255,.10), transparent 60%),
    var(--bg);
  color:var(--text);
  padding: 16px 12px 44px;
}

.wrap{max-width:980px;margin:0 auto;}
.topbar{
  display:flex;align-items:center;justify-content:space-between;gap:10px;
  margin-bottom:10px;
}
.brand{
  display:flex;flex-direction:column;gap:4px;
}
.brand .t{
  font-weight:900;
  letter-spacing:.2px;
  font-size:18px;
}
.brand .s{
  font-size:12px;
  color:var(--muted);
}
.badge{
  display:inline-flex;align-items:center;gap:8px;
  padding:8px 10px;border-radius:999px;
  background: rgba(17,24,39,.04);
  border:1px solid var(--line);
  font-weight:800;
  font-size:12px;
}
.dot{width:10px;height:10px;border-radius:50%;}
.dot.ok{background:#22c55e}
.dot.ng{background:#ef4444}
.btn{
  appearance:none;
  border:1px solid var(--line);
  background:#fff;
  color:var(--text);
  border-radius:14px;
  padding:12px 14px;
  font-weight:900;
  cursor:pointer;
  box-shadow: 0 8px 22px rgba(2,6,23,.06);
}
.btn:disabled{opacity:.55;cursor:not-allowed}
.btn.primary{
  border:none;
  background: var(--ofa-yellow);
  color:#1a1400;
}
.btn.ghost{
  background: rgba(255,255,255,.85);
}
.btn.rain{
  border:1px solid rgba(2,6,23,.10);
  position:relative;
}
.btn.rain::before{
  content:"";
  position:absolute;inset:-2px;
  border-radius:16px;
  background: var(--g1);
  z-index:-1;
}
.btn.small{padding:9px 12px;border-radius:12px;font-size:13px}
.grid{
  display:grid;
  grid-template-columns: repeat(12, 1fr);
  gap:12px;
}
.card{
  grid-column: span 12;
  background: var(--card);
  border:1px solid var(--line);
  border-radius:18px;
  box-shadow: var(--shadow);
  padding:14px;
  position:relative;
  overflow:hidden;
}
.card::before{
  content:"";
  position:absolute;inset:0;
  background: var(--g2);
  opacity:.55;
  pointer-events:none;
}
.card > *{position:relative}
.cardTitle{
  font-weight:900;
  margin:0 0 8px;
  display:flex;align-items:center;justify-content:space-between;gap:10px;
}
.cardSub{font-size:12px;color:var(--muted);line-height:1.5;margin:0 0 10px}
.hr{
  height:1px;background:rgba(15,23,42,.08);
  margin:10px 0;
}
label{
  display:block;
  font-size:12px;
  color:var(--muted);
  margin:10px 0 6px;
  font-weight:800;
}
input,select,textarea{
  width:100%;
  padding:12px 12px;
  border-radius:14px;
  border:1px solid rgba(15,23,42,.12);
  background:#fff;
  color:var(--text);
  outline:none;
  font-size:16px;
}
textarea{min-height:96px;resize:vertical}
.row{display:flex;gap:10px;flex-wrap:wrap}
.row > *{flex:1 1 220px}
.pills{display:flex;gap:8px;flex-wrap:wrap}
.pill{
  display:inline-flex;align-items:center;gap:8px;
  border:1px solid rgba(15,23,42,.10);
  padding:8px 10px;border-radius:999px;
  background: rgba(255,255,255,.85);
  font-size:12px;font-weight:900;color:#111827;
}
.note{
  font-size:12px;color:var(--muted);line-height:1.6;
  padding:10px 12px;border-radius:14px;
  border:1px dashed rgba(15,23,42,.18);
  background: rgba(255,255,255,.78);
}
.result{
  margin-top:10px;
  border-radius:14px;
  border:1px solid rgba(15,23,42,.12);
  background: rgba(255,255,255,.86);
  padding:10px 12px;
  word-break:break-all;
}
.result a{color:#2563eb;text-decoration:none;font-weight:900}
.table{
  width:100%;
  border-collapse:collapse;
  font-size:12px;
  background: rgba(255,255,255,.9);
  border-radius:14px;
  overflow:hidden;
  border:1px solid rgba(15,23,42,.10);
}
.table th,.table td{
  padding:10px 10px;border-bottom:1px solid rgba(15,23,42,.08);
  vertical-align:top;
}
.table th{background:rgba(246,199,0,.18);text-align:left}
.table tr:last-child td{border-bottom:none}

.toast{
  position:fixed;left:50%;bottom:16px;transform:translateX(-50%);
  padding:12px 14px;border-radius:14px;
  background: rgba(17,24,39,.92);
  color:#fff;font-weight:900;
  border:1px solid rgba(255,255,255,.18);
  box-shadow: 0 18px 50px rgba(2,6,23,.22);
  opacity:0;pointer-events:none;transition:.18s;
  max-width:92vw;
}
.toast.show{opacity:1}
.toast.ng{background: rgba(239,68,68,.92)}
a{color:#2563eb}
@media (min-width:860px){
  .card.half{grid-column: span 6;}
}
