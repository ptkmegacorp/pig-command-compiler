import { compileInput } from "../compiler/compiler.js";
import { buildCompilerResources } from "../runtime/resources.js";
import { formatTrace } from "./logs.js";

export interface MinimalPiCommandAPI {
  registerCommand(name: string, options: { description?: string; handler: (args: string, ctx: { cwd?: string; ui?: { notify?: (message: string, type?: string) => void } }) => unknown | Promise<unknown> }): void;
}

export function registerDiagnostics(pi: MinimalPiCommandAPI): void {
  pi.registerCommand("compiler-route", {
    description: "Debug pig-command-compiler routing for input text",
    handler: async (args, ctx) => {
      const resources = await buildCompilerResources(ctx.cwd ?? process.cwd(), {
        activeDisplay: process.env.DISPLAY ?? "test-display",
        defaultLocation: process.env.PIG_DEFAULT_LOCATION ?? "Jim Falls, WI",
        recentScreenshotPath: process.env.PIG_RECENT_SCREENSHOT,
      });
      const decision = await compileInput(args, resources);
      const text = `${decision.mode}: ${decision.reason}\n${formatTrace(decision.trace)}`;
      ctx.ui?.notify?.(text, decision.handled ? "info" : "warn");
      return text;
    },
  });
}
