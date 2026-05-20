import type { DirectExecAction, SkillCatalogEntry } from "../metadata/schema.js";
import type { PigCommandState } from "./state.js";
import type { CommandIR } from "./ir.js";
import type { DirectExecCandidate, ResolvedSkill } from "./lower.js";
import { lowerCommand } from "./lower.js";
import { checkPreconditions } from "./preconditions.js";
import { resolveCommand } from "./resolve.js";
import { typecheckCommand } from "./typecheck.js";
import { addTrace, createTrace, type CompilerTrace } from "./trace.js";
import { DEFAULT_EXTRACTOR_STACK, runExtractorStack, type CandidateEvidence, type CommandExtractor, type CommandIRCandidate } from "./extractors.js";
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

function evidenceIsSufficient(candidate: CommandIRCandidate): { ok: boolean; reason: string; evidence?: CandidateEvidence } {
  if (candidate.extractor === "rules") return { ok: true, reason: "rules evidence accepted", evidence: candidate.evidence };

  const evidence = candidate.evidence;
  if (!evidence) {
    return candidate.ir.confidence >= 0.9
      ? { ok: true, reason: "high-confidence candidate without structured evidence" }
      : { ok: false, reason: "candidate lacks structured evidence" };
  }

  if (evidence.kind === "metadata") {
    if (evidence.exactExample) return { ok: true, reason: "metadata exact example evidence", evidence };
    if (evidence.exactKeywordPhrase) return { ok: true, reason: "metadata exact keyword phrase evidence", evidence };
    if (evidence.anchorMatches?.length && evidence.actionCueMatches?.length && evidence.score >= 0.62) {
      return { ok: true, reason: "metadata anchor plus action-cue evidence", evidence };
    }
    return { ok: false, reason: "metadata evidence lacks exact phrase or anchor+action cue", evidence };
  }

  if (evidence.kind === "semantic") {
    if (evidence.score < 0.58) return { ok: false, reason: "semantic evidence below threshold", evidence };
    if ((evidence.tokenMatches?.length ?? 0) < 2) {
      return { ok: false, reason: "semantic evidence too short to disambiguate", evidence };
    }
    return { ok: true, reason: "semantic evidence accepted", evidence };
  }

  return { ok: true, reason: "candidate evidence accepted", evidence };
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

  const evidence = evidenceIsSufficient(selected);
  addTrace(trace, "evidence", evidence.ok, evidence.reason, evidence.evidence);
  if (!evidence.ok) return normal(trace, evidence.reason, command);

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
