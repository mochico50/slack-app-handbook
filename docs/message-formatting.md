# Block Kit によるメッセージ装飾

Slack の Block Kit を使って、リッチなメッセージを組み立てる方法を解説します。

## このドキュメントのゴール

- Block Kit の基本概念を理解できる
- よく使うブロックとエレメントを使いこなせる
- 本ハンドブックの3機能で使うメッセージを組み立てられる

## 前提条件

- [GAS と Slack API の連携](gas-slack-integration.md) が完了していること

## Block Kit とは

Block Kit は Slack のメッセージレイアウトフレームワークです。JSON で構造化されたブロックを組み合わせることで、テキストだけでなくボタン・画像・入力フォームなどを含むリッチなメッセージを作成できます。

### Block Kit Builder を使おう

[Block Kit Builder](https://app.slack.com/block-kit-builder) は、ブラウザ上で Block Kit の JSON を組み立てて、リアルタイムにプレビューできるツールです。まずはここで試しながら覚えるのがおすすめです。

## 基本のブロック

### Header Block

大きな太字テキストを表示します。通知のタイトルに最適です。

```json
{
  "type": "header",
  "text": {
    "type": "plain_text",
    "text": "📅 本日の予定"
  }
}
```

### Section Block

最もよく使うブロックです。テキスト、フィールド、アクセサリ（ボタンや画像）を配置できます。

```json
{
  "type": "section",
  "text": {
    "type": "mrkdwn",
    "text": "*チームミーティング*\n10:00 - 11:00\n会議室A"
  }
}
```

#### fields を使った2カラムレイアウト

```json
{
  "type": "section",
  "fields": [
    {
      "type": "mrkdwn",
      "text": "*開始時刻*\n10:00"
    },
    {
      "type": "mrkdwn",
      "text": "*終了時刻*\n11:00"
    }
  ]
}
```

### Divider Block

水平線で区切りを入れます。

```json
{
  "type": "divider"
}
```

### Context Block

小さなテキストやアイコンを表示します。投稿者情報や注釈に便利です。

```json
{
  "type": "context",
  "elements": [
    {
      "type": "mrkdwn",
      "text": "📝 投稿者: <@U0XXXXXXX> | 2024-01-15"
    }
  ]
}
```

## よく使うエレメント

### mrkdwn テキスト

Slack 独自のマークダウン記法です。

| 記法 | 表示 |
|------|------|
| `*太字*` | **太字** |
| `_斜体_` | _斜体_ |
| `~取り消し線~` | ~~取り消し線~~ |
| `` `コード` `` | `コード` |
| `<https://example.com\|リンクテキスト>` | リンクテキスト |
| `<@U0XXXXXXX>` | ユーザーメンション |
| `<#C0XXXXXXX>` | チャンネルメンション |

### Button

Section Block のアクセサリや Actions Block に配置できます。

```json
{
  "type": "section",
  "text": {
    "type": "mrkdwn",
    "text": "新しい記事が投稿されました"
  },
  "accessory": {
    "type": "button",
    "text": {
      "type": "plain_text",
      "text": "📖 記事を読む"
    },
    "url": "https://example.com/article"
  }
}
```

### Image

```json
{
  "type": "image",
  "image_url": "https://example.com/image.png",
  "alt_text": "説明テキスト"
}
```

## 実践例

### カレンダー通知メッセージ

```javascript
function buildCalendarNotification(events) {
  const blocks = [
    {
      type: "header",
      text: { type: "plain_text", text: "📅 本日の予定" }
    },
    {
      type: "context",
      elements: [
        { type: "mrkdwn", text: Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy/MM/dd (E)") }
      ]
    },
    { type: "divider" }
  ];

  events.forEach(function(event) {
    const start = Utilities.formatDate(event.getStartTime(), "Asia/Tokyo", "HH:mm");
    const end = Utilities.formatDate(event.getEndTime(), "Asia/Tokyo", "HH:mm");
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*" + event.getTitle() + "*\n🕐 " + start + " - " + end
      }
    });
  });

  return blocks;
}
```

### URL共有メッセージ

```javascript
function buildOutputShareMessage(userName, title, url, platform) {
  return [
    {
      type: "header",
      text: { type: "plain_text", text: "📝 新しいアウトプットが共有されました！" }
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: "*投稿者*\n" + userName },
        { type: "mrkdwn", text: "*プラットフォーム*\n" + platform }
      ]
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*" + title + "*\n<" + url + "|記事を読む 📖>"
      }
    }
  ];
}
```

### Welcome メッセージ

```javascript
function buildWelcomeMessage(userId) {
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

## Block Kit を chat.postMessage で送信する

```javascript
function postBlockMessage(channel, blocks, text) {
  const token = getSlackToken();
  const url = "https://slack.com/api/chat.postMessage";

  const payload = {
    channel: channel,
    blocks: blocks,
    text: text  // Block Kit が表示できない環境向けのフォールバックテキスト
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

> 💡 `text` パラメータは Block Kit 表示時には見えませんが、通知バナーや Block Kit 未対応のクライアントで使用されます。省略せず設定しましょう。

## 注意点

| 制限 | 内容 |
|------|------|
| ブロック数の上限 | 1メッセージあたり最大 **50 ブロック** |
| text の文字数 | Section Block の text は最大 **3,000 文字** |
| fields の数 | Section Block の fields は最大 **10 個** |
| Header の文字数 | 最大 **150 文字** |

上限を超えるとメッセージが送信できなくなるため、カレンダー通知で予定が多い場合などは件数を制限する処理を入れましょう。

## まとめ

このドキュメントでは以下を学びました：

- ✅ Block Kit の基本概念と Block Kit Builder
- ✅ Header / Section / Divider / Context ブロック
- ✅ mrkdwn テキスト・ボタン・画像エレメント
- ✅ 3つの機能で使う実践的なメッセージ例
- ✅ `chat.postMessage` での Block Kit 送信方法

**次のステップ →** 機能別ガイド
- [Google Calendar → Slack 定期通知](scheduled-notification.md)
- [Slash Commands + Modal でURL共有](slash-commands.md)
- [Welcome メッセージの自動送信](welcome-message.md)
