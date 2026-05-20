import type { CommandExtractor, CommandIRCandidate } from "./extractors.js";
import { buildMetadataDocs } from "../metadata/loadSkillMetadata.js";

const tokenize = (text: string): string[] => text.toLowerCase().match(/[a-z0-9]+/g) ?? [];

function score(query: string[], docText: string): { score: number; matched: string[] } {
  const docTerms = new Set(tokenize(docText));
  const matched = [...new Set(query)].filter((term) => docTerms.has(term));
  return { score: matched.length / Math.max(3, new Set(query).size), matched };
}

function hasNegative(text: string, negatives: string[]): boolean {
  const lower = text.toLowerCase();
  return negatives.some((negative) => lower.includes(negative.toLowerCase()));
}

export const bm25Extractor: CommandExtractor = {
  name: "bm25-metadata",
  extract(text, resources): CommandIRCandidate[] {
    const query = tokenize(text);
    if (query.length === 0) return [];
    return buildMetadataDocs(resources.catalog)
      .filter((doc) => !hasNegative(text, doc.negativeExamples))
      .map((doc) => {
        const result = score(query, doc.text);
        const exactBoost = doc.examples.some((example) => text.toLowerCase().includes(example.toLowerCase())) ? 0.25 : 0;
        const confidence = Math.min(0.89, 0.45 + result.score + exactBoost);
        return { doc, result, confidence };
      })
      .filter(({ result, confidence }) => result.matched.length > 0 && confidence >= 0.62)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5)
      .map(({ doc, result, confidence }) => ({
        ir: { ...doc.ir, kind: "command", confidence },
        extractor: "bm25-metadata",
        matchedTerms: result.matched,
        reason: `matched skill metadata ${doc.id}`,
      }));
  },
};
