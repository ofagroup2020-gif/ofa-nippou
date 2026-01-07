// config.js
// ===============================
// OFA Tenko App Config
// ===============================

// ✅ 共通ログイン（一般ドライバー）
export const DRIVER_PASS = "202601";

// ✅ 管理者パスワード
export const ADMIN_PASS = "ofa-2026";

// ✅ 拠点（必要に応じて追加）
export const BASES = ["鹿児島", "熊本", "福岡", "宮崎", "大分", "佐賀", "長崎", "その他"];

// ✅ 案件候補（必要に応じて追加）
export const JOBS = ["Amazon", "ヤマト", "佐川", "企業配", "スポット", "チャーター", "引越し", "その他"];

// ✅ Firebase設定（あなたの値）
export const firebaseConfig = {
  apiKey: "AIzaSyBe8GHuQepazPDF-dc9XvGlqVNMsdV913E",
  authDomain: "ofatenkoapp.firebaseapp.com",
  projectId: "ofatenkoapp",
  storageBucket: "ofatenkoapp.firebasestorage.app",
  messagingSenderId: "6840450594",
  appId: "1:6840450594:web:441bbb4e2e4be061a6547b"
};
