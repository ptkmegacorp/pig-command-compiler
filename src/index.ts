import { compileInput, shouldCompile } from "./compiler/compiler.js";
import { registerDiagnostics } from "./diagnostics/commands.js";
import { buildCompilerResources, discoverSkillPaths } from "./runtime/resources.js";
import { runDirectExec } from "./runtime/directExec.js";
import { buildResultMessage, buildSkillMessage } from "./runtime/skillMessages.js";
import { appendImagePath, type PigImageAttachment } from "./runtime/images.js";

interface MinimalExtensionAPI {
  on(event: "resources_discover", handler: (event: { cwd?: string }) => unknown): void;
  on(event: "input", handler: (event: { text: string; images?: PigImageAttachment[]; source?: string }, ctx: { cwd?: string }) => unknown | Promise<unknown>): void;
  on(event: string, handler: (...args: unknown[]) => unknown): void;
  registerCommand?: (name: string, options: { description?: string; handler: (args: string, ctx: unknown) => unknown }) => void;
}

export default function pigCommandCompiler(pi: MinimalExtensionAPI) {
  pi.on("resources_discover", (event) => ({
    skillPaths: discoverSkillPaths(event.cwd ?? process.cwd()),
  }));

  pi.on("input", async (event, ctx) => {
    const text = event.text.trim();
    if (event.source === "extension" || !shouldCompile(text)) {
      return { action: "continue" as const };
    }

    const resources = await buildCompilerResources(ctx.cwd ?? process.cwd());
    const result = await compileInput(text, resources);

    if (result.mode === "direct_exec" && result.directExec) {
      const output = await runDirectExec(result.directExec);
      if (output.code !== 0) return { action: "continue" as const };
      const shouldAttachImage = Boolean(
        output.imagePath &&
          result.command?.intent &&
          result.directExec.action.attachImageWhenIntent === result.command.intent,
      );
      return {
        action: "transform" as const,
        text: shouldAttachImage
          ? `${buildResultMessage(result, output)}\n\nOriginal request: ${text}\nAnswer the original request using the attached image. Do not invent details that are not visible.`
          : buildResultMessage(result, output),
        images: await appendImagePath(event.images, shouldAttachImage ? output.imagePath : undefined),
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
  });

  if (pi.registerCommand) registerDiagnostics(pi as Parameters<typeof registerDiagnostics>[0]);
}

export { compileInput, shouldCompile } from "./compiler/compiler.js";
export type { CompilerDecision, CompilerResources } from "./compiler/compiler.js";
export type { CommandIR, ChatIR, AnyIR } from "./compiler/ir.js";
