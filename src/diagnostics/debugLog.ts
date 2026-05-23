import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

const DEFAULT_LOG_DIR = path.join(os.homedir(), ".pig", "agent", "logs");
const LOG_FILE = "pig-command-compiler.jsonl";

export interface DebugLogEvent {
  event: string;
  cwd?: string;
  input?: string;
  data?: unknown;
  error?: unknown;
}

export function debugLogDir(): string {
  return process.env.PIG_COMMAND_COMPILER_LOG_DIR || DEFAULT_LOG_DIR;
}

export function debugLogPath(): string {
  return path.join(debugLogDir(), LOG_FILE);
}

function serializeError(error: unknown): unknown {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }
  return error;
}

export async function appendDebugLog(event: DebugLogEvent): Promise<void> {
  const record = {
    ts: new Date().toISOString(),
    pid: process.pid,
    ...event,
    error: event.error === undefined ? undefined : serializeError(event.error),
  };
  try {
    await fs.mkdir(debugLogDir(), { recursive: true });
    await fs.appendFile(debugLogPath(), `${JSON.stringify(record)}\n`, "utf8");
  } catch {
    // Logging must never break command routing.
  }
}

export function appendDebugLogSyncBestEffort(event: DebugLogEvent): void {
  void appendDebugLog(event);
}
