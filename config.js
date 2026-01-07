// config.js
export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBe8GHuQepazPDF-dc9XvGlqVNMsdV913E",
  authDomain: "ofatenkoapp.firebaseapp.com",
  projectId: "ofatenkoapp",
  storageBucket: "ofatenkoapp.firebasestorage.app",
  messagingSenderId: "6840450594",
  appId: "1:6840450594:web:441bbb4e2e4be061a6547b"
};

// 共通ログイン運用（推奨）
// ドライバー：各自のメールで「新規登録」→ パスワードは共通 "202601"
// 管理者：ofa.group2020@gmail.com（このメールは自動で admin 扱い）
export const DRIVER_DEFAULT_PASSWORD_HINT = "202601";

// 管理者モード用（フロント側）
// ※Firestore Rules でも admin email による保護を入れる（後述）
export const ADMIN_FRONT_PASS = "ofa-2026";
export const ADMIN_EMAIL = "ofa.group2020@gmail.com";

// 拠点（必要なら増やしてOK）
export const BASES = ["鹿児島", "熊本", "福岡", "宮崎", "大分", "佐賀", "長崎", "沖縄", "その他"];

// 案件テンプレ（追加・編集OK）
export const PROJECT_PRESETS = ["Amazon", "ヤマト", "佐川", "企業配", "スポット", "チャーター", "その他"];
