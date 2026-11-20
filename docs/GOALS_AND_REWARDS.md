# Afterdark Brotherhood — Goals & Rewards

## Advanced Goal Engine

Room goals use the existing aggregate tip counter. The goal baseline is captured when a goal starts or resets. A goal can be paused; tips received during the pause are excluded when it resumes.

Broadcaster commands:

- `/ab goal set 1000 Main Goal` — start or replace the current goal.
- `/ab goal 1000` — compatible shorthand for setting a goal.
- `/ab goal queue 1500 Next Goal` — add a sequential goal (up to 10 queued).
- `/ab goal queue list` / `/ab goal queue clear` — inspect or clear the queue.
- `/ab goal milestones 10 25 50 75 100` — customize milestone notices. 100% is always included.
- `/ab goal pause` / `/ab goal resume` — pause or resume progress accounting.
- `/ab goal extend 250` — increase the active target.
- `/ab goal reset` — restart the current goal from zero without changing its target.
- `/ab goal status` — display the current status.
- `/ab goal off` — turn off the current goal without deleting the queue.

When a goal reaches 100%, the engine announces completion and automatically activates the next queued goal, if one exists. Viewers use `!goal`. The native panel displays the current goal and progress.

## Loyalty & Rewards

Points are a free-play engagement score. They are never awarded for tipping, cannot be purchased, and have no cash value. They do not grant game access, improve odds, or create paid-entry contests.

### Earning

- 1 point for a valid Guess the Number submission (once per viewer per round).
- 1 point for a valid Higher or Lower prediction (once per viewer per round).
- 1 point for a valid formatted submission in an After Hours game (once per viewer per round).
- 5 bonus points for a game winner, including Guess the Number, Higher or Lower, Couple Trivia, and the After Hours games.
- Award IDs are deduplicated so repeated event delivery does not award the same round twice.

### Viewer commands

- `!points` — show personal balance and totals.
- `!rewards` — view the broadcaster's reward shelf.
- `!redeem 1` — submit a request for reward #1.

### Broadcaster commands

- `/ab rewards add 100 Reward name` — add a reward (maximum 12).
- `/ab rewards remove 1` — remove a reward by ID.
- `/ab rewards list` — show the reward shelf.
- `/ab rewards pending` — review pending requests.
- `/ab rewards approve 1` — approve a request; broadcaster fulfillment is then due.
- `/ab rewards deny 1` — deny a request and automatically refund the points.
- `/ab points grant username 10` — issue a broadcaster bonus.

Each viewer may have up to three pending requests. Requests are stored persistently. Approved rewards must be fulfilled by the broadcaster; approval is not an automatic platform action. Reward descriptions should be clear, appropriate, and within platform rules.

## Storage

- Goal state: `lbc_m2_room_goal` (legacy key retained).
- Reward catalogue: `lbc_ab_rewards_catalog`.
- Per-viewer balance/history: `lbc_ab_rewards_user_<username>`.
- Redemption requests: `lbc_ab_rewards_requests`.
- Request sequence: `lbc_ab_rewards_next_id`.

Existing game, tip-stat, and LBC compatibility keys remain unchanged.

## Deployment and QA status

GitHub does not sync to the Chaturbate Developer Portal. The Shared Code and handlers in this repository are source artifacts only until pasted/saved in the portal. The new implementation requires editor validation, Testbed event checks, persistence checks, and mobile panel QA before live use.


## Integration note
The Shared Code central chat dispatcher routes loyalty commands together with the other room systems. The Chat Message event handler must call LBC.onChatMessage exactly once and must not separately call the individual room-system handlers. The Callback event handler likewise calls LBC.onCallback once; callback modules are dispatched centrally. This avoids skipped or duplicate command processing.


## Member Profiles & Leaderboards

Viewer profiles are private replies to the requesting viewer. The profile displays the viewer's current points balance, total points earned, tracked game participation, wins, and win rate.

Viewer commands:

- `!profile` — show your own profile.
- `!profile username` — privately view another tracked member's profile.
- `!leaderboard` or `!leaderboard wins` — top five tracked winners.
- `!leaderboard games` — top five by game participation.
- `!leaderboard points` — top five by current points balance.

The member index is capped at 250 tracked usernames. Profiles are updated only after a loyalty award successfully posts; duplicate award IDs do not inflate member stats. Existing loyalty balances and award history remain authoritative.

## Admin Control Center

Broadcaster-only overview and subsystem status commands:

- `/ab admin` or `/ab admin status` — dashboard for game, goal, rewards, tip menu, announcements, and registered game modules.
- `/ab admin help` — command map.
- `/ab admin games`
- `/ab admin goals`
- `/ab admin rewards`
- `/ab admin menu`
- `/ab admin announcements`
- `/ab admin members` — member tracking count.

The control center is a read-only status console. Existing subsystem commands continue to perform changes; this avoids duplicating business logic or bypassing subsystem validation. Only the broadcaster receives admin status output.


## Free-Entry Giveaways

The giveaway engine is a free-entry room feature. Tips, purchases, and loyalty points never create or improve an entry.

Viewer commands:

- `!giveaway` — view the active giveaway.
- `!enter` — enter once while entries are open.

Broadcaster commands:

- `/ab giveaway start Prize description` — open a giveaway.
- `/ab giveaway status` — display current status publicly.
- `/ab giveaway end` — close entries.
- `/ab giveaway draw` — randomly select one winner after entries close.
- `/ab giveaway cancel` — cancel without selecting a winner.
- `/ab giveaway history` — show recent winners.

The engine allows one active giveaway at a time, one entry per username, up to 500 entries, and stores up to 20 completed results. Prize fulfillment is handled manually by the broadcaster. Keep prize descriptions and fulfillment within Chaturbate rules and applicable law.
