// app.js
document.addEventListener("DOMContentLoaded", () => {
  // 共通
  if ($("#backBtn")) $("#backBtn").addEventListener("click", () => (location.href = "./index.html"));

  // ログイン必須
  if (document.body.dataset.page === "departure" || document.body.dataset.page === "arrival") {
    auth.requireAnyLogin();
  }
  if (typeof renderLoginState === "function") renderLoginState();

  // 初期値
  if ($("#date")) $("#date").value = todayISO();
  if ($("#time")) $("#time").value = nowTime();

  // 出発点呼
  if (document.body.dataset.page === "departure") {
    $("#btnSubmit").addEventListener("click", async () => {
      try {
        const data = await collectDeparture();
        toast("送信中…", "info");
        const r = await sender.submitRecord("departure", data);
        toast("送信完了", "ok");
        // 送信後トップへ
        location.href = "./index.html";
      } catch (e) {
        toast(e.message || String(e), "error");
      }
    });
  }

  // 帰着点呼
  if (document.body.dataset.page === "arrival") {
    $("#btnSubmit").addEventListener("click", async () => {
      try {
        const data = await collectArrival();
        toast("送信中…", "info");
        const r = await sender.submitRecord("arrival", data);
        toast("送信完了", "ok");
        location.href = "./index.html";
      } catch (e) {
        toast(e.message || String(e), "error");
      }
    });
  }
});

function must(v, label) {
  if (!safeVal(v)) throw new Error(`${label} は必須です`);
  return safeVal(v);
}

async function collectDeparture() {
  const data = {
    date: must($("#date").value, "日付"),
    time: must($("#time").value, "時刻"),
    driverName: must($("#driverName").value, "氏名"),
    vehicleNo: must($("#vehicleNo").value, "車両番号"),
    managerName: must($("#managerName").value, "点呼実施者"),
    method: must($("#method").value, "点呼方法"),
    place: must($("#place").value, "点呼場所"),

    // 点呼項目（増量）
    temperature: safeVal($("#temperature").value),
    sleepHours: must($("#sleepHours").value, "睡眠時間"),
    condition: must($("#condition").value, "体調"),
    fatigue: must($("#fatigue").value, "疲労の有無"),
    medicine: must($("#medicine").value, "服薬の有無"),
    drivingRisk: must($("#drivingRisk").value, "運転支障"),
    goNogo: must($("#goNogo").value, "運行可否"),
    instructions: safeVal($("#instructions").value),

    // アルコール
    alcoholValue: must($("#alcoholValue").value, "アルコール数値"),
    alcoholBand: must($("#alcoholBand").value, "酒気帯び判定"),

    // 免許
    licenseNo: must($("#licenseNo").value, "免許証番号"),

    memo: safeVal($("#memo").value),

    photos: {
      alcohol: [],
      license: [],
      tenko: [],
      report: [], // 出発は使わない
    },
  };

  // 写真（任意）
  const a = $("#alcoholPhoto");
  if (a?.files?.length) data.photos.alcohol = await pickFilesAsDataURLs(a);

  const l = $("#licensePhoto");
  if (l?.files?.length) data.photos.license = await pickFilesAsDataURLs(l);

  const t = $("#tenkoPhoto");
  if (t?.files?.length) data.photos.tenko = await pickFilesAsDataURLs(t);

  return data;
}

async function collectArrival() {
  const data = {
    date: must($("#date").value, "日付"),
    time: must($("#time").value, "時刻"),
    driverName: must($("#driverName").value, "氏名"),
    vehicleNo: must($("#vehicleNo").value, "車両番号"),
    managerName: must($("#managerName").value, "点呼実施者"),
    method: must($("#method").value, "点呼方法"),
    place: must($("#place").value, "点呼場所"),

    // 点呼項目（終了）
    restHours: must($("#restHours").value, "休憩時間"),
    fatigue: must($("#fatigue").value, "疲労の有無"),
    abnormal: must($("#abnormal").value, "異常の有無"),
    goNogo: must($("#goNogo").value, "運行可否"),
    memo: safeVal($("#memo").value),

    // アルコール
    alcoholValue: must($("#alcoholValue").value, "アルコール数値"),
    alcoholBand: must($("#alcoholBand").value, "酒気帯び判定"),

    // 免許
    licenseNo: must($("#licenseNo").value, "免許証番号"),

    // 日報（必須）
    workType: must($("#workType").value, "業務内容"),
    workArea: must($("#workArea").value, "配送エリア"),
    workHours: must($("#workHours").value, "稼働時間"),
    deliveryCount: safeVal($("#deliveryCount").value),
    trouble: safeVal($("#trouble").value),
    dailyNote: safeVal($("#dailyNote").value),

    photos: {
      alcohol: [],
      license: [],
      tenko: [],
      report: [], // 日報写真のみ
    },
  };

  const a = $("#alcoholPhoto");
  if (a?.files?.length) data.photos.alcohol = await pickFilesAsDataURLs(a);

  const l = $("#licensePhoto");
  if (l?.files?.length) data.photos.license = await pickFilesAsDataURLs(l);

  // tenkoPhotoはこのページでは無し（必要なら追加してOK）

  const r = $("#reportPhotos");
  if (r?.files?.length) data.photos.report = await pickFilesAsDataURLs(r);

  return data;
}
