# KODA Practice — current project context

## Architecture review (2026-10-06)

Eight-role review identified overloaded App.tsx/main.py responsibilities and conflicting ownership of progress/hint state. The resulting decomposition extracts frontend pages, practice controller/layout/event adapter and shared previews, plus backend routers and practice/progress services. Draft synchronization preserves server learning evidence; task responses capture task/code/account identity. Account actions no longer write anonymous SQLite, and solution access checks account hints. See [architecture](docs/architecture.md) and [the integrated review](docs/architecture-review-2026-10-06.md) for boundaries, evidence and remaining limits.

## Editorial task revision (2026-09-26)

- Learner-facing task text was revised across all 200 stable tasks. Hints now follow idea → tool → syntax and avoid repeating the condition or inserting Markdown/code fences.
- Column-selection starters now show only the small DataFrame and variables needed by the exercise; the shared runtime fixture remains unchanged for validation compatibility.
- Stable task, theory, topic and KnowledgeUnit identifiers and reference solutions remain unchanged. `npm run content:audit` passes after the editorial patch.

Updated: 2026-08-14

## Учебный язык контента

- Все 200 задач проходят обязательный редакторский аудит learner-facing текста; технический контракт задачи при редактуре не меняется.
- Подсказки строятся как лестница **идея → инструмент → синтаксис** и пишутся под конкретное упражнение.
- Массовые шаблонные формулировки, повтор названия задачи в подсказках, канцелярит и пустой пересказ условия запрещены.
- Авторский текст задач хранится по stable ID в `content/task_editorial.json`. Импорт обязан найти все 200 записей и не генерирует пользовательский текст из title/focus.
- Content audit проверяет три уровня помощи, completion/explanation, запрещённые обороты и подозрительные нормализованные дубли. Эти правила обязательны для будущего материала.

## Achievements

KODA Achievements v2 is integrated into the existing system as one collection:

- 114 achievement definitions;
- 50 ordered families;
- 5 secret achievements;
- 5 new prestige legendary achievements;
- all original 55 stable IDs and icon files retained;
- counts in collection and profile are read dynamically from the manifest.

The evaluator consumes idempotent domain events. Added event vocabulary includes task runtime errors, sandbox failures, reviews, mastery changes, solution reveal, explicit session completion, and a structured own-question completion event. Task and sandbox producers attach session IDs, elapsed session time, code fingerprints and available task/dataset metadata.

Temporal and sequence evaluators cover comeback gaps, rolling active-day windows, retry chains, error recovery, hint behaviour, delayed repetition, topic diversity, sandbox variants, session combinations and long-term monthly activity. Potentially ambiguous rules use structured evidence. Successful task submissions are analysed by Python `ast` on the backend for method calls, real loops, method-chain depth and materially different solution structure. Sandbox analysis stages and methods are derived inside the isolated Pyodide worker from its parsed AST. Russian manifest text is never parsed into machine rules.

`short_loop` requires an explicit completed 5–10 minute session. Delayed repair is invalidated when the reference solution was revealed. Reconnaissance binds a failed task, a Sandbox experiment carrying that task ID, changed task code, and a later independent solve. Own-question completion remains an explicit structured event: the evaluator intentionally does not infer a user's question from source text. Historical data that lacks these facts does not receive these awards.

Topic events use the stable topic slug rather than a per-task theory article ID. Aggregate `/progress` changes are observed as idempotent `mastery_changed` events with a locally retained historical minimum; this supplies real evidence for weak-topic recovery without moving award decisions into React.

Backfill version 2 is conservative and idempotent: legacy solved-task/course progress remains available to v1 achievements, while v2 rules ignore synthetic backfill events. Session- and code-dependent achievements begin tracking after deployment.

No database migration was required for v2. The existing `learning_events` JSON payload, `user_achievements` primary key, `xp_awarded`, `reward_payload`, `seen_at` and `backfill_version` columns already support the new event metadata and acknowledgement state.

The reward queue remains persistent until explicit confirmation, survives refresh, presents multiple unlocks sequentially and groups bulk historical rewards.

Validation commands and their latest results belong in the implementation commit/report rather than this evergreen context file.

## Profile

- `/profile` is a compact modular overview with account identity, aggregate progress, unlocked achievement preview, recent activity, and an account/security entry point.
- Detailed course progress remains on `/progress`; the profile no longer renders every topic row.
- Achievement preview counts definitions dynamically and shows only actual unlocked rewards (up to six newest), never silhouettes, locked stages, or locked secrets.
- Full solution history lives at `/profile/history`; independent account forms live at `/profile/settings`. Both use router navigation and link back to Profile.
- Display name and a unique normalized `username` are editable. Username is a public profile identifier, not an authentication credential. Email remains the login and email/password changes use Supabase Auth.
- The overview is constrained to 1080 px on desktop and switches to one column at mobile widths, including 320, 375, 390, and 430 px.

## Achievement collection performance

- The collection still renders exactly one preview per family (50 cards) and mounts stage/detail UI only after a family is opened.
- The measured bottleneck was image payload: the 50 first-stage family PNG previews total 9,680,874 bytes. Generated 160×160 WebP previews total 322,550 bytes for the same representative set (96.7% smaller); all 114 thumbnails total 787,882 bytes versus 23,892,703 bytes of source PNGs.
- Preview images use versioned `.thumb.webp` URLs, native lazy loading, asynchronous decoding, explicit dimensions, and original-PNG fallback. Original assets remain unchanged for detail and reward scenes.
- The static manifest is deduplicated in memory and retained indefinitely in the TanStack Query cache. Progress uses the existing aggregate `/progress` request and stale-while-revalidate behavior; filters are entirely local.
- Cold load renders a header/filter/grid skeleton immediately. In the measured desktop viewport native lazy loading requested 35 visible/near-viewport thumbnails, no full PNGs, while all 50 family cards were available in the DOM. Warm remount showed 50 cards immediately with no skeleton and no manifest refetch.
- Family detail is a separate lazy JavaScript chunk; opening a family then loads only that family's full-size PNG stages. Immutable icon responses use a one-year cache, while the versioned manifest uses a one-hour cache with stale-while-revalidate.

## Sandbox performance

- The Sandbox page renders immediately and creates one Pyodide 0.27.7 Web Worker on mount. The same worker and Python globals serve every ordinary Run; Stop, timeout, Restart, route unmount and logout destroy it. Runtime is intentionally not retained across route transitions to prevent account/session memory from surviving outside the page.
- Cold boot eagerly loads only NumPy and pandas. Matplotlib and Seaborn are detected from the Python AST and loaded on first use; each remains installed in that worker until Restart. The execution timeout begins only when Python code starts, not while a lazy package is downloading.
- Worker states distinguish Python preparation, pandas/package loading and execution. Development diagnostics instrument the complete click-to-render pipeline, Python execution/serialization, filesystem work, cross-context messages, and post-render achievement side effects. Cross-context timestamps use epoch time so Worker and Window clocks are comparable.
- The former separate synchronous `inspect` call was the measured source of the repeated delay: 2,844 ms of a 2,929 ms trivial Run. Merely moving that same call into the `run` message did not remove its cost. The final implementation compiles the Python execution harness once during cold start and performs AST inspection inside the same asynchronous Python invocation that executes ordinary code. If that AST finds a referenced dataset or lazy plotting package that is not ready, the Worker requests only the missing dependency and resumes the same request; warm pandas code has neither a synchronous preflight nor repeated harness compilation.
- CSV paths are discovered from Python string literals through `ast`, not regular expressions. Only referenced `/datasets/...` files are downloaded and mounted. The frontend and worker retain version/hash registries, so unchanged files are not transferred again; deletion and rename remove stale virtual paths. Restart creates a new generation and remounts a referenced file on demand.
- Achievement evaluation now calculates each definition's progress once, and persistence/evaluation runs after the result has committed to the screen rather than delaying visible output.
- Result transport is bounded to 100 rows × 30 columns, 100,000 stdout/traceback characters and 20,000 repr characters. Plot serialization runs only when Matplotlib is actually imported and a figure exists.
- Measured baseline: production Sandbox ready 6,436 ms; a trivial Run took 2,929 ms, of which 2,844 ms was synchronous preflight/runner work. After precompiling the harness once, a cached production cold boot measured about 3,536 ms and warm trivial Python executions measured 42–71 ms (click-to-render stayed below roughly 350 ms in an uncontended tab). The UI reports `executionMs`, not cold boot, network preparation, or React time. Package and network timings vary by cache and device, so the invariant is that a warm Run performs no runtime/package/file startup.
- Pyodide's versioned jsDelivr JS/WASM/package URLs return a one-year public browser-cache policy. The application does not self-host or permanently cache mutable Sandbox/API resources.
- A follow-up regression audit verified that the production Worker → UI success contract still returned `2`, but exposed seconds of promise/scheduling overhead around `runPythonAsync` while the instrumented Python body itself took about 1 ms. The compiled synchronous harness now runs with `runPython` inside the dedicated Worker; Stop/timeout remain safe because termination happens from the responsive main thread. Error payloads always include the complete result shape, execution time comes from the runner's user-code interval rather than package/file/UI work, and the UI retains a successful result after readiness and achievement effects. Automated tests cover value + stdout + timing, error recovery, matching/stale request IDs, ten sequential Runs, NumPy, Series, DataFrame and empty output; the real runner contract is executed under Pyodide in `npm test`.
# Release-blocker stability notes (2026-08-27)

- Sandbox execution keeps the 15-second budget for user code; cold package and dataset preparation have a separate bounded phase.
- Task validation traces required methods through assignments that produce `result` and compares pandas dtype metadata and Series names.
- Task and achievement persistence is identity-bound; delayed saves are cancelled or rejected after account switches.
- Practice API failures are shown inline with retry while preserving editor code and clearly labeling any previous output.
- Machine-readable evidence is stored in `reports/task-learning-audit.json` and `reports/system-stability-review.json`.

## Design direction prototype (2026-10-06)

## Reusable KODA Soft Line kit (2026-10-07)

## Production KODA Air rollout (2026-10-07)

The approved airy visual direction is now the production web theme: lowercase wave brand, grouped sidebar, serif headings, teal controls, shared original SVG icons, light editors and real catalog route links. The layout applies across the application; existing execution, content IDs and persistence remain in their controllers. Browser HTML navigation is distinguished from JSON/API requests so deep links reach the SPA. Details and validation are recorded in `docs/air-design.md`.

Original semantic SVG icons and native React button components live in `apps/web/src/ui/`. The isolated `/design-system` gallery demonstrates their variants, states and local interactions. This is the shared source of truth for future adoption; existing production icons and buttons have not been migrated. API, tokens and proportional product/UX/behavior/technical review are documented in `docs/design-system.md`.

The Founder requested a light Google/Apple-inspired mockup after rejecting the earlier visual direction. `/design-prototype` is a separate interactive demonstration of overview, practice, catalog and progress. Its data and execution feedback are local samples, with no production progress writes. The integrated eight-role decision and acceptance criteria are documented in `docs/design-prototype.md`.

## KODA Market and achievement room (2026-10-08)

The supplied Market sources are integrated through the Content Pipeline: 117 objectives map to 113 distinct tasks, extending 19 stable foundation tasks and adding 94 tasks. The bank now has 294 tasks and 40 KnowledgeUnits. Canonical store data retains 30 orders and 18 columns, absolute discounts, and the source values for cancelled/returned orders. Articles and independently authored cheat sheets cover each unit; tasks include three hints, individual completion summaries, prepared inputs, and exact official documentation links.

The catalog offers a 19-lesson KODA Market project projection over existing task identities. Its twelve GroupBy steps span KnowledgeUnits without duplicating tasks or resetting progress. SQL runs read-only SQLite in the task subprocess. Excel and Power BI are explicitly bounded educational simulators with formula/report controls and computed output; they do not execute desktop Office or create xlsx/pbix files. Free practice remains in its isolated browser Pyodide Worker. Practice plots show actual PNG previews, while expected-answer comparison uses semantic plot values rather than image bytes.

Achievements open as a furnished room with up to ten representative trophies and an optional name toggle; the full fifty-family collection remains accessible. All 114 stage names express growth, with exact requirements shown separately. Tier art changes shape and material; locked art stays muted. Award IDs, conditions, XP, and stored progress are unchanged. See docs/market-room-review-2026-10.md, docs/achievement-room-2026-10.md, and docs/new-modes-contract.md for acceptance evidence and simulator limits.

Release validation: content audit also passed on the staged catalog excluding earlier working-tree drafts; 211 API tests, 125 web tests, isolated Sandbox contract, lint/typecheck/build and the final 21-scenario browser run passed. Independent QA confirmed room geometry, readable optional labels, 72px tier differences, focus restoration, new-mode answers and project navigation. The actual 8014 application was refreshed with the same database; solved IDs, attempts and XP were preserved. Ten native Excel/DAX teaching examples were not executed in Office/Power BI engines; the educational simulators are tested.

## KODA Market authored revision — October 2026

The final KODA_Market_Codex_upload.zip replaces the earlier outline interpretation. Exactly 115 authored steps are projected into 19 lessons: GroupBy 1–12, Python/pandas 13–82, SQL 83–92, Excel 93–102, Power BI 103–112, and cross-tool cases 113–115. Source situations, questions, three hints and analyses are retained; executable answer contracts are separately visible. The complete catalog has 295 exercises, 41 KnowledgeUnits and all 200 foundation identifiers. Archived reading-only topics retain their stable knowledge identities and full articles/cheat sheets.

Revision market-authored-v2 explicitly covers 128 affected IDs and 12 retired Market IDs. Local/browser evidence is archived once; cloud storage uses internal revision-qualified keys so legacy completion cannot rehydrate. Unrelated task evidence, private files and historical earned trophies are preserved. Native modes remain bounded educational simulators; native Office execution and authenticated remote Supabase migration are not verified. Source provenance and the integrated eight-role decision are recorded in docs/market-authored-v2-review.md, docs/market-authored-v2-integration.md and docs/market-progress-revision.md.

Release validation: working and staged content audits passed for 295 tasks/41 units. Independent API 397 and frontend 139 tests passed; the Sandbox output contract and two core-preparation regressions passed. All 25 browser scenarios have passing evidence; final seven checks covered real BI interactions, compact mobile panels, local keyboard table scrolling, exact Excel row formatting, Sandbox initial/Restart/reload, plots, the 15-second timeout and recovery. The actual 8014 application was restarted against its backed-up database, with all five unrelated attempts, one hint and one review exactly preserved; solved start-001 and 15 XP remain. Independent read-only QA verified 19 course cards, 115 source tasks, source step 115 and worker version 11, without writing user progress. Detailed evidence and limitations are in reports/market-authored-v2-verification.json.


## Shared sidebar-to-content spacing

The compact theme now uses a consistent 20px desktop leading gutter, with readable page/article width caps aligned left; mobile keeps its 18px gutter. Sandbox fills available main width without changing stacked code/result flow, editor height, data, progress or execution. See docs/content-spacing-review.md for the eight-role decision and independent geometry acceptance.

## Manual study time and ivory room (2026-10-09)

An optional global study timer beside the profile supports Start, Pause, Resume and Finish. Hidden pages and ownership/account transitions pause it; durable account-scoped immutable intervals supply Progress, Dashboard and a five-stage time achievement. Intervals are unioned, never inferred from old task sessions. Five-second visibility heartbeats and one-minute journal persistence avoid excessive storage; normal pause/close flushes immediately, while an abrupt crash may lose the unflushed minute. Observer hydration never rewrites the timer owner's metadata. Cloud sync uploads only unacknowledged intervals and preserves anonymous/account separation.

The achievement room uses the Founder’s cream architectural reference as an edited empty backdrop, interactive tier-specific glass objects on two shelves and a clock on the table, with a mobile grid. Existing 114 definitions remain unchanged; there are now 119 achievements in 51 families. Review, asset provenance, final prompt and verification limits: docs/study-time-room-review.md.

## Glass trophy visual preview (2026-10-09)

The Founder requested a standalone achievement progression mockup matching clear glass with green edging, covering all ten families presented in the room. The complete concept is split into docs/design/achievement-glass-all10-sheet1-v1.png and achievement-glass-all10-sheet2-v1.png: five families per sheet and five visual variants per family. This supersedes the earlier four-family preview for coverage. This is a design concept only; no application IDs, thresholds, assets or runtime behavior are replaced. Integrated review and built-in image_gen prompt set: docs/design/achievement-glass-all10-preview.md.

Room composition preview: docs/design/achievement-glass-room-all10-v2.png places all ten sculptural glass families on the ivory room's two shelves and table (4+5+1). Independent visual review accepts the placement, support contact and material; this is a stylistic raster mockup rather than a replacement of interactive production assets. Prompt set and scope: docs/design/achievement-glass-room-preview.md.
