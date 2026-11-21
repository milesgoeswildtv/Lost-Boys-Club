# AFTERDARK BROTHERHOOD — Overlay Relay

This Worker provides the authenticated WebSocket endpoint consumed by the OBS browser overlay. A Durable Object maintains the room connection and long-polls the Chaturbate Events API while OBS is connected.

## Required secrets

Set these as Worker secrets/variables. Never put the Chaturbate Events API URL in the overlay URL or in public source code.

- `CB_EVENTS_URL`: the private room Events API base URL shown in the broadcaster's Chaturbate account settings. It includes the private feed token.
- `OVERLAY_TOKEN`: a long random token used only by the OBS browser source.

## Deploy

1. Create the Worker from this directory using Wrangler.
2. Bind the Durable Object using the migration in `wrangler.toml`.
3. Set both secrets.
4. Deploy the Worker.
5. Verify `/health` returns `{"ok":true,...}`.
6. Add a Browser Source in OBS pointing to the hosted overlay with `?ws=wss://YOUR-WORKER.workers.dev/ws&token=YOUR_OVERLAY_TOKEN`.

## Event coverage

The Chaturbate Events API feed is polled only while an OBS WebSocket client is connected. The relay currently converts:
- tips into visual support alerts (anonymous supporters stay anonymous);
- user arrivals into viewer alerts;
- broadcast start/stop into room status;
- Three Doors selections and Caption Clash entries into basic activity alerts.

This is the first transport layer, not yet the complete Shared Code event map. Goal progress, loyalty awards, VIP changes, retention milestones, queue changes, giveaways, reward redemptions, and all game-specific states need explicit structured event publishing or verified Events API coverage before they can appear as exact state in the overlay.

## Security

- The Chaturbate feed URL is a Worker secret and is never sent to the browser.
- The OBS connection token is checked in constant time.
- WebSocket payloads are allowlisted and capped.
- Anonymous tip identities are not disclosed.
- Do not share the OBS Browser Source URL because it contains the overlay access token.

## Current limitations

The relay source is authored but has not been deployed. Chaturbate Events API credentials are not present in this repository. Confirm that the account's Events API is enabled and use the exact private feed URL from Chaturbate settings. Test with a private Testbed room before using a live room.