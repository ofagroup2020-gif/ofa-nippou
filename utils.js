function val(id){
  const el=document.getElementById(id);
  return (el && el.value!=null) ? String(el.value).trim() : "";
}
function must(id,label){
  const v=val(id);
  if(!v) throw new Error(label+" は必須です");
  return v;
}

function todayISO(){
  const d=new Date();
  const y=d.getFullYear();
  const m=String(d.getMonth()+1).padStart(2,"0");
  const day=String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}
function nowTime(){
  const d=new Date();
  const hh=String(d.getHours()).padStart(2,"0");
  const mm=String(d.getMinutes()).padStart(2,"0");
  return `${hh}:${mm}`;
}

async function postJSON(body){
  const controller = new AbortController();
  const timer = setTimeout(()=>controller.abort(), (FETCH_TIMEOUT_SEC||30)*1000);

  try{
    const res = await fetch(EXEC_URL, {
      method:"POST",
      headers:{ "Content-Type":"text/plain;charset=utf-8" },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    const text = await res.text();

    let json;
    try{
      json = JSON.parse(text);
    }catch(e){
      throw new Error("サーバー応答が不正です（JSONではありません）");
    }

    if(!json.ok){
      throw new Error(json.error || "送信失敗");
    }
    return json;
  }catch(e){
    if(String(e.name)==="AbortError"){
      throw new Error("通信がタイムアウトしました（電波状況を確認）");
    }
    throw e;
  }finally{
    clearTimeout(timer);
  }
}
