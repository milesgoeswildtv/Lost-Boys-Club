// LOST BOYS CLUB — Tip Received
// M2: persistent support stats, throttled acknowledgements, and optional room-goal milestones.
// Every tip is counted. Tips never grant game advantages or access.

var TIP_STATS_KEY = "lbc_m2_tip_stats";
var TIP_ACK_PREFIX = "lbc_m2_tip_ack_";
var ROOM_GOAL_KEY = "lbc_m2_room_goal";
var ACK_COOLDOWN_SECONDS = 45;

function readJson(key, fallback) {
  try {
    var raw = $kv.get(key, "");
    return raw ? JSON.parse(raw) : fallback;
  } catch (err) {
    return fallback;
  }
}

var stats = readJson(TIP_STATS_KEY, {
  totalTokens: 0,
  tipCount: 0,
  largestTokens: 0,
  largestName: ""
});
stats.totalTokens = Number(stats.totalTokens) || 0;
stats.tipCount = Number(stats.tipCount) || 0;
stats.largestTokens = Number(stats.largestTokens) || 0;
stats.largestName = String(stats.largestName || "");

var tokens = Math.max(0, Math.floor(Number($tip.tokens) || 0));
var isAnonymous = !!$tip.isAnon;
var username = isAnonymous ? "Anonymous supporter" :
  String($user.username || "A club supporter").replace(/[^a-zA-Z0-9_\-]/g, "").slice(0, 25);

if (tokens > 0) {
  stats.totalTokens += tokens;
  stats.tipCount += 1;

  if (tokens > stats.largestTokens) {
    stats.largestTokens = tokens;
    stats.largestName = isAnonymous ? "Anonymous supporter" : username;
  }

  $kv.set(TIP_STATS_KEY, JSON.stringify(stats));

  // Milestones are announced once per configured goal: 25%, 50%, 75%, and 100%.
  var goal = readJson(ROOM_GOAL_KEY, null);
  if (goal && goal.active === true && Number(goal.target) > 0) {
    var progress = Math.max(0, stats.totalTokens - (Number(goal.startTotal) || 0));
    var percent = Math.floor(progress / Number(goal.target) * 100);
    var milestones = goal.milestones && typeof goal.milestones === "object" ? goal.milestones : {};
    [25, 50, 75, 100].forEach(function (mark) {
      if (percent >= mark && !milestones[String(mark)]) {
        milestones[String(mark)] = true;
        $room.sendNotice(
          mark === 100
            ? "🏁 CLUBHOUSE GOAL REACHED. " + Number(goal.target) + " tokens. You beautiful bunch of questionable decisions. Thank you."
            : "🏚️ Clubhouse goal update: " + mark + "% reached. " +
              Math.min(progress, Number(goal.target)) + " / " + Number(goal.target) +
              " tokens. Voluntary support, always."
        );
      }
    });
    goal.milestones = milestones;
    if (percent >= 100) {
      goal.active = false;
      goal.completed = true;
    }
    $kv.set(ROOM_GOAL_KEY, JSON.stringify(goal));
    $room.reloadPanel();
  }

  // Acknowledge each supporter at most once every 45 seconds, without suppressing accounting.
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
