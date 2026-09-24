# 実装上の決定（2026-09-24）

## イベントと承認

完了はnotifyのagent-turn-completeだけを使い、Stopへ置き換えません。
既存notifyは引数をそのまま、spawnの引数配列・shell:falseで転送します。
Push通信はLaunchAgentで実行し、Codexを待たせません。

PermissionRequestはasync:true、標準出力なしの補助処理です。許可・拒否や入力の書き換えは行いません。
公式仕様は自動審査との違いを入力項目として保証していません。
調査時の公開tools/approvals.rsはhook→自動審査またはユーザーの順序でした。
これは公開mainの確認であり、インストール済みバイナリの全経路を実測した証明ではありません。
固定文は計画どおり「承認要求が発生しました」とし、人の判断待ちだけだとは表示しません。

参照: [notify](https://learn.chatgpt.com/docs/config-file/config-advanced#notifications)、[hooks](https://learn.chatgpt.com/docs/hooks)、[公開承認フロー](https://github.com/openai/codex/blob/main/codex-rs/core/src/tools/approvals.rs)

## 保存と重複

payloadはメモリ上で解析するだけです。会話、コマンド、cwd、transcriptを読み出し・保存しません。
完了はthread/turn、承認はsession/turn/tool名（存在すればtool_use_idも）をローカルのランダム鍵でHMAC化します。
キューへ残すのはHMAC、種別、受信時刻、Mac状態の真偽値だけです。
PermissionRequestはtool_use_idを保証しないため、その場合は同ターン・同ツールの複数要求をまとめます。
tool_inputは重複判定にも使いません。重複記録は24時間保持し、確認後も同じイベントを再開しません。

所有者用ディレクトリへ原子的に書き、対象ファイルのsymlinkを拒否します。
単一daemonが再送状態を書き、入口はファイルキューへ書きます。受信ポート・HTTPサーバー・リモート操作経路はありません。

## 周期と境界

- 通常1秒の確認周期で初回送信。
- 全タスクで1分に1回の送信枠へ集約。その間の新規イベントは次の枠へ含める。
- 期限は各イベントの受信から30分。期限ちょうどは送らず、単独なら初回＋29回が上限。
- 新規イベントや重複で既存期限を延長しない。
- 本文は最大2種類の固定文と、各種類の最新の発生時刻だけ。
- TTLは最大60秒、最も近い保留期限を超えない秒数へ短縮。
- 通信前に送信枠を保存。失敗も次の枠まで待つ。
- 再起動・復帰時は期限切れを破棄し、過去分を連続送信しない。
- 時計後退は保留を破棄して寿命の延長を防ぐ。

## Mac状態

SwiftからAppKitの前面bundle IDとCoreGraphicsのセッション辞書を取得します。対象はcom.openai.codexです。
ウィンドウ名、タスク内容、画像、Accessibility権限を使いません。
ロックの明示、コンソール非アクティブ、loginwindow前面はロック扱いです。
ロックキー省略時は、コンソール上・ログイン完了が両方trueのときだけ解除扱いにします。
macOSの観測に基づく条件で、非公開の辞書キーが将来変わる可能性はあります。
取得失敗・不完全な状態はnullとし、解除かつCodex前面が確認できた場合だけ停止します。
実際のロック・解除遷移は実機での検証が必要です。

## Appleへの送信

Apple公式のhttps://*.push.apple.com制約に従い、サブドメイン境界を検証します。
HTTP、資格情報付きURL、別ポート、fragment、任意ホストを拒否します。
登録時にサイト・VAPID公開鍵の一致と、P-256公開鍵・認証鍵の形式を検査します。
リダイレクトは追いません。404/410は登録を無効化し、その他は次の枠まで待ちます。

暗号化と署名は固定版web-pushを使用します。HTTPS transportはNode標準で10秒の絶対期限・応答サイズ制限を設けます。
JWTは送信先originごとに1時間キャッシュし、有効期限は12時間です。
HTTP本文・エラー全文・購読URL・鍵をログやstatusへ出しません。

参照: [Apple仕様](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers)、[web-push](https://github.com/web-push-libs/web-push)

## PWA

外部JavaScript・解析・登録APIはありません。manifestとservice workerは相対パスです。
ユーザーのクリックから直接PushManager.subscribeを呼びます。
公開鍵はURL fragmentからブラウザへ保存し、購読情報はユーザーの共有操作で書き出します。サイトへPOSTしません。

全pushを可視通知にし、不正payloadでも固定文を表示します。任意の本文やURLは表示しません。
tagとTopicは固定、renotify:trueです。再通知音はiOS実機で確認する必要があります。
タップはPWAを開くだけで、Macへ停止を送信しません。

参照: [iOS Web Push](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)
