# QA Record — Native Broadcast Panel v0.2.0

Date: 2026-11-16

## Local mocked-runtime checks

Executed the current Shared Code and Broadcast Panel Update handler in a JavaScript isolate with mocked Chaturbate globals and storage.

- [x] Shared Code parses successfully.
- [x] Broadcast Panel Update handler parses successfully.
- [x] Existing Chat Message, Callback, and Tip Received handlers parse successfully.
- [x] Idle panel returns CLUBHOUSE OPEN state.
- [x] Starting a round changes panel data to GUESS THE NUMBER — LIVE.
- [x] Active panel data includes the current submitted-guess count.
- [x] Correct guess ends the round and records the winner.
- [x] Round start and completion each request a panel refresh.
- [x] Broadcast Panel Update handler calls `$room.setPanelTemplate()` with the supported `3_rows_of_labels` template.
- [x] Mocked panel renderer received the expected row labels and values.

## Not verified

- [ ] Chaturbate Developer Portal editor validation.
- [ ] Exclusive Broadcast panel permission granted to LOST BOYS CLUB.
- [ ] Actual Chaturbate Testbed panel rendering.
- [ ] iPhone Safari/mobile room layout.
- [ ] Live-room behavior.

## Result

**Local mocked-runtime checks pass. This is not a Chaturbate Testbed pass and does not mean the panel is deployed.**

The new handler must be pasted into the Developer Portal's **Broadcast Panel Update** tab, the updated Shared Code must be pasted, and the app must be granted the exclusive **Broadcast panel** permission. Complete Testbed and iPhone checks before release.
