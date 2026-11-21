/*
 * AFTERDARK BROTHERHOOD — EVENT HANDLER RUNTIME BRIDGE
 * Chaturbate SDK access stays in event handlers, never Shared Code.
 */
LBC.setRuntime({
  kvGet: function (key, fallback) { try { var value = $kv.get(key); return value === undefined || value === null || value === "" ? fallback : value; } catch (err) { return fallback; } },
  kvSet: function (key, value, ttlSeconds) { try { if (typeof ttlSeconds === "number" && ttlSeconds > 0) return $kv.set(key, value, ttlSeconds); return $kv.set(key, value); } catch (err) { return false; } },
  sendNotice: function (message, options) { try { return $room.sendNotice(String(message), options || {}); } catch (err) { return false; } },
  setPanelTemplate: function (template) { try { return $room.setPanelTemplate(template); } catch (err) { return false; } },
  getSetting: function (name, fallback) { try { var value = $settings && $settings[name]; return value === undefined || value === null ? fallback : value; } catch (err) { return fallback; } }
});


// AFTERDARK BROTHERHOOD — Broadcast Panel Update
// Native below-camera panel for Chaturbate App V2.
// Uses the Shared Code runtime bridge injected above.

var panel = LBC.panelData();
var game = panel.game;
var registeredGame = LBC.gameLibrary && typeof LBC.gameLibrary.active === "function" ?
  LBC.gameLibrary.active() : null;
var registeredGameActive = !!(registeredGame && registeredGame.active);
var legacyGameActive = panel.active === true ||
  (game && typeof game === "object" && game.active === true) ||
  game === "guess_number";
var gameActive = registeredGameActive || legacyGameActive;
var activityName = registeredGameActive ? String(registeredGame.name || registeredGame.id || "Room activity") :
  (legacyGameActive ? "GUESS THE NUMBER" : "");
var retentionEnabled = LBC.getSetting("retentionEnabled", true) !== false;
var publicRecognition = LBC.getSetting("retentionPublicRecognition", false) === true;

var status = gameActive ?
  (activityName + " · LIVE") :
  (retentionEnabled ? "Viewer retention ON · " + (publicRecognition ? "Public recognition" : "Private recognition") : "Viewer retention OFF");

var leader = panel.leader || "No champion yet";
var rounds = Number(panel.rounds) || 0;
var analytics = LBC.analytics && typeof LBC.analytics.aggregate === "function" ? LBC.analytics.aggregate(7) : null;
var analyticsLine = analytics ? (analytics.uniqueVisitors + " visitors · " + analytics.visits + " visits · " + analytics.tips + " tips · " + analytics.tipTokens + " tokens") : "Analytics initializing";

$room.setPanelTemplate({
  template: "3_rows_of_labels",
  row1_label: "AFTERDARK BROTHERHOOD",
  row1_value: gameActive ? activityName.toUpperCase().slice(0, 32) + " — LIVE" : "BROTHERHOOD OPEN",
  row2_label: gameActive ? "LIVE ACTIVITY" : "RETENTION",
  row2_value: status,
  row3_label: "AFTERDARK ANALYTICS · 7D",
  row3_value: analyticsLine.slice(0, 80)
});

// M2.2 modular extension: override row two only when a room goal exists.
if (LBC.getSetting("broadcastPanelStyle", "Goal + Game") !== "Game + Record") LBC.updateGoalPanel();
