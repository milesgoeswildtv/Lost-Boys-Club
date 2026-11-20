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

// LOST BOYS CLUB — App Start
// Shared Code is executed before this handler.
var state = $kv.get("lbc_v1_game", "");
if (!state) {
  $kv.set("lbc_v1_game", JSON.stringify({ type: "idle", active: false, secret: null, guesses: {}, startedAt: 0, endsAt: 0 }));
}
$room.sendNotice("🖤 LOST BOYS CLUB clubhouse manager online. No map. No supervision. Questionable decisions.", { toUsername: $room.owner });

// M2.4: resume the announcement schedule after app startup when enabled.
LBC.startAnnouncements(true);
