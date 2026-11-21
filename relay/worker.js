const ALLOWED_TYPES = new Set(["tip","viewer","room","notification","game_reveal","winner","goal_update","activity","community","loyalty","vip","retention","overlay_state","game_start","game_update","game_round","game_results","game_end"]);
const MAX_EVENT_BYTES = 4096;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/health") return Response.json({
      ok: true, service: "afterdark-overlay-relay",
      overlayConfigured: !!env.OVERLAY_TOKEN,
      chaturbateEventsConfigured: !!env.CB_EVENTS_URL,
      operatorControlConfigured: !!env.EVENT_INGEST_TOKEN
    }, { headers: { "Access-Control-Allow-Origin": env.OVERLAY_ORIGIN || "*", "Vary": "Origin" } });

    if (url.pathname === "/event") {
      const origin = request.headers.get("Origin") || "";
      const allowedOrigin = env.OVERLAY_ORIGIN || "*";
      const corsOrigin = allowedOrigin === "*" || origin === allowedOrigin ? (allowedOrigin === "*" ? "*" : origin) : "null";
      const cors = {
        "Access-Control-Allow-Origin": corsOrigin,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
        "Access-Control-Max-Age": "86400", "Vary": "Origin"
      };
      if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
      if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: cors });
      if (corsOrigin === "null") return new Response("Origin not allowed", { status: 403, headers: cors });
      const supplied = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
      if (!env.EVENT_INGEST_TOKEN || !constantTimeEqual(supplied, env.EVENT_INGEST_TOKEN)) return new Response("Unauthorized", { status: 401, headers: cors });
      const raw = await request.text();
      if (new TextEncoder().encode(raw).byteLength > MAX_EVENT_BYTES) return new Response("Event too large", { status: 413, headers: cors });
      let event;
      try { event = JSON.parse(raw); } catch (error) { return new Response("Invalid JSON", { status: 400, headers: cors }); }
      if (!event || typeof event !== "object" || !ALLOWED_TYPES.has(event.type) || !event.data || typeof event.data !== "object") return new Response("Unsupported event", { status: 400, headers: cors });
      const id = env.AFTERDARK_RELAY.idFromName("primary-room");
      const result = await env.AFTERDARK_RELAY.get(id).fetch("https://relay.internal/publish", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(event)
      });
      return new Response(await result.text(), { status: result.status, headers: { ...cors, "Content-Type": "application/json" } });
    }

    if (url.pathname !== "/ws") return new Response("Not found", { status: 404 });
    if (request.headers.get("Upgrade") !== "websocket") return new Response("WebSocket upgrade required", { status: 426 });
    const token = url.searchParams.get("token") || "";
    if (!env.OVERLAY_TOKEN || !constantTimeEqual(token, env.OVERLAY_TOKEN)) return new Response("Unauthorized", { status: 401 });
    const id = env.AFTERDARK_RELAY.idFromName("primary-room");
    return env.AFTERDARK_RELAY.get(id).fetch(request);
  }
};

export class AfterdarkRelay {
  constructor(state, env) { this.state = state; this.env = env; this.polling = false; }

  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname === "/publish") {
      const raw = await request.text();
      if (new TextEncoder().encode(raw).byteLength > MAX_EVENT_BYTES) return new Response("Event too large", { status: 413 });
      let event;
      try { event = JSON.parse(raw); } catch (error) { return new Response("Invalid JSON", { status: 400 }); }
      if (!event || !ALLOWED_TYPES.has(event.type) || !event.data || typeof event.data !== "object") return new Response("Unsupported event", { status: 400 });
      this.broadcast(event);
      return Response.json({ ok: true, type: event.type, deliveredTo: this.state.getWebSockets().length });
    }
    if (request.headers.get("Upgrade") !== "websocket") return new Response("WebSocket required", { status: 426 });
    const pair = new WebSocketPair(), client = pair[0], server = pair[1];
    this.state.acceptWebSocket(server);
    server.send(JSON.stringify({ type: "room", data: { status: "AFTERDARK CONNECTED", mode: this.env.CB_EVENTS_URL ? "LIVE EVENT FEED CONNECTING" : "OPERATOR CONTROL CONNECTED" } }));
    if (this.env.CB_EVENTS_URL) await this.ensureAlarm();
    return new Response(null, { status: 101, webSocket: client });
  }

  async ensureAlarm() {
    if (await this.state.storage.getAlarm() === null) await this.state.storage.setAlarm(Date.now() + 100);
  }

  async alarm() {
    const sockets = this.state.getWebSockets();
    if (!sockets.length || !this.env.CB_EVENTS_URL) return;
    if (this.polling) { await this.state.storage.setAlarm(Date.now() + 1500); return; }
    this.polling = true;
    try {
      const nextUrl = await this.state.storage.get("nextUrl") || this.env.CB_EVENTS_URL;
      const pollUrl = new URL(nextUrl);
      pollUrl.searchParams.set("timeout", "10");
      const response = await fetch(pollUrl.toString(), { headers: { "Accept": "application/json" } });
      if (!response.ok) throw new Error("Chaturbate event feed returned " + response.status);
      const body = await response.json();
      if (typeof body.nextUrl === "string" && body.nextUrl) await this.state.storage.put("nextUrl", body.nextUrl);
      for (const item of (Array.isArray(body.events) ? body.events.slice(0, 100) : [])) {
        const event = normalizeChaturbateEvent(item);
        if (event) this.broadcast(event);
      }
      await this.state.storage.setAlarm(Date.now() + 100);
    } catch (error) {
      this.broadcast({ type: "notification", data: { eyebrow: "EVENT BRIDGE", title: "CONNECTION INTERRUPTED", message: "The room event feed is reconnecting." } });
      await this.state.storage.setAlarm(Date.now() + 5000);
    } finally { this.polling = false; }
  }

  broadcast(event) {
    if (!event || !ALLOWED_TYPES.has(event.type)) return;
    const payload = JSON.stringify(event);
    if (new TextEncoder().encode(payload).byteLength > MAX_EVENT_BYTES) return;
    for (const socket of this.state.getWebSockets()) {
      try { socket.send(payload); } catch (error) { /* Closed sockets are removed by the runtime. */ }
    }
  }
  webSocketClose() {}
  webSocketError() {}
}

export function normalizeChaturbateEvent(event) {
  if (!event || typeof event !== "object") return null;
  const object = event.object || {};
  const user = object.user || {};
  const name = clean(user.username || "");

  if (event.method === "tip") {
    const tip = object.tip || {};
    const tokens = Math.max(0, Math.floor(Number(tip.tokens) || 0));
    if (!tokens) return null;
    const anonymous = !!tip.isAnon;
    return { type: "tip", data: {
      eyebrow: "BROTHERHOOD SUPPORT",
      title: anonymous ? "✦ A MYSTERY TIP LANDED ✦" : "✦ " + name + " SENT SUPPORT ✦",
      message: tokens.toLocaleString("en-US") + " TOKENS · THE AFTERDARK FEELS THAT ONE.",
      duration: 6500
    }};
  }

  if (event.method === "userEnter" && name) return {
    type: "viewer", data: {
      eyebrow: "NEW ARRIVAL", title: name.toUpperCase() + " ENTERED AFTERDARK",
      message: "Make yourself comfortable. The night is just getting started.", duration: 5000
    }
  };
  if (event.method === "userLeave" && name) return {
    type: "notification", data: {
      eyebrow: "ROOM MOVEMENT", title: name.toUpperCase() + " LEFT THE ROOM",
      message: "The night keeps moving.", duration: 3500
    }
  };
  if (event.method === "follow" && name) return {
    type: "notification", data: {
      eyebrow: "NEW FOLLOW", title: name.toUpperCase() + " JOINED THE BROTHERHOOD",
      message: "Thanks for finding your way into AFTERDARK.", duration: 5000
    }
  };
  if (event.method === "fanclubJoin" && name) return {
    type: "vip", data: {
      eyebrow: "BROTHERHOOD MEMBER", title: name.toUpperCase() + " JOINED THE INNER CIRCLE",
      value: "NEW FAN CLUB MEMBER", detail: "A new member joined the Brotherhood.", announce: true
    }
  };
  if (event.method === "mediaPurchase" && name) {
    const media = object.media || {};
    return { type: "notification", data: {
      eyebrow: "SUPPORT RECEIVED", title: name.toUpperCase() + " UNLOCKED CONTENT",
      message: "A " + clean(media.type || "media purchase").toUpperCase() + " purchase came through.", duration: 5000
    }};
  }
  if (event.method === "roomSubjectChange") return {
    type: "room", data: { status: "AFTERDARK LIVE", mode: String(object.subject || "ROOM SUBJECT UPDATED").replace(/[\\u0000-\\u001f\\u007f]/g, " ").trim().slice(0, 50) }
  };
  if (event.method === "broadcastStart") return {
    type: "room", data: { status: "LIVE FROM AFTERDARK", mode: "THE BROTHERHOOD IS OPEN" }
  };
  if (event.method === "broadcastStop") return {
    type: "room", data: { status: "BROADCAST ENDED", mode: "UNTIL NEXT TIME" }
  };

  if (event.method === "chatMessage") {
    const raw = object.message && (object.message.message || object.message) || "";
    const lower = String(raw).trim().toLowerCase();
    if (!name) return null;

    // Never mirror private answers or free-form viewer text onto the public overlay.
    const submissions = [
      [/^!code\s+\d{4}$/, "CODEBREAKER", "CODE ATTEMPT RECEIVED"],
      [/^!word\s+\S+/, "WORD SCRAMBLE", "ANSWER SUBMITTED"],
      [/^!(?:a|b)$/, "DIRTY WOULD YOU RATHER", "VOTE RECEIVED"],
      [/^!position\s+\S+/, "POSITION IMPOSSIBLE", "GUESS SUBMITTED"],
      [/^!charade\s+\S+/, "DIRTY CHARADES", "GUESS SUBMITTED"],
      [/^!addword\s+\S+/, "ONE WORD STORY", "WORD ADDED TO THE STORY"],
      [/^!dareanswer\s+\S+/, "AFTERDARK DARE DECK", "RESPONSE SUBMITTED"],
      [/^!caption\s+\S+/, "CAPTION CLASH", "CAPTION ENTERED"],
      [/^!guess\s+\d{1,3}$/, "GUESS THE NUMBER", "GUESS LOCKED IN"],
      [/^!answer\s+\S+/, "COUPLE TRIVIA", "ANSWER LOCKED IN"]
    ];
    for (const [pattern, game, action] of submissions) {
      if (pattern.test(lower)) return {
        type: "notification", data: {
          eyebrow: game, title: name.toUpperCase() + " · " + action,
          message: "A player submission was received.", duration: 3200
        }
      };
    }
    if (/^!door\s+[123]$/.test(lower)) return {
      type: "game_reveal", data: {
        eyebrow: "THREE DOORS", title: name.toUpperCase() + " CHOSE A DOOR",
        message: "Door selection received. Awaiting the reveal.", duration: 5000
      }
    };
  }
  return null;
}
function clean(value) { return String(value || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 25) || "A VIEWER"; }
function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}