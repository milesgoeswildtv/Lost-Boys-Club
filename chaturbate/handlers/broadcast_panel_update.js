/*
 * LOST BOYS CLUB — EVENT HANDLER RUNTIME BRIDGE
 * Required before any LBC method call in this event handler.
 */
LBC.setRuntime({
  kvGet: function (key, fallback) {
    try {
      var value = $kv.get(key);
      return value === undefined || value === null || value === "" ? fallback : value;
    } catch (err) { return fallback; }
  },
  kvSet: function (key, value, ttlSeconds) {
    try {
      if (typeof ttlSeconds === "number" && ttlSeconds > 0) return $kv.set(key, value, ttlSeconds);
      return $kv.set(key, value);
    } catch (err) { return false; }
  },
  sendNotice: function (message, options) { return $room.sendNotice(String(message), options || {}); },
  createCallback: function (label, seconds, repeat) {
    if (typeof repeat === "boolean") return $callback.create(label, seconds, repeat);
    return $callback.create(label, seconds);
  },
  reloadPanel: function () { return $room.reloadPanel(); },
  setPanelTemplate: function (template) { return $room.setPanelTemplate(template); }
});

// LOST BOYS CLUB — Broadcast Panel Update
// Native below-camera panel for Chaturbate App V2.
// Compatible with the existing Shared Code; no Shared Code replacement required.

var panel = LBC.panelData();
var game = panel.game;
var gameActive = panel.active === true ||
  (game && typeof game === "object" && game.active === true) ||
  game === "guess_number";

var status = panel.gameStatus ||
  (gameActive ? "Round live. Type !guess 1-100." :
    (typeof game === "string" && game !== "idle" ? game : "No game running. Questionable decisions."));

var leader = panel.leader || "No champion yet";
var rounds = Number(panel.rounds) || 0;

$room.setPanelTemplate({
  template: "3_rows_of_labels",
  row1_label: "LOST BOYS CLUB",
  row1_value: gameActive ? "GUESS THE NUMBER — LIVE" : "CLUBHOUSE OPEN",
  row2_label: gameActive ? "GAME STATUS" : "STATUS",
  row2_value: status,
  row3_label: "CLUB RECORD",
  row3_value: leader + " · " + rounds + (rounds === 1 ? " round" : " rounds")
});

// M2.2 modular extension: override row two only when a room goal exists.
LBC.updateGoalPanel();
