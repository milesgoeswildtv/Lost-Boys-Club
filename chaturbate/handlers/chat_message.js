// LOST BOYS CLUB — Chat Message
LBC.onChatMessage($message.body, $user.username, $user.isOwner);

// Refresh the native panel only for commands that can change game state.
if (/^\s*(\/lbc\s+(start|stop)|!guess\s+\d{1,3})\s*$/i.test(String($message.body || ""))) {
  $room.reloadPanel();
}
