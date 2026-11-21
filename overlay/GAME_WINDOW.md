# Afterdark Overlay — Game Window Event Contract

The overlay has one fixed-size, reusable game window. It never takes over the broadcast. All game modules should publish lifecycle events to the overlay relay using the event types below.

## Event envelope

Send JSON over the authenticated overlay WebSocket:

```json
{
  "type": "game_start",
  "data": {
    "title": "CODEBREAKER",
    "subtitle": "CRACK THE SEQUENCE",
    "prompt": "Find the four-digit code.",
    "instructions": "Submit your guess in chat using !guess.",
    "round": 1,
    "totalRounds": 5,
    "remainingSeconds": 90,
    "choices": ["1", "2", "3", "4"],
    "players": ["Protocol", "NightOwl"],
    "footer": "PLAY ALONG IN CHAT"
  }
}
```

## Lifecycle

- `game_start`: opens the game window and renders the initial game state.
- `game_update`: updates the same window with the current prompt, choices, players, timer, or other state.
- `game_round`: same render/update behavior for a new round.
- `game_results`: displays scores, placements, and an optional winner while keeping the game window open.
- `game_end`: displays the final result briefly, then closes the game window automatically.

## Supported data fields

All fields are optional except the event type. Use plain text; the overlay safely renders text and does not interpret supplied HTML.

- `title`, `subtitle`, `prompt`, `instructions`, `detail`, `meta`, `footer`
- `statusLabel`, `round`, `totalRounds`
- `remainingSeconds` (numeric countdown) or `timer` (preformatted text)
- `choices`: up to 8 strings or objects with `label`, `text`, `name`, `detail`, and optional `selected`
- `players`: up to 12 strings or objects with `name` / `username` and optional `detail` / `status`
- `results`: up to 8 strings or objects with `name` / `label` and optional `score` / `detail` / `status`
- `winner`: winner label
- `displayMs`: final-result display duration for `game_end` (clamped to 2.5–8 seconds)

## Layout contract

Every game must fit this single window. Keep prompts concise, limit choices and participants to the supported counts, and send updates rather than creating a separate overlay or changing the window size. The audience plays through the room's existing chat commands; the overlay is the shared visual game board/status display.

## Integration status

The game window renderer and local demo states are implemented in `overlay/`. This contract is the required interface for game modules. The existing Chaturbate games still need their event publishers/adapters connected to the relay before their live state appears in the window. Do not describe the game window as live-integrated until those event paths are wired and verified in Testbed.
