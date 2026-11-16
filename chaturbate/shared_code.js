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
    try { $callback.cancel(GAME_TIMEOUT_LABEL); } catch (err) {}

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
      try { $room.reloadPanel(); } catch (err) {}
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

  function onChatMessage() {
    var body = String($message.body || "").trim();
    if (!body) return;

    var username = cleanName($user.username);
    var lower = body.toLowerCase();

    if ($user.isOwner && lower === "/lbc start") {
      startGuessGame();
      return;
    }
    if ($user.isOwner && lower === "/lbc stop") {
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
    if ($user.isOwner && lower === "/lbc help") {
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
