# LOST BOYS CLUB — M2.2 Modular Room Goal

## Architecture change

M2.2 moves room-goal behavior into reusable functions attached to the existing `LBC` module in Shared Code. Event handlers remain small adapters:

- Chat Message calls `LBC.handleRoomGoalCommand(...)`.
- Tip Received calls `LBC.processRoomGoalTip(...)` after M2.1 has updated tip totals.
- Broadcast Panel Update calls `LBC.updateGoalPanel()` after drawing the existing panel.

This avoids duplicating goal logic across handlers and preserves the working M2.1 tip tracker.

## Important deployment rule

GitHub does not sync automatically to the Chaturbate Developer Portal. The portal currently has the working M2.1 handlers. Do not replace those handlers with the complete GitHub files.

Deploy by appending only the small additions below. Do not delete existing code.

### 1. Shared Code — append one reusable-functions block

Open **Shared Code**, scroll to the very bottom, and place the cursor after the existing final ` }());` line. Add a new line and paste the complete block from the section **Shared Code addition** below.

Do not replace the existing Shared Code.

### 2. Chat Message — append one line

At the very bottom of the existing M2.1 Chat Message handler, append:

```js
// M2.2 modular extension: room-goal commands are handled in Shared Code.
LBC.handleRoomGoalCommand($message.body, $user.isOwner);
```

### 3. Tip Received — append one line

At the very bottom of the existing M2.1 Tip Received handler, append:

```js
// M2.2 modular extension: aggregate totals are already updated above.
LBC.processRoomGoalTip($tip.tokens);
```

This must be below the existing M2.1 accounting code so the goal helper reads the newly updated total. Do not replace or duplicate the M2.1 accounting.

### 4. Broadcast Panel Update — append one line

At the very bottom of the existing Broadcast Panel Update handler, append:

```js
// M2.2 modular extension: override row two only when a room goal exists.
LBC.updateGoalPanel();
```

The helper does nothing when no goal is configured, leaving the existing panel unchanged.

## Broadcaster and viewer commands

- Broadcaster: `/lbc goal 500` — set a goal of 500 tokens.
- Broadcaster: `/lbc goal off` — turn the goal off.
- Viewer: `!clubgoal` — show current or most recently completed goal progress.

The goal starts from the aggregate tip total at the moment it is configured. Milestone notices occur once each at 25%, 50%, 75%, and 100%. Reconfiguring a goal resets its milestone markers. Tips remain voluntary and do not unlock game access, advantages, or prizes.

## Shared Code addition

The exact reusable-functions block is stored at the end of `chaturbate/shared_code.js`. It is intentionally isolated after the original core so it can be appended without editing the working code above it.

## QA status

- GitHub source files pass JavaScript syntax compilation.
- The existing M2.1 handler bodies are preserved in the updated source files.
- Handler additions are one-line calls to the reusable Shared Code methods.
- Chaturbate editor validation and Testbed behavior are not yet verified. Do not consider M2.2 deployed until the portal additions are saved and the Testbed checks pass.

## Testbed checklist

1. Save Shared Code and all three one-line handler additions; confirm no editor errors.
2. With no goal configured, confirm the existing idle and active game panel still renders as before.
3. As broadcaster, send `/lbc goal 100`; confirm the room goal appears in panel row two.
4. Send `!clubgoal`; confirm it reports 0/100.
5. Send test tips totaling 25, 50, 75, then 100 tokens after the goal is set; confirm each milestone is announced once and panel progress updates.
6. Confirm the 100% milestone marks the goal reached and later tips do not repeat milestones.
7. As broadcaster, send `/lbc goal off`; confirm the panel returns to the normal game/status row.
8. Re-run the existing Guess the Number start, guess, and timeout checks.
