# AFTERDARK BROTHERHOOD — Overlay Relay

This Worker provides the authenticated WebSocket endpoint consumed by the OBS browser overlay and an authenticated HTTP event-ingest endpoint used by the laptop operator control room.

## Routes

- `GET /health` — reports service status and whether required configuration is present. It never returns secret values.
- `GET /ws?token=...` — authenticated WebSocket for the OBS Browser Source. Requires `OVERLAY_TOKEN`.
- `POST /event` — authenticated event publisher for `overlay/control.html`. Requires `Authorization: Bearer <EVENT_INGEST_TOKEN>` and accepts only allowlisted event types up to 4 KB.

The Worker sends accepted events to the Durable Object, which broadcasts them to connected OBS browser sources. Game lifecycle events (`game_start`, `game_update`, `game_round`, `game_results`, `game_end`) are now allowlisted.

## Required bindings and secrets

The Worker uses the existing Durable Object binding:

- `AFTERDARK_RELAY` — Durable Object namespace for the shared room feed.

Configure these secrets:

- `OVERLAY_TOKEN` — long random secret used only in the OBS Browser Source URL.
- `EVENT_INGEST_TOKEN` — a separate long random secret entered only into the laptop operator control page.

Configure this plain-text variable:

- `OVERLAY_ORIGIN` — exact origin of the hosted operator page, e.g. `https://afterdark-overlay-preview.pages.dev`.

Optional:

- `CB_EVENTS_URL` — the private Chaturbate Events API URL from the broadcaster's account settings. It includes a private feed token. Do not put it in the overlay URL or public source code.

## Deploy

Deploy `worker.js` with the Durable Object binding and the SQLite migration in `wrangler.toml`. If deploying through the Cloudflare API, preserve the existing Durable Object namespace binding and secret bindings.

After deployment, verify `/health`. A working health response includes `ok: true`, `overlayConfigured: true`, and `operatorControlConfigured: true`. `chaturbateEventsConfigured` may remain false until the Events API feed is configured.

## OBS setup

Add a Browser Source with dimensions 1920×1080 and URL:

```
https://afterdark-overlay-preview.pages.dev/?ws=wss://YOUR-WORKER.workers.dev/ws&token=YOUR_OVERLAY_TOKEN
```

Keep the URL private because it contains the overlay access token.

## Operator control room

Open:

```
https://afterdark-overlay-preview.pages.dev/control.html
```

Enter the Worker base URL and `EVENT_INGEST_TOKEN`. The control room can send alerts and manage the visual game-window lifecycle. Its current controls are manual: they do not yet read hidden Chaturbate game-engine state or determine winners automatically.

## Chaturbate event feed

When `CB_EVENTS_URL` is configured, the Durable Object long-polls the Chaturbate Events API while an OBS WebSocket client is connected. Currently converted events include tips, user arrivals, broadcast start/stop, Three Doors selections, and Caption Clash entries. Exact automatic state for all 11 games still requires game-specific publishers/adapters and Testbed verification.

## Security

- Never publish either secret.
- Never expose the Chaturbate Events API URL in browser URLs, screenshots, or source control.
- Use different values for `OVERLAY_TOKEN` and `EVENT_INGEST_TOKEN`.
- Restrict `OVERLAY_ORIGIN` to the hosted control page's exact origin.
- Anonymous tip identities remain anonymous.
- Do not claim automatic game synchronization until the Chaturbate game adapters are implemented and verified in Testbed.
