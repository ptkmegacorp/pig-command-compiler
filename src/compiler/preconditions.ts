import type { PigCommandState } from "./state.js";
import { contextValue } from "./state.js";

export interface PreconditionsResult {
  ok: boolean;
  missing: string[];
  reason: string;
}

export function checkPreconditions(requiredContext: string[], state: PigCommandState): PreconditionsResult {
  const missing = [...new Set(requiredContext)].filter((key) => !contextValue(state, key));
  return {
    ok: missing.length === 0,
    missing,
    reason: missing.length === 0 ? "all preconditions satisfied" : `missing context: ${missing.join(", ")}`,
  };
}
