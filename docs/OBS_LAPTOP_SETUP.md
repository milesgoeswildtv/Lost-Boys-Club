# AFTERDARK BROTHERHOOD — Laptop / OBS Route

This is the first supported broadcast route. The laptop runs OBS Studio, the iPhone supplies the camera, and the AFTERDARK overlay is a transparent OBS Browser Source.

## What this delivers

- Full-canvas transparent overlay designed for a 1920×1080 OBS scene.
- Separate operator control room at `/control.html`.
- Authenticated event publishing from the control room to the overlay relay.
- Game-window lifecycle controls for all 11 existing games: open, update, show results, end.
- Separate room-alert sender.
- Chaturbate Events API polling is optional; manual operator events can work before that feed is configured.

**Important boundary:** the control room controls the visual game window. It does not yet read hidden state from the Chaturbate game engines or automatically calculate winners. Automatic game-state synchronization remains a separate integration task and must be tested in Chaturbate Testbed.

## OBS scene setup

1. Install OBS Studio on the laptop.
2. Create a scene named `AFTERDARK — BROTHERHOOD`.
3. Add the iPhone as a camera source:
   - On a compatible Mac, use Apple's Continuity Camera.
   - On Windows, use a supported iPhone webcam app/driver such as Camo, then select its virtual camera in OBS.
   - If the phone-camera bridge is unreliable, use a USB webcam temporarily; the overlay setup is unchanged.
4. Add the camera source first and fit it to the canvas.
5. Add a **Browser Source** above the camera. Name it `AFTERDARK OVERLAY`.
6. Set Browser Source dimensions to **1920 wide × 1080 high**.
7. Set its URL to the deployed overlay URL, with the relay endpoint and private overlay token appended:

```
https://afterdark-overlay-preview.pages.dev/?ws=wss://afterdark-overlay-relay.afterdarklabs.workers.dev/ws&token=YOUR_OVERLAY_TOKEN
```

Replace both placeholders with the actual Worker hostname and private `OVERLAY_TOKEN`. Do not share this URL; the token grants access to the overlay feed.

8. Keep **Shutdown source when not visible** disabled and **Refresh browser when scene becomes active** enabled.
9. Keep the game popup in the lower-right area and event alerts on the left. Adjust camera crop/position so neither covers the subject.
10. Add microphone/audio sources and check levels before going live.

Preview-only URL (demo buttons; not for a live broadcast):

```
https://afterdark-overlay-preview.pages.dev/?demo=1
```

## Operator control room

Open this on the laptop in a normal browser:

```
https://afterdark-overlay-preview.pages.dev/control.html
```

Enter the Relay Worker base URL (for example `https://afterdark-overlay-relay.afterdarklabs.workers.dev`) and private `EVENT_INGEST_TOKEN`. Choose a game, enter the prompt and chat instructions, then use **OPEN GAME WINDOW**, **UPDATE WINDOW**, **SHOW RESULTS**, and **END GAME**. Use the alert section for separate room notifications.

The control token is stored in that browser's local storage. Do not share it or enter it into OBS.

## Cloudflare Worker configuration

Deploy `relay/worker.js` with the Durable Object binding and SQLite migration from `relay/wrangler.toml`. Configure these Worker secrets/variables:

- `OVERLAY_TOKEN` — long random secret used only by the OBS Browser Source.
- `EVENT_INGEST_TOKEN` — a different long random secret used only by the operator control room.
- `CB_EVENTS_URL` — optional initially; the private Events API URL from Chaturbate. Add it only after verifying the account's Events API feed.
- `OVERLAY_ORIGIN` — set to `https://afterdark-overlay-preview.pages.dev` to restrict browser control requests to the hosted control page.

Never put the Chaturbate Events API URL in a browser URL or public repository. Never reuse the same secret for both tokens.

The `/health` endpoint reports whether the three private configuration values are present. It does not expose their values.

## Chaturbate broadcast

Chaturbate supports OBS as an external RTMP encoder. Its help guide recommends starting at 1280×720, 30 FPS, and 3000 kbps, then adjusting to match the camera and upload speed. Use the current broadcast token from the Chaturbate broadcaster page; never commit or share it.

1. In Chaturbate, open **Broadcast Yourself**.
2. Choose **Use External Encoder to Broadcast**.
3. Open the RTMP/OBS broadcast information and copy the current broadcast token.
4. In OBS, choose Chaturbate as the service if available, or enter the RTMP server and stream token exactly as shown on the broadcaster page.
5. Start with 720p / 30 FPS / 3000 kbps, then check OBS dropped frames and Chaturbate's player before increasing quality.
6. Start streaming from OBS. Stop the stream from OBS when finished.

Official setup guide: https://support.chaturbate.com/hc/en-us/articles/360037971952-How-do-I-set-up-OBS

## Verification checklist

- [ ] Worker `/health` returns `ok: true` and the expected configuration booleans.
- [ ] OBS Browser Source shows **AFTERDARK EVENT BRIDGE CONNECTED**.
- [ ] Operator page can send a test alert and it appears in OBS.
- [ ] Operator page can open, update, show results, and close the game window.
- [ ] Chaturbate Testbed confirms the OBS stream is private/test-only before any public broadcast.
- [ ] Test iPhone camera, audio, framing, and network stability.
- [ ] Test each of the 11 game engines separately before claiming automatic synchronization.

Do not use a live room for first-time camera, overlay, or relay testing.
