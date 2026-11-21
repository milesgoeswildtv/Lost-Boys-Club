import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("./worker.js", import.meta.url), "utf8");
const moduleUrl = "data:text/javascript;base64," + Buffer.from(source).toString("base64");
const { normalizeChaturbateEvent } = await import(moduleUrl);

const event = (method, object) => ({ method, object });
const chat = (message, username = "TestViewer") =>
  event("chatMessage", { user: { username }, message: { message } });

assert.equal(normalizeChaturbateEvent(null), null);
assert.equal(normalizeChaturbateEvent(event("unknown", {})), null);

const tip = normalizeChaturbateEvent(event("tip", {
  user: { username: "Supporter" }, tip: { tokens: 55, isAnon: false }
}));
assert.equal(tip.type, "tip");
assert.match(tip.data.title, /SUPPORTER/i);
assert.match(tip.data.message, /55 TOKENS/);

const anonTip = normalizeChaturbateEvent(event("tip", {
  user: { username: "Secret" }, tip: { tokens: 20, isAnon: true }
}));
assert.doesNotMatch(anonTip.data.title, /SECRET/i);

assert.equal(normalizeChaturbateEvent(event("userEnter", { user: { username: "Arrival" } })).type, "viewer");
assert.equal(normalizeChaturbateEvent(event("userLeave", { user: { username: "Exit" } })).type, "notification");
assert.equal(normalizeChaturbateEvent(event("follow", { user: { username: "Follower" } })).type, "notification");
assert.equal(normalizeChaturbateEvent(event("fanclubJoin", { user: { username: "Member" } })).type, "vip");
assert.equal(normalizeChaturbateEvent(event("mediaPurchase", { user: { username: "Buyer" }, media: { type: "photo" } })).type, "notification");
assert.equal(normalizeChaturbateEvent(event("broadcastStart", {})).data.status, "LIVE FROM AFTERDARK");
assert.equal(normalizeChaturbateEvent(event("broadcastStop", {})).data.status, "BROADCAST ENDED");
assert.equal(normalizeChaturbateEvent(event("roomSubjectChange", { subject: "Afterdark: open" })).data.mode, "Afterdark: open");

const commands = [
  ["!code 4821", "CODEBREAKER"],
  ["!word afterdark", "WORD SCRAMBLE"],
  ["!a", "DIRTY WOULD YOU RATHER"],
  ["!b", "DIRTY WOULD YOU RATHER"],
  ["!position missionary", "POSITION IMPOSSIBLE"],
  ["!charade answer", "DIRTY CHARADES"],
  ["!addword chaos", "ONE WORD STORY"],
  ["!dareanswer absolutely", "AFTERDARK DARE DECK"],
  ["!caption this is chaos", "CAPTION CLASH"],
  ["!guess 42", "GUESS THE NUMBER"],
  ["!answer correct", "COUPLE TRIVIA"],
  ["!higher", "HIGHER OR LOWER"],
  ["!lower", "HIGHER OR LOWER"]
];
for (const [message, game] of commands) {
  const result = normalizeChaturbateEvent(chat(message));
  assert.equal(result.type, "notification", message);
  assert.equal(result.data.eyebrow, game, message);
  const submittedText = message.includes(" ") ? message.slice(message.indexOf(" ") + 1) : "";
  if (submittedText) {
    const publicCopy = (result.data.title + " " + result.data.message).toLowerCase();
    assert.equal(publicCopy.includes(submittedText.toLowerCase()), false,
      "viewer-submitted answer text must not be echoed to the overlay");
  }
}
assert.equal(normalizeChaturbateEvent(chat("!code 12")), null);
assert.equal(normalizeChaturbateEvent(chat("hello everyone")), null);
console.log("AFTERDARK relay normalization: PASS (13 game submission command variants + room events)");
