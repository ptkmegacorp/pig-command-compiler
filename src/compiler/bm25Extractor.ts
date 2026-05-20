import type { CandidateEvidence, CommandExtractor, CommandIRCandidate } from "./extractors.js";
import type { CommandAction, CommandDomain, CommandObject } from "./ir.js";
import { buildMetadataDocs } from "../metadata/loadSkillMetadata.js";

const tokenize = (text: string): string[] => text.toLowerCase().match(/[a-z0-9']+/g) ?? [];

const ACTION_CUES: Record<string, string[]> = {
  capture: ["take", "capture", "grab", "save", "snap"],
  inspect: ["look", "inspect", "read", "describe", "view", "what", "what's", "whats", "see", "check"],
  show: ["show", "open", "display", "view", "pull", "bring"],
  open: ["open", "show", "display", "view"],
  lookup: ["weather", "forecast", "temperature", "temp", "rain", "raining", "snow", "wind", "jacket", "umbrella", "outside"],
  move: ["move"],
  focus: ["focus"],
  launch: ["launch", "open", "start"],
};

const DOMAIN_ANCHORS: Record<string, string[]> = {
  screen: ["screen", "screenshot", "desktop", "display", "monitor"],
  image: ["image", "photo", "picture", "camera"],
  weather: ["weather", "forecast", "temperature", "temp", "rain", "raining", "snow", "wind", "jacket", "umbrella", "outside"],
  file: ["file"],
  window: ["window"],
  app: ["app", "application"],
};

function includesPhrase(text: string, phrase: string): boolean {
  return text.includes(phrase.toLowerCase());
}

function tokenOverlap(query: Set<string>, text: string): string[] {
  return [...new Set(tokenize(text).filter((term) => query.has(term)))];
}

function inferAnchors(domain: CommandDomain, object: CommandObject, keywords: string[]): string[] {
  const anchors = new Set<string>([...(DOMAIN_ANCHORS[domain] ?? []), object]);
  for (const keyword of keywords) {
    const terms = tokenize(keyword);
    // Multi-word metadata keywords often contain the object anchor, e.g. "screen capture".
    for (const term of terms) {
      if ((DOMAIN_ANCHORS[domain] ?? []).includes(term) || term === object) anchors.add(term);
    }
  }
  return [...anchors];
}

function buildEvidence(text: string, query: string[], doc: ReturnType<typeof buildMetadataDocs>[number]): CandidateEvidence {
  const lower = text.toLowerCase();
  const querySet = new Set(query);
  const examples = doc.examples ?? [];
  const keywords = doc.keywords ?? [];
  const anchors = inferAnchors(doc.ir.domain, doc.ir.object, keywords);
  const actionCues = ACTION_CUES[doc.ir.action] ?? [];

  const matchedExamples = examples.filter((example) => includesPhrase(lower, example));
  const matchedKeywordPhrases = keywords.filter((keyword) => includesPhrase(lower, keyword));
  const exampleTokenMatches = [...new Set(examples.flatMap((example) => tokenOverlap(querySet, example)))];
  const keywordTokenMatches = [...new Set(keywords.flatMap((keyword) => tokenOverlap(querySet, keyword)))];
  const anchorMatches = anchors.filter((anchor) => querySet.has(anchor));
  const actionCueMatches = actionCues.filter((cue) => querySet.has(cue));
  const tokenMatches = [...new Set([...exampleTokenMatches, ...keywordTokenMatches])];

  const exactExample = matchedExamples.length > 0;
  const exactKeywordPhrase = matchedKeywordPhrases.length > 0;
  const coverage = tokenMatches.length / Math.max(2, new Set(query).size);

  let score = 0;
  if (exactExample) score += 0.78;
  if (exactKeywordPhrase) score += 0.68;
  score += Math.min(0.16, anchorMatches.length * 0.08);
  score += Math.min(0.14, actionCueMatches.length * 0.07);
  score += Math.min(0.18, coverage * 0.18);
  score = Math.min(0.89, score);

  return {
    kind: "metadata",
    score,
    exactExample,
    exactKeywordPhrase,
    matchedExamples,
    matchedKeywords: matchedKeywordPhrases.length > 0 ? matchedKeywordPhrases : keywordTokenMatches,
    anchorMatches,
    actionCueMatches,
    tokenMatches,
  };
}

function hasNegative(text: string, negatives: string[]): boolean {
  const lower = text.toLowerCase();
  return negatives.some((negative) => lower.includes(negative.toLowerCase()));
}

function metadataEvidenceIsStrong(evidence: CandidateEvidence): boolean {
  if (evidence.exactExample || evidence.exactKeywordPhrase) return true;
  return Boolean(evidence.anchorMatches?.length && evidence.actionCueMatches?.length && evidence.tokenMatches?.length);
}

export const bm25Extractor: CommandExtractor = {
  name: "bm25-metadata",
  extract(text, resources): CommandIRCandidate[] {
    const query = tokenize(text);
    if (query.length === 0) return [];
    return buildMetadataDocs(resources.catalog)
      .filter((doc) => !hasNegative(text, doc.negativeExamples))
      .map((doc) => {
        const evidence = buildEvidence(text, query, doc);
        return { doc, evidence, confidence: evidence.score };
      })
      .filter(({ evidence, confidence }) => metadataEvidenceIsStrong(evidence) && confidence >= 0.62)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5)
      .map(({ doc, evidence, confidence }) => ({
        ir: { ...doc.ir, kind: "command", confidence },
        extractor: "bm25-metadata",
        matchedTerms: evidence.tokenMatches ?? [],
        reason: `matched skill metadata ${doc.id}`,
        evidence,
      }));
  },
};
