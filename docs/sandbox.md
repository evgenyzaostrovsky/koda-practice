# KODA Practice Sandbox

## Architecture

The sandbox is an independent `/sandbox` application route. It does not call the task runner, submit attempts, award XP, or access expected solutions.

```text
private CSV in Supabase Storage
  → authenticated FastAPI `/api/sandbox/files/*`
  → browser downloads bytes with the current JWT
  → transferable ArrayBuffer enters a dedicated Web Worker
  → Pyodide writes the bytes to `/datasets/<safe-name>.csv`
  → ordinary pandas `pd.read_csv("/datasets/<safe-name>.csv")`
```

Arbitrary sandbox Python never runs in the FastAPI process. The browser worker loads the pinned Pyodide 0.27.7 runtime and its compatible pandas, NumPy, Matplotlib, and Seaborn packages. Variables remain in the worker namespace between runs. Stop, timeout, or “Restart environment” terminates the worker and clears Python variables; files are remounted before the next run.

## Storage and access

Migration `supabase/migrations/202608110002_sandbox_files.sql` creates the private `koda-sandbox` bucket, `sandbox_files` metadata table, constraints, and RLS policies. Objects use an internal `<auth.uid()>/<uuid>` key that is never returned by the public API. UI and Python only see `/datasets/<name>.csv`.

Every metadata and Storage operation is made by FastAPI with the caller’s verified JWT. RLS and explicit owner filters isolate list, content, rename, and delete operations. No owner ID is accepted from the client. The Supabase Service Role is neither required nor exposed.

Limits: CSV only, 20 MiB per file, 100 MiB total per account. Names may contain Unicode and spaces but not control characters, slashes, backslashes, `..`, or absolute paths. Duplicate uploads receive `_2`, `_3`, and so on. Encoding and delimiter are deliberately left to normal pandas parameters.

## API

- `GET /api/sandbox/files` — manifest.
- `POST /api/sandbox/files` — multipart field `file`.
- `GET /api/sandbox/files/{id}/content` — protected bytes.
- `PATCH /api/sandbox/files/{id}` — `{ "name": "new.csv" }`.
- `DELETE /api/sandbox/files/{id}` — delete object and metadata.

The manifest exposes `id`, `name`, `logicalPath`, size, MIME type, timestamps, and a SHA-256 version. Before each run the frontend fetches only changed versions. Rename and deletion update the worker filesystem on the next sync.

## Configuration and local run

Apply both Supabase migrations, then configure `KODA_AUTH_ENABLED=true`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `KODA_SANDBOX_BUCKET=koda-sandbox`, and matching public Vite auth variables. Run `npm run setup` followed by `npm run dev`. The bucket must remain private.

Deleting a file in the UI removes the Storage object and metadata row. Account deletion cascades metadata; Storage object lifecycle cleanup should be handled by the application before account deletion or by a scheduled administrative cleanup job.

## Output pipeline and regression checks

Every Run creates a request id and sends code plus the current file manifest to the persistent worker. The worker restores `/datasets`, executes the code in the persistent `__koda_globals` namespace, converts stdout, stderr, the final expression, DataFrame/Series previews, tracebacks, and plots to plain structured-clone-safe data, and returns one matching result message. React stores that payload and renders it in the Result panel.

`/datasets` is created only when absent. Re-running code must not call `FS.mkdir` blindly: Pyodide reports an existing Emscripten directory as `ErrnoError`, not a stable browser-independent `"File exists"` string.

`npm run test:sandbox-contract` exercises the actual worker harness for stdout, stderr, expressions, persistent variables, tables, errors, recovery, and PNG plots. `npm run test:sandbox-e2e` builds on that with an unmocked Chromium/Pyodide run through the real editor, Run button, worker, and visible DOM for stdout, `42`, a DataFrame, combined stdout/table output, `ValueError`, and Matplotlib.

The application does not register a Service Worker or use Cache Storage. FastAPI serves SPA routes and `sandbox-worker.js` with `no-cache, no-store, must-revalidate`; content-hashed `/assets/` files are immutable. `/api/health` exposes the deployed `RENDER_GIT_COMMIT` so a production check can prove which revision is live.
