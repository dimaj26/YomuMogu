---
name: local-delegation
description: How the agent offloads a self-contained sub-task to the local Ollama model (qwen2.5-coder:7b-16k) via claude-code-router — the rule and operational mechanism for local delegation.
---

# Local Task Delegation (Ollama)

This topic holds both the rule and the **operational reference** for *how* a fitting self-contained sub-task is offloaded to local Ollama. All of this is a **local dev-tool layer — nothing here is an app runtime dependency**, and the router config lives outside the repo (git-ignored user home), so it is absent from clean clones.

## Tooling layer — claude-code-router (CCR)

[claude-code-router](https://github.com/musistudio/claude-code-router) (npm `@musistudio/claude-code-router`, CLI `ccr`) is a local proxy that intercepts Claude Code traffic and routes each request to a provider per a routing table. It runs as a gateway on `http://127.0.0.1:3456`; config is at `%APPDATA%\..\.claude-code-router\config.json` (uses `$DEEPSEEK_API_KEY` env interpolation — no plaintext secret).

Routing was set per a delegated audit (`proposal-auditor`):

| CCR route | Provider/model | Rationale |
|---|---|---|
| `default` (routine) / `think` / `longContext` / `webSearch` | DeepSeek (`deepseek-chat`/`reasoner`) | strong + cheap, 1M context |
| `background` | Ollama `qwen2.5:7b-instruct` | local, $0; stable Russian commit msgs |
| `default` (frontier architecture) | Claude (Opus) | high cost of a plausible-but-wrong patch on strict ESLint boundaries |

`ccr code` launches Claude Code through the gateway; in-session `/model provider,model` switches the active model. **CCR routing is a separate concern from the autonomous offload below** — local delegation goes *directly* to local Ollama, never through the cloud routes.

## The delegation mechanism (autonomous offload)

When a sub-task passes the fit criteria, offload it **directly to local Ollama** (no cloud), take the text back, review it, and integrate it yourself. Two equivalent invocations:

```bash
# OpenAI-compatible endpoint (preferred — scriptable, parseable JSON)
curl -s http://localhost:11434/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"qwen2.5-coder:7b-16k","messages":[{"role":"user","content":"<task>"}]}'

# or interactive one-shot
ollama run qwen2.5-coder:7b-16k "<task>"
```

**Model.** `qwen2.5-coder:7b-16k` = base `qwen2.5-coder:7b` (Q4_K_M, ~4.7 GB) + a Modelfile that bakes `PARAMETER num_ctx 16384`. 16k context is the ceiling that stays 100% on the RTX 3070 8 GB VRAM (KV cache ~0.9 GB, no spill to RAM). Context is baked per-model because `OLLAMA_CONTEXT_LENGTH` is unreliable against the Windows tray-managed Ollama server. 32k is possible only with `OLLAMA_KV_CACHE_TYPE=q8_0` + `OLLAMA_FLASH_ATTENTION=1`.

## When to delegate

Delegate **only when ALL hold** (full criteria + the never-delegate list follow):
- Self-contained and fits ≤16k tokens of context (no large multi-file repo context).
- Mechanically verifiable by you (lint/test/eyeball) before use.
- Off the critical architectural path; low cost of a plausible-but-wrong answer.

Fits: isolated pure functions, regex/patterns, format/data transforms, boilerplate scaffolds, code explanation/summary, simple unit-test skeletons, small mechanical single-file edits. **Never** delegate frontier/architectural changes, modularity-sensitive patches (a semantically wrong patch can pass ESLint — fail-fast and linter-compliance still matter), or code requiring stable Russian comments/logs/UI committed as-is (7B is unstable on Russian).

## Guardrails & ops

- **No silent delegation.** Always state what was sent to Ollama and what came back; review/rewrite the output before any commit. Autonomous DeepSeek/cloud delegation is out of scope.
- **Server up.** Ensure `ollama serve` is running (Windows usually keeps a tray server alive). `ollama ps` shows the loaded model, its `CONTEXT` (expect 16384), and `PROCESSOR` (expect 100% GPU).
- **Privacy.** Local Ollama keeps code on-machine; never route secret-bearing tasks to a cloud provider.
