const PYODIDE_VERSION = "0.27.7";
const PYODIDE_BASE = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;
const SEABORN_WHEEL = "https://files.pythonhosted.org/packages/83/11/00d3c3dfc25ad54e731d91449895a79e4bf2384dc3ac01809010ba88f6d5/seaborn-0.13.2-py3-none-any.whl";
let runtime;
let initializing;
let state = "booting";
let manifest = new Map();
const loadedPackages = new Set(["python"]);
const bootStarted = performance.now();

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

const INSPECTOR = String.raw`
import ast, json
tree = ast.parse(__koda_code, filename="solution.py", mode="exec")
imports = sorted({node.names[0].name.split('.')[0] for node in ast.walk(tree) if isinstance(node, ast.Import)} | {node.module.split('.')[0] for node in ast.walk(tree) if isinstance(node, ast.ImportFrom) and node.module})
datasets = sorted({node.value for node in ast.walk(tree) if isinstance(node, ast.Constant) and isinstance(node.value, str) and node.value.startswith('/datasets/')})
json.dumps({"imports": imports, "datasets": datasets})
`;

function inspectCode(code) {
  runtime.globals.set("__koda_code", code);
  return JSON.parse(runtime.runPython(INSPECTOR));
}

async function ensureCodePackages(imports, requestId) {
  const needsMatplotlib = imports.includes("matplotlib") || imports.includes("seaborn");
  if (needsMatplotlib && !loadedPackages.has("matplotlib")) {
    status("packages", "Загрузка Matplotlib…", requestId);
    await runtime.loadPackage("matplotlib");
    runtime.runPython("import matplotlib\nmatplotlib.use('Agg')");
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
  try { runtime.FS.mkdir("/datasets"); } catch (error) { if (!String(error).includes("File exists")) throw error; }
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
import ast, base64, contextlib, io, json, sys, traceback

MAX_STDOUT = 100_000
MAX_VALUE = 20_000

def _safe(value):
    if value is None: return None
    if isinstance(value, (bool, int, float, str)): return value
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
plots = []
try:
    tree = ast.parse(__koda_code, filename="solution.py", mode="exec")
    last = tree.body.pop() if tree.body and isinstance(tree.body[-1], ast.Expr) else None
    with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stdout):
        exec(compile(tree, "solution.py", "exec"), __koda_globals)
        value = eval(compile(ast.Expression(last.value), "solution.py", "eval"), __koda_globals) if last else None
    if "matplotlib.pyplot" in sys.modules:
        import matplotlib.pyplot as plt
        for number in plt.get_fignums():
            buffer = io.BytesIO()
            plt.figure(number).savefig(buffer, format="png", bbox_inches="tight", dpi=120)
            plots.append("data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode("ascii"))
        plt.close("all")
    output = stdout.getvalue()
    __koda_payload = {"ok": True, "stdout": output[:MAX_STDOUT], "stdoutTruncated": len(output) > MAX_STDOUT, "result": _result(value), "plots": plots}
except BaseException as error:
    output = stdout.getvalue()
    trace = traceback.format_exc()
    __koda_payload = {"ok": False, "stdout": output[:MAX_STDOUT], "stdoutTruncated": len(output) > MAX_STDOUT, "errorType": type(error).__name__, "message": str(error)[:MAX_VALUE], "traceback": trace[:MAX_STDOUT]}
json.dumps(__koda_payload, ensure_ascii=False)
`;

onmessage = async (event) => {
  const { type, requestId } = event.data;
  try {
    await ensureInitialized();
    if (type === "inspect") {
      postMessage({ type: "inspection", requestId, payload: inspectCode(event.data.code) });
      return;
    }
    if (type !== "run" || state === "running") return;
    state = "running";
    const executionStarted = performance.now();
    const inspection = inspectCode(event.data.code);
    await ensureCodePackages(inspection.imports, requestId);
    mount(event.data.files || []);
    status("running", "Выполнение…", requestId);
    runtime.globals.set("__koda_code", event.data.code);
    const pythonStarted = performance.now();
    const payload = JSON.parse(await runtime.runPythonAsync(RUNNER));
    payload.executionMs = performance.now() - pythonStarted;
    payload.totalRunMs = performance.now() - executionStarted;
    state = "ready";
    postMessage({ type: "result", requestId, payload });
  } catch (error) {
    state = "ready";
    postMessage({ type: "fatal", requestId, message: String(error?.message || error) });
  }
};

ensureInitialized().catch((error) => postMessage({ type: "fatal", message: `Не удалось загрузить Python: ${error.message || error}` }));
