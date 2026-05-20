# Pig Command Compiler

A Pig/Pi extension that compiles fuzzy user input into typed, validated, deterministic Pig commands.

Pipeline:

```text
fuzzy input → extractor stack → CommandIR → typecheck → resolve → lower → preconditions → execute/transform or continue
```

The compiler is conservative: uncertain, invalid, unsafe, or missing-context inputs fall through to normal Pig behavior.

## Current scaffold

Implemented:

- Pi extension entrypoint at `src/index.ts`
- `resources_discover` for Pig skill roots
- `input` interception with safe fallthrough
- typed `CommandIR`
- rules extractor
- lexical metadata extractor over `/home/bot/.pig/agent/skills/*/{routing,compiler,direct-exec}.json`
- Transformers.js semantic embedding extractor with lazy model load and metadata embedding cache
- typecheck, resolve, lower, preconditions, safety checks
- direct execution runner for approved skill scripts
- `/compiler-route <text>` diagnostics command
- smoke tests

Initial target commands:

- `take screenshot`
- `show last screenshot`
- `weather today`

## Skill metadata

This repo reads existing Pig skills from:

```text
/home/bot/.pig/agent/skills
```

It also checks a project-local `skills/` directory if one is added later.

## Development

```bash
npm install
npm test
npm run test:embedding
```

`npm test` disables embeddings to keep the offline smoke test fast. `npm run test:embedding` loads the configured Transformers.js model and verifies semantic routing.

Embedding configuration:

```bash
# defaults shown
export PIG_COMMAND_COMPILER_EMBEDDINGS=1
export PIG_COMMAND_COMPILER_EMBEDDING_MODEL=Xenova/all-MiniLM-L6-v2
export PIG_COMMAND_COMPILER_EMBEDDING_THRESHOLD=0.58
export PIG_COMMAND_COMPILER_EMBEDDING_TOP_K=5
export TRANSFORMERS_CACHE=$HOME/.cache/pig-command-compiler/transformers
```

Pi can also load the TypeScript extension directly via the package `pi.extensions` entry or with `pi -e ./src/index.ts`.

## Safety policy

Direct execution is allowed only when all are true:

- action has `directExec: true`
- no confirmation is required
- safety class is one of `read_only_local`, `read_only_network`, `local_capture`
- script path is relative
- script resolves inside the owning skill's `scripts/` directory
- required context is present

Failures return `continue` instead of improvising.
