/*
 * LOST BOYS CLUB — Shared Code
 * Version: 0.1.0
 * Paste into the Chaturbate Developer Portal "Shared Code" editor.
 *
 * Runtime contract verified against the Chaturbate App V2 DevKit type
 * declarations and official V2 docs: $room, $kv, $callback, $user,
 * $message, $tip are platform-provided globals.
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
      var raw = $kv.get(PREFIX + key, "");
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (err) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      return $kv.set(PREFIX + key, JSON.stringify(value));
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
      $room.sendNotice(String(text), options || {});
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
      "🖤 LOST BOYS CLUB — CLUBHOUSE",
      "No map. No supervision. Questionable decisions.",
      "",
      "FREE GAME: GUESS THE NUMBER",
      "When a round is active, type: !guess 42",
      "Pick a whole number from 1 to 100. One guess per person.",
      "",
      "Room commands:",
      "!lbc — show this help",
      "!game — show the current game",
      "!scoreboard — show club records",
      "",
      "Broadcaster controls:",
      "/lbc start — start a 90-second round",
      "/lbc stop — end the current round"
    ].join("\n");
  }

  function statusText() {
    var game = getGame();
    if (!game.active) return "🎮 No game running. The clubhouse is unsupervised.";
    var count = Object.keys(game.guesses || {}).length;
    return "🎯 GUESS THE NUMBER is live! Pick 1–100 with !guess <number>. " +
      count + " player" + (count === 1 ? "" : "s") + " entered. " +
      "Time left: " + Math.max(0, game.endsAt - now()) + "s.";
  }

  function startGuessGame() {
    var current = getGame();
    if (current.active) {
      notice("The current round is already running. Please don't make the clubhouse manage two disasters at once.");
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
      $callback.cancel(GAME_TIMEOUT_LABEL);
      $callback.create(GAME_TIMEOUT_LABEL, GAME_SECONDS, false);
    } catch (err) {
      // The round remains playable; broadcaster can end it manually.
    }

    notice(
      "🖤 LOST BOYS CLUB GAME TIME 🖤\n" +
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
      records.recentWinners.unshift({ name: winner, at: now() });
      records.recentWinners = records.recentWinners.slice(0, 10);
      saveRecords(records);
      notice("🏆 CLUBHOUSE WINNER: " + winner + " got it. The number was " + game.secret + ". Enjoy your wildly temporary superiority.");
    } else {
      saveRecords(records);
      notice(
        (reason === "timeout" ? "⏰ Time's up." : "🛑 Round ended.") +
        " Nobody nailed it. The number was " + game.secret +
        ". " + guessers.length + " guess" + (guessers.length === 1 ? "" : "es") + " submitted. The clubhouse remains intellectually unsupervised."
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
      "🏚️ LOST BOYS CLUB — HALL OF SHAME / FAME\n" +
      "Rounds played: " + (Number(records.rounds) || 0) + "\n" +
      (lines.length ? lines.join("\n") : "No winners yet. A clean slate of questionable potential.")
    );
  }

  function welcome(username) {
    var safe = cleanName(username);
    var key = "welcome_" + safe.toLowerCase();
    var last = Number($kv.get(PREFIX + key, "0")) || 0;
    var current = now();

    // One welcome per user per 6 hours, avoiding noisy repeat greetings.
    if (current - last < 21600) return;
    $kv.set(PREFIX + key, String(current), 86400);

    notice("🖤 " + safe + " wandered into LOST BOYS CLUB. No map, no supervision, questionable decisions. Make yourself comfortable.");
  }

  function onChatMessage(rawBody, rawUsername, isOwner) {
    var body = String(rawBody || "").trim();
    if (!body) return;

    var username = cleanName(rawUsername);
    var lower = body.toLowerCase();

    if (isOwner && lower === "/lbc start") {
      startGuessGame();
      return;
    }
    if (isOwner && lower === "/lbc stop") {
      finishGuessGame("manual");
      return;
    }

    if (lower === "!lbc" || lower === "!lbc help") {
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
    if (isOwner && lower === "/lbc help") {
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
      notice("🖤 " + safe + " tossed " + Number(tokens) + " tokens into the clubhouse. Much appreciated. No game advantage attached.");
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
    version: "0.1.0",
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
 * LOST BOYS CLUB — Modular Room Utilities
 * M2.2 room-goal helpers. Appended after the existing LBC core.
 * Event handlers call these small public methods; feature logic stays here.
 */
(function () {
  "use strict";

  var GOAL_KEY = "lbc_m2_room_goal";
  var STATS_KEY = "lbc_m2_tip_stats";

  function readStoredJson(key, fallback) {
    try {
      var raw = $kv.get(key, "");
      return raw ? JSON.parse(raw) : fallback;
    } catch (err) {
      return fallback;
    }
  }

  function readGoalSnapshot() {
    var goal = readStoredJson(GOAL_KEY, null);
    var stats = readStoredJson(STATS_KEY, {});
    if (!goal || !(Number(goal.target) > 0)) return null;

    var target = Number(goal.target);
    var total = Number(stats.totalTokens) || 0;
    var progress = Math.max(0, total - (Number(goal.startTotal) || 0));

    return {
      goal: goal,
      target: target,
      progress: progress,
      displayedProgress: Math.min(progress, target),
      percent: Math.min(100, Math.floor(progress / target * 100)),
      active: goal.active === true,
      completed: goal.completed === true
    };
  }

  LBC.handleRoomGoalCommand = function (rawBody, isOwner) {
    var body = String(rawBody || "").trim();
    var lower = body.toLowerCase();

    if (lower === "!clubgoal") {
      var snapshot = readGoalSnapshot();
      if (!snapshot) {
        LBC.notice("No room goal is set right now. The clubhouse is financially irresponsible but emotionally available.");
        return;
      }

      LBC.notice(
        "🏚️ LOST BOYS CLUB — ROOM GOAL\n" +
        (snapshot.active ? "Progress: " : "Last goal: ") +
        snapshot.displayedProgress + " / " + snapshot.target +
        " tokens (" + snapshot.percent + "%)" +
        (snapshot.active
          ? "\nVoluntary support only. No perks or game advantage."
          : (snapshot.completed ? "\nGoal reached. Thanks, troublemakers." : "\nGoal is not currently active."))
      );
      return;
    }

    if (!isOwner || lower.indexOf("/lbc goal") !== 0) return;

    var match = lower.match(/^\/lbc goal (off|[1-9][0-9]{0,6})$/);
    if (!match) {
      LBC.notice("Use /lbc goal 500 to set a goal, or /lbc goal off to turn it off.");
      return;
    }

    if (match[1] === "off") {
      $kv.set(GOAL_KEY, JSON.stringify({
        target: 0, startTotal: 0, active: false, completed: false, milestones: {}
      }));
      LBC.notice("Room goal switched off. The clubhouse returns to its regularly scheduled nonsense.");
    } else {
      var stats = readStoredJson(STATS_KEY, {});
      var baseline = Number(stats.totalTokens) || 0;
      var target = Number(match[1]);
      $kv.set(GOAL_KEY, JSON.stringify({
        target: target,
        startTotal: baseline,
        active: true,
        completed: false,
        milestones: {}
      }));
      LBC.notice("🏚️ New clubhouse goal set: " + target + " tokens. Progress starts now. Support is voluntary; nothing is locked behind it.");
    }

LBC.runtime.reloadPanel()  };

  LBC.processRoomGoalTip = function (rawTokens) {
    var tokens = Math.max(0, Math.floor(Number(rawTokens) || 0));
    if (!tokens) return;

    // The M2.1 Tip Received handler updates aggregate totals before calling this.
    var snapshot = readGoalSnapshot();
    if (!snapshot || !snapshot.active) return;

    var goal = snapshot.goal;
    var milestones = goal.milestones && typeof goal.milestones === "object"
      ? goal.milestones : {};

    [25, 50, 75, 100].forEach(function (mark) {
      var key = String(mark);
      if (snapshot.percent >= mark && !milestones[key]) {
        milestones[key] = true;
        LBC.notice(
          mark === 100
            ? "🏁 CLUBHOUSE GOAL REACHED. " + snapshot.target + " tokens. You beautiful bunch of questionable decisions. Thank you."
            : "🏚️ Clubhouse goal update: " + mark + "% reached. " +
            snapshot.displayedProgress + " / " + snapshot.target +
            " tokens. Voluntary support, always."
        );
      }
    });

    goal.milestones = milestones;
    if (snapshot.percent >= 100) {
      goal.active = false;
      goal.completed = true;
    }
    $kv.set(GOAL_KEY, JSON.stringify(goal));
    LBC.runtime.reloadPanel()
  };

  LBC.updateGoalPanel = function () {
    var snapshot = readGoalSnapshot();
    if (!snapshot) return;

    var panel = LBC.panelData();
    var row2Value = (snapshot.active ? "" : (snapshot.completed ? "REACHED · " : "PAUSED · ")) +
      snapshot.displayedProgress + "/" + snapshot.target + " TOKENS · " + snapshot.percent + "%";

    $room.setPanelTemplate({
      template: "3_rows_of_labels",
      row1_label: "LOST BOYS CLUB",
      row1_value: panel.active ? "GUESS THE NUMBER — LIVE" : "CLUBHOUSE OPEN",
      row2_label: "ROOM GOAL",
      row2_value: row2Value,
      row3_label: "CLUB RECORD",
      row3_value: (panel.leader || "No champion yet") + " · " +
        (Number(panel.rounds) || 0) +
        ((Number(panel.rounds) || 0) === 1 ? " round" : " rounds")
    });
  };
}());

/*
 * LOST BOYS CLUB — Configurable Tip Menu
 * Informational display only.
 */
(function () {
  "use strict";

  var MENU_KEY = "lbc_m2_tip_menu";
  var MAX_ITEMS = 12;
  var MAX_LABEL_LENGTH = 70;

  function readMenu() {
    try {
      var raw = $kv.get(MENU_KEY, "");
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
    $kv.set(MENU_KEY, JSON.stringify(items));
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
      LBC.notice("🏚️ The LOST BOYS CLUB tip menu is empty.");
      return;
    }

    var lines = items.map(function (item, index) {
      return (index + 1) + ". " + Number(item.amount) +
        " tokens — " + cleanLabel(item.label);
    });

    LBC.notice(
      "🖤 LOST BOYS CLUB — TIP MENU\n" +
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

    if (!isOwner || lower.indexOf("/lbc menu") !== 0) return;

    var addMatch = body.match(/^\/lbc menu add ([1-9][0-9]{0,4}) (.{1,200})$/i);

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

    var removeMatch = lower.match(/^\/lbc menu remove ([1-9][0-9]?)$/);

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

    if (lower === "/lbc menu clear") {
      saveMenu([]);
      LBC.notice("Tip menu cleared.");
      return;
    }

    if (lower === "/lbc menu" || lower === "/lbc menu show") {
      showMenu();
      return;
    }

    LBC.notice(
      "Tip menu controls: /lbc menu add 50 Song request · " +
      "/lbc menu remove 1 · /lbc menu clear · /lbc menu show. " +
      "Viewers use !tipmenu."
    );
  };
}());

/*
 * LOST BOYS CLUB — Rotating Room Announcements
 * Broadcaster-controlled, low-frequency informational notices.
 * Starts disabled; one notice every 15 minutes while enabled.
 */
(function () {
  "use strict";

  var STATE_KEY = "lbc_m2_announcements";
  var CALLBACK_PREFIX = "lbc_m2_announce_";
  var INTERVAL_SECONDS = 900;
  var MESSAGES = [
    "🖤 Welcome to LOST BOYS CLUB. No map. No supervision. Questionable decisions. Type !lbc for the clubhouse guide.",
    "🎮 The clubhouse game is free to join. Type !game to see whether a round is running.",
    "🏚️ New around here? Type !lbc for the room guide, or !scoreboard to see the clubhouse records.",
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
    $callback.create(label, INTERVAL_SECONDS);
  }

  LBC.startAnnouncements = function (restart) {
    var state = readState();
    if (!state.enabled) return;
    if (!restart && state.callbackLabel) return;
    scheduleNext(state);
  };

  LBC.handleAnnouncementCommand = function (rawBody, isOwner) {
    var body = String(rawBody || "").trim().toLowerCase();
    if (!isOwner || body.indexOf("/lbc announcements") !== 0) return;

    var state = readState();

    if (body === "/lbc announcements on") {
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

    if (body === "/lbc announcements off") {
      state.enabled = false;
      state.callbackLabel = "";
      saveState(state);
      LBC.notice("Rotating announcements disabled.");
      return;
    }

    if (body === "/lbc announcements status") {
      LBC.notice("Rotating announcements are " + (state.enabled ? "ON" : "OFF") + ". Cadence: one notice every 15 minutes.");
      return;
    }

    LBC.notice("Announcement controls: /lbc announcements on · /lbc announcements off · /lbc announcements status. Default: off.");
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
 * LOST BOYS CLUB — Custom Broadcaster Announcements
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
    var match = body.match(/^\/lbc\s+say(?:\s+([\s\S]*))?$/i);
    if (!match) return;

    var message = cleanAnnouncement(match[1] || "");

    if (!message) {
      LBC.notice("Usage: /lbc say Your announcement goes here.", {
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

    LBC.notice("📣 LOST BOYS CLUB — " + message);

    LBC.notice("Your announcement was posted.", {
      toUsername: String(username || "")
    });
  };
}());

/*
 * LOST BOYS CLUB — Guess the Number Player Guidance
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
 * LOST BOYS CLUB — Higher or Lower
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
      var raw = $kv.get("lbc_v1_game", "");
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
    $callback.create(label, Math.max(1, seconds));
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
      LBC.notice("Higher or Lower is already running. One clubhouse disaster at a time.");
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
      "🎲 LOST BOYS CLUB — HIGHER OR LOWER\n" +
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
    if (isOwner && body === "/lbc start" && state.active) {
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

    if (isOwner && body === "/lbc higher start") {
      startRound();
      return;
    }

    if (isOwner && body === "/lbc higher stop") {
      finish("manual");
      return;
    }

    if (isOwner && body === "/lbc higher status") {
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
 * LOST BOYS CLUB — Couple Trivia
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
      var raw = $kv.get(QUESTIONS_KEY, "");
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
    $kv.set(QUESTIONS_KEY, JSON.stringify(list));
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
      var coreRaw = $kv.get("lbc_v1_game", "");
      var core = coreRaw ? JSON.parse(coreRaw) : null;
      if (core && core.active === true) return true;

      var higherRaw = $kv.get("lbc_m3_higher_lower", "");
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
    $callback.create(label, Math.max(1, seconds));
  }

  function finish(reason, expectedLabel, winner) {
    var state = readState();
    if (!state.active) return;
    if (expectedLabel && expectedLabel !== state.callbackLabel) return;

    state.active = false;
    state.callbackLabel = "";
    saveState(state);

    if (winner) {
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
      LBC.notice("Couple Trivia is already running. One clubhouse disaster at a time.");
      return;
    }
    if (otherGameIsActive()) {
      LBC.notice("Another clubhouse game is already running. Finish it before starting Couple Trivia.");
      return;
    }

    var questions = readQuestions();
    if (!questions.length) {
      LBC.notice("The trivia deck is empty. Add a question first: /lbc trivia add Question :: Answer");
      return;
    }

    var last = Number($kv.get(LAST_KEY, "-1"));
    var index = Math.floor(Math.random() * questions.length);
    if (questions.length > 1 && index === last) index = (index + 1) % questions.length;
    $kv.set(LAST_KEY, String(index));

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
      "🧠 LOST BOYS CLUB — COUPLE TRIVIA\n" +
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
    if (isOwner && (lower === "/lbc start" || lower === "/lbc higher start") && state.active) {
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

    if (isOwner && lower === "/lbc trivia start") {
      startRound();
      return;
    }

    if (isOwner && lower === "/lbc trivia stop") {
      finish("manual");
      return;
    }

    if (isOwner && lower === "/lbc trivia status") {
      LBC.notice("Couple Trivia is " + (state.active ? "ON" : "OFF") + ". " +
        readQuestions().length + " question(s) saved.");
      return;
    }

    if (isOwner && lower === "/lbc trivia list") {
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

    if (isOwner && lower === "/lbc trivia clear") {
      if (state.active) {
        LBC.notice("Stop the active trivia round before clearing the question deck.");
        return;
      }
      saveQuestions([]);
      LBC.notice("Couple Trivia question deck cleared.");
      return;
    }

    if (isOwner && lower.indexOf("/lbc trivia add") === 0) {
      var addMatch = body.match(/^\/lbc trivia add\s+([\s\S]+?)\s+::\s+([\s\S]+)$/i);
      if (!addMatch) {
        LBC.notice("Use: /lbc trivia add Your question? :: Correct answer");
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
      LBC.notice("Trivia question added (" + deck.length + "/" + MAX_QUESTIONS + "). Use /lbc trivia list to review the deck.");
      return;
    }

    if (isOwner && lower.indexOf("/lbc trivia remove") === 0) {
      var removeMatch = lower.match(/^\/lbc trivia remove ([1-9][0-9]?)$/);
      if (!removeMatch) {
        LBC.notice("Use: /lbc trivia remove <number>. Check positions with /lbc trivia list.");
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

    if (isOwner && lower.indexOf("/lbc trivia") === 0) {
      LBC.notice(
        "TRIVIA CONTROLS: /lbc trivia add Question :: Answer · " +
        "/lbc trivia remove 1 · /lbc trivia list · /lbc trivia clear · " +
        "/lbc trivia start · /lbc trivia stop · /lbc trivia status"
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
 * LOST BOYS CLUB — UNIFIED GAME LIBRARY
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
        "The clubhouse had a small technical issue while processing " +
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
      var raw = LBC.runtime.kvSet(activeGameKey, "")
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  }

  function saveActiveGame(game) {
    try {
      if (!game) {
        LBC.runtime.kvSet(activeGameKey, "")
      }

      LBC.runtime.kvSet(activeGameKey, JSON.stringify(game))
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

    var args = [body, username, isOwner];

    // Original Guess the Number engine.
    safeCall(originals.coreChat, args, "Guess the Number");

    // Existing room systems.
    safeCall(originals.roomGoal, [body, isOwner], "Room Goal");
    safeCall(originals.tipMenu, [body, isOwner], "Tip Menu");
    safeCall(originals.announcements, [body, isOwner], "Announcements");
    safeCall(originals.customAnnouncement, [body, isOwner, username], "Custom Announcements");
    safeCall(originals.guidance, [body, username], "Player Guidance");

    // Existing games.
    safeCall(originals.higherLower, [body, isOwner, username], "Higher or Lower");
    safeCall(originals.trivia, [body, isOwner, username], "Couple Trivia");

    // All future registered games.
    runModules("onChatMessage", args);
  }

  function dispatchCallback(label) {
    activeDispatch = "callback";

    safeCall(originals.coreCallback, [label], "Guess the Number");
    safeCall(originals.announcementCallback, [label], "Announcements");
    safeCall(originals.higherCallback, [label], "Higher or Lower");
    safeCall(originals.triviaCallback, [label], "Couple Trivia");

    runModules("onCallback", [label]);
  }

  function dispatchAppStart() {
    activeDispatch = "appstart";

    safeCall(originals.startAnnouncements, [true], "Announcements Recovery");
    safeCall(originals.resumeHigherLower, [], "Higher or Lower Recovery");
    safeCall(originals.resumeTrivia, [], "Couple Trivia Recovery");

    runModules("onAppStart", []);
  }

  /*
   * Preserve the original functions before installing the controller.
   */
  var originals = {
    coreChat: LBC.onChatMessage,
    coreCallback: LBC.onCallback,

    roomGoal: LBC.handleRoomGoalCommand,
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

  LBC.notice("🖤 LOST BOYS CLUB — Game Library online.");

}());

/*
 * LOST BOYS CLUB — AFTER HOURS GAME PACK
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
      var raw = LBC.runtime.kvSet(STATE_KEY, "")
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
    LBC.runtime.kvGet(STATE_KEY, "")
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
        "Another clubhouse game is already running. Finish it before starting " +
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

    LBC.runtime.reloadPanel()
  }

  function stopIfLegacyGameStarts(body, isOwner) {
    if (!isOwner || !state || !state.active) return false;

    var command = String(body || "").trim().toLowerCase();

    var legacyStarts = [
      "/lbc start",
      "/lbc higher start",
      "/lbc trivia start"
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

    if (isOwner && lower === "/lbc codebreaker start") {
      var secret = createCode();

      if (startGame("codebreaker", "Codebreaker", {
        secret: secret,
        attempts: {},
        answer: secret
      }, 90)) {
        startNotice(
          "🔐 LOST BOYS CLUB — CODEBREAKER\n" +
          randomItem(codebreakerPrompts) + "\n" +
          "Send !code followed by four unique digits.\n" +
          "Example: !code 4821\n" +
          "Each player gets up to six attempts. 90 seconds."
        );
      }
      return true;
    }

    if (isOwner && lower === "/lbc codebreaker stop") {
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
    { word: "AFTERHOURS", hint: "The club doesn't close." },
    { word: "MYSTERY", hint: "Nobody knows what's coming." },
    { word: "TEMPTATION", hint: "The questionable decision." },
    { word: "SECRET", hint: "Keep this between us." },
    { word: "ELECTRIC", hint: "The feeling in the room." },
    { word: "MISCHIEF", hint: "A little trouble." },
    { word: "UNFILTERED", hint: "No holding back." }
  ];

  function handleWordScramble(body, username, isOwner) {
    var lower = body.toLowerCase();

    if (isOwner && lower === "/lbc scramble start") {
      var selected = randomItem(wordDeck);

      if (startGame("word-scramble", "Word Scramble", {
        answer: selected.word,
        scrambled: shuffleWord(selected.word),
        hint: selected.hint
      }, 75)) {
        "🔤 LOST BOYS CLUB — WORD SCRAMBLE\n" +
          "Unscramble this word:\n\n" +
          selected.word === ""

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

    if (isOwner && lower === "/lbc scramble stop") {
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

    if (isOwner && lower === "/lbc wyr start") {
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

    if (isOwner && lower === "/lbc wyr stop") {
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

    if (isOwner && lower === "/lbc position start") {
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

    if (isOwner && lower === "/lbc position stop") {
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

    if (isOwner && lower === "/lbc charades start") {
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

    if (isOwner && lower === "/lbc charades stop") {
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
      "🖤 " + state.name + " resumed after the clubhouse restart."
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

/*
 * LOST BOYS CLUB — EVENT HANDLER BRIDGE
 * Provides Chaturbate SDK access to Shared Code safely.
 */

(function () {
  "use strict";

  if (LBC.setRuntime) return;

  var runtime = {};

  LBC.setRuntime = function (api) {
    runtime = api || {};
  };

  LBC.runtime = {
    kvGet: function (key, fallback) {
      return typeof runtime.kvGet === "function"
        ? runtime.kvGet(key, fallback)
        : fallback;
    },

    kvSet: function (key, value) {
      if (typeof runtime.kvSet === "function") {
        return runtime.kvSet(key, value);
      }
    },

    createCallback: function (label, seconds) {
      if (typeof runtime.createCallback === "function") {
        return runtime.createCallback(label, seconds);
      }
    },

    reloadPanel: function () {
      if (typeof runtime.reloadPanel === "function") {
        return runtime.reloadPanel();
      }
    }
  };
}());
