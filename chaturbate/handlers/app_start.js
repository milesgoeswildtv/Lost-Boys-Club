// LOST BOYS CLUB — App Start
// Shared Code is executed before this handler.
var state = $kv.get("lbc_v1_game", "");
if (!state) {
  $kv.set("lbc_v1_game", JSON.stringify({ type: "idle", active: false, secret: null, guesses: {}, startedAt: 0, endsAt: 0 }));
}
$room.sendNotice("🖤 LOST BOYS CLUB clubhouse manager online. No map. No supervision. Questionable decisions.", { toUsername: $room.owner });
