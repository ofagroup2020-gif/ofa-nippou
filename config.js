// config.js（必ずプロジェクト直下 / ファイル名は config.js 固定）

// ✅ あなたの最新 WebApp URL（/exec）
const EXEC_URL = "https://script.google.com/macros/s/AKfycbx6wYurFfhn4s3vUY7I8kEq0n-6ZZUrdg-vXxSrLcEVd3jObhWj72_A-b-XB6sH6CpWaw/exec";

// ✅ ログイン用（フロント完結）
const PASS_DRIVER = "202601";
const PASS_ADMIN  = "ofa-2026";

// ✅ ローカルストレージキー
const LS_SESSION_ROLE = "ofa_session_role";   // "driver" | "admin"
const LS_SESSION_PASS = "ofa_session_ok";     // "1" のときログインOK
const LS_LAST_DRIVER  = "ofa_last_driver";    // 最後の氏名
