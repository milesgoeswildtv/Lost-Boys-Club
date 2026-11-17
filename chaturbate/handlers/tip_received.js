// LOST BOYS CLUB — Tip Received
// M2: persistent clubhouse tip stats + restrained thank-you notices.
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
  String($user.username || "A club supporter").replace(/[^a-zA-Z0-9_\-]/g, "").slice(0, 25);

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

  if (nowSeconds - lastAck >= ACK_COOLDOWN_SECONDS) {
    $kv.set(ackKey, String(nowSeconds), ACK_COOLDOWN_SECONDS);
    $room.sendNotice(
      "🖤 " + (isAnonymous ? "A mystery supporter" : username) +
      " threw " + tokens + " tokens into the clubhouse. Much appreciated. No game advantage attached."
    );
  }
}
