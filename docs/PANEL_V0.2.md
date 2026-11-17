# LOST BOYS CLUB — Native Broadcast Panel v0.2.1 (mobile-safe deployment)

## What this adds

A native Chaturbate App V2 **Broadcast Panel Update** handler. This is the information panel in Chaturbate's broadcast panel below the camera, not an overlay composited over the live video.

## Critical mobile-editor decision

**Shared Code does not need to be replaced.** The new panel handler is backward-compatible with the existing `LBC.panelData()` data shape. Refresh behavior is added with two small additions to existing event handlers.

## Developer Portal changes

1. Paste the complete `chaturbate/handlers/broadcast_panel_update.js` file into **Broadcast Panel Update**.
2. In **Chat Message**, retain the current `LBC.onChatMessage(...)` line and add the short conditional refresh block immediately beneath it (see `docs/DEPLOY_V0.1.md`).
3. In **Callback**, retain `LBC.onCallback($callback.label);` and add `$room.reloadPanel();` immediately beneath it.
4. Leave Shared Code and all other handlers unchanged.
5. Grant the app the exclusive **Broadcast panel** permission. Only one app in a room can hold this permission at a time.
6. Test in Chaturbate Testbed, then verify on iPhone before release.

GitHub does not automatically synchronize files into the Developer Portal.

## Panel layout

Uses the native `3_rows_of_labels` template:

1. **LOST BOYS CLUB** — clubhouse open or active game.
2. **STATUS / GAME STATUS** — idle message or game instructions/status.
3. **CLUB RECORD** — leading winner and total completed rounds.

## Refresh behavior

- Chat Message requests a refresh only for `/lbc start`, `/lbc stop`, and `!guess <number>`.
- Callback requests a refresh after a timed callback.
- The panel update handler reads the existing `LBC.panelData()` function.
- No Shared Code replacement is required.

## Acceptance tests

- [ ] Handler saves and validates in the App V2 editor.
- [ ] App has the Broadcast panel permission.
- [ ] Idle panel displays club identity and records.
- [ ] Starting a round changes the panel to live status.
- [ ] A valid non-winning guess refreshes the panel.
- [ ] Correct guess updates the record and returns to idle.
- [ ] Timeout refreshes the panel.
- [ ] Broadcaster stop refreshes the panel.
- [ ] Existing welcome, chat, tip, and callback handlers continue to work.
- [ ] Panel remains readable in iPhone mobile room view.

## Verification status

Source changes are committed. Local syntax and mocked-handler checks are the only checks performed. Chaturbate editor validation, permission grant, Testbed rendering, and iPhone verification remain pending. Do not mark released until those checks pass.
