import type { CommandExtractor, CommandIRCandidate } from "./extractors.js";
import { buildMetadataDocs } from "../metadata/loadSkillMetadata.js";

const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "at",
  "can",
  "could",
  "do",
  "for",
  "going",
  "i",
  "in",
  "is",
  "it",
  "me",
  "my",
  "of",
  "on",
  "or",
  "please",
  "the",
  "to",
  "up",
  "what",
  "whats",
  "what's",
  "you",
]);

const tokenize = (text: string): string[] => text.toLowerCase().match(/[a-z0-9']+/g) ?? [];
const contentTokens = (text: string): string[] => tokenize(text).filter((term) => !STOPWORDS.has(term));

function score(query: string[], docText: string): { score: number; matched: string[] } {
  const docTerms = new Set(contentTokens(docText));
  const uniqueQuery = new Set(query);
  const matched = [...uniqueQuery].filter((term) => docTerms.has(term));
  return { score: matched.length / Math.max(2, uniqueQuery.size), matched };
}

function hasNegative(text: string, negatives: string[]): boolean {
  const lower = text.toLowerCase();
  return negatives.some((negative) => lower.includes(negative.toLowerCase()));
}

export const bm25Extractor: CommandExtractor = {
  name: "bm25-metadata",
  extract(text, resources): CommandIRCandidate[] {
    const query = contentTokens(text);
    if (query.length === 0) return [];
    return buildMetadataDocs(resources.catalog)
      .filter((doc) => !hasNegative(text, doc.negativeExamples))
      .map((doc) => {
        const result = score(query, doc.text);
        const exactExample = doc.examples.some((example) => text.toLowerCase().includes(example.toLowerCase()));
        const confidence = exactExample ? Math.min(0.89, 0.78 + result.score * 0.11) : 0.4 + result.score * 0.35;
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
