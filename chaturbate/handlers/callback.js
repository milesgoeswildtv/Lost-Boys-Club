// LOST BOYS CLUB — Callback
LBC.onCallback($callback.label);

// A callback may end a timed round; refresh the native panel afterward.
$room.reloadPanel();

// M2.4: process only the currently scheduled announcement callback.
LBC.onAnnouncementsCallback($callback.label);

// M3.1: finish only the active Higher or Lower round callback.
LBC.onHigherLowerCallback($callback.label);


// M3.2: finish only the currently scheduled Couple Trivia round.
LBC.onCoupleTriviaCallback($callback.label);
