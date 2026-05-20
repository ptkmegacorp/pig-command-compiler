import { collectDirectExecActions, defaultPigSkillRoots, loadSkillCatalog } from "../metadata/loadSkillMetadata.js";
import { buildInitialState, type PigCommandState } from "../compiler/state.js";
import type { CompilerResources } from "../compiler/compiler.js";

export function discoverSkillPaths(cwd = process.cwd()): string[] {
  return defaultPigSkillRoots(cwd);
}

export async function buildCompilerResources(cwd = process.cwd(), stateOverrides: Partial<PigCommandState> = {}): Promise<CompilerResources> {
  const catalog = await loadSkillCatalog(discoverSkillPaths(cwd));
  const actions = collectDirectExecActions(catalog);
  const inferredLocation = inferDefaultLocation(actions.flatMap((action) => action.defaultArgs ?? []));
  return {
    catalog,
    actions,
    state: buildInitialState({ defaultLocation: inferredLocation, ...stateOverrides }),
  };
}

function inferDefaultLocation(args: string[]): string | undefined {
  const index = args.findIndex((arg) => arg === "--location");
  return index >= 0 ? args[index + 1] : undefined;
}
