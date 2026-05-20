import type { CommandIR } from "./ir.js";
import type { PigCommandState } from "./state.js";

export interface ResolvedCommand {
  ir: CommandIR;
  refs: PigCommandState;
}

export function resolveCommand(ir: CommandIR, state: PigCommandState): ResolvedCommand {
  return { ir, refs: { ...state } };
}
