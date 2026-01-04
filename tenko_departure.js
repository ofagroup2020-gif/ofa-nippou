(async function(){
  const s = Auth.getSession();
  const loginState = document.getElementById("loginState");
  const badgeMode = document.getElementById("badgeMode");
  if(!s){
    loginState.textContent = "未ログイン：トップでログインしてください";
    badgeMode.className="badge gray"; badgeMode.textContent="未ログイン";
  }else{
    loginState.textContent = "ログイン済み";
    badgeMode.textContent = (s.role==="admin" ? "管理者" : "ドライバー");
    badgeMode.className = "badge " + (s.role==="admin" ? "red" : "green");
  }

  const dateEl = document.getElementById("date");
  const timeEl = document.getElementById("time");
  fillNow(dateEl, timeEl);

  document.getElementById("btnSubmit").onclick = async ()=>{
    try{
      Auth.requireLogin();

      const get = (id)=> (document.getElementById(id)?.value || "").trim();
      const must = (id, name)=>{
        const v = get(id);
        if(!v) throw new Error(`${name} は必須です`);
        return v;
      };

      // 必須
      const payload = {
        action: "saveDeparture",
        ts: Date.now(),
        date: must("date","日付"),
        time: must("time","時刻"),
        driverName: must("driverName","運転者氏名"),
        vehicleNo: must("vehicleNo","車両番号"),
        managerName: must("managerName","点呼実施者"),
        sleepHours: must("sleepHours","睡眠時間"),
        condition: must("condition","体調"),
        alcoholValue: must("alcoholValue","アルコール測定値"),
        alcoholBand: must("alcoholBand","酒気帯び"),
        licenseNo: must("licenseNo","免許番号"),

        // 任意
        driverPhone: get("driverPhone"),
        tenko: {
          med: must("tenko_med","疾病/服薬"),
          fatigue: must("tenko_fatigue","疲労/眠気"),
          drink: must("tenko_drink","飲酒"),
          licenseCarry: must("tenko_licenseCarry","免許携帯"),
          instruction: must("tenko_instruction","運行指示確認"),
          weather: must("tenko_weather","天候/道路確認"),
          memo: (document.getElementById("tenkoMemo").value||"").trim()
        },
        inspection: {
          tire: must("insp_tire","タイヤ"),
          light: must("insp_light","灯火"),
          brake: must("insp_brake","ブレーキ"),
          wiper: must("insp_wiper","ワイパー"),
          engineOil: must("insp_engineOil","エンジンオイル"),
          coolant: must("insp_coolant","冷却水"),
          battery: must("insp_battery","バッテリー"),
          horn: must("insp_horn","ホーン"),
          mirror: must("insp_mirror","ミラー"),
          damage: must("insp_damage","外装/破損"),
          cargo: must("insp_cargo","積載状態"),
          extinguisher: must("insp_extinguisher","消火器"),
          triangle: must("insp_triangle","三角停止板"),
          note: (document.getElementById("insp_note").value||"").trim()
        },
        photos: {}
      };

      toast("写真処理中…（任意）");
      // 写真（任意）
      const alcoholFile = document.getElementById("alcoholPhoto").files[0];
      if(alcoholFile){
        try{ payload.photos.alcoholPhoto = await fileToBase64Jpeg(alcoholFile, 1100, 0.72); }catch(e){}
      }
      const licenseFile = document.getElementById("licensePhoto").files[0];
      if(licenseFile){
        try{ payload.photos.licensePhoto = await fileToBase64Jpeg(licenseFile, 1100, 0.72); }catch(e){}
      }
      const abnormalFile = document.getElementById("abnormalPhoto").files[0];
      if(abnormalFile){
        try{ payload.photos.abnormalPhoto = await fileToBase64Jpeg(abnormalFile, 1280, 0.72); }catch(e){}
      }

      toast("送信中…");
      await GasSender.post(payload);
      toast("送信完了：トップへ戻ります");
      setTimeout(()=> location.href="./index.html", 900);

    }catch(err){
      toast("送信失敗：" + (err?.message || err));
    }
  };
})();
