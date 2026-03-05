# Slack App の初期設定

Slack App を作成し、Bot Token を取得してワークスペースにインストールするまでの手順を解説します。

## このドキュメントのゴール

- Slack App を新規作成できる
- Bot Token（`xoxb-`）を取得できる
- 必要なスコープを設定できる
- ワークスペースにインストールできる

## 前提条件

- Slack ワークスペースへのアクセス権があること
- アプリの作成・インストール権限があること（ワークスペースの設定による）

## Slack App の作成

### 1. Slack API サイトにアクセス

[https://api.slack.com/apps](https://api.slack.com/apps) にアクセスし、Slack アカウントでログインします。

### 2. 新しいアプリを作成

1. **「Create New App」** をクリック
2. **「From scratch」** を選択
3. 以下を入力：
   - **App Name**: アプリの名前（例：`My First Bot`）
   - **Pick a workspace**: インストール先のワークスペースを選択
4. **「Create App」** をクリック

作成が完了すると、アプリの **Basic Information** ページに遷移します。

## Bot Token の取得

### 1. OAuth & Permissions ページへ移動

左サイドバーから **「OAuth & Permissions」** をクリックします。

### 2. Bot Token Scopes を追加

**「Scopes」** セクションまでスクロールし、**「Bot Token Scopes」** の **「Add an OAuth Scope」** をクリックします。

本ハンドブックの3つの機能で必要な主要スコープ：

| スコープ | 用途 |
|---------|------|
| `chat:write` | メッセージの投稿（全機能で使用） |
| `commands` | Slash Commands の受信 |
| `users:read` | ユーザー情報の取得（Welcome メッセージ） |

> 💡 スコープの詳細は [スコープリファレンス](scopes-reference.md) を参照してください。

### 3. ワークスペースにインストール

1. ページ上部の **「Install to Workspace」**（または **「Reinstall to Workspace」**）をクリック
2. 権限の確認画面で **「許可する」** をクリック
3. インストールが完了すると **Bot User OAuth Token** が表示されます

表示されるトークンは `xoxb-` で始まる文字列です。このトークンを使って Slack API を呼び出します。

> ⚠️ **トークンは秘密情報です。** Git リポジトリにコミットしたり、他人に共有しないでください。GAS での安全な管理方法は [GAS と Slack API の連携](gas-slack-integration.md) で解説します。

## アプリをチャンネルに追加する

Bot がチャンネルにメッセージを投稿するには、そのチャンネルに Bot を招待する必要があります。

### 方法1: Slack のチャンネルから追加

1. 対象のチャンネルを開く
2. チャンネル名をクリック → **「インテグレーション」** タブ
3. **「アプリを追加する」** からアプリを検索して追加

### 方法2: メンションで招待

チャンネルで `@アプリ名` とメンションすると、招待の確認メッセージが表示されます。

## 確認してみよう

ここまでの設定が正しくできているか確認します。ターミナルまたはブラウザから以下の API を叩いてみましょう。

```
https://slack.com/api/auth.test
```

**curl での確認例：**

```bash
curl -X POST https://slack.com/api/auth.test \
  -H "Authorization: Bearer xoxb-your-token-here"
```

以下のようなレスポンスが返れば成功です：

```json
{
  "ok": true,
  "url": "https://your-workspace.slack.com/",
  "team": "Your Workspace",
  "user": "your-bot-name",
  "team_id": "T0XXXXXXX",
  "user_id": "U0XXXXXXX",
  "bot_id": "B0XXXXXXX"
}
```

`"ok": false` が返る場合は [トラブルシューティング](troubleshooting.md) を確認してください。

## まとめ

このドキュメントでは以下を行いました：

- ✅ Slack App を新規作成
- ✅ Bot Token Scopes を設定
- ✅ ワークスペースにインストールして Bot Token を取得
- ✅ Bot をチャンネルに追加
- ✅ auth.test で動作確認

**次のステップ →** [GAS と Slack API の連携](gas-slack-integration.md)
