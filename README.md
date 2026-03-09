# Slack App Handbook

## このリポジトリについて

Slack App を活用するためのナレッジベースです。

GAS（Google Apps Script）から Slack API を利用する際の手順・設計パターン・トラブルシューティングなどをドキュメントとしてまとめています。

## ドキュメント一覧

### 基礎編

| ドキュメント | 概要 |
|-------------|------|
| [Slack App の初期設定](docs/slack-app-setup.md) | Slack App の作成・Bot Token 取得・スコープ設定・インストール |
| [GAS と Slack API の連携](docs/gas-slack-integration.md) | GAS から Slack API を叩く基本（UrlFetchApp・トークン管理） |
| [Block Kit によるメッセージ装飾](docs/message-formatting.md) | Block Kit を使ったリッチなメッセージの組み立て方 |

### 機能別ガイド

| ドキュメント | 概要 |
|-------------|------|
| [Google Calendar → Slack 定期通知](features/scheduled-notification/README.md) | GAS トリガーで Google Calendar の予定を毎日 Slack に通知する |
| [Slash Commands + Modal でURL共有](docs/slash-commands.md) | スラッシュコマンドからフォームを起動し、記事URLを共有する |
| [Welcome メッセージの自動送信](features/welcome-message/README.md) | 新メンバーがワークスペースに参加したら Welcome メッセージを送る |

### 補足・リファレンス

| ドキュメント | 概要 |
|-------------|------|
| [スコープリファレンス](docs/scopes-reference.md) | OAuth スコープの一覧と権限の解説 |
| [トラブルシューティング](docs/troubleshooting.md) | よくあるエラーと対処法 |

## リポジトリ構成

```
slack-app-handbook/
├── README.md                # このファイル
├── docs/                    # ガイドライン・手順書
│   ├── slack-app-setup.md
│   ├── gas-slack-integration.md
│   ├── message-formatting.md
│   ├── slash-commands.md
│   ├── scopes-reference.md
│   └── troubleshooting.md
└── features/                # 機能別ガイド + ソースコード
    ├── scheduled-notification/
    │   ├── README.md
    │   └── app.js
    └── welcome-message/
        ├── README.md
        └── app.js
```

## コントリビューション

Issue や Pull Request はお気軽にどうぞ。
