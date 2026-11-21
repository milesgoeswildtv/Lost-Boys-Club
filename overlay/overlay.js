(function () {
  "use strict";
  var root = document.getElementById("afterdark-overlay");
  if (!root || root.dataset.initialized === "true") return;
  root.dataset.initialized = "true";

  var $ = function (id) { return document.getElementById(id); };
  var eventTimer = null;
  var socket = null;
  var retryTimer = null;
  var state = {
    goal: { title: "THE NIGHT'S BUSINESS", percent: 0, detail: "WAITING FOR THE NEXT MILESTONE" },
    activity: { title: "NO GAME RUNNING", detail: "THE FLOOR IS YOURS" },
    community: { value: "MEMBERS · LOYALTY · VIP", detail: "WELCOME TO THE AFTERDARK" }
  };

  function safeText(value, fallback, max) {
    var text = String(value == null ? "" : value).replace(/[\u0000-\u001f\u007f]/g, " ").trim();
    return (text || fallback || "").slice(0, max || 120);
  }
  function render() {
    $("goal-title").textContent = state.goal.title;
    $("goal-detail").textContent = state.goal.detail;
    $("goal-progress").style.width = Math.max(0, Math.min(100, Number(state.goal.percent) || 0)) + "%";
    $("activity-title").textContent = state.activity.title;
    $("activity-detail").textContent = state.activity.detail;
    $("community-value").textContent = state.community.value;
    $("community-detail").textContent = state.community.detail;
  }
  function showEvent(payload) {
    var card = $("event-card");
    $("event-eyebrow").textContent = safeText(payload.eyebrow, "AFTERDARK TRANSMISSION", 48);
    $("event-title").textContent = safeText(payload.title, "THE NIGHT IS JUST GETTING STARTED", 90);
    $("event-copy").textContent = safeText(payload.message, "", 180);
    card.classList.add("visible");
    clearTimeout(eventTimer);
    eventTimer = setTimeout(function () { card.classList.remove("visible"); }, Math.max(2500, Math.min(15000, Number(payload.duration) || 6500)));
  }
  function applyEvent(message) {
    if (!message || typeof message !== "object") return;
    var type = safeText(message.type, "", 40).toLowerCase();
    var data = message.data && typeof message.data === "object" ? message.data : message;
    if (type === "goal" || type === "goal_update") {
      state.goal = {
        title: safeText(data.title, "ROOM GOAL", 42),
        percent: Math.max(0, Math.min(100, Number(data.percent) || 0)),
        detail: safeText(data.detail, "PROGRESS UPDATED", 72)
      };
      render();
      if (data.announce !== false) showEvent({ eyebrow: "ROOM GOAL", title: state.goal.title, message: state.goal.detail });
    } else if (type === "activity" || type === "game_state") {
      state.activity = {
        title: safeText(data.title, "ROOM ACTIVITY", 42),
        detail: safeText(data.detail, "ACTIVITY UPDATED", 72)
      };
      render();
      if (data.announce) showEvent({ eyebrow: "LIVE ACTIVITY", title: state.activity.title, message: state.activity.detail });
    } else if (type === "community" || type === "loyalty" || type === "vip" || type === "retention") {
      state.community = {
        value: safeText(data.value, "BROTHERHOOD UPDATE", 48),
        detail: safeText(data.detail, "MEMBER RECOGNITION", 72)
      };
      render();
      if (data.announce) showEvent({ eyebrow: safeText(data.eyebrow, "BROTHERHOOD", 48), title: safeText(data.title, state.community.value, 90), message: state.community.detail });
    } else if (type === "tip" || type === "viewer" || type === "winner" || type === "notification" || type === "game_reveal") {
      showEvent({
        eyebrow: safeText(data.eyebrow, type.replace(/_/g, " ").toUpperCase(), 48),
        title: safeText(data.title, type === "tip" ? "A TIP JUST LANDED" : "AFTERDARK UPDATE", 90),
        message: safeText(data.message || data.detail, "", 180),
        duration: data.duration
      });
    } else if (type === "room") {
      $("room-status").textContent = safeText(data.status, "LIVE FROM AFTERDARK", 50);
      $("room-mode").textContent = safeText(data.mode, "THE BROTHERHOOD IS OPEN", 50);
    } else if (type === "overlay_state") {
      if (data.goal) state.goal = Object.assign({}, state.goal, data.goal);
      if (data.activity) state.activity = Object.assign({}, state.activity, data.activity);
      if (data.community) state.community = Object.assign({}, state.community, data.community);
      render();
    }
  }

  function setConnection(text, connected) {
    $("connection-state").textContent = text;
    $("connection-state").style.color = connected ? "rgba(166,255,53,.82)" : "rgba(232,229,237,.48)";
  }
  function connect() {
    var params = new URLSearchParams(window.location.search);
    var endpoint = params.get("ws");
    var token = params.get("token");
    if (!endpoint) {
      setConnection("OVERLAY STANDBY · NO EVENT BRIDGE", false);
      return;
    }
    if (!/^wss:\/\//i.test(endpoint)) {
      setConnection("CONNECTION BLOCKED · WSS REQUIRED", false);
      return;
    }
    var url = endpoint + (endpoint.indexOf("?") >= 0 ? "&" : "?") + "token=" + encodeURIComponent(token || "");
    try { socket = new WebSocket(url); }
    catch (err) { setConnection("EVENT BRIDGE UNAVAILABLE", false); scheduleReconnect(); return; }
    socket.addEventListener("open", function () { setConnection("AFTERDARK EVENT BRIDGE CONNECTED", true); });
    socket.addEventListener("message", function (event) {
      try { applyEvent(JSON.parse(event.data)); } catch (err) { /* Ignore malformed events. */ }
    });
    socket.addEventListener("close", function () { setConnection("EVENT BRIDGE RECONNECTING", false); scheduleReconnect(); });
    socket.addEventListener("error", function () { setConnection("EVENT BRIDGE CONNECTION ERROR", false); });
  }
  function scheduleReconnect() {
    clearTimeout(retryTimer);
    retryTimer = setTimeout(connect, 4000);
  }

  var demo = new URLSearchParams(window.location.search).get("demo") === "1";
  if (demo) {
    $("demo-tools").hidden = false;
    $("demo-tools").addEventListener("click", function (event) {
      var type = event.target && event.target.getAttribute("data-demo");
      if (type === "tip") applyEvent({ type: "tip", data: { eyebrow: "BROTHERHOOD SUPPORT", title: "✦ A TIP JUST LANDED ✦", message: "Protocol sent 250 tokens into the afterdark. The room feels that one." } });
      if (type === "goal") applyEvent({ type: "goal", data: { title: "THE MIDNIGHT GOAL", percent: 72, detail: "720 / 1,000 TOKENS · 72% COMPLETE" } });
      if (type === "game") applyEvent({ type: "game_reveal", data: { eyebrow: "THREE DOORS", title: "🚪 DOOR TWO REVEALED", message: "A mystery couple challenge has been selected." } });
      if (type === "clear") $("event-card").classList.remove("visible");
    });
    applyEvent({ type: "goal", data: { title: "THE MIDNIGHT GOAL", percent: 72, detail: "720 / 1,000 TOKENS · 72% COMPLETE", announce: false } });
    applyEvent({ type: "activity", data: { title: "THREE DOORS", detail: "ENTRY OPEN · CHOOSE YOUR DOOR", announce: false } });
    setConnection("PREVIEW MODE · DEMO EVENTS", true);
  } else {
    connect();
  }
  render();

  window.AFTERDARK_OVERLAY = {
    dispatch: applyEvent,
    getState: function () { return JSON.parse(JSON.stringify(state)); }
  };
}());