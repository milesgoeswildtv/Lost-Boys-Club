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
  setPanelTemplate: function (template) { try { return $room.setPanelTemplate(template); } catch (err) { return false; } },
  getSetting: function (name, fallback) { try { var value = $settings && $settings[name]; return value === undefined || value === null ? fallback : value; } catch (err) { return fallback; } }
});

// AFTERDARK BROTHERHOOD — User Exit
if (LBC.loyalty) LBC.loyalty.exit($user.username);
