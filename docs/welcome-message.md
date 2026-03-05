# 新メンバーへの Welcome メッセージを自動送信する

チャンネルに新しいメンバーが参加したときに、自動で Welcome メッセージを送信する仕組みを解説します。

## 完成イメージ

```
👋 ようこそ！
──────────────────
@new-member さん、チャンネルへようこそ！
わからないことがあれば気軽に質問してくださいね 😄
──────────────────
💡 まずは自己紹介をしてみましょう！
```

## 前提条件

- [Slack App の初期設定](slack-app-setup.md) が完了していること
- [GAS と Slack API の連携](gas-slack-integration.md) が完了していること
- GAS が Web App として公開されていること（[Slash Commands ガイド](slash-commands.md) の「GAS を Web App として公開する」を参照）

## 全体の流れ

```
メンバーがチャンネルに参加
    ↓
Slack → GAS (doPost) に member_joined_channel イベントを送信
    ↓
GAS → Slack API (chat.postMessage) で Welcome メッセージを投稿
```

## Event Subscriptions の設定

### 1. Event Subscriptions を有効にする

1. [https://api.slack.com/apps](https://api.slack.com/apps) でアプリを選択
2. 左サイドバーの **「Event Subscriptions」** をクリック
3. **「Enable Events」** を **On** に切り替え

### 2. Request URL を設定する

**Request URL** に GAS の Web App URL を入力します。

入力すると Slack が URL Verification リクエストを送信します。これに応答するために、まず GAS 側のコードを準備する必要があります。

### 3. URL Verification に対応する

Slack は Request URL の設定時に、以下のような JSON を POST します：

```json
{
  "type": "url_verification",
  "challenge": "abc123xyz",
  "token": "xxxxx"
}
```

GAS はこの `challenge` の値をそのまま返す必要があります。

```javascript
function doPost(e) {
  // JSON ボディがある場合（Event Subscriptions）
  if (e.postData && e.postData.type === "application/json") {
    var body = JSON.parse(e.postData.contents);

    // URL Verification への応答
    if (body.type === "url_verification") {
      return ContentService.createTextOutput(body.challenge);
    }

    // イベントの処理
    if (body.type === "event_callback") {
      return handleEvent(body);
    }
  }

  // form-urlencoded の場合（Slash Commands / Interactivity）
  var params = e.parameter;

  if (params.command) {
    return handleSlashCommand(params);
  }

  if (params.payload) {
    var payload = JSON.parse(params.payload);
    if (payload.type === "view_submission") {
      return handleViewSubmission(payload);
    }
  }

  return ContentService.createTextOutput("OK");
}
```

> 💡 **Slash Commands と Event Subscriptions の共存**: Slash Commands は `application/x-www-form-urlencoded`、Event Subscriptions は `application/json` で送信されるため、`Content-Type` で判別できます。

コードを更新したら **再デプロイ** してから Request URL を入力してください。「Verified ✓」と表示されれば成功です。

### 4. 購読するイベントを追加

**「Subscribe to bot events」** セクションで以下のイベントを追加します：

| イベント名 | 説明 |
|-----------|------|
| `member_joined_channel` | メンバーがチャンネルに参加した時 |

> 💡 `team_join` はワークスペース全体への参加イベントです。特定チャンネルへの参加を検知したい場合は `member_joined_channel` を使います。

### 5. アプリを再インストール

イベントを追加すると、追加のスコープが必要になる場合があります。ページ上部に警告が表示されたら **「reinstall your app」** をクリックして再インストールしてください。

## イベントを処理する

### イベントペイロードの構造

`member_joined_channel` イベントのペイロード：

```json
{
  "type": "event_callback",
  "event": {
    "type": "member_joined_channel",
    "user": "U0XXXXXXX",
    "channel": "C0XXXXXXX",
    "team": "T0XXXXXXX",
    "event_ts": "1234567890.123456"
  }
}
```

### イベントハンドラー

```javascript
/**
 * Slack イベントを処理する
 */
function handleEvent(body) {
  var event = body.event;

  if (event.type === "member_joined_channel") {
    handleMemberJoined(event);
  }

  return ContentService.createTextOutput("OK");
}

/**
 * メンバー参加イベントを処理し、Welcome メッセージを送信する
 */
function handleMemberJoined(event) {
  var userId = event.user;
  var channelId = event.channel;

  // Bot 自身の参加は無視する
  var botUserId = PropertiesService.getScriptProperties().getProperty("BOT_USER_ID");
  if (userId === botUserId) {
    return;
  }

  var blocks = buildWelcomeBlocks(userId);
  postBlockMessage(channelId, blocks, "ようこそ！");
}
```

> 💡 **Bot 自身の参加を無視する**: Bot がチャンネルに追加された時も `member_joined_channel` が発火します。無限ループを防ぐため、Bot 自身のユーザーIDを `BOT_USER_ID` として ScriptProperties に保存し、チェックしましょう。Bot のユーザーIDは `auth.test` API のレスポンスで確認できます。

### Welcome メッセージの組み立て

```javascript
/**
 * Welcome メッセージの Block Kit を組み立てる
 */
function buildWelcomeBlocks(userId) {
  return [
    {
      type: "header",
      text: { type: "plain_text", text: "👋 ようこそ！" }
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "<@" + userId + "> さん、チャンネルへようこそ！\nわからないことがあれば気軽に質問してくださいね 😄"
      }
    },
    { type: "divider" },
    {
      type: "context",
      elements: [
        { type: "mrkdwn", text: "💡 まずは自己紹介をしてみましょう！" }
      ]
    }
  ];
}
```

## リトライへの対処

Slack は GAS が 3 秒以内に応答しない場合、同じイベントを最大 3 回リトライします。リトライ時にはヘッダーに `X-Slack-Retry-Num` が含まれます。

重複送信を防ぐには、リトライリクエストを検知してスキップします：

```javascript
function doPost(e) {
  // リトライの場合はスキップ
  if (e.parameter["X-Slack-Retry-Num"]) {
    return ContentService.createTextOutput("OK");
  }

  // ... 以下通常の処理
}
```

> ⚠️ GAS では HTTP ヘッダーへのアクセスが制限されているため、上記の方法が機能しない場合があります。確実に重複を防ぎたい場合は、CacheService を使ってイベントID（`event_ts`）を一時保存し、重複チェックを行う方法があります。

### CacheService を使った重複チェック

```javascript
/**
 * イベントの重複を検知する
 * @param {string} eventTs - イベントのタイムスタンプ
 * @returns {boolean} true: 重複（すでに処理済み）
 */
function isDuplicate(eventTs) {
  var cache = CacheService.getScriptCache();
  var cached = cache.get("event_" + eventTs);

  if (cached) {
    return true;
  }

  // 10分間キャッシュ（リトライの間隔を十分カバー）
  cache.put("event_" + eventTs, "processed", 600);
  return false;
}
```

## ScriptProperties に設定する値のまとめ

| プロパティ | 値の例 | 説明 |
|-----------|--------|------|
| `SLACK_BOT_TOKEN` | `xoxb-xxxx` | Bot Token |
| `BOT_USER_ID` | `U0XXXXXXX` | Bot のユーザーID（auth.test で確認） |

## コード全体

```javascript
// ============================
// Slack API 共通関数
// ============================

function getSlackToken() {
  var token = PropertiesService.getScriptProperties().getProperty("SLACK_BOT_TOKEN");
  if (!token) {
    throw new Error("SLACK_BOT_TOKEN が設定されていません。");
  }
  return token;
}

function postBlockMessage(channel, blocks, text) {
  var token = getSlackToken();
  var payload = {
    channel: channel,
    blocks: blocks,
    text: text
  };

  var options = {
    method: "post",
    headers: {
      "Authorization": "Bearer " + token,
      "Content-Type": "application/json; charset=UTF-8"
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  var response = UrlFetchApp.fetch("https://slack.com/api/chat.postMessage", options);
  var result = JSON.parse(response.getContentText());

  if (!result.ok) {
    throw new Error("Slack API エラー: " + result.error);
  }
  return result;
}

// ============================
// 重複チェック
// ============================

function isDuplicate(eventTs) {
  var cache = CacheService.getScriptCache();
  var cached = cache.get("event_" + eventTs);
  if (cached) {
    return true;
  }
  cache.put("event_" + eventTs, "processed", 600);
  return false;
}

// ============================
// エントリーポイント
// ============================

function doPost(e) {
  if (e.postData && e.postData.type === "application/json") {
    var body = JSON.parse(e.postData.contents);

    if (body.type === "url_verification") {
      return ContentService.createTextOutput(body.challenge);
    }

    if (body.type === "event_callback") {
      // 重複チェック
      if (isDuplicate(body.event.event_ts)) {
        return ContentService.createTextOutput("OK");
      }
      return handleEvent(body);
    }
  }

  var params = e.parameter;

  if (params.command) {
    return handleSlashCommand(params);
  }

  if (params.payload) {
    var payload = JSON.parse(params.payload);
    if (payload.type === "view_submission") {
      return handleViewSubmission(payload);
    }
  }

  return ContentService.createTextOutput("OK");
}

// ============================
// Event 処理
// ============================

function handleEvent(body) {
  var event = body.event;

  if (event.type === "member_joined_channel") {
    handleMemberJoined(event);
  }

  return ContentService.createTextOutput("OK");
}

function handleMemberJoined(event) {
  var userId = event.user;
  var channelId = event.channel;

  var botUserId = PropertiesService.getScriptProperties().getProperty("BOT_USER_ID");
  if (userId === botUserId) {
    return;
  }

  var blocks = buildWelcomeBlocks(userId);
  postBlockMessage(channelId, blocks, "ようこそ！");
}

function buildWelcomeBlocks(userId) {
  return [
    {
      type: "header",
      text: { type: "plain_text", text: "👋 ようこそ！" }
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "<@" + userId + "> さん、チャンネルへようこそ！\nわからないことがあれば気軽に質問してくださいね 😄"
      }
    },
    { type: "divider" },
    {
      type: "context",
      elements: [
        { type: "mrkdwn", text: "💡 まずは自己紹介をしてみましょう！" }
      ]
    }
  ];
}
```

## まとめ

このドキュメントでは以下を行いました：

- ✅ Event Subscriptions の設定
- ✅ URL Verification への対応
- ✅ `member_joined_channel` イベントの処理
- ✅ Welcome メッセージの自動送信
- ✅ リトライ・重複チェックの対処

**他の機能も作ってみよう →**
- [Google Calendar → Slack 定期通知](scheduled-notification.md)
- [Slash Commands + Modal でURL共有](slash-commands.md)
