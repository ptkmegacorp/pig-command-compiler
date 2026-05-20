import assert from "node:assert/strict";
import { transformersEmbeddingExtractor } from "../dist/src/compiler/transformersEmbeddingExtractor.js";
import { buildCompilerResources } from "../dist/src/runtime/resources.js";

const resources = await buildCompilerResources(process.cwd(), {
  activeDisplay: ":0",
  defaultLocation: "Jim Falls, WI",
  recentScreenshotPath: "/tmp/example-screenshot.png",
});

const candidates = await transformersEmbeddingExtractor.extract("please visually check what is displayed", resources);
assert.ok(candidates.length > 0, "expected at least one semantic candidate");
assert.equal(candidates[0].extractor, "transformers-embedding");
assert.equal(candidates[0].ir.kind, "command");
assert.equal(candidates[0].ir.domain, "screen");
assert.equal(candidates[0].ir.action, "inspect");

console.log("embedding smoke test passed", candidates[0].reason);
