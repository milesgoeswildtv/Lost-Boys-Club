# LOST BOYS CLUB — Native Broadcast Panel v0.2.0

## What this adds

A native Chaturbate App V2 **Broadcast Panel Update** handler. This is the information panel displayed in Chaturbate's broadcast panel below the camera, not an overlay composited over the live video.

## Panel layout

Uses the supported `3_rows_of_labels` template:

1. **LOST BOYS CLUB** — CLUBHOUSE OPEN or GUESS THE NUMBER — LIVE.
2. **STATUS / PLAYERS** — idle status or number of guesses submitted and the `!guess 1-100` instruction.
3. **CLUB RECORD** — current top winner and total completed rounds.

The layout is deliberately compact because the native panel is a small display area. It does not attempt to render a full tip menu, multi-screen dashboard, or video overlay.

## Developer Portal setup

1. Open the LOST BOYS CLUB App V2 project.
2. Find the **Broadcast Panel Update** event handler in the handler list.
3. Paste the complete contents of `chaturbate/handlers/broadcast_panel_update.js` into that handler.
4. Ensure Shared Code is the updated version from `chaturbate/shared_code.js`.
5. Grant the app the exclusive **Broadcast panel** permission when adding/running the app. Only one app in a room can hold this permission at a time.
6. Save and run the app in Chaturbate Testbed before using it in the live room.

GitHub does not automatically synchronize files into the Developer Portal. The new handler must be copied into the matching event tab.

## Refresh behavior

The shared game logic requests a panel refresh when:
- A round starts.
- A non-winning guess is accepted.
- A round ends by winner, timeout, or broadcaster stop.

Chaturbate documents panel reload throttling at one request per second per app. No per-second countdown timer is used; the panel remains quiet between meaningful state changes.

## Acceptance tests

- [ ] Handler saves and validates in the App V2 editor.
- [ ] App has the Broadcast panel permission.
- [ ] Idle panel displays club identity, idle status, and records.
- [ ] Starting a round changes the panel to live game status.
- [ ] A valid non-winning guess updates the displayed guess count.
- [ ] A correct guess ends the round and refreshes the panel.
- [ ] Timeout refreshes the panel.
- [ ] Broadcaster stop refreshes the panel.
- [ ] Existing welcome, chat, tip, and callback handlers continue to work.
- [ ] Panel remains readable in iPhone Safari / mobile room view.

## Verification status

The source files are committed to GitHub. Chaturbate editor validation, permission grant, Testbed rendering, and iPhone verification remain pending. Do not mark this feature released until those checks pass.
