# Product Specification — AFTERDARK BROTHERHOOD

## 1. Product identity

**Name:** AFTERDARK BROTHERHOOD  
**Tagline:** NO MAP. NO SUPERVISION. QUESTIONABLE DECISIONS.

A room-wide interactive brotherhood hosted by two adult male partners. The performers are the attraction; the app is the cheeky, overconfident club manager. It should make the room feel like a late-night hangout with two affectionate, funny, alternative boyfriends—not a corporate chatbot or a generic casino.

### Voice
- Relaxed, playful, affectionate, sarcastic, occasionally absurd.
- Stoner-culture references may appear as flavor, never as pressure to consume.
- Welcoming to newcomers and respectful to regulars.
- Short, occasional messages; avoid chat flooding.
- No slurs, harassment, humiliation of viewers, or pressure to tip.

### Visual identity
- Black / dirty white / muted red.
- Underground club, punk flyer, photocopied zine, imperfect hand-made details.
- Readable at phone size; strong contrast; minimal clutter.
- Avoid casino gloss, purple/gold, excessive neon, and corporate UI.

## 2. Product architecture

One Chaturbate App V2 application, modularized by feature within the platform's supported handler model:

1. **Brotherhood Core** — initialization, settings, room personality, safe message cadence.
2. **Social** — welcomes, follow acknowledgements, return-visitor recognition where supported and privacy-appropriate.
3. **Games** — free-to-join mini-games, state, validation, round lifecycle, score tracking.
4. **Chaos Engine** — optional random, harmless prompts and room events, with broadcaster-controlled enable/disable.
5. **brotherhood records** — session and persistent leaderboards using the supported KV store.
6. **Broadcast Panel** — compact status display for current game, goal, and leaderboard when supported.
7. **Shortcuts** — one-click entry point for the primary viewer interaction, subject to the current Chaturbate shortcut limit.

Do not split into multiple apps unless a concrete platform limitation requires it.

## 3. First release scope (M0–M1)

### M0 — Foundation
- Confirm that the created Chaturbate project is an App V2 application, not a legacy V1 bot.
- Confirm the app's exact name/ID and the available handler list.
- Record app settings and required permissions.
- Establish repository as source of truth.

### M1 — First working vertical slice
- App Start: initialize defaults and load persistent state safely.
- User Enter: short welcome with anti-spam / cooldown behavior.
- Chat Message: recognize explicit game commands only; ignore unrelated conversation.
- One free game: **Guess the Number**.
  - Broadcaster starts/stops a round.
  - App chooses a secret integer using the platform-supported runtime facilities.
  - Viewers submit guesses in chat.
  - Validate input, enforce one guess per user per round, and handle ties/round completion.
  - No paid entry, no tip required, no cash or token prize.
  - Announce winner and reset cleanly.
- Broadcast Panel: use the native Broadcast Panel Update handler and a compact three-row status template for club identity, game status/player count, and brotherhood records. Refresh the panel only when meaningful game state changes.
- Persist only small, necessary state; guard against malformed or missing KV values.
- Add broadcaster settings for welcome enablement, welcome cooldown, game enablement, and message style where supported.

### M2 — Room utilities
- Configurable informational tip menu, managed by broadcaster chat commands and requested by viewers with !tipmenu.
- Tip menu entries are display-only requests; no automatic action is triggered by a matching tip.
- Configurable tip menu display (informational only).
- Broadcaster-controlled room goal display and milestone notices.
- Tip acknowledgement with throttling and no pressure language.
- Rotating announcements with conservative cadence.

### M3 — Game collection
- Would You Rather (free room poll).
- Higher or Lower (free guessing game).
- Couple Trivia (broadcaster-editable question set).
- Boyfriend Battle (viewer voting between two pre-approved, harmless options).
- The Chaos Button (random harmless prompt; broadcaster can disable).
- Streaks and Hall of Shame leaderboard (opt-in display, respectful naming).

### M4 — Polish and release
- Responsive, readable broadcast panel.
- Persistent records and reset controls.
- Accessibility and mobile QA.
- Testbed evidence and regression pass.
- Release notes and live rollout only after broadcaster approval.

## 4. Product and safety rules

- Both performers must be adults and complete Chaturbate's required verification and agreements before appearing.
- Respect each performer's boundaries and obtain agreement before adding any challenge or prompt involving either performer.
- No game may require a viewer to tip to participate.
- No gambling, paid-entry raffles/lotteries, random paid prizes, or misleading prize claims.
- Tips are voluntary support; never imply that tipping guarantees a specific outcome unless a platform-compliant menu item is clearly defined and honored.
- Do not collect or expose personal information. Do not build cross-room tracking or off-platform identity profiles.
- Do not record broadcasts.
- Never expose Events API tokens or other credentials in source control.
- Follow Chaturbate App V2 API permissions and App Directory requirements.

## 5. Technical constraints

Chaturbate App V2 is event-driven JavaScript with platform-provided handlers, settings, KV persistence, callbacks, shortcuts, and panel APIs. The V2 environment does not permit arbitrary external API calls or loading external scripts. Design the core as self-contained.

Use only APIs confirmed in the current official developer documentation. Do not assume browser DOM, Node.js, npm packages, filesystem access, or a general-purpose network client exists in the app runtime.

## 6. Definition of done

A feature is not complete because code was drafted. It is complete only when:
- It is implemented in the actual Chaturbate V2 editor.
- It passes the editor's validation.
- It passes relevant Testbed scenarios.
- State resets and persistence behave as specified.
- Mobile Testbed behavior is checked on iPhone.
- No duplicate timers, repeated notices, or runaway event loops occur.
- The result is documented in this repository.


### M2.4 — Rotating room announcements
- Broadcaster can enable, disable, and inspect announcement status with chat commands.
- Announcements are disabled by default and rotate at a conservative 15-minute cadence.
- Messages are informational, short, and never imply that tipping is required.
- Stale callbacks are ignored; disabling announcements prevents further rotations.


### M5 — Advanced Goals & Loyalty Rewards (implemented in source branch; portal QA pending)
- Advanced room goals: named goals, configurable milestone percentages, pause/resume with paused tips excluded, target extensions, reset/off controls, and a sequential queue of up to 10 goals.
- Loyalty points: free-game participation and win bonuses with per-round idempotency.
- Reward shelf: broadcaster-managed catalogue, viewer redemption requests, pending queue, approval/denial, and automatic point refunds on denial.
- Points are not sold, are not earned from tips, have no cash value, and do not unlock game access or improve game odds.
- No paid-entry raffles, random paid prizes, or automatic tip-triggered rewards.
- GitHub source changes are not considered deployed until the Chaturbate editor and Testbed checks pass.
