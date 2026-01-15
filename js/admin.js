// js/admin.js

function $(id){ return document.getElementById(id); }
function toast(m){ alert(m); }

function getAdminPass(){
  return localStorage.getItem("ofa_admin_pass") || "ofa-admin";
}

function checkPass(input){
  return input === getAdminPass();
}

function showPanel(ok){
  $("adminPanel").classList.toggle("hidden", !ok);
}

async function monthlySearch(){
  const from = $("m_from").value;
  const to   = $("m_to").value;
  if(!from || !to){
    toast("期間（開始/終了）は必須です");
    return [];
  }
  const filters = {
    from, to,
    base: $("m_base").value.trim(),
    name: $("m_name").value.trim()
  };
  const groups = await searchMonthly(filters);
  renderMonthly(groups, filters);
  // store last
  window.__monthly_last = { groups, filters };
  return groups;
}

function renderMonthly(groups, filters){
  const list = $("monthlyList");
  list.innerHTML = "";

  const info = document.createElement("div");
  info.className="note";
  info.innerHTML = `検索結果：<b>${groups.length} グループ</b>　期間：${filters.from} ～ ${filters.to}`;
  list.appendChild(info);

  groups.forEach(g=>{
    const card = document.createElement("div");
    card.className="card";
    card.style.boxShadow="none";
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap">
        <div style="font-weight:900">${g.name} / ${g.base}</div>
        <div class="badge">点呼 ${g.tenko.length} / 日報 ${g.daily.length}</div>
      </div>
      <div class="small">※月報PDFは「月報PDFを作成」で一括出力</div>
    `;
    list.appendChild(card);
  });
}

window.addEventListener("DOMContentLoaded", ()=>{
  $("btnAdminLogin").addEventListener("click", ()=>{
    const pass = $("a_pass").value;
    if(!checkPass(pass)){
      toast("管理者パスが違います");
      showPanel(false);
      return;
    }
    toast("管理者ログインOK");
    showPanel(true);

    // デフォルト期間：今月
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth()+1).padStart(2,"0");
    const first = `${yyyy}-${mm}-01`;
    const last  = new Date(yyyy, d.getMonth()+1, 0).toISOString().slice(0,10);
    $("m_from").value = first;
    $("m_to").value = last;
  });

  $("btnChangePass").addEventListener("click", ()=>{
    const current = prompt("現在の管理者パスを入力");
    if(current===null) return;
    if(!checkPass(current)){
      toast("現在パスが違います");
      return;
    }
    const next = prompt("新しい管理者パス（8文字以上推奨）");
    if(!next) return;
    localStorage.setItem("ofa_admin_pass", next);
    toast("管理者パスを変更しました");
  });

  $("btnMonthlySearch").addEventListener("click", monthlySearch);

  $("btnMonthlyCsv").addEventListener("click", async ()=>{
    await monthlySearch();
    const last = window.__monthly_last;
    if(!last){ toast("先に検索してください"); return; }

    // CSV：検索条件を使って点呼/日報まとめて出す
    await exportCsvSearchResult(last.filters);
    toast("CSVを出力しました");
  });

  $("btnMonthlyPdf").addEventListener("click", async ()=>{
    await monthlySearch();
    const last = window.__monthly_last;
    if(!last){ toast("先に検索してください"); return; }

    await generateMonthlyPdf(last.groups, last.filters);
    toast("月報PDFを出力しました");
  });
});
