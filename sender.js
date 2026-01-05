// sender.js
window.sender = {
  async postJSON(payload) {
    const url = window.OFA_CONFIG.GAS_EXEC_URL;
    if (!url) throw new Error("GAS_EXEC_URL が未設定です（config.js）");

    // GASはCORSが環境で詰まることがあるので、必ずJSONで返す前提のdoPostに統一
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });

    // ここでres.ok=falseになるならGAS側エラー
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error("サーバー応答がJSONではありません: " + text.slice(0, 120));
    }
    if (!json.ok) throw new Error(json.error || "送信に失敗しました");
    return json;
  },

  async submitRecord(type, data) {
    // type: "departure" | "arrival"
    if (!type) throw new Error("missing type");

    return this.postJSON({
      action: "submit",
      type,
      data,
    });
  },

  async exportDailyPdf(driverName, dateISO) {
    return this.postJSON({
      action: "exportDailyPdf",
      driverName,
      dateISO,
    });
  },

  async exportMonthlyCsv(driverName, ym) {
    return this.postJSON({
      action: "exportMonthlyCsv",
      driverName,
      ym,
    });
  },

  async exportMonthlyPdf(driverName, ym) {
    return this.postJSON({
      action: "exportMonthlyPdf",
      driverName,
      ym,
    });
  },

  async adminSearch(filters) {
    return this.postJSON({
      action: "search",
      filters,
    });
  },
};
