# KODA Practice — current project context

Updated: 2026-08-13

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

The evaluator consumes idempotent domain events. Added event vocabulary includes task runtime errors, sandbox failures, reviews, mastery changes and a structured own-question completion event. Task and sandbox producers now attach session IDs, elapsed session time, code fingerprints and available task/dataset metadata.

Temporal and sequence evaluators cover comeback gaps, rolling active-day windows, retry chains, error recovery, hint behaviour, delayed repetition, topic diversity, sandbox variants, session combinations and long-term monthly activity. Potentially ambiguous rules such as vectorization, method chaining, alternative strategies and full mini-analysis require explicit structured evidence and do not guess from source text.

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
