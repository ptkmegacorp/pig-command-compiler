import path from "node:path";
import type { DirectExecAction, SafetyClass } from "../metadata/schema.js";

export const ALLOWED_SAFETY_CLASSES: ReadonlySet<string> = new Set<SafetyClass>([
  "read_only_local",
  "read_only_network",
  "local_capture",
]);

export interface SafetyResult {
  ok: boolean;
  reason: string;
  scriptPath?: string;
}

export function validateDirectExecAction(action: DirectExecAction): SafetyResult {
  if (!action.directExec) return { ok: false, reason: "action did not opt into directExec" };
  if (action.requiresConfirmation) return { ok: false, reason: "confirmation-requiring actions are not direct executable" };
  if (!ALLOWED_SAFETY_CLASSES.has(action.safety)) return { ok: false, reason: `unsafe safety class ${action.safety}` };
  if (path.isAbsolute(action.script)) return { ok: false, reason: "script path must be relative" };
  const scriptPath = path.resolve(action.skillDir, action.script);
  const scriptsDir = path.resolve(action.skillDir, "scripts") + path.sep;
  if (!scriptPath.startsWith(scriptsDir)) return { ok: false, reason: "script must live under skill scripts/" };
  return { ok: true, reason: "direct exec action is safe", scriptPath };
}
