# 新メンバーへの Welcome メッセージを自動送信する

チャンネルに新しいメンバーが参加したときに、特定のチャンネルへ自動で Welcome メッセージを送信する仕組みを解説します。

> ソースコード全体は [app.js](app.js) を参照してください。

## 完成イメージ

```
👋 ようこそ！
──────────────────
@new-member さん、チャンネルへようこそ！ ← スプレッドシートの A1 セルの内容
```

## 前提条件

- [Slack App の初期設定](../slack-app-setup.md) が完了していること
- [GAS と Slack API の連携](../gas-slack-integration.md) が完了していること
- GAS が Web App として公開されていること（[Slash Commands ガイド](../slash-commands.md) の「GAS を Web App として公開する」を参照）
- GAS がスプレッドシートにコンテナバインドされていること

> 💡 **コンテナバインドスクリプトの作成方法:**
> Google スプレッドシートを開き、**「拡張機能」** → **「Apps Script」** をクリックすると、そのスプレッドシートにバインドされた GAS プロジェクトが作成されます。

## 全体の流れ

```
メンバーがワークスペースに参加
    ↓
Slack → GAS (doPost) に team_join イベントを送信
    ↓
GAS → Slack API (chat.postMessage) で特定チャンネルに Welcome メッセージを投稿
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

GAS はこの `challenge` の値をそのまま返す必要があります。[`doPost()`](app.js) の中で `body.type === "url_verification"` を判定し、`body.challenge` を返しています。

> 💡 **Slash Commands と Event Subscriptions の共存**: Slash Commands は `application/x-www-form-urlencoded`、Event Subscriptions は `application/json` で送信されるため、`Content-Type` で判別できます。

コードを更新したら **再デプロイ** してから Request URL を入力してください。「Verified ✓」と表示されれば成功です。

### 4. 購読するイベントを追加

**「Subscribe to bot events」** セクションで以下のイベントを追加します：

| イベント名 | 説明 |
|-----------|------|
| `team_join` | メンバーがワークスペースに参加した時 |

> 💡 `member_joined_channel` は特定チャンネルへの参加イベントです。ワークスペース全体への参加を検知したい場合は `team_join` を使います。

### 5. アプリを再インストール

イベントを追加すると、追加のスコープが必要になる場合があります。ページ上部に警告が表示されたら **「reinstall your app」** をクリックして再インストールしてください。

## コード解説

### イベントペイロードの構造

`team_join` イベントのペイロード：

```json
{
  "type": "event_callback",
  "event": {
    "type": "team_join",
    "user": {
      "id": "U0XXXXXXX",
      "name": "new-member",
      "real_name": "新メンバー"
    }
  }
}
```

### イベントハンドラー

[`handleEvent()`](app.js) でイベントタイプを判別し、[`handleTeamJoin()`](app.js) で Welcome メッセージを送信します。

- Bot 自身の参加は `BOT_USER_ID` と照合してスキップ（無限ループ防止）
- 通知先は `SLACK_CHANNEL_ID` で指定した特定チャンネルに投稿

> 💡 **Bot 自身の参加を無視する**: Bot がチャンネルに追加された時も `member_joined_channel` が発火します。Bot のユーザーIDは `auth.test` API のレスポンスで確認できます。

### Welcome メッセージの組み立て

[`getWelcomeMessage()`](app.js) でコンテナバインドしているスプレッドシートの **A1 セル**からメッセージ本文を取得します。

[`buildWelcomeBlocks()`](app.js) で Block Kit のブロック配列を構築し、参加したユーザーを `<@userId>` でメンションします。

> 💡 メッセージ内容を変更したい場合は、スプレッドシートの A1 セルを編集するだけで OK です。コードの再デプロイは不要です。

### リトライへの対処

Slack は GAS が 3 秒以内に応答しない場合、同じイベントを最大 3 回リトライします。

[`isDuplicate()`](app.js) で `CacheService` を使い、`event_ts` を 10 分間キャッシュして重複送信を防止しています。

> ⚠️ GAS では HTTP ヘッダー（`X-Slack-Retry-Num`）へのアクセスが制限されているため、CacheService を使ったイベント ID ベースの重複チェックを採用しています。

### デバッグ用の手動実行

[`debugSendWelcomeMessage()`](app.js) を GAS エディタから直接実行すると、実際にイベントを発生させなくても Welcome メッセージの送信をテストできます。

1. ScriptProperties に `DEBUG_USER_ID` を設定（メンション対象となるユーザーの ID）
2. GAS エディタで `debugSendWelcomeMessage` を選択して ▶ 実行
3. 指定チャンネルに Welcome メッセージが投稿されることを確認

> 💡 本番の `team_join` イベントは新規参加時にしか発火しないため、開発中はこのデバッグ関数を活用してください。

## ScriptProperties に設定する値のまとめ

| プロパティ | 値の例 | 説明 |
|-----------|--------|------|
| `SLACK_BOT_TOKEN` | `xoxb-xxxx` | Bot Token |
| `BOT_USER_ID` | `U0XXXXXXX` | Bot のユーザーID（`auth.test` で確認） |
| `SLACK_CHANNEL_ID` | `C0XXXXXXX` | Welcome メッセージの投稿先チャンネル ID |
| `DEBUG_USER_ID` | `U0XXXXXXX` | デバッグ用ユーザー ID（`debugSendWelcomeMessage()` で使用） |

## まとめ

このドキュメントでは以下を行いました：

- ✅ Event Subscriptions の設定
- ✅ URL Verification への対応
- ✅ `team_join` イベントの処理
- ✅ 特定チャンネルへ Welcome メッセージを自動送信
- ✅ リトライ・重複チェックの対処

**他の機能も作ってみよう →**
- [Google Calendar → Slack 定期通知](../scheduled-notification/README.md)
- [Slash Commands + Modal でURL共有](../slash-commands.md)
