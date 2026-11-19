# Test Plan — LOST BOYS CLUB

## Test environments
- Chaturbate Testbed desktop/web environment.
- Chaturbate mobile Testbed on iPhone.
- Live room only after all testbed checks pass and the broadcaster explicitly approves release.

## M0 checks
- [ ] Confirm project is App V2 (not legacy V1 bot).
- [ ] Confirm app title, app ID/link, and current version.
- [ ] Record all configured handlers and permissions.
- [ ] Confirm no credentials or private performer details are committed.

## M1: Core and Guess the Number
- [ ] App starts with empty KV store.
- [ ] App starts with existing valid KV data.
- [ ] App handles missing or malformed KV data without crashing.
- [ ] Welcome fires once per intended entry and respects cooldown.
- [ ] Welcome can be disabled in settings.
- [ ] Unrelated chat messages do not trigger game behavior.
- [ ] Broadcaster can start a round.
- [ ] A valid guess is accepted.
- [ ] Invalid, out-of-range, and non-numeric guesses are rejected cleanly.
- [ ] Duplicate guesses from the same user are handled consistently.
- [ ] Winner is announced exactly once.
- [ ] Round ends and a new round can start.
- [ ] Concurrent guesses do not corrupt round state.
- [ ] No viewer must tip to participate.
- [ ] No paid-entry or prize mechanic exists.
- [ ] Notices are throttled and do not flood chat.
- [ ] Panel accurately reflects idle / active / completed state.

## M2.3: Configurable informational tip menu
- [ ] Empty menu responds clearly to !tipmenu.
- [ ] Broadcaster can add a valid amount and label.
- [ ] Items persist after app restart and display sorted by amount.
- [ ] Duplicate token amounts are rejected.
- [ ] Invalid amounts, missing labels, and overlong labels are handled safely.
- [ ] Broadcaster can remove an item by its displayed index.
- [ ] Broadcaster can clear the menu.
- [ ] Viewers cannot add, remove, or clear menu entries.
- [ ] Ordinary chat does not trigger menu output.
- [ ] Display clearly states that tips are voluntary and requests are not guaranteed.
- [ ] Tip events do not automatically execute menu actions or grant game advantages.

## Mobile checks
- [ ] Testbed opens and remains usable in iPhone Safari.
- [ ] Instructions are readable at phone width.
- [ ] Panel content does not overflow horizontally.
- [ ] Long usernames and messages do not break layout.
- [ ] Broadcaster can operate essential controls from phone browser.

## Release gate
Do not release to the public App Directory or live room until all applicable checks pass and the broadcaster approves the exact version.


## M2.4: Rotating room announcements
- [ ] Announcements are disabled by default on a fresh install.
- [ ] Non-owner commands cannot enable, disable, or inspect broadcaster controls.
- [ ] Broadcaster can enable announcements; first notice is delayed 15 minutes.
- [ ] Exactly one announcement is emitted per scheduled interval.
- [ ] Messages rotate in order and wrap to the first message.
- [ ] Broadcaster can disable announcements before the next callback.
- [ ] A stale callback after disable or re-enable is ignored.
- [ ] App restart reschedules one callback when announcements were enabled.
- [ ] Ordinary chat does not trigger announcements.
- [ ] Announcement copy contains no tipping pressure or paid-entry language.


## M2.5: Custom broadcaster announcements
- [ ] Broadcaster can post a one-off announcement with /lbc say.
- [ ] Announcement appears once in the public room.
- [ ] Broadcaster receives a private confirmation.
- [ ] Blank /lbc say command returns private usage guidance and posts nothing publicly.
- [ ] Messages longer than 200 characters are rejected without truncation or public output.
- [ ] Newlines and tabs are normalized to spaces so the announcement remains one line.
- [ ] Non-owner use of /lbc say produces no public announcement.
- [ ] Unrelated chat beginning with similar text does not trigger an announcement.
- [ ] No callback, timer, or recurring schedule is created.


## M3.0: Guess the Number player guidance
- [ ] !howtoplay returns the full guide privately to the requesting viewer.
- [ ] !gamehelp returns the same guide.
- [ ] Guide clearly states the game is free and no tip or purchase is required.
- [ ] Guide explains 1–100, one guess per round, private higher/lower hints, and !game.
- [ ] Bare !guess returns private syntax guidance.
- [ ] !guess abc and malformed multi-value guesses return private syntax guidance.
- [ ] Valid one-to-three-digit guesses are not given duplicate guidance.
- [ ] Out-of-range numeric guesses continue to receive the existing core validation response only.
- [ ] Ordinary chat does not trigger guidance.
- [ ] Existing round start, end, timer, winner, records, and panel behavior remain unchanged.


## M3.1: Higher or Lower
- [ ] Broadcaster can start with /lbc higher start and stop with /lbc higher stop.
- [ ] A second game cannot start while Higher or Lower is already active.
- [ ] Higher or Lower cannot start while Guess the Number is active.
- [ ] Starting number is shown; hidden next number is not exposed before round end.
- [ ] !higher and !lower are accepted only during an active round.
- [ ] Each viewer can lock exactly one prediction per round.
- [ ] Prediction acknowledgement is private; other viewers cannot see a user's choice.
- [ ] Correct direction and all correct callers are announced at round end.
- [ ] Timeout and broadcaster stop both close the round exactly once.
- [ ] Stale callbacks after stop or restart are ignored.
- [ ] App restart restores one valid callback for an active round.
- [ ] !higherhelp and !higherstatus return private guidance/status.
- [ ] No tip, purchase, paid entry, or prize is required or implied.
