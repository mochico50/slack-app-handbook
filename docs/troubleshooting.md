# トラブルシューティング

Slack App 開発でよくあるエラーとその対処法をまとめています。

## 認証・権限エラー

### `not_authed` / `invalid_auth`

**症状**: API リクエストが認証エラーで失敗する。

**原因と対処**:

| 原因 | 対処 |
|------|------|
| ScriptProperties にトークンが設定されていない | 「プロジェクトの設定」→「スクリプト プロパティ」を確認 |
| トークンが間違っている（コピーミス） | Slack App 管理画面でトークンを再確認・再コピー |
| トークンが失効している | アプリを再インストールして新しいトークンを取得 |
| `Bearer` の綴りが間違っている | `"Authorization": "Bearer " + token` を確認 |

**確認方法**:

```javascript
function checkAuth() {
  var token = getSlackToken();
  console.log("Token starts with: " + token.substring(0, 5)); // xoxb- を確認
  var result = JSON.parse(
    UrlFetchApp.fetch("https://slack.com/api/auth.test", {
      method: "post",
      headers: { "Authorization": "Bearer " + token },
      muteHttpExceptions: true
    }).getContentText()
  );
  console.log(result);
}
```

### `missing_scope`

**症状**: `"error": "missing_scope"` が返される。

**対処**:
1. エラーレスポンスの `needed` フィールドで必要なスコープを確認
2. Slack App 管理画面 → 「OAuth & Permissions」でスコープを追加
3. **アプリを再インストール**（スコープ追加後は再インストールが必要）

### `channel_not_found`

**症状**: `chat.postMessage` で `"error": "channel_not_found"` が返される。

**原因と対処**:

| 原因 | 対処 |
|------|------|
| チャンネルID が間違っている | Slack でチャンネル名クリック → 最下部のIDを確認 |
| Bot がチャンネルに参加していない | チャンネルで `@Bot名` とメンションして招待 |
| プライベートチャンネルにアクセス権がない | Bot をプライベートチャンネルに招待 |

> 💡 チャンネル名（`#general`）ではなくチャンネルID（`C0XXXXXXX`）を使用してください。

---

## Slash Commands 関連

### `trigger_id expired`

**症状**: Slash Command 実行後、Modal が表示されない。GAS のログに `"error": "expired_trigger_id"` が記録される。

**原因**: `trigger_id` の有効期限は **3 秒** です。GAS のコールドスタート（初回起動）で 3 秒を超えることがあります。

**対処法**:

1. **ウォームアップトリガーを設定する**
   - GAS のトリガーで 5 分おきに空の関数を実行し、スクリプトを「温めておく」

```javascript
// ウォームアップ用の空関数（トリガーで定期実行）
function warmUp() {
  // GAS のインスタンスを起動状態に保つ
  console.log("Warm up: " + new Date());
}
```

2. **doPost の処理を最小限にする**
   - Modal 表示前に不必要な処理（ログ出力、DB アクセスなど）を入れない

3. **ユーザーに再試行を案内する**
   - 初回実行で失敗しても、2回目以降はコールドスタートが発生しないため成功しやすい

### `dispatch_failed`

**症状**: コマンド実行時に「dispatch_failed」エラーが表示される。

**原因と対処**:

| 原因 | 対処 |
|------|------|
| Request URL が設定されていない | Slash Commands の設定画面で URL を入力 |
| GAS の Web App URL が間違っている | Web App URL を再確認 |
| GAS が未デプロイ or 古いバージョン | 「デプロイを管理」で新バージョンとしてデプロイ |

### GAS の Web App URL が反映されない

**症状**: コードを変更しても動作が変わらない。

**対処**:
1. GAS エディタ → **「デプロイ」** → **「デプロイを管理」**
2. 鉛筆アイコンをクリック
3. バージョンを **「新バージョン」** に変更
4. **「デプロイ」** をクリック

> ⚠️ 「新バージョン」にしないと古いコードのまま動作し続けます。これは最も多いハマりポイントです。

---

## Event Subscriptions 関連

### URL Verification が通らない

**症状**: Request URL に GAS の Web App URL を入力しても「Your URL didn't respond」と表示される。

**チェックリスト**:

- [ ] `doPost` 関数が存在するか
- [ ] `url_verification` タイプの処理で `challenge` を返しているか
- [ ] Web App としてデプロイ済みか（**新バージョン**で）
- [ ] アクセスできるユーザーが「全員」になっているか

**デバッグ用コード**:

```javascript
function doPost(e) {
  // デバッグ: リクエスト内容をログに記録
  console.log("postData type: " + (e.postData ? e.postData.type : "none"));
  console.log("postData contents: " + (e.postData ? e.postData.contents : "none"));

  if (e.postData && e.postData.type === "application/json") {
    var body = JSON.parse(e.postData.contents);
    if (body.type === "url_verification") {
      return ContentService.createTextOutput(body.challenge);
    }
  }

  return ContentService.createTextOutput("OK");
}
```

### イベントが届かない

**原因と対処**:

| 原因 | 対処 |
|------|------|
| Bot がチャンネルに参加していない | イベントはBotが参加しているチャンネルでのみ発火 |
| 購読イベントが設定されていない | 「Subscribe to bot events」でイベントを追加 |
| アプリを再インストールしていない | イベント追加後は再インストールが必要な場合がある |

### リトライで重複処理される

**症状**: Welcome メッセージが2〜3回送信される。

**原因**: Slack は GAS が 3 秒以内に応答しない場合、リトライします。ヘッダーに `X-Slack-Retry-Num` が含まれます（1回目: 1, 2回目: 2, 最大3回）。

**対処**: CacheService を使った重複チェックを実装する。詳しくは [Welcome メッセージガイド](welcome-message.md) の「リトライへの対処」を参照してください。

---

## GAS 固有の問題

### 実行時間の 6 分制限

**症状**: スクリプトが途中で止まる。「Exceeded maximum execution time」エラー。

**対処**:
- 1回の実行で大量の処理をしない
- カレンダー通知で予定が多い場合、件数を制限する
- 長時間の処理が必要な場合は、処理を分割してトリガーを連鎖させる

### トリガーの制限

| 制限 | 値 |
|------|-----|
| トリガー数上限 | 20個/ユーザー/スクリプト |
| 1日の合計実行時間 | 90分（無料アカウント） |
| トリガー実行間隔の精度 | ±15分程度 |

### デプロイ後にコードが反映されない

**最もよくある問題です。** 必ず以下を確認してください：

1. **「新しいデプロイ」ではなく「デプロイを管理」を使う**
   - 新しいデプロイを作成すると URL が変わってしまう
2. **バージョンを「新バージョン」にする**
   - 既存のバージョン番号のままだとコードが更新されない
3. **Slack App 管理画面の URL は変更不要**
   - 「デプロイを管理」で更新すれば同じ URL のまま

---

## Block Kit 関連

### ブロック数の上限

| 対象 | 上限 |
|------|------|
| メッセージのブロック数 | 50 |
| Modal のブロック数 | 100 |

**対処**: カレンダー通知で予定が多い場合、上限を超えないよう件数を制限する。

```javascript
// 予定が多すぎる場合は制限する
var maxEvents = 15;
if (events.length > maxEvents) {
  events = events.slice(0, maxEvents);
  // 「他 N 件の予定があります」とフッターを追加
}
```

### 文字数制限

| 対象 | 上限 |
|------|------|
| Section Block の text | 3,000 文字 |
| Header Block の text | 150 文字 |
| Context Block の要素 | 10 個 |
| Block Kit Builder の URL | テスト用。本番ではコードから生成すること |

---

## それでも解決しない場合

1. **GAS のログを確認**: GAS エディタ → 「実行数」で過去の実行ログを確認
2. **Slack API のレスポンスをログ出力**: `console.log(JSON.stringify(result))` で詳細を確認
3. **Slack API のドキュメントを確認**: [https://api.slack.com/methods](https://api.slack.com/methods)
4. **Block Kit Builder でテスト**: [https://app.slack.com/block-kit-builder](https://app.slack.com/block-kit-builder) でメッセージ構造をプレビュー
