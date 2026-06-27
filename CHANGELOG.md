# YomuMogu Changelog

All notable changes to the YomuMogu project are documented in this file. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [2.8.0] - 2026-06-28

### Fixed
- **State-aware mascot greeting (`specs/008-state-aware-mascot/`, fixes 004 finding C-10).** The home mascot bubble told a level-0 learner «…Перейди в раздел практики и выбери тему!» — but there is no "Практика" nav entry and the line ignored the dashboard's adaptive state, misdirecting first-run users away from the diagnostic the CTA actually offers. `getMascotBubbleHtml` now takes `dashState` and its level-0 greeting mirrors it: first-run → diagnostic, newbie → warm-up, returning → reviews/continue, all-done → neutral done, generic fallback otherwise — so mascot and primary CTA always agree. The resume-session bubble, the `customBubbleText` path, and the Japanese greetings (level ≥1) are unchanged; no nav entry added, no CTA/FSRS change. Covered by `src/app/__tests__/home-grid.test.tsx` (first-run → points to diagnostic, no «раздел практики»). Still deferred from 004: C-03 cap/selector, C-07/C-08 competency level + N3–N1 grammar, C-12 MeCab fallback, C-14 landing, C-15 debug HUD.

## [2.7.0] - 2026-06-28

### Fixed
- **Honest review feedback on day one (`specs/007-honest-review-feedback/`, fixes 004 finding C-09).** The `/practice` "Активное повторение слов" card congratulated «Все активные слова повторены! Отличная работа.» whenever no cards were due — including for a brand-new learner who had never reviewed anything (a freshly initialized all-`new` deck), which is false praise that erodes trust. The no-due message is now three-way: cards due → existing count; no due **but** ≥1 word in review/learning → genuine congratulations (preserved); no due **and** no active words yet → a neutral «Повторений пока нет — начните с разминки слева…» pointing to the warm-up. Signal derived from the already-loaded `words` (status review/learning); no new data, no schema, no FSRS/button/count change. Covered by `src/app/practice/__tests__/page.test.tsx` (all-new → neutral; active-not-due → praise; due → count). Still deferred from 004: C-03 session-size cap/selector, C-07/C-08 competency level + N3–N1 grammar (root cause documented in the 004 analysis).

## [2.6.0] - 2026-06-28

### Fixed
- **Prioritized review ordering (`specs/006-review-ordering/`, partial fix for 004 finding C-03).** The FSRS interval-review quiz presented due cards in a **random** order (`sort(() => Math.random() - 0.5)`), so a learner with a large backlog might never reach the cards that need it most. The review (default) mode now orders the due queue **deterministically by need** — more lapses first, then weaker memory (lower stability), then more overdue (earlier `due`) — so every session (even an interrupted one) spends effort on the most fragile cards first. Scope is surgical: only review-mode ordering changes; the new-word and unused-target modes, FSRS scheduling/grading, and the practice screen are untouched, and the full due set is still presented (**no session cap** — that, plus a user-facing session-size selector, is deferred because a silent cap would contradict the practice «Начать повторение [N]» count and needs a product decision). Covered by `src/app/practice/quiz/__tests__/page.test.tsx` (most-lapsed-first; weaker-memory-first on equal lapses). Still deferred from 004: C-07 (competency-engine level), C-08 (JLPT level unlocking + missing N3–N1 grammar).

## [2.5.0] - 2026-06-28

### Fixed
- **Memory map scales to the real deck (`specs/005-memory-map-scale/`, fixes 004 finding C-02).** The home "Очаги памяти (Сетка Кумико)" heatmap was hardcoded to the first 500 words (50 cells × a fixed 10-word window) with a caption that always said "500 слов". A learner with a larger deck (e.g. an advanced user with thousands of words) saw only the first ~12.5% of their vocabulary and a wrong count. The heatmap now bins the **entire** deck across its 50 cells via a dynamic bucket (`Math.max(1, Math.ceil(total/50))`) so no words are dropped, and the caption shows the **actual** word count. The 50-cell visual, FSRS/scheduling, per-cell aggregation, and the feature-003 uninitialized caption are unchanged. Covered by `src/app/__tests__/home-grid.test.tsx` (large >500 incl. a no-drop check, exactly-500 regression, small <500, uninitialized). Deferred (larger/architectural): 004 C-03 review session-sizing, C-07 competency-engine level (balance widget N5), C-08 JLPT level unlocking + missing N3–N1 grammar.

## [2.4.0] - 2026-06-27

### Added
- **Persona cognitive walkthrough (`specs/004-persona-cognitive-walkthrough/`).** Drove the live app in a real browser (Playwright MCP) from three seeded learner personas — P1 absolute beginner (organic, no Anki), P2 returning beginner (light seed + organic chat/quiz/media use), P3 advanced master (~4000 JLPT N3–N1 words seeded across FSRS states) — each in an isolated profile, evaluating clarity / next-step / missing-function / convenience and the **learning-logic** on every screen. Services used for real where available (Gemini up → real chat + session generation; MeCab/Anki down → recorded as blocked, not mocked). Deliverables: `personas.md`, three dated persona reports, and a **consolidated problem/solution analysis** (16 findings, cross-persona matrix, distinct learning-logic section, prioritized do-next list). Analysis-only — no application source changed. Headline result: the core learning loop (words → AI themes → chat target-tracking → deck-aware media) is strong and coherent; the gaps are at the edges — progress/identity mirror (header shows 0 vs real deck), memory map limited to 500 words, no review session-sizing/level-scaling, and session generation that stalls at scale. Reuses the feature-002 procedure and feature-001 MCP.

## [2.3.0] - 2026-06-27

### Fixed
- **Onboarding flow clarity (`specs/003-onboarding-flow-clarity/`).** Resolved the four actionable findings from the 002 cognitive walkthrough (F-05 left as benign dev-build noise), under the proposal-audit constraint that the diagnostics-as-gate funnel is intentional and must not be broken (no auto-seed, no new fresh-profile nav into quiz/chat — only copy/CTA/doc/conditional-text changes):
  - **F-02**: the empty `/chat` state (no active session) now routes its CTA to `/practice` (where sessions are actually started) instead of `/settings`, relabelled «Перейти к практике».
  - **F-03**: the disabled «Начать разминку» button on `/practice` now shows a short explanatory line for a fresh profile (`!isLocalInitialized`) linking to the diagnostic, mirroring the existing `hasStudyContext` progressive-disclosure pattern; the gate itself is unchanged.
  - **F-04**: the home Kumiko-grid description is now conditional on `isLocalInit` — before initialization it no longer claims "500 слов" and instead points to the diagnostic, ending the cross-screen contradiction with `/practice` and `/settings`.
  - **F-01**: rewrote `knowledge/architecture.md` [CP-2.1] Core User Flow as local-first (home/settings → diagnostic → seeded deck → practice → session → chat), with Anki as a labelled opt-in branch; removed the numbered-list-vs-prose contradiction.
  - Each UI change ships with accompanying Vitest/RTL tests (chat/practice co-located suites + new `src/app/__tests__/home-grid.test.tsx`); full suite green (532 tests).

## [2.2.0] - 2026-06-27

### Added
- **Browser-driven cognitive analysis (`specs/002-browser-cognitive-analysis/`).** Defined a repeatable **cognitive-walkthrough** procedure (`knowledge/cognitive-walkthrough.md`, linked from `CONTEXT.md`) that dogfoods the feature-001 Playwright MCP: an agent drives the live dev app headlessly across its core routes (`/`, `/practice`, `/practice/quiz`, `/chat`, `/settings`), records per-screen structure, navigation outcome, console + network health signals, and a screenshot, assembles a "cognitive map", and cross-checks observed behavior against the `knowledge/` docs to surface drift/broken-flow/UX findings. Output is a dated, append-only report under the feature's `reports/` folder (contract in `contracts/report-contract.md`). Dev-tooling/analysis only — no application source or runtime-dependency changes. First run **2026-06-27** produced 5 findings (Anki-centric core-flow doc-drift, `/chat` empty-state CTA mismatch, fresh-profile reachability gaps for `/quiz` & `/chat`, Kumiko-grid vs uninitialized-deck signal, and an app-wide CSS-preload console warning).

## [2.1.0] - 2026-06-27

### Added
- **Playwright MCP integration (`specs/001-playwright-mcp/`).** Registered the upstream `@playwright/mcp` server (pinned `@0.0.76`, run via `cmd /c npx` on Windows, `--isolated --headless --browser chromium`) so coding agents can drive a real browser against the running dev app — navigate, click, fill, read DOM, screenshot — with no per-session setup. Dev-tooling only: adds no runtime dependency to the app and does not replace the `@playwright/test` e2e suite. Wired into **both** supported runtimes: Claude Code (committed project-scoped `.mcp.json`) and opencode (`mcp` key in `.opencode/opencode.json`). Documented in **`knowledge/mcp-playwright.md`** (linked from `CONTEXT.md`): prerequisites (including the `npx @playwright/mcp@0.0.76 install-browser chrome-for-testing` browser install), per-runtime wiring, Windows notes, and troubleshooting. Validated end-to-end in both runtimes (navigate → read DOM → screenshot against the running app). Runs `--headless` by default (no window for agent-driven use). Decision recorded in **`knowledge/decisions/0003-playwright-mcp-integration.md`**.

## [2.0.1] - 2026-06-27

### Added
- **`knowledge/spec-kit-reference.md`** and **`knowledge/graphify-reference.md`** — working reference docs distilled from the spec-kit and graphify GitHub sources. spec-kit ref: the `specify` CLI, all 11 `/speckit-*` skills, end-to-end workflow scenarios, `.specify/`+`specs/` layout, template resolution, and project gotchas. graphify ref: the full command surface (`query`/`path`/`explain`/`affected`/`update`/exports), the AST-vs-semantic build pipeline (god nodes, communities, audit trail), outputs, and integrity guarantees. Both linked from `CONTEXT.md`.

## [2.0.0] - 2026-06-27

### Changed (BREAKING)
- **Migrated the development workflow from the Aethel protocol to spec-kit (Spec-Driven Development), hybrid mode.** Task requests are now handled by `/speckit-specify → -plan → -tasks → -implement` (feature branch + `specs/NNN-slug/`), governed by `.specify/memory/constitution.md` (rewritten from a stub into a real v1.0.0 constitution carrying the surviving principles: Test-First, fail-fast, layered/facade boundaries, no-placeholders, PowerShell/venv, EN-docs/RU-comments, auto-commit + push-needs-approval, keep-graphify-fresh).

### Removed
- Aethel governance: `AETHEL.md`, `aethel.toml`, `prompt_linter.py`, `.aethel/` scratch, and the pure-process knowledge topics (`agents.md`, `session-lifecycle.md`, `skills.md`, `spec-kit-bridge.md`). Uninstalled `aethel-cli` from the venv. Per a Route-D audit (idea 0/6, plan 4/6) the migration was taken in **hybrid** form to retain machine enforcement.

### Added
- **`scripts/spec_sync_guard.py`** — a lightweight pre-commit doc-drift guard replacing the Aethel `[sync]` linter: staged `src/**` code must ship with a spec/doc update (`specs/**`, `knowledge/**`, the constitution, `CONTEXT.md`, or `CHANGELOG.md`) in the same commit; bypass `SKIP_SPEC_SYNC=1`. Wired into `.husky/pre-commit` step 2.

### Kept
- Code-quality gate (`lint-staged` ESLint+Ruff) and all graphify hooks (`post-commit`/`post-checkout` rebuild + pre-commit `graph_doc_sync.py`) are untouched. The `knowledge/` architecture/domain tree is retained as reference, scrubbed of Aethel governance terminology and dead links.

## [1.74.0] - 2026-06-27

### Added
- **GitHub spec-kit bridged into Aethel as an optional SDD task-request handler.** Installed `specify-cli` (via `uv tool install`) and ran `specify init --here --integration claude --script ps`, scaffolding `.specify/` (PowerShell scripts, templates, manifests, constitution) and 11 `/speckit-*` skills under `.claude/skills` (git-ignored, local-only). Mode = **Bridge**: Aethel stays master orchestrator and on conflict the core wins. New topic `knowledge/spec-kit-bridge.md` maps each spec-kit phase onto an Aethel route (`/speckit-specify`→Route B "what", `-clarify`→Route D grill-me, `-plan`→`implementation_plan.md`, `-tasks`→`task.md`, `-analyze`/`-checklist`→`aethel lint`, `-implement`→chunked Route B + GW-1) and declares Aethel artifacts/gates authoritative (anything under `specs/` is a supporting aid). `.specify/memory/constitution.md` rewritten from template to a thin AETHEL deferral stub (no second rulebook). Route C wiring: `CONTEXT.md` index link, `AETHEL.md` project section, `knowledge/skills.md` registry entry. `aethel lint` green.

## [1.73.0] - 2026-06-27

### Added
- **Pre-commit graph-doc-sync trigger (`scripts/graph_doc_sync.py`).** Closes a verified gap: graphify's `post-commit`/`post-checkout` hooks call `_rebuild_code` (code + doc AST only, offline) and **clear** the native `needs_update` flag, so spec edits (`AETHEL.md`, `CONTEXT.md`, `knowledge/**`) left the graph's **semantic** doc nodes silently stale. The new non-gating pre-commit step detects staged spec-`.md` (A/C/M/D/R, excl. `_nogit_`) and launches a **detached** `graphify . --update` (semantic LLM re-extraction, DeepSeek). Form **C+**: the detached child owns the native `needs_update` flag — set before, **cleared on success, kept on failure** — so freshness is automatic yet a failed run stays visible to `graphify check-update` / `/graphify`. Always `exit 0` (never blocks a commit); bypass via `GRAPHIFY_SKIP_DOC_SYNC=1`. Chosen over auto-only (C) and notify-only (B) via a Route D / PA-1 audit. Tests: parser (M/A/D/R/`_nogit_`/mixed) + visibility (fail→flag persists, success→cleared); ruff-clean. Docs in `knowledge/graphify-workflow.md` + `knowledge/lint-and-quality.md`.

## [1.72.4] - 2026-06-27

### Added
- **`knowledge/local-delegation.md` — operational reference for Route A.O.** Documents the delegation *mechanism* (the AETHEL rule only stated the one-line "how"): CCR routing table (default→DeepSeek / background→Ollama / frontier→Claude), the direct local-Ollama offload (`curl localhost:11434/v1/chat/completions` or `ollama run`, model `qwen2.5-coder:7b-16k`), the 16k-context/Modelfile rationale for RTX 3070 8 GB, fit criteria, and guardrails. Linked from `CONTEXT.md` (Quality & Process).

## [1.72.3] - 2026-06-27

### Added
- **`AETHEL.md` Route A.O — Local Delegation sub-route (project rule).** A sub-route of Route A/B execution: self-contained sub-tasks matching the local `qwen2.5-coder:7b-16k` model (≤16k context, mechanically verifiable, off the critical architectural path) MAY be delegated to **local Ollama only — never DeepSeek/cloud**. Never delegate frontier/architectural changes or code needing stable Russian comments; no silent delegation (always state what was offloaded), review output before commit. Backs the claude-code-router local dev-tool setup (CCR gateway on `127.0.0.1:3456`; routing default→DeepSeek, background→Ollama, frontier→Claude per a Route D/APA-1 audit).

## [1.72.2] - 2026-06-27

### Fixed
- **Cheap ESLint warning cleanup (93 → 58).** Stripped 21 unused `catch (e)` bindings to `catch {` and removed 14 dead imports across 23 files — purely mechanical, no logic change. Left the semantic warnings untouched (`set-state-in-effect` SSR pattern, `exhaustive-deps`, `no-img-element`, intentional state setters). `tsc` clean, 527/527 tests pass, ESLint 0 errors. Count updated in `knowledge/lint-and-quality.md`.

## [1.72.1] - 2026-06-27

### Fixed
- **Doc sync: removed dangling references to deleted local files.** `AETHEL.md` no longer claims `_nogit_legacy_gemini.md` is preserved (pre-migration prompts live in git history), dropped the `_nogit_legacy_*.md` file-map row, and removed the now-deleted `feedback` doc from the graphify-first carve-out list. Added `.graphifyignore` (tracked) and `graphify-out/` (local) to the file map. Verified: test count in `testing.md` (527/77) and stack versions already current.

## [1.72.0] - 2026-06-27

### Changed
- **Safe dependency refresh (patch/minor only).** Bumped `next` + `eslint-config-next` 16.2.6 → 16.2.9, `react`/`react-dom` 19.2.4 → 19.2.7, `@google/genai` 2.4.0 → 2.10.0 (API unchanged — `models.generateContent` + `responseSchema` pattern verified current via Context7), `dompurify` 3.4.5 → 3.4.11 (sanitizer hardening), `@playwright/test` 1.60 → 1.61.1, `vitest` 4.1.7 → 4.1.9, `dexie` 4.4.2 → 4.4.4, `lucide-react` 1.16.0 → 1.21.0, plus in-range patches (`@types/react`, `@vitejs/plugin-react`, `lint-staged`). Verified: `tsc` clean, 527/527 unit tests pass, ESLint 0 errors. **Deliberately deferred** the major bumps (`typescript` 6, `eslint` 10, `@types/node` 26) — out of scope, need dedicated review.
- **Cleared all `npm audit` advisories** via non-breaking `npm audit fix` (no `--force`, lockfile-only): patched transitive `undici`, `protobufjs`, `vite`, `ws`, `js-yaml`, `@babel/core` within existing semver ranges → **0 vulnerabilities**. Mostly dev/build tooling + HTTP libs exercised only against trusted endpoints (Gemini, localhost Anki); majors untouched, 527/527 tests still pass.

## [1.71.0] - 2026-06-27

### Added
- **Adopted graphify as the code+docs knowledge-graph layer.** `graphifyy==0.8.49` + `openai==2.44.0` pinned in `requirements.txt`; the repo is indexed by `graphify .` into `graphify-out/graph.json` — tree-sitter AST over 226 code files plus **semantic LLM extraction of the markdown spec** (`AETHEL.md`, `CONTEXT.md`, `knowledge/*.md`, `README`, `CHANGELOG`) via the DeepSeek backend (`DEEPSEEK_API_KEY`). `.graphifyignore` excludes only images (text-only backend); `graphify-out/` is git-ignored (rebuilt locally). New topic `knowledge/graphify-workflow.md` (linked from `CONTEXT.md`).
- **`AETHEL.md` graphify-first reading protocol (project rule).** Code AND doc comprehension/navigation must start from the graph (`query`/`explain`/`path`/`affected`); only files outside the graph (git-ignored `_nogit_*` strategic docs, scratch, secrets, `jitendex/`, images) are read directly. Skill registered globally for Claude Code (`~/.claude/skills/graphify/`).

## [1.70.0] - 2026-06-26

### Changed
- **Split the 3 over-budget knowledge topics** (Aethel `max_topic_tokens=2500`) to shrink per-task context: `module-registry.md` (4840 tok) → `module-registry-core.md` / `-app.md` / `-lib.md` (by layer); `coding-rules.md` (3326) → general rules + `coding-rules-integrations.md` (Gemini/storage/API/testing); `architecture.md` (2760) → identity/stack/flow + `directory-layout.md` (the `src/` tree). `CONTEXT.md` index repointed; all `[PL-]/[CP-]` anchors preserved. `aethel lint` now reports all topics within budget; lossless (no role rows dropped).

## [1.69.0] - 2026-06-26

### Changed
- **Upgraded Aethel `1.6.0 → 1.7.0` (core-rev 8 → 11).** `aethel update` refreshed the managed core block (custom project rules preserved; backup `AETHEL.md.bak.*`) and the pre-commit wrapper. New checks now active: **topic-size validation** (`max_topic_tokens=2500` → `module-registry.md`/`coding-rules.md`/`architecture.md` flagged for splitting), **tag anchor/collision validation**, incremental Route B commits (checklist completeness only at `--stage checklist`), and friendlier agent-registry errors. `aethel doctor` confirms the husky hook is `live` and core `consistent`.
- **Cleanup**: removed the duplicate `yomumogu-plugin` proposal-analysis skill in favour of the aethel-maintained `aethel-plugin` one (registry + skills doc repointed); deleted the regenerated `AETHEL_ONBOARDING.md`. Added `knowledge/session-lifecycle.md` (session mechanics the condensed core now defers to). `requirements.txt` → `aethel-cli==1.7.0`.

## [1.68.0] - 2026-06-26

### Changed
- **Aethel workflow guards escalated `warn → error`** (`aethel.toml`): `[sync] enforce` and `[sync] require_changelog` now **block** commits that stage code without a spec file, or stage `AETHEL.md` without `CHANGELOG.md` (escape hatch `AETHEL_SKIP_SYNC=1`). `[consistency] enforce` now **blocks** on managed-core divergence (until `aethel update`). `version_skew_enforce` deliberately left at `warn` (upstream lag, not a workspace defect). Documented in `knowledge/lint-and-quality.md`. This converts the post-migration guards from nominal (advisory) to actually enforcing.

## [1.67.0] - 2026-06-25

### Changed
- **Adopted the Aethel AI-orchestration protocol.** `AETHEL.md` is now the master orchestrator/rulebook; `GEMINI.md`/`CLAUDE.md`/`AGENTS.md` are thin local stubs that redirect to it. The legacy `PROJECT_LOGIC.md` and `CONTEXT_PROMPT.md` monoliths were migrated into the `knowledge/` topic tree (atomic files: architecture, module-registry, data-schema, api-contracts, gemini-patterns, anki-integration, progression-and-intervals, constraints, testing, lint-and-quality, coding-rules, features, design-system) indexed by `CONTEXT.md`, then removed. Legacy `[PL-x.y]`/`[CP-x.y]` indices preserved as headings so old references still resolve.
- **Workflow linters wired in** (`prompt_linter.py` / `aethel lint`): knowledge-index integrity, agent & skill registries, plan/task/walkthrough stage checks, spec-sync drift guard. Merged into `.husky/pre-commit` alongside `lint-staged` (ESLint/Ruff) — disjoint surfaces, no conflict.
- **Doc-sync protocol replaced**: the `yomumogu-docs-update` skill (`CMD-1..4`) was retired in favour of Aethel Route C (edit `knowledge/*.md` + fix the `CONTEXT.md` link in the same commit). The `proposal-analysis` audit engine was reclassified as an agent and registered.
- **Git rule: mandatory auto-commit** after every significant change without confirmation; only `git push` requires explicit user approval.

## [1.66.0] - 2026-06-20

### Changed
- **Legacy lint baseline fully cleared** ([PL-9.5]): the ~144 frozen `@typescript-eslint/no-explicit-any` / `ban-ts-comment` / `no-require-imports` errors across ~46 files were typed away in 7 reviewed batches (lib, core, ~20 API routes, components/hooks/pages, plugins). `eslint .` now reports **0 errors** (94 non-blocking warnings remain). No behaviour change — only types, narrowing, and comments.
- Established patterns: external/boundary values typed as `unknown` + `instanceof`/guard narrowing (Gemini/Anki/MeCab/YouTube payloads, `catch` blocks); minimal interfaces for untyped JSON (YouTube JSON3/InnerTube, caption tracks, starter deck); `Awaited<ReturnType<…>>` to reuse AnkiConnect return types; minimal `window.YT` IFrame API types (removing 7 `@ts-ignore`).
- Genuinely-unavoidable `any` retained behind documented `eslint-disable` (with Russian rationale): isomorphic Node `require` in `logger.ts`, the polymorphic `calculateNextFsrsState`, and the undocumented YouTube InnerTube search JSON navigation.

### Fixed
- `eslint.config.mjs`: the `react-hooks/set-state-in-effect` override now registers the `react-hooks` plugin in its own flat-config object and is scoped to `*.{ts,tsx}`, so `eslint .` over non-TS files no longer config-errors.

### Notes
- Verified after every batch and at the end: `npx tsc --noEmit` clean, **527/527** tests green, `next build` OK. Tooling (`MediaItem.trackKind`, `LegacyWordRecord`, `GrammarScopeNode`) extended only where the data already carried the fields.

## [1.65.0] - 2026-06-19

### Added
- **Architectural boundary lint** ([PL-9.5], rule set v2): two machine-enforced invariants that previously lived only as text in [PL-8]. `no-restricted-syntax` blocks direct `localStorage` outside `lib/profile.ts` ([CP-3.4]); `no-restricted-imports` blocks `@google/genai` outside `lib/gemini/**` ([CP-3.3]). Allow-overrides for `profile.ts`, `DebugDrawer` (dev storage inspector), `lib/gemini/**`, and the test zone. `sessionStorage` left out of scope (no registry helper). The two legacy Gemini routes (`api/chat/analyze`, `api/anki/add`) grandfathered via a file-scoped config override (they already use `withRetry`; left untouched). Recon showed near-zero real prod debt — most apparent hits were comments or `sessionStorage`.
- **Test-quality gate** (`eslint-plugin-vitest`, test files only): `expect-expect`, `no-disabled-tests`, `valid-expect` (`maxArgs: 2`), `no-identical-title` as errors — blocks empty/assertion-less/disabled/duplicate tests. Soft rollout found 0 real violations across 527 tests (4 false positives fixed by calibration).
- **Python quality via Ruff** (`ruff.toml`): Ruff linter + formatter for the 2 Python files, conservative rules (`F` + `E4/E7/E9`), wired into the pre-commit gate for staged `*.py`. Installed in the local `venv`.

### Changed
- **`CONTEXT_PROMPT.md` AI conventions** ([CP-3.1]/[CP-3.6]): prefer `unknown` + type guard over `any` at external boundaries; do not auto-delete unused code mid-generation (cleanup is a deliberate step); no hollow or over-mocked tests.
- **Python files reformatted** by Ruff (`server.py`, `lookup.py`) — whitespace/wrapping only, no logic change (`py_compile` verified).

### Notes
- Derived from a 6-rule quality proposal audited per-rule (6× PA-1). Only the low-footprint, machine-enforceable subset shipped; the rest became AI conventions or were deferred (Prettier, fix-on-save, "full" any-ban, interval-literal lint, redundant-mock detection — no cheap machine signal). Priority was minimal refactor/footprint and stability: **0 source refactors**, all changes are config/docs plus formatting. Suite 527/77 green, `tsc --noEmit` clean, `next build` OK.

## [1.64.0] - 2026-06-19

### Added
- **Lint enforcement (pre-commit + CI)** ([PL-9.5]): the already-present ESLint 9 setup was never enforced and the codebase had never passed it (469 problems). Now wired as a quality gate. `husky` + `lint-staged` (dev-only) run `eslint --no-warn-ignored` on **staged** `*.{ts,tsx}` via `.husky/pre-commit` — errors block the commit, warnings do not. A GitHub Actions workflow (`.github/workflows/lint.yml`) lints only files **changed vs the base commit**, so the frozen legacy baseline never reds CI while new code must be clean.

### Changed
- **`eslint.config.mjs`**: added a test-files override block (disables `no-explicit-any` / `no-unused-vars` / `ban-ts-comment` for `__tests__/`, `*.test|spec.{ts,tsx}`, `tests/`, Vitest setup — mocks legitimately use `any`); ignored `scratch/**` (temporary diagnostic scripts per CP-3.9); downgraded `react-hooks/set-state-in-effect` to `warn` (it conflicts with the project-mandated SSR/init pattern — deferred `localStorage` reads & DOM measurement in `useEffect`, CP-3.4). Net lint result: 469 problems → 144 accepted-baseline errors, **0 `react-hooks` errors**.

### Fixed
- **React-hooks correctness bugs** surfaced by the gate: `ScienceTip` called `useEffect` after an early `return` (`rules-of-hooks`) and created a fallback icon component during render (`static-components`) — hooks reordered, fallback hoisted to module scope (resilient to partial `lucide-react` mocks via `typeof Info` + try/catch). `PhonosemanticHint` read `bodyRef.current.scrollHeight` during render (returned 0 on first open) — moved to a `useLayoutEffect` measurement. `MediaInteractivePlayer` synced `segmentsRef` during render — moved to an effect. Remaining intentional patterns (write-through `mnemonic` cache, `Date.now()` in event handlers/display badges, TDZ-safe timer refs, E2E debug data-attr) documented with targeted `eslint-disable` + Russian rationale.
- **`tokenSpans` implicit-`any[]`** in `MediaInteractivePlayer`: an earlier `let → const` autofix broke TypeScript's evolving-array inference; pinned with an explicit `{ start: number; end: number }[]` type (caught by `next build`, not the test suite).

### Notes
- Suite stays **527 tests / 77 files** green; `tsc --noEmit` clean; `next build` succeeds. A transient regression during the work (direct `<Info/>` crashed 43 page tests under partial `lucide-react` mocks) was caught and fixed before completion.

## [1.63.1] - 2026-06-19

### Fixed
- **Media tap-to-add (immersion → active loop)** (roadmap §2.7 B2.1): tapping a word in the interactive subtitle player was Anki-only and lossy. Now: (1) the active subtitle line is sent as **live context** (`history` to `/api/anki/add`, or directly into `contextExamples` in local mode) so the card example comes from the video instead of a synthetic Gemini sentence; (2) after an Anki add the word is pulled into the local FSRS engine immediately via `syncLocalDatabaseWithAnki` (parity with the chat path); (3) a **local fallback** writes straight to IndexedDB FSRS via `addWord` when `NEXT_PUBLIC_ANKI_ENABLED='false'` or the profile is in `local` deck mode — no Anki/Gemini calls; (4) the daily new-words limit is respected with a soft non-blocking notice (a tap is a deliberate user choice) and `incrementDailyNewWordsCount`.
- **`addWord` hardening** (`core/localDeckService.ts`): now the single entry point for tap-to-add — dedup guard by (word + reading) pair so homonyms (生 なま / せい) stay distinct and repeat taps are idempotent (`alreadyExists`), collision-safe `id` (the old `Date.now()` could overwrite on two fast taps sharing the `[profileId+id]` key), and an optional `contextSentence` argument stored into `contextExamples`.

### Notes
- Suite now **527 tests / 77 files** green, `tsc --noEmit` clean. New coverage: `addWord` dedup/homonym/context/id reproducers and a media local-mode tap-to-add test (asserts no `/api/anki/add` call).

## [1.63.0] - 2026-06-19

### Changed
- **Dual-curve FSRS collapsed to a single `active` curve** (roadmap §2.6, authoritative finalization). Code proved the passive curve carried no independent information (it was always `active × 2.5`, and a "passive review" was a dumb `due` shift without memory math). Per §2.6, passive learning is immersion (content comprehensibility + decaying furigana, both already computed off `active`), not a measured `due`-scheduled subsystem. Removed: the `type === 'passive'` branch and `passiveState` generation in `core/scheduler.ts`, the `alignPassiveToActiveState` function and all its call sites (`db.ts`, `chat`, `quiz`), the `passive` field from `LocalWord` ([PL-3]), and the `passive.due` index. "Known" for the media comprehensibility gate ([useMediaRecommendation]) is now computed from `active` only. This drops the design-scale state count from ~30k to ~15k (one curve per word) and simplifies the scheduler, Anki replay, and future budget/anti-avalanche work.
- **Chat no longer records passive reviews**: a word that was merely *seen* in a sensei reply produces no review; only *collected* (used) words record an `active` review. The reply-timing telemetry (`passiveTurns` + the "Среднее время реплики" summary block) was removed (passive = immersion, not measured). The results-screen lock indicator (interval-not-yet-due) is retained; its CSS class was renamed `passiveCheck → lockedCheck` to drop the misleading "passive" name.
- **IndexedDB schema → version 8**: drops the `passive.due` index and strips the legacy `passive` field from existing word records during the Dexie upgrade ([PL-3.4]).

### Removed
- `LocalWord.passive` field; `alignPassiveToActiveState`; `passiveTurns` chat telemetry; the dead "skip passive review" branch in `/api/anki/sync-db`.

### Notes
- Behavior-preserving for the active scheduling path; full suite green at **522 tests / 77 files**, `tsc --noEmit` clean. New reproducers: `core/__tests__/db.test.ts` (v8 migration: `stripPassiveWord` + absence of `passive.due` index) and `core/__tests__/scheduler.test.ts` (single active curve, no `passive` field emitted).

## [1.62.12] - 2026-06-18

### Added
- **Journey (golden-path) test layer** (`src/__tests__/journeys/`): a new deterministic, integration-level test category that exercises a full cross-system user flow end-to-end in one test — local deck seed → chat entry gating ([PL-5.9]) → daily active pool ([PL-6]) → `/api/gemini/sessions` and `/api/chat` route handlers → FSRS review recording. The Gemini boundary is fully mocked ([CP-3.6]) and storage uses `fake-indexeddb`, so journeys are fast, hermetic, and run in the default `npm run test` suite (no live Gemini/Anki/MeCab). First journey: `local-onboarding.journey.test.ts` (golden path + negative gating with fewer than 5 active words). Test suite is now 521 tests across 77 files.

## [1.62.11] - 2026-06-18

### Changed
- **Daily quests are progressively disclosed for newbies** (UX Phase 3 #9 / F6, final plan item): the Reviews/Chats/Mnemonics quests reference concepts (FSRS reviews, mnemonics) a day-one user has no context for. The quest list on `/practice` is now hidden behind a soft hint ("Ежедневные задания появятся, когда вы начнёте заниматься…") for a brand-new local user whose every word is still `new`; it appears once they have any word in study (learning/review/mature), or immediately in Anki mode. Broader term/jargon de-cluttering for newbies was already handled in Phase 1 (#3) and the level-gated content japanization (#7).

## [1.62.10] - 2026-06-18

### Changed
- **Content japanization is level-gated for newbies** (UX Phase 3 #7, completes P0 japanization): in Smart mode, content elements no longer auto-japanize from level 0 — `JpUIProvider.upgradeWord` is gated by a new `CONTENT_JP_MIN_LEVEL` (2), so a zero-day user keeps content in Russian and only sees japanized UI once they've grown into it (chrome/navigation already never japanizes). Already-learned words are unaffected (the immersion level never decreases).
- **Language switcher explains its modes**: the `LanguageSwitcher` dropdown now shows a short description under each mode — Russian / Smart / 日本語 — with the Smart note explaining that the interface gradually becomes Japanese and that progress can be reset in Settings (where the existing "Сбросить FSRS интерфейса" control lives).

## [1.62.9] - 2026-06-18

### Added
- **Romaji input in warm-up and quiz** (UX Phase 3 #8 / F10): typing a reading required a Japanese keyboard/IME — a blocker for a no-IME user. New pure `lib/quiz/romaji.ts` (`romajiToHiragana`) converts romaji to hiragana (digraphs きゃ/しゃ/ちゃ, っ doubling, ん handling; kana/kanji pass through). `isAnswerAcceptable` now accepts an answer if it matches directly OR after romaji→kana conversion, so both the quiz (`/practice/quiz`) and the warm-up reading step are fixed by one change. A non-destructive kana preview ("→ かな") shows under the field while typing latin letters; "Показать ответ" remains as a fallback. No new dependencies.

## [1.62.8] - 2026-06-18

### Added
- **Unified "service unavailable" pattern** (UX Phase 2 #6 / P1, completes the work started in 1.62.3): new server-side `lib/gemini/errors.ts` classifies AI failures into `config` (bad/missing key — not retryable), `transient` (429/500/503/network — retryable), or `unavailable`, and returns a `{error, reason, retryable}` contract with a human Russian message; the raw exception (e.g. "fetch failed") now stays in the logger only. All Gemini routes (`sessions`, `grammar-verify`, `etymology`, `classify`, `chat`) use it and no longer leak `error.message` or the literal `GEMINI_API_KEY` to the UI. New reusable `ServiceUnavailable` component (human title + optional "what still works" hint + a Retry button shown only when the failure is retryable) is wired into chat-theme generation (`/practice`) and grammar verification (`GrammarTrainer`). Network errors (undici "fetch failed", ECONNREFUSED, …) are now retryable inside `withRetry` instead of throwing immediately.

## [1.62.7] - 2026-06-18

### Changed
- **Dashboard is now an adaptive daily hub** (UX Phase 2 #5 / P0): `page.tsx` used a single static `→/practice` CTA for everyone (only "resume chat" adapted), and the marketing H1 showed to returning users. It now reads existing `localDeckService` signals (`isLocalDeckInitialized`, `getPriorityWordsCount`, due-review count) and renders one state-appropriate primary action: first-run → «Пройти диагностику (5 мин)» (modal opens on `/`, no redirect to settings); unfinished chat → «Продолжить: {тема}»; returning (due reviews) → «Продолжить обучение» + «N к повторению»; newbie (new words, no due) → «Начать разминку»; all done → neutral «На сегодня всё» with a media link; Anki mode → generic «Начать практику». The marketing H1 now appears only on first run; other states get a compact greeting. No forced "day wizard" — one CTA plus a soft hint.

### Refactored
- **Extracted `AssessmentModal` component** (`components/AssessmentModal.tsx` + module CSS) from the settings page so the knowledge-diagnostics flow can be reused on both `/settings` and the dashboard. Behavior-preserving: settings still routes to `/practice` after save (via `onSaved`); the F5 reproducer stays green.

## [1.62.6] - 2026-06-18

### Fixed
- **Service UI (navigation) no longer auto-japanizes for a zero-day newbie** (UX Phase 2 #4 / P0): the dashboard nav (設定 / プロフィール / ヘルプ) was wrapped in `<JpUI>`, which in the default `smart` mode auto-"learns" one element per session via FSRS regardless of the user's level — a brand-new user saw Japanese navigation they never asked for. Added a `kind: 'chrome' | 'content'` prop to `JpUI` (default `content`); `kind='chrome'` renders Russian in `smart` mode and is never registered/upgraded into the UI-FSRS store, so it can't drift to Japanese. The three nav items are marked `chrome`. Explicit full-Japanese (`ja`) mode is unchanged (it's a deliberate user choice). 90% of the fix with no user action required.
- **Grammar node labels no longer leak raw Japanese/mixed category names** (F15): three "category" rules held a Japanese or mixed category name in `construction` (`動詞の分類`, `名詞修飾 / 〜の relative clauses`, `い / な-прилагательные`) — shown as the track node label and the popover title. Replaced with Russian-first labels keeping the grammar form as a hint (`3 группы глаголов`, `Определения к существительным (〜の)`, `Прилагательные (い / な)`). Node `id`s are unchanged, so AI grammar-scope validation (keyed by id) is unaffected.

## [1.62.5] - 2026-06-18

### Fixed
- **Raw sound-annotation tags no longer shown in subtitles** (`[音楽]`, `[拍手]`, `【…】` from YouTube auto-captions): new display-only pure helper `lib/media/captionDisplay.ts` (`stripCaptionAnnotations` / `stripAnnotationWords`) strips bracketed tags across all three player surfaces — the tokenized active line (cleaned before MeCab, with matching cache key in the health-poll invalidation), the raw-text fallback, and the transcript list. Music notes `♪` and parentheses `（）` are kept. Stored `segments` are never mutated (Prime Directive [PL-8.8]); to keep the karaoke fill front consistent, the `words[]` copy passed to `computeFillFraction` is stripped in sync so its char total matches the speech-only tokens. Approach audited via Route B (Variant A hybrid, Optimality 6). Closes the deferred tail of UX Phase 1 #3.

## [1.62.4] - 2026-06-18

### Changed
- **Humanized newbie-facing copy and signals (Phase 1 #3 of the UX fix plan)**: removed developer jargon and softened alarming states a first-day user meets. Media recommendation cards no longer paint a low/0% comprehension rate in red (0% is normal for a beginner, not an error) — low values render neutrally while the 50/70/85% tiers keep their colors. The "few priority words" practice banner is reworded as encouragement instead of a warning. The daily-new-words sub-label "Осталось изучить по лимиту" was harmonized with the "N из M" counter ("Можно изучить ещё сегодня"). Dropped jargon leaks: "через IndexedDB" → "прямо в браузере", "в сессиях Gemini" / "в чате с Gemini" → "…с ИИ", "статус «Изучено» (mature)" → "статус «Изучено»", "по системе FSRS" → "по расписанию" (the Transparency science widget keeps its deliberate FSRS explanation). After the knowledge-diagnostics modal, "Сохранить и начать" now routes the user into `/practice` instead of leaving them in settings (F5). Found during the multi-persona UX walkthrough.

## [1.62.3] - 2026-06-17

### Fixed
- **User-facing error/empty states no longer speak developer language**: the media player's tokenizer-down banner no longer leaks "run-server.bat", and the empty sidebar no longer invites "click any word" while word analysis is unavailable — it states the analysis is temporarily down and that video/subtitles still work. The chat theme-generation route no longer passes a raw exception ("fetch failed") to the UI — it returns a human Russian message while the raw error stays in the server log. (Quick part of the unified unavailable-state work; full `ServiceUnavailable` pattern with cause classification is planned.) Found during the Day-2 UX walkthrough.

## [1.62.2] - 2026-06-17

### Changed
- **Anki is now opt-in (Local List is the default learning source)**: a fresh profile starts in Local List mode instead of Standard Anki, and the AnkiConnect connection check is now lazy (runs only when an Anki mode is selected) — a new user without Anki no longer meets a red "запустите Anki" error on the settings page. Anki remains fully available as an explicit choice; existing users are unaffected (their saved `deck_mode` persists). Found during the Day-1 / no-Anki UX walkthrough.
- **Removed Anki from default product identity**: browser tab title and meta description no longer say "с Anki" / "из Anki" (now "…с ИИ"); the dashboard subtitle frames the built-in starter deck with Anki as optional. The Anki-not-found message now points to Local List as a way out.

## [1.62.1] - 2026-06-17

### Fixed
- **Hydration error in warm-up reading step**: the "Введите чтение:" label container in `renderWarmup` was a `<p>` wrapping `ScienceTip` (which renders a `<div>`) — invalid HTML (`<div>` cannot descend from `<p>`), causing a React hydration error. Changed the wrapper to a `<div>` (styling unchanged, already `display:flex`). Found during the Day-1 newbie UX walkthrough.

## [1.62.0] - 2026-06-17

### Added
- **Level-aware media ranking (beginner-friendly)**: The media search funnel now ranks candidates by a per-level tier (`beginner` / `bridge` / `acquisition`) instead of a single hardcoded comprehension window. Beginner tier uses a low, wide comprehension window with a level-fit floor, strongly favors short clips via a new `computeDurationFit`, and stops treating ♪ music segments as junk. `acquisition` (default) reproduces the prior 0.85–0.98 window and 0.6/0.4 weighting exactly. The client derives the tier from `chatLevel` (1–2 → beginner, 3 → bridge, 4–5 → acquisition) and passes it to `/api/media/search`; the route returns the new `durationFit` field.

### Changed
- **`/api/media/search` contract**: Added optional `tier` request field and `durationFit` response field.

## [1.61.0] - 2026-06-17

### Removed
- **Exposure Log & Mining counter**: Removed the dead `exposure_log` IndexedDB table, `exposureService.ts` (`recordExposure`/`getMiningCandidates`), the `EXPOSURE_MINING_THRESHOLD` constant (interval registry System 7), and the non-functional "часто встречались" mining candidates card on the chat summary screen (its "add to study" button was a stub). The counter fed no live feature; passive learning is treated as an uninstrumented ambient phenomenon. The working per-word tap-to-add (`handleAddSingleWord`) on the summary screen is unaffected.

### Changed
- **Dexie schema version(7)**: Added migration dropping the `exposure_log` table for existing users (`exposure_log: null`).

## [1.60.0] - 2026-06-13

### Added
- **Chat Entry Gating**: Gated chat theme generation and practice session entry; users must have at least 5 words in active study (learning or review status) to start a chat. Displays a helpful Russian notice in the practice launcher recommending Warm-ups or Quizzes when chat is locked.
- **Hard Word Prioritization**: Propagated the FSRS-derived `isHard` status (`active.stability < 3 || active.lapses >= 2`) into the `AnkiWord` model, stable-sorting these words to the front of the active pool to guarantee their selection as conversation targets.

### Changed
- **Target Theme Sizing**: Scaled conversational target word sets per theme from 4–6 words up to 5–8 words. Theme clustering logic prioritizes hard words and completes the target set with universal verbs and adjectives up to the maximum limit.
- **Test Suite Alignment**: Authored new tests and updated existing mock DB seeds and assertions to support the 5-word gating, priority sorting, and 5-8 word target counts.

## [1.59.0] - 2026-06-13

### Changed
- **Removed Exam Nodes**: Deleted `g_n5_exam` and `g_n4_exam` placeholder nodes from `grammar_rules.json` and adjusted visual height bounds in `GrammarTrack` (N4 ends at 480px, N5 ends at 840px). Competency completion tracking is now fully delegated to the Competency Engine.

### Fixed
- **Immersion Activity Double-Logging**: Added `immersionLogged` boolean state and persistence logic to `SavedChatState` in `/chat`. Prevents double-logging of immersion activities on chat summary screen re-entry or page reload.

## [1.58.0] - 2026-06-13

### Added
- **Science Tips Registry**: Created `science_tips.json` with fixed scientific explanations and research citations in Russian for pedagogical choices (spacing, furigana fading, self-repair prompts, active keyboard input, etc.).
- **Interactive ScienceTip Component**: Implemented a reusable React client component displaying a neat `ⓘ` icon with a popover showing the scientific explanation and its associated study/author citation. Includes a safety fallback rendering standard text inside test mock environments.
- **Practice Balance Engine**: Added `balance.ts` calculation library for tracking structure (grammar/quizzes) vs immersion (chat/media) balance. Generates friendly, non-coercive Russian recommendations based on the user's active JLPT level.
- **Balance Indicator Widget**: Created the `<BalanceWidget>` component displaying recommended vs actual practice share bars, placed prominently in the `/practice` page sidebar.
- **Activity Log Persistence**: Captured user actions in namespaced localStorage under `activity_log` across warm-up completions, quiz checks, grammar validation, and media/chat summaries, capped to a rolling window of 30 entries.
- **Full TDD Coverage**: Authored unit test suites in `tips.test.ts`, `balance.test.ts`, `ScienceTip.test.tsx`, and `BalanceWidget.test.tsx` verifying all API contracts and component interactions.

## [1.57.0] - 2026-06-13

### Added
- **N4 Grammar Curriculum**: Added 6 JLPT N4 grammar nodes (5 rules: V-te-iru/V-te-oku/V-te-miru/V-te-shimau/V-te-hoshii, plus 1 exam placeholder node) to `grammar_rules.json` with coordinate layouts.
- **Practice Page Level Switcher**: Implemented dynamic N5/N4 curriculum switcher in `/practice` Grammar tab, allowing users to toggle between levels.
- **Component Filtering**: Filtered `<GrammarTrack>` nodes and edges by the selected JLPT level, rendering coordinates and heights dynamically (560px for N4, 940px for N5) and drawing only level-scoped connection lines.
- **Level-Agnostic Chat Empty State**: Updated empty state analyze text in `/chat` from a hardcoded "N4+" string to a level-agnostic notice, resolving Phase 10 tail cleanups.
- **TDD Test Coverage**: Created new unit tests verifying the level switcher rendering, active tab class styling, and toggle interaction.

## [1.56.0] - 2026-06-13

### Added
- **Word Queue Science**: Frequency-ordered new-word intake using JLPT levels as frequency proxy (lower level = higher priority).
- **Interference Guard**: Added kanji-sharing similarity checks to prevent introducing visually similar kanji characters in the same warm-up batch.
- **Discrimination Distractors**: Prioritized mature kanji-sharing words as high-quality distractors during the translation/reading warm-up, improving orthographic discrimination.
- **Exposure Log & Mining**: Introduced Dexie database schema version 6 with a local-first `exposure_log` table tracking words encountered in chat dialogues outside the study pool. Renders a mining candidates card on the Summary screen suggesting additions when a word count exceeds the threshold.
- **Passive N5 Autozачет**: Dropped the N4 level filter restriction in `/api/chat/analyze` route prompt, enabling N5 vocabulary to also receive passive/active study credit on dialog practice completion.
- **Comprehensive TDD Coverage**: Created full test suites in `priority.test.ts`, `similarity.test.ts`, and `exposureService.test.ts`, verifying sorting, similarity checks, exposure log counting, and Summary card rendering.

## [1.55.0] - 2026-06-13

### Added
- **Intervals Registry**: Centralized all timing and interval constants into `src/core/intervals.ts` (zero-dependency file). Unified systems:
  - System 2: Grammar Leitner intervals (`GRAMMAR_LEITNER_INTERVALS_DAYS`).
  - System 3: Fading Furigana days and opacities (`FURIGANA_FADE_FROM_DAYS`, `FURIGANA_HIDE_FROM_DAYS`, `FURIGANA_FADE_OPACITY`).
  - System 4: Fluency Mode seconds limits and round multipliers.
  - System 5: Daily Quest reset hour (`QUEST_RESET_HOUR`).
  - System 6: Competency profile limits, thresholds, and target levels.
- **Soft Chat Closing**: Implemented automatic closing turn when all target words are collected.
  - Automatically triggers a closing request to `/api/chat` with `closingTurn: true` and empty message.
  - Sensei wraps up the chat in character with no trailing question (exception to the one-question rule).
  - Displays a gorgeous banner "Все слова собраны! 🎉" with a "К итогам" 3D button that skips the exit confirmation dialog.
  - State persistence tracks `closingDone` per session to prevent duplicate calls on resume.
- **Fluency Timer Auto-Stop**: The moment all words are collected, the active countdown timer is cleared and the timer bar is hidden immediately.
- **Passive Replica Duration Logging**: Silently tracks user turn response times in normal chat sessions. Displays the average replica duration on the practice Summary screen.
- **TDD Test coverage**: Added comprehensive unit test suites in `intervals.test.ts` and page test integrations in `page.test.tsx` verifying timers, soft closing banner, session resumption, and average turn timing.

## [1.54.0] - 2026-06-13

### Added
- **Fluency Mode (Phase 8)**: Implemented timed scenario replay to encourage fast, fluent production:
  - Replay action buttons (`🔁 Беглость: пройти сценарий быстрее` and `🔁 Раунд {round+1}: ещё быстрее`) on the session summary screen for chats with >= 3 turns, supporting up to 3 rounds.
  - Tightening flat response time limits per round (Round 1: 45s, Round 2: 30s, Round 3: 15s).
  - Horizontal timer countdown bar styled in CSS with color transitions (green > 50%, orange 20%-50%, red < 20%, empty on expiry).
  - Non-blocking timer: when time expires, the message input remains active without penalty.
  - Fluency statistics panel showing average response time and percentage of replies made within the limit.
  - Strict mature-only grammar scoping logic (no focused active rule) for fluency replays.
  - TDD unit tests in `fluency.test.ts` and UI test integrations in `page.test.tsx` verifying timer behavior, state transitions, and stats calculation.

## [1.53.0] - 2026-06-13

### Changed
- **Quests Motivation Cleanup ([XP-CLAIM])**: Removed the claim-for-XP mechanic. Quests now act strictly as goal-setting and feedback benchmarks, showing a static "Выполнено ✓" badge on completion and awarding no XP points. Kept the `claimed` field in storage for backward compatibility.
- **Japanification XP Independence ([JAPANIFICATION-SOURCE])**: Added regression tests locking the XP-independent behavior of the manual `uiMode` settings for `t()`, `shouldShowTranslation()`, and `shouldGrammarBeJapanese()`. Explicitly documented XP as write-only decoration in `PROJECT_LOGIC.md` and updated the `CONTEXT_PROMPT.md` feature registry.

## [1.52.0] - 2026-06-13

### Added
- **Typed Reading in Warm-up ([TYPE-ANSWER])**: Replaced the 3-option multiple-choice buttons on the `kana` step of the Warm-up practice trainer with a text input. Users must type the exact reading in hiragana, utilizing the typo-forgiveness comparison logic. Added a "Показать ответ" 3D button to reveal the answer and mark the step incorrect.
- **FSRS-Interval Fading Furigana ([WORD-FURIGANA])**: Shifted furigana visibility control in chat from difficulty levels to a client-side per-word fading mechanism. Gemini models now output 100% full HTML `<ruby>` annotations at all levels. Client-side, words are styled with `.rtFade` (opacity: 0.6) for intervals between 3 and 21 days, and `.rtHidden` (opacity: 0 by default, visible on hover) for intervals ≥ 21 days.
- **Answer Comparison Utility**: Extracted pure typo-forgiving answer comparison utility `isAnswerAcceptable` from `/practice/quiz` page to a separate module `src/lib/quiz/compare.ts` with comprehensive unit tests in `compare.test.ts`.
- **Client-Side Furigana Processor**: Created pure function `applyGradualFurigana` in `src/lib/chat/furigana.ts` with exhaustive unit tests covering FSRS intervals and edge cases.

## [1.51.0] - 2026-06-13

### Added
- **Explicit Grammar Feedback (shortNote)**: Added a `shortNote` field to the `grammarFeedback` object in the `/api/chat` route and `ChatService.sendMessage` response schema. Generated concise Russian metalinguistic feedback (e.g. `частица: に → で`) for incorrect inputs. Added backward compatibility fallback to empty string `""` for legacy chat history.
- **Self-Repair UI Flow**: Implemented collapsed-by-default grammar correction cards in `/chat`. The card immediately renders the `shortNote`, explanation, and a static hint prompting self-correction, hiding the target correction behind a "Показать правку" 3D button.
- **Scaffolding Hints Rework**: Replaced ready-made hint sentences with a scaffolding contract. `/api/chat/hint` now returns `keywords` chips (Japanese word + Russian translation) and a `patternHint` structure (skeleton formula) with varying scaffolding detail based on difficulty level (full template with particles for easy, template with gaps for medium, intention description only for advanced). Removed click-to-insert actions, making hints display-only.
- **TDD Test Suite**: Added a dedicated `src/lib/gemini/__tests__/chat.test.ts` unit test suite covering schema, prompt instruction assertions, and default properties. Appended 5 new UI tests in `page.test.tsx` and 2 live integration tests in `chat.integration.test.ts` (with SSL-reject-unauthorized bypass).

## [1.50.0] - 2026-06-13

### Added
- **Competency Engine**: Created `src/lib/competency/profile.ts` helper modules containing coverage calculations (`lexCoverage`, `grammarCoverage`), recent correction rate computation, and core profile builders (`buildCompetencyProfile`, `getPresetAdvice`). Added exhaustive TDD suite in `profile.test.ts`.
- **Macro Competency Ladder UI**: Redesigned `LearningTrack.tsx` to render a vertical N5→N1 winding SVG path with progress rings and detail tooltips displaying exact coverage rates. Updated dashboard bindings and unit tests in `LearningTrack.test.tsx`.
- **Chat Session Stats Tracking**: Implemented persistent rolling localStorage log (up to 10 entries) tracking active chat session turns, grammar correction rates, and JLPT levels inside `/chat` exit flows, disregarding zero-turn sessions.
- **Chat Summary Advisor**: Built AI-driven recommendations panel advising chat level adjustments (UP/DOWN/STAY) based on vocabulary and grammar stability thresholds, integrating "Принять" and "Не сейчас" actions with local settings updates.

## [1.49.0] - 2026-06-12

### Added
- **JLPT N3–N1 Level References (v2)**: Extended `scratch/generate_jlpt_levels.mjs` scraper to fetch canonical lists for N3, N2, and N1 vocabulary from `jlptsensei.com`. Generated versioned `src/resources/jlpt_levels.json` containing N5 (710), N4 (663), N3 (2078), N2 (1790), N1 (2655) entries with exact kanji/reading cleans and duplicate/cross-level overlap removal.
- **Derived Chat Grammar Scoping Logic**: Implemented `promptScope.ts` inside `src/lib/grammar/` calculating allowed grammar patterns (mature/closed rules + active unlocked rules + formulaic whitelist of chunks like `ください`, `お願いします`, `すみません` etc.).
- **Spaced repetition focus selection**: Implemented Leitner-based priority selection of active/unlocked rule in progress with the nearest due date, falling back to overdue mature rules for spaced repetition, or fallback base rule (`g_n5_s1_1`).
- **Server-Side Validation & Warn Logging**: Updated `/api/chat` route and `chatService` to accept `grammarScope`, inject strict constraints into system prompts, ask Gemini to self-report used rules via `usedConstructions` response schema, validate them, and log warnings on violations.
- **Client-Side Chat Page Integration**: Updated `/chat` page to dynamically query Dexie `grammar_progress` for the active profile, compute grammar scope using `getAllowedScope()`, and propagate the parameters to `/api/chat` calls. Defer Dexie queries in unit testing environments to prevent JSDOM timing race conditions.
- **Resource & Scoping Unit Tests**: Added levels coverage verifying that all 5 levels are populated with zero duplicates or overlaps. Added 7 unit tests in `promptScope.test.ts` for whitelist checks, focus priorities, and fallbacks. Added API route tests in `chat.test.ts` validating scope instructions propagation, response schema fields, and warnings.

## [1.48.0] - 2026-06-12

### Added
- **JLPT level reference lists**: Created versioned database `jlpt_levels.json` using a custom-built, certificate-bypass scraper script `generate_jlpt_levels.mjs` fetching canonical lists from `jlptsensei.com` N5 and N4 pages.
- **JLPT Levels Detection & Tagging Module**: Implemented pure matching logic in `src/lib/jlpt/levels.ts` supporting exact kanji form matching, kana-only word readings fallbacks, N5-over-N4 easiest level priority matching, and idempotent tag merging (`mergeJlptTag`).
- **Anki/Starter-deck import integration**: Wired automatic tagging into the offline starter-deck loader and bilateral Anki synchronization (`syncDatabaseWithAnki` in `db.ts`) preserving existing word tags and merging new JLPT tags on import.
- **Bulk Retagging Tool**: Added a bulk utility `retagAllWords` in `localDeckService.ts` and integrated a purple "Переразметить теги JLPT" settings action button in the dev-only Debug HUD drawer.
- **N5 Grammar rule content completion**: Fully authored Russian pedagogical content and conjugation guides for the three remaining N5 placeholder nodes `g_n5_s7` (た-форма), `g_n5_s8` (〜たり…たりする), and `g_n5_s9` (〜ながら) in `grammar_rules.json`, removing their `isPlaceholder` flags.
- **Unit testing coverage**: Added 7 test cases in `levels.test.ts` for matching/tagging boundaries, added a Dexie-backed test in `localDeckService.test.ts` for idempotent bulk retagging, and updated assertions in `GrammarTrack.test.tsx`.

## [1.47.0] - 2026-06-12

### Added
- **Grammar DAG Graph Engine**: Implemented `graph.ts` inside `src/lib/grammar/` defining pure helper functions `validateGraph`, `isNodeStarted`, `isNodeUnlocked`, `isNodeClosed`, and `getEdges` to support prerequisite directed acyclic graphs for grammar curriculums.
- **Grammar DAG Test Suite**: Added a comprehensive unit test suite `graph.test.ts` covering 9 critical TDD test cases including fork unlock behavior, placeholder lock gates, cycle and dangling prerequisite detection, and profile backward compatibility.

### Changed
- **Grammar Prerequisite DAG rules**: Extended `grammar_rules.json` config with layout coordinates (`coords`), situational themes levels (`level: "N5"`), and structural morphological dependencies (`prerequisites`). Migrated placeholder rules (`g_n5_s7` through `g_n5_exam`) from component to rules JSON.
- **Dynamic SVGs in GrammarTrack UI**: Refactored `GrammarTrack.tsx` to generate connection Bezier edges programmatically using `getEdges` and coordinate mappings instead of hardcoded paths. Replaced linear unlock chain check with DAG prerequisites lookup via `isNodeUnlocked`.
- **Component Test Suite**: Updated `GrammarTrack.test.tsx` to assert multi-path coordinate renderings (14 dashed edges) and concurrent fork unlock behaviors.

## [1.46.0] - 2026-06-12

### Added
- **Persistent YouTube Cache**: Implemented file-backed cache utility `cache.ts` writing to `_nogit_youtube_cache.json` in the project root to cache subtitle availability (`getCachedAvailability`) and transcript segments (`getCachedTranscript`) to minimize duplicate scraper calls.
- **YouTube 429 Cooldown Logic**: Integrated global rate limit tracking in `youtube.ts` using `Retry-After` headers to block outbound requests and prevent YouTube IP rate-limiting.
- **Skip-on-429 Test Policy**: Configured E2E Playwright tests and integration tests to dynamically skip (using `test.skip` or `this.skip`) when hitting YouTube HTTP 429 rate limits, preventing test failures caused by environmental restrictions.

### Fixed
- **Parse API Unit Test Isolation**: Mocked the media cache module in `parse.test.ts` to isolate unit tests from reading or contaminating the real persistent cache file on disk.

## [1.45.0] - 2026-06-12

### Added
- **Automatic YouTube Video Search**: Implemented search functionality targeting Japanese learning content:
  - **Query Expansion**: Service `queryExpansion.ts` utilizing a single cached Gemini 2.5 flash-lite call to expand Cyrillic/mixed searches into Japanese phrases with classification of situational themes and robust error degradation.
  - **YouTube Search Scraper**: Module `search.ts` fetching InnerTube search results and continuation tokens, with parsing isolated in testable pure logic.
  - **Relevance and Level Ranking**: Module `ranking.ts` scoring candidate videos based on local title/description keyword matching, subtitle quality composition by track kind (ASR vs manual), and vocabulary level fit (Comprehension Rate comfort window $[0.85, 0.98]$).
  - **Diversity Selection**: Module `selection.ts` selecting a page of results using a seeded PRNG and profile history exclusion to guarantee less than 10% page overlap between refreshes.
  - **Funnel API Route**: Orchestrator route `/api/media/search` with sequential evaluation for top candidates to prevent YouTube oEmbed/transcript 429 rate-limiting.
  - **Search UI**: Integrated input box, refresh diversity button ("Обновить выдачу"), ranked result grid, and IndexedDB knownWords sync on the `/practice` launcher page.
- **Unit and Live Integration Tests**: Added comprehensive unit test coverage for query expansion, ranking, selection, search parsing, and the API route, alongside a live search liveness integration test (`search-live.integration.test.ts`) and Playwright E2E spec (`media-search-live.spec.ts`).

## [1.44.0] - 2026-06-12

### Added
- **Karaoke Quality Gate**: Pure quality gate module `karaokeQuality.ts` that filters out segments not passing structural criteria (requires at least 3 words, offset monotonicity, within-bounds durations, and filters placeholder manual subtitles).
- **Interpolated Karaoke Progress**: Piecewise-linear character-space progress interpolation `karaokeProgress.ts` that calculates smooth continuous progress and display clock estimation.
- **Unit and Integration Tests**: Added test suites `karaokeQuality.test.ts` and `karaokeProgress.test.ts` to cover every edge case (monotonicity, bounds, manual subtitles, linear fallback, display time freeze on pause/resync).
- **Continuous Karaoke Progress Rendering**: Integrated requestAnimationFrame clock loop in `MediaInteractivePlayer.tsx` to continuously fill tokens left of the playhead (`.filledToken`) and partially paint the active token using a dynamic linear gradient background.

### Changed
- **Removed Discrete Highlights**: Completely deleted untestable discrete word-jumping highlights and `activeWordIndex` state to achieve 100% testability.
- **E2E assertions**: Aligned Playwright E2E tests in `tests/e2e/media-live.spec.ts` to assert karaoke visibility conditionally based on the quality gate.

## [1.43.0] - 2026-06-12

### Added
- **MeCab Tokenizer Offline E2E Tests**: Created a new spec `media-tokenizer-down.spec.ts` that verifies player degradation, warning banner visibility, and disabling of word highlights when the MeCab tokenizer is offline.
- **Trusted Host Config for Pip Installer**: Added `--trusted-host` options for `pypi.org`, `files.pythonhosted.org`, and `pypi.python.org` in `run-tokenizer.bat` to bypass certificate verification issues on environments with SSL certificate verification failures.

### Changed
- **Sequential Playwright Execution**: Configured E2E tests to run sequentially (`workers: 1`, `fullyParallel: false`) with a global `timeout: 60000` to prevent Next.js Turbopack compilation overload and IndexedDB transaction lock conflicts.
- **E2E Project Separation**: Split npm scripts: `npm run test:e2e` now targets only the `chromium` and `live` projects (with tokenizer online), and `npm run test:e2e:offline` targets the `offline` project (setting `E2E_TOKENIZER_DOWN=1` with tokenizer stopped).
- **SSL Bypass for Live Scraping Spec**: Set `process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'` in `media-live.spec.ts` to prevent fetch certificate verification errors when running live YouTube transcript scraping tests in local environments.

## [1.42.0] - 2026-06-11

### Added
- **MeCab Tokenizer Status Indicator Dot**: Added a visual status indicator dot in the player header next to the title (green for active tokenization, gray for tokenizerDown status). Clicking the gray dot clears the active segment tokenization cache and retries morphological analysis.
- **Data Attributes for E2E Assertions**: Added `data-has-words` and `data-yt-state` attributes to the player's root modal container to facilitate automated timing and state checks.
- **Player Component Tests**: Added unit test coverage for status dot states, retry-on-click behaviour, wordless `cc_load_policy: 1` assignments, and extension upgrade-merge segment replacement logic.
- **Scraper Priority Unit Tests**: Created unit tests verifying real-time scraping priority over pregenerated fallbacks, fallback behaviour upon scraping failures, and cache-bypassing using the `forceScrape: true` flag.
- **Transcript Scraper and Generator Script**: Implemented `scripts/generate-transcripts.mjs` to fetch real Japanese transcripts and word-level timings from YouTube, ensuring that all recommended media files are sourced from real YouTube caption data.
- **Fidelity and Feed Language Integration Tests**: Added `feed-language.integration.test.ts` and `transcript-fidelity.integration.test.ts` to verify feed sanity and that pregenerated transcripts correspond to actual scraped timed text.

### Changed
- **CC Load Policy Word-Availability Check (RC-C)**: YouTube player initialization now uses `cc_load_policy: 1` if the loaded segments do not contain word-level timings, allowing the interceptor extension to run.
- **Extension Upgrade-Merge (RC-C)**: Upgraded browser extension segment adoption logic to allow replacing existing server segments if the server segments lack word-level timings and the extension segments have them.
- **E2E Playwright Strict Mode Fix**: Added `.first()` to Playwright locator references in `tests/e2e/media-live.spec.ts` to resolve strict-mode locator violations when multiple words are highlighted during video playback.

## [1.41.0] - 2026-06-11

### Added
- **CC Deduplication (T-4)**: Conditional `cc_load_policy` in YouTube player init — `0` when server returned segments (`pregenerated`/`scraped`/`upload`), `1` when segments list is empty, enabling the extension to intercept CC only when needed.
- **Extension Priority Guard**: `MediaInteractivePlayer` now ignores `YOMUMOGU_YT_SUBTITLES` messages from the Chrome extension if the server already provided segments (`hasServerSegmentsRef` flag). Priority order: `pregenerated` > `scraped` > `upload` > `extension`.
- **CC Toggle Button**: Added a `CC` button in the player header (visible for YouTube URLs only) that calls `player.loadModule('captions')` / `player.unloadModule('captions')` via a best-effort try/catch to show/hide native YouTube captions independently.
- **Extension Source Tagging**: `src/extension/background.js` now tags all relayed segments with `source: 'extension'` before `postMessage` dispatch.
- **Subtitle Timing Robustness (T-1)**: Implemented sticky timing where segments stay active until the next segment starts. Created `normalizeSegments` utility in `src/lib/media/parser.ts` to clamp overlaps, cap the last segment's duration, and handle gaps by rendering the previous subtitle line in a dimmed state (`.dimmedLine`).
- **Tokenizer Resilience (T-2)**: Refactored `/api/media/tokenize` endpoint to return a 200 OK status with `tokenizationSkipped: true` and empty arrays when the MeCab tokenizer microservice is offline, preventing 502/500 errors. Added a `/health` endpoint to `src/services/tokenizer/server.py` and a non-blocking UI warning badge when tokenization is skipped.
- **Karaoke Subtitles (T-3)**:
  - *Layer 1 (Word-Level Highlight)*: Implemented json3 parser in `src/lib/media/json3.ts` to extract per-word `offsetMs` from `segs[].tOffsetMs`. Upgraded YouTube transcription scraper in `src/lib/media/youtube.ts` to fetch json3 by default with XML fallback. Added active word highlighting (`.activeWord`) in the player mapped to MeCab token character offsets.
  - *Layer 2 (Sentence Regrouping)*: Added `regroupIntoSentences` utility in `src/lib/media/sentences.ts` to merge consecutive segments until Japanese terminal punctuation (。？！) with a maximum safety cap of 90 characters or a 15-second duration.
- **Unit Tests**: Added comprehensive test coverage (total 295 tests / 46 files) covering sticky timing, tokenizer gracefully down response, json3 parsing, sentence regrouping, and conditional `cc_load_policy`.

## [1.40.0] - 2026-06-11

### Added
- **Media Player Graceful Degradation**: Added support for rendering raw subtitle segments and showing a friendly warning banner (`[data-testid="tokenizer-warning"]`) in `MediaInteractivePlayer.tsx` when the MeCab tokenizer microservice is offline or returned an error.
- **YouTube Media Availability Check**: Added zero-dependency availability checks (`checkMediaAvailability(item)`) utilizing YouTube oEmbed probes and captionTracks checkers in `src/lib/media/availability.ts` to ensure recommended videos are active and loadable.
- **Chrome Extension Subtitle Parser Extraction**: Modularized the JSON3 subtitle parser into `src/extension/convert.js` and added robust unit tests under `src/__tests__/extension-convert.test.ts`.
- **Unit and Integration Tests**: Added integration tests `src/lib/media/__tests__/feed.integration.test.ts` to verify YouTube media recommendations against oEmbed, and unit tests `src/lib/media/__tests__/availability.test.ts`.
- **E2E Playwright Tests**: Expanded Playwright E2E test coverage in `tests/e2e/media-player.spec.ts` to verify offline tokenizer warnings, CSP safety, media playback seeking, and playlist interaction.

### Fixed
- **Chrome Extension Reserved Folder Name Issue**: Moved unit tests out of `src/extension/__tests__/` to `src/__tests__/extension-convert.test.ts` because Chrome rejects unpacking chrome extensions that contain directories starting with an underscore (like `__tests__`).
- **YouTube Player Lifecycle Cleanup**: Ensured correct YouTube Player iframe initialization and `destroy()` cleanup using React `ytContainerRef` and references to prevent multiple player script inclusions and memory leaks.
- **CSP Content-Security-Policy Expansion**: Added `media-src 'self' https:` to the Next.js CSP configuration in `next.config.ts` to permit YouTube and external audio playback streams.
- **Playwright Target Click Interceptions**: Handled overlay pointer interceptions by forcing clicks on segment rows and using correct visual locators on practice media card buttons.

## [1.39.0] - 2026-06-06

### Added
- **YouTube Subtitle Interceptor Extension**: Created a Manifest V3 Chrome Extension helper (`manifest.json`, `background.js`, `content.js`) in `src/extension/` to intercept YouTube timedtext API requests in the user's browser context and relay timing segments to YomuMogu.
- **Client Integration Listener**: Integrated `window.postMessage` listener in `MediaInteractivePlayer.tsx` to accept timing segments sent from the extension helper.
- **Unit Testing**: Added unit test in `MediaInteractivePlayer.test.tsx` verifying extension event listener integration and segment state updates.
- **Tokenizer Downtime Integration Tests**: Created `tokenize.integration.test.ts` and updated `parse.integration.test.ts` to test API route behavior when the MeCab tokenizer microservice is offline.

### Fixed
- **Tokenizer Loopback Connection**: Updated default `tokenizerUrl` fallback inside `/api/media/parse` and `/api/media/tokenize` endpoints from `localhost:8000` to `127.0.0.1:8000` to resolve IPv6 loopback connection bottlenecks on Node.js 18+.
- **Playwright Test Runner Conflicts**: Excluded `tests/e2e/**` Playwright test spec files from default Vitest scope in `vitest.config.ts` to prevent `@playwright/test` import errors during unit test execution.
- **Tokenize Connection Error Status**: Fixed `/api/media/tokenize` error handling to correctly return `502 Bad Gateway` (with message "Сервер токенизации временно недоступен") when uvicorn is offline, rather than crashing with `500 Internal Server Error`.

## [1.38.0] - 2026-06-05

### Added
- **Static Transcript Fallback**: Added a static transcript fallback lookup using pre-generated transcripts (`media_transcripts.json`) inside `/api/media/parse` to bypass YouTube watch page scraping blocks.

### Fixed
- **Media Player CSP Resolution**: Updated Content-Security-Policy rules in `next.config.ts` to allow YouTube Player script loading (`script-src`) and iframe embeds (`frame-src`, `child-src`, `connect-src`), resolving the black screen issue.

## [1.37.0] - 2026-06-05

### Added
- **MeCab Tokenizer Auto-Startup**: Integrated automated background launch of the MeCab tokenizer microservice on port 8000 inside `run-server.bat` via a minimized command prompt window.
- **Production Media Feed**: Replaced all dummy/placeholder video recommendations in `media_feed.json` with active, captioned Japanese YouTube videos.

### Fixed
- **Media Recommendation Test Cases**: Corrected `useMediaRecommendation.test.ts` to test against valid lemmas matching the first production video (`yt_1`), returning all 262 unit tests to passing status.

## [1.36.0] - 2026-06-05

### Added
- **Smart Video & Podcast Recommendations**: Introduced a new `"media"` tab on the practice launcher `/practice` displaying recommended videos and podcasts, calculating Comprehension Rates ($CR$) and due word overlaps based on user vocabulary.
- **Interactive Timed Subtitle Player**: Built a player modal supporting both the YouTube Iframe API and standard HTML5 `<audio>`, with timed subtitle segments rendering clickable word tokens.
- **Offline JitenDex dictionary lookup**: Linked word token clicks to offline JitenDex dictionary searches (`/api/dict/lookup`) displaying meanings and readings.
- **Direct Same-Session Anki Card Creation**: Enabled adding cards directly from the player sidebar with automatic reading conversion (Katakana to Hiragana).
- **Client-side Drag & Drop Subtitles**: Implemented drag and drop file uploads for `.srt` and `.vtt` subtitles directly into the player interface.
- **Robust URL-based Fetch Mocks**: Upgraded unit tests in `MediaInteractivePlayer.test.tsx` to use dynamic, path-based fetch mocking in `beforeEach` and separate event clicks from `waitFor` callbacks.
- **Comprehensive Unit Testing**: Added `MediaInteractivePlayer.test.tsx` and `useMediaRecommendation.test.ts` to cover component rendering, player seeking, and hook recommendations.

## [1.35.0] - 2026-05-29

### Added
- **Interactive Quiz Grading Modifiers**: Re-styled rating buttons on `/practice/quiz` page to separate action/override functions (Again button to neutral slate gray, Typo Forgiveness to yellow, and Next/Finish action to purple).
- **Inline Furigana Reinforcement**: Replaced reading bracket display below the kanji card in the quiz feedback card with clean HTML `<ruby>` tag representation aligned vertically above the text.
- **Phonosemantic Explanations**: Added a visual accordion warning/clarity note inside the Phonosemantic component explaining phonetic-semantic associations and phonetic group representations.
- **nJMdict Translation Separators**: Protected imported dictionary definitions against clumping by replacing closing tags with a `; ` separator in HTML parsing, and introduced programmatic corrections for existing clumped entries on profile load.

## [1.34.0] - 2026-05-29

### Added
- **Manual Grade Override Bar**: Integrated an interactive rating bar (Again, Hard, Good, Easy) in the post-answer feedback card of `/practice/quiz` displaying real-time computed intervals.
- **Typo-Forgiveness & Manual Bypass**: Added a "Простил опечатку" button for incorrect quiz responses, allowing the user to mark answers as correct, update default grade, and access FSRS override controls.
- **Visual Kanji Reinforcement**: Displays a large 3rem Kanji block and reading below the response input in the feedback card to aid recognition.
- **Keyboard Shortcuts**: Registered physical keyboard bindings: `1`–`4` for rating overrides, `i` / `\` / `~` for Ignore Typo, and `Enter` to commit selection.
- **Expanded Unit Testing**: Added unit tests in `page.test.tsx` verifying typo forgiveness, manual rating override logging, and keydown shortcut listener.

## [1.33.0] - 2026-05-28

### Added
- **Situational Tagging System**: Implemented automatic classification of Japanese words into 10 situational themes (`shopping`, `restaurant`, `travel`, `home`, `work`, `hobbies`, `social`, `health`, `weather`, `education`) or `universal`.
- **Static N5 Dictionary**: Created `situational_dictionary.json` in `src/resources/` mapping N5 Starter Deck words to eliminate Gemini classification overhead on initial import.
- **Lazy AI Classifier Route**: Created POST API route `/api/gemini/classify` using a schema-enforced Gemini structured JSON output to lazily classify custom Anki imports when they enter the active learning pool.
- **IndexedDB multiEntry Index**: Upgraded Dexie.js database to Schema Version 5, adding an indexed `*tags` multiEntry index to the `words` table.
- **Adaptive Reviews Gating**: Implemented FSRS stability routing logic checking `active.stability < 3` or `lapses >= 2` to direct decaying words to Gemini chat dialogues, while directing stable items to rapid translation quizzes.
- **Tag-Based Distractor Selection**: Optimized Warm-up `generateOptions` on the practice page to query and prioritize distractor options sharing overlapping situational tags.
- **Unit Testing Coverage**: Added `classify.test.ts` and `tagger.test.ts` to test API routes, FSRS routing logic, and theme clustering.

### Changed
- Updated `localDeckService.ts` to pre-populate tags on starter deck import and trigger lazy tag classification for custom/Anki imports.
- Modified `scheduler.ts` to expose `shouldRouteToChat` helper checking active FSRS stability and lapses.
- Updated `sessions/route.ts` and `lib/gemini/client.ts` to group active review words by situational tag overlap using a new `groupWordsIntoThemes` utility.

## [1.32.0] - 2026-05-28
### Added
- **Dynamic Grammar Sandbox Curriculum**: Scaled the interactive sentence workbench sandbox layout (Tone, Polarity, Contractions, dynamic cards) to all 7 curriculum rules in `grammar_rules.json`.
- **Custom Pill Controls**: Re-labeled Tone and Polarity selectors based on rule metadata (e.g., "Выбор глагола" and "Форма" for verb classification; "Конструкция" and "Стиль" for te-form constructions).
- **Spoken Japanese Secrets**: Authored distinct Russian "Секреты устной речи" text guides and sub-steps for all N5 curriculum rules in `grammar_rules.json`, highlighting particle drops, colloquial contractions (`〜ている` -> `〜てる`), and pronouns.
- **Unit Testing Suite**: Added `GrammarTrainer.test.tsx` containing 8 tests verifying dynamic rendering, card tooltip clicks, tab switching, and dynamic suggestion placeholders.

### Changed
- Refactored `GrammarTrainer.tsx` sentence builder to dynamically resolve card values, labels, tooltip explanations, and panel tabs from rule sandbox configs.
- Replaced hardcoded suggestion check placeholder with dynamic sample answers based on rule suggestions.

## [1.31.0] - 2026-05-27
### Added
- **Step-by-Step Grammar Learning Wizard**: Refactored `GrammarTrainer.tsx` and `GrammarTrainer.module.css` into a multi-step interactive wizard:
  - Slide-based theory slideshow (Step 1) displaying detailed subconcept explanation steps configured in `grammar_rules.json`.
  - Interactive Sentence Token Builder (Step 2) allowing users to assemble suggestions using shuffled clickable tokens and verifying syntax.
  - Free-form composition validation (Step 3) checked by Gemini.
- **Exact Match Local Bypass**: Implemented `cleanJapanese` normalizer matching user inputs against pre-defined sample answers in `/api/gemini/grammar-verify/route.ts` to bypass LLM API calls and verify instantly in 0ms.
- **Latency Optimization**: Extended `withRetry` inside `retry.ts` to accept a prioritized list of models, and updated `client.ts` to route custom grammar checks to `gemini-2.5-flash-lite` first (reducing latency from ~3s to ~1.2s).
- **Unit Tests**: Added a bypass unit test in `grammar-verify.test.ts` to verify local suggestions verification logic.

## [1.30.0] - 2026-05-27
### Changed
- **Grammar Curriculum Alignment**: Replaced all 5 grammar rules in `src/resources/grammar_rules.json` with a strict 7-step N5 curriculum aligned with the Morphology-Before-Syntax pedagogy defined in `_nogit_philosophy.md §6.1`:
  - Step 1.1: Noun Predicate & Particles (`AはBです`)
  - Step 1.2: Adjective Morphology (い/な classes, 4 forms each)
  - Step 2: Verb Classification (Godan/Ichidan/Irregular)
  - Step 3: Polite Conjugation (ます-form)
  - Step 4: Negative Form (ない-form) — **new step**, prerequisite for て-form
  - Step 5: て-form Morphology (Gerund)
  - Step 6: て-form Constructions (〜てください, 〜ている, 〜てもいい)
- Rule IDs migrated from `g_n5_01`–`g_n5_05` to `g_n5_s1_1`–`g_n5_s6` (resets existing `grammar_progress` IndexedDB data).
- Rewrote `GrammarTrack.tsx` with a data-driven linear unlock chain (`UNLOCK_CHAIN` map), snake-pattern SVG coordinates for 11 nodes (7 active + 4 placeholders), and step labels (1.1, 1.2, 2–6).
- Updated placeholders to post-ladder constructions: た-form, 〜たりする, 〜ながら, N5 Final Exam.
- Updated all test files referencing old grammar rule IDs (`GrammarTrack.test.tsx`, `grammar-verify.test.ts`, `page.test.tsx`) to use new IDs.
- Added 3 new unlock chain tests: 1.1→1.2 blocking, ます→ない blocking, ない→て unlocking.
- Test suite: 224 tests across 34 files, all passing.

## [1.29.0] - 2026-05-27
### Added
- Added Grammar Roadmap (`src/components/GrammarTrack.tsx`, `GrammarTrack.module.css`) mapping JLPT N5 grammar progression rules dynamically using a visual SVG winding pathway on the practice page `/practice`. Features parallel branching paths (allowing left/right paths chosen by the user) and 5 extra locked placeholder nodes showing future N5 rules ("В разработке").
- Added client-side interactive Grammar Trainer overlay modal (`src/components/GrammarTrainer.tsx`, `GrammarTrainer.module.css`) featuring grammar theory explanations, conjugations lists, clickable sentence suggestions, and a verification form calling a dedicated Gemini API verify endpoint.
- Added database schema Version 4 migration in `src/core/db.ts` introducing `grammar_progress` IndexedDB table mapping profile and rule ID compounds to track Leitner spaced repetition progress step levels `[1, 3, 7, 14, 30]` days.
- Added dynamic AI grammar sentence verification endpoint `/api/gemini/grammar-verify` (`src/app/api/gemini/grammar-verify/route.ts`) validating Japanese sentences, wrapping corrections in 100% Furigana tags for levels 1-2, explaining grammatical mistakes, and suggesting Russian translation scaffold fallbacks.
- Integrated grammar focus badges in `/chat` viewport and dynamic dialogue character prompt nudging in `src/lib/gemini/prompts.ts` and `src/lib/gemini/chat.ts`.
- Integrated results screen Leitner confidence grading checkboxes ("Забыл", "Плохо помню", "Хорошо помню") on dialogue complete in `/chat/page.tsx` that write scheduling steps to the `grammar_progress` DB store.
- Added comprehensive unit testing coverage for grammar verify routes in `src/app/api/gemini/__tests__/grammar-verify.test.ts` and updated page unit tests in `src/app/chat/__tests__/page.test.tsx`.

### Fixed
- Unified layout and popover mechanics of both Word Roadmap (`LearningTrack`) and Grammar Roadmap (`GrammarTrack`) to behave identically:
  - Both tracks position detail popovers to the left or right of the nodes based on horizontal coordinates using viewport empty margins (left nodes show on the left, right/center nodes show on the right) at a unified `80px` offset.
  - Arrow tips are positioned at `64px` from node center, leaving a clean `30px` gap from the node button edge (`34px`) to prevent any overlaps or label clipping.
  - Sibling label element (`nodeLabel`) is moved outside the button element in `GrammarTrack` to match `LearningTrack`, preventing text jitter or blurry scale changes on hover.
  - Wrapper layers (`nodeWrapper` / `trackNodeWrapper`) use active classes that elevate active wrappers to `z-index: 100` to prevent sibling overlap clipping.
- Replaced glitchy node wiggling hover animations with a premium smooth scale transition.

## [1.28.0] - 2026-05-27
### Added
- Added a winding, vertical Duolingo-style visual map/road on the practice page `/practice` (`src/components/LearningTrack.tsx`, `src/components/LearningTrack.module.css`) representing 5 interactive nodes (3 AI conversation practice sessions, 1 review marathon, and 1 bonus quiz) with locked/active/completed state transitions, dynamic winding SVG connectors, wiggling hover animations, and detail popovers.
- Added a Daily Quests widget in the practice page sidebar (`src/app/practice/page.tsx`, `src/app/practice/practice.module.css`) to track Reviews (10 target), Chats (1 target), and Mnemonics (2 target), managed by a custom hook `useQuests` (`src/hooks/useQuests.ts`) with profile-namespaced local storage caching and daily resets at 4:00 AM local time.
- Integrated daily quest completion triggers in the Quiz page (`src/app/practice/quiz/page.tsx`) to increment progress for reviews checked and mnemonics saved or auto-filled.
- Integrated daily quest completion triggers in the Chat page (`src/app/chat/page.tsx`) to increment progress when a dialogue session reaches the 80% completion threshold.
- Added unit tests for the visual track component in `src/components/__tests__/LearningTrack.test.tsx` and the daily quests hook in `src/hooks/__tests__/useQuests.test.ts`.
- Updated the practice page test suite in `src/app/practice/__tests__/page.test.tsx` to handle the popover interactions and mock system dates cleanly.

## [1.27.0] - 2026-05-26
### Added
- Added client-side reactive vector SVG mascot widget 🍵 in `/chat` page (`src/app/chat/page.tsx`, `src/app/chat/chat.module.css`) supporting animated states: `idle` (floating steam), `happy` (jumping upon target word hits), `worried` (shaking and tilting left towards grammar feedback cards on mistakes), and `cheering` (nodding on correct inputs).
- Added 2D SVG Memory Decay Heatmap widget in landing dashboard page (`src/app/page.tsx`, `src/app/page.module.css`) rendering a traditional Japanese Kumiko woodworking lattice pattern (10x5 grid, 50 cells for 500 deck words) mapping FSRS memory stability levels (white, yellow, green, gold) and pulsating due cells.
- Added new FSRS furigana opacity fade-out rules in `<JpUI>` component and styles (`src/components/JpUI.tsx`, `src/components/JpUI.module.css`) that fade out furigana based on FSRS intervals (opacity 1.0 for <3d, opacity 0.6 for <21d, opacity 0.0 for >=21d with hover support) to secure vertical line-height constraints and eliminate Cumulative Layout Shift (CLS).
- Added unit tests for FSRS-based JpUI furigana opacity in `src/components/__tests__/JpUI.test.tsx` and updated page and chat page test suites in `src/app/__tests__/page.test.tsx` and `src/app/chat/__tests__/page.test.tsx`.

### Fixed
- Fixed Cyrillic typo in MASCOT_PHRASES (`きょうмоすばらしいひです` -> `きょうもすばらしいひです`) on the homepage, preventing Cyrillic leaks in Japanese text.

## [1.26.0] - 2026-05-26
### Fixed
- Fixed FSRS due words query in the Debug HUD Side Drawer: words with status `'new'` are now properly filtered out, avoiding them incorrectly matching the due date filter (`due <= now`).
- Fixed premature daily new words limit exhaustion in local mode: generating chat scenarios no longer consumes the daily limit. The daily limit is now consumed when words with status `'new'` are actually reviewed and saved during Chat session results sync.
- Fixed daily new words limit exhaustion cache issues by adding dynamic database-backed synchronization (`syncDailyNewWordsCountWithDb`): the daily study count in localStorage is now recalculated and synced on page mount/load with the actual number of new words studied today (first reviews today) in IndexedDB, preventing stale cache mismatches.

## [1.25.0] - 2026-05-26
### Added
- Added a global toggleable Debug HUD Side Drawer (`src/components/DebugDrawer.tsx`, `src/components/DebugDrawer.module.css`) to the root layout, enabled only in development and testing modes.
- Added client-side telemetry to show FSRS parameter values (stability, difficulty, reps, lapses, due date) for passive and active trajectories of all words in IndexedDB.
- Added list displays for words studied today (retrieved from `reviews` table log) and words currently due for FSRS review.
- Added raw prompt and history display to inspect system instructions and payload formatting sent to Gemini API, populated from sessionStorage cache.
- Added developer override controls to switch profiles dynamically, inspect raw profile localStorage keys, reset local FSRS databases, and add mock XP points.
- Added debug prompt instrumentation inside the API chat routes (`/api/chat` and `/api/chat/hint`) to expose prompt structures under dev environments.
- Added unit tests verifying DebugDrawer rendering, tab navigation, and overlay triggering in `src/components/__tests__/DebugDrawer.test.tsx`.

## [1.24.0] - 2026-05-26
### Added
- Added a premium traditional Japanese Kumiko (Asanoha) geometric grid pattern fixed background to `body` in `src/app/globals.css`, featuring a warm washi paper textured background color and wood-colored lines for high contrast and modern styling.

### Changed
- Changed main page wrappers `.main` in `src/app/practice/practice.module.css` and `src/app/settings/settings.module.css` to be transparent, ensuring the background pattern shows through between widgets.
- Refactored the `/practice` page layout into an adaptive two-column sidebar grid, shifting the "Источник обучения" card into a desktop sidebar on the right side and keeping the main workouts in a left column.

## [1.23.0] - 2026-05-26
### Added
- Added interactive mascot clicking mechanics in `src/app/page.tsx`, triggering a wiggle animation class and displaying random motivational Japanese phrases (with Furigana and Russian translations) in the speech bubble, reverting after 4 seconds.
- Added a horizontal `Immersion Progress Card` widget directly inside the main dashboard flow of the homepage, displaying the user's immersion level, XP progress bar, and key learning statistics (words used, sessions completed, chat difficulty level).
- Added a subtle decorative background grid pattern utilizing `radial-gradient` in `src/app/page.module.css` to reduce whitespace on wider screens.
- Added a unit test suite in `src/app/__tests__/page.test.tsx` verifying the click handler, animation class addition, speech bubble text rotation, and timeout reset behavior.

## [1.22.0] - 2026-05-26
### Added
- Added a split card layout on the Practice page (`/practice`), separating "Новые слова" (New words progress status card) and "Активное повторение" (Active review card).
- Added daily limit offset storage namespaces in `localStorage` namespaced by profile, allowing reactive daily limit offsets.
- Added a "➕ Добавить +10" button on the Practice page to increment the daily limit offset by 10 and dynamically redraw the progress bar.
- Added a completion state screen to the Warm-up trainer overlay with a "Закрепить новые слова (Квиз)" button routing to the Quiz page with target word list parameters in `mode=new`.
- Added unit tests verifying daily limit offsets, UI card division, and completed warm-up flow redirections in `src/app/practice/__tests__/page.test.tsx`.

## [1.21.0] - 2026-05-26
### Added
- Added client-only Warm-up Trainer (Priming) on the practice page, offering a 3-step learning overlay (Sight & Sound, Kana Check, Translation Check) for up to 10 new words from the local vocabulary without affecting FSRS intervals.
- Added Phonosemantic Hints (声符) Accordion component showcasing phonetic components and semantic relatives (kanji, reading, meaning) for JLPT N5-N3 kanji, populated via a static `phonosemantics.json` file containing ~50 frequent keys.
- Added interactive mnemonics and user notes editing directly in the Quiz page feedback screen, with automatic blur saving.
- Added a POST API endpoint `/api/gemini/etymology` and corresponding unit test coverage in `src/app/api/gemini/__tests__/etymology.test.ts` mock-verifying etymology extraction.
- Integrated a "✨ ИИ-Этимология" action in the Quiz note editor calling the etymology API to extract Kanji components and mnemonics using the Gemini API.
- Integrated FSRS status filters to exclude `new` status words from active due counts and launcher loaders, solving the daily pool inflation bug.

### Fixed
- Fixed TypeScript compiler type checking errors across multiple files (`src/app/chat/page.tsx`, `src/app/settings/page.tsx`, `src/app/api/chat/analyze/route.ts`) caused by flat `LocalWord` property references.
- Fixed TypeScript type constraints and compiler errors in legacy test cases in `src/core/__tests__/scheduler.test.ts` and `src/core/__tests__/db.test.ts` by introducing explicit type casting and mapping flat entities correctly.
- Added missing Lucide React icon imports (e.g. `BookOpen`) on the chat page results.

## [1.20.0] - 2026-05-26
### Added
- Added client-side active recall quiz page `/practice/quiz` with Cloze Deletions, fallback Russian-Japanese translation tests, and dual hint systems (first character reveal and offline JitenDex definitions lookup with target word masking `***`).
- Added offline dictionary search API route `/api/dict/lookup/route.ts` proxying offline SQLite lookup requests.
- Integrated FSRS active due count indicator and quiz launcher button in the Practice page dashboard (`/practice`).
- Added complete unit test coverage for the quiz page in `src/app/practice/quiz/__tests__/page.test.tsx` verifying loading states, standard/ad-hoc modes, feedback, and hint functionality.
- Added database-dependent JSDOM page integration regression tests for settings page (`src/app/settings/__tests__/page.test.tsx`) and practice page (`src/app/practice/__tests__/page.test.tsx`) that mock local Dexie database entries and verify statistics and due quiz counts in local mode.
- Added automatic synchronization of existing local database words with the updated starter deck (`syncExistingLocalWordsWithStarterDeck`) upon initializing settings or practice page dashboards, fixing text and transcription typos automatically on the client side without losing FSRS progress.

### Changed
- Replaced the inline Bonus Test screen in `/chat` page with an ad-hoc quiz redirect (`/practice/quiz?words=...`) rendering checklist dialog examples with user selection controls.
- Integrated FSRS dual-curve alignment (`alignPassiveToActiveState`) inside the remote review synchronization replayer (`db.ts`) and client-side chat review updates, assuring passive recognition stability updates synchronously with active production trials.
- Configured local reviews synchronization (`/api/anki/sync-db`) to filter out and skip local reviews of type `passive` to avoid polluting the single Anki FSRS curve.
- Updated `GEMINI.md` and `CONTEXT_PROMPT.md` to enforce procedural TDD checks (naming reproducing tests in plans before execution) and to provide clear setup instructions for `fake-indexeddb` database-dependent unit testing.
- Renamed the user-facing term "Локальная колода" (local deck) to "Локальный список" (local list) in settings and practice pages to decouple the offline vocabulary source from Anki terminology, preserving internal database indices to protect user progress.

### Fixed
- Corrected Cyrillic character typo in the reading of word 115 (忙しい) inside the offline starter deck database (`starter_deck.json`).
- Corrected Japanese reading typos for words 425 (アドバイスする) and 459 (ネガティブ) inside the offline starter list database (`starter_deck.json`).
- Stabilized quiz page test assertions by adding focus checks (`toHaveFocus`) before typing values to prevent mock rendering loop race conditions.

## [1.19.0] - 2026-05-25
### Added
- Added dual-state FSRS scheduling support (`passive` and `active` states) for each vocabulary item in IndexedDB to separately track recognition (reading) and recall/usage (chat dialog writing).
- Added contextual sentence examples (`contextExamples` field) to local vocabulary entities, which automatically captures and saves user-generated sentences and translations upon correct usage in dialogue chat.

### Changed
- Upgraded local Dexie database schema to Version 3, with nested indexes for `passive.due` and `active.due` and migration logic to convert flat FSRS fields to the new nested format.
- Refactored `scheduler.ts` to support both flat FSRS structures (for backward compatibility and UI tests) and nested structures by checking signatures (`typeOrNow instanceof Date`).
- Updated bilateral database synchronization logic (`sync-db/route.ts`) to use active FSRS state as primary scheduling sync anchor, replay remote reviews to both active/passive curves, and clean/sanitize HTML from imported card translations.
- Modified `/chat` page dialog submission logic to check the active word list, update the corresponding FSRS state (active if in collected target words, passive otherwise), and record the contextual sentences when target words are successfully used.

## [1.18.0] - 2026-05-25
### Added
- Created dedicated Practice page `/practice` (`src/app/practice/page.tsx` and `src/app/practice/practice.module.css`) to isolate the Gemini conversation practice launcher, scenario generation, and session continuation/discard controls from the configuration UI.
- Unit tests for the practice page in `src/app/practice/__tests__/page.test.tsx` checking page rendering, word source metadata loading, empty states, and mock session generation.

### Changed
- Decoupled configuration settings from practice launcher: removed the Gemini sessions grid, sessions list, and session methods from settings page (`src/app/settings/page.tsx`).
- Renamed the settings tab "Импорт & Anki" to "Источник обучения" (Learning Source).
- Updated home page `/` "Начать практику" button to route directly to `/practice` and updated mascot greeting case 0.
- Allowed Anki integration to be enabled by default by updating backend routes and frontend controls to check `ANKI_ENABLED !== 'false'` and `NEXT_PUBLIC_ANKI_ENABLED !== 'false'`.
- Updated settings page unit tests in `src/app/settings/__tests__/page.test.tsx` and home page unit tests in `src/app/__tests__/page.test.tsx` to align with tab renaming, route redirection, and session block removal.

### Fixed
- Fixed TypeScript compilation error in `src/components/ErrorBoundary.tsx` due to a mismatch in `logger.error` signature argument count.
- Fixed a compilation error by exporting `AnkiWord` from `src/plugins/anki/filter.ts` and updating its import paths to `@/plugins/anki/filter` in `src/lib/gemini/client.ts` and its test files.

## [1.17.0] - 2026-05-25
### Added
- Unit test `src/__tests__/next.config.test.ts` to verify the Content-Security-Policy header configuration across development and production environments.

### Fixed
- Fixed the React `eval() is not supported in this environment` error in development mode (e.g. under Next.js Turbopack) by conditionally appending `'unsafe-eval'` to the `script-src` directive of the Content-Security-Policy header when `process.env.NODE_ENV === 'development'`.

## [1.16.0] - 2026-05-25
### Added
- Configured `ANKI_ENABLED` and `NEXT_PUBLIC_ANKI_ENABLED` environment variables in `vitest.setup.ts` to resolve 403 authorization failures in API route and UI settings tests.

### Changed
- Relocated test files to align with the core/plugins module structure: moved `localDeckService.test.ts` and `db.test.ts` to `src/core/__tests__/`, renamed and moved `fsrs.test.ts` to `src/core/__tests__/scheduler.test.ts`, and moved `client.test.ts` and `filter.test.ts` to `src/plugins/anki/__tests__/`.
- Updated test imports and corrected home page test heading text expectations to match the decoupled branding copy.

### Fixed
- Fixed a path resolution build error in `src/core/localDeckService.ts` by correcting the dynamic import path of `starter_deck.json`.

## [1.15.0] - 2026-05-25
### Added
- Expanded chat history context window passed to Gemini from the last 5 messages to the last 20 messages in `chat.ts` to improve contextual memory.
- Stricter context retention instructions in prompt templates (`prompts.ts`) to prevent dialogue loops and repeat questions about already selected items/colors.
- Active target word nudging instructions in `prompts.ts` forcing the AI to design prompts to guide the user towards remaining unused words.
- Live dialogue integration test scenarios suite (`scenarios.integration.test.ts`) covering memory retention, Keigo exclusion, target word nudging, and ambiguity/loop resolution.

### Changed
- Level instructions for Levels 1 and 2 updated to strictly forbid complex business honorifics (Keigo/Kenjougo) and store-clerk registers, ensuring simple polite structures (〜です/〜ます) are used to prioritize beginner comprehension.
- Split integration tests: `npm run test:integration` now runs only local Anki integration tests (free), while a new script `npm run test:integration:gemini` runs live Gemini API integration tests (paid).

### Fixed
- Fixed minor Japanese text typos in Level 2 examples (`доко` -> `どこ`, `ка` -> `か`).

## [1.14.0] - 2026-05-24
### Added
- CSRF validation utility (`src/lib/csrf.ts`) verifying Origin/Referer headers on mutating POST routes.
- Unified React Class-based `ErrorBoundary` and companion custom styled `ErrorFallback` component.
- Typed `useApiCall` custom hook wrapping API calls with auto-retry and loading/error states.
- Next.js page-level global error boundary at `src/app/error.tsx`.
- Dev/test package overrides for `postcss` (v8.5.10+) to fix CSS parser vulnerabilities.
- Multi-browser/Vitest environment overrides in CSRF validation and AnkiConnectClient browser guard.
- 10 new unit tests covering the error boundary, error fallback component, and api call hook.

### Changed
- Next.js configurations consolidated: CSP headers merged from `next.config.mjs` into `next.config.ts`, and the redundant `.mjs` file deleted.
- Hook memoization: optimized `useJapanification` return value to prevent cascading component re-renders. Enforced provider check throws errors outside provider scope.
- Updated `LanguageSwitcher` to support full keyboard navigation (a11y Arrows, Space, Enter, Escape keys) with active item focus trap logic.

### Fixed
- Fixed Vitest unit test suite failures by wrapping tests inside `JapanificationProvider` and bypassing environment checks on test runners.

## [1.13.0] - 2026-05-23
### Fixed
- FSRS interval inflation bug: reviews inserted into Anki with wrong `reviewType=0` (Learn) instead of `reviewType=1` (Review) for already-learned cards, causing stability explosion during FSRS replay when `elapsed_days >> scheduled_days`.
- `lastInterval` correction: when syncing a card for the first time locally, `lastInterval=0` was sent to Anki even for mature cards; now cross-references `getCardsInfo` to use the card's actual Anki interval.
- Review `duration` field set to 5000ms (5 seconds) instead of 0ms for chat-practice reviews to avoid suspicious stats in Anki.

### Added
- 5 new FSRS unit tests: interval ordering (Again < Hard < Good < Easy) for review and mature cards, overdue interval sanity, new card first interval bounds, and sequential review growth validation.
- `getCardsInfo` lookup in sync-db route for accurate `reviewType` determination based on actual Anki card state (interval/queue).

### Changed
- Sync-db route now determines `reviewType` by querying Anki card metadata instead of inferring from `lastInterval` value alone.

## [1.12.0] - 2026-05-23
### Added
- Individual word synchronization and card adding buttons (represented by 3D compact `RefreshCw` and `Plus` buttons next to each word) on the chat completion summary results page.
- Detailed error messages displayed locally below each word row on individual synchronization/adding failures.
- Step-by-step logging with `[Session: sessionId] [Step: stepName]` prefixes in server-side proxy routes: `POST /api/anki/sync-db` and `POST /api/anki/add` to allow session-level error debugging by AI assistants.

### Changed
- Refactored full sync button handler `handleSyncAndAdd` to use `syncLocalDatabaseWithAnki` helper instead of raw fetch calls, correcting a bug where local review logs were not uploaded during full synchronization.
- Updated client-side database helper `syncLocalDatabaseWithAnki` and page logic to pass `session.id` to the API routes.

### Fixed
- FSRS parameters calculation errors during historical reviews replay inside `syncLocalDatabaseWithAnki` by introducing reference date support in `mapLocalToFsrsCard` to compute correct `elapsed_days`.
- Initial import due date initialization defaulting to today for mature cards with no history logs; now approximates due timestamp based on Anki's card interval.

## [1.11.0] - 2026-05-23
### Added
- Unit tests in `src/lib/__tests__/db.test.ts` covering compound key validation and database safety guards.

### Changed
- Updated `README.md`, `PROJECT_LOGIC.md`, and `CONTEXT_PROMPT.md` to document that running Anki Desktop with AnkiConnect active is required to run the full integration test suite, establishing a coding rule to explicitly instruct the user about this before executing tests.

### Fixed
- Dexie.js database error `Invalid key provided` during bilateral Anki synchronization and chat progress saving by introducing strict key validation checks (`isValidIndexedDbKey`). Invalid/NaN/undefined keys are now skipped/logged rather than causing IndexedDB query failures.

## [1.10.0] - 2026-05-23
### Added
- Per-deck Anki field mapping configurations stored in profile-namespaced `deck_mappings` key within `localStorage`.
- Support for dynamic field mappings mapping in card matching inside `parseAndFilterCards` helper.
- Support for passing dynamic mappings in endpoints: GET `/api/anki/words`, POST `/api/anki/sync-db`, and POST `/api/chat/analyze`.
- Settings page fields input forms supporting editing specific configured decks individually.

### Fixed
- HTML hydration and button nesting console errors on landing page by introducing an `interactive` prop to `<JpUI>` to render static spans instead of nested `<button>`s inside links and other buttons.

## [1.9.0] - 2026-05-23
### Added
- Tabbed interface navigation to the settings page (`src/app/settings/page.tsx`), partitioning configuration into three clean tabs: **Профиль** (profile, settings, presets, levels, multi-profile selector), **Импорт & Anki** (Anki connection, diagnostic assessment, sessions grid, words table), and **Облако** (a clean "В разработке" card).
- React Context provider (`JapanificationProvider`) wrapping the root layout to eliminate global state desynchronization for language/immersion switching.
- Support for URL hash `#profile` to automatically select the Profile tab on settings load.

### Changed
- Decoupled smart mode translations from XP levels, leaving virtual levels/XP purely as decorative progress markers.
- Updated immersion explanation copy in the homepage help modal to explain FSRS-driven translations and clarify that XP levels are decorative progress placeholders.
- Removed the unused "В чат" link from settings header.
- Renamed the hooks hook file from `useJapanification.ts` to `useJapanification.tsx` to support JSX context provider.

### Fixed
- Fixed styling syntax errors in `src/app/page.tsx` (`className="btn-3d styles.secondaryBtn"` -> `className={\`btn-3d \${styles.secondaryBtn}\`}`).
- Fixed key casing in settings inline styles (`justify-content` -> `justifyContent`).
- Aligned homepage and settings page unit tests to match tabbed structure, updated headers, and new help tab text.

## [1.8.0] - 2026-05-23
### Added
- Compact global `LanguageSwitcher` dropdown component styling in 3D Duolingo theme (options: Русский, Smart, 日本語).
- Global language switcher dropdown integration in headers of dashboard (landing page) and settings page.

### Changed
- Replaced the large, orange full-screen emergency "Вернуть на русский" button block in settings with the global `LanguageSwitcher` dropdown in the header.
- Hidden all user-facing "Japanification" (Японизация) branding in Russian UI: renamed "Уровень японизации" to "Уровень" in Profile, and renamed the "Японизация" help tab to "Погружение" (Immersion) along with updating the help documentation.
- Updated `useJapanification` hook and schema definitions to track `uiMode` (`ru` | `smart` | `ja`) and dynamically compute virtual progression levels under-the-hood.

### Fixed
- Updated and fixed unit tests in `src/app/__tests__/page.test.tsx` and `src/app/settings/__tests__/page.test.tsx` to match the new UI strings and mock required Lucide icons (`Globe`, `ChevronDown`, `Check`).

## [1.7.0] - 2026-05-23
### Added
- Granular UI FSRS Japanification system using `ts-fsrs` mathematical scheduler.
- `<JpUI>` React wrapper component and `JpUIProvider` context manager, which handles smart localization, loading state from IndexedDB (`ui_words` table), and sessionStorage-based upgrade session lockout.
- Local IndexedDB table `ui_words` schema and database interface methods (`getLocalUiWords`, `saveLocalUiWord`, `resetLocalUiWords`).
- Floating interactive tooltip in `<JpUI>` with FSRS assessment actions ("Забыл (Рус)" / "Знаю"), showing furigana readings using `<ruby>` tags if reviews count is low (`reps <= 2`).
- Emergency panic button "Переключить на русский" in UI settings page to instantly reset visualization mode without discarding FSRS data.
- UI FSRS Reset button in settings page to delete `ui_words` table records.

### Changed
- Settings page: Integrated 3-way radio selection for UI localization mode (Russian, Smart Japanification, Japanese).
- Landing page: Wrapped navigation links with `<JpUI>` tags for gradual translation.
- Simplified `useJapanification` hook to compute derived virtual properties (XP, virtual level, normal speed) and support the new `uiMode` state structure.

### Fixed
- Resolved all TypeScript compiler type checking errors (`tsc --noEmit`) and Next.js build-time bundling issues.
- Fixed `ts-fsrs` card interface compatibility error by adding `learning_steps` property to `mapLocalToFsrsCard`.
- Fixed `fake-indexeddb` type declaration issues in tests by importing `IDBKeyRange` from the root of the package instead of subpaths.
- Corrected unit test mock definitions (e.g. adding missing `type` field to `AnkiCardInfo` mock in `add.test.ts`).

## [1.6.0] - 2026-05-22
### Added
- Configurable dynamic daily new words quota limit configuration in user profile settings.
- Profile-namespaced persistence of user quota preset selection (`quota_preset`) and custom quota value (`daily_new_words_limit`).
- Dynamic limit calculations in local deck service `getDailyNewWordsLimit` supporting preset boundaries (5, 10, 20) and custom ranges (1-50) with fallback.

### Changed
- Settings UI: Added dynamic daily quota selector group under the profile card, supporting Easy, Standard, Hard, and Custom numeric input.
- Local Deck Mode: Replaced hardcoded daily limit display and stats labels with dynamic values reflecting the active profile limit.

## [1.5.0] - 2026-05-22
### Added
- Local Offline Deck Mode: implemented client-side starter deck (500 words) using IndexedDB (`deckMode === 'local'`), enabling full practice offline without requiring Anki.
- Dynamic Diagnostic Assessment Modal: fullscreen grid checklist organized by JLPT N5, N4, and Conversational categories for marking known/mature words.
- Safe Additive Progress Mode: repeat assessment loading retrieves current DB status, disabling checkbox toggling for words already in progress (`learning` or `review`).
- Service Layer (`localDeckService.ts`): handles database population, active pool generation (due-only + new quota + mature fallback), and daily quota tracking (10 new words limit, aligned to 4:00 AM local time).
- Polyfilled IndexedDB in Vitest: added `fake-indexeddb` setup in `vitest.setup.ts` to ensure clean jsdom test runs.

### Changed
- Settings page: added local deck configuration, real-time stats display, and custom start triggers.

---

## [1.4.0] - 2026-05-22
### Added
- Session discard control: added a red "Сброс" (Discard) button next to "Продолжить" button inside the session grid cards on the settings page (`src/app/settings/page.tsx`).
- Session crash safeguard: implemented session integrity validation checks inside the chat page (`src/app/chat/page.tsx`). Added a user-friendly fallback view with a red "Сбросить сессию" button to safely purge corrupted or outdated sessions.

### Changed
- Removed "Anki" branding from the header logo, renaming it to simply "YomuMogu".
- Converted the header logo container into a clickable `Link` pointing to the root dashboard (`/`), enabling direct navigation back to the landing page from settings or profiles.

---

## [1.3.0] - 2026-05-22
### Changed
- Integrated "Strict Sensei" mode rules into the conversational Gemini system prompts (`src/lib/gemini/prompts.ts`), adding behavior constraints for strict tone, no superficial praise, objective feedback, and topic adherence.
- Upgraded Japanese difficulty level instructions (1-5) in `src/lib/gemini/prompts.ts` to include simulated slow speech and level-appropriate vocabulary/complexity (short sentences for L1-L2, clear desu/masu for L3, advanced/fluent structures for L4-L5).

### Fixed
- Fixed target word nudging behavior (homograph bug) by passing the actual client-side `collectedWords` state to the `/api/chat` route and prioritizing it over history substring matching in prompt generation.

---

## [1.2.0] - 2026-05-22
### Added
- Root `CHANGELOG.md` for high-level version history and project change tracking.
- `CMD-4` command routing inside the `yomumogu-docs-update` skill to handle automated changelog updates.
- Operational constraint `[PL-8.12]` and coding rule `[CP-3.10]` mapping changelog update requirements.

### Changed
- Excluded `CHANGELOG.md` from the mandatory pre-read paths of daily Route A tasks to optimize token consumption and prevent context bloat.

---

## [1.1.0] - 2026-05-22
### Added
- Permanent diagnostic and sandbox script registry [scratch/SCRATCH_LOG.md](file:///c:/YomuMogu/scratch/SCRATCH_LOG.md) to track all temporary code and prevent residual resource pollution.
- Operational constraint `[PL-8.11]` and coding rule `[CP-3.9]` enforcing logging of all scratch files.
- Safe Anki Integration Testing Guidelines in `README.md` warning developers to use separate, unsynced Anki profiles.

### Fixed
- Residual test deck pollution issues by removing old hardcoded test references and implementing clean, isolated run guidelines.

---

## [1.0.0] - 2026-05-22
### Added
- Core bilateral synchronization between local Anki Desktop (AnkiConnect on port 8765) and client-side IndexedDB database (Dexie.js).
- Bilateral review sync coordinator with query deduplication and bulk fetching of card review histories.
- FSRS mathematical scheduler approximation (`stability = interval`, `difficulty = 5.0`, `reps = 1`) to preserve pre-existing mature card intervals.
- Day boundary alignment shifting schedule resets to 4:00 AM local time matching Anki Desktop.
