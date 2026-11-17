// LOST BOYS CLUB — Broadcast Panel Update
// Native below-camera panel for Chaturbate App V2.
// Compatible with the existing Shared Code; no Shared Code replacement required.

var panel = LBC.panelData();
var game = panel.game;
var gameActive = panel.active === true ||
  (game && typeof game === "object" && game.active === true) ||
  game === "guess_number";

var status = panel.gameStatus ||
  (gameActive ? "Round live. Type !guess 1-100." :
    (typeof game === "string" && game !== "idle" ? game : "No game running. Questionable decisions."));

var leader = panel.leader || "No champion yet";
var rounds = Number(panel.rounds) || 0;

$room.setPanelTemplate({
  template: "3_rows_of_labels",
  row1_label: "LOST BOYS CLUB",
  row1_value: gameActive ? "GUESS THE NUMBER — LIVE" : "CLUBHOUSE OPEN",
  row2_label: gameActive ? "GAME STATUS" : "STATUS",
  row2_value: status,
  row3_label: "CLUB RECORD",
  row3_value: leader + " · " + rounds + (rounds === 1 ? " round" : " rounds")
});

// M2.2 modular extension: override row two only when a room goal exists.
LBC.updateGoalPanel();
