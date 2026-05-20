import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import type { CompilerMetadata, DirectExecAction, DirectExecMetadata, MetadataDoc, RoutingMetadata, SkillCatalogEntry } from "./schema.js";

async function readJson<T>(file: string): Promise<T | undefined> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

export function defaultPigSkillRoots(cwd = process.cwd()): string[] {
  return [
    path.join(os.homedir(), ".pig", "agent", "skills"),
    path.join(cwd, "skills"),
  ];
}

export async function loadSkillCatalog(skillRoots = defaultPigSkillRoots()): Promise<SkillCatalogEntry[]> {
  const entries: SkillCatalogEntry[] = [];
  for (const root of skillRoots) {
    let children: string[];
    try {
      children = await fs.readdir(root);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw error;
    }
    for (const child of children.sort()) {
      const dir = path.join(root, child);
      const stat = await fs.stat(dir).catch(() => undefined);
      if (!stat?.isDirectory()) continue;
      const skillPath = path.join(dir, "SKILL.md");
      if (!(await fs.stat(skillPath).catch(() => undefined))) continue;
      const routing = await readJson<RoutingMetadata>(path.join(dir, "routing.json"));
      if (routing && routing.enabled === false) continue;
      const compiler = await readJson<CompilerMetadata>(path.join(dir, "compiler.json"));
      const directExec = await readJson<DirectExecMetadata>(path.join(dir, "direct-exec.json"));
      entries.push({ name: child, dir, skillPath, routing, compiler, directExec });
    }
  }
  return entries;
}

export function collectDirectExecActions(catalog: SkillCatalogEntry[]): DirectExecAction[] {
  return catalog.flatMap((skill) => (skill.directExec?.actions ?? []).map((action) => ({
    ...action,
    skillName: skill.name,
    skillDir: skill.dir,
  })));
}

export function buildMetadataDocs(catalog: SkillCatalogEntry[]): MetadataDoc[] {
  const docs: MetadataDoc[] = [];
  for (const skill of catalog) {
    for (const intent of skill.compiler?.intents ?? []) {
      const examples = intent.examples ?? [];
      const keywords = intent.keywords ?? [];
      const negativeExamples = intent.negativeExamples ?? [];
      docs.push({
        id: `${skill.name}:${intent.id}`,
        skillName: skill.name,
        intentId: intent.id,
        text: [intent.id, skill.routing?.family, ...examples, ...keywords].filter(Boolean).join(" \n"),
        terms: [...examples, ...keywords],
        ir: intent.ir,
        examples,
        keywords,
        negativeExamples,
      });
    }
  }
  return docs;
}
