import type { AnyIR } from "./ir.js";
import type { CompilerResources } from "./compiler.js";
import { rulesExtractor } from "./rulesExtractor.js";
import { bm25Extractor } from "./bm25Extractor.js";
import { transformersEmbeddingExtractor } from "./transformersEmbeddingExtractor.js";

export interface CandidateEvidence {
  kind: "rules" | "metadata" | "semantic";
  score: number;
  exactExample?: boolean;
  exactKeywordPhrase?: boolean;
  matchedExamples?: string[];
  matchedKeywords?: string[];
  anchorMatches?: string[];
  actionCueMatches?: string[];
  tokenMatches?: string[];
}

export interface CommandIRCandidate {
  ir: AnyIR;
  extractor: string;
  matchedTerms: string[];
  reason: string;
  evidence?: CandidateEvidence;
}

export interface CommandExtractor {
  readonly name: string;
  extract(
    text: string,
    resources: CompilerResources,
  ): CommandIRCandidate[] | Promise<CommandIRCandidate[]>;
}

export async function runExtractorStack(
  text: string,
  resources: CompilerResources,
  extractors: CommandExtractor[],
): Promise<CommandIRCandidate[]> {
  const candidates: CommandIRCandidate[] = [];
  for (const extractor of extractors) {
    const produced = await extractor.extract(text, resources);
    candidates.push(...produced);
  }
  return candidates.sort((a, b) => b.ir.confidence - a.ir.confidence);
}

export const DEFAULT_EXTRACTOR_STACK: CommandExtractor[] = [
  rulesExtractor,
  bm25Extractor,
  transformersEmbeddingExtractor,
];
