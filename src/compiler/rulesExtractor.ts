import type { CommandExtractor, CommandIRCandidate } from "./extractors.js";

const RULES: Array<{ pattern: RegExp; candidate: Omit<CommandIRCandidate, "extractor"> }> = [
  {
    pattern: /\b(take|capture|grab|save)\b.*\b(screen\s*shot|screenshot|screen|desktop)\b|\b(screen\s*shot|screenshot)\b.*\b(take|capture|grab|save)\b/i,
    candidate: {
      ir: { kind: "command", domain: "screen", action: "capture", object: "screenshot", target: "current", confidence: 0.94 },
      matchedTerms: ["screenshot", "capture"],
      reason: "matched screenshot capture phrase",
    },
  },
  {
    pattern: /\b(show|open|display|pull up|bring up)\b.*\b(last|latest|recent)?\s*(screen\s*shot|screenshot)\b/i,
    candidate: {
      ir: { kind: "command", domain: "screen", action: "show", object: "screenshot", target: "last", confidence: 0.9, intent: "display_to_user" },
      matchedTerms: ["show", "screenshot"],
      reason: "matched latest screenshot display phrase",
    },
  },
  {
    pattern: /\b(weather|forecast|temperature|raining|rain|snow|wind|jacket|umbrella)\b/i,
    candidate: {
      ir: { kind: "command", domain: "weather", action: "lookup", object: "weather", target: "current", confidence: 0.88 },
      matchedTerms: ["weather"],
      reason: "matched weather lookup term",
    },
  },
];

export const rulesExtractor: CommandExtractor = {
  name: "rules",
  extract(text): CommandIRCandidate[] {
    return RULES.filter((rule) => rule.pattern.test(text)).map((rule) => ({
      ...rule.candidate,
      extractor: "rules",
    }));
  },
};
