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
