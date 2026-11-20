# Afterdark Brotherhood — Unified Control Center

The primary broadcaster interface is a numbered, chat-driven menu. The broadcaster does not need to memorize subsystem command syntax for common operations.

## Open the Control Center

Send **`/ab`** in broadcaster chat.

Choose a section by sending `/ab` followed by its number:

| Number | Section |
|---:|---|
| 1 | Games |
| 2 | Goals |
| 3 | Tip Menu |
| 4 | Rewards |
| 5 | Brotherhood / permanent VIP |
| 6 | Giveaways |
| 7 | Viewer Queue |
| 8 | Announcements |
| 9 | Live Dashboard |
| 10 | Settings |

Inside a section, send the displayed number to select an action. Send `/ab 0`, `/ab back`, or `/ab` to return to the main menu.

### Guided actions

For actions that need details, the menu asks for the information and shows one consistent input format:

- `/ab value 1000 Main Goal` — create an untimed goal.
- `/ab value 1000 30 Main Goal` — create a 30-minute goal.
- `/ab value 1500 Next Stage` — queue a goal stage.
- `/ab value 50 Song request` — add a tip-menu item.
- `/ab value 100 Choose a song` — add a loyalty reward.
- `/ab value Prize description` — start a free-entry giveaway.

Use `/ab cancel` to cancel a guided action. Menu navigation state expires automatically. The menu only intercepts its own explicit `/ab` commands; ordinary broadcaster chat is not consumed.

## Compatibility shortcuts

Existing direct commands remain available for experienced operators and existing workflows. The menu translates selections into the existing subsystem handlers; it does not replace or duplicate those systems.

Examples:

- Goals: `/ab goal ...` or legacy `/ab admin goal ...`
- Rewards: `/ab rewards ...` or legacy `/ab admin rewards ...`
- Tip menu: `/ab menu ...` or legacy `/ab admin menu ...`
- Giveaways: `/ab giveaway ...`
- Queue: `/ab queue ...`
- Announcements: `/ab announcements ...`
- Guess the Number: `/ab start` and `/ab stop`
- Other games retain their existing game-specific commands.

The old `/ab admin` entry point opens the new main menu. Existing detailed `/ab admin ...` commands remain compatibility shortcuts.

## Native room panel

The existing Chaturbate Broadcast Panel Update handler remains intact. It continues to show the room/game state and the current goal when configured. The Stream Control Center can request a native panel refresh, but the Chaturbate three-row panel is a status display, not an interactive button surface. Broadcaster actions are issued through owner chat commands.

## Permissions and compatibility

- Every `/ab admin ...` alias is routed only when Chaturbate marks the sender as the broadcaster/owner.
- Viewers cannot invoke these controls by typing the same text.
- Existing subsystem handlers, storage keys, and event routing remain the source of truth.
- No game engine, reward ledger, goal state model, or viewer queue data format was replaced.

## Verification

The Shared Code file passed JavaScript syntax compilation after the changes. A mocked runtime exercise verified dashboard rendering, goal create/pause, announcement toggle, tip-menu add, reward add, queue pause, giveaway start, and native panel refresh command. This is code-level mock verification only; Chaturbate Developer Portal synchronization, Testbed QA, and live-room behavior have not been verified by this change.


## Advanced goal engine

The goal engine now supports:

- Unlimited-duration goals or timed goals from 1 to 1,440 minutes.
- Up to 10 queued stages, including individually timed stages.
- Automatic next-stage launch when a goal is reached.
- Token overflow carryover between stages (on by default; configurable).
- Custom milestone percentages (up to 10 marks; 100% is always included).
- Pause/resume that freezes the timer and excludes tips received while paused.
- Optional automatic repeat when the queue is empty.
- Timer recovery on app start and deadline expiry through the existing callback dispatcher.
- Stream Control Center goal status shows remaining time, queue depth, carryover, and repeat state.

### Goal commands

All of these are available through the broadcaster namespace:

| Action | Command |
|---|---|
| Start untimed goal | `/ab admin goal set 1000 Main Goal` |
| Start 30-minute goal | `/ab admin goal timed 1000 30 Main Goal` |
| Queue untimed stage | `/ab admin goal queue 1500 Next Stage` |
| Queue 20-minute stage | `/ab admin goal queue timed 2000 20 Final Stage` |
| Set milestones | `/ab admin goal milestones 10 25 50 75 100` |
| Pause / resume | `/ab admin goal pause` / `/ab admin goal resume` |
| Extend target | `/ab admin goal extend 250` |
| Overflow carryover | `/ab admin goal carryover on` or `off` |
| Repeat completed goal | `/ab admin goal repeat on` or `off` |
| Check timer | `/ab admin goal time` |
| Queue status | `/ab admin goal queue list` |
| Clear queued stages | `/ab admin goal queue clear` |
| Reset / switch off | `/ab admin goal reset` / `/ab admin goal off` |

Timed goals expire automatically. If another stage is queued, it launches after the prior stage completes or expires. Overflow is carried only after successful completion, never after timeout. Paused tips are excluded from goal progress; the underlying room-wide support total remains unchanged.

### Verification

JavaScript syntax compilation passed. Mock-runtime tests verified timed goal creation and callback scheduling, queued-stage auto-advance with 25-token overflow carryover, milestone notices, pause/resume with paused tips excluded, timer restoration, and automatic expiry. These are code-level tests; Chaturbate Developer Portal synchronization, Testbed QA, and live-room behavior remain outstanding.
