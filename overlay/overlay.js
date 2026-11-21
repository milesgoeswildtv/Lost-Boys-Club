(function () {
  "use strict";
  var root = document.getElementById("afterdark-overlay");
  if (!root || root.dataset.initialized === "true") return;
  root.dataset.initialized = "true";

  var $ = function (id) { return document.getElementById(id); };
  var eventTimer = null;
  var gameHideTimer = null;
  var gameClockTimer = null;
  var gameRemaining = null;
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

  function gameNode(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = String(text);
    return node;
  }
  function renderGame(data, starting) {
    var panel = $("game-window");
    panel.hidden = false;
    panel.classList.add("visible");
    $("game-status-label").textContent = safeText(data.statusLabel, starting ? "GAME STARTED" : "LIVE GAME", 30);
    $("game-title").textContent = safeText(data.title, "BROTHERHOOD GAME", 54);
    $("game-subtitle").textContent = safeText(data.subtitle, "", 90);
    $("game-prompt").textContent = safeText(data.prompt, "", 220);
    $("game-instructions").textContent = safeText(data.instructions, "", 180);
    $("game-round").textContent = data.round ? "ROUND " + safeText(data.round, "", 12) + (data.totalRounds ? " / " + safeText(data.totalRounds, "", 12) : "") : "";
    $("game-meta").textContent = safeText(data.meta || data.detail, "", 100);
    $("game-footer").textContent = safeText(data.footer, "PLAY ALONG IN CHAT", 64);
    var timer = $("game-timer");
    if (data.remainingSeconds != null && isFinite(Number(data.remainingSeconds))) {
      gameRemaining = Math.max(0, Math.floor(Number(data.remainingSeconds)));
      timer.hidden = false;
      updateGameClock();
      clearInterval(gameClockTimer);
      gameClockTimer = setInterval(function () {
        if (gameRemaining > 0) gameRemaining--;
        updateGameClock();
        if (gameRemaining <= 0) clearInterval(gameClockTimer);
      }, 1000);
    } else if (data.timer != null) {
      timer.hidden = false;
      timer.textContent = safeText(data.timer, "", 20);
    } else {
      timer.hidden = true;
      clearInterval(gameClockTimer);
    }
    var content = $("game-content");
    content.replaceChildren();
    var choices = Array.isArray(data.choices) ? data.choices.slice(0, 8) : [];
    var players = Array.isArray(data.players) ? data.players.slice(0, 12) : [];
    var results = Array.isArray(data.results) ? data.results.slice(0, 8) : [];
    if (choices.length) {
      var choiceList = gameNode("div", "game-choice-grid");
      choices.forEach(function (choice, index) {
        var label = typeof choice === "object" ? choice.label || choice.text || choice.name : choice;
        var detail = typeof choice === "object" ? choice.detail : "";
        var item = gameNode("div", "game-choice");
        item.appendChild(gameNode("span", "game-choice-number", String(index + 1).padStart(2, "0")));
        var copy = gameNode("span", "game-choice-copy");
        copy.appendChild(gameNode("strong", "", safeText(label, "OPTION " + (index + 1), 55)));
        if (detail) copy.appendChild(gameNode("small", "", safeText(detail, "", 65)));
        item.appendChild(copy);
        if (typeof choice === "object" && choice.selected) item.classList.add("selected");
        choiceList.appendChild(item);
      });
      content.appendChild(choiceList);
    }
    if (players.length) {
      content.appendChild(gameNode("div", "game-section-label", "PLAYERS IN THE ROUND"));
      var playerList = gameNode("div", "game-player-list");
      players.forEach(function (player) {
        var name = typeof player === "object" ? player.name || player.username : player;
        var detail = typeof player === "object" ? player.detail || player.status : "";
        var row = gameNode("div", "game-player");
        row.appendChild(gameNode("span", "", safeText(name, "PLAYER", 32)));
        if (detail) row.appendChild(gameNode("small", "", safeText(detail, "", 36)));
        playerList.appendChild(row);
      });
      content.appendChild(playerList);
    }
    if (results.length) {
      content.appendChild(gameNode("div", "game-section-label", "ROUND RESULTS"));
      var resultList = gameNode("div", "game-result-list");
      results.forEach(function (result, index) {
        var label = typeof result === "object" ? result.name || result.label : result;
        var score = typeof result === "object" ? result.score || result.detail || result.status : "";
        var row = gameNode("div", "game-result");
        row.appendChild(gameNode("span", "", (index + 1) + ". " + safeText(label, "RESULT", 42)));
        if (score) row.appendChild(gameNode("strong", "", safeText(score, "", 32)));
        resultList.appendChild(row);
      });
      content.appendChild(resultList);
    }
    if (!choices.length && !players.length && !results.length && data.content) {
      content.appendChild(gameNode("div", "game-freeform", safeText(data.content, "", 240)));
    }
    if (data.winner) {
      var winner = gameNode("div", "game-winner", "✦ WINNER · " + safeText(data.winner, "", 45) + " ✦");
      content.appendChild(winner);
    }
  }
  function updateGameClock() {
    $("game-timer").textContent = "⏱ " + Math.floor(gameRemaining / 60) + ":" + String(gameRemaining % 60).padStart(2, "0");
  }
  function closeGame() {
    clearTimeout(gameHideTimer);
    clearInterval(gameClockTimer);
    $("game-window").classList.remove("visible");
    gameHideTimer = setTimeout(function () { $("game-window").hidden = true; }, 300);
    state.activity = { title: "NO GAME RUNNING", detail: "THE FLOOR IS YOURS" };
    render();
  }
  function applyEvent(message) {
    if (!message || typeof message !== "object") return;
    var type = safeText(message.type, "", 40).toLowerCase();
    var data = message.data && typeof message.data === "object" ? message.data : message;

    if (type === "game_start" || type === "game_update" || type === "game_round" || type === "game_results") {
      clearTimeout(gameHideTimer);
      var gameData = data;
      renderGame(gameData, type === "game_start");
      state.activity = { title: safeText(data.title, "LIVE GAME", 42), detail: safeText(data.detail || data.statusLabel, "GAME IN PROGRESS", 72) };
      render();
    } else if (type === "game_end") {
      clearTimeout(gameHideTimer);
      renderGame(Object.assign({}, data, { statusLabel: data.statusLabel || "GAME COMPLETE" }), false);
      state.activity = { title: safeText(data.title, "GAME COMPLETE", 42), detail: safeText(data.detail, "ROUND FINISHED", 72) };
      render();
      gameHideTimer = setTimeout(closeGame, Math.max(2500, Math.min(8000, Number(data.displayMs) || 5000)));
    } else if (type === "goal" || type === "goal_update") {
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
      if (type === "game") applyEvent({ type: "game_start", data: { title: "THREE DOORS", subtitle: "THE BROTHERHOOD CHALLENGE", prompt: "Choose the door you think hides the prize.", instructions: "Type 1, 2, or 3 in chat to lock in your choice.", choices: [{label:"DOOR ONE",detail:"A little mystery"},{label:"DOOR TWO",detail:"Unknown consequences"},{label:"DOOR THREE",detail:"Fortune favors the bold"}], remainingSeconds: 45, round: 1, totalRounds: 3, footer: "CAST YOUR CHOICE IN CHAT" } });

      if (type === "progress") applyEvent({ type: "game_update", data: { title: "THREE DOORS", subtitle: "CHOICES LOCKED", prompt: "The votes are in. Door two was the most popular.", instructions: "The reveal is coming...", choices: [{label:"DOOR ONE",detail:"12 votes"},{label:"DOOR TWO",detail:"19 votes",selected:true},{label:"DOOR THREE",detail:"7 votes"}], players: ["Protocol","NightOwl","VelvetViper","Static"], remainingSeconds: 18, round: 1, totalRounds: 3, footer: "VOTES ARE LOCKED" } });
      if (type === "results") applyEvent({ type: "game_results", data: { title: "THREE DOORS", subtitle: "ROUND RESULTS", prompt: "Door two contained the prize.", results: [{name:"Protocol",score:"+10"},{name:"NightOwl",score:"+5"},{name:"VelvetViper",score:"+2"}], winner: "PROTOCOL", round: 1, totalRounds: 3, footer: "NEXT ROUND LOADING" } });
      if (type === "end") applyEvent({ type: "game_end", data: { title: "THREE DOORS", subtitle: "THE FINAL REVEAL", prompt: "The Brotherhood has a winner.", results: [{name:"Protocol",score:"CHAMPION"},{name:"NightOwl",score:"2ND PLACE"}], winner: "PROTOCOL", footer: "GAME COMPLETE · THANK YOU FOR PLAYING", displayMs: 5000 } });
      if (type === "clear") { $("event-card").classList.remove("visible"); closeGame(); }
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