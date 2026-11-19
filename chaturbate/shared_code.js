/*
 * LOST BOYS CLUB — Shared Code
 * Version: 0.2.0
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
    var started = now();
    var callbackLabel = GAME_TIMEOUT_LABEL + "_" + started + "_" + Math.floor(Math.random() * 1000000);
    var game = {
      type: "guess_number",
      active: true,
      secret: secret,
      guesses: {},
      startedAt: started,
      endsAt: started + GAME_SECONDS,
      callbackLabel: callbackLabel
    };

    saveGame(game);
    $callback.create(callbackLabel, GAME_SECONDS);
    $room.reloadPanel();

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
      $room.reloadPanel();
      notice("🏆 CLUBHOUSE WINNER: " + winner + " got it. The number was " + game.secret + ". Enjoy your wildly temporary superiority.");
    } else {
      saveRecords(records);
      $room.reloadPanel();
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
      $room.reloadPanel();
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
    var game = getGame();
    if (game.active && game.type === "guess_number" && game.callbackLabel === label) {
      finishGuessGame("timeout");
    }
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
    var guessCount = Object.keys(game.guesses || {}).length;
    return {
      active: !!game.active,
      gameName: game.active ? "GUESS THE NUMBER" : "NO GAME RUNNING",
      gameStatus: game.active ? (guessCount + " GUESSES · !guess 1-100") : "CLUBHOUSE OPEN",
      rounds: Number(records.rounds) || 0,
      leader: leaders.length ? leaders[0] : "No champion yet"
    };
  }

  return {
    version: "0.2.0",
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

    $room.reloadPanel();
  };

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
    $room.reloadPanel();
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
 * Informational display only. Menu entries are not automated actions,
 * paid game access, guarantees, or promises of performance.
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
      .replace(/[\x00-\x1F\x7F]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, MAX_LABEL_LENGTH);
  }

  function showMenu() {
    var items = readMenu();
    if (!items.length) {
      LBC.notice("🏚️ The LOST BOYS CLUB tip menu is empty. The boys are taking suggestions from the management department.");
      return;
    }

    var lines = items.map(function (item, index) {
      return (index + 1) + ". " + Number(item.amount) + " tokens — " + cleanLabel(item.label);
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
        LBC.notice("Give the menu item a short label. Example: /lbc menu add 50 Song request");
        return;
      }
      var items = readMenu();
      if (items.length >= MAX_ITEMS) {
        LBC.notice("The tip menu is full (" + MAX_ITEMS + " items). Remove one before adding another.");
        return;
      }
      if (items.some(function (item) { return Number(item.amount) === amount; })) {
        LBC.notice("That token amount is already in the menu. Use a different amount so each item is clear.");
        return;
      }
      items.push({ amount: amount, label: label });
      items.sort(function (a, b) { return a.amount - b.amount; });
      saveMenu(items);
      LBC.notice("Added to the tip menu: " + amount + " tokens — " + label + ". View it with !tipmenu.");
      return;
    }

    var removeMatch = lower.match(/^\/lbc menu remove ([1-9][0-9]?)$/);
    if (removeMatch) {
      var removeIndex = Number(removeMatch[1]) - 1;
      var current = readMenu();
      if (removeIndex < 0 || removeIndex >= current.length) {
        LBC.notice("That menu item number doesn't exist. Use !tipmenu to see the current list.");
        return;
      }
      var removed = current.splice(removeIndex, 1)[0];
      saveMenu(current);
      LBC.notice("Removed: " + removed.amount + " tokens — " + cleanLabel(removed.label) + ".");
      return;
    }

    if (lower === "/lbc menu clear") {
      saveMenu([]);
      LBC.notice("Tip menu cleared. !tipmenu will show an empty menu until new items are added.");
      return;
    }

    if (lower === "/lbc menu" || lower === "/lbc menu show") {
      showMenu();
      return;
    }

    LBC.notice(
      "Tip menu controls: /lbc menu add 50 Song request · " +
      "/lbc menu remove 1 · /lbc menu clear · /lbc menu show. " +
      "Viewers use !tipmenu. Maximum " + MAX_ITEMS + " items."
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
      var raw = $kv.get(STATE_KEY, "");
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
    $kv.set(STATE_KEY, JSON.stringify(state));
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
 * Message text is normalized to one line and limited to 200 characters.
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
 * Existing game engine, round timing, scoring, and valid-guess handling stay untouched.
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

    // The core already handles every one-to-three-digit numeric guess,
    // including out-of-range values. Do not duplicate its response.
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
      var raw = $kv.get(STATE_KEY, "");
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
    $kv.set(STATE_KEY, JSON.stringify(state));
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
