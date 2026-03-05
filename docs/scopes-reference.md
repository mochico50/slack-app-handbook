# スコープリファレンス

Slack App で使用する OAuth スコープの一覧と解説です。

## スコープとは

スコープ（Scope）は、Slack App が Slack ワークスペースで何を行えるかを定義する権限の単位です。必要最小限のスコープだけを設定する **最小権限の原則** を守りましょう。

## Bot Token Scopes と User Token Scopes

| 種類 | トークン形式 | 説明 |
|------|-------------|------|
| **Bot Token Scopes** | `xoxb-` | Bot ユーザーとして操作する。本ハンドブックではこちらを使用 |
| **User Token Scopes** | `xoxp-` | 特定のユーザーとして操作する。ユーザーの代わりに操作が必要な場合に使用 |

## 本ハンドブックで使用するスコープ一覧

### 必須スコープ

| スコープ | 用途 | 使用する機能 | 公式ドキュメント |
|---------|------|-------------|----------------|
| `chat:write` | Bot がメッセージを投稿する | 全機能（カレンダー通知・URL共有・Welcome） | [chat:write](https://api.slack.com/scopes/chat:write) |
| `commands` | Slash Commands を受信する | URL共有 | [commands](https://api.slack.com/scopes/commands) |

### 推奨スコープ

| スコープ | 用途 | 使用する機能 | 公式ドキュメント |
|---------|------|-------------|----------------|
| `users:read` | ユーザー情報を取得する | Welcome メッセージ（ユーザー名の取得など） | [users:read](https://api.slack.com/scopes/users:read) |
| `channels:read` | パブリックチャンネルの情報を取得する | チャンネル名の表示など | [channels:read](https://api.slack.com/scopes/channels:read) |

### イベント関連（自動付与）

Event Subscriptions でイベントを購読すると、以下のスコープが自動的に追加されます：

| スコープ | 用途 | 対応イベント |
|---------|------|-------------|
| `channels:read` | パブリックチャンネルの `member_joined_channel` を受信 | `member_joined_channel` |
| `groups:read` | プライベートチャンネルの `member_joined_channel` を受信 | `member_joined_channel` |

## スコープの設定方法

1. [https://api.slack.com/apps](https://api.slack.com/apps) でアプリを選択
2. **「OAuth & Permissions」** → **「Scopes」** セクション
3. **「Bot Token Scopes」** の **「Add an OAuth Scope」** をクリック
4. スコープ名を入力して選択

## スコープ変更時の注意

### 再インストールが必要

スコープを追加・削除した場合、アプリをワークスペースに再インストールする必要があります。

1. **「OAuth & Permissions」** ページ上部に警告バナーが表示される
2. **「reinstall your app」** をクリック
3. 権限を確認して **「許可する」** をクリック

> ⚠️ 再インストールすると **Bot Token が変わる場合があります。** その場合は ScriptProperties のトークンも更新してください。

### 最小権限の原則

必要のないスコープは設定しないようにしましょう。理由：

- **セキュリティ**: トークンが漏洩した場合の被害範囲を最小化できる
- **信頼性**: ユーザーがアプリをインストールする際に、過剰な権限を要求しない
- **レビュー**: Slack App Directory に公開する場合、過剰なスコープはレビューで指摘される

## 各 API メソッドと必要なスコープの対応表

| API メソッド | 必要なスコープ | 本ハンドブックでの使用箇所 |
|-------------|--------------|------------------------|
| `chat.postMessage` | `chat:write` | 全機能 |
| `views.open` | （スコープ不要、trigger_id で認証） | Slash Commands |
| `users.info` | `users:read` | Welcome メッセージ |
| `auth.test` | （トークンがあれば呼べる） | 動作確認 |

## 参考リンク

- [Slack API スコープ一覧](https://api.slack.com/scopes)
- [OAuth & Permissions について](https://api.slack.com/authentication/oauth-v2)
- [Bot Token vs User Token](https://api.slack.com/authentication/token-types)
