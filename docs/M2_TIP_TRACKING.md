# LOST BOYS CLUB — M2 Tip Tracking

## Included

- Every non-zero tip is counted in persistent App V2 KV storage.
- Aggregate total tokens, total tip count, and largest single tip are retained.
- The largest tipper name is retained only for non-anonymous tips.
- Anonymous tips are grouped under a generic label.
- Thank-you notices are throttled to one per supporter every 45 seconds. Anonymous supporters share one cooldown bucket.
- Viewers can type `!clubstats` to see the aggregate clubhouse support record.
- Tip support does not grant game advantages, entries, or outcomes.

## Portal deployment

GitHub does not sync automatically to the Chaturbate Developer Portal.

1. Replace the **Tip Received** handler with the complete contents of `chaturbate/handlers/tip_received.js`.
2. In **Chat Message**, replace the handler with the complete contents of `chaturbate/handlers/chat_message.js`.
3. Do not change Shared Code, Broadcast Panel Update, Callback, or App Start for this feature.
4. Save both handlers and check for editor errors.
5. In Testbed, send a small test tip (or use the available test event), then type `!clubstats`.
6. Send a second tip from the same test account within 45 seconds. Both tips should count, but only one thank-you notice should appear.

Existing tip totals are not imported; tracking begins when this handler version is installed. Totals persist in the app KV store across broadcasts.

## Local QA

- JavaScript syntax checks: passed.
- Mock tip events: two tips (25 + 10) produced 35 total tokens and 2 tips.
- Largest-tip record: 25 tokens, TestViewer.
- Acknowledgement cooldown: one notice for two tips from the same viewer inside 45 seconds.
- `!clubstats` output: confirmed against mocked KV data.

## Not yet verified

- Chaturbate editor validation after paste.
- Actual Testbed tip event delivery and token payload.
- Actual Testbed notice throttling.
- Persistence across app restart/broadcast.
