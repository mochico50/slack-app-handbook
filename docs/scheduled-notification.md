# Google Calendar の予定を Slack に定期通知する

GAS のトリガー機能を使って、Google Calendar の予定を毎日 Slack に自動投稿する方法を解説します。

## 完成イメージ

```
📅 本日の予定
──────────────────
2024/01/15 (月)
──────────────────
*チームミーティング*
🕐 10:00 - 11:00

*1on1*
🕐 14:00 - 14:30

*レビュー会*
🕐 16:00 - 17:00
```

## 前提条件

- [Slack App の初期設定](slack-app-setup.md) が完了していること
- [GAS と Slack API の連携](gas-slack-integration.md) が完了していること
- 通知したい Google Calendar の ID を知っていること

## 全体の流れ

```
GAS トリガー（毎朝実行）
    ↓
CalendarApp で本日の予定を取得
    ↓
Block Kit でメッセージを組み立て
    ↓
chat.postMessage で Slack に投稿
```

## Google Calendar ID の確認方法

1. Google Calendar を開く
2. 対象カレンダーの **「⋮」** → **「設定と共有」** をクリック
3. **「カレンダーの統合」** セクションにある **「カレンダー ID」** をコピー

- 個人のカレンダー: `xxxxx@gmail.com` の形式
- 共有カレンダー: `xxxxx@group.calendar.google.com` の形式

> 💡 Calendar ID は ScriptProperties に保存しましょう（プロパティ名の例: `CALENDAR_ID`）。

## CalendarApp で予定を取得する

```javascript
/**
 * 本日の予定を取得する
 * @returns {CalendarEvent[]} 本日の予定一覧
 */
function getTodayEvents() {
  const calendarId = PropertiesService.getScriptProperties().getProperty("CALENDAR_ID");
  if (!calendarId) {
    throw new Error("CALENDAR_ID が設定されていません。");
  }

  const calendar = CalendarApp.getCalendarById(calendarId);
  if (!calendar) {
    throw new Error("カレンダーが見つかりません: " + calendarId);
  }

  const today = new Date();
  const events = calendar.getEventsForDay(today);

  return events;
}
```

### 取得できる主要なプロパティ

| メソッド | 戻り値 | 説明 |
|---------|--------|------|
| `getTitle()` | `string` | 予定のタイトル |
| `getStartTime()` | `Date` | 開始時刻 |
| `getEndTime()` | `Date` | 終了時刻 |
| `getDescription()` | `string` | 説明文 |
| `getLocation()` | `string` | 場所 |
| `isAllDayEvent()` | `boolean` | 終日イベントかどうか |

## Slack にメッセージを投稿する

### メッセージの組み立て

```javascript
/**
 * カレンダー通知用の Block Kit メッセージを組み立てる
 * @param {CalendarEvent[]} events - 予定一覧
 * @returns {Object[]} Block Kit のブロック配列
 */
function buildCalendarBlocks(events) {
  const today = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy/MM/dd (E)");

  const blocks = [
    {
      type: "header",
      text: { type: "plain_text", text: "📅 本日の予定" }
    },
    {
      type: "context",
      elements: [{ type: "mrkdwn", text: today }]
    },
    { type: "divider" }
  ];

  if (events.length === 0) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: "今日の予定はありません 🎉" }
    });
    return blocks;
  }

  // 開始時間でソート
  events.sort(function(a, b) {
    return a.getStartTime().getTime() - b.getStartTime().getTime();
  });

  events.forEach(function(event) {
    var timeText;
    if (event.isAllDayEvent()) {
      timeText = "終日";
    } else {
      var start = Utilities.formatDate(event.getStartTime(), "Asia/Tokyo", "HH:mm");
      var end = Utilities.formatDate(event.getEndTime(), "Asia/Tokyo", "HH:mm");
      timeText = start + " - " + end;
    }

    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*" + event.getTitle() + "*\n🕐 " + timeText
      }
    });
  });

  return blocks;
}
```

### メイン関数

```javascript
/**
 * カレンダーの本日の予定を Slack に通知する（トリガーから呼ばれる）
 */
function notifyTodaySchedule() {
  var events = getTodayEvents();
  var blocks = buildCalendarBlocks(events);

  var channelId = PropertiesService.getScriptProperties().getProperty("SLACK_CHANNEL_ID");
  if (!channelId) {
    throw new Error("SLACK_CHANNEL_ID が設定されていません。");
  }

  postBlockMessage(channelId, blocks, "本日の予定: " + events.length + "件");
}
```

> 💡 `postBlockMessage` は [Block Kit によるメッセージ装飾](message-formatting.md) で定義した関数です。

### ScriptProperties に設定する値のまとめ

| プロパティ | 値の例 | 説明 |
|-----------|--------|------|
| `SLACK_BOT_TOKEN` | `xoxb-xxxx` | Bot Token |
| `SLACK_CHANNEL_ID` | `C0XXXXXXX` | 通知先チャンネルID |
| `CALENDAR_ID` | `xxxx@group.calendar.google.com` | Google Calendar ID |

## GAS トリガーで定期実行する

### トリガーの設定方法

1. GAS エディタ左サイドバーの **「トリガー」**（時計アイコン）をクリック
2. **「トリガーを追加」** をクリック
3. 以下を設定：

| 項目 | 設定値 |
|------|--------|
| 実行する関数 | `notifyTodaySchedule` |
| イベントのソース | 時間主導型 |
| 時間ベースのトリガーのタイプ | 日付ベースのタイマー |
| 時刻 | 午前8時〜9時（お好みで） |

4. **「保存」** をクリック

### トリガーの注意点

- 時刻は「午前8時〜9時」のように1時間の幅で指定されます。正確な時刻は指定できません
- GAS の無料アカウントではトリガー実行回数に制限があります（1日最大90分の実行時間）
- トリガーの失敗はメールで通知されます

### トリガーの管理

不要になったトリガーは、トリガー一覧画面の **「⋮」** → **「トリガーを削除」** で削除できます。

## コード全体

最終的なコードの全体像です：

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
  var url = "https://slack.com/api/chat.postMessage";

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

  var response = UrlFetchApp.fetch(url, options);
  var result = JSON.parse(response.getContentText());

  if (!result.ok) {
    throw new Error("Slack API エラー: " + result.error);
  }

  return result;
}

// ============================
// カレンダー通知
// ============================

function getTodayEvents() {
  var calendarId = PropertiesService.getScriptProperties().getProperty("CALENDAR_ID");
  if (!calendarId) {
    throw new Error("CALENDAR_ID が設定されていません。");
  }

  var calendar = CalendarApp.getCalendarById(calendarId);
  if (!calendar) {
    throw new Error("カレンダーが見つかりません: " + calendarId);
  }

  return calendar.getEventsForDay(new Date());
}

function buildCalendarBlocks(events) {
  var today = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy/MM/dd (E)");

  var blocks = [
    { type: "header", text: { type: "plain_text", text: "📅 本日の予定" } },
    { type: "context", elements: [{ type: "mrkdwn", text: today }] },
    { type: "divider" }
  ];

  if (events.length === 0) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: "今日の予定はありません 🎉" }
    });
    return blocks;
  }

  events.sort(function(a, b) {
    return a.getStartTime().getTime() - b.getStartTime().getTime();
  });

  events.forEach(function(event) {
    var timeText;
    if (event.isAllDayEvent()) {
      timeText = "終日";
    } else {
      var start = Utilities.formatDate(event.getStartTime(), "Asia/Tokyo", "HH:mm");
      var end = Utilities.formatDate(event.getEndTime(), "Asia/Tokyo", "HH:mm");
      timeText = start + " - " + end;
    }

    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: "*" + event.getTitle() + "*\n🕐 " + timeText }
    });
  });

  return blocks;
}

function notifyTodaySchedule() {
  var events = getTodayEvents();
  var blocks = buildCalendarBlocks(events);
  var channelId = PropertiesService.getScriptProperties().getProperty("SLACK_CHANNEL_ID");

  if (!channelId) {
    throw new Error("SLACK_CHANNEL_ID が設定されていません。");
  }

  postBlockMessage(channelId, blocks, "本日の予定: " + events.length + "件");
}
```

## まとめ

このドキュメントでは以下を行いました：

- ✅ Google Calendar から本日の予定を取得
- ✅ Block Kit で見やすい通知メッセージを組み立て
- ✅ Slack チャンネルに投稿
- ✅ GAS トリガーで毎朝自動実行

**他の機能も作ってみよう →**
- [Slash Commands + Modal でURL共有](slash-commands.md)
- [Welcome メッセージの自動送信](welcome-message.md)
