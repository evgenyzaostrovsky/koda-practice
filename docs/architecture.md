# Application architecture

## Frontend

`apps/web/src/App.tsx` composes the application shell and routes. Independent screens live in `pages/`; Knowledge, Sandbox, Profile and achievements retain their existing feature modules.

Practice has explicit boundaries:

- `practice/Practice.tsx`: rendering, keyed by account and task;
- `practice/usePracticeController.ts`: task loading, editor persistence, execution/checking, help and catalog navigation;
- `practice/usePracticeLayout.ts`: pane sizing;
- `practice/achievement-events.ts`: submission event payloads;
- `components/practice-shared.tsx`: shared headers, data/result previews and request states;
- `queries.ts`: shared catalog/progress query functions.

Editor changes persist locally immediately. Cloud draft writes remain debounced. Each execution captures task ID, submitted code, exercise metadata and account ID. A late response may save its originating task's result, but cannot update another task's screen or a different account's state. Navigation uses the catalog's ordered exercise IDs.

`task-storage.ts` owns browser drafts. `cloud-sync.ts` seeds missing draft rows with conflict-ignore, then updates only browser-owned fields. It does not overwrite server hint counts, attempt counts or completion. Explicit legacy import uses a separate function; existing account records win conflicts.

## Backend

`apps/api/app/main.py` configures FastAPI, middleware, startup and static SPA hosting, then includes routers:

- `routers/catalog.py`: modules, topics, exercises, theory and knowledge;
- `routers/practice.py`: execution, submission, hints and solution access;
- `routers/progress.py`: progress and review HTTP endpoints;
- `routers/sandbox.py`: private dataset file operations.

`services/practice.py` validates submissions and produces feedback/evidence. `services/progress.py` owns persistence, hint access and progress aggregation. Anonymous mode uses SQLite; account mode uses user-scoped Supabase records. Account hints and attempts never write into anonymous SQLite. Solution access checks the current user's hint evidence.

Cloud review storage does not exist yet. Account review listing returns an empty list and completion returns 404, consistent with account progress reporting zero due reviews. Anonymous review behavior is retained.

## Execution and verification

Course submissions run through the existing isolated Python worker process. Free-practice Python runs only in the browser Pyodide Web Worker. Private datasets use Storage and logical `/datasets/...` paths.

API tests automatically isolate SQLite and the reference-result cache per test. Browser runs must use a separate `KODA_DB_PATH`, disabled account mode for anonymous checks, and a fresh server serving the production build.

The implementation evidence, limitations and outstanding work are recorded in `architecture-review-2026-10-06.md`. Cloud/local metric differences, transactional concurrent submission counters, achievement event delivery and additional learning-content coupling remain separate work; decomposition does not imply those semantics were redesigned.
