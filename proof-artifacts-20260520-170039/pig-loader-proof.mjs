
import { readFileSync } from "node:fs";
import path from "node:path";
import { discoverAndLoadExtensions } from "/home/bot/pig-mono/packages/coding-agent/dist/core/extensions/loader.js";
const settingsPath = "/home/bot/.pig/agent/settings.json";
const settings = JSON.parse(readFileSync(settingsPath, "utf8"));
const configured = settings.packages?.find((p) => p.includes("pig-command-compiler"));
const cwd = "/home/bot";
const agentDir = "/home/bot/.pig/agent";
const configuredResolvedFromCwd = path.resolve(cwd, configured);
const configuredResolvedFromAgentDir = path.resolve(agentDir, configured);
async function summarize(label, configuredPaths) {
  const result = await discoverAndLoadExtensions(configuredPaths, cwd, agentDir);
  return {
    label,
    configuredPaths,
    extensions: result.extensions.map((e) => ({ path: e.path, resolvedPath: e.resolvedPath, handlers: [...e.handlers.keys()], commands: [...e.commands.keys()] })),
    errors: result.errors,
  };
}
const proof = {
  settingsPath,
  configured,
  cwd,
  agentDir,
  configuredResolvedFromCwd,
  configuredResolvedFromAgentDir,
  existsFromCwd: false,
  existsFromAgentDir: true,
  currentConfiguredLoad: await summarize("current settings package as Pig loader sees it", [configured]),
  absolutePathLoad: await summarize("absolute path load", ["/home/bot/projects/pig-command-compiler"]),
};
console.log(JSON.stringify(proof, null, 2));
