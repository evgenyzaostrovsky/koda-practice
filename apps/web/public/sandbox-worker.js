const PYODIDE_VERSION = "0.27.7";
const PYODIDE_BASE = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;
let runtime;
let initializing;
let manifest = new Map();

async function initialize() {
  importScripts(`${PYODIDE_BASE}pyodide.js`);
  runtime = await loadPyodide({ indexURL: PYODIDE_BASE });
  await runtime.loadPackage(["pandas", "numpy", "matplotlib", "micropip"]);
  await runtime.runPythonAsync("import micropip\nawait micropip.install('https://files.pythonhosted.org/packages/83/11/00d3c3dfc25ad54e731d91449895a79e4bf2384dc3ac01809010ba88f6d5/seaborn-0.13.2-py3-none-any.whl', deps=False)");
  runtime.runPython("__koda_globals = {'__name__': '__main__'}");
  postMessage({ type: "ready", version: PYODIDE_VERSION });
}
function ensureInitialized() { return initializing ||= initialize(); }

function mount(files) {
  const next = new Map(files.map((file) => [file.logicalPath, file.version]));
  try { runtime.FS.mkdir("/datasets"); } catch (error) { if (!String(error).includes("File exists")) throw error; }
  for (const path of manifest.keys()) {
    if (!next.has(path)) {
      try { runtime.FS.unlink(path); } catch { /* already absent */ }
    }
  }
  for (const file of files) {
    if (manifest.get(file.logicalPath) !== file.version && file.buffer) {
      runtime.FS.writeFile(file.logicalPath, new Uint8Array(file.buffer));
    }
  }
  manifest = next;
}

const RUNNER = String.raw`
import ast, base64, contextlib, io, json, traceback

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
    import pandas as pd
    if isinstance(value, (pd.DataFrame, pd.Series)): return _table(value)
    if value is None: return None
    return {"kind": "value", "value": repr(value)}

stdout = io.StringIO()
plots = []
try:
    tree = ast.parse(__koda_code, filename="solution.py", mode="exec")
    last = tree.body.pop() if tree.body and isinstance(tree.body[-1], ast.Expr) else None
    with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stdout):
        exec(compile(tree, "solution.py", "exec"), __koda_globals)
        value = eval(compile(ast.Expression(last.value), "solution.py", "eval"), __koda_globals) if last else None
    try:
        import matplotlib.pyplot as plt
        for number in plt.get_fignums():
            buffer = io.BytesIO()
            plt.figure(number).savefig(buffer, format="png", bbox_inches="tight", dpi=120)
            plots.append("data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode("ascii"))
        plt.close("all")
    except Exception:
        pass
    __koda_payload = {"ok": True, "stdout": stdout.getvalue(), "result": _result(value), "plots": plots}
except BaseException as error:
    __koda_payload = {"ok": False, "stdout": stdout.getvalue(), "errorType": type(error).__name__, "message": str(error), "traceback": traceback.format_exc()}
json.dumps(__koda_payload, ensure_ascii=False)
`;

onmessage = async (event) => {
  try {
    if (!runtime) await ensureInitialized();
    if (event.data.type === "run") {
      mount(event.data.files || []);
      runtime.globals.set("__koda_code", event.data.code);
      const payload = JSON.parse(await runtime.runPythonAsync(RUNNER));
      postMessage({ type: "result", requestId: event.data.requestId, payload });
    }
  } catch (error) {
    postMessage({ type: "fatal", requestId: event.data.requestId, message: String(error?.message || error) });
  }
};

ensureInitialized().catch((error) => postMessage({ type: "fatal", message: `Не удалось загрузить Python: ${error.message || error}` }));
