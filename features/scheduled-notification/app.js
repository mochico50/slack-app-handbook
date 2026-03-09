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
// カレンダー通知
// ============================

/**
 * 本日の予定を Google Calendar から取得する
 * @returns {GoogleAppsScript.Calendar.CalendarEvent[]} 本日の予定一覧
 * @throws {Error} CALENDAR_ID が未設定、またはカレンダーが見つからない場合
 */
const getTodayEvents = () => {
  const calendarId = PropertiesService.getScriptProperties().getProperty("CALENDAR_ID");
  if (!calendarId) {
    throw new Error("CALENDAR_ID が設定されていません。");
  }

  const calendar = CalendarApp.getCalendarById(calendarId);
  if (!calendar) {
    throw new Error(`カレンダーが見つかりません: ${calendarId}`);
  }

  return calendar.getEventsForDay(new Date());
};

/**
 * Calendar Advanced Service を使って Google Meet の URL を取得する
 * @param {string} calendarId - カレンダー ID
 * @param {string} eventId - イベント ID（CalendarApp の getId() から取得、@google.com サフィックス付き）
 * @returns {string|null} Google Meet の URL。存在しない場合は null
 */
const getMeetUrl = (calendarId, eventId) => {
  try {
    const baseEventId = eventId.split("@")[0];
    const event = Calendar.Events.get(calendarId, baseEventId);
    return event.hangoutLink || null;
  } catch (e) {
    return null;
  }
};

/**
 * カレンダー通知用の Block Kit メッセージを組み立てる
 * @param {GoogleAppsScript.Calendar.CalendarEvent[]} events - 予定一覧（1件以上）
 * @returns {Object[]} Block Kit のブロック配列
 */
const buildCalendarBlocks = (events) => {
  const calendarId = PropertiesService.getScriptProperties().getProperty("CALENDAR_ID");
  const now = new Date();
  const dayOfWeek = ["日", "月", "火", "水", "木", "金", "土"][now.getDay()];
  const today = `${Utilities.formatDate(now, "Asia/Tokyo", "yyyy/MM/dd")} (${dayOfWeek})`;

  const blocks = [
    { type: "header", text: { type: "plain_text", text: `📅 ${today} の予定` } },
    { type: "divider" },
  ];

  events.sort((a, b) => a.getStartTime().getTime() - b.getStartTime().getTime());

  for (const event of events) {
    const timeText = event.isAllDayEvent()
      ? "終日"
      : `${Utilities.formatDate(event.getStartTime(), "Asia/Tokyo", "HH:mm")} - ${Utilities.formatDate(event.getEndTime(), "Asia/Tokyo", "HH:mm")}`;

    const meetUrl = getMeetUrl(calendarId, event.getId());
    const meetText = meetUrl ? ` : [<${meetUrl}|Google Meet>]` : "";

    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: `${timeText} *${event.getTitle()}*${meetText}` },
    });
  }

  return blocks;
};

/**
 * カレンダーの本日の予定を Slack に通知する
 * GAS の時間主導型トリガーから呼び出されることを想定
 * @throws {Error} SLACK_CHANNEL_ID が未設定の場合
 */
function notifyTodaySchedule() {
  const events = getTodayEvents();

  // 予定がない場合は通知しない
  if (events.length === 0) {
    return;
  }

  const blocks = buildCalendarBlocks(events);
  const channelId = PropertiesService.getScriptProperties().getProperty("SLACK_CHANNEL_ID");

  if (!channelId) {
    throw new Error("SLACK_CHANNEL_ID が設定されていません。");
  }

  postBlockMessage(channelId, blocks, `本日の予定: ${events.length}件`);
}
