
import path from "node:path";
import { readFile } from "node:fs/promises";
import pigCommandCompiler from "/home/bot/projects/pig-command-compiler/dist/src/index.js";
process.env.PIG_COMMAND_COMPILER_EMBEDDINGS = "0";
process.env.PIG_COMMAND_COMPILER_LOG_DIR = "/home/bot/projects/pig-command-compiler/proof-artifacts-20260520-170039/diagnostics-log";
const handlers = new Map();
const commands = new Map();
const notifications = [];
const fakePi = {
  on(event, handler) { handlers.set(event, handler); },
  registerCommand(name, options) { commands.set(name, options); },
};
pigCommandCompiler(fakePi);
const ctx = { cwd: "/home/bot/projects/pig-command-compiler", ui: { notify(message, type) { notifications.push({ message, type }); } } };
const debugInfo = await commands.get("compiler-debug-info").handler("", ctx);
const route = await commands.get("compiler-route").handler("weather today", ctx);
const inputResult = await handlers.get("input")({ text: "weather today", images: [] }, { cwd: "/home/bot/projects/pig-command-compiler" });
const logPath = path.join(process.env.PIG_COMMAND_COMPILER_LOG_DIR, "pig-command-compiler.jsonl");
const log = await readFile(logPath, "utf8");
console.log(JSON.stringify({ registered: { events: [...handlers.keys()], commands: [...commands.keys()] }, debugInfo, route, inputResult, notifications, logPath, logLines: log.trim().split("\n").map(JSON.parse) }, null, 2));
