const PYODIDE_VERSION = "0.27.7";
const PYODIDE_BASE = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;
const SEABORN_WHEEL = "https://files.pythonhosted.org/packages/83/11/00d3c3dfc25ad54e731d91449895a79e4bf2384dc3ac01809010ba88f6d5/seaborn-0.13.2-py3-none-any.whl";
let runtime;
let initializing;
let state = "booting";
let manifest = new Map();
const loadedPackages = new Set(["python"]);
const bootStarted = performance.now();
const workerId = crypto.randomUUID();
const runtimeGeneration = crypto.randomUUID();

function status(phase, detail, requestId) {
  state = phase;
  postMessage({ type: "status", phase, detail, requestId });
}

async function initialize() {
  status("booting", "Подготовка Python…");
  const workerCreatedMs = performance.now() - bootStarted;
  importScripts(`${PYODIDE_BASE}pyodide.js`);
  runtime = await loadPyodide({ indexURL: PYODIDE_BASE });
  const pyodideReadyMs = performance.now() - bootStarted;
  status("packages", "Загрузка pandas…");
  await runtime.loadPackage(["numpy", "pandas"]);
  loadedPackages.add("numpy");
  loadedPackages.add("pandas");
  runtime.runPython("__koda_globals = {'__name__': '__main__'}");
  runtime.runPython(INSTALL_RUNNER);
  const packagesReadyMs = performance.now() - bootStarted;
  state = "ready";
  postMessage({
    type: "ready",
    version: PYODIDE_VERSION,
    metrics: { workerCreatedMs, pyodideReadyMs, packagesReadyMs },
  });
}

function ensureInitialized() {
  return (initializing ||= initialize().catch((error) => {
    state = "failed";
    throw error;
  }));
}

async function ensureCodePackages(imports, requestId) {
  const needsMatplotlib = imports.includes("matplotlib") || imports.includes("seaborn");
  if (needsMatplotlib && !loadedPackages.has("matplotlib")) {
    status("packages", "Загрузка Matplotlib…", requestId);
    await runtime.loadPackage("matplotlib");
    runtime.runPython("import matplotlib\nmatplotlib.use('Agg')\nimport matplotlib.pyplot");
    loadedPackages.add("matplotlib");
  }
  if (imports.includes("seaborn") && !loadedPackages.has("seaborn")) {
    status("packages", "Загрузка Seaborn…", requestId);
    await runtime.loadPackage("micropip");
    loadedPackages.add("micropip");
    await runtime.runPythonAsync(`import micropip\nawait micropip.install('${SEABORN_WHEEL}', deps=False)`);
    loadedPackages.add("seaborn");
  }
}

function mount(files) {
  const available = new Map(files.map((file) => [file.logicalPath, file.version]));
  if (!runtime.FS.analyzePath("/datasets").exists) runtime.FS.mkdir("/datasets");
  for (const path of manifest.keys()) {
    if (!available.has(path)) {
      try { runtime.FS.unlink(path); } catch { /* already absent */ }
      manifest.delete(path);
    }
  }
  for (const file of files) {
    if (manifest.get(file.logicalPath) !== file.version && file.buffer) {
      runtime.FS.writeFile(file.logicalPath, new Uint8Array(file.buffer));
      manifest.set(file.logicalPath, file.version);
    }
  }
}

const RUNNER = String.raw`
import ast, base64, contextlib, io, json, math, sys, time, traceback

MAX_STDOUT = 100_000
MAX_VALUE = 20_000

class _KodaPreparationRequired(Exception):
    pass

def _safe(value):
    if value is None: return None
    try:
        import pandas as pd
        if value is pd.NA or value is pd.NaT: return None
        missing = pd.isna(value)
        if isinstance(missing, bool) and missing: return None
        if type(missing).__name__ == "bool_" and bool(missing): return None
    except (TypeError, ValueError):
        pass
    if isinstance(value, float):
        if math.isnan(value): return None
        if math.isinf(value): return str(value)
        return value
    if isinstance(value, (bool, int, str)): return value
    if type(value).__module__.startswith("numpy") and hasattr(value, "item"):
        try: return _safe(value.item())
        except (TypeError, ValueError): pass
    return str(value)

def _table(value):
    import pandas as pd
    original_rows = len(value)
    if isinstance(value, pd.Series):
        frame = value.to_frame(name=value.name if value.name is not None else "value")
        kind = "series"
    else:
        frame = value
        kind = "dataframe"
    original_columns = len(frame.columns)
    shown = frame.iloc[:100, :30]
    return {"kind": kind, "columns": [_safe(x) for x in shown.columns], "index": [_safe(x) for x in shown.index], "data": [[_safe(x) for x in row] for row in shown.itertuples(index=False, name=None)], "truncated": original_rows > 100 or original_columns > 30, "shape": [original_rows, original_columns]}

def _result(value):
    pd = sys.modules.get("pandas")
    if pd is not None and isinstance(value, (pd.DataFrame, pd.Series)): return _table(value)
    if value is None: return None
    rendered = repr(value)
    return {"kind": "value", "value": rendered[:MAX_VALUE], "truncated": len(rendered) > MAX_VALUE}

stdout = io.StringIO()
stderr = io.StringIO()
plots = []
__timing = {}
try:
    __timing["bootstrapStart"] = time.perf_counter()
    tree = ast.parse(__koda_code, filename="solution.py", mode="exec")
    imports = sorted({node.names[0].name.split('.')[0] for node in ast.walk(tree) if isinstance(node, ast.Import)} | {node.module.split('.')[0] for node in ast.walk(tree) if isinstance(node, ast.ImportFrom) and node.module})
    datasets = sorted({node.value for node in ast.walk(tree) if isinstance(node, ast.Constant) and isinstance(node.value, str) and node.value.startswith('/datasets/')})
    methods = sorted({node.func.attr for node in ast.walk(tree) if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute)})
    stage_methods = {
        'load': {'read_csv'},
        'inspect': {'head', 'tail', 'info', 'describe'},
        'clean': {'dropna', 'fillna', 'drop_duplicates', 'astype', 'replace'},
        'transform': {'assign', 'map', 'apply', 'rename', 'query', 'sort_values'},
        'aggregate': {'groupby', 'agg', 'sum', 'mean', 'pivot_table', 'value_counts'},
        'visualize': {'plot', 'barplot', 'countplot', 'lineplot', 'scatterplot', 'histplot', 'show'},
    }
    analysis_stages = sorted(stage for stage, names in stage_methods.items() if set(methods) & names)
    packages = sorted({name for name in imports if name in {'matplotlib', 'seaborn'} and name not in __koda_loaded_packages})
    missing_files = sorted({path for path in datasets if path in __koda_known_paths and path not in __koda_mounted_paths})
    if packages or missing_files:
        raise _KodaPreparationRequired(json.dumps({"packages": packages, "datasets": missing_files}))
    last = tree.body.pop() if tree.body and isinstance(tree.body[-1], ast.Expr) else None
    pyplot = sys.modules.get("matplotlib.pyplot")
    original_show = pyplot.show if pyplot is not None else None
    if pyplot is not None:
        pyplot.show = lambda *args, **kwargs: None
    __timing["pythonStart"] = time.perf_counter()
    with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
        exec(compile(tree, "solution.py", "exec"), __koda_globals)
        value = eval(compile(ast.Expression(last.value), "solution.py", "eval"), __koda_globals) if last else None
    __timing["pythonEnd"] = time.perf_counter()
    __timing["resultStart"] = time.perf_counter()
    serialized_result = _result(value)
    __timing["resultEnd"] = time.perf_counter()
    __timing["stdoutStart"] = time.perf_counter()
    output = stdout.getvalue()
    error_output = stderr.getvalue()
    __timing["stdoutEnd"] = time.perf_counter()
    __timing["plotsStart"] = time.perf_counter()
    if "matplotlib.pyplot" in sys.modules:
        import matplotlib.pyplot as plt
        for number in plt.get_fignums():
            buffer = io.BytesIO()
            plt.figure(number).savefig(buffer, format="png", bbox_inches="tight", dpi=120)
            plots.append("data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode("ascii"))
        plt.close("all")
        if original_show is not None:
            plt.show = original_show
    __timing["plotsEnd"] = time.perf_counter()
    __koda_payload = {"ok": True, "stdout": output[:MAX_STDOUT], "stderr": error_output[:MAX_STDOUT], "stdoutTruncated": len(output) > MAX_STDOUT, "stderrTruncated": len(error_output) > MAX_STDOUT, "result": serialized_result, "plots": plots, "analysis": {"methods": methods, "stages": analysis_stages}, "pythonTiming": {key: round((value - __timing["bootstrapStart"]) * 1000, 3) for key, value in __timing.items()}}
except _KodaPreparationRequired as preparation:
    __koda_payload = {"control": "prepare", **json.loads(str(preparation))}
except BaseException as error:
    if 'pyplot' in locals() and pyplot is not None and 'original_show' in locals() and original_show is not None:
        pyplot.show = original_show
    __timing["pythonEnd"] = time.perf_counter()
    output = stdout.getvalue()
    error_output = stderr.getvalue()
    trace = traceback.format_exc()
    __koda_payload = {"ok": False, "stdout": output[:MAX_STDOUT], "stderr": error_output[:MAX_STDOUT], "stdoutTruncated": len(output) > MAX_STDOUT, "stderrTruncated": len(error_output) > MAX_STDOUT, "errorType": type(error).__name__, "message": str(error)[:MAX_VALUE], "traceback": trace[:MAX_STDOUT], "plots": [], "pythonTiming": {key: round((value - __timing["bootstrapStart"]) * 1000, 3) for key, value in __timing.items()}}
return json.dumps(__koda_payload, ensure_ascii=False, allow_nan=False)
`;

// Compile the execution harness once during cold start. Re-parsing and compiling
// the full serializer/traceback/plot harness on every Run dominated warm latency.
const INSTALL_RUNNER = `def __koda_run():\n${RUNNER.split("\n").map((line) => `    ${line}`).join("\n")}`;

onmessage = async (event) => {
  const { type, requestId } = event.data;
  const receivedEpochMs = Date.now();
  try {
    await ensureInitialized();
    if (type !== "run" || state === "running") return;
    const executionStarted = performance.now();
    state = "running";
    const filesystemStarted = performance.now();
    mount(event.data.files || []);
    const filesystemEnded = performance.now();
    status("running", "Выполнение…", requestId);
    runtime.globals.set("__koda_code", event.data.code);
    runtime.globals.set("__koda_known_paths", (event.data.files || []).map((file) => file.logicalPath));
    runtime.globals.set("__koda_mounted_paths", Array.from(manifest.keys()));
    runtime.globals.set("__koda_loaded_packages", Array.from(loadedPackages));
    const pythonStarted = performance.now();
    let payload = JSON.parse(await runtime.runPythonAsync("__koda_run()"));
    if (payload.control === "prepare") {
      if (payload.packages?.length) {
        await ensureCodePackages(payload.packages, requestId);
        runtime.globals.set("__koda_loaded_packages", Array.from(loadedPackages));
      }
      if (payload.datasets?.length) {
        state = "ready";
        postMessage({ type: "needs-files", requestId, paths: payload.datasets });
        return;
      }
      status("running", "Выполнение…", requestId);
      payload = JSON.parse(await runtime.runPythonAsync("__koda_run()"));
    }
    const afterPythonAt = performance.now();
    payload.executionMs = Math.max(0, (payload.pythonTiming?.pythonEnd ?? 0) - (payload.pythonTiming?.pythonStart ?? 0));
    payload.totalRunMs = performance.now() - executionStarted;
    payload.workerTiming = { receivedEpochMs, runtimeReadyAt: executionStarted, filesystemMs: filesystemEnded - filesystemStarted, beforePythonAt: pythonStarted, afterPythonAt, postMessageEpochMs: Date.now(), workerId, runtimeGeneration };
    state = "ready";
    postMessage({ type: "result", requestId, payload });
  } catch (error) {
    state = "ready";
    postMessage({ type: "fatal", requestId, message: String(error?.message || error) });
  }
};

ensureInitialized().catch((error) => postMessage({ type: "fatal", message: `Не удалось загрузить Python: ${error.message || error}` }));
