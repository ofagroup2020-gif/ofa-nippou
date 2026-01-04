// ★あなたのGAS WebアプリURL（/exec）
const GAS_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbz5Jfpy7D9x8ps7VQMXD01jK5YX9FX8q0KwRmxMZ6eyi9I9AKj39UnBsYFPjLg-qcZCHg/exec";

// ★パスワード（画面には表示しない）
// ※定期更新するならここだけ差し替え
const OFA_DRIVER_PASSWORD = "202601";
const OFA_ADMIN_PASSWORD  = "ofa-2026";

// 画像送信の最大（多すぎると失敗するので安全値）
const MAX_REPORT_PHOTOS = 3;          // 日報写真最大3枚
const IMAGE_MAX_SIDE = 1280;          // 圧縮最大辺
const IMAGE_QUALITY = 0.78;           // 圧縮率
