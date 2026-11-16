# LOST BOYS CLUB

**Tagline:** NO MAP. NO SUPERVISION. QUESTIONABLE DECISIONS.

An interactive Chaturbate room experience built around two adult boyfriends with a relaxed, alternative, stoner-adjacent, dark-humor personality. The tone is welcoming, flirty, irreverent, and chaotic without becoming spammy or hostile.

## Project structure

- `docs/PRODUCT_SPEC.md` — product identity, feature scope, rules, and release plan.
- `docs/TEST_PLAN.md` — testbed and mobile QA checklist.
- `chaturbate/` — source and implementation notes for the Chaturbate App V2 project.

## Technical boundaries

- The Chaturbate App V2 runtime is the primary execution environment.
- Use supported Chaturbate event handlers, settings, KV storage, callbacks, shortcuts, and broadcast-panel APIs.
- Do not assume arbitrary network access, external scripts, or a persistent external server.
- GitHub is the source of truth for authored code, documentation, and release notes.
- Test in Chaturbate Testbed before releasing to the live App Directory or adding an update to the live room.
- No real-money gambling, paid-entry lotteries, misleading prize claims, or coercive tip mechanics. Games should be free to join unless a platform-compliant, clearly disclosed interaction is explicitly designed and reviewed.

## Current milestone

**M0 — Foundation:** product specification and QA gates established. Next: confirm the exact Chaturbate app type and editor event-handler surface, then implement the first working vertical slice (welcome/room personality + one free interactive game).

## Brand

**LOST BOYS CLUB**  
NO MAP. NO SUPERVISION. QUESTIONABLE DECISIONS.

Visual direction: underground alternative club / photocopied punk-flyer / worn zine. Black, dirty white, muted red. Avoid glossy casino styling, purple/gold palettes, excessive neon, and generic influencer aesthetics.
