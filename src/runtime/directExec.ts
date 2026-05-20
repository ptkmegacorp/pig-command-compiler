import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { DirectExecCandidate } from "../compiler/lower.js";
import { validateDirectExecAction } from "./safety.js";

const execFileAsync = promisify(execFile);

export interface DirectExecOutput {
  stdout: string;
  stderr: string;
  code: number;
  imagePath?: string;
}

export async function runDirectExec(candidate: DirectExecCandidate): Promise<DirectExecOutput> {
  const safety = validateDirectExecAction(candidate.action);
  if (!safety.ok || !safety.scriptPath) {
    throw new Error(`unsafe direct exec: ${safety.reason}`);
  }
  const args = candidate.action.defaultArgs ?? [];
  try {
    const { stdout, stderr } = await execFileAsync(safety.scriptPath, args, {
      cwd: candidate.action.skillDir,
      timeout: 30_000,
      env: process.env,
    });
    return { stdout, stderr, code: 0, imagePath: extractImagePath(stdout, candidate.action.outputImageKey) };
  } catch (error) {
    const err = error as Error & { stdout?: string; stderr?: string; code?: number };
    return { stdout: err.stdout ?? "", stderr: err.stderr ?? err.message, code: err.code ?? 1 };
  }
}

function extractImagePath(stdout: string, key?: string): string | undefined {
  if (!key) return undefined;
  const patterns = [new RegExp(`${key}=([^\\n]+)`), new RegExp(`${key}_PATH=([^\\n]+)`)];
  for (const pattern of patterns) {
    const match = stdout.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return undefined;
}
