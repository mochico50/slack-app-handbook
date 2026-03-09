# Google Calendar の予定を Slack に定期通知する

GAS のトリガー機能を使って、Google Calendar の予定を毎日 Slack に自動投稿する方法を解説します。

> ソースコード全体は [app.js](app.js) を参照してください。

## 完成イメージ

```
📅 2024/01/15 (月) の予定
──────────────────
10:00 - 11:00 *チームミーティング* : [Google Meet]
14:00 - 14:30 *1on1* : [Google Meet]
16:00 - 17:00 *レビュー会* : [Google Meet]
```

> 💡 予定が0件の場合は通知されません。

## 前提条件

- [Slack App の初期設定](../slack-app-setup.md) が完了していること
- [GAS と Slack API の連携](../gas-slack-integration.md) が完了していること
- 通知したい Google Calendar の ID を知っていること
- GAS エディタで **Calendar Advanced Service** が有効になっていること

> 💡 **Calendar Advanced Service の有効化手順:**
> GAS エディタ左サイドバーの **「サービス」** → **「+」** → **「Google Calendar API」** を選択 → **「追加」** をクリック

## 全体の流れ

```
GAS トリガー
  - 日次でAM1:00 その日の 時間してトリガーをつくるトリガーが発火
  - 当日AM7:00に時間してトリガーが発火
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

## コード解説

### CalendarApp で予定を取得する

[`getTodayEvents()`](app.js) で `CalendarApp.getCalendarById()` を使い、本日の予定を取得します。

#### 取得できる主要なプロパティ

| メソッド | 戻り値 | 説明 |
|---------|--------|------|
| `getTitle()` | `string` | 予定のタイトル |
| `getStartTime()` | `Date` | 開始時刻 |
| `getEndTime()` | `Date` | 終了時刻 |
| `getDescription()` | `string` | 説明文 |
| `getLocation()` | `string` | 場所 |
| `isAllDayEvent()` | `boolean` | 終日イベントかどうか |
| `getId()` | `string` | イベント ID（`xxxxx@google.com` 形式） |

> 💡 Google Meet の URL は `CalendarApp` からは取得できません。Calendar Advanced Service（`Calendar.Events.get()`）の `hangoutLink` フィールドを使います。

### Google Meet URL の取得

[`getMeetUrl()`](app.js) で Calendar Advanced Service を呼び出し、`hangoutLink` から Google Meet の URL を取得します。`CalendarApp` の `getId()` は `xxxxx@google.com` 形式のため、`@` より前を切り出して API に渡しています。

### メッセージの組み立て

[`buildCalendarBlocks()`](app.js) で Block Kit のブロック配列を構築します。

- ヘッダーに日付を含めて表示（例: `📅 2024/01/15 (月) の予定`）
- 予定を開始時間でソート
- 各予定は `時刻 *タイトル* : [Google Meet]` の形式で表示
- 終日イベントは「終日」と表示
- Google Meet URL がある場合はリンクを追加

### メイン関数

[`notifyTodaySchedule()`](app.js) がトリガーから呼び出されるエントリポイントです。予定が0件の場合は何も投稿せずに終了します。

> 💡 `postBlockMessage` は [Block Kit によるメッセージ装飾](../message-formatting.md) で定義した関数です。

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

## まとめ

このドキュメントでは以下を行いました：

- ✅ Google Calendar から本日の予定を取得
- ✅ Google Meet URL をメッセージに含める
- ✅ Block Kit で見やすい通知メッセージを組み立て
- ✅ Slack チャンネルに投稿
- ✅ GAS トリガーで毎朝自動実行

**他の機能も作ってみよう →**
- [Slash Commands + Modal でURL共有](../slash-commands.md)
- [Welcome メッセージの自動送信](../welcome-message.md)
