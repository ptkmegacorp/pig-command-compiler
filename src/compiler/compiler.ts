import type { DirectExecAction, SkillCatalogEntry } from "../metadata/schema.js";
import type { PigCommandState } from "./state.js";
import type { CommandIR } from "./ir.js";
import type { DirectExecCandidate, ResolvedSkill } from "./lower.js";
import { lowerCommand } from "./lower.js";
import { checkPreconditions } from "./preconditions.js";
import { resolveCommand } from "./resolve.js";
import { typecheckCommand } from "./typecheck.js";
import { addTrace, createTrace, type CompilerTrace } from "./trace.js";
import { DEFAULT_EXTRACTOR_STACK, runExtractorStack, type CommandExtractor } from "./extractors.js";
import { validateDirectExecAction } from "../runtime/safety.js";

export interface CompilerResources {
  catalog: SkillCatalogEntry[];
  actions: DirectExecAction[];
  state: PigCommandState;
}

export interface CompilerDecision {
  handled: boolean;
  mode: "direct_exec" | "pig_skill" | "normal";
  command: CommandIR | null;
  directExec: DirectExecCandidate | null;
  skill: ResolvedSkill | null;
  confidence: number;
  reason: string;
  trace: CompilerTrace;
}

export function shouldCompile(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("/")) return false;
  if (trimmed.startsWith("<skill ")) return false;
  return true;
}

function normal(trace: CompilerTrace, reason: string, command: CommandIR | null = null): CompilerDecision {
  addTrace(trace, "decision", false, reason);
  return { handled: false, mode: "normal", command, directExec: null, skill: null, confidence: command?.confidence ?? 0, reason, trace };
}

export async function compileInput(
  text: string,
  resources: CompilerResources,
  extractors: CommandExtractor[] = DEFAULT_EXTRACTOR_STACK,
): Promise<CompilerDecision> {
  const trace = createTrace(text);
  if (!shouldCompile(text)) return normal(trace, "input is not compilable");

  const candidates = await runExtractorStack(text, resources, extractors);
  trace.candidates = candidates;
  addTrace(trace, "extract", candidates.length > 0, `produced ${candidates.length} candidates`);
  const selected = candidates.find((candidate) => candidate.ir.kind === "command");
  if (!selected || selected.ir.kind !== "command") return normal(trace, "no command candidate selected");
  trace.selected = selected;

  const command = selected.ir;
  addTrace(trace, "select", true, selected.reason, selected);

  const typecheck = typecheckCommand(command);
  addTrace(trace, "typecheck", typecheck.ok, typecheck.reason);
  if (!typecheck.ok) return normal(trace, typecheck.reason, command);

  const resolved = resolveCommand(command, resources.state);
  addTrace(trace, "resolve", true, "resolved state references", resolved.refs);

  const lowering = lowerCommand(resolved.ir, resources.catalog, resources.actions);
  addTrace(trace, "lower", lowering.ok, lowering.reason, lowering);
  if (!lowering.ok) return normal(trace, lowering.reason, command);

  if (lowering.mode === "direct_exec") {
    const preconditions = checkPreconditions(lowering.directExec.requiredContext, resources.state);
    addTrace(trace, "preconditions", preconditions.ok, preconditions.reason, preconditions.missing);
    if (!preconditions.ok) return normal(trace, preconditions.reason, command);

    const safety = validateDirectExecAction(lowering.directExec.action);
    addTrace(trace, "safety", safety.ok, safety.reason);
    if (!safety.ok) return normal(trace, safety.reason, command);

    return {
      handled: true,
      mode: "direct_exec",
      command,
      directExec: lowering.directExec,
      skill: null,
      confidence: command.confidence,
      reason: lowering.reason,
      trace,
    };
  }

  return {
    handled: true,
    mode: "pig_skill",
    command,
    directExec: null,
    skill: lowering.skill,
    confidence: command.confidence,
    reason: lowering.reason,
    trace,
  };
}
