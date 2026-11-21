# AFTERDARK BROTHERHOOD — Stream Overlay

## Direction

The overlay follows the supplied AFTERDARK BROTHERHOOD logo: deep black, electric magenta, acid-green lightning accents, silver/white highlights, ornate gothic identity, angelic/demonic symbolism and supernatural atmosphere.

The camera remains the primary subject. The permanent layer is restricted to the outside edges, top identity/status line and a compact bottom rail. Activity cards appear in the lower-right safe area and must never cover the central camera subject.

## Current implementation

- `overlay/index.html` — transparent OBS browser-source document.
- `overlay/styles.css` — responsive visual frame, status rail and animated event card.
- `overlay/overlay.js` — event renderer, WebSocket client and local demo mode.
- Add to OBS as a Browser Source at 1920 × 1080 (or the canvas resolution in use), or add the live overlay URL as a Custom URL source in Streamlabs Mobile.
- For visual preview append `?demo=1` to the overlay URL.

The overlay currently supports these normalized event types:

| Type | Purpose |
|---|---|
| `room` | Live room status and mode |
| `goal` / `goal_update` | Goal title, percent and progress detail |
| `activity` / `game_state` | Current game or activity |
| `community` / `loyalty` / `vip` / `retention` | Membership and recognition strip |
| `tip` | Tip alert |
| `viewer` | Viewer arrival or participation |
| `winner` | Winner announcement |
| `game_reveal` | Door, roulette, dare and other reveal moments |
| `notification` | Generic room event |
| `overlay_state` | Full or partial state synchronization |

### Event envelope

```json
{
  "type": "goal_update",
  "data": {
    "title": "THE MIDNIGHT GOAL",
    "percent": 72,
    "detail": "720 / 1,000 TOKENS · 72% COMPLETE",
    "announce": true
  }
}
```

Text is inserted as text content, not HTML. The renderer bounds all strings and progress values.

## Integration boundary

The existing Chaturbate Shared Code remains the source of truth for games, loyalty, VIP, retention, goals, queues, rewards, giveaways and analytics. The overlay is presentation only and must not reimplement or mutate those systems.

A separate authenticated event relay is required to deliver events to OBS. The overlay accepts a secure `wss://` endpoint and an access token through query parameters. The relay must authenticate the browser source, reject unauthorized publishers, validate event types/payload sizes, and never expose Chaturbate event-feed credentials to the browser.

The Cloudflare Worker + Durable Object relay and laptop operator publisher are deployed. The operator-to-phone path has been confirmed by the broadcaster using Streamlabs Mobile Custom URL. Chaturbate App V2 cannot make external API calls, so do not attempt to call the Worker from Shared Code or event handlers. Automatic room events use the separate Chaturbate Events API feed polled by the Worker; configure the private `CB_EVENTS_URL` Worker secret before expecting those cards. The Worker now normalizes room events and safe game-submission acknowledgements. Authoritative private game state and winner calculation are not exposed by the Events API and remain operator-published. See `docs/MOBILE_STREAM_SETUP.md` and `relay/README.md`.

## Safety and operational rules

- No tip is treated as a paid-entry lottery or wager.
- Tip-triggered activities must be clearly disclosed, voluntary, and reviewed against platform rules.
- Any paid interaction must be a request/trigger with a defined, non-random outcome unless separately reviewed for platform compliance.
- Anonymous supporters are never identified.
- Analytics and broadcaster controls remain private; the public overlay only receives audience-safe fields.
- The camera's central safe area is never covered by permanent or temporary activity UI.
