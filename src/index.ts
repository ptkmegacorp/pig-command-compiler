import { compileInput, shouldCompile } from "./compiler/compiler.js";
import { registerDiagnostics } from "./diagnostics/commands.js";
import { buildCompilerResources } from "./runtime/resources.js";
import { buildDirectExecSkillMessage, buildSkillMessage } from "./runtime/skillMessages.js";
import type { PigImageAttachment } from "./runtime/images.js";
import { appendDebugLog, debugLogPath } from "./diagnostics/debugLog.js";

interface MinimalExtensionAPI {
  on(event: "input", handler: (event: { text: string; images?: PigImageAttachment[]; source?: string }, ctx: { cwd?: string }) => unknown | Promise<unknown>): void;
  on(event: string, handler: (...args: unknown[]) => unknown): void;
  registerCommand?: (name: string, options: { description?: string; handler: (args: string, ctx: unknown) => unknown }) => void;
  sendUserMessage?: (content: string, options?: { deliverAs?: "steer" | "followUp" }) => void;
}

export default function pigCommandCompiler(pi: MinimalExtensionAPI) {
  pi.on("input", async (event, ctx) => {
    const text = event.text.trim();
    if (event.source === "extension" || !shouldCompile(text)) {
      return { action: "continue" as const };
    }

    try {
      const cwd = ctx.cwd ?? process.cwd();
      const resources = await buildCompilerResources(cwd);
      const result = await compileInput(text, resources);
      await appendDebugLog({
        event: "input_decision",
        cwd,
        input: text,
        data: {
          mode: result.mode,
          handled: result.handled,
          reason: result.reason,
          selected: result.trace.selected,
          steps: result.trace.steps,
        },
      });

      if (result.mode === "direct_exec" && result.directExec) {
        await appendDebugLog({
          event: "direct_exec_skill_handoff",
          cwd,
          input: text,
          data: { action: result.directExec.action.id, skill: result.directExec.action.skillName, script: result.directExec.action.script },
        });
        return {
          action: "transform" as const,
          text: buildDirectExecSkillMessage(result, text),
          images: event.images,
        };
      }

      if (result.mode === "pig_skill" && result.skill) {
        return {
          action: "transform" as const,
          text: buildSkillMessage(result.skill, text),
          images: event.images,
        };
      }

      return { action: "continue" as const };
    } catch (error) {
      await appendDebugLog({ event: "input_error", cwd: ctx.cwd ?? process.cwd(), input: text, error });
      console.warn(`[pig-command-compiler] input error; see ${debugLogPath()}: ${(error as Error).message}`);
      return { action: "continue" as const };
    }
  });

  if (pi.registerCommand) registerDiagnostics(pi as Parameters<typeof registerDiagnostics>[0]);
}

export { compileInput, shouldCompile } from "./compiler/compiler.js";
export type { CompilerDecision, CompilerResources } from "./compiler/compiler.js";
export type { CommandIR, ChatIR, AnyIR } from "./compiler/ir.js";
