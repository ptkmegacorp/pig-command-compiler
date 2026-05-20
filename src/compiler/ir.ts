export type CommandKind = "command" | "chat";

export type CommandDomain =
  | "screen"
  | "image"
  | "weather"
  | "file"
  | "window"
  | "app";

export type CommandAction =
  | "capture"
  | "open"
  | "show"
  | "inspect"
  | "lookup"
  | "move"
  | "focus"
  | "launch";

export type CommandObject =
  | "screen"
  | "screenshot"
  | "image"
  | "photo"
  | "weather"
  | "file"
  | "window"
  | "app";

export type CommandTarget =
  | "current"
  | "last"
  | "recent"
  | "attached"
  | "selected"
  | "focused";

export interface ChatIR {
  kind: "chat";
  reason: "phatic" | "general_question" | "ambiguous" | "no_command";
  confidence: number;
}

export interface CommandIR {
  kind: "command";
  domain: CommandDomain;
  action: CommandAction;
  object: CommandObject;
  target?: CommandTarget;
  confidence: number;
  intent?: string;
  slots?: Record<string, string>;
}

export type AnyIR = ChatIR | CommandIR;
