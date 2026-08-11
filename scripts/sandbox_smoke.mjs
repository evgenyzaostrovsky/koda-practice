import { loadPyodide } from "pyodide";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const runFile = promisify(execFile);
const nativeFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = typeof input === "string" ? input : input.url;
  if (!url.startsWith("http")) return nativeFetch(input, init);
  const command = process.platform === "win32" ? "curl.exe" : "curl";
  const { stdout } = await runFile(command, ["-sS", "-L", url], { encoding: "buffer", maxBuffer: 80 * 1024 * 1024 });
  return new Response(stdout, { status: 200 });
};

async function environment() {
  const runtime = await loadPyodide();
  await runtime.loadPackage(["pandas", "numpy", "matplotlib", "micropip"]);
  await runtime.runPythonAsync("import micropip\nawait micropip.install('https://files.pythonhosted.org/packages/83/11/00d3c3dfc25ad54e731d91449895a79e4bf2384dc3ac01809010ba88f6d5/seaborn-0.13.2-py3-none-any.whl', deps=False)");
  runtime.FS.mkdir("/datasets");
  runtime.FS.writeFile("/datasets/sales.csv", new TextEncoder().encode("city,sales\nМосква,100\nКазань,200\nМосква,300\n"));
  return runtime;
}

const runtime = await environment();
runtime.runPython(`import pandas as pd
df = pd.read_csv("/datasets/sales.csv")`);
const preview = JSON.parse(runtime.runPython(`df.head().to_json(orient="split", force_ascii=False)`));
if (preview.data[0][0] !== "Москва" || preview.data.length !== 3) throw new Error("CSV was not read from /datasets");
const mean = runtime.runPython(`float(df["sales"].mean())`);
if (mean !== 200) throw new Error("Python variables did not persist between runs");
const graph = runtime.runPython(`
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import seaborn as sns
sns.countplot(data=df, x="city")
len(plt.get_fignums())
`);
if (graph < 1) throw new Error("Matplotlib/Seaborn did not create a graph");
runtime.runPython(`plt.close("all")`);

const restarted = await environment();
const missingVariable = restarted.runPython(`"df" not in globals()`);
const remountedRows = restarted.runPython(`import pandas as pd
len(pd.read_csv("/datasets/sales.csv"))`);
if (!missingVariable || remountedRows !== 3) throw new Error("Restart semantics failed");
console.log("SANDBOX SMOKE PASSED: CSV table, persistent variable, restart/remount, Matplotlib and Seaborn");
