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


## Brotherhood Wars — Team Competition

Broadcaster setup:

- `/ab teams create Night Owls` — create a team (maximum 8).
- `/ab teams delete Night Owls` — delete an empty team.
- `/ab teams list` — show standings.
- `/ab teams assign username Team Name` / `unassign username` — manage membership.
- `/ab teams reset` — reset season scores without changing memberships.
- `/ab teams season start Season Name` — archive the prior standings and start a fresh season.
- `/ab teams season history` — show recent champions.

Viewer commands:

- `!teams` — view current standings.
- `!team` — privately view your team.
- `!jointeam Team Name` — join one team.
- `!leaveteam` — leave your current team.

Each viewer may belong to one team at a time. A successful free-game participation award adds 1 team point; a successful game-win award adds 5. Duplicate loyalty awards do not score twice. Tips and purchases never add team points. Up to 8 teams and 250 members per team are supported.


## Brotherhood Vault — Shared Progression

The Vault tracks cumulative points from successful free-game participation and game-win awards only. Tips, purchases, manual bonus grants, and reward redemptions do not advance shared progress.

Viewer commands:

- `!vault` — see total shared game points, unlocked milestones, and progress to the next milestone.
- `!achievements` — privately see personal achievement unlocks.

Milestones unlock at 100, 250, 500, 1,000, 2,500, 5,000, and 10,000 shared free-game points. Unlocks are permanent and announced in chat. These are community recognition milestones, not purchased perks or gameplay advantages.

Broadcaster status: `/ab admin vault`.

## Hall of Fame — Permanent Records

- `!halloffame` or `!halloffame wins` — top game victories.
- `!halloffame games` — most free-game participations.
- `!halloffame points` — most points earned from free games.
- `/ab admin halloffame`
- `/ab admin queue` — viewer waitlist and scheduled booking status — broadcaster overview.

Personal achievements currently recognize first game, 10 and 25 games, first win, 5 and 25 wins, and 10, 50, and 100 free-game points. Hall of Fame and Vault point totals exclude manual bonus grants. These systems record successful loyalty awards and do not change the underlying reward balance.


## Advanced Viewer Queue — Waitlist & Scheduled Slots

The viewer queue is a free, persistent room coordination feature. It is separate from the room-goal queue and does not award or spend loyalty points.

Viewer commands:

- `!queue` — show the active turn, waitlist, and queue capacity.
- `!joinqueue` — join the FIFO waitlist.
- `!leavequeue` — leave the waitlist.
- `!slots` — view future scheduled slots.
- `!book 1` — book an available slot by its displayed ID.
- `!cancelbooking` — cancel your scheduled booking.

Broadcaster commands:

- `/ab queue status` or `/ab queue` — show queue status.
- `/ab queue next` — call the next viewer into the active turn.
- `/ab queue done` — complete the active turn.
- `/ab queue skip` — move the active viewer to the back of the waitlist.
- `/ab queue pause` / `/ab queue resume` — pause or reopen waitlist entry.
- `/ab queue clear` — clear the waitlist and active turn; scheduled bookings are preserved.
- `/ab queue limit 25` — set capacity (maximum 50).
- `/ab queue announce` — announce current queue state.
- `/ab queue slot add 2026-11-21T20:30:00-05:00 Label` — create a future slot using an ISO date/time with an explicit timezone.
- `/ab queue slot list` — show upcoming slots.
- `/ab queue slot remove 1` — remove a slot by ID.

The waitlist is first-in, first-out. Each viewer may hold one scheduled slot at a time. Bookings are free; one slot cannot be booked twice. The app announces a booked slot five minutes before its scheduled time when its callback is running. Queue and booking state persist in Chaturbate KV. The queue holds up to 50 waiting viewers and 30 scheduled slots. The broadcaster manually calls and closes each live turn; scheduled bookings do not automatically interrupt an active game or viewer turn.

Storage key: `lbc_ab_viewer_queue_v1`.
