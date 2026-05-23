# Debugging pig-command-compiler

This repo now has one canonical persistent debug log for compiler behavior:

```text
~/.pig/agent/logs/pig-command-compiler.jsonl
```

Override it with:

```bash
export PIG_COMMAND_COMPILER_LOG_DIR=/path/to/log-dir
```

## What is logged

The JSONL debug log records:

- `/compiler-route <text>` decisions and errors
- normal Pig input routing decisions
- direct-exec results
- Transformers embedding extractor errors, including model/cache settings

The log is best-effort and must never block routing.

## Useful commands

Inside Pig:

```text
/compiler-debug-info
/compiler-route whats the weather today
```

`/compiler-debug-info` shows the debug log path, session root, cwd, pid, and embedding-related environment in Pig's footer/status area only. It does not add debug text to the conversation.

`/compiler-route <text>` runs `<text>` as a normal user turn using the same compiler/direct-exec path as ordinary input. Route/debug details go only to the footer and JSONL log; they are not included in the model-visible prompt.

Tail the compiler log from a shell:

```bash
tail -f ~/.pig/agent/logs/pig-command-compiler.jsonl
```

Pretty-print recent events:

```bash
tail -n 20 ~/.pig/agent/logs/pig-command-compiler.jsonl | jq .
```

Find embedding failures:

```bash
rg 'transformers_embedding_extractor_error|compiler_route_error|input_error' ~/.pig/agent/logs/pig-command-compiler.jsonl
```

## Session history vs runtime debug logs

Pig conversation/session history is stored under:

```text
~/.pig/agent/sessions/
```

Those JSONL files are for conversation state. They may not contain stderr/stdout warnings printed by extensions or the TUI. For pig-command-compiler runtime debugging, use the canonical debug log above.

## Embedding runtime settings

Defaults:

```bash
PIG_COMMAND_COMPILER_EMBEDDINGS=1
PIG_COMMAND_COMPILER_EMBEDDING_MODEL=Xenova/all-MiniLM-L6-v2
PIG_COMMAND_COMPILER_EMBEDDING_THRESHOLD=0.58
PIG_COMMAND_COMPILER_EMBEDDING_TOP_K=5
TRANSFORMERS_CACHE=$HOME/.cache/pig-command-compiler/transformers
```

Disable embeddings for fast/offline checks:

```bash
PIG_COMMAND_COMPILER_EMBEDDINGS=0
```

Important: `npm run test:embedding` proves the repo test environment can load embeddings. Pig may still fail if its runtime environment, cwd, module resolution, or cache permissions differ. Check `/compiler-debug-info` and the debug log to compare.
