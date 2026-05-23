import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import pigCommandCompiler from "../dist/src/index.js";

process.env.PIG_COMMAND_COMPILER_EMBEDDINGS = "0";

const logDir = await mkdtemp(path.join(os.tmpdir(), "pcc-diagnostics-"));
process.env.PIG_COMMAND_COMPILER_LOG_DIR = logDir;

const handlers = new Map();
const commands = new Map();
const notifications = [];
const statuses = new Map();
const sentUserMessages = [];

const fakePi = {
  on(event, handler) {
    handlers.set(event, handler);
  },
  registerCommand(name, options) {
    commands.set(name, options);
  },
  sendUserMessage(content, options) {
    sentUserMessages.push({ content, options });
  },
};

pigCommandCompiler(fakePi);

assert.ok(handlers.has("input"), "extension should register an input handler");
assert.ok(commands.has("compiler-route"), "extension should register /compiler-route");
assert.ok(commands.has("compiler-debug-info"), "extension should register /compiler-debug-info");

const ctx = {
  cwd: process.cwd(),
  ui: {
    notify(message, type) {
      notifications.push({ message, type });
    },
    setStatus(key, text) {
      statuses.set(key, text);
    },
    theme: {
      fg(_name, text) {
        return text;
      },
    },
  },
};

const debugInfo = await commands.get("compiler-debug-info").handler("", ctx);
assert.equal(debugInfo, undefined, "debug info command should not print into the conversation");
assert.match(statuses.get("pig-command-compiler"), /log .*pig-command-compiler\.jsonl/);
assert.match(statuses.get("pig-command-compiler"), /sessions .*\.pig\/agent\/sessions/);

const route = await commands.get("compiler-route").handler("weather today", ctx);
assert.equal(route, undefined, "route command should not print debug info into the conversation");
assert.match(statuses.get("pig-command-compiler"), /direct_exec|pig_skill|continue/);
assert.ok(sentUserMessages.length >= 1, "route command should send a normal user message turn");
assert.match(sentUserMessages.at(-1).content, /^\/skill:weather weather today$/, "route command should hand direct exec off to the normal skill path");
assert.doesNotMatch(sentUserMessages.at(-1).content, /debug log:|pig-command-compiler|handled weather/, "model input must not contain footer-only debug info");
assert.equal(notifications.length, 0, "diagnostics should use footer status, not notifications");

const inputResult = await handlers.get("input")({ text: "weather today", images: [] }, { cwd: process.cwd() });
assert.ok(["transform", "continue"].includes(inputResult.action), "input handler should return a Pig action");
if (inputResult.action === "transform") {
  assert.match(inputResult.text, /^\/skill:weather weather today$/, "normal input should display as skill invocation + original transcript after Pig expands it");
  assert.doesNotMatch(inputResult.text, /pig-command-compiler|handled weather/, "normal input transform should not contain PCC debug/result prose");
}

const logPath = path.join(logDir, "pig-command-compiler.jsonl");
const lines = (await readFile(logPath, "utf8")).trim().split("\n").map((line) => JSON.parse(line));
assert.ok(lines.some((line) => line.event === "compiler_debug_info"), "debug info command should append a log event");
assert.ok(lines.some((line) => line.event === "compiler_route"), "compiler route command should append a log event");
assert.ok(lines.some((line) => line.event === "input_decision"), "input handler should append a decision log event");
assert.ok(lines.every((line) => line.pid && line.ts), "all log entries should include pid and timestamp");

await rm(logDir, { recursive: true, force: true });
console.log("diagnostics smoke test passed");
