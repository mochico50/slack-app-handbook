// ============================
// Slack API 共通関数
// ============================

/**
 * ScriptProperties から Slack Bot Token を取得する
 * @returns {string} Slack Bot Token（xoxb-xxxx 形式）
 * @throws {Error} SLACK_BOT_TOKEN が未設定の場合
 */
const getSlackToken = () => {
  const token = PropertiesService.getScriptProperties().getProperty("SLACK_BOT_TOKEN");
  if (!token) {
    throw new Error("SLACK_BOT_TOKEN が設定されていません。");
  }
  return token;
};

/**
 * Block Kit メッセージを Slack チャンネルに投稿する
 * @param {string} channel - 投稿先チャンネル ID
 * @param {Object[]} blocks - Block Kit のブロック配列
 * @param {string} text - 通知やアクセシビリティ用のフォールバックテキスト
 * @returns {Object} Slack API のレスポンス
 * @throws {Error} Slack API がエラーを返した場合
 */
const postBlockMessage = (channel, blocks, text) => {
  const token = getSlackToken();
  const url = "https://slack.com/api/chat.postMessage";

  const payload = { channel, blocks, text };

  const options = {
    method: "post",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  const response = UrlFetchApp.fetch(url, options);
  const result = JSON.parse(response.getContentText());

  if (!result.ok) {
    throw new Error(`Slack API エラー: ${result.error}`);
  }

  return result;
};

// ============================
// 重複チェック
// ============================

/**
 * イベントの重複を検知する（リトライ対策）
 * @param {string} eventTs - イベントのタイムスタンプ
 * @returns {boolean} true: 重複（すでに処理済み）
 */
const isDuplicate = (eventTs) => {
  const cache = CacheService.getScriptCache();
  const cached = cache.get(`event_${eventTs}`);

  if (cached) {
    return true;
  }

  // 10分間キャッシュ（リトライの間隔を十分カバー）
  cache.put(`event_${eventTs}`, "processed", 600);
  return false;
};

// ============================
// エントリーポイント
// ============================

/**
 * Slack からの POST リクエストを受け取るエントリーポイント
 * Event Subscriptions（JSON）と Slash Commands / Interactivity（form-urlencoded）を判別して処理する
 * @param {Object} e - GAS の doPost イベントオブジェクト
 * @returns {GoogleAppsScript.Content.TextOutput} レスポンス
 * @see https://docs.slack.dev/reference/events/url_verification/
 */
function doPost(e) {
  // リクエストボディの JSON パースを試みる
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    body = null;
  }

  // JSON ボディがある場合（Event Subscriptions）
  if (body) {
    // URL Verification への応答
    // Slack が Request URL 設定時に送信する challenge をそのまま返す
    // @see https://docs.slack.dev/reference/events/url_verification/
    if (body.type === "url_verification") {
      return ContentService.createTextOutput(body.challenge);
    }

    // イベントの処理
    if (body.type === "event_callback") {
      if (isDuplicate(body.event.event_ts)) {
        return ContentService.createTextOutput("OK");
      }
      return handleEvent(body);
    }
  }

  // form-urlencoded の場合（Slash Commands / Interactivity）
  const params = e.parameter;

  if (params.command) {
    return handleSlashCommand(params);
  }

  if (params.payload) {
    const payload = JSON.parse(params.payload);
    if (payload.type === "view_submission") {
      return handleViewSubmission(payload);
    }
  }

  return ContentService.createTextOutput("OK");
}

// ============================
// Event 処理
// ============================

/**
 * Slack イベントを処理する
 * @param {Object} body - event_callback のペイロード
 * @returns {GoogleAppsScript.Content.TextOutput} レスポンス
 */
const handleEvent = (body) => {
  const event = body.event;

  if (event.type === "team_join") {
    handleTeamJoin(event);
  }

  return ContentService.createTextOutput("OK");
};

/**
 * ワークスペース参加イベントを処理し、Welcome メッセージを特定チャンネルに送信する
 * @param {Object} event - team_join イベントオブジェクト
 */
const handleTeamJoin = (event) => {
  const userId = event.user.id;

  // Bot 自身の参加イベントはスキップ（無限ループ防止）
  const botUserId = PropertiesService.getScriptProperties().getProperty("BOT_USER_ID");
  if (botUserId && userId === botUserId) {
    Logger.log("Bot 自身の参加イベントをスキップしました。");
    return;
  }

  // 通知先チャンネルを ScriptProperties から取得
  const channelId = PropertiesService.getScriptProperties().getProperty("SLACK_CHANNEL_ID");
  if (!channelId) {
    throw new Error("SLACK_CHANNEL_ID が設定されていません。");
  }

  const blocks = buildWelcomeBlocks(userId);
  postBlockMessage(channelId, blocks, "ようこそ！");
};

/**
 * コンテナバインドしているスプレッドシートの A1 セルから Welcome メッセージ本文を取得する
 * @returns {string} メッセージ本文
 * @throws {Error} スプレッドシートまたは A1 セルが空の場合
 */
const getWelcomeMessage = () => {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const message = sheet.getRange("A1").getValue();
  if (!message) {
    throw new Error("スプレッドシートの A1 セルにメッセージが設定されていません。");
  }
  return message;
};

/**
 * Welcome メッセージの Block Kit を組み立てる
 * @param {string} userId - 参加したユーザーの ID
 * @returns {Object[]} Block Kit のブロック配列
 */
const buildWelcomeBlocks = (userId) => {
  const message = getWelcomeMessage();

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*👋 ようこそ <@${userId}> ！*`,
      },
    },
    { type: "divider" },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: message,
      },
    },
  ];
};

// ============================
// デバッグ用
// ============================

/**
 * デバッグ用: 手動で Welcome メッセージ送信をテストする
 * GAS エディタから直接実行して動作確認が可能
 *
 * ScriptProperties に以下を設定してから実行:
 *   - DEBUG_USER_ID: テスト対象のユーザー ID（例: U0XXXXXXX）
 *   - SLACK_CHANNEL_ID: 投稿先チャンネル ID
 *   - SLACK_BOT_TOKEN: Bot Token
 */
function debugSendWelcomeMessage() {
  const debugUserId = PropertiesService.getScriptProperties().getProperty("DEBUG_USER_ID");
  if (!debugUserId) {
    throw new Error("DEBUG_USER_ID が設定されていません。ScriptProperties に設定してください。");
  }

  const channelId = PropertiesService.getScriptProperties().getProperty("SLACK_CHANNEL_ID");
  if (!channelId) {
    throw new Error("SLACK_CHANNEL_ID が設定されていません。");
  }

  Logger.log(`デバッグ: ユーザー ${debugUserId} の Welcome メッセージを ${channelId} に送信します...`);

  const blocks = buildWelcomeBlocks(debugUserId);
  Logger.log(`デバッグ: 送信するブロック:\n${JSON.stringify(blocks, null, 2)}`);

  const result = postBlockMessage(channelId, blocks, "ようこそ！（デバッグ）");

  Logger.log(`デバッグ: 送信成功 - ts: ${result.ts}`);
}
