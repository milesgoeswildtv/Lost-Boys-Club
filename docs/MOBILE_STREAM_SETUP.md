# AFTERDARK BROTHERHOOD — Mobile Stream + Event Bridge

## Confirmed broadcast path

- iPhone camera and broadcast: Streamlabs Mobile.
- Overlay: hosted Pages document loaded as a Streamlabs Custom URL source.
- Operator: hosted Control Room on a separate device/browser.
- Delivery: Cloudflare Worker + Durable Object WebSocket relay.

The overlay URL must use the live relay query parameters (WebSocket URL and overlay token), not demo mode. The operator page uses the separate event-ingest token. Never exchange or reuse these tokens.

## Chaturbate event source

Chaturbate App V2 code runs in a restricted server-side environment and cannot make external API calls. Do not add `fetch()`, WebSocket, or direct Worker calls to Shared Code or event handlers. The supported bridge is the separate Chaturbate Events API feed, polled server-side by the Cloudflare Worker using the private `CB_EVENTS_URL` Worker secret/variable.

The Events API supplies event methods such as tips, chat messages, follows, fan-club joins, arrivals/departures, broadcast start/stop, and media purchases. The Worker normalizes supported events into safe overlay messages.

## Current automatic mappings

- Tips (anonymous tips remain anonymous).
- Viewer arrivals and departures.
- Follows and fan-club joins.
- Media purchases (no private media details).
- Broadcast start/stop and room subject changes.
- Safe participation acknowledgements for the 11 game submission commands: Codebreaker, Word Scramble, Dirty Would You Rather, Position Impossible, Dirty Charades, One Word Story, Afterdark Dare Deck, Caption Clash, Guess the Number, and Couple Trivia.
- Three Doors selections.

Viewer-submitted answers and free-form text are never copied onto the public overlay.

## Important game-state boundary

The Events API is an event stream, not a read API for the app's private KV state. It can confirm that a viewer submitted a command, but it cannot by itself expose secret answers, authoritative scores, round state, or winners stored inside the Chaturbate app. Those must not be fabricated from chat messages. The operator can publish game lifecycle/results manually from the Control Room until a separately supported state-export mechanism exists.

Higher or Lower is a legacy game and its public player command/state contract still needs a dedicated audit before it is advertised as automatically integrated.

## Release checks

- `node relay/worker.test.mjs` — safe event normalization tests.
- `node scripts/verify-chaturbate-bundle.mjs` — static app bundle verification.
- Confirm Worker secrets/bindings in Cloudflare without exposing their values.
- Confirm `CB_EVENTS_URL` is configured before expecting automatic Chaturbate event cards.
- Verify each event in Chaturbate Testbed and in the actual Streamlabs Mobile scene before a live show.
