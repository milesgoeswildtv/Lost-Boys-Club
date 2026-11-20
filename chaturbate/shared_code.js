/*
 * AFTERDARK BROTHERHOOD — Shared Code
 * Version: 0.1.1
 * Paste into the Chaturbate Developer Portal "Shared Code" editor.
 *
 * Chaturbate SDK access is injected by event handlers through LBC.runtime.
 */
var LBC = (function () {
  "use strict";

  var PREFIX = "lbc_v1_";
  var GAME_TIMEOUT_LABEL = "lbc_guess_number_timeout";
  var GAME_SECONDS = 90;
  var MIN_GUESS = 1;
  var MAX_GUESS = 100;
  var MAX_SCORE_ENTRIES = 100;

  function readJson(key, fallback) {
    try {
      var raw = LBC.runtime.kvGet(PREFIX + key, "");
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (err) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      return LBC.runtime.kvSet(PREFIX + key, JSON.stringify(value));
    } catch (err) {
      return false;
    }
  }

  function now() {
    return Math.floor(Date.now() / 1000);
  }

  function cleanName(value) {
    return String(value || "someone").replace(/[^a-zA-Z0-9_\-]/g, "").slice(0, 25) || "someone";
  }

  function notice(text, options) {
    try {
      LBC.runtime.sendNotice(String(text), options || {});
    } catch (err) {
      // A notice failure must never crash the app's event handler.
    }
  }

  function getGame() {
    return readJson("game", {
      type: "idle",
      active: false,
      secret: null,
      guesses: {},
      startedAt: 0,
      endsAt: 0
    });
  }

  function saveGame(game) {
    writeJson("game", game);
  }

  function getRecords() {
    return readJson("records", { rounds: 0, wins: {}, recentWinners: [] });
  }

  function saveRecords(records) {
    writeJson("records", records);
  }

  function getScoreboardLines(records, limit) {
    var rows = [];
    var wins = records && records.wins ? records.wins : {};
    Object.keys(wins).forEach(function (name) {
      rows.push({ name: name, wins: Number(wins[name]) || 0 });
    });
    rows.sort(function (a, b) {
      return b.wins - a.wins || a.name.localeCompare(b.name);
    });
    return rows.slice(0, limit || 5).map(function (row, index) {
      return (index + 1) + ". " + row.name + " — " + row.wins + " win" + (row.wins === 1 ? "" : "s");
    });
  }

  function helpText() {
    return [
      "🖤 AFTERDARK BROTHERHOOD — BROTHERHOOD",
      "No map. No supervision. Questionable decisions.",
      "",
      "FREE GAME: GUESS THE NUMBER",
      "When a round is active, type: !guess 42",
      "Pick a whole number from 1 to 100. One guess per person.",
      "",
      "Room commands:",
      "!ab — show this help",
      "!game — show the current game",
      "!scoreboard — show brotherhood records",
      "!supportstats — show room support totals",
      "!points / !rewards — free-play loyalty points and reward shelf",
      "!redeem 1 — request a reward using points",
      "!giveaway / !enter — view or enter a free room giveaway",
      "!profile — view your profile, game stats, loyalty balance, and VIP tier",
      "!vip — view your permanent room VIP tier",
      "!leaderboard wins|games|points — room leaderboards",
      "!queue / !joinqueue / !leavequeue — view and join the viewer waitlist",
      "!slots / !book 1 / !cancelbooking — scheduled viewer slots",
      "",
      "Broadcaster controls:",
      "/ab start — start a 90-second round",
      "/ab stop — end the current round",
      "/ab giveaway start Prize — open a free-entry giveaway",
      "/ab rewards add 100 Reward — add a loyalty reward",
      "/ab admin — open the room control center"
    ].join("\n");
  }

  function statusText() {
    var game = getGame();
    if (!game.active) return "🎮 No game running. The brotherhood is unsupervised.";
    var count = Object.keys(game.guesses || {}).length;
    return "🎯 GUESS THE NUMBER is live! Pick 1–100 with !guess <number>. " +
      count + " player" + (count === 1 ? "" : "s") + " entered. " +
      "Time left: " + Math.max(0, game.endsAt - now()) + "s.";
  }

  function startGuessGame() {
    var current = getGame();
    if (current.active) {
      notice("The current round is already running. Please don't make the brotherhood manage two disasters at once.");
      return;
    }

    var secret = Math.floor(Math.random() * (MAX_GUESS - MIN_GUESS + 1)) + MIN_GUESS;
    var game = {
      type: "guess_number",
      active: true,
      secret: secret,
      guesses: {},
      startedAt: now(),
      endsAt: now() + GAME_SECONDS
    };

    saveGame(game);
    try {
      LBC.runtime.cancelCallback(GAME_TIMEOUT_LABEL);
      LBC.runtime.createCallback(GAME_TIMEOUT_LABEL, GAME_SECONDS, false);
    } catch (err) {
      // The round remains playable; broadcaster can end it manually.
    }

    notice(
      "🖤 AFTERDARK BROTHERHOOD GAME TIME 🖤\n" +
      "GUESS THE NUMBER: I'm thinking of a number from 1 to 100.\n" +
      "Type !guess followed by your number. One guess each.\n" +
      "You have " + GAME_SECONDS + " seconds. No tips, entry fees, or purchases required.\n" +
      "Let's see who has at least one functioning brain cell."
    );
  }

  function finishGuessGame(reason) {
    var game = getGame();
    if (!game.active || game.type !== "guess_number") return;

    game.active = false;
    saveGame(game);

    var records = getRecords();
    records.rounds = (Number(records.rounds) || 0) + 1;

    var guessers = Object.keys(game.guesses || {});
    var winner = null;
    guessers.forEach(function (name) {
      if (Number(game.guesses[name]) === Number(game.secret)) winner = name;
    });

    if (winner) {
      records.wins[winner] = (Number(records.wins[winner]) || 0) + 1;
      if (LBC.rewards) LBC.rewards.award(winner, 5, "Guess the Number win", "win:guess:" + game.startedAt + ":" + winner.toLowerCase());
      records.recentWinners.unshift({ name: winner, at: now() });
      records.recentWinners = records.recentWinners.slice(0, 10);
      saveRecords(records);
      notice("🏆 BROTHERHOOD WINNER: " + winner + " got it. The number was " + game.secret + ". Enjoy your wildly temporary superiority.");
    } else {
      saveRecords(records);
      notice(
        (reason === "timeout" ? "⏰ Time's up." : "🛑 Round ended.") +
        " Nobody nailed it. The number was " + game.secret +
        ". " + guessers.length + " guess" + (guessers.length === 1 ? "" : "es") + " submitted. The brotherhood remains intellectually unsupervised."
      );
    }
  }

  function submitGuess(username, rawGuess) {
    var game = getGame();
    if (!game.active || game.type !== "guess_number") {
      notice("There's no number game running right now. The boys are currently making other questionable decisions.", { toUsername: username });
      return;
    }

    var guess = Number(rawGuess);
    if (!Number.isInteger(guess) || guess < MIN_GUESS || guess > MAX_GUESS) {
      notice("Your guess needs to be a whole number from 1 to 100.", { toUsername: username });
      return;
    }

    var key = cleanName(username).toLowerCase();
    if (Object.prototype.hasOwnProperty.call(game.guesses, key)) {
      notice("You've already used your guess this round. One brain cell, one shot.", { toUsername: username });
      return;
    }

    game.guesses[key] = guess;
    saveGame(game);
    if (LBC.rewards) LBC.rewards.award(username, 1, "Guess the Number participation", "play:guess:" + game.startedAt + ":" + key);

    if (guess === Number(game.secret)) {
      finishGuessGame("winner");
    } else {
      var hint = guess < Number(game.secret) ? "higher" : "lower";
      notice("Guess locked for " + cleanName(username) + ". Try " + hint + ".", { toUsername: username });
    }
  }

  function scoreboard() {
    var records = getRecords();
    var lines = getScoreboardLines(records, 5);
    notice(
      "🏚️ AFTERDARK BROTHERHOOD — HALL OF SHAME / FAME\n" +
      "Rounds played: " + (Number(records.rounds) || 0) + "\n" +
      (lines.length ? lines.join("\n") : "No winners yet. A clean slate of questionable potential.")
    );
  }

  function welcome(username) {
    var safe = cleanName(username);
    var key = "welcome_" + safe.toLowerCase();
    var last = Number(LBC.runtime.kvGet(PREFIX + key, "0")) || 0;
    var current = now();

    // One welcome per user per 6 hours, avoiding noisy repeat greetings.
    if (current - last < 21600) return;
    LBC.runtime.kvSet(PREFIX + key, String(current), 86400);

    notice("🖤 " + safe + " wandered into AFTERDARK BROTHERHOOD. No map, no supervision, questionable decisions. Make yourself comfortable.");
  }

  function onChatMessage(rawBody, rawUsername, isOwner) {
    var body = String(rawBody || "").trim();
    if (!body) return;

    var username = cleanName(rawUsername);
    var lower = body.toLowerCase();

    if (isOwner && lower === "/ab start") {
      startGuessGame();
      return;
    }
    if (isOwner && lower === "/ab stop") {
      finishGuessGame("manual");
      return;
    }

    if (lower === "!ab" || lower === "!ab help") {
      notice(helpText(), { toUsername: username });
      return;
    }
    if (lower === "!game") {
      notice(statusText(), { toUsername: username });
      return;
    }
    if (lower === "!scoreboard") {
      scoreboard();
      return;
    }

    var match = lower.match(/^!guess\s+([0-9]{1,3})$/);
    if (match) {
      submitGuess(username, match[1]);
      return;
    }

    // Broadcaster-only command help. Do not react to ordinary conversation.
    if (isOwner && lower === "/ab help") {
      notice(helpText(), { toUsername: username });
    }
  }

  function onCallback(label) {
    if (label === GAME_TIMEOUT_LABEL) finishGuessGame("timeout");
  }

  function onTip(tokens, isAnon, username) {
    // Tips are acknowledged, never treated as paid game entry or a wager.
    var safe = isAnon ? "A generous mystery human" : cleanName(username);
    if (Number(tokens) > 0) {
      notice("🖤 " + safe + " tossed " + Number(tokens) + " tokens into the brotherhood. Much appreciated. No game advantage attached.");
    }
  }

  function panelData() {
    var game = getGame();
    var records = getRecords();
    var leaders = getScoreboardLines(records, 1);
    return {
      game: game,
      rounds: Number(records.rounds) || 0,
      leader: leaders.length ? leaders[0] : "No champion yet"
    };
  }

  return {
    version: "0.1.1",
    helpText: helpText,
    statusText: statusText,
    startGuessGame: startGuessGame,
    finishGuessGame: finishGuessGame,
    onChatMessage: onChatMessage,
    onUserEnter: welcome,
    onCallback: onCallback,
    onTip: onTip,
    panelData: panelData,
    notice: notice
  };
}());

/*
 * AFTERDARK BROTHERHOOD — EVENT HANDLER BRIDGE
 * Shared Code never calls the Chaturbate SDK directly. Event handlers
 * inject platform methods through this runtime facade.
 */
(function () {
  "use strict";
  var runtime = {};
  LBC.setRuntime = function (api) { runtime = api || {}; };
  LBC.runtime = {
    kvGet: function (key, fallback) { try { return typeof runtime.kvGet === "function" ? runtime.kvGet(key, fallback) : fallback; } catch (err) { return fallback; } },
    kvSet: function (key, value, ttlSeconds) { try { return typeof runtime.kvSet === "function" ? runtime.kvSet(key, value, ttlSeconds) : false; } catch (err) { return false; } },
    sendNotice: function (message, options) { try { return typeof runtime.sendNotice === "function" ? runtime.sendNotice(String(message), options || {}) : false; } catch (err) { return false; } },
    createCallback: function (label, seconds, repeat) { try { return typeof runtime.createCallback === "function" ? runtime.createCallback(label, seconds, repeat) : false; } catch (err) { return false; } },
    cancelCallback: function (label) { try { return typeof runtime.cancelCallback === "function" ? runtime.cancelCallback(label) : false; } catch (err) { return false; } },
    reloadPanel: function () { try { return typeof runtime.reloadPanel === "function" ? runtime.reloadPanel() : false; } catch (err) { return false; } },
    setPanelTemplate: function (template) { try { return typeof runtime.setPanelTemplate === "function" ? runtime.setPanelTemplate(template) : false; } catch (err) { return false; } }
  };
}());

/*
 * AFTERDARK BROTHERHOOD — ADVANCED GOAL ENGINE
 * Multi-stage, timed, resumable goals with milestones and token carryover.
 * Shared Code uses only the injected runtime facade.
 */
(function () {
  "use strict";
  var KEY = "lbc_m2_room_goal";
  var STATS = "lbc_m2_tip_stats";
  var TIMER = "ab_goal_deadline";
  var DEFAULTS = [25, 50, 75, 100];

  function json(key, fallback) {
    try { var raw = LBC.runtime.kvGet(key, ""); return raw ? JSON.parse(raw) : fallback; }
    catch (err) { return fallback; }
  }
  function total() { return Math.max(0, Number(json(STATS, {}).totalTokens) || 0); }
  function cleanTitle(value) {
    return String(value || "Brotherhood Goal").replace(/[\r\n\t]/g, " ").replace(/\s+/g, " ").trim().slice(0, 48) || "Brotherhood Goal";
  }
  function integer(value, min, max) {
    var n = Number(value);
    return Number.isInteger(n) && n >= min && n <= max ? n : null;
  }
  function read() {
    var g = json(KEY, {});
    return {
      version: 3,
      target: Math.max(0, Number(g.target) || 0),
      title: cleanTitle(g.title),
      startTotal: Math.max(0, Number(g.startTotal) || 0),
      active: g.active === true,
      paused: g.paused === true,
      pausedTotal: Math.max(0, Number(g.pausedTotal) || 0),
      completed: g.completed === true,
      milestones: Array.isArray(g.milestones) && g.milestones.length ? g.milestones : DEFAULTS.slice(),
      reached: g.reached && typeof g.reached === "object" ? g.reached : {},
      queue: Array.isArray(g.queue) ? g.queue.slice(0, 10) : [],
      lastCompleted: g.lastCompleted || null,
      durationMinutes: integer(g.durationMinutes, 1, 1440),
      deadlineAt: Math.max(0, Number(g.deadlineAt) || 0),
      remainingMs: Math.max(0, Number(g.remainingMs) || 0),
      carryover: g.carryover !== false,
      repeat: g.repeat === true,
      repeatCount: Math.max(0, Number(g.repeatCount) || 0)
    };
  }
  function save(g) {
    g.version = 3;
    LBC.runtime.kvSet(KEY, JSON.stringify(g));
    LBC.runtime.reloadPanel();
  }
  function cancelTimer() { LBC.runtime.cancelCallback(TIMER); }
  function scheduleTimer(g) {
    cancelTimer();
    if (!g.active || g.paused || !g.deadlineAt) return;
    var seconds = Math.max(1, Math.ceil((g.deadlineAt - Date.now()) / 1000));
    LBC.runtime.createCallback(TIMER, seconds, false);
  }
  function progress(g) {
    if (!g || !g.target) return null;
    var earned = Math.max(0, total() - g.startTotal);
    return { earned: earned, shown: Math.min(earned, g.target), percent: Math.min(100, Math.floor(earned / g.target * 100)), overflow: Math.max(0, earned - g.target) };
  }
  function activate(g, target, title, durationMinutes, carry) {
    g.target = target;
    g.title = cleanTitle(title);
    g.startTotal = Math.max(0, total() - Math.max(0, carry || 0));
    g.active = true;
    g.paused = false;
    g.pausedTotal = 0;
    g.completed = false;
    g.reached = {};
    g.durationMinutes = integer(durationMinutes, 1, 1440);
    g.remainingMs = g.durationMinutes ? g.durationMinutes * 60000 : 0;
    g.deadlineAt = g.durationMinutes ? Date.now() + g.remainingMs : 0;
    scheduleTimer(g);
  }
  function timerLabel(g) {
    if (!g.durationMinutes) return "UNTIMED";
    var ms = g.paused ? g.remainingMs : Math.max(0, g.deadlineAt - Date.now());
    var mins = Math.ceil(ms / 60000);
    return g.paused ? "PAUSED · " + mins + "m left" : mins + "m left";
  }
  function status() {
    var g = read(), p = progress(g);
    if (!p) { LBC.notice("No room goal is configured. Use /ab goal set 1000 Title or /ab goal timed 1000 30 Title."); return; }
    var state = g.paused ? "PAUSED" : g.active ? "LIVE" : g.completed ? "REACHED" : "OFF";
    var queueText = g.queue.length ? "\nUP NEXT: " + g.queue[0].title + " · " + g.queue[0].target + " tokens (" + g.queue.length + " queued)" : "";
    LBC.notice("🏁 " + g.title.toUpperCase() + "\n" + state + " · " + p.shown + " / " + g.target + " tokens · " + p.percent + "% · " + timerLabel(g) +
      "\nMilestones: " + g.milestones.join("% · ") + "% · Carryover " + (g.carryover ? "ON" : "OFF") + " · Repeat " + (g.repeat ? "ON" : "OFF") +
      queueText + "\nSupport is voluntary. Tipping does not award points or game advantages.");
  }
  function startNext(g, carry) {
    var next = g.queue.shift();
    if (next) {
      activate(g, Number(next.target), next.title, next.durationMinutes, g.carryover ? carry : 0);
      LBC.notice("🏁 NEXT STAGE: " + g.title + " · " + g.target + " tokens" + (g.durationMinutes ? " · " + g.durationMinutes + "m" : "") +
        (carry && g.carryover ? " · " + carry + " overflow tokens carried forward." : "") + " Progress starts now.");
      return true;
    }
    if (g.repeat) {
      var oldTarget = g.target, oldTitle = g.title, oldDuration = g.durationMinutes;
      g.repeatCount += 1;
      activate(g, oldTarget, oldTitle, oldDuration, g.carryover ? carry : 0);
      LBC.notice("🔁 GOAL RESTARTED: " + g.title + " · round " + (g.repeatCount + 1) + (carry && g.carryover ? " · " + carry + " overflow carried forward." : ""));
      return true;
    }
    return false;
  }
  function complete(g, carry, reason) {
    g.active = false;
    g.paused = false;
    g.completed = reason === "reached";
    g.deadlineAt = 0;
    g.remainingMs = 0;
    g.pausedTotal = 0;
    g.lastCompleted = { title: g.title, target: g.target, at: Date.now(), reason: reason };
    cancelTimer();
    if (reason === "reached") LBC.notice("🏁 GOAL REACHED — " + g.title + " · " + g.target + " tokens. Thank you.");
    else LBC.notice("⌛ GOAL TIME EXPIRED — " + g.title + ". The target was not reached.");
    if (!startNext(g, carry)) save(g);
    else save(g);
  }
  LBC.handleRoomGoalCommand = function (raw, isOwner) {
    var body = String(raw || "").trim(), low = body.toLowerCase(), match, g = read();
    if (low === "!goal") { status(); return; }
    if (!isOwner || low.indexOf("/ab goal") !== 0) return;

    if ((match = body.match(/^\/ab goal\s+timed\s+([1-9][0-9]{0,6})\s+([1-9][0-9]{0,3})\s+(.+)$/i))) {
      var timedTarget = integer(match[1], 1, 9999999), minutes = integer(match[2], 1, 1440);
      if (!timedTarget || !minutes) { LBC.notice("Timed goals allow 1–9,999,999 tokens and 1–1,440 minutes."); return; }
      activate(g, timedTarget, match[3], minutes, 0); save(g);
      LBC.notice("⏱️ TIMED GOAL LIVE: " + g.title + " · " + g.target + " tokens · " + minutes + " minutes."); return;
    }
    if ((match = body.match(/^\/ab goal(?:\s+set)?\s+([1-9][0-9]{0,6})(?:\s+(.+))?$/i))) {
      activate(g, Number(match[1]), match[2], null, 0); save(g);
      LBC.notice("🏁 Goal started: " + g.title + " · " + g.target + " tokens."); return;
    }
    if ((match = body.match(/^\/ab goal queue\s+timed\s+([1-9][0-9]{0,6})\s+([1-9][0-9]{0,3})\s+(.+)$/i))) {
      var qt = integer(match[1], 1, 9999999), qm = integer(match[2], 1, 1440);
      if (!qt || !qm || g.queue.length >= 10) { LBC.notice("Queued timed goal invalid or queue full (10 max)."); return; }
      g.queue.push({ target: qt, durationMinutes: qm, title: cleanTitle(match[3]) }); save(g);
      LBC.notice("Queued timed stage #" + g.queue.length + ": " + cleanTitle(match[3]) + " · " + qt + " tokens · " + qm + "m."); return;
    }
    if ((match = body.match(/^\/ab goal queue\s+([1-9][0-9]{0,6})(?:\s+(.+))?$/i))) {
      if (g.queue.length >= 10) { LBC.notice("Goal queue is full (10)."); return; }
      g.queue.push({ target: Number(match[1]), durationMinutes: null, title: cleanTitle(match[2]) }); save(g);
      LBC.notice("Queued stage #" + g.queue.length + ": " + g.queue[g.queue.length - 1].title + "."); return;
    }
    if (low === "/ab goal queue list") {
      LBC.notice(g.queue.length ? "UPCOMING GOALS\n" + g.queue.map(function (item, i) {
        return (i + 1) + ". " + item.title + " — " + item.target + " tokens" + (item.durationMinutes ? " · " + item.durationMinutes + "m" : "");
      }).join("\n") : "No queued goals."); return;
    }
    if (low === "/ab goal queue clear") { g.queue = []; save(g); LBC.notice("Goal queue cleared."); return; }
    if ((match = low.match(/^\/ab goal milestones\s+(.+)$/))) {
      var parts = match[1].split(/[,\s]+/), marks = [];
      for (var i = 0; i < parts.length; i++) {
        var mark = integer(parts[i], 1, 100);
        if (!mark) { LBC.notice("Use whole percentages from 1 to 100."); return; }
        if (marks.indexOf(mark) < 0) marks.push(mark);
      }
      if (marks.indexOf(100) < 0) marks.push(100);
      marks.sort(function (a, b) { return a - b; });
      if (marks.length > 10) { LBC.notice("Choose up to 10 milestone percentages."); return; }
      g.milestones = marks; g.reached = {}; save(g);
      LBC.notice("Milestones set: " + marks.join("% · ") + "%."); return;
    }
    if ((match = low.match(/^\/ab goal extend\s+([1-9][0-9]{0,6})$/))) {
      if (!g.active) { LBC.notice("No active goal to extend."); return; }
      g.target += Number(match[1]);
      if (g.completed) g.completed = false;
      save(g); LBC.notice("Goal extended. New target: " + g.target + " tokens."); return;
    }
    if (low === "/ab goal pause") {
      if (!g.active) { LBC.notice("No active goal to pause."); return; }
      if (g.paused) { LBC.notice("The room goal is already paused."); return; }
      g.paused = true; g.pausedTotal = total();
      if (g.deadlineAt) { g.remainingMs = Math.max(0, g.deadlineAt - Date.now()); g.deadlineAt = 0; cancelTimer(); }
      save(g); LBC.notice("Goal paused. Tips and timer are frozen until resumed."); return;
    }
    if (low === "/ab goal resume") {
      if (!g.active) { LBC.notice("No active goal to resume."); return; }
      if (!g.paused) { LBC.notice("The goal is not paused."); return; }
      g.startTotal += Math.max(0, total() - g.pausedTotal);
      g.pausedTotal = 0; g.paused = false;
      if (g.durationMinutes) { g.deadlineAt = Date.now() + Math.max(1000, g.remainingMs); scheduleTimer(g); }
      save(g); LBC.notice("Goal resumed. Tips received during the pause were excluded."); return;
    }
    if (low === "/ab goal reset") {
      if (!g.target) { LBC.notice("Set a goal first."); return; }
      activate(g, g.target, g.title, g.durationMinutes, 0); save(g); LBC.notice("Goal reset to 0 / " + g.target + (g.durationMinutes ? " · timer restarted." : ".")); return;
    }
    if (low === "/ab goal off") {
      g.active = false; g.paused = false; g.pausedTotal = 0; g.deadlineAt = 0; g.remainingMs = 0; g.completed = false;
      cancelTimer(); save(g); LBC.notice("Current goal switched off. Queued stages preserved."); return;
    }
    if ((match = low.match(/^\/ab goal carryover\s+(on|off)$/))) {
      g.carryover = match[1] === "on"; save(g); LBC.notice("Goal overflow carryover " + (g.carryover ? "enabled." : "disabled.")); return;
    }
    if ((match = low.match(/^\/ab goal repeat\s+(on|off)$/))) {
      g.repeat = match[1] === "on"; save(g); LBC.notice("Automatic repeat " + (g.repeat ? "enabled." : "disabled.") + "."); return;
    }
    if (low === "/ab goal time") {
      LBC.notice(g.durationMinutes ? "Goal timer: " + timerLabel(g) + "." : "This goal has no time limit."); return;
    }
    if (low === "/ab goal status") { status(); return; }
    LBC.notice("GOAL CONTROLS: set 1000 Title · timed 1000 30 Title · queue 1500 Next · queue timed 2000 20 Final · pause · resume · extend 250 · reset · milestones 10 25 50 75 100 · carryover on|off · repeat on|off · time · queue list|clear · off. Viewer: !goal.");
  };

  LBC.processRoomGoalTip = function (tokens) {
    if (!(Number(tokens) > 0)) return;
    var g = read();
    if (!g.active || g.paused) return;
    var p = progress(g);
    if (!p) return;
    g.milestones.forEach(function (mark) {
      var key = String(mark);
      if (p.percent >= mark && !g.reached[key]) {
        g.reached[key] = true;
        if (mark !== 100) LBC.notice("🏚️ " + g.title + " reached " + mark + "% · " + p.shown + " / " + g.target + " tokens.");
      }
    });
    if (p.percent >= 100) { complete(g, p.overflow, "reached"); return; }
    save(g);
  };

  LBC.processRoomGoalCallback = function (label) {
    if (String(label || "") !== TIMER) return;
    var g = read();
    if (!g.active || g.paused || !g.deadlineAt) return;
    var remaining = g.deadlineAt - Date.now();
    if (remaining > 0) { scheduleTimer(g); return; }
    var p = progress(g);
    complete(g, 0, "expired");
  };

  LBC.resumeRoomGoalTimer = function () {
    var g = read();
    if (g.active && !g.paused && g.deadlineAt) {
      if (g.deadlineAt <= Date.now()) LBC.processRoomGoalCallback(TIMER);
      else scheduleTimer(g);
    }
  };

  LBC.updateGoalPanel = function () {
    var g = read(), p = progress(g);
    if (!p) return;
    var data = LBC.panelData();
    LBC.runtime.setPanelTemplate({
      template: "3_rows_of_labels",
      row1_label: "AFTERDARK BROTHERHOOD",
      row1_value: data.game && data.game.active ? "GAME LIVE" : "BROTHERHOOD OPEN",
      row2_label: cleanTitle(g.title).toUpperCase().slice(0, 18),
      row2_value: (g.paused ? "PAUSED · " : g.active ? "" : g.completed ? "REACHED · " : "OFF · ") +
        p.shown + "/" + g.target + " · " + p.percent + "%" + (g.durationMinutes ? " · " + timerLabel(g) : ""),
      row3_label: "HALL OF FAME",
      row3_value: (data.leader || "No champion yet") + " · " + (Number(data.rounds) || 0) + " rounds"
    });
  };
}());

/*
 * AFTERDARK BROTHERHOOD — LOYALTY & REWARDS
 * Points come from free game participation and wins, never from tips.
 * Redemption requests are broadcaster-reviewed; no cash value or random prizes.
 */
(function () {
  "use strict";
  var USER="lbc_ab_rewards_user_",CAT="lbc_ab_rewards_catalog",REQ="lbc_ab_rewards_requests",NEXT="lbc_ab_rewards_next_id";
  function clean(v){return String(v||"").replace(/[^A-Za-z0-9_-]/g,"").slice(0,25);}
  function read(k,d){try{var x=LBC.runtime.kvGet(k,"");return x?JSON.parse(x):d;}catch(e){return d;}}
  function write(k,v){return LBC.runtime.kvSet(k,JSON.stringify(v));}
  function getUser(name){var n=clean(name);if(!n)return null;var p=read(USER+n.toLowerCase(),{});return {username:n,balance:Math.max(0,Number(p.balance)||0),earned:Math.max(0,Number(p.earned)||0),spent:Math.max(0,Number(p.spent)||0),ids:Array.isArray(p.ids)?p.ids.slice(-30):[],history:Array.isArray(p.history)?p.history.slice(0,8):[]};}
  function saveUser(p){return p?write(USER+p.username.toLowerCase(),p):false;}
  function catalog(){var a=read(CAT,[]);return Array.isArray(a)?a.slice(0,12):[];}
  function requests(){var a=read(REQ,[]);return Array.isArray(a)?a.slice(-50):[];}
  function award(name,amount,reason,id){var p=getUser(name),n=Math.floor(Number(amount)||0),key=String(id||"");if(!p||n<1||n>1000||(key&&p.ids.indexOf(key)>=0))return false;p.balance=Math.min(1000000,p.balance+n);p.earned+=n;p.history.unshift({kind:"earned",points:n,reason:String(reason||"Free game activity").slice(0,45),at:Date.now()});p.history=p.history.slice(0,8);if(key){p.ids.push(key);p.ids=p.ids.slice(-30);}return saveUser(p);}
  function showCatalog(){var a=catalog();LBC.notice(a.length?"🖤 BROTHERHOOD REWARDS\n"+a.map(function(x){return "#"+x.id+" · "+x.cost+" pts — "+x.name;}).join("\n")+"\nRedeem with !redeem <number>. Points are earned by free game participation.":"Rewards shelf empty. Broadcaster: /ab rewards add 100 Reward name.");}
  function review(id,approve){var a=requests(),r=null;for(var i=0;i<a.length;i++)if(Number(a[i].id)===id){r=a[i];break;}if(!r||r.status!=="pending"){LBC.notice("Pending reward request not found.");return;}r.status=approve?"approved":"denied";if(!approve){var p=getUser(r.user);if(p){p.balance+=r.cost;p.spent=Math.max(0,p.spent-r.cost);p.history.unshift({kind:"refund",points:r.cost,reason:"Request #"+id+" denied",at:Date.now()});saveUser(p);}}write(REQ,a);LBC.notice(approve?"Approved #"+id+": "+r.user+" — "+r.name+". Broadcaster fulfillment is now due.":"Denied #"+id+"; "+r.cost+" points refunded to "+r.user+".");LBC.notice(approve?"Your reward request #"+id+" was approved: "+r.name+".":"Your reward request #"+id+" was declined; points refunded.",{toUsername:r.user});}
  function redeem(user,itemId){var name=clean(user),a=catalog(),item=null;for(var i=0;i<a.length;i++)if(Number(a[i].id)===Number(itemId)){item=a[i];break;}if(!item){LBC.notice("That reward is not available.",{toUsername:name});return;}var p=getUser(name),list=requests(),pending=list.filter(function(r){return r.user.toLowerCase()===name.toLowerCase()&&r.status==="pending";});if(pending.length>=3){LBC.notice("You have three pending reward requests already.",{toUsername:name});return;}if(!p||p.balance<item.cost){LBC.notice("You need "+item.cost+" points. Your balance is "+(p?p.balance:0)+".",{toUsername:name});return;}var id=Math.max(1,Number(LBC.runtime.kvGet(NEXT,"1"))||1);LBC.runtime.kvSet(NEXT,String(id+1));p.balance-=item.cost;p.spent+=item.cost;p.history.unshift({kind:"reserved",points:item.cost,reason:"Request #"+id,at:Date.now()});saveUser(p);list.push({id:id,user:name,itemId:item.id,name:item.name,cost:item.cost,status:"pending",at:Date.now()});write(REQ,list.slice(-50));LBC.notice("Reward request #"+id+" submitted: "+item.name+". The broadcaster will review it.",{toUsername:name});LBC.notice(name+" requested reward #"+id+": "+item.name+" ("+item.cost+" points).");}
  LBC.rewards={version:"1.0",award:award,balance:function(name){var p=getUser(name);return p?p.balance:0;}};
  LBC.handleRewardsCommand=function(raw,user,isOwner){var body=String(raw||"").trim(),low=body.toLowerCase(),m;if(low==="!points"){var p=getUser(user);if(p)LBC.notice(p.username+" · "+p.balance+" BROTHERHOOD POINTS\nEarned: "+p.earned+" · Redeemed: "+p.spent+"\nPoints cannot be purchased or earned by tipping.",{toUsername:p.username});return;}if(low==="!rewards"){showCatalog();return;}if((m=body.match(/^!redeem\s+([1-9][0-9]{0,3})$/i))){redeem(user,Number(m[1]));return;}if(!isOwner||(low.indexOf("/ab rewards")!==0&&low.indexOf("/ab points")!==0))return;
    if((m=body.match(/^\/ab rewards add\s+([1-9][0-9]{0,5})\s+(.{2,60})$/i))){var a=catalog();if(a.length>=12){LBC.notice("Rewards shelf is full (12 items).");return;}var id=a.reduce(function(max,x){return Math.max(max,Number(x.id)||0);},0)+1;var name=String(m[2]).replace(/[\r\n\t]/g," ").replace(/\s+/g," ").trim().slice(0,60);a.push({id:id,cost:Number(m[1]),name:name});write(CAT,a);LBC.notice("Added reward #"+id+": "+name+" · "+m[1]+" points.");return;}
    if((m=low.match(/^\/ab rewards remove\s+([1-9][0-9]{0,3})$/))){var rid=Number(m[1]),old=catalog(),next=old.filter(function(x){return Number(x.id)!==rid;});if(next.length===old.length){LBC.notice("Reward not found.");return;}write(CAT,next);LBC.notice("Reward #"+rid+" removed.");return;}
    if((m=low.match(/^\/ab rewards (approve|deny)\s+([1-9][0-9]{0,4})$/))){review(Number(m[2]),m[1]==="approve");return;}
    if(low==="/ab rewards pending"){var q=requests().filter(function(x){return x.status==="pending";});LBC.notice(q.length?"PENDING REWARDS\n"+q.map(function(x){return "#"+x.id+" "+x.user+" — "+x.name+" ("+x.cost+" pts)";}).join("\n"):"No pending reward requests.");return;}
    if(low==="/ab rewards"||low==="/ab rewards list"){showCatalog();return;}
    if((m=body.match(/^\/ab points grant\s+([A-Za-z0-9_-]{1,25})\s+([1-9][0-9]{0,2})$/i))){if(award(m[1],Number(m[2]),"Broadcaster bonus","admin:"+Date.now()+":"+Math.random()))LBC.notice("Granted "+m[2]+" points to "+clean(m[1])+".");return;}
    LBC.notice("REWARDS: /ab rewards add 100 Reward name · remove 1 · pending · approve 1 · deny 1 · list. POINTS: /ab points grant username 10. VIEWERS: !points · !rewards · !redeem 1.");
  };
}());

/*
 * AFTERDARK BROTHERHOOD — Configurable Tip Menu
 * Informational display only.
 */
(function () {
  "use strict";

  var MENU_KEY = "lbc_m2_tip_menu";
  var MAX_ITEMS = 12;
  var MAX_LABEL_LENGTH = 70;

  function readMenu() {
    try {
      var raw = LBC.runtime.kvGet(MENU_KEY, "");
      var parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(function (item) {
        return item && Number(item.amount) > 0 && String(item.label || "").trim();
      }).slice(0, MAX_ITEMS);
    } catch (err) {
      return [];
    }
  }

  function saveMenu(items) {
    LBC.runtime.kvSet(MENU_KEY, JSON.stringify(items));
  }

  function cleanLabel(value) {
    return String(value || "")
      .replace(/[\r\n\t]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, MAX_LABEL_LENGTH);
  }

  function showMenu() {
    var items = readMenu();

    if (!items.length) {
      LBC.notice("🏚️ The AFTERDARK BROTHERHOOD tip menu is empty.");
      return;
    }

    var lines = items.map(function (item, index) {
      return (index + 1) + ". " + Number(item.amount) +
        " tokens — " + cleanLabel(item.label);
    });

    LBC.notice(
      "🖤 AFTERDARK BROTHERHOOD — TIP MENU\n" +
      lines.join("\n") +
      "\n\nTips are voluntary. Menu items are requests, not guaranteed outcomes. No game access or advantage is tied to tipping."
    );
  }

  LBC.handleTipMenuCommand = function (rawBody, isOwner) {
    var body = String(rawBody || "").trim();
    var lower = body.toLowerCase();

    if (lower === "!tipmenu" || lower === "!menu") {
      showMenu();
      return;
    }

    if (!isOwner || lower.indexOf("/ab menu") !== 0) return;

    var addMatch = body.match(/^\/ab menu add ([1-9][0-9]{0,4}) (.{1,200})$/i);

    if (addMatch) {
      var amount = Number(addMatch[1]);
      var label = cleanLabel(addMatch[2]);

      if (!label) {
        LBC.notice("Give the menu item a short label.");
        return;
      }

      var items = readMenu();

      if (items.length >= MAX_ITEMS) {
        LBC.notice("The tip menu is full. Remove an item before adding another.");
        return;
      }

      if (items.some(function (item) {
        return Number(item.amount) === amount;
      })) {
        LBC.notice("That token amount is already in the menu.");
        return;
      }

      items.push({ amount: amount, label: label });
      items.sort(function (a, b) {
        return a.amount - b.amount;
      });

      saveMenu(items);
      LBC.notice("Added: " + amount + " tokens — " + label + ". View with !tipmenu.");
      return;
    }

    var removeMatch = lower.match(/^\/ab menu remove ([1-9][0-9]?)$/);

    if (removeMatch) {
      var removeIndex = Number(removeMatch[1]) - 1;
      var current = readMenu();

      if (removeIndex < 0 || removeIndex >= current.length) {
        LBC.notice("That menu item number doesn't exist.");
        return;
      }

      var removed = current.splice(removeIndex, 1)[0];
      saveMenu(current);
      LBC.notice("Removed: " + removed.amount + " tokens — " + cleanLabel(removed.label) + ".");
      return;
    }

    if (lower === "/ab menu clear") {
      saveMenu([]);
      LBC.notice("Tip menu cleared.");
      return;
    }

    if (lower === "/ab menu" || lower === "/ab menu show") {
      showMenu();
      return;
    }

    LBC.notice(
      "Tip menu controls: /ab menu add 50 Song request · " +
      "/ab menu remove 1 · /ab menu clear · /ab menu show. " +
      "Viewers use !tipmenu."
    );
  };
}());

/*
 * AFTERDARK BROTHERHOOD — Rotating Room Announcements
 * Broadcaster-controlled, low-frequency informational notices.
 * Starts disabled; one notice every 15 minutes while enabled.
 */
(function () {
  "use strict";

  var STATE_KEY = "lbc_m2_announcements";
  var CALLBACK_PREFIX = "lbc_m2_announce_";
  var INTERVAL_SECONDS = 900;
  var MESSAGES = [
    "🖤 Welcome to AFTERDARK BROTHERHOOD. No map. No supervision. Questionable decisions. Type !ab for the brotherhood guide.",
    "🎮 The brotherhood game is free to join. Type !game to see whether a round is running.",
    "🏚️ New around here? Type !ab for the room guide, or !scoreboard to see the brotherhood records.",
    "🖤 Curious what's on the informational tip menu? Type !tipmenu. Requests are voluntary and aren't guaranteed.",
    "Make yourself comfortable, say hello, and enjoy the chaos. No purchase or tip is needed to join the games."
  ];

  function readState() {
    try {
      var raw = LBC.runtime.kvGet(STATE_KEY, "")
      var state = raw ? JSON.parse(raw) : {};
      return {
        enabled: state.enabled === true,
        index: Math.max(0, Number(state.index) || 0),
        callbackLabel: String(state.callbackLabel || "")
      };
    } catch (err) {
      return { enabled: false, index: 0, callbackLabel: "" };
    }
  }

  function saveState(state) {
    LBC.runtime.kvSet(STATE_KEY, JSON.stringify(state))
  }

  function scheduleNext(state) {
    var label = CALLBACK_PREFIX + Date.now() + "_" + Math.floor(Math.random() * 1000000);
    state.callbackLabel = label;
    saveState(state);
    LBC.runtime.createCallback(label, INTERVAL_SECONDS);
  }

  LBC.startAnnouncements = function (restart) {
    var state = readState();
    if (!state.enabled) return;
    if (!restart && state.callbackLabel) return;
    scheduleNext(state);
  };

  LBC.handleAnnouncementCommand = function (rawBody, isOwner) {
    var body = String(rawBody || "").trim().toLowerCase();
    if (!isOwner || body.indexOf("/ab announcements") !== 0) return;

    var state = readState();

    if (body === "/ab announcements on") {
      if (state.enabled) {
        LBC.notice("Rotating announcements are already on. One short notice every 15 minutes.");
        return;
      }
      state.enabled = true;
      state.index = 0;
      state.callbackLabel = "";
      saveState(state);
      scheduleNext(state);
      LBC.notice("Rotating announcements enabled. The first short room notice will appear in 15 minutes.");
      return;
    }

    if (body === "/ab announcements off") {
      state.enabled = false;
      state.callbackLabel = "";
      saveState(state);
      LBC.notice("Rotating announcements disabled.");
      return;
    }

    if (body === "/ab announcements status") {
      LBC.notice("Rotating announcements are " + (state.enabled ? "ON" : "OFF") + ". Cadence: one notice every 15 minutes.");
      return;
    }

    LBC.notice("Announcement controls: /ab announcements on · /ab announcements off · /ab announcements status. Default: off.");
  };

  LBC.onAnnouncementsCallback = function (label) {
    var state = readState();
    if (!state.enabled || !label || label !== state.callbackLabel) return;

    var message = MESSAGES[state.index % MESSAGES.length];
    state.index = (state.index + 1) % MESSAGES.length;
    state.callbackLabel = "";
    saveState(state);
    LBC.notice(message);
    scheduleNext(state);
  };
}());

/*
 * AFTERDARK BROTHERHOOD — Custom Broadcaster Announcements
 * One-off broadcaster message; no scheduling or automatic repetition.
 */
(function () {
  "use strict";

  var MAX_MESSAGE_LENGTH = 200;

  function cleanAnnouncement(value) {
    return String(value || "")
      .replace(/[\r\n\t]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  LBC.handleCustomAnnouncementCommand = function (rawBody, isOwner, username) {
    if (!isOwner) return;

    var body = String(rawBody || "").trim();
    var match = body.match(/^\/ab\s+say(?:\s+([\s\S]*))?$/i);
    if (!match) return;

    var message = cleanAnnouncement(match[1] || "");

    if (!message) {
      LBC.notice("Usage: /ab say Your announcement goes here.", {
        toUsername: String(username || "")
      });
      return;
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
      LBC.notice("That announcement is too long. Keep it to " + MAX_MESSAGE_LENGTH + " characters or fewer.", {
        toUsername: String(username || "")
      });
      return;
    }

    LBC.notice("📣 AFTERDARK BROTHERHOOD — " + message);

    LBC.notice("Your announcement was posted.", {
      toUsername: String(username || "")
    });
  };
}());

/*
 * AFTERDARK BROTHERHOOD — Guess the Number Player Guidance
 * Clear private instructions and recovery guidance for malformed commands.
 */
(function () {
  "use strict";

  function sendPrivateGuide(username) {
    LBC.notice(
      "🎯 GUESS THE NUMBER — QUICK GUIDE\n" +
      "The game is free. No tip or purchase is needed.\n" +
      "When a round is live, send one whole number from 1 to 100.\n" +
      "Example: !guess 42\n" +
      "You get one guess per round. Your higher/lower hint is sent privately.\n" +
      "A correct guess wins the round. Type !game to check whether a round is live.",
      { toUsername: String(username || "") }
    );
  }

  LBC.handleGuessNumberGuidance = function (rawBody, username) {
    var body = String(rawBody || "").trim();

    if (/^!(howtoplay|gamehelp)$/i.test(body)) {
      sendPrivateGuide(username);
      return;
    }

    if (!/^!guess(?:\s+.*)?$/i.test(body)) return;

    if (/^!guess\s+[0-9]{1,3}$/i.test(body)) return;

    LBC.notice(
      "Try !guess followed by one whole number from 1 to 100. Example: !guess 42. " +
      "Type !howtoplay for the full game guide.",
      { toUsername: String(username || "") }
    );
  };
}());

/*
 * AFTERDARK BROTHERHOOD — Higher or Lower
 * Free prediction game. One prediction per viewer; no voting or paid entry.
 */
(function () {
  "use strict";

  var STATE_KEY = "lbc_m3_higher_lower";
  var ROUND_SECONDS = 90;
  var CALLBACK_PREFIX = "lbc_m3_hl_timeout_";

  function readState() {
    try {
      var raw = LBC.runtime.kvGet(STATE_KEY, "")
      var state = raw ? JSON.parse(raw) : {};
      return {
        active: state.active === true,
        current: Number(state.current) || 0,
        target: Number(state.target) || 0,
        guesses: state.guesses && typeof state.guesses === "object" ? state.guesses : {},
        endsAt: Number(state.endsAt) || 0,
        callbackLabel: String(state.callbackLabel || "")
      };
    } catch (err) {
      return { active: false, current: 0, target: 0, guesses: {}, endsAt: 0, callbackLabel: "" };
    }
  }

  function saveState(state) {
    LBC.runtime.kvSet(STATE_KEY, JSON.stringify(state))
  }

  function cleanName(value) {
    return String(value || "someone").replace(/[^a-zA-Z0-9_\-]/g, "").slice(0, 25) || "someone";
  }

  function coreGameIsActive() {
    try {
      var raw = LBC.runtime.kvGet("lbc_v1_game", "");
      var game = raw ? JSON.parse(raw) : null;
      return !!(game && game.active === true);
    } catch (err) {
      return false;
    }
  }

  function schedule(state, seconds) {
    var label = CALLBACK_PREFIX + Date.now() + "_" + Math.floor(Math.random() * 1000000);
    state.callbackLabel = label;
    saveState(state);
    LBC.runtime.createCallback(label, Math.max(1, seconds));
  }

  function finish(reason, expectedLabel) {
    var state = readState();
    if (!state.active) return;
    if (expectedLabel && expectedLabel !== state.callbackLabel) return;

    state.active = false;
    state.callbackLabel = "";
    saveState(state);

    var correctDirection = state.target > state.current ? "higher" : "lower";
    var winners = [];
    var players = Object.keys(state.guesses);
    players.forEach(function (name) {
      if (state.guesses[name] === correctDirection) winners.push(name);
    });

    if (LBC.rewards) winners.forEach(function (name) { LBC.rewards.award(name, 5, "Higher or Lower win", "win:higher:" + state.endsAt + ":" + name.toLowerCase()); });
    var outcome = "The next number was " + state.target + " — " + correctDirection.toUpperCase() + ". ";
    if (winners.length) {
      LBC.notice(
        "🏆 HIGHER OR LOWER — " + outcome +
        "Correct call" + (winners.length === 1 ? "" : "s") + ": " + winners.join(", ") +
        ". Apparently someone here can read numbers. 🖤"
      );
    } else {
      LBC.notice(
        (reason === "timeout" ? "⏰ Time's up. " : "🛑 Round stopped. ") +
        "HIGHER OR LOWER — " + outcome +
        "No correct calls. " + players.length + " prediction" +
        (players.length === 1 ? "" : "s") + " locked in."
      );
    }
  }

  function startRound() {
    var state = readState();
    if (state.active) {
      LBC.notice("Higher or Lower is already running. One brotherhood disaster at a time.");
      return;
    }
    if (coreGameIsActive()) {
      LBC.notice("Guess the Number is already running. Finish that round before starting another game.");
      return;
    }

    var current = Math.floor(Math.random() * 99) + 1;
    var target = Math.floor(Math.random() * 100) + 1;
    while (target === current) target = Math.floor(Math.random() * 100) + 1;

    state = {
      active: true,
      current: current,
      target: target,
      guesses: {},
      endsAt: Math.floor(Date.now() / 1000) + ROUND_SECONDS,
      callbackLabel: ""
    };
    schedule(state, ROUND_SECONDS);

    LBC.notice(
      "🎲 AFTERDARK BROTHERHOOD — HIGHER OR LOWER\n" +
      "The number is " + current + ". The next number is hidden.\n" +
      "Will it be HIGHER or LOWER? Type !higher or !lower.\n" +
      "One prediction per person. " + ROUND_SECONDS + " seconds. Free to play — no tips or purchases."
    );
  }

  LBC.handleHigherLowerCommand = function (rawBody, isOwner, username) {
    var body = String(rawBody || "").trim().toLowerCase();
    var name = cleanName(username);
    var state = readState();

    // If the broadcaster starts the core game, close this round first.
    // Chat Message invokes the core handler before this additive module.
    if (isOwner && body === "/ab start" && state.active) {
      finish("manual");
      return;
    }

    if (body === "!higherhelp") {
      LBC.notice(
        "🎲 HIGHER OR LOWER: When a round is live, look at the displayed number and predict the next one. " +
        "Type !higher or !lower. One free prediction per round. No tip required.",
        { toUsername: name }
      );
      return;
    }

    if (body === "!higherstatus") {
      LBC.notice(
        state.active
          ? "HIGHER OR LOWER is live. Current number: " + state.current + ". " +
          Object.keys(state.guesses).length + " prediction" +
          (Object.keys(state.guesses).length === 1 ? "" : "s") + " locked. Use !higher or !lower."
          : "Higher or Lower is not running. Type !higherhelp for the rules.",
        { toUsername: name }
      );
      return;
    }

    if (isOwner && body === "/ab higher start") {
      startRound();
      return;
    }

    if (isOwner && body === "/ab higher stop") {
      finish("manual");
      return;
    }

    if (isOwner && body === "/ab higher status") {
      LBC.notice("Higher or Lower is " + (state.active ? "ON" : "OFF") + ".");
      return;
    }

    if (body !== "!higher" && body !== "!lower") return;

    if (!state.active) {
      LBC.notice("No Higher or Lower round is running. Type !higherhelp for the rules.", { toUsername: name });
      return;
    }

    var key = name.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(state.guesses, key)) {
      LBC.notice("Your prediction is already locked for this round. One shot, troublemaker.", { toUsername: name });
      return;
    }

    state.guesses[key] = body === "!higher" ? "higher" : "lower";
    saveState(state);
    if (LBC.rewards) LBC.rewards.award(name, 1, "Higher or Lower participation", "play:higher:" + state.endsAt + ":" + key);
    LBC.notice("Your " + (body === "!higher" ? "HIGHER" : "LOWER") + " prediction is locked in. 🖤", { toUsername: name });
  };

  LBC.onHigherLowerCallback = function (label) {
    finish("timeout", String(label || ""));
  };

  LBC.resumeHigherLower = function () {
    var state = readState();
    if (!state.active) return;

    var remaining = state.endsAt - Math.floor(Date.now() / 1000);
    if (remaining <= 0) {
      finish("timeout");
      return;
    }

    // Rotate the callback label so any pre-restart callback becomes stale.
    schedule(state, remaining);
  };
}());

/*
 * AFTERDARK BROTHERHOOD — Couple Trivia
 * Broadcaster-managed questions; free, first-correct-answer wins.
 */
(function () {
  "use strict";

  var QUESTIONS_KEY = "lbc_m3_trivia_questions";
  var STATE_KEY = "lbc_m3_trivia_state";
  var LAST_KEY = "lbc_m3_trivia_last_question";
  var ROUND_SECONDS = 120;
  var CALLBACK_PREFIX = "lbc_m3_trivia_timeout_";
  var MAX_QUESTIONS = 50;
  var MAX_QUESTION_LENGTH = 140;
  var MAX_ANSWER_LENGTH = 80;

  function cleanText(value) {
    return String(value || "")
      .replace(/[\r\n\t]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeAnswer(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function readQuestions() {
    try {
      var raw = LBC.runtime.kvGet(QUESTIONS_KEY, "");
      var list = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(list)) return [];
      return list.filter(function (item) {
        return item && cleanText(item.question) && cleanText(item.answer) &&
          cleanText(item.question).length <= MAX_QUESTION_LENGTH &&
          cleanText(item.answer).length <= MAX_ANSWER_LENGTH;
      }).slice(0, MAX_QUESTIONS);
    } catch (err) {
      return [];
    }
  }

  function saveQuestions(list) {
    LBC.runtime.kvSet(QUESTIONS_KEY, JSON.stringify(list));
  }

  function readState() {
    try {
      var raw = LBC.runtime.kvGet(STATE_KEY, "")
      var state = raw ? JSON.parse(raw) : {};
      return {
        active: state.active === true,
        question: String(state.question || ""),
        answer: String(state.answer || ""),
        guesses: state.guesses && typeof state.guesses === "object" ? state.guesses : {},
        endsAt: Number(state.endsAt) || 0,
        callbackLabel: String(state.callbackLabel || "")
      };
    } catch (err) {
      return { active: false, question: "", answer: "", guesses: {}, endsAt: 0, callbackLabel: "" };
    }
  }

  function saveState(state) {
    LBC.runtime.kvSet(STATE_KEY, JSON.stringify(state))
  }

  function cleanName(value) {
    return String(value || "someone").replace(/[^a-zA-Z0-9_\-]/g, "").slice(0, 25) || "someone";
  }

  function otherGameIsActive() {
    try {
      var coreRaw = LBC.runtime.kvGet("lbc_v1_game", "");
      var core = coreRaw ? JSON.parse(coreRaw) : null;
      if (core && core.active === true) return true;

      var higherRaw = LBC.runtime.kvGet("lbc_m3_higher_lower", "");
      var higher = higherRaw ? JSON.parse(higherRaw) : null;
      return !!(higher && higher.active === true);
    } catch (err) {
      return false;
    }
  }

  function schedule(state, seconds) {
    var label = CALLBACK_PREFIX + Date.now() + "_" + Math.floor(Math.random() * 1000000);
    state.callbackLabel = label;
    saveState(state);
    LBC.runtime.createCallback(label, Math.max(1, seconds));
  }

  function finish(reason, expectedLabel, winner) {
    var state = readState();
    if (!state.active) return;
    if (expectedLabel && expectedLabel !== state.callbackLabel) return;

    state.active = false;
    state.callbackLabel = "";
    saveState(state);

    if (winner) {
      if (LBC.rewards) LBC.rewards.award(winner, 5, "Couple Trivia win", "win:trivia:" + state.endsAt + ":" + String(winner).toLowerCase());
      LBC.notice(
        "🏆 COUPLE TRIVIA — " + cleanName(winner) + " got it first!\n" +
        "Answer: " + state.answer + ". Apparently somebody was paying attention. 🖤"
      );
      return;
    }

    LBC.notice(
      (reason === "timeout" ? "⏰ Time's up. " : "🛑 Trivia round stopped. ") +
      "COUPLE TRIVIA — The answer was: " + state.answer + ". " +
      Object.keys(state.guesses).length + " answer" +
      (Object.keys(state.guesses).length === 1 ? "" : "s") + " submitted."
    );
  }

  function startRound() {
    var state = readState();
    if (state.active) {
      LBC.notice("Couple Trivia is already running. One brotherhood disaster at a time.");
      return;
    }
    if (otherGameIsActive()) {
      LBC.notice("Another brotherhood game is already running. Finish it before starting Couple Trivia.");
      return;
    }

    var questions = readQuestions();
    if (!questions.length) {
      LBC.notice("The trivia deck is empty. Add a question first: /ab trivia add Question :: Answer");
      return;
    }

    var last = Number(LBC.runtime.kvGet(LAST_KEY, "-1"));
    var index = Math.floor(Math.random() * questions.length);
    if (questions.length > 1 && index === last) index = (index + 1) % questions.length;
    LBC.runtime.kvSet(LAST_KEY, String(index));

    var selected = questions[index];
    state = {
      active: true,
      question: selected.question,
      answer: selected.answer,
      guesses: {},
      endsAt: Math.floor(Date.now() / 1000) + ROUND_SECONDS,
      callbackLabel: ""
    };
    schedule(state, ROUND_SECONDS);

    LBC.notice(
      "🧠 AFTERDARK BROTHERHOOD — COUPLE TRIVIA\n" +
      selected.question + "\n" +
      "Type !answer followed by your answer. One attempt each. " +
      ROUND_SECONDS + " seconds. Free to play — no tips or purchases."
    );
  }

  LBC.handleCoupleTriviaCommand = function (rawBody, isOwner, username) {
    var body = String(rawBody || "").trim();
    var lower = body.toLowerCase();
    var name = cleanName(username);
    var state = readState();

    // Other game-start handlers run before this appended module.
    if (isOwner && (lower === "/ab start" || lower === "/ab higher start") && state.active) {
      finish("manual");
      return;
    }

    if (lower === "!triviahelp") {
      LBC.notice(
        "🧠 COUPLE TRIVIA: When a round is live, read the question and send !answer followed by your answer. " +
        "One attempt per person. First correct answer wins. Free to play; no tip required.",
        { toUsername: name }
      );
      return;
    }

    if (lower === "!triviastatus") {
      LBC.notice(
        state.active
          ? "Couple Trivia is live. " + Object.keys(state.guesses).length +
          " answer" + (Object.keys(state.guesses).length === 1 ? "" : "s") +
          " submitted. Send !answer <your answer>."
          : "Couple Trivia is not running. Type !triviahelp for the rules.",
        { toUsername: name }
      );
      return;
    }

    if (isOwner && lower === "/ab trivia start") {
      startRound();
      return;
    }

    if (isOwner && lower === "/ab trivia stop") {
      finish("manual");
      return;
    }

    if (isOwner && lower === "/ab trivia status") {
      LBC.notice("Couple Trivia is " + (state.active ? "ON" : "OFF") + ". " +
        readQuestions().length + " question(s) saved.");
      return;
    }

    if (isOwner && lower === "/ab trivia list") {
      var listed = readQuestions();
      if (!listed.length) {
        LBC.notice("No trivia questions saved yet.");
      } else {
        LBC.notice("COUPLE TRIVIA QUESTIONS (answers hidden):\n" +
          listed.map(function (item, index) {
            return (index + 1) + ". " + item.question;
          }).join("\n"), { toUsername: name });
      }
      return;
    }

    if (isOwner && lower === "/ab trivia clear") {
      if (state.active) {
        LBC.notice("Stop the active trivia round before clearing the question deck.");
        return;
      }
      saveQuestions([]);
      LBC.notice("Couple Trivia question deck cleared.");
      return;
    }

    if (isOwner && lower.indexOf("/ab trivia add") === 0) {
      var addMatch = body.match(/^\/ab trivia add\s+([\s\S]+?)\s+::\s+([\s\S]+)$/i);
      if (!addMatch) {
        LBC.notice("Use: /ab trivia add Your question? :: Correct answer");
        return;
      }
      var question = cleanText(addMatch[1]);
      var answer = cleanText(addMatch[2]);
      if (!question || !answer || question.length > MAX_QUESTION_LENGTH || answer.length > MAX_ANSWER_LENGTH) {
        LBC.notice("Question limit: " + MAX_QUESTION_LENGTH + " characters. Answer limit: " +
          MAX_ANSWER_LENGTH + " characters. Both are required.");
        return;
      }
      var deck = readQuestions();
      if (deck.length >= MAX_QUESTIONS) {
        LBC.notice("The trivia deck is full (" + MAX_QUESTIONS + " questions). Remove one before adding another.");
        return;
      }
      deck.push({ question: question, answer: answer });
      saveQuestions(deck);
      LBC.notice("Trivia question added (" + deck.length + "/" + MAX_QUESTIONS + "). Use /ab trivia list to review the deck.");
      return;
    }

    if (isOwner && lower.indexOf("/ab trivia remove") === 0) {
      var removeMatch = lower.match(/^\/ab trivia remove ([1-9][0-9]?)$/);
      if (!removeMatch) {
        LBC.notice("Use: /ab trivia remove <number>. Check positions with /ab trivia list.");
        return;
      }
      if (state.active) {
        LBC.notice("Stop the active trivia round before editing the question deck.");
        return;
      }
      var removeIndex = Number(removeMatch[1]) - 1;
      var currentDeck = readQuestions();
      if (removeIndex < 0 || removeIndex >= currentDeck.length) {
        LBC.notice("That question number does not exist.");
        return;
      }
      currentDeck.splice(removeIndex, 1);
      saveQuestions(currentDeck);
      LBC.notice("Trivia question removed. " + currentDeck.length + " question(s) remain.");
      return;
    }

    if (isOwner && lower.indexOf("/ab trivia") === 0) {
      LBC.notice(
        "TRIVIA CONTROLS: /ab trivia add Question :: Answer · " +
        "/ab trivia remove 1 · /ab trivia list · /ab trivia clear · " +
        "/ab trivia start · /ab trivia stop · /ab trivia status"
      );
      return;
    }

    var answerMatch = body.match(/^!answer\s+([\s\S]+)$/i);
    if (!answerMatch) return;

    if (!state.active) {
      LBC.notice("No Couple Trivia round is running. Type !triviahelp for the rules.", { toUsername: name });
      return;
    }

    var key = name.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(state.guesses, key)) {
      LBC.notice("Your answer is already locked in for this round. One attempt each.", { toUsername: name });
      return;
    }

    var submitted = cleanText(answerMatch[1]);
    if (!submitted || submitted.length > MAX_ANSWER_LENGTH) {
      LBC.notice("Keep your answer to " + MAX_ANSWER_LENGTH + " characters or fewer.", { toUsername: name });
      return;
    }
    state.guesses[key] = submitted;
    saveState(state);

    if (normalizeAnswer(submitted) === normalizeAnswer(state.answer)) {
      finish("winner", "", name);
    } else {
      LBC.notice("Your answer is locked in. We'll reveal the answer when the round ends. 🖤", { toUsername: name });
    }
  };

  LBC.onCoupleTriviaCallback = function (label) {
    finish("timeout", String(label || ""));
  };

  LBC.resumeCoupleTrivia = function () {
    var state = readState();
    if (!state.active) return;

    var remaining = state.endsAt - Math.floor(Date.now() / 1000);
    if (remaining <= 0) {
      finish("timeout");
      return;
    }
    schedule(state, remaining);
  };
}());

/*
 * AFTERDARK BROTHERHOOD — UNIFIED GAME LIBRARY
 * Version 1.0
 *
 * Central event routing for all LBC games.
 * Existing handlers remain compatible.
 * New games register through LBC.gameLibrary.register().
 */

(function () {
  "use strict";

  if (LBC.gameLibrary) return;

  var modules = {};
  var activeDispatch = "";
  var activeGameKey = "lbc_game_library_active";

  function safeCall(fn, args, label) {
    if (typeof fn !== "function") return;

    try {
      fn.apply(null, args || []);
    } catch (err) {
      LBC.notice(
        "The brotherhood had a small technical issue while processing " +
        label + ". The rest of the room is still running."
      );
    }
  }

  function runModules(eventName, args) {
    Object.keys(modules).forEach(function (name) {
      var module = modules[name];

      if (module && typeof module[eventName] === "function") {
        safeCall(module[eventName], args, name);
      }
    });
  }

  function readActiveGame() {
    try {
      var raw = LBC.runtime.kvGet(activeGameKey, "")
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  }

  function saveActiveGame(game) {
    try {
      if (!game) {
        LBC.runtime.kvSet(activeGameKey, "");
        return;
      }

      LBC.runtime.kvSet(activeGameKey, JSON.stringify(game));
    } catch (err) {
      LBC.notice("The game controller couldn't save its current state.");
    }
  }

  function claimGame(gameId, displayName) {
    var current = readActiveGame();

    if (current && current.active && current.id !== gameId) {
      LBC.notice(
        current.name + " is already running. " +
        "Finish that round before starting another game."
      );
      return false;
    }

    saveActiveGame({
      id: String(gameId),
      name: String(displayName || gameId),
      active: true,
      startedAt: Math.floor(Date.now() / 1000)
    });

    return true;
  }

  function releaseGame(gameId) {
    var current = readActiveGame();

    if (!current || !current.active) return false;
    if (gameId && current.id !== String(gameId)) return false;

    saveActiveGame(null);
    return true;
  }

  function dispatchChat(body, username, isOwner) {
    activeDispatch = "chat";

    // The unified menu is the primary owner interface. It may consume a menu
    // selection or translate it into one existing subsystem command.
    if (isOwner && LBC.controlMenu && typeof LBC.controlMenu.route === "function") {
      var menuResult = LBC.controlMenu.route(body, username);
      if (menuResult && menuResult.handled) {
        if (!menuResult.command) { activeDispatch = ""; return; }
        body = menuResult.command;
      }
    }

    // The Control Center accepts one consistent /ab admin <section> ... syntax
    // and routes the action into the existing subsystem handler exactly once.
    var routedBody = body;
    var adminRoute = String(body || "").trim().match(/^\/ab admin (goal|goals|rewards|menu|announcements|giveaway|queue)\s+(.+)$/i);
    if (isOwner && adminRoute) {
      var section = adminRoute[1].toLowerCase();
      var command = section === "goals" ? "goal" : section;
      routedBody = "/ab " + command + " " + adminRoute[2];
    }

    var args = [routedBody, username, isOwner];

    // Original Guess the Number engine sees the user's literal command.
    safeCall(originals.coreChat, [body, username, isOwner], "Guess the Number");

    // Existing room systems receive the routed command, without new dispatchers.
    safeCall(originals.roomGoal, [routedBody, isOwner], "Room Goal");
    safeCall(originals.rewards, [routedBody, username, isOwner], "Rewards");
    safeCall(originals.tipMenu, [routedBody, isOwner], "Tip Menu");
    safeCall(originals.announcements, [routedBody, isOwner], "Announcements");
    safeCall(originals.customAnnouncement, [routedBody, isOwner, username], "Custom Announcements");
    safeCall(originals.guidance, [routedBody, username], "Player Guidance");

    // Existing games.
    safeCall(originals.higherLower, [routedBody, isOwner, username], "Higher or Lower");
    safeCall(originals.trivia, [routedBody, isOwner, username], "Couple Trivia");

    // Registered modules (including viewer queue) receive the same routed action.
    runModules("onChatMessage", args);
    activeDispatch = "";
  }

  function dispatchCallback(label) {
    activeDispatch = "callback";

    safeCall(originals.coreCallback, [label], "Guess the Number");
    safeCall(originals.announcementCallback, [label], "Announcements");
    safeCall(originals.higherCallback, [label], "Higher or Lower");
    safeCall(originals.triviaCallback, [label], "Couple Trivia");
    safeCall(LBC.processRoomGoalCallback, [label], "Advanced Goal Timer");

    runModules("onCallback", [label]);
    activeDispatch = "";
  }

  function dispatchAppStart() {
    activeDispatch = "appstart";

    safeCall(originals.startAnnouncements, [true], "Announcements Recovery");
    safeCall(originals.resumeHigherLower, [], "Higher or Lower Recovery");
    safeCall(originals.resumeTrivia, [], "Couple Trivia Recovery");

    safeCall(LBC.resumeRoomGoalTimer, [], "Advanced Goal Timer Recovery");
    runModules("onAppStart", []);
    activeDispatch = "";
  }

  /*
   * Preserve the original functions before installing the controller.
   */
  var originals = {
    coreChat: LBC.onChatMessage,
    coreCallback: LBC.onCallback,

    roomGoal: LBC.handleRoomGoalCommand,
    rewards: LBC.handleRewardsCommand,
    tipMenu: LBC.handleTipMenuCommand,
    announcements: LBC.handleAnnouncementCommand,
    customAnnouncement: LBC.handleCustomAnnouncementCommand,
    guidance: LBC.handleGuessNumberGuidance,

    higherLower: LBC.handleHigherLowerCommand,
    trivia: LBC.handleCoupleTriviaCommand,

    announcementCallback: LBC.onAnnouncementsCallback,
    higherCallback: LBC.onHigherLowerCallback,
    triviaCallback: LBC.onCoupleTriviaCallback,

    startAnnouncements: LBC.startAnnouncements,
    resumeHigherLower: LBC.resumeHigherLower,
    resumeTrivia: LBC.resumeCoupleTrivia
  };

  /*
   * The first existing Chat Message call becomes the central dispatcher.
   */
  LBC.onChatMessage = function (body, username, isOwner) {
    dispatchChat(body, username, isOwner);
  };

  /*
   * Existing individual handler calls become compatibility no-ops.
   * The controller has already invoked their original functions.
   */
  [
    "handleRoomGoalCommand",
    "handleRewardsCommand",
    "handleTipMenuCommand",
    "handleAnnouncementCommand",
    "handleCustomAnnouncementCommand",
    "handleGuessNumberGuidance",
    "handleHigherLowerCommand",
    "handleCoupleTriviaCommand"
  ].forEach(function (method) {
    if (typeof LBC[method] !== "function") return;

    LBC[method] = function () {
      if (activeDispatch === "chat") return;
      return originals[method] &&
        originals[method].apply(null, arguments);
    };
  });

  /*
   * Callback routing.
   */
  LBC.onCallback = function (label) {
    dispatchCallback(label);
  };

  [
    "onAnnouncementsCallback",
    "onHigherLowerCallback",
    "onCoupleTriviaCallback"
  ].forEach(function (method) {
    if (typeof LBC[method] !== "function") return;

    LBC[method] = function () {
      if (activeDispatch === "callback") return;
      return originals[method] &&
        originals[method].apply(null, arguments);
    };
  });

  /*
   * App Start routing.
   * The existing first recovery call triggers all recovery systems.
   */
  [
    "startAnnouncements",
    "resumeHigherLower",
    "resumeCoupleTrivia"
  ].forEach(function (method) {
    if (typeof LBC[method] !== "function") return;

    LBC[method] = function () {
      if (activeDispatch === "appstart") return;
      return originals[method] &&
        originals[method].apply(null, arguments);
    };
  });

  LBC.startAnnouncements = function () {
    dispatchAppStart();
  };

  /*
   * Public Game Library API.
   */
  LBC.gameLibrary = {

    version: "1.0",

    register: function (name, gameModule) {
      var id = String(name || "").toLowerCase().replace(/[^a-z0-9_-]/g, "");

      if (!id || !gameModule || typeof gameModule !== "object") {
        return false;
      }

      modules[id] = gameModule;
      return true;
    },

    unregister: function (name) {
      var id = String(name || "").toLowerCase();
      if (!modules[id]) return false;

      delete modules[id];
      return true;
    },

    list: function () {
      return Object.keys(modules);
    },

    claim: claimGame,

    release: releaseGame,

    active: readActiveGame,

    isBusy: function () {
      var game = readActiveGame();
      return !!(game && game.active);
    },

    notice: function (message, options) {
      LBC.notice(message, options);
    },

    reloadPanel: function () {
      LBC.runtime.reloadPanel();
    }
  };

  LBC.notice("🖤 AFTERDARK BROTHERHOOD — Game Library online.");

}());

/*
 * AFTERDARK BROTHERHOOD — AFTER HOURS GAME PACK
 * Version 1.0
 *
 * Games:
 * 1. Codebreaker
 * 2. Word Scramble
 * 3. Dirty Would You Rather
 * 4. Position Impossible
 * 5. Dirty Charades
 *
 * All games use the central LBC Game Library.
 * One active game at a time.
 */

(function () {
  "use strict";

  if (LBC.__afterHoursPackInstalled) return;
  if (!LBC.gameLibrary) {
    LBC.notice("Game Library not found. After Hours Pack was not loaded.");
    return;
  }

  LBC.__afterHoursPackInstalled = true;

  var STATE_KEY = "lbc_afterhours_game_state";
  var ROUND_SECONDS = 75;
  var WYR_SECONDS = 45;
  var CALLBACK_PREFIX = "lbc_afterhours_timeout_";

  var state = null;

  function cleanName(value) {
    return String(value || "someone")
      .replace(/[^a-zA-Z0-9_-]/g, "")
      .slice(0, 25) || "someone";
  }

  function cleanText(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 100);
  }

  function normalize(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function readState() {
    try {
      var raw = LBC.runtime.kvGet(STATE_KEY, "")
      var parsed = raw ? JSON.parse(raw) : null;

      if (!parsed || typeof parsed !== "object") return null;
      if (parsed.active !== true) return null;

      return parsed;
    } catch (err) {
      return null;
    }
  }

  function saveState() {
    LBC.runtime.kvSet(STATE_KEY, JSON.stringify(state))
  }

  function clearState() {
    state = null;
    LBC.runtime.kvSet(STATE_KEY, "")
  }

  function randomItem(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function shuffleWord(word) {
    var letters = String(word).split("");
    var result = String(word);

    for (var attempt = 0; attempt < 10 && result === word; attempt++) {
      for (var i = letters.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = letters[i];
        letters[i] = letters[j];
        letters[j] = temp;
      }
      result = letters.join("");
    }

    return result;
  }

  function legacyGameIsActive() {
    var keys = [
      "lbc_v1_game",
      "lbc_m3_higher_lower",
      "lbc_m3_trivia_state"
    ];

    for (var i = 0; i < keys.length; i++) {
      try {
        var raw = LBC.runtime.kvGet(keys[i], "");
        if (!raw) continue;

        var parsed = JSON.parse(raw);
        if (parsed && parsed.active === true) return true;
      } catch (err) {
        // Ignore malformed legacy state and continue checking.
      }
    }

    return false;
  }

  function isOwnerCommand(body, command) {
    return body.toLowerCase() === command;
  }

  function finish(reason, winner) {
    if (!state || !state.active) return;

    var finished = state;
    state.active = false;
    saveState();

    if (finished.callbackLabel) {
      // Old callbacks become harmless because state is no longer active.
      finished.callbackLabel = "";
    }

    LBC.gameLibrary.release(finished.id);
    if (winner && LBC.rewards) LBC.rewards.award(winner, 5, finished.name + " win", "win:afterhours:" + finished.startedAt + ":" + String(winner).toLowerCase());

    if (finished.id === "would-you-rather") {
      var a = Object.keys(finished.votes || {}).filter(function (name) {
        return finished.votes[name] === "a";
      }).length;

      var b = Object.keys(finished.votes || {}).filter(function (name) {
        return finished.votes[name] === "b";
      }).length;

      var total = a + b;

      LBC.notice(
        "🖤 WOULD YOU RATHER — RESULTS\n" +
        "A: " + a + " vote" + (a === 1 ? "" : "s") + "\n" +
        "B: " + b + " vote" + (b === 1 ? "" : "s") + "\n" +
        "Total votes: " + total + "\n" +
        (a === b ? "A perfect tie. Nobody can make a decision." :
          (a > b ? "Option A takes it." : "Option B takes it."))
      );
    } else if (winner) {
      LBC.notice(
        "🏆 " + finished.name.toUpperCase() + "\n" +
        cleanName(winner) + " got it first. Nicely done. 🖤\n" +
        (finished.answer ? "Answer: " + finished.answer : "")
      );
    } else {
      var message = reason === "timeout"
        ? "⏰ Time's up."
        : "🛑 Round ended.";

      LBC.notice(
        message + " " + finished.name.toUpperCase() + "\n" +
        (finished.answer ? "The answer was: " + finished.answer : "The round is over.")
      );
    }

    clearState();
    LBC.runtime.reloadPanel();
  }

  function schedule(seconds) {
    var label = CALLBACK_PREFIX +
      Date.now() + "_" +
      Math.floor(Math.random() * 1000000);

    state.callbackLabel = label;
    state.endsAt = Math.floor(Date.now() / 1000) + seconds;

    saveState();
    LBC.runtime.createCallback(label, seconds)
  }

  function startGame(id, name, data, seconds) {
    var current = readState();

    if (current && current.active) {
      LBC.notice(
        current.name + " is already running. Finish that round first."
      );
      return false;
    }

    if (legacyGameIsActive()) {
      LBC.notice(
        "Another brotherhood game is already running. Finish it before starting " +
        name + "."
      );
      return false;
    }

    if (!LBC.gameLibrary.claim(id, name)) return false;

    state = {
      id: id,
      name: name,
      active: true,
      callbackLabel: "",
      endsAt: 0,
      startedAt: Math.floor(Date.now() / 1000)
    };

    Object.keys(data || {}).forEach(function (key) {
      state[key] = data[key];
    });

    schedule(seconds || ROUND_SECONDS);
    LBC.runtime.reloadPanel();
    return true;
  }

  function stopIfLegacyGameStarts(body, isOwner) {
    if (!isOwner || !state || !state.active) return false;

    var command = String(body || "").trim().toLowerCase();

    var legacyStarts = [
      "/ab start",
      "/ab higher start",
      "/ab trivia start"
    ];

    if (legacyStarts.indexOf(command) !== -1) {
      finish("interrupted");
      return true;
    }

    return false;
  }

  function startNotice(text) {
    LBC.notice(text);
    LBC.runtime.reloadPanel()
  }

  /*
   * GAME 1 — CODEBREAKER
   */

  var codebreakerPrompts = [
    "Four digits. Crack the combination.",
    "The lock is set. Find the four-digit code.",
    "Four unique digits stand between you and victory."
  ];

  function createCode() {
    var digits = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
    var result = "";

    while (result.length < 4) {
      var index = Math.floor(Math.random() * digits.length);
      result += digits.splice(index, 1)[0];
    }

    return result;
  }

  function codeFeedback(secret, guess) {
    var exact = 0;
    var misplaced = 0;

    for (var i = 0; i < 4; i++) {
      if (guess.charAt(i) === secret.charAt(i)) {
        exact++;
      } else if (secret.indexOf(guess.charAt(i)) !== -1) {
        misplaced++;
      }
    }

    return exact + " correct position · " +
      misplaced + " correct digit, wrong position";
  }

  function handleCodebreaker(body, username, isOwner) {
    var lower = body.toLowerCase();

    if (isOwner && lower === "/ab codebreaker start") {
      var secret = createCode();

      if (startGame("codebreaker", "Codebreaker", {
        secret: secret,
        attempts: {},
        answer: secret
      }, 90)) {
        startNotice(
          "🔐 AFTERDARK BROTHERHOOD — CODEBREAKER\n" +
          randomItem(codebreakerPrompts) + "\n" +
          "Send !code followed by four unique digits.\n" +
          "Example: !code 4821\n" +
          "Each player gets up to six attempts. 90 seconds."
        );
      }
      return true;
    }

    if (isOwner && lower === "/ab codebreaker stop") {
      if (state && state.id === "codebreaker") finish("manual");
      else LBC.notice("Codebreaker isn't running.");
      return true;
    }

    if (lower === "!codehelp") {
      LBC.notice(
        "🔐 CODEBREAKER: Send !code followed by four unique digits. " +
        "You'll receive private feedback. Up to six attempts per player.",
        { toUsername: cleanName(username) }
      );
      return true;
    }

    var match = body.match(/^!code\s+([0-9]{4})$/i);
    if (!match) return false;

    if (!state || state.id !== "codebreaker" || !state.active) {
      LBC.notice("No Codebreaker round is running.", {
        toUsername: cleanName(username)
      });
      return true;
    }

    var guess = match[1];
    if (new Set(guess.split("")).size !== 4) {
      LBC.notice("Use four different digits. No repeats.", {
        toUsername: cleanName(username)
      });
      return true;
    }

    var player = cleanName(username).toLowerCase();
    var attempts = Number(state.attempts[player]) || 0;

    if (attempts >= 6) {
      LBC.notice("You've used all six attempts this round.", {
        toUsername: cleanName(username)
      });
      return true;
    }

    attempts++;
    state.attempts[player] = attempts;
    saveState();

    if (guess === state.secret) {
      finish("winner", username);
      return true;
    }

    LBC.notice(
      "Attempt " + attempts + "/6 — " +
      codeFeedback(state.secret, guess),
      { toUsername: cleanName(username) }
    );

    return true;
  }

  /*
   * GAME 2 — WORD SCRAMBLE
   */

  var wordDeck = [
    { word: "MIDNIGHT", hint: "When the trouble usually starts." },
    { word: "WHISPER", hint: "A very quiet way to communicate." },
    { word: "DANGEROUS", hint: "Proceed at your own risk." },
    { word: "CHEMISTRY", hint: "You either have it or you don't." },
    { word: "TEASE", hint: "A little anticipation never hurt." },
    { word: "AFTERHOURS", hint: "The night doesn't end." },
    { word: "MYSTERY", hint: "Nobody knows what's coming." },
    { word: "TEMPTATION", hint: "The questionable decision." },
    { word: "SECRET", hint: "Keep this between us." },
    { word: "ELECTRIC", hint: "The feeling in the room." },
    { word: "MISCHIEF", hint: "A little trouble." },
    { word: "UNFILTERED", hint: "No holding back." }
  ];

  function handleWordScramble(body, username, isOwner) {
    var lower = body.toLowerCase();

    if (isOwner && lower === "/ab scramble start") {
      var selected = randomItem(wordDeck);

      var started = startGame("word-scramble", "Word Scramble", {
        answer: selected.word,
        scrambled: shuffleWord(selected.word),
        hint: selected.hint
      }, 75);

      if (started) {
        startNotice(
          "🔤 AFTERDARK BROTHERHOOD — WORD SCRAMBLE\n" +
          "Unscramble this word:\n\n" +
          state.scrambled + "\nHint: " + state.hint +
          "\nFirst correct answer wins. Send !word <answer>."
        );
      }

      if (state && state.id === "word-scramble") {
        LBC.notice(
          "🔤 " + state.scrambled +
          "\nHint: " + state.hint +
          "\nFirst correct answer wins. Send !word <answer>."
        );
      }
      return true;
    }

    if (isOwner && lower === "/ab scramble stop") {
      if (state && state.id === "word-scramble") finish("manual");
      else LBC.notice("Word Scramble isn't running.");
      return true;
    }

    if (lower === "!wordhelp") {
      LBC.notice(
        "🔤 WORD SCRAMBLE: Unscramble the displayed word. " +
        "Send !word followed by your answer. First correct answer wins.",
        { toUsername: cleanName(username) }
      );
      return true;
    }

    var match = body.match(/^!word\s+(.+)$/i);
    if (!match) return false;

    if (!state || state.id !== "word-scramble" || !state.active) {
      LBC.notice("No Word Scramble round is running.", {
        toUsername: cleanName(username)
      });
      return true;
    }

    if (normalize(match[1]) === normalize(state.answer)) {
      finish("winner", username);
    } else {
      LBC.notice("Not quite. Keep trying.", {
        toUsername: cleanName(username)
      });
    }

    return true;
  }

  /*
   * GAME 3 — DIRTY WOULD YOU RATHER
   */

  var wyrDeck = [
    ["A slow, teasing kiss that lasts forever", "A sudden kiss that catches you completely off guard"],
    ["A secret admirer who leaves clues", "A confident flirt who says exactly what they want"],
    ["A weekend away with no plans", "A night out that turns into an adventure"],
    ["Being the one who makes the first move", "Having someone else make the first move"],
    ["A long late-night conversation", "A look across the room that says everything"],
    ["A playful challenge", "A dangerously charming compliment"],
    ["A private rooftop date", "A hidden little bar after midnight"],
    ["Someone who makes you laugh", "Someone who makes you blush"],
    ["A slow dance in an empty room", "A spontaneous midnight road trip"],
    ["A little mystery", "A little mischief"],
    ["A partner who is unpredictable", "A partner who always has a plan"],
    ["A flirty text at 2 AM", "A surprise visit at midnight"]
  ];

  function handleWouldYouRather(body, username, isOwner) {
    var lower = body.toLowerCase();

    if (isOwner && lower === "/ab wyr start") {
      var options = randomItem(wyrDeck);

      if (startGame("would-you-rather", "Dirty Would You Rather", {
        optionA: options[0],
        optionB: options[1],
        votes: {}
      }, WYR_SECONDS)) {
        startNotice(
          "😈 DIRTY WOULD YOU RATHER\n" +
          "A: " + options[0] + "\n" +
          "B: " + options[1] + "\n\n" +
          "Vote with !a or !b. One vote per person. " +
          WYR_SECONDS + " seconds."
        );
      }
      return true;
    }

    if (isOwner && lower === "/ab wyr stop") {
      if (state && state.id === "would-you-rather") finish("manual");
      else LBC.notice("Would You Rather isn't running.");
      return true;
    }

    if (lower === "!wyrhelp") {
      LBC.notice(
        "😈 WOULD YOU RATHER: Read options A and B. Vote !a or !b. " +
        "One vote per person. Results appear when time runs out.",
        { toUsername: cleanName(username) }
      );
      return true;
    }

    if (lower !== "!a" && lower !== "!b") return false;

    if (!state || state.id !== "would-you-rather" || !state.active) {
      LBC.notice("No Would You Rather round is running.", {
        toUsername: cleanName(username)
      });
      return true;
    }

    var player = cleanName(username).toLowerCase();

    if (state.votes[player]) {
      LBC.notice("Your vote is already locked in.", {
        toUsername: cleanName(username)
      });
      return true;
    }

    state.votes[player] = lower === "!a" ? "a" : "b";
    saveState();

    LBC.notice("Your vote is locked in. 😈", {
      toUsername: cleanName(username)
    });

    return true;
  }

  /*
   * GAME 4 — POSITION IMPOSSIBLE
   */

  var positionDeck = [
    {
      clue: "The name sounds like a piece of furniture. You're definitely not assembling it.",
      answer: "couch",
      aliases: ["the couch", "couch position"]
    },
    {
      clue: "A classic name involving a piece of furniture and a very questionable angle.",
      answer: "reverse cowgirl",
      aliases: ["reverse cowgirl position"]
    },
    {
      clue: "A position named after a common household exercise.",
      answer: "standing",
      aliases: ["standing position", "standing up"]
    },
    {
      clue: "The name suggests a person who spends a lot of time behind a desk.",
      answer: "desk",
      aliases: ["the desk", "desk position"]
    },
    {
      clue: "A position named after a piece of furniture you might find in a bedroom.",
      answer: "bed",
      aliases: ["the bed", "bed position"]
    },
    {
      clue: "The name sounds like a dance move, but nobody is keeping rhythm.",
      answer: "spooning",
      aliases: ["spoon"]
    },
    {
      clue: "A position that suggests someone is taking a seat.",
      answer: "sitting",
      aliases: ["sitting down", "seated"]
    },
    {
      clue: "A name that sounds like a yoga pose after a very long night.",
      answer: "lotus",
      aliases: ["lotus position"]
    }
  ];

  function handlePosition(body, username, isOwner) {
    var lower = body.toLowerCase();

    if (isOwner && lower === "/ab position start") {
      var selected = randomItem(positionDeck);

      if (startGame("position-impossible", "Position Impossible", {
        clue: selected.clue,
        answer: selected.answer,
        aliases: selected.aliases
      }, 75)) {
        startNotice(
          "🧩 POSITION IMPOSSIBLE\n" +
          selected.clue + "\n\n" +
          "Name the position. Send !position <answer>.\n" +
          "First correct answer wins."
        );
      }
      return true;
    }

    if (isOwner && lower === "/ab position stop") {
      if (state && state.id === "position-impossible") finish("manual");
      else LBC.notice("Position Impossible isn't running.");
      return true;
    }

    if (lower === "!positionhelp") {
      LBC.notice(
        "🧩 POSITION IMPOSSIBLE: Solve the clue and send !position followed by your answer. First correct answer wins.",
        { toUsername: cleanName(username) }
      );
      return true;
    }

    var match = body.match(/^!position\s+(.+)$/i);
    if (!match) return false;

    if (!state || state.id !== "position-impossible" || !state.active) {
      LBC.notice("No Position Impossible round is running.", {
        toUsername: cleanName(username)
      });
      return true;
    }

    var submitted = normalize(match[1]);
    var accepted = [state.answer].concat(state.aliases || []);
    var correct = accepted.some(function (answer) {
      return submitted === normalize(answer);
    });

    if (correct) finish("winner", username);
    else LBC.notice("Not that one. Try again.", {
      toUsername: cleanName(username)
    });

    return true;
  }

  /*
   * GAME 5 — DIRTY CHARADES
   */

  var charadesDeck = [
    { clue: "🍑 🔥 👀", answer: "hot seat", aliases: ["the hot seat"] },
    { clue: "💋 🌙 🕯️", answer: "midnight kiss", aliases: ["a midnight kiss"] },
    { clue: "😈 🎲 🛏️", answer: "bedroom games", aliases: ["bedroom game"] },
    { clue: "🍸 💬 ❤️", answer: "flirting", aliases: ["flirt"] },
    { clue: "🚪 🌙 🤫", answer: "sneaking out", aliases: ["sneak out"] },
    { clue: "🕺 💃 🔥", answer: "dirty dancing", aliases: ["dancing"] },
    { clue: "📱 🌙 💌", answer: "late night text", aliases: ["late night texting"] },
    { clue: "🙈 💋 😳", answer: "stolen kiss", aliases: ["a stolen kiss"] },
    { clue: "🛋️ 🍿 😉", answer: "movie night", aliases: ["movies"] },
    { clue: "🕶️ 🚗 🌃", answer: "night drive", aliases: ["midnight drive"] },
    { clue: "🤫 ❤️ 🔥", answer: "secret crush", aliases: ["a secret crush"] },
    { clue: "🍓 🍫 😘", answer: "sweet talk", aliases: ["sweet talking"] }
  ];

  function handleCharades(body, username, isOwner) {
    var lower = body.toLowerCase();

    if (isOwner && lower === "/ab charades start") {
      var selected = randomItem(charadesDeck);

      if (startGame("dirty-charades", "Dirty Charades", {
        clue: selected.clue,
        answer: selected.answer,
        aliases: selected.aliases
      }, 75)) {
        startNotice(
          "🎭 DIRTY CHARADES\n" +
          selected.clue + "\n\n" +
          "What does it mean? Send !charade <answer>.\n" +
          "First correct answer wins."
        );
      }
      return true;
    }

    if (isOwner && lower === "/ab charades stop") {
      if (state && state.id === "dirty-charades") finish("manual");
      else LBC.notice("Dirty Charades isn't running.");
      return true;
    }

    if (lower === "!charadeshelp") {
      LBC.notice(
        "🎭 DIRTY CHARADES: Decode the emoji clue. Send !charade followed by your answer. First correct answer wins.",
        { toUsername: cleanName(username) }
      );
      return true;
    }

    var match = body.match(/^!charade\s+(.+)$/i);
    if (!match) return false;

    if (!state || state.id !== "dirty-charades" || !state.active) {
      LBC.notice("No Dirty Charades round is running.", {
        toUsername: cleanName(username)
      });
      return true;
    }

    var submitted = normalize(match[1]);
    var accepted = [state.answer].concat(state.aliases || []);
    var correct = accepted.some(function (answer) {
      return submitted === normalize(answer);
    });

    if (correct) finish("winner", username);
    else LBC.notice("Not quite. Decode those emojis again.", {
      toUsername: cleanName(username)
    });

    return true;
  }

  /*
   * CENTRAL ROUTING
   */

  function onChatMessage(body, username, isOwner, gameId) {
    body = String(body || "").trim();

    if (stopIfLegacyGameStarts(body, isOwner)) return;
    if (!isOwner && state && state.active && state.id === gameId && LBC.rewards) {
      var validEntry = (gameId === "codebreaker" && /^!code\s+[0-9]{4}$/i.test(body)) ||
        (gameId === "word-scramble" && /^!word\s+\S[\s\S]*$/i.test(body)) ||
        (gameId === "would-you-rather" && /^!(a|b)$/i.test(body)) ||
        (gameId === "position-impossible" && /^!position\s+\S[\s\S]*$/i.test(body)) ||
        (gameId === "dirty-charades" && /^!charade\s+\S[\s\S]*$/i.test(body));
      if (validEntry) LBC.rewards.award(username, 1, gameId + " participation", "play:afterhours:" + state.startedAt + ":" + gameId + ":" + String(username).toLowerCase());
    }

    if (gameId === "codebreaker") {
      handleCodebreaker(body, username, isOwner);
    } else if (gameId === "word-scramble") {
      handleWordScramble(body, username, isOwner);
    } else if (gameId === "would-you-rather") {
      handleWouldYouRather(body, username, isOwner);
    } else if (gameId === "position-impossible") {
      handlePosition(body, username, isOwner);
    } else if (gameId === "dirty-charades") {
      handleCharades(body, username, isOwner);
    }
  }

  function onCallback(label) {
    if (!state || !state.active) return;
    if (String(label || "") !== state.callbackLabel) return;

    finish("timeout");
  }

  var appStartRecovered = false;

  function onAppStart() {
    if (appStartRecovered) return;
    appStartRecovered = true;

    state = readState();
    if (!state || !state.active) return;

    var remaining = state.endsAt -
      Math.floor(Date.now() / 1000);

    if (remaining <= 0) {
      finish("timeout");
      return;
    }

    if (!LBC.gameLibrary.claim(state.id, state.name)) {
      finish("interrupted");
      return;
    }

    schedule(remaining);

    LBC.notice(
      "🖤 " + state.name + " resumed after the brotherhood restart."
    );
  }

  /*
   * Register each game with the shared controller.
   * New games can be added using this same pattern.
   */

  LBC.gameLibrary.register("codebreaker", {
    onChatMessage: function (body, username, isOwner) {
      onChatMessage(body, username, isOwner, "codebreaker");
    },
    onCallback: onCallback,
    onAppStart: onAppStart
  });

  LBC.gameLibrary.register("word-scramble", {
    onChatMessage: function (body, username, isOwner) {
      onChatMessage(body, username, isOwner, "word-scramble");
    },
    onCallback: onCallback,
    onAppStart: onAppStart
  });

  LBC.gameLibrary.register("would-you-rather", {
    onChatMessage: function (body, username, isOwner) {
      onChatMessage(body, username, isOwner, "would-you-rather");
    },
    onCallback: onCallback,
    onAppStart: onAppStart
  });

  LBC.gameLibrary.register("position-impossible", {
    onChatMessage: function (body, username, isOwner) {
      onChatMessage(body, username, isOwner, "position-impossible");
    },
    onCallback: onCallback,
    onAppStart: onAppStart
  });

  LBC.gameLibrary.register("dirty-charades", {
    onChatMessage: function (body, username, isOwner) {
      onChatMessage(body, username, isOwner, "dirty-charades");
    },
    onCallback: onCallback,
    onAppStart: onAppStart
  });

  LBC.afterHours = {
    version: "1.0",

    games: function () {
      return [
        "Codebreaker",
        "Word Scramble",
        "Dirty Would You Rather",
        "Position Impossible",
        "Dirty Charades"
      ];
    },

    status: function () {
      return readState();
    }
  };

  LBC.notice(
    "🖤 AFTER HOURS GAME PACK loaded. Five games registered with the Game Library."
  );

}());


/* AFTERDARK BROTHERHOOD — MEMBER PROFILES + ADMIN CONTROL CENTER */
(function () {
  "use strict";

  var INDEX_KEY = "lbc_ab_member_index";
  var PROFILE_PREFIX = "lbc_ab_member_";
  var MAX_INDEX = 250;

  function cleanName(value) {
    return String(value || "").replace(/^@/, "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 25);
  }

  function readJson(key, fallback) {
    try {
      var raw = LBC.runtime.kvGet(key, "");
      return raw ? JSON.parse(raw) : fallback;
    } catch (err) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      return LBC.runtime.kvSet(key, JSON.stringify(value));
    } catch (err) {
      return false;
    }
  }

  function profileKey(username) {
    return PROFILE_PREFIX + cleanName(username).toLowerCase();
  }

  function readProfile(username) {
    var name = cleanName(username);
    if (!name) return null;
    var stored = readJson(profileKey(name), {});
    return {
      username: name,
      gamesPlayed: Math.max(0, Number(stored.gamesPlayed) || 0),
      wins: Math.max(0, Number(stored.wins) || 0),
      pointsEarned: Math.max(0, Number(stored.pointsEarned) || 0),
      firstTrackedAt: Math.max(0, Number(stored.firstTrackedAt) || 0),
      lastGameAt: Math.max(0, Number(stored.lastGameAt) || 0)
    };
  }

  function rememberMember(username) {
    var name = cleanName(username);
    if (!name) return;
    var index = readJson(INDEX_KEY, []);
    if (!Array.isArray(index)) index = [];
    var lower = name.toLowerCase();
    if (!index.some(function (item) { return String(item).toLowerCase() === lower; })) {
      index.push(name);
      if (index.length > MAX_INDEX) index = index.slice(index.length - MAX_INDEX);
      writeJson(INDEX_KEY, index);
    }
  }

  function trackAward(username, amount, reason) {
    var name = cleanName(username);
    if (!name) return;
    var p = readProfile(name);
    if (!p) return;
    var points = Math.max(0, Math.floor(Number(amount) || 0));
    var why = String(reason || "");
    p.pointsEarned += points;
    if (/participation/i.test(why)) {
      p.gamesPlayed += 1;
      p.lastGameAt = Date.now();
    } else if (/\bwin\b/i.test(why)) {
      p.wins += 1;
      p.lastGameAt = Date.now();
    }
    if (!p.firstTrackedAt) p.firstTrackedAt = Date.now();
    writeJson(profileKey(name), p);
    rememberMember(name);
  }

  // Observe successful loyalty awards without changing the existing points engine.
  if (LBC.rewards && typeof LBC.rewards.award === "function" && !LBC.rewards.award.__memberTracking) {
    var originalAward = LBC.rewards.award;
    var trackedAward = function (username, amount, reason, id) {
      var awarded = originalAward.apply(null, arguments);
      if (awarded) trackAward(username, amount, reason);
      return awarded;
    };
    trackedAward.__memberTracking = true;
    LBC.rewards.award = trackedAward;
  }

  function showProfile(requestedName, viewerName) {
    var target = cleanName(requestedName || viewerName);
    if (!target) return;
    var p = readProfile(target);
    var balance = LBC.rewards && typeof LBC.rewards.balance === "function" ?
      LBC.rewards.balance(target) : 0;
    if (!p || (!p.firstTrackedAt && !balance)) {
      LBC.notice("🖤 " + target + " has no tracked Brotherhood activity yet.", { toUsername: cleanName(viewerName) });
      return;
    }
    LBC.notice(
      "🖤 BROTHERHOOD PROFILE — " + p.username + "\n" +
      "Points: " + balance + " · Earned: " + p.pointsEarned + "\n" +
      "Games entered: " + p.gamesPlayed + " · Wins: " + p.wins + "\n" +
      "Win rate: " + (p.gamesPlayed ? Math.floor((p.wins / p.gamesPlayed) * 100) + "%" : "—") +
      (LBC.vip ? "\nVIP: " + LBC.vip.summary(target).tier + " · Room tips: $" + LBC.vip.summary(target).usd.toFixed(2) : ""),
      { toUsername: cleanName(viewerName) }
    );
  }

  function showLeaderboard(kind) {
    var index = readJson(INDEX_KEY, []);
    if (!Array.isArray(index)) index = [];
    var rows = index.map(function (name) {
      var p = readProfile(name);
      if (!p) return null;
      var points = LBC.rewards && typeof LBC.rewards.balance === "function" ?
        LBC.rewards.balance(name) : 0;
      return { name: p.username, games: p.gamesPlayed, wins: p.wins, points: points };
    }).filter(Boolean);
    var mode = String(kind || "wins").toLowerCase();
    var label = "WINS";
    if (mode === "games" || mode === "participation") {
      mode = "games";
      label = "GAME PARTICIPATION";
      rows.sort(function (a, b) { return b.games - a.games || b.wins - a.wins; });
    } else if (mode === "points") {
      label = "LOYALTY POINTS";
      rows.sort(function (a, b) { return b.points - a.points || b.wins - a.wins; });
    } else {
      mode = "wins";
      rows.sort(function (a, b) { return b.wins - a.wins || b.games - a.games; });
    }
    rows = rows.filter(function (row) {
      return mode === "points" ? row.points > 0 : mode === "games" ? row.games > 0 : row.wins > 0;
    }).slice(0, 5);
    LBC.notice("🏆 AFTERDARK BROTHERHOOD — " + label + "\n" +
      (rows.length ? rows.map(function (row, i) {
        var score = mode === "points" ? row.points + " pts" : mode === "games" ? row.games + " games" : row.wins + " wins";
        return (i + 1) + ". " + row.name + " — " + score;
      }).join("\n") : "No tracked records yet."));
  }

  function adminStatus() {
    var game = LBC.gameLibrary && typeof LBC.gameLibrary.active === "function" ? LBC.gameLibrary.active() : null;
    var goal = readJson("lbc_m2_room_goal", {});
    var tipStats = readJson("lbc_m2_tip_stats", {});
    var catalog = readJson("lbc_ab_rewards_catalog", []);
    var requests = readJson("lbc_ab_rewards_requests", []);
    var menu = readJson("lbc_m2_tip_menu", []);
    var announcements = readJson("lbc_m2_announcements", {});
    var goalTarget = Math.max(0, Number(goal.target) || 0);
    var goalProgress = Math.max(0, (Number(tipStats.totalTokens) || 0) - (Number(goal.startTotal) || 0));
    var goalTimer = Number(goal.durationMinutes) > 0 ?
      (goal.paused ? " · timer paused" : goal.deadlineAt ? " · " + Math.max(0, Math.ceil((Number(goal.deadlineAt) - Date.now()) / 60000)) + "m left" : "") : "";
    var goalLine = goalTarget ? (goal.paused ? "PAUSED " : goal.active ? "LIVE " : goal.completed ? "REACHED " : "OFF ") +
      String(goal.title || "Room Goal") + " (" + Math.min(goalProgress, goalTarget) + "/" + goalTarget + ")" + goalTimer +
      (Array.isArray(goal.queue) && goal.queue.length ? " · " + goal.queue.length + " stages queued" : "") : "not configured";
    var pending = Array.isArray(requests) ? requests.filter(function (r) { return r && r.status === "pending"; }).length : 0;
    var activeName = game && game.active ? String(game.name || game.id || "Unknown game") : "none";
    var giveaway = readJson("lbc_ab_giveaway_current", null);
    var queue = readJson("lbc_ab_viewer_queue_v1", {});
    var queueLine = (queue.paused ? "PAUSED · " : "OPEN · ") +
      (queue.current && queue.current.user ? "active " + queue.current.user + " · " : "") +
      (Array.isArray(queue.waiting) ? queue.waiting.length : 0) + "/" + (Number(queue.limit) || 50) + " waiting";
    var vip = LBC.vip ? LBC.vip.adminStatus() : { members: 0, totalUsd: 0 };
    var supportTokens = Math.max(0, Number(tipStats.totalTokens) || 0);
    LBC.notice(
      "🖤 AFTERDARK BROTHERHOOD — STREAM CONTROL CENTER\n" +
      "LIVE: Game " + activeName + " · Room support " + supportTokens + " tokens\n" +
      "GOAL: " + goalLine + "\n" +
      "QUEUE: " + queueLine + "\n" +
      "GIVEAWAY: " + (giveaway && giveaway.status === "open" ? "OPEN · " + Object.keys(giveaway.entries || {}).length + " entered" : giveaway && giveaway.status === "closed" ? "CLOSED · awaiting draw" : "OFF") + "\n" +
      "ENGAGEMENT: Announcements " + (announcements.enabled === true ? "ON" : "OFF") +
      " · Tip menu " + (Array.isArray(menu) ? menu.length : 0) + " · Rewards " + (Array.isArray(catalog) ? catalog.length : 0) + " (" + pending + " pending)\n" +
      "COMMUNITY: " + vip.members + " permanent VIP members · " + (LBC.gameLibrary ? LBC.gameLibrary.list().length : 0) + " game modules\n" +
      "ACTIONS: /ab admin goal pause|resume · /ab admin queue pause|resume · /ab admin announcements on|off\n" +
      "MORE: /ab admin games|goal|rewards|menu|giveaway|queue|vip · /ab admin help"
    );
  }

  function adminDetail(section) {
    var value = String(section || "").toLowerCase();
    if (value === "games") {
      var active = LBC.gameLibrary && LBC.gameLibrary.active ? LBC.gameLibrary.active() : null;
      var names = LBC.gameLibrary && LBC.gameLibrary.list ? LBC.gameLibrary.list() : [];
      LBC.notice("🎮 GAME CONTROL\nActive: " + (active && active.active ? active.name : "none") +
        "\nRegistered: " + (names.length ? names.join(", ") : "none") +
        "\nUse each game's /ab <game> start/stop command.");
      return;
    }
    if (value === "goal" || value === "goals") {
      var g = readJson("lbc_m2_room_goal", {});
      var stats = readJson("lbc_m2_tip_stats", {});
      var target = Math.max(0, Number(g.target) || 0);
      var progress = Math.max(0, (Number(stats.totalTokens) || 0) - (Number(g.startTotal) || 0));
      var timerText = Number(g.durationMinutes) > 0 ?
        (g.paused ? " · timer paused" : g.deadlineAt ? " · " + Math.max(0, Math.ceil((Number(g.deadlineAt) - Date.now()) / 60000)) + "m left" : "") : " · untimed";
      LBC.notice("🏁 GOAL CONTROL\\n" + (target ? String(g.title || "Room Goal") + " · " +
        (g.paused ? "PAUSED" : g.active ? "LIVE" : g.completed ? "REACHED" : "OFF") +
        " · " + Math.min(progress, target) + "/" + target + timerText + " · queue " +
        (Array.isArray(g.queue) ? g.queue.length : 0) + " · carryover " + (g.carryover === false ? "OFF" : "ON") +
        " · repeat " + (g.repeat === true ? "ON" : "OFF") : "No goal configured.") +
        "\\nCommands: /ab admin goal timed 1000 30 Title · queue timed 2000 20 Next · milestones · pause · resume · extend · carryover on|off · repeat on|off · reset · off.");
      return;
    }
    if (value === "rewards") {
      var rewards = readJson("lbc_ab_rewards_catalog", []);
      var reqs = readJson("lbc_ab_rewards_requests", []);
      var waiting = Array.isArray(reqs) ? reqs.filter(function (r) { return r && r.status === "pending"; }) : [];
      LBC.notice("🎁 REWARD CONTROL\nCatalogue: " + (Array.isArray(rewards) ? rewards.length : 0) +
        " / 12 · Pending: " + waiting.length +
        "\nCommands: /ab rewards add · remove · list · pending · approve · deny.");
      return;
    }
    if (value === "menu") {
      var items = readJson("lbc_m2_tip_menu", []);
      LBC.notice("📋 TIP MENU CONTROL\nConfigured items: " + (Array.isArray(items) ? items.length : 0) +
        "\nCommands: /ab menu add · remove · clear · show.");
      return;
    }
    if (value === "giveaway") {
      var giveaway = readJson("lbc_ab_giveaway_current", null);
      var giveawayStatus = giveaway && giveaway.status === "open" ?
        "OPEN · " + giveaway.prize + " · " + Object.keys(giveaway.entries || {}).length + " entries" :
        giveaway && giveaway.status === "closed" ? "CLOSED · " + giveaway.prize + " · awaiting draw" :
        "No active giveaway.";
      LBC.notice("🎟️ GIVEAWAY CONTROL\n" + giveawayStatus +
        "\nCommands: /ab giveaway start Prize · end · draw · cancel · history.");
      return;
    }
    if (value === "queue") {
      var queue = readJson("lbc_ab_viewer_queue_v1", {});
      LBC.notice("🎤 VIEWER QUEUE CONTROL\\n" +
        "Status: " + (queue.paused ? "PAUSED" : "OPEN") +
        "\\nActive: " + (queue.current && queue.current.user ? queue.current.user : "none") +
        "\\nWaiting: " + (Array.isArray(queue.waiting) ? queue.waiting.length : 0) + " / " + (Number(queue.limit) || 50) +
        "\\nBooked slots: " + (Array.isArray(queue.slots) ? queue.slots.filter(function (x) { return x && x.user; }).length : 0) +
        "\\nCommands: /ab queue next · done · skip · pause · resume · clear · limit · slot add/list/remove.");
      return;
    }
    if (value === "vip") {
      var vipStats = LBC.vip ? LBC.vip.adminStatus() : { members: 0, totalUsd: 0 };
      LBC.notice("🖤 VIP STATUS\\nMembers: " + vipStats.members + "\\nCumulative room tips: $" + vipStats.totalUsd.toFixed(2) + "\\nThresholds are permanent and count only direct room tips.");
      return;
    }
    if (value === "announcements") {
      var state = readJson("lbc_m2_announcements", {});
      LBC.notice("📣 ANNOUNCEMENTS\nRotating notices: " + (state.enabled === true ? "ON" : "OFF") +
        "\nCommands: /ab announcements on · off · status.");
      return;
    }
    adminHelp();
  }

  function adminHelp() {
    LBC.notice(
      "🖤 AFTERDARK BROTHERHOOD — ADMIN CONTROL MAP\n" +
      "/ab admin — dashboard · /ab admin status — refresh dashboard\n" +
      "/ab admin games|goal|rewards|menu|announcements|giveaway|queue|vip — subsystem status\n" +
      "/ab admin panel — refresh the native room panel · /ab admin members — member summary\n" +
      "QUICK CONTROL: /ab admin goal pause|resume|status · /ab admin queue next|pause|resume\n" +
      "GOALS: set 1000 Title · timed 1000 30 Title · queue 1500 Next · queue timed 2000 20 Final\\n" +
      "GOAL TOOLS: milestones 10 25 50 75 100 · pause · resume · extend 250 · carryover on|off · repeat on|off · time · reset · off · queue list|clear\\n" +
      "REWARDS: /ab admin rewards add 100 Reward · pending · approve 1 · deny 1\n" +
      "TIP MENU: /ab admin menu add 50 Request · remove 1 · clear · show\n" +
      "ANNOUNCEMENTS: /ab admin announcements on|off\n" +
      "GIVEAWAY: /ab admin giveaway start Prize · end · draw · cancel · history (free entry)\n" +
      "VIEWER QUEUE: /ab admin queue next|done|skip|pause|resume|clear · !joinqueue · !slots · !book 1\n" +
      "GAMES: use /ab <game> start|stop; Guess the Number uses /ab start|stop."
    );
  }

  function onChatMessage(body, username, isOwner) {
    var raw = String(body || "").trim();
    var lower = raw.toLowerCase();
    var match;
    if ((match = lower.match(/^!profile(?:\s+@?([a-z0-9_-]{1,25}))?$/i))) {
      showProfile(match[1] || username, username);
      return;
    }
    if ((match = lower.match(/^!(?:leaderboard|top)(?:\s+(wins|games|participation|points))?$/i))) {
      showLeaderboard(match[1] || "wins");
      return;
    }
    if (!isOwner || lower.indexOf("/ab admin") !== 0) return;
    if (lower === "/ab admin" || lower === "/ab admin status") {
      adminStatus();
      return;
    }
    if (lower === "/ab admin help") {
      adminHelp();
      return;
    }
    if (lower === "/ab admin panel") {
      var refreshed = LBC.runtime.reloadPanel();
      LBC.notice(refreshed === false ? "The native room panel could not be refreshed by this runtime." : "Native room panel refresh requested.");
      return;
    }
    if (lower === "/ab admin members") {
      var index = readJson(INDEX_KEY, []);
      LBC.notice("👥 MEMBER TRACKING\nTracked members: " + (Array.isArray(index) ? index.length : 0) +
        " / " + MAX_INDEX + "\nViewer commands: !profile · !profile username · !leaderboard wins|games|points.");
      return;
    }
    if ((match = lower.match(/^\/ab admin (games|goal|goals|rewards|menu|announcements|giveaway|queue|vip)$/))) {
      adminDetail(match[1]);
      return;
    }
    adminHelp();
  }

  LBC.controlCenter = {
    version: "1.0",
    status: adminStatus,
    detail: adminDetail,
    help: adminHelp,
    refreshPanel: function () { return LBC.runtime.reloadPanel(); }
  };

  LBC.members = {
    version: "1.0",
    profile: readProfile,
    leaderboard: showLeaderboard
  };

  LBC.gameLibrary.register("member-admin-center", {
    onChatMessage: onChatMessage
  });
}());



/*
 * AFTERDARK BROTHERHOOD — UNIFIED OWNER CONTROL MENU
 * One entry point, numbered navigation, and short guided inputs.
 * All actions are translated into existing subsystem commands; this module
 * owns no game, goal, reward, queue, giveaway, or announcement business state.
 */
(function () {
  "use strict";
  var STATE_KEY = "lbc_ab_control_menu_state_v1";
  var MENU_TTL = 10 * 60 * 1000;

  function readState() {
    try {
      var raw = LBC.runtime.kvGet(STATE_KEY, "");
      var state = raw ? JSON.parse(raw) : null;
      if (!state || typeof state !== "object" || Number(state.expiresAt) < Date.now()) return { section: "home", wizard: "", expiresAt: 0 };
      return state;
    } catch (err) {
      return { section: "home", wizard: "", expiresAt: 0 };
    }
  }
  function saveState(state) {
    state.expiresAt = Date.now() + MENU_TTL;
    LBC.runtime.kvSet(STATE_KEY, JSON.stringify(state));
  }
  function readJson(key, fallback) {
    try { var raw = LBC.runtime.kvGet(key, ""); return raw ? JSON.parse(raw) : fallback; }
    catch (err) { return fallback; }
  }
  function clearWizard(state) {
    state.wizard = "";
    saveState(state);
  }
  function say(message) { LBC.notice(message); }
  function home(state) {
    state.section = "home";
    state.wizard = "";
    saveState(state);
    say("🖤 AFTERDARK BROTHERHOOD — CONTROL CENTER\n" +
      "Choose a section by sending /ab followed by its number.\n" +
      "1. Games\n2. Goals\n3. Tip Menu\n4. Rewards\n5. Brotherhood / VIP\n" +
      "6. Giveaways\n7. Viewer Queue\n8. Announcements\n9. Live Dashboard\n10. Settings\n\n" +
      "Use /ab anytime to return here. /ab back returns one level.");
  }
  function section(state, name) {
    state.section = name;
    state.wizard = "";
    saveState(state);
    if (name === "games") {
      if (LBC.controlCenter) LBC.controlCenter.detail("games");
      say("GAME SHORTCUTS\nGuess the Number: /ab start or /ab stop\nOther registered games use their own /ab <game> start|stop command.\nSend /ab 0 to return.");
    } else if (name === "goals") {
      if (LBC.controlCenter) LBC.controlCenter.detail("goal");
      say("GOALS — choose an action\n1. View goal status\n2. Create an untimed goal\n3. Create a timed goal\n4. Queue a goal stage\n5. Pause / resume current goal\n6. View goal queue\n7. Return to main menu");
    } else if (name === "menu") {
      if (LBC.controlCenter) LBC.controlCenter.detail("menu");
      say("TIP MENU — choose an action\n1. Show current menu\n2. Add a menu item\n3. Remove an item by number\n4. Return to main menu");
    } else if (name === "rewards") {
      if (LBC.controlCenter) LBC.controlCenter.detail("rewards");
      say("REWARDS — choose an action\n1. View reward catalogue\n2. View pending requests\n3. Add a reward\n4. Approve a request by number\n5. Deny a request by number\n6. Return to main menu");
    } else if (name === "brotherhood") {
      if (LBC.controlCenter) LBC.controlCenter.detail("vip");
      say("BROTHERHOOD\nPermanent VIP is tracked from direct room tips. Member profiles and leaderboards remain available to viewers with !profile and !leaderboard.\nSend /ab 0 to return.");
    } else if (name === "giveaway") {
      if (LBC.controlCenter) LBC.controlCenter.detail("giveaway");
      say("GIVEAWAYS — choose an action\n1. View giveaway status\n2. Start a free-entry giveaway\n3. Close entries\n4. Draw a winner\n5. Cancel giveaway\n6. Return to main menu");
    } else if (name === "queue") {
      if (LBC.controlCenter) LBC.controlCenter.detail("queue");
      say("VIEWER QUEUE — choose an action\n1. View queue status\n2. Call next viewer\n3. Mark current turn done\n4. Skip current viewer\n5. Pause / resume queue\n6. View scheduled slots\n7. Return to main menu");
    } else if (name === "announcements") {
      var a = readJson("lbc_m2_announcements", {});
      say("ANNOUNCEMENTS\nCurrent status: " + (a.enabled === true ? "ON" : "OFF") + "\n1. Toggle announcements\n2. Return to main menu");
    } else if (name === "dashboard") {
      if (LBC.controlCenter) LBC.controlCenter.status();
      say("Live room overview refreshed. Send /ab 0 to return.");
    } else if (name === "settings") {
      say("ROOM SETTINGS\n1. Refresh native room panel\n2. Return to main menu\nThe native Chaturbate panel is a status display, not an interactive button menu.");
    }
  }
  function prompt(state, wizard, message) {
    state.wizard = wizard;
    saveState(state);
    say(message + "\nWhen ready, send: /ab value <your answer>\nSend /ab cancel to stop.");
  }
  function action(state, number) {
    var s = state.section;
    if (number === 0) { home(state); return { handled: true }; }
    if (s === "home") {
      var sections = {1:"games",2:"goals",3:"menu",4:"rewards",5:"brotherhood",6:"giveaway",7:"queue",8:"announcements",9:"dashboard",10:"settings"};
      if (sections[number]) { section(state, sections[number]); return { handled: true }; }
    }
    if (s === "goals") {
      if (number === 1) return {handled:true,command:"/ab goal status"};
      if (number === 2) { prompt(state,"goal_set","Create goal. Enter target and title, for example: 1000 Main Goal."); return {handled:true}; }
      if (number === 3) { prompt(state,"goal_timed","Create timed goal. Enter target, minutes, and title, for example: 1000 30 Main Goal."); return {handled:true}; }
      if (number === 4) { prompt(state,"goal_queue","Queue a goal. Enter target and title, for example: 1500 Next Stage."); return {handled:true}; }
      if (number === 5) {
        var g=readJson("lbc_m2_room_goal",{});
        if (!g.active) { say("There is no active goal. Choose 2 to create an untimed goal or 3 to create a timed goal."); return {handled:true}; }
        return {handled:true,command:g.paused ? "/ab goal resume" : "/ab goal pause"};
      }
      if (number === 6) return {handled:true,command:"/ab goal queue list"};
      if (number === 7) { home(state); return {handled:true}; }
    }
    if (s === "menu") {
      if (number === 1) return {handled:true,command:"/ab menu show"};
      if (number === 2) { prompt(state,"menu_add","Add a tip-menu item. Enter token price and item name, for example: 50 Song request."); return {handled:true}; }
      if (number === 3) { prompt(state,"menu_remove","Remove an item. Enter its item number."); return {handled:true}; }
      if (number === 4) { home(state); return {handled:true}; }
    }
    if (s === "rewards") {
      if (number === 1) return {handled:true,command:"/ab rewards list"};
      if (number === 2) return {handled:true,command:"/ab rewards pending"};
      if (number === 3) { prompt(state,"reward_add","Add a loyalty reward. Enter point cost and reward name, for example: 100 Choose a song."); return {handled:true}; }
      if (number === 4) { prompt(state,"reward_approve","Approve a pending request. Enter its request number."); return {handled:true}; }
      if (number === 5) { prompt(state,"reward_deny","Deny a pending request. Enter its request number."); return {handled:true}; }
      if (number === 6) { home(state); return {handled:true}; }
    }
    if (s === "giveaway") {
      if (number === 1) return {handled:true,command:"/ab giveaway status"};
      if (number === 2) { prompt(state,"giveaway_start","Start a free-entry giveaway. Enter the prize description."); return {handled:true}; }
      if (number === 3) return {handled:true,command:"/ab giveaway end"};
      if (number === 4) return {handled:true,command:"/ab giveaway draw"};
      if (number === 5) return {handled:true,command:"/ab giveaway cancel"};
      if (number === 6) { home(state); return {handled:true}; }
    }
    if (s === "queue") {
      if (number === 1) return {handled:true,command:"/ab queue status"};
      if (number === 2) return {handled:true,command:"/ab queue next"};
      if (number === 3) return {handled:true,command:"/ab queue done"};
      if (number === 4) return {handled:true,command:"/ab queue skip"};
      if (number === 5) {
        var q=readJson("lbc_ab_viewer_queue_v1",{});
        return {handled:true,command:q.paused ? "/ab queue resume" : "/ab queue pause"};
      }
      if (number === 6) return {handled:true,command:"/ab queue slot list"};
      if (number === 7) { home(state); return {handled:true}; }
    }
    if (s === "announcements") {
      if (number === 1) {
        var a=readJson("lbc_m2_announcements",{});
        return {handled:true,command:"/ab announcements " + (a.enabled === true ? "off" : "on")};
      }
      if (number === 2) { home(state); return {handled:true}; }
    }
    if (s === "settings") {
      if (number === 1) return {handled:true,command:"/ab admin panel"};
      if (number === 2) { home(state); return {handled:true}; }
    }
    say("That selection isn't available here. Choose one of the displayed numbers, or send /ab 0 to return.");
    return {handled:true};
  }
  function value(state, raw) {
    var v=String(raw||"").replace(/^\/ab value\s*/i,"").trim(), cmd="";
    if (!v) { say("Please include a value after /ab value."); return {handled:true}; }
    if (state.wizard === "goal_set" && /^[1-9][0-9]{0,6}\s+.{1,48}$/.test(v)) cmd="/ab goal set " + v;
    else if (state.wizard === "goal_timed" && /^[1-9][0-9]{0,6}\s+[1-9][0-9]{0,3}\s+.{1,48}$/.test(v)) cmd="/ab goal timed " + v;
    else if (state.wizard === "goal_queue" && /^[1-9][0-9]{0,6}\s+.{1,48}$/.test(v)) cmd="/ab goal queue " + v;
    else if (state.wizard === "menu_add" && /^[1-9][0-9]{0,5}\s+.{1,60}$/.test(v)) cmd="/ab menu add " + v;
    else if (state.wizard === "menu_remove" && /^[1-9][0-9]{0,2}$/.test(v)) cmd="/ab menu remove " + v;
    else if (state.wizard === "reward_add" && /^[1-9][0-9]{0,5}\s+.{1,60}$/.test(v)) cmd="/ab rewards add " + v;
    else if (state.wizard === "reward_approve" && /^[1-9][0-9]{0,4}$/.test(v)) cmd="/ab rewards approve " + v;
    else if (state.wizard === "reward_deny" && /^[1-9][0-9]{0,4}$/.test(v)) cmd="/ab rewards deny " + v;
    else if (state.wizard === "giveaway_start" && v.length <= 80) cmd="/ab giveaway start " + v;
    else { say("That doesn't match the requested format. Please try /ab value again, or /ab cancel."); return {handled:true}; }
    state.wizard="";
    saveState(state);
    return {handled:true,command:cmd};
  }
  function route(body, username) {
    var raw=String(body||"").trim(), lower=raw.toLowerCase(), state=readState(), m;
    if (lower === "/ab" || lower === "/ab admin" || lower === "/ab admin status") { home(state); return {handled:true}; }
    if (lower === "/ab home" || lower === "/ab back" || lower === "/ab 0") { home(state); return {handled:true}; }
    if (lower === "/ab cancel") {
      state.wizard=""; saveState(state); say("Control Center action cancelled."); return {handled:true};
    }
    if ((m=raw.match(/^\/ab value\s*(.*)$/i))) {
      if (!state.wizard) { say("No guided action is waiting. Open /ab and choose an action first."); return {handled:true}; }
      return value(state, raw);
    }
    if ((m=lower.match(/^\/ab\s+(10|[1-9])$/))) return action(state,Number(m[1]));
    return null;
  }
  LBC.controlMenu = { version:"1.0", route:route, open:function(){home(readState());} };
}());

/* AFTERDARK BROTHERHOOD — FREE-ENTRY GIVEAWAY ENGINE */
(function () {
  "use strict";

  var STATE_KEY = "lbc_ab_giveaway_current";
  var HISTORY_KEY = "lbc_ab_giveaway_history";
  var MAX_ENTRIES = 500;

  function cleanName(value) {
    return String(value || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 25);
  }

  function cleanPrize(value) {
    return String(value || "").replace(/[\r\n\t]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  }

  function read(key, fallback) {
    try {
      var raw = LBC.runtime.kvGet(key, "");
      return raw ? JSON.parse(raw) : fallback;
    } catch (err) {
      return fallback;
    }
  }

  function save(state) {
    try {
      LBC.runtime.kvSet(STATE_KEY, JSON.stringify(state));
      LBC.runtime.reloadPanel();
      return true;
    } catch (err) {
      return false;
    }
  }

  function current() {
    var state = read(STATE_KEY, null);
    if (!state || typeof state !== "object") return null;
    if (!state.entries || typeof state.entries !== "object") state.entries = {};
    return state;
  }

  function entryCount(state) {
    return Object.keys(state && state.entries ? state.entries : {}).length;
  }

  function showStatus(username) {
    var state = current();
    if (!state || (state.status !== "open" && state.status !== "closed")) {
      LBC.notice("🎟️ No free giveaway is running right now.", { toUsername: cleanName(username) });
      return;
    }
    LBC.notice(
      "🎟️ AFTERDARK BROTHERHOOD — FREE GIVEAWAY\n" +
      "Prize: " + state.prize + "\n" +
      "Status: " + state.status.toUpperCase() + "\n" +
      "Entries: " + entryCount(state) + " / " + MAX_ENTRIES + "\n" +
      (state.status === "open" ? "Type !enter to join. Free entry; no tip or purchase required." : "Entries are closed. The broadcaster will draw the winner."),
      username ? { toUsername: cleanName(username) } : {}
    );
  }

  function enter(username) {
    var name = cleanName(username);
    var state = current();
    if (!name) return;
    if (!state || state.status !== "open") {
      LBC.notice("There isn't an open giveaway to enter. Type !giveaway for status.", { toUsername: name });
      return;
    }
    var key = name.toLowerCase();
    if (state.entries[key]) {
      LBC.notice("You're already entered in this giveaway.", { toUsername: name });
      return;
    }
    if (entryCount(state) >= MAX_ENTRIES) {
      LBC.notice("This giveaway has reached its entry limit.", { toUsername: name });
      return;
    }
    state.entries[key] = name;
    if (!save(state)) {
      delete state.entries[key];
      LBC.notice("Your entry couldn't be saved. Please try again.", { toUsername: name });
      return;
    }
    LBC.notice("You're entered for " + state.prize + ". Good luck. 🖤", { toUsername: name });
  }

  function history() {
    var list = read(HISTORY_KEY, []);
    if (!Array.isArray(list) || !list.length) {
      LBC.notice("No completed giveaways recorded yet.");
      return;
    }
    LBC.notice("🎟️ GIVEAWAY HISTORY\n" + list.slice(-5).reverse().map(function (item) {
      return item.prize + " — " + (item.winner || "No winner");
    }).join("\n"));
  }

  function command(body, username, isOwner) {
    var raw = String(body || "").trim();
    var lower = raw.toLowerCase();
    var match;
    if (lower === "!giveaway") {
      showStatus(username);
      return;
    }
    if (lower === "!enter") {
      enter(username);
      return;
    }
    if (!isOwner || lower.indexOf("/ab giveaway") !== 0) return;

    if ((match = raw.match(/^\/ab giveaway start\s+(.+)$/i))) {
      var prize = cleanPrize(match[1]);
      if (!prize) {
        LBC.notice("Usage: /ab giveaway start Prize description.");
        return;
      }
      var existing = current();
      if (existing && (existing.status === "open" || existing.status === "closed")) {
        LBC.notice("A giveaway is already open or awaiting its draw. Finish or cancel it first.");
        return;
      }
      var state = {
        id: Date.now(),
        prize: prize,
        status: "open",
        entries: {},
        startedAt: Date.now(),
        endedAt: 0,
        winner: ""
      };
      if (!save(state)) {
        LBC.notice("The giveaway could not be saved.");
        return;
      }
      LBC.notice("🎟️ FREE GIVEAWAY OPEN: " + prize + "\nType !giveaway for details and !enter to join. No tip or purchase required.");
      return;
    }

    if (lower === "/ab giveaway status") {
      showStatus("");
      return;
    }

    if (lower === "/ab giveaway end") {
      var ending = current();
      if (!ending || ending.status !== "open") {
        LBC.notice("There is no open giveaway to close.");
        return;
      }
      ending.status = "closed";
      ending.endedAt = Date.now();
      save(ending);
      LBC.notice("🎟️ Entries closed for " + ending.prize + ". " + entryCount(ending) + " entries. Use /ab giveaway draw.");
      return;
    }

    if (lower === "/ab giveaway draw") {
      var drawing = current();
      if (!drawing || drawing.status !== "closed") {
        LBC.notice("Close the giveaway before drawing: /ab giveaway end.");
        return;
      }
      var entries = Object.keys(drawing.entries || {}).map(function (key) { return drawing.entries[key]; });
      if (!entries.length) {
        drawing.status = "completed";
        drawing.winner = "";
        save(drawing);
        LBC.notice("No entries were received for " + drawing.prize + ". Giveaway closed without a winner.");
        return;
      }
      var winner = entries[Math.floor(Math.random() * entries.length)];
      drawing.status = "completed";
      drawing.winner = winner;
      drawing.drawnAt = Date.now();
      save(drawing);
      var records = read(HISTORY_KEY, []);
      if (!Array.isArray(records)) records = [];
      records.push({ id: drawing.id, prize: drawing.prize, winner: winner, entries: entries.length, drawnAt: drawing.drawnAt });
      writeHistory(records.slice(-20));
      LBC.notice("🏆 GIVEAWAY WINNER: " + winner + " won " + drawing.prize + ". Congratulations!");
      return;
    }

    if (lower === "/ab giveaway cancel") {
      var cancelling = current();
      if (!cancelling || (cancelling.status !== "open" && cancelling.status !== "closed")) {
        LBC.notice("There is no active giveaway to cancel.");
        return;
      }
      cancelling.status = "cancelled";
      cancelling.endedAt = Date.now();
      save(cancelling);
      LBC.notice("Giveaway cancelled. No winner was selected.");
      return;
    }

    if (lower === "/ab giveaway history") {
      history();
      return;
    }

    LBC.notice("GIVEAWAY: /ab giveaway start Prize · status · end · draw · cancel · history. VIEWERS: !giveaway · !enter. Free entry only; no tips or purchases for entry.");
  }

  function writeHistory(list) {
    try {
      LBC.runtime.kvSet(HISTORY_KEY, JSON.stringify(list));
      return true;
    } catch (err) {
      return false;
    }
  }

  LBC.giveaway = {
    version: "1.0",
    status: function () {
      var state = current();
      return state ? { status: state.status, prize: state.prize, entries: entryCount(state), winner: state.winner || "" } : null;
    }
  };

  LBC.gameLibrary.register("free-giveaway", {
    onChatMessage: command
  });
}());


/*
 * AFTERDARK BROTHERHOOD — ADVANCED VIEWER QUEUE
 * Persistent FIFO waitlist, active turn controls, and bookable scheduled slots.
 * Reservations are free and never affect loyalty points or game odds.
 */
(function () {
  "use strict";

  var KEY = "lbc_ab_viewer_queue_v1";
  var TICK = "lbc_ab_queue_slot_tick";
  var MAX_WAIT = 50;
  var MAX_SLOTS = 30;
  var HISTORY = 20;

  function cleanName(value) {
    return String(value || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 25);
  }
  function cleanLabel(value) {
    return String(value || "").replace(/[\r\n\t]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
  }
  function read() {
    try {
      var raw = LBC.runtime.kvGet(KEY, "");
      var s = raw ? JSON.parse(raw) : {};
      return {
        version: 1,
        paused: s.paused === true,
        limit: Math.max(1, Math.min(MAX_WAIT, Number(s.limit) || MAX_WAIT)),
        nextId: Math.max(1, Number(s.nextId) || 1),
        waiting: Array.isArray(s.waiting) ? s.waiting.slice(0, MAX_WAIT) : [],
        current: s.current && typeof s.current === "object" ? s.current : null,
        slots: Array.isArray(s.slots) ? s.slots.slice(0, MAX_SLOTS) : [],
        history: Array.isArray(s.history) ? s.history.slice(0, HISTORY) : []
      };
    } catch (err) {
      return { version: 1, paused: false, limit: MAX_WAIT, nextId: 1, waiting: [], current: null, slots: [], history: [] };
    }
  }
  function save(s) {
    try {
      LBC.runtime.kvSet(KEY, JSON.stringify(s));
      LBC.runtime.reloadPanel();
      return true;
    } catch (err) { return false; }
  }
  function findUser(list, name) {
    var key = cleanName(name).toLowerCase();
    return list.some(function (x) { return x && cleanName(x.user).toLowerCase() === key; });
  }
  function slotTickNeeded(s) {
    return s.slots.some(function (x) { return x && x.user && !x.announced && Number(x.at) > Date.now(); });
  }
  function syncTick(s) {
    try {
      if (slotTickNeeded(s)) LBC.runtime.createCallback(TICK, 60, true);
      else LBC.runtime.cancelCallback(TICK);
    } catch (err) {}
  }
  function position(name, s) {
    var key = cleanName(name).toLowerCase();
    for (var i = 0; i < s.waiting.length; i++) {
      if (cleanName(s.waiting[i].user).toLowerCase() === key) return i + 1;
    }
    return 0;
  }
  function publicStatus() {
    var s = read();
    var lines = [];
    if (s.current) lines.push("NOW UP: " + s.current.user);
    if (s.paused) lines.push("WAITLIST PAUSED");
    lines.push("WAITING: " + s.waiting.length + " / " + s.limit);
    s.waiting.slice(0, 8).forEach(function (x, i) { lines.push((i + 1) + ". " + x.user); });
    if (s.waiting.length > 8) lines.push("+" + (s.waiting.length - 8) + " more waiting");
    LBC.notice("🖤 AFTERDARK — VIEWER QUEUE\n" + lines.join("\n") +
      "\nJoin: !joinqueue · Leave: !leavequeue · Book a slot: !slots");
  }
  function slotsText() {
    var s = read(), now = Date.now();
    var rows = s.slots.filter(function (x) { return x && Number(x.at) > now; })
      .sort(function (a, b) { return a.at - b.at; }).slice(0, 10);
    if (!rows.length) {
      LBC.notice("No scheduled slots are currently available. Check back later.", { toUsername: "" });
      return;
    }
    LBC.notice("🗓️ AFTERDARK — AVAILABLE SLOTS\n" + rows.map(function (x) {
      return "#" + x.id + " · " + new Date(x.at).toISOString() + " · " +
        (x.user ? "BOOKED: " + x.user : "AVAILABLE") + (x.label ? " · " + x.label : "");
    }).join("\n") + "\nBook: !book 1 · Times are shown in ISO format with timezone offset.");
  }
  function join(name) {
    var s = read(), user = cleanName(name);
    if (!user) return;
    if (s.paused) { LBC.notice("The viewer queue is paused right now.", { toUsername: user }); return; }
    if (s.current && cleanName(s.current.user).toLowerCase() === user.toLowerCase()) {
      LBC.notice("You're already the active turn.", { toUsername: user }); return;
    }
    if (findUser(s.waiting, user)) {
      LBC.notice("You're already in the queue at position #" + position(user, s) + ".", { toUsername: user }); return;
    }
    if (s.waiting.length >= s.limit) {
      LBC.notice("The viewer queue is full (" + s.limit + ").", { toUsername: user }); return;
    }
    s.waiting.push({ id: s.nextId++, user: user, joinedAt: Date.now() });
    save(s);
    LBC.notice("You're in. Queue position: #" + s.waiting.length + ".", { toUsername: user });
    LBC.notice("🖤 " + user + " joined the viewer queue · " + s.waiting.length + " waiting.");
  }
  function leave(name) {
    var s = read(), user = cleanName(name), before = s.waiting.length;
    s.waiting = s.waiting.filter(function (x) { return cleanName(x.user).toLowerCase() !== user.toLowerCase(); });
    if (s.waiting.length === before) {
      LBC.notice("You're not currently waiting in the queue.", { toUsername: user }); return;
    }
    save(s);
    LBC.notice("You've left the viewer queue.", { toUsername: user });
  }
  function nextTurn() {
    var s = read();
    if (s.current) { LBC.notice(s.current.user + " is still the active turn. Use /ab queue done or skip first."); return; }
    if (!s.waiting.length) { LBC.notice("The viewer queue is empty."); return; }
    var item = s.waiting.shift();
    s.current = { id: item.id, user: item.user, startedAt: Date.now() };
    save(s);
    LBC.notice("🎤 YOU'RE UP: " + item.user + " — your turn starts now. Everyone else, hold your place.");
  }
  function closeTurn(skipped) {
    var s = read();
    if (!s.current) { LBC.notice("There isn't an active viewer turn."); return; }
    var item = s.current;
    s.history.unshift({ user: item.user, startedAt: item.startedAt, endedAt: Date.now(), result: skipped ? "skipped" : "completed" });
    s.history = s.history.slice(0, HISTORY);
    s.current = null;
    if (skipped) s.waiting.push({ id: item.id, user: item.user, joinedAt: Date.now() });
    save(s);
    LBC.notice((skipped ? "⏭️ " : "✅ ") + item.user + (skipped ? " was moved to the back of the queue." : " finished their turn."));
  }
  function addSlot(match) {
    var s = read(), iso = match[1], label = cleanLabel(match[2]);
    var at = Date.parse(iso);
    if (!isFinite(at) || at <= Date.now()) { LBC.notice("Use a future ISO date/time with timezone, e.g. /ab queue slot add 2026-11-21T20:30:00-05:00 Late slot."); return; }
    if (s.slots.length >= MAX_SLOTS) { LBC.notice("Scheduled slot list is full (" + MAX_SLOTS + ")."); return; }
    if (s.slots.some(function (x) { return x && x.at === at; })) { LBC.notice("That time slot already exists."); return; }
    var id = s.slots.reduce(function (n, x) { return Math.max(n, Number(x.id) || 0); }, 0) + 1;
    s.slots.push({ id: id, at: at, label: label, user: "", announced: false, createdAt: Date.now() });
    s.slots.sort(function (a, b) { return a.at - b.at; });
    save(s); syncTick(s);
    LBC.notice("🗓️ Slot #" + id + " added: " + new Date(at).toISOString() + (label ? " · " + label : ""));
  }
  function book(name, id) {
    var s = read(), user = cleanName(name), slot = null;
    s.slots.forEach(function (x) { if (Number(x.id) === Number(id)) slot = x; });
    if (!slot || slot.at <= Date.now()) { LBC.notice("That slot isn't available.", { toUsername: user }); return; }
    if (slot.user) { LBC.notice("That slot has already been booked.", { toUsername: user }); return; }
    if (s.slots.some(function (x) { return x.user && cleanName(x.user).toLowerCase() === user.toLowerCase(); })) {
      LBC.notice("You already have a scheduled slot. Cancel it before booking another.", { toUsername: user }); return;
    }
    slot.user = user;
    save(s); syncTick(s);
    LBC.notice("Your slot is booked for " + new Date(slot.at).toISOString() + ".", { toUsername: user });
    LBC.notice("🗓️ " + user + " booked a scheduled viewer slot.");
  }
  function cancelBooking(name) {
    var s = read(), user = cleanName(name), found = false;
    s.slots.forEach(function (x) {
      if (x.user && cleanName(x.user).toLowerCase() === user.toLowerCase()) { x.user = ""; x.announced = false; found = true; }
    });
    if (!found) { LBC.notice("You don't have a scheduled slot to cancel.", { toUsername: user }); return; }
    save(s); syncTick(s);
    LBC.notice("Your scheduled slot was cancelled.", { toUsername: user });
  }
  function adminHelp() {
    LBC.notice("QUEUE CONTROLS\n/ab queue status · next · done · skip · pause · resume · clear · announce · limit 25\n/ab queue slot add 2026-11-21T20:30:00-05:00 Label · slot remove 1 · slot list");
  }
  function adminCommand(body) {
    var s = read(), low = body.toLowerCase(), m;
    if (low === "/ab queue" || low === "/ab queue status") { publicStatus(); return; }
    if (low === "/ab queue next") { nextTurn(); return; }
    if (low === "/ab queue done") { closeTurn(false); return; }
    if (low === "/ab queue skip") { closeTurn(true); return; }
    if (low === "/ab queue pause") { s.paused = true; save(s); LBC.notice("Viewer queue paused. Current turn is unchanged."); return; }
    if (low === "/ab queue resume") { s.paused = false; save(s); LBC.notice("Viewer queue resumed."); return; }
    if (low === "/ab queue clear") { s.waiting = []; s.current = null; save(s); LBC.notice("Waitlist cleared and active turn closed. Scheduled bookings were preserved."); return; }
    if (low === "/ab queue announce") { publicStatus(); return; }
    if ((m = low.match(/^\/ab queue limit\s+([1-9][0-9]?)$/))) {
      var n = Number(m[1]);
      if (n > MAX_WAIT) { LBC.notice("Queue limit cannot exceed " + MAX_WAIT + "."); return; }
      s.limit = n; s.waiting = s.waiting.slice(0, n); save(s);
      LBC.notice("Queue capacity set to " + n + "."); return;
    }
    if ((m = body.match(/^\/ab queue slot add\s+(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:\d{2}))(?:\s+(.+))?$/i))) { addSlot(m); return; }
    if ((m = low.match(/^\/ab queue slot remove\s+([1-9][0-9]{0,3})$/))) {
      var id = Number(m[1]), old = s.slots.length;
      s.slots = s.slots.filter(function (x) { return Number(x.id) !== id; });
      if (s.slots.length === old) { LBC.notice("Slot not found."); return; }
      save(s); syncTick(s); LBC.notice("Scheduled slot #" + id + " removed."); return;
    }
    if (low === "/ab queue slot list") { slotsText(); return; }
    adminHelp();
  }
  function onChatMessage(body, username, isOwner) {
    var text = String(body || "").trim(), low = text.toLowerCase(), m;
    if (isOwner && low.indexOf("/ab queue") === 0) { adminCommand(text); return; }
    if (low === "!queue") { publicStatus(); return; }
    if (low === "!joinqueue") { join(username); return; }
    if (low === "!leavequeue") { leave(username); return; }
    if (low === "!slots") { slotsText(); return; }
    if ((m = low.match(/^!book\s+([1-9][0-9]{0,3})$/))) { book(username, Number(m[1])); return; }
    if (low === "!cancelbooking") { cancelBooking(username); return; }
  }
  function onCallback(label) {
    if (label !== TICK) return;
    var s = read(), now = Date.now(), changed = false;
    s.slots.forEach(function (x) {
      if (x && x.user && !x.announced && x.at > now && x.at - now <= 5 * 60 * 1000) {
        x.announced = true; changed = true;
        LBC.notice("⏰ SCHEDULED TURN IN 5 MINUTES: " + x.user + (x.label ? " · " + x.label : "") + ".");
        LBC.notice(x.user + ", your booked slot is coming up. Be ready.");
      }
    });
    if (changed) save(s);
    if (!slotTickNeeded(s)) LBC.runtime.cancelCallback(TICK);
  }
  function onAppStart() { syncTick(read()); }

  LBC.viewerQueue = {
    version: "1.0",
    status: function () {
      var s = read();
      return { paused: s.paused, waiting: s.waiting.length, limit: s.limit,
        current: s.current ? s.current.user : null,
        bookedSlots: s.slots.filter(function (x) { return !!x.user; }).length };
    }
  };
  LBC.gameLibrary.register("advanced-viewer-queue", {
    onChatMessage: onChatMessage,
    onCallback: onCallback,
    onAppStart: onAppStart
  });
}());




/* AFTERDARK BROTHERHOOD — UNIFIED LOYALTY + PERMANENT ROOM VIP */
(function () {
  "use strict";
  var LOYALTY_KEY = "lbc_ab_loyalty_activity_v1";
  var SESSION_PREFIX = "lbc_ab_watch_session_";
  var VIP_KEY = "lbc_ab_vip_members_v1";
  var TIP_DEDUPE_KEY = "lbc_ab_vip_tip_dedupe_v1";
  var WATCH_INTERVAL_SECONDS = 300;
  var CHAT_COOLDOWN_SECONDS = 600;
  var DAILY_VISIT_POINTS = 2;
  var WATCH_POINTS_PER_INTERVAL = 1;
  var CHAT_POINTS = 1;
  var TIERS = [
    { usd: 5000, name: "Brotherhood Royalty" },
    { usd: 1000, name: "The Obsession" },
    { usd: 500, name: "House Favorite" },
    { usd: 250, name: "Bad Habit" },
    { usd: 100, name: "Little Tease" },
    { usd: 50, name: "The Curious" }
  ];
  function clean(value) { return String(value || "").replace(/^@/, "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0,25); }
  function keyName(value) { return clean(value).toLowerCase(); }
  function read(key, fallback) {
    try { var raw=LBC.runtime.kvGet(key,""); return raw ? JSON.parse(raw) : fallback; } catch(e) { return fallback; }
  }
  function write(key, value) { try { return LBC.runtime.kvSet(key,JSON.stringify(value)); } catch(e) { return false; } }
  function activity() {
    var s=read(LOYALTY_KEY,{chat:{},daily:{},sessions:[]});
    if(!s||typeof s!=="object") s={chat:{},daily:{}};
    if(!s.chat) s.chat={}; if(!s.daily) s.daily={}; if(!Array.isArray(s.sessions)) s.sessions=[]; return s;
  }
  function award(name, points, reason, id) {
    return !!(LBC.rewards && LBC.rewards.award && LBC.rewards.award(name,points,reason,id));
  }
  function dayKey() { return new Date().toISOString().slice(0,10); }
  function enter(username) {
    var name=clean(username), k=keyName(username), now=Math.floor(Date.now()/1000);
    if(!name || k===keyName(LBC.runtime.kvGet("lbc_room_owner",""))) return;
    var sessionKey=SESSION_PREFIX+k;
    var existing=Number(LBC.runtime.kvGet(sessionKey,"0"))||0;
    var s=activity();
    if(!existing) { LBC.runtime.kvSet(sessionKey,String(now)); if(s.sessions.indexOf(k)<0) s.sessions.push(k); write(LOYALTY_KEY,s); }
    var today=dayKey();
    if(s.daily[k]!==today) {
      if(award(name,DAILY_VISIT_POINTS,"Daily room visit","loyalty:daily:"+k+":"+today)) {
        s.daily[k]=today; write(LOYALTY_KEY,s);
      }
    }
  }
  function exit(username) {
    var name=clean(username), k=keyName(username);
    if(!name) return;
    var sessionKey=SESSION_PREFIX+k;
    var started=Number(LBC.runtime.kvGet(sessionKey,"0"))||0;
    if(!started) return;
    LBC.runtime.kvSet(sessionKey,"");
    var sessionState=activity(); sessionState.sessions=sessionState.sessions.filter(function(x){return x!==k;}); write(LOYALTY_KEY,sessionState);
    var elapsed=Math.max(0,Math.min(86400,Math.floor(Date.now()/1000)-started));
    var intervals=Math.floor(elapsed/WATCH_INTERVAL_SECONDS);
    if(intervals>0) {
      var points=Math.min(288,intervals*WATCH_POINTS_PER_INTERVAL);
      award(name,points,"Verified room viewing time","loyalty:watch:"+k+":"+started);
    }
  }
  function resetSessions() {
    var s=activity();
    s.sessions.forEach(function(k){ LBC.runtime.kvSet(SESSION_PREFIX+k,""); });
    s.sessions=[]; write(LOYALTY_KEY,s);
  }
  function chat(username, body) {
    var name=clean(username), k=keyName(username), text=String(body||"").trim();
    if(!name || text.length<12 || text.split(/\s+/).length<3 || /^(!|\/)/.test(text)) return;
    var s=activity(), now=Math.floor(Date.now()/1000), last=Number(s.chat[k])||0;
    if(now-last<CHAT_COOLDOWN_SECONDS) return;
    if(award(name,CHAT_POINTS,"Meaningful chat engagement","loyalty:chat:"+k+":"+now)) {
      s.chat[k]=now; write(LOYALTY_KEY,s);
    }
  }
  function vipState() {
    var v=read(VIP_KEY,{members:{},events:[]});
    if(!v||typeof v!=="object") v={members:{},events:[]};
    if(!v.members) v.members={}; if(!Array.isArray(v.events)) v.events=[];
    return v;
  }
  function tierFor(usd) {
    for(var i=0;i<TIERS.length;i++) if(usd>=TIERS[i].usd) return TIERS[i].name;
    return "Not yet VIP";
  }
  function summary(username) {
    var v=vipState(), p=v.members[keyName(username)]||{username:clean(username),tokens:0,usd:0,firstTipAt:0,lastTipAt:0};
    return {username:p.username||clean(username),tokens:Number(p.tokens)||0,usd:Number(p.usd)||0,tier:tierFor(Number(p.usd)||0)};
  }
  function recordTip(username,tokens,eventId) {
    var name=clean(username), amount=Math.floor(Number(tokens)||0);
    if(!name || amount<1) return false;
    var v=vipState(), now=Math.floor(Date.now()/1000);
    var id=String(eventId||"").slice(0,100);
    if(!id) id="fallback:"+keyName(name)+":"+amount+":"+now;
    if(v.events.indexOf(id)>=0) return false;
    var k=keyName(name), p=v.members[k]||{username:name,tokens:0,usd:0,firstTipAt:now,lastTipAt:0};
    p.username=name; p.tokens=(Number(p.tokens)||0)+amount;
    p.usd=Math.round((Number(p.tokens)*0.05)*100)/100;
    p.lastTipAt=now;
    v.members[k]=p; v.events.push(id);
    if(v.events.length>500) v.events=v.events.slice(-500);
    return write(VIP_KEY,v)!==false;
  }
  function showVip(username,viewer) {
    var s=summary(username);
    LBC.notice("🖤 ROOM VIP — "+s.username+"\\nTier: "+s.tier+"\\nLifetime room tips: $"+s.usd.toFixed(2)+" ("+s.tokens+" tokens)\\nVIP status is permanent.",{toUsername:clean(viewer)});
  }
  function adminStatus() {
    var v=vipState(), names=Object.keys(v.members), total=0;
    names.forEach(function(k){total+=Number(v.members[k].usd)||0;});
    return {members:names.filter(function(k){return (Number(v.members[k].usd)||0)>=50;}).length,totalUsd:Math.round(total*100)/100};
  }
  function onChatMessage(body,username,isOwner) {
    var text=String(body||"").trim(), lower=text.toLowerCase(), m;
    if((m=lower.match(/^!vip(?:\s+@?([a-z0-9_-]{1,25}))?$/))) { showVip(m[1]||username,username); return; }
    if(!isOwner && !/^\//.test(text)) chat(username,text);
  }
  LBC.loyalty={version:"2.0",enter:enter,exit:exit,chat:chat,resetSessions:resetSessions,settings:{
    watchPointsPerFiveMinutes:WATCH_POINTS_PER_INTERVAL,chatPoints:CHAT_POINTS,chatCooldownSeconds:CHAT_COOLDOWN_SECONDS,dailyVisitPoints:DAILY_VISIT_POINTS
  }};
  LBC.vip={version:"1.0",summary:summary,recordTip:recordTip,tiers:function(){return TIERS.slice();},adminStatus:adminStatus};
  LBC.gameLibrary.register("unified-loyalty-vip",{onChatMessage:onChatMessage});
}());
