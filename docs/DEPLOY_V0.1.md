# LOST BOYS CLUB — Deployment Notes (Native Panel mobile-safe update)

## Important

**Do not replace Shared Code for this panel update.** The existing Shared Code is left untouched. GitHub does not automatically sync to the Chaturbate Developer Portal, so only the three event tabs listed below need attention.

## Minimal Developer Portal changes

1. Paste the complete contents of `chaturbate/handlers/broadcast_panel_update.js` into **Broadcast Panel Update**.
2. In **Chat Message**, keep the existing line:
   `LBC.onChatMessage($message.body, $user.username, $user.isOwner);`
   Immediately below it, add:
   ```js
   if (/^\s*(\/lbc\s+(start|stop)|!guess\s+\d{1,3})\s*$/i.test(String($message.body || ""))) {
     $room.reloadPanel();
   }
   ```
3. In **Callback**, keep the existing line:
   `LBC.onCallback($callback.label);`
   Immediately below it, add:
   `$room.reloadPanel();`
4. Do not change Shared Code, App Start, Tip Received, or any other handler for this panel update.
5. Grant LOST BOYS CLUB the exclusive **Broadcast panel** permission. Only one app in the room can hold this permission at a time.
6. Test in Chaturbate Testbed before release, then verify the display on iPhone.

## Why the two small refresh additions exist

- Chat Message refreshes only after commands that can change game state: `/lbc start`, `/lbc stop`, and `!guess 42`.
- Callback refreshes after the timed round callback, which may end a round.
- The panel handler reads the existing `LBC.panelData()` and tolerates both the older data shape and the newer optional fields. It does not require the 0.2 Shared Code replacement.

## Game commands

- Broadcaster: `/lbc start` — starts a 90-second free round.
- Broadcaster: `/lbc stop` — ends the active round.
- Broadcaster: `/lbc help` — displays help privately.
- Viewer: `!guess 42` — submits one guess from 1 to 100.
- Viewer: `!game` — privately checks game status.
- Viewer: `!scoreboard` — displays the top winner.
- Viewer: `!lbc` — privately receives instructions.

## Testbed acceptance checklist

- [ ] App saves and starts without errors.
- [ ] Idle panel shows LOST BOYS CLUB and the club record.
- [ ] `/lbc start` changes the panel to live status.
- [ ] A valid non-winning `!guess` causes a panel refresh.
- [ ] Correct guess updates the record and returns the panel to idle.
- [ ] Timeout refreshes the panel.
- [ ] `/lbc stop` returns the panel to idle.
- [ ] Existing welcome, tip acknowledgement, chat, and callback behavior still works.
- [ ] Panel is readable on iPhone.

## Known limitations

The panel is a compact native Chaturbate broadcast panel below the camera, not a graphic composited over the video. It uses the native three-row label template and is text-only.
