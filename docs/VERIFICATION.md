# 検証記録

## 自動検証（2026-09-24）

- npm test: 初回30件成功。外部通信なし、架空データのみ。
- Node.js 24.21.0で node --test test/*.test.mjs: 回帰テストを含む32件成功。
- npm run check: 構文、公開10ファイル、相対パス、秘密情報パターン検査成功。
- npm run build:native: Swiftビルド成功。
- npm audit --omit=dev: 既知の脆弱性0件（照会時点）。
- 周期、期限、重複、集約、抑止、停止、状態不明、再起動・復帰、時計後退、通信障害、無効購読、既存設定保持、導入・解除、公開範囲、可視通知を検証。

## Macで確認したこと

- Codexデスクトップ26.917.51856、同梱CLI 0.155.0-alpha.16。
- 既存notifyにComputer Use用turn-endedがあること。設定内容そのものは記録しない。
- 現行の承認方式を変更していない。
- 通常実行環境のprobeでcodexFront=true、locked=falseを確認。
- サンドボックスではnullになり、確認済みとしないこと。
- GitHub CLI認証はネットワーク制限外で成功。

## 配信・導入

- 公開リポジトリ: https://github.com/lilac-ss/codex-iphone-alert
- 公開PWA: https://lilac-ss.github.io/codex-iphone-alert/
- 初回配信コミット: 5b6bca1587e8701fae896d4acc84386959ab95f7
- [初回Actions](https://github.com/lilac-ss/codex-iphone-alert/actions/runs/35948014140): Linuxでテスト・検査・Pages配信が成功。
- 配信する9アセットのHTTPS 200とローカルビルドのSHA-256一致を確認。.nojekyllはビルドマーカーで直接取得は404。
- In-app Browserで幅390pxのレイアウトとホーム画面起動の案内を確認。iPhone実機の代替ではない。
- MacのLaunchAgent導入・状態更新を確認。登録端末はまだなし。
- 現行設定とバックアップを比較し、既存notifyの引き継ぎとそれ以外の設定不変を確認。
- 保存ディレクトリ0700、秘密情報・バックアップ0600、実行バイナリ0700を確認。
- 実環境でuninstallし、元config.tomlとの完全一致、追加hookとLaunchAgentの削除を確認してから再導入。
- 空白を含むApplication Support配下での補助実行ファイル解決を修正し、回帰テストを追加。
- daemonのロック扱いtrue・Codex前面falseが同時点の直接probeと一致。本人操作による解除後の停止は引き続き未確認。

## 未確認

- 実際のCodex完了イベントによる入口呼び出しと、既存notifyの実動作。
- 本人が信頼したPermissionRequest hookの実発火。
- 現行デスクトップでの自動審査と人向け承認要求の各発火条件。
- Macの実際のロック・解除遷移、スリープ復帰。
- iPhoneでの許可、登録、ロック画面への到達、音、1分後の再通知。
- 前面化後の追加送信停止。

AppleのHTTP成功や自動テスト成功を、iPhoneへの到達確認とは扱わない。
