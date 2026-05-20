# Pig Command Compiler Scaffold

## Project Name

```text
pig-command-compiler
```

A Pig extension that compiles fuzzy user input into typed, validated, deterministic Pig commands.

This project should be treated as a new ground-up compiler layer for Pig. Its job is not to be a chatbot, a general agent, or a model-controlled automation system. Its job is to sit between user input and Pig's normal message path and decide:

```text
Can this input be safely compiled into a known command?
```

If yes, it transforms the input into a deterministic Pig action or skill invocation.
If no, it lets the input continue as a normal Pig message.

---

# Core Idea

Pig lives in a Unix-like environment where many user requests are not open-ended conversation. They are small executable commands:

```text
take a screenshot
show my last screenshot
look at the current screen
what is the weather today
open the latest image
move the focused window left
```

These should not depend entirely on a large language model guessing what to do. They should compile through a strict pipeline:

```text
fuzzy input
→ extractor stack
→ typed CommandIR
→ typecheck
→ resolve state/references
→ lower to action or skill
→ check preconditions
→ execute or transform
→ otherwise fall back to normal Pig message
```

The extractor layer can be fuzzy.
The compiler backend must be deterministic.

Slogan:

```text
Extractors may guess. The compiler must verify.
```

---

# Where This Hooks Into Pi/Pig

Pig runs on top of Pi's extension system. The compiler should be packaged as a Pig/Pi extension.

The extension hooks into Pi at the input boundary:

```ts
export default function pigCommandCompiler(pi: ExtensionAPI) {
  pi.on("resources_discover", (event) => ({
    skillPaths: discoverSkillPaths(event.cwd),
  }));

  pi.on("input", async (event) => {
    const text = event.text.trim();

    if (!shouldCompile(text)) {
      return { action: "continue" as const };
    }

    const result = await compileInput(text, buildCompilerResources(pi));

    if (result.mode === "direct_exec") {
      const output = await runDirectExec(result.action);
      return {
        action: "transform" as const,
        text: buildResultMessage(result, output),
        images: event.images,
      };
    }

    if (result.mode === "pig_skill") {
      return {
        action: "transform" as const,
        text: buildSkillMessage(result.skill, text),
        images: event.images,
      };
    }

    return { action: "continue" as const };
  });
}
```

Pi/Pig integration responsibilities:

```text
resources_discover   expose Pig skill directories
input                intercept user text before normal model handling
transform            replace input with deterministic skill/action result
continue             fall through to normal Pig behavior
registerCommand      optional diagnostics/debug commands
session_start        optional startup notice
```

The compiler should be conservative. If anything is unclear, invalid, unsafe, or missing context, return `continue`.

---

# Basic Flow

## 1. User input enters Pig

```text
"take a screenshot"
```

## 2. Extension receives input event

The extension ignores explicit slash commands, already-expanded skill blocks, empty text, and anything else that should not be compiled.

```ts
function shouldCompile(text: string): boolean {
  if (!text.trim()) return false;
  if (text.startsWith("/")) return false;
  if (text.startsWith("<skill ")) return false;
  return true;
}
```

## 3. Extractor stack proposes candidates

Extractors produce candidate `CommandIR` values.

```text
rules extractor
BM25 metadata extractor
Transformers.js embedding extractor
future extractors
```

Possible candidate:

```ts
{
  ir: {
    kind: "command",
    domain: "screen",
    action: "capture",
    object: "screenshot",
    target: "current",
    confidence: 0.91,
  },
  extractor: "rules",
  matchedTerms: ["take", "screenshot"],
  reason: "matched screenshot capture phrase",
}
```

## 4. Compiler selects candidate

Usually select the highest-confidence candidate, but keep trace data so bad routes can be debugged.

## 5. Typecheck

Make sure the command is valid.

Example valid command:

```text
screen.capture.screenshot.current
```

Example invalid command:

```text
weather.capture.screenshot
```

Invalid IR falls back to normal Pig handling.

## 6. Resolve state and references

Some commands depend on Pig state:

```text
recent_screenshot_path
last_image_path
default_location
active_display
focused_window
selected_file
```

The resolver fills references from current compiler state.

## 7. Lowering

Lowering maps typed IR to an executable target.

```text
screen.capture.screenshot.current
→ direct_exec: take-screenshot

screen.inspect.screenshot.last
→ direct_exec: capture/read image, then transform message with attached image

weather.lookup.weather.current
→ pig_skill: weather
```

## 8. Preconditions

Before execution, check that required context exists.

```text
show last screenshot
requires: recent_screenshot_path
```

If missing, fall back safely.

## 9. Execute or transform

Final output is one of:

```text
direct_exec   run an approved local script
pig_skill     transform input into a skill-expanded message
normal        continue to Pig's normal model path
```

---

# Recommended File Structure

```text
pig-command-compiler/
  package.json
  tsconfig.json
  README.md

  src/
    index.ts

    compiler/
      compiler.ts
      ir.ts
      extractors.ts
      rulesExtractor.ts
      bm25Extractor.ts
      transformersEmbeddingExtractor.ts
      typecheck.ts
      state.ts
      resolve.ts
      lower.ts
      preconditions.ts
      trace.ts

    runtime/
      resources.ts
      directExec.ts
      skillMessages.ts
      images.ts
      safety.ts

    metadata/
      schema.ts
      loadSkillMetadata.ts

    diagnostics/
      commands.ts
      logs.ts

  skills/
    take-screenshot/
      SKILL.md
      routing.json
      compiler.json
      direct-exec.json
      scripts/
        take-screenshot.sh

    weather/
      SKILL.md
      routing.json
      compiler.json

  tests/
    compiler-smoke.test.ts
    extractor-rules.test.ts
    lowering.test.ts
    preconditions.test.ts
```

---

# Core Types

## Command IR

```ts
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
```

## Extractor Candidate

```ts
export interface CommandIRCandidate {
  ir: AnyIR;
  extractor: string;
  matchedTerms: string[];
  reason: string;
}

export interface CommandExtractor {
  readonly name: string;
  extract(
    text: string,
    resources: CompilerResources,
  ): CommandIRCandidate[] | Promise<CommandIRCandidate[]>;
}
```

## Compiler Decision

```ts
export interface CompilerDecision {
  handled: boolean;
  mode: "direct_exec" | "pig_skill" | "normal";
  command: CommandIR | null;
  directExec: DirectExecCandidate | null;
  skill: ResolvedSkill | null;
  confidence: number;
  reason: string;
  trace: CompilerTrace;
}
```

## Compiler Resources

```ts
export interface CompilerResources {
  catalog: SkillCatalogEntry[];
  actions: DirectExecAction[];
  state: PigCommandState;
}
```

## Pig Command State

```ts
export interface PigCommandState {
  activeDisplay?: string;
  recentScreenshotPath?: string;
  lastImagePath?: string;
  latestPhotoPath?: string;
  defaultLocation?: string;
  focusedWindow?: string;
  selectedFile?: string;
}
```

---

# Extractor Stack

## 1. Basic Rules Extractor

Purpose:

```text
fast deterministic coverage for obvious commands
```

Examples:

```text
"take a screenshot" → screen.capture.screenshot.current
"show screenshot"   → screen.show.screenshot.last
"weather today"     → weather.lookup.weather.current
```

This extractor should stay small. It is not the main intelligence layer. It is a cheap high-confidence path for obvious commands.

## 2. BM25 Metadata Extractor

Purpose:

```text
lightweight lexical matching over skill-owned metadata
```

Input documents come from `compiler.json` and `routing.json` fields:

```text
intent id
examples
keywords
negative examples
family
```

BM25 is good for:

```text
fast startup
no model download
cheap scoring
interpretable matched terms
small command catalogs
```

BM25 is weak for:

```text
paraphrases
semantic similarity
phrases with different wording
commands that share many terms but differ in intent
```

## 3. Transformers.js Embedding Extractor

Recommended package:

```text
@huggingface/transformers
```

Use it for semantic candidate generation, especially when the wording differs from metadata examples.

Recommended role:

```text
text → embedding
metadata examples → embedding cache
cosine similarity → candidate CommandIR
```

Example models to evaluate later:

```text
Xenova/all-MiniLM-L6-v2
Xenova/bge-small-en-v1.5
mixedbread-ai/mxbai-embed-xsmall-v1
```

The exact model should remain swappable. Do not bake model-specific assumptions into the compiler.

Important rule:

```text
Embeddings propose candidates. They do not authorize execution.
```

The embedding extractor should cache metadata embeddings at startup or first use. Do not recompute every metadata embedding on every input.

Suggested shape:

```ts
export const transformersEmbeddingExtractor: CommandExtractor = {
  name: "transformers-embedding",

  async extract(text, resources) {
    const queryEmbedding = await embedText(text);
    const docs = await getEmbeddedMetadataDocs(resources);
    return scoreDocs(queryEmbedding, docs)
      .filter((doc) => doc.score >= EMBEDDING_THRESHOLD)
      .map(docToCandidate)
      .slice(0, 5);
  },
};
```

## Extractor Stack Runner

```ts
export async function runExtractorStack(
  text: string,
  resources: CompilerResources,
  extractors: CommandExtractor[],
): Promise<CommandIRCandidate[]> {
  const candidates: CommandIRCandidate[] = [];

  for (const extractor of extractors) {
    const produced = await extractor.extract(text, resources);
    candidates.push(...produced);
  }

  return candidates.sort((a, b) => b.ir.confidence - a.ir.confidence);
}
```

Recommended default stack:

```ts
export const DEFAULT_EXTRACTOR_STACK: CommandExtractor[] = [
  rulesExtractor,
  bm25Extractor,
  transformersEmbeddingExtractor,
];
```

---

# Skill-Owned Metadata

Each skill should be able to describe its command affordances.

## `routing.json`

Broad language metadata:

```json
{
  "enabled": true,
  "family": "screen",
  "examples": [
    "take a screenshot",
    "capture my screen",
    "grab the screen"
  ],
  "keywords": [
    "screenshot",
    "screen capture",
    "desktop"
  ],
  "negativeExamples": [
    "what is a screenshot"
  ]
}
```

## `compiler.json`

Command IR and lowering metadata:

```json
{
  "intents": [
    {
      "id": "capture_screenshot",
      "ir": {
        "kind": "command",
        "domain": "screen",
        "action": "capture",
        "object": "screenshot",
        "target": "current"
      },
      "examples": [
        "take a screenshot",
        "capture the screen",
        "grab my desktop"
      ],
      "keywords": [
        "screenshot",
        "capture",
        "screen"
      ],
      "negativeExamples": [
        "explain screenshots"
      ]
    }
  ],
  "lowering": [
    {
      "match": {
        "domain": "screen",
        "action": "capture",
        "object": "screenshot",
        "target": "current"
      },
      "actionId": "take-screenshot",
      "fallbackSkill": "take-screenshot",
      "requiredContext": ["active_display"],
      "reason": "capture current screen"
    }
  ]
}
```

## `direct-exec.json`

Explicit local script eligibility:

```json
{
  "actions": [
    {
      "id": "take-screenshot",
      "description": "Capture the current screen to an image file",
      "script": "scripts/take-screenshot.sh",
      "directExec": true,
      "safety": "local_capture",
      "requiresConfirmation": false,
      "defaultArgs": [],
      "outputImageKey": "SCREENSHOT_PATH"
    }
  ]
}
```

---

# Compiler Stages

## `compiler.ts`

Orchestrates the full pipeline:

```text
extract
select
validate
typecheck
resolve
lower
check preconditions
return decision
```

## `typecheck.ts`

Rejects invalid domain/action/object combinations.

Example:

```ts
const allowed = {
  screen: {
    capture: new Set(["screenshot"]),
    show: new Set(["screenshot"]),
    inspect: new Set(["screen", "screenshot"]),
  },
  weather: {
    lookup: new Set(["weather"]),
  },
};
```

## `resolve.ts`

Adds stateful references:

```text
last screenshot path
last image path
default location
focused window
selected file
```

## `lower.ts`

Converts validated IR into an executable target.

```text
CommandIR + lowering metadata
→ DirectExecCandidate or Pig skill
```

## `preconditions.ts`

Fails closed when required context is missing.

```ts
if (requiredContext.includes("recent_screenshot_path") && !refs.recentScreenshotPath) {
  missing.push("recent_screenshot_path");
}
```

## `directExec.ts`

Runs only approved actions.

Rules:

```text
script must be relative
script must live inside skill scripts/ directory
action must opt into directExec
requiresConfirmation must be false
safety class must be allowed
```

---

# Safety Classes

Initial allowed safety classes:

```text
read_only_local     reads local non-sensitive state
read_only_network   fetches public/read-only network data
local_capture       captures local screen/image state for user-visible inspection
```

Do not add write/delete/mutation actions until the compiler has stronger confirmation and permission handling.

Initial policy:

```text
uncertain → normal
invalid → normal
missing context → normal
unsafe → normal
execution error → normal
```

False negatives are acceptable.
Unsafe false positives are not.

---

# Minimal `package.json`

```json
{
  "name": "pig-command-compiler",
  "version": "0.1.0",
  "type": "module",
  "description": "Pig extension for compiling fuzzy user input into typed, validated, deterministic commands",
  "keywords": [
    "pig",
    "pi-extension",
    "command-compiler",
    "command-ir",
    "extractors",
    "skills",
    "deterministic-actions"
  ],
  "license": "MIT",
  "pi": {
    "extensions": [
      "./src/index.ts"
    ]
  },
  "peerDependencies": {
    "@mariozechner/pi-ai": "*",
    "@mariozechner/pi-coding-agent": "*"
  },
  "scripts": {
    "build": "tsc",
    "check": "tsc --noEmit",
    "test": "npm run build && node tests/compiler-smoke.mjs"
  },
  "dependencies": {
    "@huggingface/transformers": "latest"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "typescript": "^5.7.0"
  },
  "exports": {
    ".": "./src/index.ts"
  },
  "types": "./src/index.ts"
}
```

---

# Initial Milestones

## Milestone 1: Compiler shell

Build the pipeline with only the rules extractor.

```text
input → rules extractor → IR → typecheck → lower → result
```

Target commands:

```text
take screenshot
show last screenshot
weather today
```

## Milestone 2: Skill-owned metadata

Load metadata from skills:

```text
routing.json
compiler.json
direct-exec.json
```

Generate BM25 docs from metadata.

## Milestone 3: Direct execution

Allow one safe direct action:

```text
take-screenshot
```

Make sure safety checks are boring and strict.

## Milestone 4: Transformers.js embedding extractor

Add semantic matching over metadata examples.

Important implementation detail:

```text
cache metadata embeddings
embed user input once
score against cached docs
return candidate IR only
```

## Milestone 5: Diagnostics

Add debug command:

```text
/compiler-route <text>
```

Output:

```text
selected IR
extractor source
matched terms
confidence
typecheck result
resolved refs
lowering result
fallback reason
```

---

# What To Avoid

Avoid:

```text
giant global if/else routing
letting embeddings directly select scripts
letting the model directly control execution
expanding the IR before real use cases force it
adding unsafe write actions too early
hiding failures instead of tracing them
```

Prefer:

```text
small typed IR
skill-owned metadata
strict typechecking
metadata-driven lowering
explicit safety classes
traceable fallback reasons
replaceable extractors
```

---

# One-Sentence Description

```text
Pig Command Compiler is a Pi/Pig extension that turns fuzzy user input into typed CommandIR, validates it, resolves state, lowers it into safe Pig skills or approved local actions, and falls back to normal Pig behavior when uncertain.
```

in /home/bot/.pig/... you will find our existing pig/gemma skills w relevant metadata json/scripts. this is the proper directory where the skill metadata lives for our pig-command-compiler repo to use. 
