import type { CommandIR } from "./ir.js";
import type { DirectExecAction, LoweringMetadata, MatchSpec, SkillCatalogEntry } from "../metadata/schema.js";

export interface DirectExecCandidate {
  action: DirectExecAction;
  requiredContext: string[];
  reason: string;
}

export interface ResolvedSkill {
  name: string;
  skillPath?: string;
  reason: string;
}

export type LoweringResult =
  | { ok: true; mode: "direct_exec"; directExec: DirectExecCandidate; skill: null; reason: string }
  | { ok: true; mode: "pig_skill"; directExec: null; skill: ResolvedSkill; reason: string }
  | { ok: false; mode: "normal"; directExec: null; skill: null; reason: string };

function oneOf<T extends string>(actual: T | undefined, expected: T | T[] | undefined): boolean {
  if (expected === undefined) return true;
  if (actual === undefined) return false;
  return Array.isArray(expected) ? expected.includes(actual) : actual === expected;
}

export function matchSpec(ir: CommandIR, spec: MatchSpec): boolean {
  return oneOf(ir.domain, spec.domain) &&
    oneOf(ir.action, spec.action) &&
    oneOf(ir.object, spec.object) &&
    oneOf(ir.target, spec.target) &&
    oneOf(ir.intent, spec.intent);
}

function findSkill(catalog: SkillCatalogEntry[], name: string): SkillCatalogEntry | undefined {
  return catalog.find((skill) => skill.name === name);
}

function findLowering(catalog: SkillCatalogEntry[], ir: CommandIR): { skill: SkillCatalogEntry; lowering: LoweringMetadata } | undefined {
  for (const skill of catalog) {
    for (const lowering of skill.compiler?.lowering ?? []) {
      if (matchSpec(ir, lowering.match)) return { skill, lowering };
    }
  }
  return undefined;
}

export function lowerCommand(ir: CommandIR, catalog: SkillCatalogEntry[], actions: DirectExecAction[]): LoweringResult {
  const found = findLowering(catalog, ir);
  if (!found) return { ok: false, mode: "normal", directExec: null, skill: null, reason: "no lowering matched" };

  const { lowering } = found;
  const requiredContext = lowering.requiredContext ?? [];
  if (lowering.actionId) {
    const action = actions.find((candidate) => candidate.id === lowering.actionId);
    if (action) {
      return {
        ok: true,
        mode: "direct_exec",
        directExec: { action, requiredContext: [...new Set([...requiredContext, ...(action.requiredContext ?? [])])], reason: lowering.reason ?? "lowered to direct exec" },
        skill: null,
        reason: lowering.reason ?? "lowered to direct exec",
      };
    }
  }

  if (lowering.fallbackSkill) {
    const skill = findSkill(catalog, lowering.fallbackSkill);
    return {
      ok: true,
      mode: "pig_skill",
      directExec: null,
      skill: { name: lowering.fallbackSkill, skillPath: skill?.skillPath, reason: lowering.reason ?? "lowered to pig skill" },
      reason: lowering.reason ?? "lowered to pig skill",
    };
  }

  return { ok: false, mode: "normal", directExec: null, skill: null, reason: "lowering had no action or skill" };
}
