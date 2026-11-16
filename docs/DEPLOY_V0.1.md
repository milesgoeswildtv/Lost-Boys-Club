# Deploy LOST BOYS CLUB v0.1.0

This release is a first functional slice: app startup, anti-spam welcomes, a free Guess the Number game, scoreboard, and tip acknowledgement.

## Important
GitHub is the source of truth, but the Chaturbate Developer Portal does not automatically sync with GitHub. Paste the files below into the matching editor tabs. Do not click Release yet; first validate in Testbed.

## 1. Shared Code
Paste the complete contents of `chaturbate/shared_code.js` into **Shared Code**.

## 2. Event handlers
Paste each file into its identically named event handler:

| Developer Portal handler | Repository file |
|---|---|
| App Start | `chaturbate/handlers/app_start.js` |
| App Stop | `chaturbate/handlers/app_stop.js` |
| User Enter | `chaturbate/handlers/user_enter.js` |
| Chat Message | `chaturbate/handlers/chat_message.js` |
| Callback | `chaturbate/handlers/callback.js` |
| Tip Received | `chaturbate/handlers/tip_received.js` |
| Broadcast Panel Update | `chaturbate/handlers/broadcast_panel_update.js` |

Other handlers remain intentionally empty in v0.1.0.

## 3. Commands

- Broadcaster: `/lbc start` — starts a 90-second free round.
- Broadcaster: `/lbc stop` — ends the active round.
- Broadcaster: `/lbc help` — displays help privately.
- Viewer: `!guess 42` — submits one guess from 1 to 100.
- Viewer: `!game` — privately checks game status.
- Viewer: `!scoreboard` — displays the top winner.
- Viewer: `!lbc` — privately receives instructions.

## 4. Testbed acceptance checklist

- [ ] App starts without an error.
- [ ] Owner receives the startup notice.
- [ ] New viewer receives a welcome.
- [ ] Re-entering viewer within six hours is not greeted again.
- [ ] Owner starts a round with `/lbc start`.
- [ ] Viewer can submit a valid guess.
- [ ] Invalid guesses are rejected privately.
- [ ] A second guess from the same viewer is rejected.
- [ ] Correct guess ends the round exactly once and records a win.
- [ ] Timeout ends the round and reveals the number.
- [ ] Owner can manually stop a round.
- [ ] `!scoreboard` displays persisted records.
- [ ] Anonymous tip acknowledgment does not reveal the tipper's username.
- [ ] No viewer needs to tip to play.
- [ ] No real-money/token prize or paid-entry mechanic exists.

## 5. Native broadcast panel addition (development milestone 0.2.0)

- Add `chaturbate/handlers/broadcast_panel_update.js` to the **Broadcast Panel Update** event tab.
- Grant the app the exclusive **Broadcast panel** permission when prompted. This permission can only be held by one running app at a time.
- The panel uses Chaturbate's native `3_rows_of_labels` template: club status, current game/player count, and top club record.
- Shared Code calls `$room.reloadPanel()` when a round starts or ends and when a non-winning guess is recorded. Reload requests are throttled by Chaturbate to once per second.
- The panel is below the camera in Chaturbate's broadcast panel; it is not a graphic over the video.

## 6. Known limitations

- The panel is intentionally compact and text-based; the native row template does not provide a full custom page or large graphic layout.
- The first game is text-command driven.
- Scoreboard records persist by app/broadcaster using Chaturbate KV.
- The app does not connect to external services or load external scripts.
- The game uses a 90-second round timer; if the callback is unavailable in a test environment, the broadcaster can use `/lbc stop`.
