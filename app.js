// ★ここをあなたの GAS URL に必ず変更
const GAS_URL = "https://script.google.com/macros/s/AKfycbwY_n12SABO4nvwpoyNZU8AVepuLtogwer_D1hEmvS_p5KQiq32MvJ0FaRPOBI6khbvnQ/exec";

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("tenkoForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const result = document.getElementById("result");
    result.textContent = "送信中…";

    const formData = new FormData(form);

    // ★安全確認（type が無い事故を防ぐ）
    if (!formData.get("type")) {
      result.textContent = "エラー：type がありません";
      return;
    }

    try {
      const res = await fetch(GAS_URL, {
        method: "POST",
        body: formData
      });

      const text = await res.text();
      result.textContent = "送信成功：" + text;
    } catch (err) {
      result.textContent = "送信失敗：" + err.message;
    }
  });
});
