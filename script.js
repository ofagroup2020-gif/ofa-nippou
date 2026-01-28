/* ==========================
   OFA Vehicle Report - UI
   ========================== */

const LINE_URL = "https://lin.ee/ZsC6sxs"; // ←最終URLここだけ変更OK

// 47都道府県（簡易コード）
const PREFS = [
  ["北海道","01"],["青森県","02"],["岩手県","03"],["宮城県","04"],["秋田県","05"],["山形県","06"],["福島県","07"],
  ["茨城県","08"],["栃木県","09"],["群馬県","10"],["埼玉県","11"],["千葉県","12"],["東京都","13"],["神奈川県","14"],
  ["新潟県","15"],["富山県","16"],["石川県","17"],["福井県","18"],["山梨県","19"],["長野県","20"],["岐阜県","21"],
  ["静岡県","22"],["愛知県","23"],["三重県","24"],["滋賀県","25"],["京都府","26"],["大阪府","27"],["兵庫県","28"],
  ["奈良県","29"],["和歌山県","30"],["鳥取県","31"],["島根県","32"],["岡山県","33"],["広島県","34"],["山口県","35"],
  ["徳島県","36"],["香川県","37"],["愛媛県","38"],["高知県","39"],["福岡県","40"],["佐賀県","41"],["長崎県","42"],
  ["熊本県","43"],["大分県","44"],["宮崎県","45"],["鹿児島県","46"],["沖縄県","47"]
];

// 日常点検15項目
const DAILY_CHECKS = [
  "ウインド・ウォッシャ液の量",
  "ブレーキ液の量",
  "バッテリー液の量",
  "冷却水の量",
  "エンジンオイルの量",
  "タイヤの空気圧",
  "タイヤの亀裂、損傷および異状な摩耗",
  "タイヤの溝の深さ",
  "ランプ類の点灯、点滅およびレンズの汚れ、損傷",
  "ブレーキ・ペダルの踏みしろおよびブレーキの利き",
  "パーキング・ブレーキ・レバーの引きしろ",
  "ウインド・ウォッシャの噴射状態",
  "ワイパの拭き取りの状態",
  "エンジンのかかり具合および異音",
  "エンジンの低速および加速の状態",
];

const state = {
  type: "loan", // loan / return / inspect
  photos: {},   // groupId -> [ {name, dataUrl} ...]
  check: new Array(15).fill(false),
  pdfBlob: null,
  pdfName: null,
};

// 写真グループ定義（見やすさ最優先で“まとめ入力”に）
function buildPhotoGroupDefs(type){
  // 共通（貸出/返却/点検）
  const common = [
    { id:"license", title:"運転免許証（写真）", need:1, accept:"image/*", capture:"environment", desc:"免許証が読めるように撮影してください。" },
    { id:"shaken", title:"車検証（自動車検査証）", need:1, accept:"image/*", capture:"environment", desc:"車検証全体が写るように撮影してください。" },
    { id:"oil", title:"オイルステッカー", need:1, accept:"image/*", capture:"environment", desc:"次回交換目安が読めるように撮影してください。" },
    { id:"carViews", title:"車両写真（外観 4枚）", need:4, accept:"image/*", capture:"environment", desc:"前方/後方/左側面/右側面（まとめて4枚添付）" },
    { id:"load", title:"荷台（後ろから）", need:1, accept:"image/*", capture:"environment", desc:"荷台全体が見える写真を添付してください。" },
    { id:"meter", title:"メーター（走行距離）", need:1, accept:"image/*", capture:"environment", desc:"走行距離が読めるように撮影してください。" },
    { id:"fuelMeter", title:"燃料計（メーター内）", need:1, accept:"image/*", capture:"environment", desc:"給油状況確認用（メーター内）" },
  ];

  // 追加：貸出/返却にタイヤ4箇所
  const tires = { id:"tires", title:"タイヤ4箇所", need:4, accept:"image/*", capture:"environment", desc:"左前/右前/左後/右後（まとめて4枚添付）" };

  // 車両状態記録（凹み/傷/室内/荷室など） 5枚
  const condition = { id:"condition", title:"状態記録（必要部位 5枚）", need:5, accept:"image/*", capture:"environment", desc:"傷・凹み・室内・荷室・気になる箇所（まとめて5枚添付）" };

  if(type === "inspect"){
    // 定期点検：タイヤ/状態も含める（点検は必須扱い）
    return [...common, tires, condition];
  }
  // 貸出/返却：タイヤ4箇所＋状態記録も入れる
  return [...common, tires, condition];
}

// ============ DOM ============
const $ = (id)=>document.getElementById(id);

document.addEventListener("DOMContentLoaded", ()=>{
  initHeaderClock();
  initPrefSelect();
  initTabs();
  initChecks();
  initSignPad();
  initLine();
  initBottomBarAutoHide();
  initHardReload();

  rebuildPhotosUI();
  regenIds();
  updateProgressAll();

  $("btnMakePdf").addEventListener("click", onMakePdf);
  $("btnDownload").addEventListener("click", onDownloadPdf);
  $("btnShareLine").addEventListener("click", onShareLine);
});

// ========= ヘッダー時計 =========
function initHeaderClock(){
  const el = $("nowText");
  const tick = ()=>{
    const d = new Date();
    const y = d.getFullYear();
    const mo = String(d.getMonth()+1).padStart(2,"0");
    const da = String(d.getDate()).padStart(2,"0");
    const hh = String(d.getHours()).padStart(2,"0");
    const mm = String(d.getMinutes()).padStart(2,"0");
    el.textContent = `${y}/${mo}/${da} ${hh}:${mm}`;
    $("createdAt").value = `${y}-${mo}-${da} ${hh}:${mm}`;
  };
  tick();
  setInterval(tick, 1000*15);
}

function initPrefSelect(){
  const sel = $("pref");
  sel.innerHTML = `<option value="">選択</option>` + PREFS.map(([name,code])=>`<option value="${name}" data-code="${code}">${name}</option>`).join("");
  sel.addEventListener("change", ()=>{
    const opt = sel.selectedOptions[0];
    const code = opt?.dataset?.code || "";
    $("prefCode").value = code ? `OFA-${code}` : "";
    regenIds();
    updateProgressAll();
  });
}

// ========= タブ =========
function initTabs(){
  document.querySelectorAll(".tab").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const next = btn.dataset.type;
      if(next === state.type) return;

      // 切替時：全リセット（要望通り）
      if(!confirm("タブを切り替えると入力内容は全てリセットされます。よろしいですか？")) return;

      state.type = next;
      state.photos = {};
      state.check = new Array(15).fill(false);
      state.pdfBlob = null;
      state.pdfName = null;

      // UI reset
      document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active", b.dataset.type===next));
      document.querySelectorAll("input,textarea,select").forEach(el=>{
        if(el.id === "manageNo" || el.id==="createdAt" || el.id==="prefCode") return;
        if(el.type==="checkbox") el.checked = false;
        else if(el.tagName==="SELECT") el.value = "";
        else el.value = "";
      });
      $("agree").checked = false;
      clearSign();

      rebuildPhotosUI();
      initChecks(true);
      regenIds();
      updateProgressAll();
      toast("タブを切り替えました（入力リセット）");
    });
  });
}

// ========= 管理番号 =========
function regenIds(){
  const prefCode = $("pref").selectedOptions[0]?.dataset?.code || "00";
  const now = new Date();
  const y = now.getFullYear();
  const mo = String(now.getMonth()+1).padStart(2,"0");
  const da = String(now.getDate()).padStart(2,"0");
  const hh = String(now.getHours()).padStart(2,"0");
  const mm = String(now.getMinutes()).padStart(2,"0");
  const ss = String(now.getSeconds()).padStart(2,"0");
  const rand = Math.random().toString(16).slice(2,6).toUpperCase();
  const manage = `OFA-${prefCode}-${y}${mo}${da}-${hh}${mm}${ss}-${rand}`;
  $("manageNo").value = manage;
}

// ========= 点検リスト =========
function initChecks(force=false){
  const wrap = $("checkList");
  if(!wrap || force) wrap.innerHTML = "";

  DAILY_CHECKS.forEach((txt, i)=>{
    const div = document.createElement("label");
    div.className = "checkItem";
    div.innerHTML = `
      <input type="checkbox" data-i="${i}">
      <div class="txt"><span class="no">${i+1}.</span>${txt}</div>
    `;
    wrap.appendChild(div);
  });

  wrap.querySelectorAll("input[type=checkbox]").forEach(cb=>{
    cb.addEventListener("change", ()=>{
      const i = Number(cb.dataset.i);
      state.check[i] = cb.checked;
      updateCheckProgress();
    });
  });

  // 定期点検以外は任意表示に（ただしPDFには出す）
  const need = (state.type==="inspect");
  $("dailyCheckCard").querySelector(".hint").textContent =
    need
      ? "※定期点検では必須です。点検した項目にチェックしてください。"
      : "※任意（定期点検では必須）。必要に応じてチェックしてください。";

  updateCheckProgress();
}

function updateCheckProgress(){
  const done = state.check.filter(Boolean).length;
  $("checkProgress").textContent = `${done} / 15`;
}

// ========= 写真UI（グループ入力） =========
function rebuildPhotosUI(){
  const container = $("photoGroups");
  container.innerHTML = "";

  const defs = buildPhotoGroupDefs(state.type);
  defs.forEach(def=>{
    const card = document.createElement("div");
    card.className = "groupCard";

    const count = (state.photos[def.id]?.length || 0);
    card.innerHTML = `
      <div class="groupHead">
        <div>
          <div class="groupTitle">${def.title} <span class="req">必須</span></div>
          <div class="groupDesc">${def.desc || ""}</div>
        </div>
        <div class="groupMeta" id="meta_${def.id}">${count}/${def.need} 添付</div>
      </div>

      <div class="uploadRow">
        <input class="hiddenInput" id="file_${def.id}" type="file"
          ${def.need>1 ? "multiple" : ""}
          accept="${def.accept}"
        />
        <button class="upBtn" type="button" data-open="${def.id}">写真を追加</button>
        <button class="upBtn" type="button" data-clear="${def.id}">このグループをクリア</button>
      </div>

      <div class="thumbGrid" id="thumb_${def.id}"></div>
    `;

    container.appendChild(card);

    const file = card.querySelector(`#file_${def.id}`);
    // iPhoneで背面カメラ起動（効く時だけ）
    if(def.capture) file.setAttribute("capture", def.capture);

    card.querySelector(`[data-open="${def.id}"]`).addEventListener("click", ()=>file.click());
    card.querySelector(`[data-clear="${def.id}"]`).addEventListener("click", ()=>{
      state.photos[def.id] = [];
      file.value = "";
      renderThumbs(def.id);
      updateProgressAll();
    });

    file.addEventListener("change", async ()=>{
      const files = Array.from(file.files || []);
      if(!files.length) return;

      // 既存＋追加
      const prev = state.photos[def.id] || [];
      const all = [...prev];

      for(const f of files){
        const dataUrl = await fileToDataURL(f);
        all.push({ name: f.name || "image.jpg", dataUrl });
      }

      // 最大need枚に丸め（超えたら古い順にカット）
      const trimmed = all.slice(0, def.need);
      state.photos[def.id] = trimmed;

      // need枚まで届いてない場合はファイル入力を残して追加できるように
      renderThumbs(def.id);
      updateProgressAll();
    });

    // 初期描画
    renderThumbs(def.id);
  });

  updateProgressAll();
}

function renderThumbs(groupId){
  const defs = buildPhotoGroupDefs(state.type);
  const def = defs.find(d=>d.id===groupId);
  const list = state.photos[groupId] || [];
  const meta = $(`meta_${groupId}`);
  const grid = $(`thumb_${groupId}`);

  if(meta) meta.textContent = `${list.length}/${def.need} 添付`;
  if(!grid) return;

  grid.innerHTML = "";
  list.forEach((p, idx)=>{
    const div = document.createElement("div");
    div.className = "thumb";
    div.innerHTML = `
      <img src="${p.dataUrl}" alt="">
      <div class="cap">#${idx+1}</div>
    `;
    grid.appendChild(div);
  });

  // 空き枠のプレースホルダ（見やすく）
  const remain = Math.max(0, def.need - list.length);
  for(let i=0;i<remain;i++){
    const div = document.createElement("div");
    div.className = "thumb";
    div.innerHTML = `
      <div style="height:110px;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-weight:900;">
        未添付
      </div>
      <div class="cap">残り ${remain - i} 枚</div>
    `;
    grid.appendChild(div);
  }
}

function updateProgressAll(){
  const defs = buildPhotoGroupDefs(state.type);
  const needTotal = defs.reduce((a,d)=>a+d.need,0);
  const doneTotal = defs.reduce((a,d)=>a+((state.photos[d.id]?.length)||0),0);
  $("photoProgress").textContent = `${doneTotal} / ${needTotal}`;
}

// ========= 署名 =========
let sign = { ctx:null, drawing:false, has:false, last:null };

function initSignPad(){
  const canvas = $("signPad");
  const ctx = canvas.getContext("2d");
  sign.ctx = ctx;
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#0f172a";

  const getPos = (e)=>{
    const rect = canvas.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    return { x: (t.clientX - rect.left) * (canvas.width / rect.width),
             y: (t.clientY - rect.top) * (canvas.height / rect.height) };
  };

  const start = (e)=>{
    e.preventDefault();
    sign.drawing = true;
    sign.has = true;
    sign.last = getPos(e);
  };
  const move = (e)=>{
    if(!sign.drawing) return;
    e.preventDefault();
    const p = getPos(e);
    ctx.beginPath();
    ctx.moveTo(sign.last.x, sign.last.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    sign.last = p;
  };
  const end = (e)=>{
    if(!sign.drawing) return;
    e.preventDefault();
    sign.drawing = false;
  };

  canvas.addEventListener("mousedown", start);
  canvas.addEventListener("mousemove", move);
  window.addEventListener("mouseup", end);

  canvas.addEventListener("touchstart", start, {passive:false});
  canvas.addEventListener("touchmove", move, {passive:false});
  canvas.addEventListener("touchend", end, {passive:false});

  $("btnClearSign").addEventListener("click", clearSign);
}

function clearSign(){
  const canvas = $("signPad");
  const ctx = sign.ctx;
  ctx.clearRect(0,0,canvas.width, canvas.height);
  sign.has = false;
  toast("署名をクリアしました");
}

function getSignDataUrl(){
  if(!sign.has) return null;
  return $("signPad").toDataURL("image/png", 1.0);
}

// ========= LINE =========
function initLine(){
  const a = $("lineLink");
  a.href = LINE_URL;
}

function onShareLine(){
  // PDFがあるなら共有を案内（iPhoneはWebから直接LINE送付が制限される場合があるためURL共有に寄せる）
  if(state.pdfBlob){
    toast("PDFは保存後、共有からLINEへ送れます");
  }else{
    toast("まずPDFを作成してください");
  }
  window.open(LINE_URL, "_blank");
}

// ========= 下メニュー自動退避 =========
function initBottomBarAutoHide(){
  const bar = $("bottomBar");
  let timer = null;

  const hide = ()=>{
    bar.classList.add("hide");
    clearTimeout(timer);
  };
  const show = ()=>{
    clearTimeout(timer);
    timer = setTimeout(()=>bar.classList.remove("hide"), 150);
  };

  // 入力フォーカス中は隠す（要望）
  document.addEventListener("focusin", (e)=>{
    const t = e.target;
    if(t && (t.tagName==="INPUT" || t.tagName==="TEXTAREA" || t.tagName==="SELECT")){
      hide();
    }
  });
  document.addEventListener("focusout", (e)=>{
    const t = e.target;
    if(t && (t.tagName==="INPUT" || t.tagName==="TEXTAREA" || t.tagName==="SELECT")){
      show();
    }
  });

  // スクロール中も邪魔なら薄く（必要なら使う）
  // window.addEventListener("scroll", ()=>{});
}

// ========= キャッシュ対策ボタン =========
function initHardReload(){
  $("btnHardReload").addEventListener("click", ()=>{
    const url = new URL(location.href);
    url.searchParams.set("v", String(Date.now()));
    location.href = url.toString();
  });
}

// ========= PDF作成 =========
function validateAll(){
  const required = [
    ["pref","拠点（都道府県）"],
    ["plateNo","車両ナンバー"],
    ["vin","車体番号（車台番号）"],
    ["odometer","走行距離"],
    ["fuel","給油状況"],
    ["userName","利用者氏名"],
    ["email","契約用メールアドレス"],
  ];

  for(const [id,label] of required){
    const el = $(id);
    const v = (el.value||"").trim();
    if(!v){
      toast(`未入力：${label}`);
      el.scrollIntoView({behavior:"smooth", block:"center"});
      el.focus?.();
      return false;
    }
  }

  const defs = buildPhotoGroupDefs(state.type);
  for(const d of defs){
    const got = state.photos[d.id]?.length || 0;
    if(got < d.need){
      toast(`写真不足：${d.title}（${got}/${d.need}）`);
      // 該当セクションへ
      $("photoGroups").scrollIntoView({behavior:"smooth", block:"start"});
      return false;
    }
  }

  // 定期点検はチェック必須
  if(state.type === "inspect"){
    const done = state.check.filter(Boolean).length;
    if(done < 15){
      toast(`定期点検：未チェックがあります（${done}/15）`);
      $("dailyCheckCard").scrollIntoView({behavior:"smooth", block:"start"});
      return false;
    }
  }

  if(!$("agree").checked){
    toast("状態確認（同意）にチェックしてください");
    $("agree").scrollIntoView({behavior:"smooth", block:"center"});
    return false;
  }

  if(!sign.has){
    toast("署名してください");
    $("signPad").scrollIntoView({behavior:"smooth", block:"center"});
    return false;
  }

  return true;
}

async function onMakePdf(){
  try{
    if(!validateAll()) return;

    toast("PDF生成中…（iPhoneは少し時間がかかります）");

    // PDF用のHTMLを組み立て
    const data = collectData();
    buildPdfStage(data);

    // PDF生成（画像化→A4自動改ページ）
    const { blob, filename } = await window.OFA_PDF.makeA4PdfFromStage({
      stageId: "pdfStage",
      filenameBase: `OFA-${jpTypeLabel(state.type)}-${data.manageNo}`
    });

    state.pdfBlob = blob;
    state.pdfName = filename;

    toast("PDF作成完了！「PDFダウンロード」または共有してください");
  }catch(e){
    console.error(e);
    toast("PDF作成に失敗しました（写真サイズが大きすぎる可能性）");
  }
}

function onDownloadPdf(){
  if(!state.pdfBlob){
    toast("まずPDFを作成してください");
    return;
  }
  const url = URL.createObjectURL(state.pdfBlob);
  const a = document.createElement("a");
  a.href = url;
  a.download = state.pdfName || "report.pdf";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 2000);
}

function collectData(){
  return {
    type: state.type,
    typeLabel: jpTypeLabel(state.type),
    manageNo: $("manageNo").value.trim(),
    createdAt: $("createdAt").value.trim(),
    pref: $("pref").value,
    prefCode: $("prefCode").value,
    plateNo: $("plateNo").value.trim(),
    vin: $("vin").value.trim(),
    odometer: $("odometer").value.trim(),
    fuel: $("fuel").value,
    userName: $("userName").value.trim(),
    email: $("email").value.trim(),
    note: $("note").value.trim(),
    checks: DAILY_CHECKS.map((t,i)=>({ no:i+1, text:t, ok: !!state.check[i] })),
    photos: state.photos,
    signDataUrl: getSignDataUrl(),
  };
}

function buildPdfStage(data){
  const stage = $("pdfStage");
  stage.innerHTML = "";

  const defs = buildPhotoGroupDefs(state.type);

  stage.appendChild(elHtml(`
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
      <div style="display:flex;align-items:center;gap:10px;">
        <div style="width:42px;height:42px;border-radius:14px;background:#ffd400;display:flex;align-items:center;justify-content:center;font-weight:900;">OFA</div>
        <div>
          <div style="font-weight:900;font-size:16px;">OFA GROUP</div>
          <div style="color:#64748b;font-size:12px;">株式会社OFA 車両管理</div>
        </div>
      </div>
      <div style="color:#334155;font-weight:900;font-size:12px;">${escapeHtml(data.createdAt)}</div>
    </div>

    <div style="border:1px solid #e5e7eb;border-left:8px solid #ffd400;border-radius:16px;padding:14px;margin-bottom:12px;">
      <div style="font-weight:900;font-size:18px;margin-bottom:6px;">車両報告書（${escapeHtml(data.typeLabel)}）</div>
      <div style="color:#475569;font-size:12px;line-height:1.6;">
        本書は貸出 / 返却 / 定期点検 の記録をPDFとして提出するものです（端末内でPDF生成）。
      </div>
    </div>

    <div style="border:1px solid #e5e7eb;border-left:8px solid #3b82f6;border-radius:16px;padding:14px;margin-bottom:12px;">
      <div style="font-weight:900;margin-bottom:10px;">基本情報</div>
      ${kv("管理番号", data.manageNo)}
      ${kv("作成日時", data.createdAt)}
      ${kv("拠点（都道府県）", data.pref)}
      ${kv("拠点コード", data.prefCode)}
      ${kv("車両ナンバー", data.plateNo)}
      ${kv("車体番号（車台番号）", data.vin)}
      ${kv("走行距離（km）", data.odometer)}
      ${kv("給油状況", data.fuel)}
      ${kv("利用者氏名", data.userName)}
      ${kv("契約用メール", data.email)}
      ${data.note ? kv("備考", data.note) : ""}
    </div>
  `));

  // 写真（グループ別に並べる：PDFは見やすさ最優先）
  defs.forEach(def=>{
    const arr = data.photos[def.id] || [];
    stage.appendChild(elHtml(`
      <div style="border:1px solid #e5e7eb;border-left:8px solid #ffd400;border-radius:16px;padding:14px;margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px;">
          <div style="font-weight:900;">${escapeHtml(def.title)}</div>
          <div style="font-weight:900;color:#1d4ed8;font-size:12px;background:#eef2ff;border:1px solid #c7d2fe;padding:6px 10px;border-radius:999px;">
            ${arr.length}/${def.need}
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(2, 1fr);gap:10px;">
          ${arr.map((p,i)=>`
            <div style="border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;">
              <div style="font-weight:900;font-size:12px;padding:8px 10px;background:#f8fafc;border-bottom:1px solid #eef2f7;">#${i+1}</div>
              <img src="${p.dataUrl}" style="width:100%;height:220px;object-fit:cover;display:block;">
            </div>
          `).join("")}
        </div>
      </div>
    `));
  });

  // 日常点検（PDFでは表形式）
  stage.appendChild(elHtml(`
    <div style="border:1px solid #e5e7eb;border-left:8px solid #3b82f6;border-radius:16px;padding:14px;margin-bottom:12px;">
      <div style="font-weight:900;margin-bottom:10px;">日常点検（15項目）</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        ${data.checks.map(c=>`
          <div style="border:1px solid #e5e7eb;border-radius:14px;padding:10px;display:flex;gap:10px;align-items:flex-start;">
            <div style="font-weight:900;min-width:28px;">${c.ok ? "☑" : "□"}</div>
            <div style="font-size:12px;line-height:1.5;">
              <span style="color:#64748b;font-weight:900;">${c.no}.</span>
              ${escapeHtml(c.text)}
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  `));

  // 署名（右下に小さく）
  stage.appendChild(elHtml(`
    <div style="border:1px solid #e5e7eb;border-left:8px solid #22c55e;border-radius:16px;padding:14px;margin-bottom:12px;">
      <div style="font-weight:900;margin-bottom:10px;">署名</div>
      <div style="display:flex;justify-content:flex-end;">
        <div style="width:260px;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;">
          <div style="font-size:12px;font-weight:900;padding:8px 10px;background:#f8fafc;border-bottom:1px solid #eef2f7;">署名（右下）</div>
          <img src="${data.signDataUrl}" style="width:100%;height:110px;object-fit:contain;background:#fff;display:block;">
        </div>
      </div>
    </div>
  `));
}

// PDF用小物
function kv(k,v){
  return `
    <div style="display:flex;gap:10px;padding:6px 0;border-bottom:1px dashed #e2e8f0;">
      <div style="width:160px;color:#64748b;font-weight:900;font-size:12px;">${escapeHtml(k)}</div>
      <div style="font-weight:900;font-size:12px;color:#0f172a;word-break:break-word;">${escapeHtml(v||"")}</div>
    </div>
  `;
}

function jpTypeLabel(t){
  if(t==="loan") return "貸出";
  if(t==="return") return "返却";
  return "定期点検";
}

function elHtml(html){
  const d = document.createElement("div");
  d.innerHTML = html.trim();
  return d.firstElementChild;
}

function escapeHtml(s){
  return String(s||"")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function fileToDataURL(file){
  return new Promise((resolve,reject)=>{
    const r = new FileReader();
    r.onload = ()=>resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

// ========= トースト =========
let toastTimer = null;
function toast(msg){
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>t.classList.remove("show"), 2200);
}
