# GAS と Slack API の連携

GAS（Google Apps Script）から Slack API を呼び出す基本的な方法を解説します。

## このドキュメントのゴール

- GAS プロジェクトを作成できる
- トークンを安全に管理できる
- GAS から Slack API にリクエストを送信できる
- エラーハンドリングの基本を理解できる

## 前提条件

- Google アカウントを持っていること
- [Slack App の初期設定](slack-app-setup.md) が完了していること（Bot Token を取得済み）

## GAS プロジェクトの作成

### 1. Google Apps Script エディタを開く

[https://script.google.com](https://script.google.com) にアクセスし、**「新しいプロジェクト」** をクリックします。

### 2. プロジェクトの種類

GAS には2種類のプロジェクトがあります：

| 種類 | 説明 | 使いどころ |
|------|------|-----------|
| **スタンドアロン** | 単独で動作するスクリプト | Slack 通知 Bot など |
| **コンテナバインド** | スプレッドシート等に紐づくスクリプト | シートのデータを Slack に送る場合 |

本ハンドブックでは**スタンドアロン**を前提に進めます。Google Calendar の予定を取得する場合もスタンドアロンで問題ありません。

## トークンの安全な管理

### ⚠️ やってはいけないこと

```javascript
// ❌ トークンをコードに直書きしない
const TOKEN = "xoxb-1234567890-abcdefg";
```

トークンをソースコードに直接書くと、Git にコミットした際に漏洩するリスクがあります。

### ✅ ScriptProperties を使う

GAS にはスクリプト単位でキーバリューを保存できる `PropertiesService` があります。

#### トークンを保存する（初回のみ）

GAS エディタのメニューから **「プロジェクトの設定」**（歯車アイコン）を開き、**「スクリプト プロパティ」** セクションで以下を追加します：

| プロパティ | 値 |
|-----------|-----|
| `SLACK_BOT_TOKEN` | `xoxb-your-token-here` |

#### コードからトークンを取得する

```javascript
/**
 * ScriptProperties から Slack Bot Token を取得する
 * @returns {string} Bot Token
 */
function getSlackToken() {
  const token = PropertiesService.getScriptProperties().getProperty("SLACK_BOT_TOKEN");
  if (!token) {
    throw new Error("SLACK_BOT_TOKEN が設定されていません。プロジェクトの設定を確認してください。");
  }
  return token;
}
```

## Slack API へのリクエスト

### UrlFetchApp の基本

GAS では `UrlFetchApp.fetch()` を使って HTTP リクエストを送信します。

### chat.postMessage でメッセージを投稿する

最もよく使う API です。指定したチャンネルにメッセージを投稿します。

```javascript
/**
 * Slack チャンネルにメッセージを投稿する
 * @param {string} channel - チャンネルID（例: "C0XXXXXXX"）
 * @param {string} text - 投稿するテキスト
 */
function postMessage(channel, text) {
  const token = getSlackToken();
  const url = "https://slack.com/api/chat.postMessage";

  const payload = {
    channel: channel,
    text: text
  };

  const options = {
    method: "post",
    headers: {
      "Authorization": "Bearer " + token,
      "Content-Type": "application/json; charset=UTF-8"
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(url, options);
  const result = JSON.parse(response.getContentText());

  if (!result.ok) {
    throw new Error("Slack API エラー: " + result.error);
  }

  return result;
}
```

### 動作確認

以下の関数を作成して実行してみましょう：

```javascript
function testPostMessage() {
  // チャンネルIDは Slack のチャンネル詳細から確認できます
  const channelId = "C0XXXXXXX";
  const result = postMessage(channelId, "Hello from GAS! 🎉");
  console.log(result);
}
```

> 💡 **チャンネルID の確認方法**: Slack でチャンネル名をクリック → 一番下に表示される `C` で始まる文字列がチャンネルIDです。

## エラーハンドリング

### muteHttpExceptions の役割

`muteHttpExceptions: true` を指定すると、HTTP エラー（4xx, 5xx）が発生してもスクリプトが停止しません。レスポンスの内容を確認してエラー処理を行えます。

### Slack API のエラーレスポンス

Slack API はエラー時も HTTP 200 を返しますが、レスポンスの `ok` フィールドが `false` になります：

```json
{
  "ok": false,
  "error": "channel_not_found"
}
```

### よくあるエラーコード

| エラーコード | 原因 | 対処 |
|-------------|------|------|
| `not_authed` | トークンが設定されていない | ScriptProperties を確認 |
| `invalid_auth` | トークンが無効 | トークンを再発行 |
| `channel_not_found` | チャンネルIDが間違っている or Bot が未参加 | ID を確認し、Bot をチャンネルに招待 |
| `missing_scope` | 必要なスコープが不足 | [スコープリファレンス](scopes-reference.md) を参照 |

より詳しいエラーと対処法は [トラブルシューティング](troubleshooting.md) を参照してください。

## まとめ

このドキュメントでは以下を行いました：

- ✅ GAS プロジェクトを作成
- ✅ ScriptProperties でトークンを安全に管理
- ✅ `UrlFetchApp` で Slack API にリクエスト送信
- ✅ `chat.postMessage` でメッセージ投稿
- ✅ エラーハンドリングの基本

**次のステップ →** [Block Kit によるメッセージ装飾](message-formatting.md)
