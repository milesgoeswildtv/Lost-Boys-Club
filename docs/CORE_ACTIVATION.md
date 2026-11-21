# AFTERDARK BROTHERHOOD — Core Activation & Chaturbate Registration

This is the operator checklist for installing the current core build in the Chaturbate Developer Portal. GitHub is the source of truth for the code, but it does **not** synchronize files into the portal.

## Release lineage

- Core branch: 'fix/afterdark-loyalty-branding-integration'
- Core PR: [#9](https://github.com/milesgoeswildtv/Lost-Boys-Club/pull/9)
- Overlay branch: 'feature/afterdark-stream-overlay'
- Overlay PR: [#10](https://github.com/milesgoeswildtv/Lost-Boys-Club/pull/10)
- PR #10 is seven commits ahead of the core branch and has no commits missing from the core branch. Its base is the core branch, so the dependency is explicit.

Do not upload a partial mixture of files from different branches. Use the complete files from the overlay branch for this activation package; it contains the core branch plus the overlay work.

## What “command registration” means in App V2

The commands are implemented in Shared Code and routed by the Chat Message event handler. They are not individually entered into a separate Chaturbate command registry.

The portal setup that still must be done is:
1. Put the complete Shared Code source into the app's **Shared Code** editor.
2. Add each supplied handler source to the matching **Event Handler** tab.
3. Save the app and run the Testbed checklist.
4. Configure Advanced Settings using the JSON manifest.

Until those portal steps are done, code in GitHub is not active in the Chaturbate app.

## Required Developer Portal tabs

Use the exact source file for each matching event. Do not paste the handler files into Shared Code.

| Developer Portal event tab | Repository source | Why it is required |
|---|---|---|
| Chat Message | 'chaturbate/handlers/chat_message.js' | Routes broadcaster '/ab' controls and viewer commands |
| Callback | 'chaturbate/handlers/callback.js' | Timers, delayed actions, timed goals and game callbacks |
| App Start | 'chaturbate/handlers/app_start.js' | Initializes runtime, restores schedules and resets transient sessions |
| App Stop | 'chaturbate/handlers/app_stop.js' | App-stop lifecycle handler |
| Broadcast Panel Update | 'chaturbate/handlers/broadcast_panel_update.js' | Renders the native three-row room status panel |
| Tip Received | 'chaturbate/handlers/tip_received.js' | Tip accounting, goals, VIP, analytics and acknowledgements |
| User Enter | 'chaturbate/handlers/user_enter.js' | Welcome, visit analytics and loyalty session start |
| User Exit | 'chaturbate/handlers/user_exit.js' | Closes the viewer's loyalty session |

**Important:** User Exit is a required tab in this build. The file exists in the repository, but it must be added to the matching portal event tab manually.

## Upload order

1. Open the correct AFTERDARK BROTHERHOOD App V2 app in the Chaturbate Developer Portal.
2. Back up/copy the currently saved Shared Code and each existing handler before replacing anything.
3. Replace Shared Code with the entire 'chaturbate/shared_code.js' file from this branch.
4. Replace each of the eight event tabs using the matching file in the table above.
5. Replace the Advanced Settings schema with the complete 'chaturbate/advanced_settings.json' manifest and save.
6. Save/publish the app configuration in the portal.
7. Open the app in Testbed and run the checks below before using it in the live room.

Do not upload only changed snippets. Each file is a complete replacement for its corresponding editor tab.

## Broadcaster Control Center commands

The primary owner entry point is '/ab'. The owner sends the command in broadcaster chat.

### Main menu

| Command | Opens |
|---|---|
| '/ab' | Main Control Center |
| '/ab 1' | Games |
| '/ab 2' | Goals |
| '/ab 3' | Tip Menu |
| '/ab 4' | Rewards |
| '/ab 5' | Brotherhood / permanent VIP |
| '/ab 6' | Giveaways |
| '/ab 7' | Viewer Queue |
| '/ab 8' | Announcements |
| '/ab 9' | Live Dashboard |
| '/ab 10' | Settings |
| '/ab 0' or '/ab back' | Return to the main menu |
| '/ab cancel' | Cancel a pending guided input |
| '/ab value <details>' | Submit details requested by a guided action |

### Game controls exposed by the current menu

| Game | Start command |
|---|---|
| Codebreaker | '/ab codebreaker start' |
| Word Scramble | '/ab scramble start' |
| Dirty Would You Rather | '/ab wyr start' |
| Position Impossible | '/ab position start' |
| Dirty Charades | '/ab charades start' |
| Guess the Number | '/ab start' |
| One Word Story | '/ab story start' |
| Afterdark Dare Deck | '/ab dare start' |
| Caption Clash | '/ab caption start' |
| Stop active game | Select the stop action in the Games menu |

The Shared Code also contains older Higher or Lower and Couple Trivia dispatch paths. They are not currently exposed in the '/ab' Games menu; do not treat them as menu-registered/ready controls until they are added and tested.

### Guided input examples documented by the current menu

- '/ab value 1000 Main Goal' — create an untimed goal.
- '/ab value 1000 30 Main Goal' — create a 30-minute goal.
- '/ab value 1500 Next Stage' — queue a goal stage.
- '/ab value 50 Song request' — add a tip-menu item.
- '/ab value 100 Choose a song' — add a loyalty reward.
- '/ab value Prize description' — start a free-entry giveaway.

The menu is the recommended interface. Existing direct subsystem aliases remain available for compatibility; see 'docs/STREAM_CONTROL_CENTER.md' for goal and subsystem command details.

## Testbed activation checklist

Run these checks in order. Record the observed result; do not mark a check complete based only on source inspection.

### Lifecycle and event tabs
- [ ] App starts without a runtime exception.
- [ ] App Start owner notice appears once.
- [ ] A viewer enters; entry handling and analytics execute once.
- [ ] A viewer exits; loyalty session closes without an exception.
- [ ] A test tip updates tip stats, room goal progress and VIP only for attributable direct tips.
- [ ] Callback event fires and refreshes the native panel.
- [ ] Broadcast Panel Update renders all three rows.

### Command routing and permissions
- [ ] Broadcaster '/ab' opens the main menu.
- [ ] Broadcaster '/ab 1' through '/ab 10' open the matching sections.
- [ ] '/ab 0', '/ab back' and '/ab cancel' work.
- [ ] A viewer typing '/ab' cannot access broadcaster controls.
- [ ] A normal broadcaster chat message is not consumed by a pending guided action.
- [ ] One game can start, accept viewer input, stop, and release the shared game lock.
- [ ] Goal create, pause, resume and completion work with callbacks.
- [ ] Reward catalogue and redemption request/review work.
- [ ] Giveaway entry gating and viewer queue limits respect settings.
- [ ] Existing KV data survives an app restart.

### Mobile and release gate
- [ ] Testbed works on iPhone Safari.
- [ ] Long usernames and messages do not break notices or the native panel.
- [ ] No repeated notices or callback loops occur.
- [ ] No app errors appear during a 10-minute idle/active test.
- [ ] Only after all checks pass: broadcaster explicitly approves live-room release.

## Current verification boundary

Source-level checks and mock-runtime tests are documented in PR #9. They are not substitutes for portal synchronization or Testbed QA. As of this document, no Developer Portal upload, Testbed run, or live-room QA is claimed complete.
