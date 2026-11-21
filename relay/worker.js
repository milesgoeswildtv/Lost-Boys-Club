const ALLOWED_TYPES = new Set(["tip","viewer","room","notification","game_reveal","winner","goal_update","activity","community","loyalty","vip","retention","overlay_state"]);
const MAX_EVENT_BYTES = 4096;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/health") return Response.json({ ok: true, service: "afterdark-overlay-relay" });
    if (url.pathname !== "/ws") return new Response("Not found", { status: 404 });
    if (request.headers.get("Upgrade") !== "websocket") return new Response("WebSocket upgrade required", { status: 426 });
    const token = url.searchParams.get("token") || "";
    if (!env.OVERLAY_TOKEN || !constantTimeEqual(token, env.OVERLAY_TOKEN)) return new Response("Unauthorized", { status: 401 });
    if (!env.CB_EVENTS_URL) return new Response("Relay is not configured", { status: 503 });
    const id = env.AFTERDARK_RELAY.idFromName("primary-room");
    return env.AFTERDARK_RELAY.get(id).fetch(request);
  }
};

export class AfterdarkRelay {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.polling = false;
  }

  async fetch(request) {
    if (request.headers.get("Upgrade") !== "websocket") return new Response("WebSocket required", { status: 426 });
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    this.state.acceptWebSocket(server);
    server.send(JSON.stringify({ type: "room", data: { status: "AFTERDARK CONNECTED", mode: "LIVE EVENT FEED CONNECTED" } }));
    await this.ensureAlarm();
    return new Response(null, { status: 101, webSocket: client });
  }

  async ensureAlarm() {
    const alarm = await this.state.storage.getAlarm();
    if (alarm === null) await this.state.storage.setAlarm(Date.now() + 100);
  }

  async alarm() {
    const sockets = this.state.getWebSockets();
    if (!sockets.length) return;
    if (this.polling) {
      await this.state.storage.setAlarm(Date.now() + 1500);
      return;
    }
    this.polling = true;
    try {
      const nextUrl = await this.state.storage.get("nextUrl") || this.env.CB_EVENTS_URL;
      const pollUrl = new URL(nextUrl);
      pollUrl.searchParams.set("timeout", "10");
      const response = await fetch(pollUrl.toString(), { headers: { "Accept": "application/json" } });
      if (!response.ok) throw new Error("Chaturbate event feed returned " + response.status);
      const body = await response.json();
      if (typeof body.nextUrl === "string" && body.nextUrl) await this.state.storage.put("nextUrl", body.nextUrl);
      const events = Array.isArray(body.events) ? body.events.slice(0, 100) : [];
      for (const item of events) {
        const event = normalizeChaturbateEvent(item);
        if (event) this.broadcast(event);
      }
      await this.state.storage.setAlarm(Date.now() + 100);
    } catch (error) {
      this.broadcast({ type: "notification", data: { eyebrow: "EVENT BRIDGE", title: "CONNECTION INTERRUPTED", message: "The room event feed is reconnecting." } });
      await this.state.storage.setAlarm(Date.now() + 5000);
    } finally {
      this.polling = false;
    }
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

function normalizeChaturbateEvent(event) {
  if (!event || typeof event !== "object") return null;
  const object = event.object || {};
  const user = object.user || {};
  const name = clean(user.username || "");
  if (event.method === "tip") {
    const tip = object.tip || {};
    const tokens = Math.max(0, Math.floor(Number(tip.tokens) || 0));
    if (!tokens) return null;
    const anonymous = !!tip.isAnon;
    return {
      type: "tip",
      data: {
        eyebrow: "BROTHERHOOD SUPPORT",
        title: anonymous ? "✦ A MYSTERY TIP LANDED ✦" : "✦ " + name + " SENT SUPPORT ✦",
        message: tokens.toLocaleString("en-US") + " TOKENS · THE AFTERDARK FEELS THAT ONE.",
        duration: 6500
      }
    };
  }
  if (event.method === "userEnter" && name) {
    return { type: "viewer", data: { eyebrow: "NEW ARRIVAL", title: name.toUpperCase() + " ENTERED AFTERDARK", message: "Make yourself comfortable. The night is just getting started.", duration: 5000 } };
  }
  if (event.method === "broadcastStart") {
    return { type: "room", data: { status: "LIVE FROM AFTERDARK", mode: "THE BROTHERHOOD IS OPEN" } };
  }
  if (event.method === "broadcastStop") {
    return { type: "room", data: { status: "BROADCAST ENDED", mode: "UNTIL NEXT TIME" } };
  }
  if (event.method === "chatMessage") {
    const message = object.message && (object.message.message || object.message) || "";
    const body = String(message).trim();
    const lower = body.toLowerCase();
    if (/^!door\s+[123]$/.test(lower)) {
      return { type: "game_reveal", data: { eyebrow: "THREE DOORS", title: name.toUpperCase() + " CHOSE A DOOR", message: "Door selection received. Awaiting the reveal.", duration: 5000 } };
    }
    if (/^!caption\s+/.test(lower)) {
      return { type: "notification", data: { eyebrow: "CAPTION CLASH", title: name.toUpperCase() + " ENTERED", message: "A new caption has joined the contest.", duration: 4500 } };
    }
  }
  return null;
}

function clean(value) {
  return String(value || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 25) || "A VIEWER";
}

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}