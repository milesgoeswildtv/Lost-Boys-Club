// LOST BOYS CLUB — Callback
LBC.onCallback($callback.label);

// A callback may end a timed round; refresh the native panel afterward.
$room.reloadPanel();

// M2.4: process only the currently scheduled announcement callback.
LBC.onAnnouncementsCallback($callback.label);
