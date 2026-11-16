// LOST BOYS CLUB — Broadcast Panel Update
// Native below-camera panel for Chaturbate App V2.
// Requires the exclusive "Broadcast panel" permission.

var panel = LBC.panelData();

$room.setPanelTemplate({
  template: "3_rows_of_labels",
  row1_label: "LOST BOYS CLUB",
  row1_value: panel.active ? "GUESS THE NUMBER — LIVE" : "CLUBHOUSE OPEN",
  row2_label: panel.active ? "PLAYERS" : "STATUS",
  row2_value: panel.active ? panel.gameStatus : "No game running. Questionable decisions.",
  row3_label: "CLUB RECORD",
  row3_value: panel.leader + " · " + panel.rounds + " rounds"
});
