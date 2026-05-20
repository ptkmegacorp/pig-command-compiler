import type { CommandIR } from "./ir.js";

const allowed: Record<string, Partial<Record<string, Set<string>>>> = {
  screen: {
    capture: new Set(["screenshot"]),
    show: new Set(["screenshot"]),
    open: new Set(["screenshot"]),
    inspect: new Set(["screen", "screenshot"]),
  },
  weather: {
    lookup: new Set(["weather"]),
  },
  image: {
    capture: new Set(["image", "photo"]),
    open: new Set(["image", "photo"]),
    show: new Set(["image", "photo"]),
    inspect: new Set(["image", "photo"]),
  },
  window: {
    move: new Set(["window"]),
    focus: new Set(["window"]),
  },
  app: {
    launch: new Set(["app"]),
    focus: new Set(["app"]),
  },
  file: {
    open: new Set(["file"]),
    show: new Set(["file"]),
  },
};

export interface TypecheckResult {
  ok: boolean;
  reason: string;
}

export function typecheckCommand(ir: CommandIR): TypecheckResult {
  const domain = allowed[ir.domain];
  if (!domain) return { ok: false, reason: `unknown domain ${ir.domain}` };
  const objects = domain[ir.action];
  if (!objects) return { ok: false, reason: `action ${ir.action} not allowed for ${ir.domain}` };
  if (!objects.has(ir.object)) return { ok: false, reason: `object ${ir.object} not allowed for ${ir.domain}.${ir.action}` };
  return { ok: true, reason: "valid command ir" };
}
