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

if (body === "!clubgoal") {
  var goal = null;
  var currentTotal = 0;
  try {
    goal = JSON.parse($kv.get("lbc_m2_room_goal", "null"));
    var goalStats = JSON.parse($kv.get("lbc_m2_tip_stats", "{}"));
    currentTotal = Number(goalStats.totalTokens) || 0;
  } catch (err) {
    goal = null;
  }

  if (goal && Number(goal.target) > 0) {
    var progress = Math.max(0, currentTotal - (Number(goal.startTotal) || 0));
    var percent = Math.min(100, Math.floor(progress / Number(goal.target) * 100));
    $room.sendNotice(
      "🏚️ LOST BOYS CLUB — ROOM GOAL\n" +
      (goal.active ? "Progress: " : "Last goal: ") +
      Math.min(progress, Number(goal.target)) + " / " + Number(goal.target) +
      " tokens (" + percent + "%)" +
      (goal.active ? "\nVoluntary support only. No perks or game advantage." : (goal.completed ? "\nGoal reached. Thanks, troublemakers." : "\nGoal is not currently active."))
    );
  } else {
    $room.sendNotice("No room goal is set right now. The clubhouse is financially irresponsible but emotionally available.");
  }
}

var goalCommandChanged = false;
if ($user.isOwner && body.indexOf("/lbc goal ") === 0) {
  var goalValue = body.slice(10).trim();
  if (goalValue === "off") {
    $kv.set("lbc_m2_room_goal", JSON.stringify({ target: 0, startTotal: 0, active: false, completed: false, milestones: {} }));
    $room.sendNotice("Room goal switched off. The clubhouse returns to its regularly scheduled nonsense.");
    goalCommandChanged = true;
  } else if (/^\d{1,7}$/.test(goalValue) && Number(goalValue) > 0) {
    var target = Number(goalValue);
    var baseline = 0;
    try {
      var baselineStats = JSON.parse($kv.get("lbc_m2_tip_stats", "{}"));
      baseline = Number(baselineStats.totalTokens) || 0;
    } catch (err) {
      baseline = 0;
    }
    $kv.set("lbc_m2_room_goal", JSON.stringify({
      target: target,
      startTotal: baseline,
      active: true,
      completed: false,
      milestones: {}
    }));
    $room.sendNotice("🏚️ New clubhouse goal set: " + target + " tokens. Progress starts now. Support is voluntary; nothing is locked behind it.");
    goalCommandChanged = true;
  } else {
    $room.sendNotice("Use /lbc goal 500 to set a goal, or /lbc goal off to turn it off.");
  }
}

// Refresh the native panel only when displayed state can change.
if (goalCommandChanged || /^\s*(\/lbc\s+(start|stop)|!guess\s+\d{1,3})\s*$/i.test(rawBody)) {
  $room.reloadPanel();
}
