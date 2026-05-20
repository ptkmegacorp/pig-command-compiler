import type { CompilerDecision } from "../compiler/compiler.js";
import type { DirectExecOutput } from "./directExec.js";

export function buildSkillMessage(skill: { name: string }, originalText: string): string {
  return `/skill:${skill.name}\n\n${originalText}`;
}

export function buildResultMessage(result: CompilerDecision, output: DirectExecOutput): string {
  const heading = result.command ? `${result.command.domain}.${result.command.action}.${result.command.object}` : "command";
  if (output.code !== 0) {
    return `[pig-command-compiler] ${heading} failed; falling back details:\n${output.stderr || output.stdout}`;
  }
  const parts = [`[pig-command-compiler] handled ${heading}.`];
  if (output.imagePath) parts.push(`Image: ${output.imagePath}`);
  if (output.stdout.trim()) parts.push(output.stdout.trim());
  return parts.join("\n");
}
