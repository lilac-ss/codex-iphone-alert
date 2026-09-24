# 開発・テスト・導入手順

## 開発

Node.js 22以降、npmを使用します。推奨は`.nvmrc`の24 LTSです。
`bin/`はCLI、`lib/`はMac処理、`native/`はSwiftの状態検出、`web/`はPWA、`test/`は自動テストです。

```sh
npm ci --ignore-scripts
npm test
npm run check
npm run build:native
npm run cli -- probe
```

テストはネットワーク・実端末・秘密情報・個人設定なしで実行できます。
checkは構文、公開一覧、相対パス、秘密情報パターンを検査し、distを作ります。
nativeビルドだけはMacが必要です。probeはlockedとcodexFrontの真偽値だけを出します。取得失敗はnullです。

アプリ同梱Node.js 24を使用する場合、Nodeコマンドを次の実行ファイルに置き換えられます。グローバル環境の更新は不要です。

```sh
"/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node" --version
"/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node" bin/alert.mjs status
```

## GitHub Pages

公開する10ファイルは次に固定しています。

```text
index.html style.css app.js sw.js manifest.webmanifest
icon.svg icon-180.png icon-192.png icon-512.png .nojekyll
```

1. テスト、check、git diff --checkを完了し、対象だけをコミットします。
2. GitHubの公開リポジトリでPagesのソースをGitHub Actionsに設定します。
3. pages.ymlはmainへのpushまたは手動実行で検証し、distだけを配信します。
4. HTTPS URL、manifest、service worker、画像を確認し、配信コミットと結果を記録します。

公開鍵はURLのfragmentだけで渡せます。購読情報や秘密鍵をリポジトリ変数・Actions Secrets・Pagesに登録しません。

## Macへの導入

```sh
npm run cli -- init --site https://YOUR-ACCOUNT.github.io/codex-iphone-alert/
npm run cli -- install
npm run cli -- status
npm run cli -- registration-url
```

installは導入直前の現行設定を読み直します。保存先は`~/Library/Application Support/codex-iphone-alert/`です。
--homeで変更できますが、Gitリポジトリ内は拒否します。initを繰り返しても鍵を再生成しません。

- runtime/へ実行ファイルと依存をコピーするため、worktreeがなくなっても動作します。
- backup/config-before.tomlとbackup/hooks-before.jsonはMac内だけに保存します。
- 元のnotifyと引数をintegration.jsonへ保存し、シェルを使わず呼び出します。
- ~/.codex/hooks.jsonへ非同期のPermissionRequestを1件追加します。
- ~/Library/LaunchAgents/local.codex-iphone-alert.plistを追加して起動します。
- hook無効設定があれば、勝手に有効にせず導入を中止します。
- CODEX_HOMEがある場合は、その環境の設定を使用します。

Codex CLIを起動して`/hooks`を入力し、追加された定義を本人が確認・信頼してください。

```sh
/Applications/ChatGPT.app/Contents/Resources/codex
```

その後、新しいセッションで確認します。以前の設定が残る場合は、安全な区切りでデスクトップアプリを再起動してください。
信頼保存ファイルの書き換えやhook信頼・承認方式の迂回は行いません。

## iPhone登録

1. registration-urlで表示したURLをSafariで開きます。
2. 共有→「ホーム画面に追加」。追加したアイコンで開きます。
3. 公開鍵が引き継がれなければ、URLの#key=より後を画面の欄へ保存します。
4. 「通知を有効にする」を押し、iOSの通知許可を選びます。
5. 「登録ファイルを共有」でAirDropします。

```sh
npm run cli -- import ~/Downloads/codex-alert-registration.json
npm run cli -- test
npm run cli -- status
```

1台分を保持し、再取り込みは置き換えます。ファイルは購読URLと鍵を含むため、ログへ貼らず、取り込み後にDownloadsや共有先から削除してください。
lastSend.ok=trueはAppleの受け付け結果であり、iPhoneへの到達確認ではありません。
404/410で無効化された購読は再登録・再取り込みします。

## 実機検証

端末・OS・条件・結果をVERIFICATION.mdへ記録します。

1. テスト通知、ロック画面の表示、設定に応じた音を確認。
2. Codexを背面にして実際に応答を完了させ、既存notifyとaccepted.completeを確認。
3. 承認が必要な通常の実作業でPermissionRequestの発火を確認。テストのために承認方式を変更しない。
4. 自動審査と人向け要求を区別して記録。一般の質問待ちは通知対象外。
5. 1分後の再通知、Macロック中の継続、解除してCodexを前面にした後の停止を確認。
6. probeで実際のロック・解除の両状態を確認。
7. 30分期限、スリープ復帰、再起動後の結果を必要に応じて確認。

## 停止・解除・更新

```sh
npm run cli -- stop
npm run cli -- uninstall
```

stopは現在の保留を対象とし、その後の新規イベントは受け付けます。
通常は1秒周期、通信待機中は最大10秒程度で処理します。送信済み通知は取り消せません。

解除は追加分だけを戻します。別のnotifyや無関係なhookの編集は維持します。
このツールの定義そのものが変更された場合は、黙って上書きせずエラーにします。
導入途中の失敗でもintegration.jsonとバックアップが残ります。uninstallで戻してから原因を直し、再導入します。

更新はテストとビルド後にuninstall→installを実行します。秘密鍵・端末情報は残ります。
installを繰り返すだけでは稼働中の実行ファイルを差し替えません。

worktreeがなくても、導入時のNode実行ファイルで以下を実行できます。

```sh
node "$HOME/Library/Application Support/codex-iphone-alert/runtime/bin/alert.mjs" uninstall
```

完全削除は解除とCodexへの反映後、Finderで保存先ディレクトリを削除します。
鍵を削除すると以前のiPhone登録には送信できなくなります。
