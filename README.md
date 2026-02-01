# OFA 点呼 / 日報（ドライバー & 管理者）

## できること
- ドライバー
  - 基本情報保存（端末内のみ）
  - 出発点呼 / 帰着点呼 保存
  - 日報（任意）保存
  - 今日のPDF（点呼＋日報）出力
  - 履歴タップで「その日のPDF」再生成（写真は含まれません）
  - 期間指定で「自分の月報（期間PDF）」出力
  - CSV（全履歴）出力
- 管理者（この端末のみ）
  - 期間・拠点・氏名・電話で検索（氏名 or 電話が必須）
  - 検索結果のCSV出力
  - 検索結果から月報PDF出力

## 注意
- データは IndexedDB（端末内）に保存されます。サーバー送信しません。
- iPhoneでPDF保存後は「ファイル」→「共有」からLINE送信推奨。

## GitHub Pages
- ルート：`index.html`
- 管理：`/admin/index.html`

## アップロード
GitHubで zip をアップロードしても **展開されません**。  
必ず「展開した中身（index.html / js / admin / style.css）」をそのまま配置してください。

最短は以下：
- PC：git clone → コピペ → commit/push
- iPhone：Working Copy（gitアプリ）で clone → 追加 → push
- もしくは Codespaces（Web VS Code）で zip をアップして展開 → commit/push
