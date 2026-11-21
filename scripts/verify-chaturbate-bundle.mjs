#!/usr/bin/env node
/**
 * Static release gate for the Chaturbate App V2 upload bundle.
 * Run from repository root: node scripts/verify-chaturbate-bundle.mjs
 */
import fs from "node:fs";
import path from "node:path";

const required = [
  "chaturbate/shared_code.js",
  "chaturbate/advanced_settings.json",
  "chaturbate/handlers/chat_message.js",
  "chaturbate/handlers/callback.js",
  "chaturbate/handlers/app_start.js",
  "chaturbate/handlers/app_stop.js",
  "chaturbate/handlers/broadcast_panel_update.js",
  "chaturbate/handlers/tip_received.js",
  "chaturbate/handlers/user_enter.js",
  "chaturbate/handlers/user_exit.js",
  "overlay/index.html",
  "overlay/overlay.js",
  "overlay/styles.css",
  "relay/worker.js",
  "relay/wrangler.toml"
];

const failures = [];
const read = (file) => fs.readFileSync(path.resolve(file), "utf8");

for (const file of required) {
  if (!fs.existsSync(path.resolve(file))) failures.push("Missing required upload file: " + file);
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

for (const file of required.filter((item) => item.endsWith(".js") && item !== "relay/worker.js")) {
  try {
    new Function(read(file));
    console.log("PASS syntax: " + file);
  } catch (error) {
    failures.push("JavaScript syntax failed: " + file + " — " + error.message);
  }
}

try {
  const settings = JSON.parse(read("chaturbate/advanced_settings.json"));
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) throw new Error("Advanced Settings root must be an object of fieldsets.");
  console.log("PASS JSON: chaturbate/advanced_settings.json (" + Object.keys(settings).length + " top-level groups)");
} catch (error) {
  failures.push("Advanced Settings JSON failed: " + error.message);
}

const shared = read("chaturbate/shared_code.js");
const chat = read("chaturbate/handlers/chat_message.js");
const overlayHtml = read("overlay/index.html");
const overlayJs = read("overlay/overlay.js");
const relay = read("relay/worker.js");
const checks = [
  [shared.includes("LBC.onChatMessage"), "Shared Code exposes the central chat dispatcher"],
  [shared.includes("LBC.onCallback"), "Shared Code exposes the callback dispatcher"],
  [chat.includes("LBC.onChatMessage($message.body"), "Chat Message handler invokes the central dispatcher"],
  [shared.includes('10:"/ab higher start"') && shared.includes('11:"/ab trivia start"'), "Games menu exposes Higher or Lower and Couple Trivia"],
  [shared.includes('"/ab higher stop"') && shared.includes('"/ab trivia stop"'), "Games menu stop routing includes Higher or Lower and Couple Trivia"],
  [overlayHtml.includes("./overlay.js") && overlayHtml.includes("./styles.css"), "Overlay page loads its stylesheet and renderer"],
  [overlayJs.includes("new WebSocket(url)") && overlayJs.includes('get("demo") === "1"'), "Overlay supports authenticated WebSocket and local demo mode"],
  [relay.includes("CB_EVENTS_URL") && relay.includes("OVERLAY_TOKEN") && relay.includes("acceptWebSocket"), "Relay keeps feed credentials server-side and authenticates OBS WebSocket clients"]
];
for (const [ok, label] of checks) {
  if (ok) console.log("PASS contract: " + label);
  else failures.push("Missing contract: " + label);
}

if (failures.length) {
  console.error("\nFAILED\n" + failures.join("\n"));
  process.exit(1);
}
console.log("\nPASS: static Chaturbate + overlay source checks complete.");
console.log("NOTE: This does not verify Developer Portal uploads, Testbed behavior, or live-room operation.");
