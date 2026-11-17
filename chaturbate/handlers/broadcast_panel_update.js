// LOST BOYS CLUB — Broadcast Panel Update
// Native below-camera panel for Chaturbate App V2.

var panel = LBC.panelData();
var gameActive = panel.active === true;
var leader = panel.leader || "No champion yet";
var rounds = Number(panel.rounds) || 0;

var goal = null;
var stats = null;
try {
  goal = JSON.parse($kv.get("lbc_m2_room_goal", "null"));
  stats = JSON.parse($kv.get("lbc_m2_tip_stats", "{}"));
} catch (err) {
  goal = null;
  stats = null;
}

var row2Label = gameActive ? "GAME STATUS" : "STATUS";
var row2Value = gameActive ? (panel.gameStatus || "Round live. Type !guess 1-100.") : "CLUBHOUSE OPEN";

if (goal && Number(goal.target) > 0) {
  var total = Number(stats && stats.totalTokens) || 0;
  var progress = Math.max(0, total - (Number(goal.startTotal) || 0));
  var percent = Math.min(100, Math.floor(progress / Number(goal.target) * 100));
  row2Label = "ROOM GOAL";
  row2Value = (goal.active ? "" : (goal.completed ? "REACHED · " : "PAUSED · ")) +
    Math.min(progress, Number(goal.target)) + "/" + Number(goal.target) + " TOKENS · " + percent + "%";
}

$room.setPanelTemplate({
  template: "3_rows_of_labels",
  row1_label: "LOST BOYS CLUB",
  row1_value: gameActive ? "GUESS THE NUMBER — LIVE" : "CLUBHOUSE OPEN",
  row2_label: row2Label,
  row2_value: row2Value,
  row3_label: "CLUB RECORD",
  row3_value: leader + " · " + rounds + (rounds === 1 ? " round" : " rounds")
});
