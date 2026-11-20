# Advanced Goal Engine — implementation note

This document supersedes the original M2.2 append-only instructions. The current implementation is in `chaturbate/shared_code.js` and keeps the legacy storage key `lbc_m2_room_goal` for compatibility.

Use `docs/GOALS_AND_REWARDS.md` for the current command reference and deployment checklist.

The existing `chaturbate/handlers/tip_received.js` continues to update aggregate tip statistics first, then calls `LBC.processRoomGoalTip($tip.tokens)`. The existing Broadcast Panel Update handler remains unchanged and calls `LBC.updateGoalPanel()`.

GitHub does not sync automatically to Chaturbate. Portal editor validation, Testbed checks, persistence checks, and mobile QA are still required.
