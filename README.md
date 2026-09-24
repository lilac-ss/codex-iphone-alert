# Codex iPhone Alert

Codexの完了・承認要求をiPhoneへ知らせる、個人用のMac補助ツールと静的PWAです。
MacからApple Web Pushへ直接送信し、登録用サーバーや有料サービスは使いません。

通知は1分ごと、発生から30分未満まで。ロック解除したMacでCodexを前面にすると停止します。
本文は固定文と発生時刻だけです。

[公開PWA](https://lilac-ss.github.io/codex-iphone-alert/) / [検証・配信履歴](https://github.com/lilac-ss/codex-iphone-alert/actions)

## 導入

Node.js 22以降（推奨24 LTS）、macOS、Xcode Command Line Toolsを使用します。

```sh
npm ci --ignore-scripts
npm test
npm run check
npm run build:native
npm run cli -- init --site https://YOUR-ACCOUNT.github.io/codex-iphone-alert/
npm run cli -- install
```

表示された登録URLをiPhoneのSafariで開き、ホーム画面へ追加します。
追加したアイコンから「通知を有効にする」→「登録ファイルを共有」でAirDropします。
公開鍵が引き継がれない場合は、登録URLの`#key=`より後を画面の「公開鍵を設定」に貼り付けます。秘密鍵は入力しません。

```sh
npm run cli -- import ~/Downloads/codex-alert-registration.json
npm run cli -- test
npm run cli -- status
npm run cli -- stop
npm run cli -- uninstall
```

Codex標準の`/hooks`で追加したPermissionRequestを本人が確認・信頼し、新しいセッションを開始してください。
以前の設定が残る場合は、作業を終えてからCodexを再起動します。
導入は既存notify・hook・承認方式を保持し、解除は追加した部分だけを戻します。

## 制約と公開範囲

- iOS 16.4以降のホーム画面Webアプリが必要です。
- Macが起動し、スリープせず、ネットワークに接続している必要があります。
- 音はiPhoneの通知設定・集中モード・消音設定に従います。
- 自動審査される承認要求も通知され得ます。人の判断待ちだけを抽出する機能ではありません。
- 保留中の新しいイベントは次の1分の送信枠へ集約します。各イベントの30分期限は延長しません。
- 停止後も送信済み・配送中の通知が届く場合があります。

秘密鍵・端末登録情報・個人設定バックアップは`~/Library/Application Support/codex-iphone-alert/`に保存します。
ディレクトリは0700、状態ファイルは0600です。元のイベントpayload・会話・コマンドは保存しません。
既存notifyへの引数だけは、その動作を保つためそのまま転送します。

GitHub Pagesへ公開するのは`npm run build`が作る`dist/`内の10ファイルだけです。
公開鍵は登録URLのfragmentで渡します。秘密情報をPagesやGitへ含める必要はありません。

## 文書

- [確定計画](docs/PLAN.md)
- [実装上の決定](docs/ARCHITECTURE.md)
- [開発・導入・解除手順](docs/DEVELOPMENT.md)
- [検証記録](docs/VERIFICATION.md)
- [引き継ぎ](docs/HANDOFF.md)
