/*
 * LOST BOYS CLUB — EVENT HANDLER RUNTIME BRIDGE
 * Chaturbate SDK access stays in event handlers, never Shared Code.
 */
LBC.setRuntime({
  kvGet: function (key, fallback) { try { var value = $kv.get(key); return value === undefined || value === null || value === "" ? fallback : value; } catch (err) { return fallback; } },
  kvSet: function (key, value, ttlSeconds) { try { if (typeof ttlSeconds === "number" && ttlSeconds > 0) return $kv.set(key, value, ttlSeconds); return $kv.set(key, value); } catch (err) { return false; } },
  sendNotice: function (message, options) { try { return $room.sendNotice(String(message), options || {}); } catch (err) { return false; } },
  createCallback: function (label, seconds, repeat) { try { if (typeof repeat === "boolean") return $callback.create(label, seconds, repeat); return $callback.create(label, seconds); } catch (err) { return false; } },
  cancelCallback: function (label) { try { return $callback.cancel(label); } catch (err) { return false; } },
  reloadPanel: function () { try { return $room.reloadPanel(); } catch (err) { return false; } },
  setPanelTemplate: function (template) { try { return $room.setPanelTemplate(template); } catch (err) { return false; } }
});


// LOST BOYS CLUB — Chat Message
LBC.onChatMessage($message.body, $user.username, $user.isOwner);

var rawBody = String($message.body || "").trim();
var body = rawBody.toLowerCase();

if (body === "!clubstats") {
  var stats = { totalTokens: 0, tipCount: 0, largestTokens: 0, largestName: "" };
  try {
    var rawStats = $kv.get("lbc_m2_tip_stats", "");
    if (rawStats) stats = JSON.parse(rawStats);
  } catch (err) {
    // Keep the public command safe if stored stats are malformed.
  }

  var totalTokens = Number(stats.totalTokens) || 0;
  var tipCount = Number(stats.tipCount) || 0;
  var largestTokens = Number(stats.largestTokens) || 0;
  var largestName = String(stats.largestName || "No record yet");

  $room.sendNotice(
    "🏚️ LOST BOYS CLUB — CLUB SUPPORT\n" +
    "Total support: " + totalTokens + " tokens\n" +
    "Tips received: " + tipCount + "\n" +
    "Biggest single tip: " + largestTokens + " tokens" +
    (largestTokens ? " — " + largestName : "")
  );
}

// Refresh the native panel only for commands that can change game state.
if (/^\s*(\/lbc\s+(start|stop)|!guess\s+\d{1,3})\s*$/i.test(rawBody)) {
  $room.reloadPanel();
}

// M2.2 modular extension: room-goal commands are handled in Shared Code.
LBC.handleRoomGoalCommand($message.body, $user.isOwner);

// M2.3: configurable informational tip menu.
LBC.handleTipMenuCommand($message.body, $user.isOwner);

// M2.4: broadcaster-controlled rotating room announcements.
LBC.handleAnnouncementCommand($message.body, $user.isOwner);
