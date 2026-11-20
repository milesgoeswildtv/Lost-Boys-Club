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

When a goal reaches 100%, the engine announces completion and automatically activates the next queued goal, if one exists. Viewers use `!goal` (the older `!clubgoal` alias remains supported). The native panel displays the current goal and progress.

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
