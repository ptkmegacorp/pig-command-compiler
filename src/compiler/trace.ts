import type { CommandIRCandidate } from "./extractors.js";

export interface CompilerTraceStep {
  stage: string;
  ok: boolean;
  message: string;
  data?: unknown;
}

export interface CompilerTrace {
  input: string;
  candidates: CommandIRCandidate[];
  selected?: CommandIRCandidate;
  steps: CompilerTraceStep[];
}

export function createTrace(input: string): CompilerTrace {
  return { input, candidates: [], steps: [] };
}

export function addTrace(trace: CompilerTrace, stage: string, ok: boolean, message: string, data?: unknown): void {
  trace.steps.push({ stage, ok, message, data });
}
