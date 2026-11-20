/*
 * AFTERDARK BROTHERHOOD — EVENT HANDLER RUNTIME BRIDGE
 * Chaturbate SDK access stays in event handlers, never Shared Code.
 */
LBC.setRuntime({
  kvGet: function (key, fallback) { try { var value = $kv.get(key); return value === undefined || value === null || value === "" ? fallback : value; } catch (err) { return fallback; } },
  kvSet: function (key, value, ttlSeconds) { try { if (typeof ttlSeconds === "number" && ttlSeconds > 0) return $kv.set(key, value, ttlSeconds); return $kv.set(key, value); } catch (err) { return false; } },
  sendNotice: function (message, options) { try { return $room.sendNotice(String(message), options || {}); } catch (err) { return false; } },
  setPanelTemplate: function (template) { try { return $room.setPanelTemplate(template); } catch (err) { return false; } }
});


// AFTERDARK BROTHERHOOD — Broadcast Panel Update
// Native below-camera panel for Chaturbate App V2.
// Uses the Shared Code runtime bridge injected above.

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
  row1_label: "AFTERDARK BROTHERHOOD",
  row1_value: gameActive ? "GUESS THE NUMBER — LIVE" : "BROTHERHOOD OPEN",
  row2_label: gameActive ? "GAME STATUS" : "STATUS",
  row2_value: status,
  row3_label: "CLUB RECORD",
  row3_value: leader + " · " + rounds + (rounds === 1 ? " round" : " rounds")
});

// M2.2 modular extension: override row two only when a room goal exists.
LBC.updateGoalPanel();
