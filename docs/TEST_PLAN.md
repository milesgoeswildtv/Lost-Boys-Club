# Test Plan — AFTERDARK BROTHERHOOD

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


## Advanced Goal Engine
- [ ] `/ab goal set 100 Main Goal` creates a goal and captures the current aggregate tip total as baseline.
- [ ] `!goal` and legacy `!clubgoal` report the same progress.
- [ ] Default milestones announce once at 25%, 50%, 75%, and 100%.
- [ ] Custom milestones accept valid whole percentages and always include 100%.
- [ ] Pausing excludes tips received during the pause after resuming.
- [ ] Reset restarts progress from the current total without changing the target.
- [ ] Extend increases the target without resetting already-earned progress.
- [ ] Queued goals persist, activate sequentially, and are removed from the queue once activated.
- [ ] Queue limit is enforced at 10; clear removes queued goals only.
- [ ] Turning the goal off preserves queued goals.
- [ ] Native panel reflects live, paused, completed, and inactive goal states.
- [ ] Existing tip totals and the existing Broadcast Panel Update handler remain intact.

## Loyalty & Rewards
- [ ] A valid free-game participation event awards one point once per viewer per round.
- [ ] A game win awards five bonus points; repeat delivery does not duplicate the award.
- [ ] Tips never award points, redemption entries, game access, or game advantages.
- [ ] `!points` displays the viewer's balance and totals privately.
- [ ] `!rewards` displays the reward shelf.
- [ ] Broadcaster can add, remove, and list reward items; the 12-item limit is enforced.
- [ ] `!redeem <id>` deducts the listed cost and creates a persistent pending request.
- [ ] A viewer cannot have more than three pending requests.
- [ ] Broadcaster can list, approve, and deny pending requests.
- [ ] Denial refunds the exact points deducted.
- [ ] Non-owner users cannot administer rewards or grant points.
- [ ] Balances and requests persist across app restart.
- [ ] Invalid usernames, amounts, IDs, and malformed stored data fail safely.
- [ ] Approved rewards are manually fulfilled by the broadcaster; no cash value or random prize claim is implied.


## M2.5: Loyalty & rewards integration (required before release)
- [ ] In Testbed, a viewer sends !points; they receive a private balance response, including a zero balance for a first-time viewer.
- [ ] Broadcaster sends /ab rewards add 100 Reward Name; the reward appears in !rewards.
- [ ] A viewer with sufficient points sends !redeem 1; one pending request is created and the exact cost is reserved.
- [ ] Broadcaster sends /ab rewards pending; the request is listed.
- [ ] Broadcaster denies the request; the viewer receives an exact refund and the request is no longer pending.
- [ ] Repeat redemption and approve the request; approval does not refund points and is marked approved.
- [ ] Broadcaster bonus grant /ab points grant username 10 updates the named viewer balance.
- [ ] Guess the Number awards 1 point for a valid entry and 5 additional points for a win; duplicate event processing does not double-award.
- [ ] Higher or Lower, Couple Trivia, and eligible After Hours entries/wins award their documented points once.
- [ ] Tips do not award loyalty points.
- [ ] Restart the app and verify balances, catalogue, and requests persist.
- [ ] Verify viewer commands work for non-owner accounts and broadcaster controls are rejected for non-owners.

## Branding regression
- [ ] Search all active Shared Code and event-handler messages for old Lost Boys Club, Clubhouse, and old player-facing club labels.
- [ ] Confirm startup, game, reward, support-stat, and broadcast-panel messages display AFTERDARK BROTHERHOOD branding.
- [ ] Confirm the current public support command is !supportstats; no old !clubstats or !clubgoal wording is advertised.


## Member Profiles & Leaderboards

- Award one valid game participation point and one game win award to a test viewer.
- Confirm `!profile` privately shows the viewer's points, participation, wins, and win rate.
- Confirm `!profile username` is delivered privately to the requesting viewer.
- Confirm `!leaderboard wins`, `!leaderboard games`, and `!leaderboard points` sort the tracked members correctly.
- Replay an award with the same idempotency key; confirm neither points nor member statistics increase.
- Confirm a new app session reads the same profile data from persistent KV.

## Admin Control Center

- As broadcaster, run `/ab admin` and confirm game, goal, reward, tip-menu, announcement, and module status.
- Run each subsystem view: `/ab admin games`, `goals`, `rewards`, `menu`, and `announcements`.
- Run `/ab admin members` and confirm the tracked member count.
- Run `/ab admin help` and verify command map.
- As an ordinary viewer, run `/ab admin`; confirm no admin dashboard is disclosed.
- Confirm existing `/ab goal`, `/ab rewards`, `/ab menu`, game start/stop, and announcement commands still operate unchanged.


## Free-Entry Giveaway QA

- Broadcaster starts a giveaway with `/ab giveaway start Test Prize`.
- Viewer `!giveaway` receives current prize, status, and entry instructions.
- Viewer `!enter` receives private confirmation and is stored once.
- Repeating `!enter` does not create a duplicate entry.
- A second viewer can enter independently.
- Broadcaster `/ab giveaway end` closes entries; late `!enter` attempts are rejected.
- Broadcaster `/ab giveaway draw` selects exactly one of the stored entrants and saves the result to history.
- `/ab giveaway history` shows the completed draw.
- `/ab giveaway cancel` closes an open or awaiting-draw giveaway without selecting a winner.
- Confirm no tip or loyalty point command is required or grants additional entries.
- Confirm only the broadcaster can run giveaway management commands.


## Brotherhood Wars QA

- Broadcaster creates two teams; duplicate names and a ninth team are rejected.
- Viewers join teams; duplicate membership and joining a second team without leaving are rejected.
- `!team` privately displays current team and score; `!teams` displays standings.
- Award a game participation point to a team member; confirm exactly 1 team point.
- Award a game win to a team member; confirm exactly 5 additional team points.
- Replay an award with the same idempotency key; confirm no duplicate team score.
- Confirm tips and broadcaster bonus point grants do not add team score.
- Broadcaster assign/unassign works; team deletion is blocked while members remain.
- Season start archives the prior champion and resets scores while preserving memberships.
- Confirm only the broadcaster can create, delete, assign, reset, or start seasons.


## Brotherhood Vault QA

- Start with an empty Vault and confirm `!vault` reports 0 shared game points and the first milestone.
- Award successful game participation and win points; confirm only those points advance shared progress.
- Confirm a manual broadcaster bonus grant does not advance Vault totals.
- Replay an award with the same idempotency key; confirm the Vault does not advance twice.
- Cross each milestone threshold; confirm it unlocks once and is persisted.
- Confirm `!achievements` privately shows personal achievements and new achievements unlock once.
- Confirm a new app session reads the same Vault and member achievement data.

## Hall of Fame QA

- `!halloffame wins`, `games`, and `points` show correctly sorted top-five records.
- Confirm participation, win, and free-game point records match successful awards.
- Confirm manual bonus grants and tips do not inflate Hall of Fame points.
- Confirm duplicate award IDs do not change records.
- Confirm `/ab admin vault` and `/ab admin halloffame` show broadcaster status.
- Confirm ordinary viewers cannot access broadcaster admin status.


## Advanced Viewer Queue QA

- Fresh storage reports an empty queue and available capacity.
- Viewer joins; FIFO position and public queue count update.
- Duplicate join is rejected without creating another entry.
- Viewer leaves; following positions close the gap.
- Queue capacity is enforced at the configured limit and cannot exceed 50.
- Pausing blocks new joins; resuming permits them.
- Broadcaster calls next; exactly one active viewer is set and removed from waitlist.
- Calling next while a turn is active is rejected.
- Done closes the active turn and records completion history.
- Skip moves the active viewer to the end of the waitlist.
- Clear removes waiting and active turns but preserves scheduled bookings.
- Broadcaster-only controls reject ordinary viewers.
- Future ISO slots require explicit timezone and reject invalid/past times.
- A slot can be booked once; another viewer cannot double-book it.
- One viewer cannot book multiple slots; cancellation frees the slot.
- Slot removal frees a booking and cancels reminders as appropriate.
- Five-minute reminder fires once for each booked slot and does not repeat after restart.
- Queue, active turn, slot bookings, pause state, and capacity persist across app restart.
- Tips, loyalty points, and paid actions do not affect queue position or slot booking.
