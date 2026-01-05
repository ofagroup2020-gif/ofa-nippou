// ===== OFA Web点呼 設定 =====

// ★あなたの最新 WebApp /exec URL（ここが違うと送信/出力が全部失敗します）
const EXEC_URL = "https://script.google.com/macros/s/AKfycbx6wYurFfhn4s3vUY7I8kEq0n-6ZZUrdg-vXxSrLcEVd3jObhWj72_A-b-XB6sH6CpWaw/exec";

// ローカル保存キー（名前/車両を保持）
const LS_LAST_NAME    = "ofa_last_name";
const LS_LAST_VEHICLE = "ofa_last_vehicle";

// セッション（簡易ログイン）
const LS_SESSION_ROLE = "ofa_role";     // "driver" or "admin"
const LS_SESSION_PASS = "ofa_pass_ok";  // "1"

// パスワード（画面に表示しない。LINE公式で配布して定期更新）
const PASS_DRIVER = "202601";     // ★ここだけ定期更新
const PASS_ADMIN  = "ofa-2026";   // ★ここも必要なら更新

// 送信タイムアウト（秒）
const FETCH_TIMEOUT_SEC = 30;
