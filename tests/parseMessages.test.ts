import assert from "node:assert/strict";
import { parseMessages } from "../lib/telegram-scraper";

const html = `
  <div class="tgme_widget_message" data-post="sample_channel/42">
    <div class="tgme_widget_message_text">First line<br>Second line</div>
    <time datetime="2026-04-27T06:30:00+00:00"></time>
    <span class="tgme_widget_message_views">1.2K</span>
  </div>
  <div class="tgme_widget_message" data-post="sample_channel/43">
    <a class="tgme_widget_message_photo_wrap"></a>
    <time datetime="2026-04-27T06:35:00+00:00"></time>
  </div>
  <div class="tgme_widget_message" data-post="sample_channel/44">
    <time datetime="not-a-date"></time>
    <div class="tgme_widget_message_text">Invalid date should be skipped</div>
  </div>
`;

const messages = parseMessages(html);

assert.equal(messages.length, 2);

assert.deepEqual(
  messages.map((message) => message.telegramPostId),
  ["sample_channel/42", "sample_channel/43"]
);

assert.equal(messages[0].text, "First line\nSecond line");
assert.equal(messages[0].views, "1.2K");
assert.equal(messages[0].hasMedia, false);
assert.equal(messages[0].postedAt.toISOString(), "2026-04-27T06:30:00.000Z");

assert.equal(messages[1].text, "");
assert.equal(messages[1].hasMedia, true);
assert.equal(messages[1].postedAt.toISOString(), "2026-04-27T06:35:00.000Z");

console.log("parseMessages smoke test passed");
