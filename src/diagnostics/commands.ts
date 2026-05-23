import { compileInput } from "../compiler/compiler.js";
import { buildCompilerResources } from "../runtime/resources.js";
import { buildDirectExecSkillMessage, buildSkillMessage } from "../runtime/skillMessages.js";
import { formatTrace } from "./logs.js";
import { appendDebugLog, debugLogPath } from "./debugLog.js";

export interface MinimalPiCommandAPI {
  registerCommand(name: string, options: { description?: string; handler: (args: string, ctx: CommandContext) => unknown | Promise<unknown> }): void;
  sendUserMessage?: (content: string, options?: { deliverAs?: "steer" | "followUp" }) => void;
}

export interface CommandContext {
  cwd?: string;
  isIdle?: () => boolean;
  ui?: {
    notify?: (message: string, type?: "info" | "warning" | "error") => void;
    setStatus?: (key: string, text: string | undefined) => void;
    theme?: { fg?: (name: string, text: string) => string };
  };
}

const STATUS_KEY = "pig-command-compiler";

function footerText(message: string, ctx?: CommandContext): string {
  const fg = ctx?.ui?.theme?.fg;
  const text = `PCC: ${message}`;
  return fg ? fg("dim", text) : text;
}

function setFooterDebug(ctx: CommandContext, message: string): void {
  ctx.ui?.setStatus?.(STATUS_KEY, footerText(message, ctx));
}

function debugInfoText(ctx: CommandContext): string {
  return [
    `log ${debugLogPath()}`,
    `sessions ${process.env.HOME}/.pig/agent/sessions/`,
    `cwd ${ctx.cwd ?? process.cwd()}`,
    `pid ${process.pid}`,
    `embeddings ${process.env.PIG_COMMAND_COMPILER_EMBEDDINGS ?? "enabled"}`,
    `model ${process.env.PIG_COMMAND_COMPILER_EMBEDDING_MODEL ?? "Xenova/all-MiniLM-L6-v2"}`,
    `cache ${process.env.TRANSFORMERS_CACHE ?? `${process.env.HOME}/.cache/pig-command-compiler/transformers`}`,
  ].join(" | ");
}

export function registerDiagnostics(pi: MinimalPiCommandAPI): void {
  pi.registerCommand("compiler-route", {
    description: "Run input through pig-command-compiler; show route/debug only in the footer",
    handler: async (args, ctx) => {
      const input = args.trim();
      const cwd = ctx.cwd ?? process.cwd();
      if (!input) {
        setFooterDebug(ctx, `usage /compiler-route <text> | log ${debugLogPath()}`);
        return;
      }
      if (!pi.sendUserMessage) {
        setFooterDebug(ctx, `sendUserMessage unavailable; cannot run turn | log ${debugLogPath()}`);
        return;
      }
      if (ctx.isIdle && !ctx.isIdle()) {
        setFooterDebug(ctx, `agent busy; not sending /compiler-route input | log ${debugLogPath()}`);
        return;
      }

      try {
        const resources = await buildCompilerResources(cwd, {
          activeDisplay: process.env.DISPLAY ?? "test-display",
          defaultLocation: process.env.PIG_DEFAULT_LOCATION ?? "Jim Falls, WI",
          recentScreenshotPath: process.env.PIG_RECENT_SCREENSHOT,
        });
        const decision = await compileInput(input, resources);
        await appendDebugLog({
          event: "compiler_route",
          cwd,
          input,
          data: {
            mode: decision.mode,
            handled: decision.handled,
            reason: decision.reason,
            trace: decision.trace,
          },
        });

        const traceSummary = formatTrace(decision.trace).replace(/\s+/g, " ").slice(0, 220);
        setFooterDebug(ctx, `${decision.mode}: ${decision.reason} | ${traceSummary} | log ${debugLogPath()}`);

        if (decision.mode === "direct_exec" && decision.directExec) {
          await appendDebugLog({
            event: "compiler_route_direct_exec_skill_handoff",
            cwd,
            input,
            data: { action: decision.directExec.action.id, skill: decision.directExec.action.skillName, script: decision.directExec.action.script },
          });
          pi.sendUserMessage(buildDirectExecSkillMessage(decision, input));
          return;
        }

        if (decision.mode === "pig_skill" && decision.skill) {
          pi.sendUserMessage(buildSkillMessage(decision.skill, input));
          return;
        }

        pi.sendUserMessage(input);
      } catch (error) {
        await appendDebugLog({ event: "compiler_route_error", cwd, input, error });
        setFooterDebug(ctx, `error: ${(error as Error).message} | log ${debugLogPath()}`);
        if (pi.sendUserMessage) pi.sendUserMessage(input);
      }
    },
  });

  pi.registerCommand("compiler-debug-info", {
    description: "Show pig-command-compiler debug paths and runtime environment in the footer",
    handler: async (_args, ctx) => {
      const text = debugInfoText(ctx);
      await appendDebugLog({ event: "compiler_debug_info", cwd: ctx.cwd ?? process.cwd(), data: { text } });
      setFooterDebug(ctx, text);
    },
  });
}
