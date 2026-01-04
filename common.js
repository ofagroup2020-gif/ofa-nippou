function showToast(msg){
  const t = document.getElementById('toast');
  if(!t) return alert(msg);
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), 2400);
}

function v(id){
  const el = document.getElementById(id);
  return el ? (el.value || '').trim() : '';
}

function requireLogin(){
  const role = sessionStorage.getItem('ofa_role');
  if(!role){
    location.href = './index.html';
    return;
  }
}

function requireAdmin(){
  requireLogin();
  const role = sessionStorage.getItem('ofa_role');
  if(role !== 'admin'){
    location.href = './home.html';
  }
}

function initPageCommon(){
  const role = sessionStorage.getItem('ofa_role');
  const s = document.getElementById('loginState');
  const b = document.getElementById('badgeMode');
  if(s) s.textContent = role === 'admin' ? '管理者ログイン中' : 'ログイン済';
  if(b) b.textContent = role === 'admin' ? '管理者' : 'ドライバー';

  // 今日の日付/時刻を初期化（未入力時のみ）
  const d = document.getElementById('date');
  const t = document.getElementById('time');
  const now = new Date();
  if(d && !d.value){
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth()+1).padStart(2,'0');
    const dd = String(now.getDate()).padStart(2,'0');
    d.value = `${yyyy}-${mm}-${dd}`;
  }
  if(t && !t.value){
    const hh = String(now.getHours()).padStart(2,'0');
    const mi = String(now.getMinutes()).padStart(2,'0');
    t.value = `${hh}:${mi}`;
  }
}
