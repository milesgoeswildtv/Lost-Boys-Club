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


// AFTERDARK BROTHERHOOD — Tip Received
// M2: persistent brotherhood tip stats + restrained thank-you notices.
// Every tip is counted. Thank-you notices are throttled per supporter.

var TIP_STATS_KEY = "lbc_m2_tip_stats";
var TIP_ACK_PREFIX = "lbc_m2_tip_ack_";
var ACK_COOLDOWN_SECONDS = 45;

function readTipStats() {
  try {
    var raw = $kv.get(TIP_STATS_KEY, "");
    if (!raw) return { totalTokens: 0, tipCount: 0, largestTokens: 0, largestName: "" };
    var parsed = JSON.parse(raw);
    return {
      totalTokens: Number(parsed.totalTokens) || 0,
      tipCount: Number(parsed.tipCount) || 0,
      largestTokens: Number(parsed.largestTokens) || 0,
      largestName: String(parsed.largestName || "")
    };
  } catch (err) {
    return { totalTokens: 0, tipCount: 0, largestTokens: 0, largestName: "" };
  }
}

var tokens = Math.max(0, Math.floor(Number($tip.tokens) || 0));
var isAnonymous = !!$tip.isAnon;
var username = isAnonymous ? "Anonymous supporter" :
  String($user.username || "A brotherhood supporter").replace(/[^a-zA-Z0-9_\-]/g, "").slice(0, 25);

if (tokens > 0) {
  var stats = readTipStats();
  stats.totalTokens += tokens;
  stats.tipCount += 1;

  if (tokens > stats.largestTokens) {
    stats.largestTokens = tokens;
    stats.largestName = isAnonymous ? "Anonymous supporter" : username;
  }

  $kv.set(TIP_STATS_KEY, JSON.stringify(stats));

  var ackIdentity = isAnonymous ? "anonymous" : username.toLowerCase();
  var ackKey = TIP_ACK_PREFIX + ackIdentity;
  var lastAck = Number($kv.get(ackKey, "0")) || 0;
  var nowSeconds = Math.floor(Date.now() / 1000);

  if (LBC.getSetting("tipAcknowledgmentEnabled", true) !== false && nowSeconds - lastAck >= ACK_COOLDOWN_SECONDS) {
    $kv.set(ackKey, String(nowSeconds), ACK_COOLDOWN_SECONDS);
    $room.sendNotice(
      "🖤 " + (isAnonymous ? "A mystery supporter" : username) +
      " threw " + tokens + " tokens into the brotherhood. Much appreciated. No game advantage attached."
    );
  }
}

// M2.2 modular extension: aggregate totals are already updated above.
LBC.processRoomGoalTip($tip.tokens);

// Permanent VIP records only direct tips received in this room.
if (LBC.vip && !$tip.isAnon) {
  var vipEventId = $tip.id || $tip.eventId || $tip.event_id || "";
  LBC.vip.recordTip($user.username, $tip.tokens, vipEventId);
}
