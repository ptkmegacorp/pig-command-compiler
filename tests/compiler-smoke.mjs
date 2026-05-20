import assert from "node:assert/strict";
import { compileInput } from "../dist/src/compiler/compiler.js";
import { collectDirectExecActions, loadSkillCatalog } from "../dist/src/metadata/loadSkillMetadata.js";
import { discoverSkillPaths } from "../dist/src/runtime/resources.js";

const catalog = await loadSkillCatalog(discoverSkillPaths(process.cwd()));
const resources = {
  catalog,
  actions: collectDirectExecActions(catalog),
  state: {
    activeDisplay: ":0",
    defaultLocation: "Jim Falls, WI",
    recentScreenshotPath: "/tmp/example-screenshot.png",
  },
};

for (const [text, expected] of [
  ["take screenshot", ["direct_exec", "screen", "capture"]],
  ["show last screenshot", ["direct_exec", "screen", "show"]],
  ["weather today", ["direct_exec", "weather", "lookup"]],
]) {
  const decision = await compileInput(text, resources);
  assert.equal(decision.mode, expected[0], `${text}: ${decision.reason}`);
  assert.equal(decision.command?.domain, expected[1]);
  assert.equal(decision.command?.action, expected[2]);
}

const missing = await compileInput("show last screenshot", { ...resources, state: { activeDisplay: ":0" } });
assert.equal(missing.mode, "normal");
assert.match(missing.reason, /recent_screenshot_path/);

const casual = await compileInput("whats going on", resources);
assert.equal(casual.mode, "normal");

console.log("compiler smoke tests passed");
