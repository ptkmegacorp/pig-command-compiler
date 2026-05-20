import type { CompilerTrace } from "../compiler/trace.js";

export function formatTrace(trace: CompilerTrace): string {
  const lines = [`input: ${trace.input}`, `candidates: ${trace.candidates.length}`];
  if (trace.selected) {
    lines.push(`selected: ${trace.selected.extractor} ${JSON.stringify(trace.selected.ir)}`);
  }
  for (const step of trace.steps) {
    lines.push(`${step.ok ? "✓" : "✗"} ${step.stage}: ${step.message}`);
  }
  return lines.join("\n");
}
