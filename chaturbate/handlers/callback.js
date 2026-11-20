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

// LOST BOYS CLUB — Callback
LBC.onCallback($callback.label);

// A callback may end a timed round; refresh the native panel afterward.
$room.reloadPanel();

// M2.4: process only the currently scheduled announcement callback.
LBC.onAnnouncementsCallback($callback.label);
