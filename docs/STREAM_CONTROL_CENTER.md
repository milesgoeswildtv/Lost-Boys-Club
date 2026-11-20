# Afterdark Brotherhood — Stream Control Center

The Stream Control Center is the broadcaster-only operating console for the room. It is built into the existing Shared Code dispatcher and existing subsystem handlers; it does not introduce a second dispatcher or duplicate goal, queue, reward, giveaway, or announcement state.

## Open the console

- `/ab admin` — live room overview.
- `/ab admin status` — same overview.
- `/ab admin help` — complete command map.
- `/ab admin panel` — request a refresh of the existing native below-camera room panel.
- `/ab admin games`, `goal`, `rewards`, `menu`, `announcements`, `giveaway`, `queue`, or `vip` — focused subsystem status.
- `/ab admin members` — tracked member count.

## Unified broadcaster command routing

Subsystem commands can be run from one consistent namespace. The console translates these aliases into the existing subsystem command handlers once.

| Control | Commands |
|---|---|
| Room goals | `/ab admin goal set 1000 Main Goal`, `queue 1500 Next Goal`, `pause`, `resume`, `extend 250`, `reset`, `off`, `status`, `milestones 10 25 50 75 100`, `queue list`, `queue clear` |
| Rewards | `/ab admin rewards add 100 Reward name`, `remove 1`, `list`, `pending`, `approve 1`, `deny 1` |
| Tip menu | `/ab admin menu add 50 Request name`, `remove 1`, `clear`, `show` |
| Announcements | `/ab admin announcements on`, `off`, `status` |
| Giveaway | `/ab admin giveaway start Prize`, `end`, `draw`, `cancel`, `history` (free-entry only) |
| Viewer queue | `/ab admin queue status`, `next`, `done`, `skip`, `pause`, `resume`, `clear`, `limit 25`, `slot list` |
| Game modules | Use each game's existing `/ab <game> start` / `stop` commands. Guess the Number uses `/ab start` and `/ab stop`. |

The dashboard summarizes current game, room support, goal progress/state, queue state, giveaway state, announcement state, tip-menu count, reward catalogue and pending requests, permanent VIP count, and registered game modules.

## Native room panel

The existing Chaturbate Broadcast Panel Update handler remains intact. It continues to show the room/game state and the current goal when configured. The Stream Control Center can request a native panel refresh, but the Chaturbate three-row panel is a status display, not an interactive button surface. Broadcaster actions are issued through owner chat commands.

## Permissions and compatibility

- Every `/ab admin ...` alias is routed only when Chaturbate marks the sender as the broadcaster/owner.
- Viewers cannot invoke these controls by typing the same text.
- Existing subsystem handlers, storage keys, and event routing remain the source of truth.
- No game engine, reward ledger, goal state model, or viewer queue data format was replaced.

## Verification

The Shared Code file passed JavaScript syntax compilation after the changes. A mocked runtime exercise verified dashboard rendering, goal create/pause, announcement toggle, tip-menu add, reward add, queue pause, giveaway start, and native panel refresh command. This is code-level mock verification only; Chaturbate Developer Portal synchronization, Testbed QA, and live-room behavior have not been verified by this change.
