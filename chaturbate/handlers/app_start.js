/*
 * AFTERDARK BROTHERHOOD — EVENT HANDLER RUNTIME BRIDGE
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


// AFTERDARK BROTHERHOOD — App Start
// Drop stale viewing sessions; presence cannot be verified across app restarts.
if (LBC.loyalty) LBC.loyalty.resetSessions();
// Shared Code is executed before this handler.
var state = $kv.get("lbc_v1_game", "");
if (!state) {
  $kv.set("lbc_v1_game", JSON.stringify({ type: "idle", active: false, secret: null, guesses: {}, startedAt: 0, endsAt: 0 }));
}
$room.sendNotice("🖤 AFTERDARK BROTHERHOOD brotherhood manager online. No map. No supervision. Questionable decisions.", { toUsername: $room.owner });

// M2.4: resume the announcement schedule after app startup when enabled.
LBC.startAnnouncements(true);
