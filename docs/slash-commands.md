# Slash Commands と Modal でアウトプット URL を共有する

Slack のスラッシュコマンドからフォーム（Modal）を起動し、note や Zenn などの記事 URL をチャンネルに共有する仕組みを解説します。

## 完成イメージ

### 1. コマンド実行

```
/share-output
```

### 2. Modal が表示される

```
┌─────────────────────────────────┐
│  アウトプットを共有する           │
│                                 │
│  タイトル: [               ]    │
│  URL:     [               ]    │
│  プラットフォーム: [▼ 選択]     │
│                                 │
│  [キャンセル]      [送信]       │
└─────────────────────────────────┘
```

### 3. チャンネルに投稿される

```
📝 新しいアウトプットが共有されました！
──────────────────
投稿者: @username
プラットフォーム: Zenn

GASでSlack Botを作った話
記事を読む 📖
```

## 前提条件

- [Slack App の初期設定](slack-app-setup.md) が完了していること
- [GAS と Slack API の連携](gas-slack-integration.md) が完了していること
- Slack App に `commands` スコープが追加されていること

## 全体の流れ

```
ユーザー「/share-output」
    ↓
Slack → GAS (doPost) にリクエスト送信
    ↓
GAS → Slack API (views.open) で Modal 表示
    ↓
ユーザーがフォームに入力して送信
    ↓
Slack → GAS (doPost) に view_submission イベント送信
    ↓
GAS → Slack API (chat.postMessage) でチャンネルに投稿
```

## Slash Commands の設定

### Slack App 管理画面での設定

1. [https://api.slack.com/apps](https://api.slack.com/apps) でアプリを選択
2. 左サイドバーの **「Slash Commands」** をクリック
3. **「Create New Command」** をクリック
4. 以下を入力：

| 項目 | 値 |
|------|-----|
| Command | `/share-output` |
| Request URL | GAS の Web App URL（次のセクションで取得） |
| Short Description | アウトプットURLを共有する |

5. **「Save」** をクリック

## GAS を Web App として公開する

Slash Commands や Interactivity は Slack から GAS に HTTP POST リクエストを送信します。そのため、GAS を Web App として公開する必要があります。

### 1. doPost 関数を作成

```javascript
/**
 * Slack からの POST リクエストを受け取るエントリーポイント
 * Slash Commands と Interactivity（Modal送信）の両方をここで処理する
 */
function doPost(e) {
  var params = e.parameter;

  // Slash Command の場合
  if (params.command) {
    return handleSlashCommand(params);
  }

  // Interactivity（Modal送信）の場合
  if (params.payload) {
    var payload = JSON.parse(params.payload);
    if (payload.type === "view_submission") {
      return handleViewSubmission(payload);
    }
  }

  return ContentService.createTextOutput("Unknown request");
}
```

### 2. Web App としてデプロイ

1. GAS エディタ右上の **「デプロイ」** → **「新しいデプロイ」**
2. 種類で **「ウェブアプリ」** を選択
3. 以下を設定：

| 項目 | 設定値 |
|------|--------|
| 説明 | `Slack App - share output` |
| 次のユーザーとして実行 | 自分 |
| アクセスできるユーザー | **全員** |

4. **「デプロイ」** をクリック
5. 表示される **Web App URL** をコピー

> ⚠️ **「全員」にする理由**: Slack のサーバーから直接アクセスされるため、認証なしでアクセスできる必要があります。セキュリティは Slack のリクエスト検証（後述）で担保します。

> ⚠️ **コードを変更したら再デプロイが必要です。** 「デプロイを管理」→ 鉛筆アイコン → バージョンを「新バージョン」に変更して更新してください。

### 3. Slash Commands に URL を設定

コピーした Web App URL を、Slash Commands の **Request URL** に貼り付けて保存します。

## Modal（フォーム）を表示する

### Slash Command のハンドリング

```javascript
/**
 * Slash Command を受け取り、Modal を表示する
 */
function handleSlashCommand(params) {
  var triggerId = params.trigger_id;

  openOutputModal(triggerId);

  // Slash Command には 200 OK を返す（空レスポンス）
  return ContentService.createTextOutput("");
}
```

### Modal を開く

```javascript
/**
 * アウトプット共有用の Modal を表示する
 * @param {string} triggerId - Slash Command から受け取った trigger_id
 */
function openOutputModal(triggerId) {
  var token = getSlackToken();
  var url = "https://slack.com/api/views.open";

  var view = {
    type: "modal",
    callback_id: "share_output_modal",
    title: {
      type: "plain_text",
      text: "アウトプットを共有"
    },
    submit: {
      type: "plain_text",
      text: "送信"
    },
    close: {
      type: "plain_text",
      text: "キャンセル"
    },
    blocks: [
      {
        type: "input",
        block_id: "title_block",
        label: { type: "plain_text", text: "タイトル" },
        element: {
          type: "plain_text_input",
          action_id: "title_input",
          placeholder: { type: "plain_text", text: "記事のタイトルを入力" }
        }
      },
      {
        type: "input",
        block_id: "url_block",
        label: { type: "plain_text", text: "URL" },
        element: {
          type: "url_text_input",
          action_id: "url_input",
          placeholder: { type: "plain_text", text: "https://..." }
        }
      },
      {
        type: "input",
        block_id: "platform_block",
        label: { type: "plain_text", text: "プラットフォーム" },
        element: {
          type: "static_select",
          action_id: "platform_select",
          placeholder: { type: "plain_text", text: "選択してください" },
          options: [
            { text: { type: "plain_text", text: "Zenn" }, value: "zenn" },
            { text: { type: "plain_text", text: "note" }, value: "note" },
            { text: { type: "plain_text", text: "Qiita" }, value: "qiita" },
            { text: { type: "plain_text", text: "ブログ" }, value: "blog" },
            { text: { type: "plain_text", text: "その他" }, value: "other" }
          ]
        }
      }
    ]
  };

  var payload = {
    trigger_id: triggerId,
    view: view
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
    console.error("Modal 表示エラー: " + result.error);
  }
}
```

### trigger_id について

`trigger_id` は Slash Command のリクエストに含まれるワンタイムトークンで、Modal を開くために必要です。

> ⚠️ **trigger_id の有効期限は 3 秒です。** GAS のコールドスタート（初回実行時の起動時間）で期限切れになることがあります。対処法は [トラブルシューティング](troubleshooting.md) を参照してください。

## Interactivity の設定

Modal の送信イベントを受け取るために、Interactivity を有効にします。

1. Slack App 管理画面 → **「Interactivity & Shortcuts」**
2. **「Interactivity」** を **On** に切り替え
3. **Request URL** に GAS の Web App URL を入力（Slash Commands と同じ URL）
4. **「Save Changes」** をクリック

## フォーム送信を処理する

### view_submission のハンドリング

```javascript
/**
 * Modal のフォーム送信を処理する
 */
function handleViewSubmission(payload) {
  var values = payload.view.state.values;

  // 入力値を取得
  var title = values.title_block.title_input.value;
  var url = values.url_block.url_input.value;
  var platform = values.platform_block.platform_select.selected_option.text.text;
  var userId = payload.user.id;

  // チャンネルに投稿
  var channelId = PropertiesService.getScriptProperties().getProperty("SLACK_CHANNEL_ID");
  if (!channelId) {
    throw new Error("SLACK_CHANNEL_ID が設定されていません。");
  }

  var blocks = buildOutputShareBlocks(userId, title, url, platform);
  postBlockMessage(channelId, blocks, title + " - " + url);

  // 空レスポンスを返すと Modal が閉じる
  return ContentService.createTextOutput(
    JSON.stringify({ response_action: "clear" })
  ).setMimeType(ContentService.MimeType.JSON);
}
```

### 共有メッセージの組み立て

```javascript
/**
 * アウトプット共有メッセージの Block Kit を組み立てる
 */
function buildOutputShareBlocks(userId, title, url, platform) {
  return [
    {
      type: "header",
      text: { type: "plain_text", text: "📝 新しいアウトプットが共有されました！" }
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: "*投稿者*\n<@" + userId + ">" },
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

## ScriptProperties に設定する値のまとめ

| プロパティ | 値の例 | 説明 |
|-----------|--------|------|
| `SLACK_BOT_TOKEN` | `xoxb-xxxx` | Bot Token |
| `SLACK_CHANNEL_ID` | `C0XXXXXXX` | 投稿先チャンネルID |

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
// エントリーポイント
// ============================

function doPost(e) {
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

  return ContentService.createTextOutput("Unknown request");
}

// ============================
// Slash Command → Modal 表示
// ============================

function handleSlashCommand(params) {
  var triggerId = params.trigger_id;
  openOutputModal(triggerId);
  return ContentService.createTextOutput("");
}

function openOutputModal(triggerId) {
  var token = getSlackToken();

  var view = {
    type: "modal",
    callback_id: "share_output_modal",
    title: { type: "plain_text", text: "アウトプットを共有" },
    submit: { type: "plain_text", text: "送信" },
    close: { type: "plain_text", text: "キャンセル" },
    blocks: [
      {
        type: "input",
        block_id: "title_block",
        label: { type: "plain_text", text: "タイトル" },
        element: {
          type: "plain_text_input",
          action_id: "title_input",
          placeholder: { type: "plain_text", text: "記事のタイトルを入力" }
        }
      },
      {
        type: "input",
        block_id: "url_block",
        label: { type: "plain_text", text: "URL" },
        element: {
          type: "url_text_input",
          action_id: "url_input",
          placeholder: { type: "plain_text", text: "https://..." }
        }
      },
      {
        type: "input",
        block_id: "platform_block",
        label: { type: "plain_text", text: "プラットフォーム" },
        element: {
          type: "static_select",
          action_id: "platform_select",
          placeholder: { type: "plain_text", text: "選択してください" },
          options: [
            { text: { type: "plain_text", text: "Zenn" }, value: "zenn" },
            { text: { type: "plain_text", text: "note" }, value: "note" },
            { text: { type: "plain_text", text: "Qiita" }, value: "qiita" },
            { text: { type: "plain_text", text: "ブログ" }, value: "blog" },
            { text: { type: "plain_text", text: "その他" }, value: "other" }
          ]
        }
      }
    ]
  };

  var payload = { trigger_id: triggerId, view: view };
  var options = {
    method: "post",
    headers: {
      "Authorization": "Bearer " + token,
      "Content-Type": "application/json; charset=UTF-8"
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  var response = UrlFetchApp.fetch("https://slack.com/api/views.open", options);
  var result = JSON.parse(response.getContentText());

  if (!result.ok) {
    console.error("Modal 表示エラー: " + result.error);
  }
}

// ============================
// Modal 送信 → チャンネル投稿
// ============================

function handleViewSubmission(payload) {
  var values = payload.view.state.values;
  var title = values.title_block.title_input.value;
  var url = values.url_block.url_input.value;
  var platform = values.platform_block.platform_select.selected_option.text.text;
  var userId = payload.user.id;

  var channelId = PropertiesService.getScriptProperties().getProperty("SLACK_CHANNEL_ID");
  if (!channelId) {
    throw new Error("SLACK_CHANNEL_ID が設定されていません。");
  }

  var blocks = buildOutputShareBlocks(userId, title, url, platform);
  postBlockMessage(channelId, blocks, title + " - " + url);

  return ContentService.createTextOutput(
    JSON.stringify({ response_action: "clear" })
  ).setMimeType(ContentService.MimeType.JSON);
}

function buildOutputShareBlocks(userId, title, url, platform) {
  return [
    {
      type: "header",
      text: { type: "plain_text", text: "📝 新しいアウトプットが共有されました！" }
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: "*投稿者*\n<@" + userId + ">" },
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

## まとめ

このドキュメントでは以下を行いました：

- ✅ Slash Commands の設定
- ✅ GAS を Web App として公開
- ✅ Modal（フォーム）の表示
- ✅ フォーム送信の処理とチャンネル投稿
- ✅ Interactivity の設定

**他の機能も作ってみよう →**
- [Google Calendar → Slack 定期通知](scheduled-notification.md)
- [Welcome メッセージの自動送信](welcome-message.md)
