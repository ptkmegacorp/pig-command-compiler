import type { CommandIR } from "../compiler/ir.js";

export interface RoutingMetadata {
  enabled?: boolean;
  deterministicAffordance?: boolean;
  family?: string;
  examples?: string[];
  keywords?: string[];
  negativeExamples?: string[];
  intents?: Record<string, RoutingIntentMetadata>;
}

export interface RoutingIntentMetadata {
  family?: string;
  examples?: string[];
  keywords?: string[];
  negativeExamples?: string[];
  requiredContext?: string[];
}

export interface CompilerIntentMetadata {
  id: string;
  ir: Omit<CommandIR, "confidence"> & { confidence?: number } & Record<string, unknown>;
  examples?: string[];
  keywords?: string[];
  negativeExamples?: string[];
}

export interface MatchSpec {
  domain?: string | string[];
  action?: string | string[];
  object?: string | string[];
  target?: string | string[];
  intent?: string | string[];
}

export interface LoweringMetadata {
  match: MatchSpec;
  actionId?: string;
  fallbackSkill?: string;
  matchedIntents?: string[];
  requiredContext?: string[];
  reason?: string;
}

export interface CompilerMetadata {
  intents?: CompilerIntentMetadata[];
  lowering?: LoweringMetadata[];
  schemas?: Array<{ match: MatchSpec; requiredFields?: string[] }>;
}

export type SafetyClass = "read_only_local" | "read_only_network" | "local_capture";

export interface DirectExecAction {
  id: string;
  description?: string;
  script: string;
  directExec: boolean;
  family?: string;
  safety: SafetyClass | string;
  requiresConfirmation?: boolean;
  requiredContext?: string[];
  defaultArgs?: string[];
  keywords?: string[];
  exactPhrases?: string[];
  outputImageKey?: string;
  attachImageWhenIntent?: string;
  runWhenIntent?: string;
  skillName: string;
  skillDir: string;
}

export interface DirectExecMetadata {
  actions?: Array<Omit<DirectExecAction, "skillName" | "skillDir">>;
}

export interface SkillCatalogEntry {
  name: string;
  dir: string;
  skillPath: string;
  routing?: RoutingMetadata;
  compiler?: CompilerMetadata;
  directExec?: DirectExecMetadata;
}

export interface MetadataDoc {
  id: string;
  skillName: string;
  intentId?: string;
  text: string;
  terms: string[];
  ir: Omit<CommandIR, "confidence">;
  examples: string[];
  keywords: string[];
  negativeExamples: string[];
}
