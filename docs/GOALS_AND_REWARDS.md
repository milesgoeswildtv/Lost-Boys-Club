# Afterdark Brotherhood — Goals, Loyalty & VIP

## One progression economy

There is one spendable balance: **Loyalty Points**. There is no separate XP, reputation, rank, mission, streak, team-score, Vault, or Hall-of-Fame progression.

Points are engagement rewards only. They have no cash value, cannot be purchased, and do not improve game odds or grant paid-entry access. Tips never award loyalty points.

### Earning defaults

| Activity | Loyalty points |
|---|---:|
| Verified room viewing | 1 per complete 5 minutes |
| Meaningful chat engagement | 1, no more than once per 10 minutes |
| Successful game participation | 1 (existing game award) |
| Successful game win | +5 bonus (existing game award) |
| First room visit of a UTC day | 2 |

Chat engagement ignores commands and very short messages. Duplicate/replayed game awards remain protected by their existing award IDs. Viewing time is measured from room-enter to room-exit events; sessions are capped at 24 hours. Sessions are not carried across an app restart, because continued presence cannot be verified after restart.

The earning values are configurable constants in the unified loyalty module.

### Viewer commands

- `!points` — current loyalty balance.
- `!rewards` — reward catalogue.
- `!redeem 1` — request a catalogue reward.
- `!profile` — balance, earned points, games played, wins, and VIP tier.
- `!vip` — your permanent room VIP tier and lifetime room-tip total.
- `!leaderboard wins|games|points` — top-five records.

### Broadcaster reward controls

- `/ab rewards add 100 Reward name`
- `/ab rewards remove 1`
- `/ab rewards list`
- `/ab rewards pending`
- `/ab rewards approve 1`
- `/ab rewards deny 1` — denial refunds the requested points.
- `/ab points grant username 10` — manual loyalty bonus.
- `/ab admin` — control dashboard.
- `/ab admin vip` — VIP summary.

Each viewer may have up to three pending redemption requests. Approval records broadcaster fulfillment as due; it does not automatically deliver a reward.

## Permanent room VIP

VIP is independent of Loyalty Points. It is based only on tips received directly in this Chaturbate room. Other rooms, external purchases, platform purchases, and redeemed points do not count. VIP never expires and cannot be lost by spending points.

Chaturbate's published broadcaster conversion rate is **$0.05 per token**. This implementation uses that published room-tip conversion to calculate the displayed USD total: tokens × $0.05. It represents the broadcaster-side Chaturbate conversion value, not the viewer's retail purchase cost or a net payout after payment fees.

| Lifetime tips in this room | Permanent VIP tier |
|---:|---|
| $50 | The Curious |
| $100 | Little Tease |
| $250 | Bad Habit |
| $500 | House Favorite |
| $1,000 | The Obsession |
| $5,000 | Brotherhood Royalty |

Anonymous tips cannot be attributed to a member and therefore do not advance an individual VIP record. Tip-event deduplication uses the event ID when the event payload supplies one; otherwise a timestamp-based fallback is used and cannot guarantee perfect replay detection.

## Room goals, giveaways & queue

The existing advanced room-goal engine, tip menu, announcements, free-entry giveaways, games, and viewer queue remain separate room utilities. They do not create separate progression balances.

## Storage

- Loyalty activity cooldowns and daily visit markers: `lbc_ab_loyalty_activity_v1`.
- Watch session timestamps: `lbc_ab_watch_session_<username>`.
- VIP members and recent tip-event IDs: `lbc_ab_vip_members_v1`.
- Existing loyalty balances, award history, reward catalogue, and redemption requests retain their current `lbc_ab_rewards_*` keys.

## Deployment and QA

GitHub does not sync source into the Chaturbate Developer Portal. Update Shared Code and the event handlers in the portal, including the room-exit handler, then validate in Testbed. Confirm enter/exit events, duplicate/reconnect handling, 5-minute accrual, daily and chat cooldowns, game participation/win awards, VIP thresholds, anonymous tips, and reward redemption/refunds before live use.
