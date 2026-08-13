import { readFile } from "node:fs/promises";
import { loadPyodide } from "pyodide";

const source = await readFile(new URL("../apps/web/public/sandbox-worker.js", import.meta.url), "utf8");
const runner = source.match(/const RUNNER = String\.raw`([\s\S]*?)`;\r?\n\r?\n\/\/ Compile/)?.[1];
if (!runner) throw new Error("Sandbox RUNNER was not found");

const pyodide = await loadPyodide();
await pyodide.loadPackage(["numpy", "pandas"]);
pyodide.runPython("__koda_globals = {'__name__': '__main__'}");
pyodide.runPython(`def __koda_run():\n${runner.split("\n").map((line) => `    ${line}`).join("\n")}`);

const run = async (code) => {
  pyodide.globals.set("__koda_code", code);
  pyodide.globals.set("__koda_known_paths", []);
  pyodide.globals.set("__koda_mounted_paths", []);
  pyodide.globals.set("__koda_loaded_packages", ["python", "numpy", "pandas"]);
  return JSON.parse(await pyodide.runPythonAsync("__koda_run()"));
};
const expect = (condition, message) => { if (!condition) throw new Error(message); };

let payload = await run("1 + 1");
expect(payload.ok && payload.result?.value === "2", "primitive result contract failed");
payload = await run('print("KODA")\n[1, 2, 3]');
expect(payload.stdout === "KODA\n" && payload.result?.value === "[1, 2, 3]", "stdout + result contract failed");
payload = await run("a = 10\na");
expect(payload.result?.value === "10", "variable result failed");
payload = await run("a + 5");
expect(payload.result?.value === "15", "persistent globals failed");
payload = await run("import pandas as pd\npd.DataFrame({'a': [1, 2]})");
expect(payload.result?.kind === "dataframe" && payload.result.data.length === 2, "DataFrame preview failed");
payload = await run("import numpy as np\nnp.array([1, 2, 3])");
expect(payload.result?.value === "array([1, 2, 3])", "NumPy result failed");
payload = await run("pd.Series([1, 2, 3])");
expect(payload.result?.kind === "series" && payload.result.data.length === 3, "Series preview failed");
payload = await run("df = pd.DataFrame({'a': [1, 2]})\ndf.head()");
expect(payload.result?.kind === "dataframe" && payload.result.shape[0] === 2, "DataFrame operation failed");
payload = await run("1 / 0");
expect(!payload.ok && payload.errorType === "ZeroDivisionError" && Array.isArray(payload.plots), "error contract failed");
payload = await run("10");
expect(payload.ok && payload.result?.value === "10", "recovery after error failed");
payload = await run("nothing_to_display = 5");
expect(payload.ok && payload.result === null, "empty result contract failed");
for (let index = 0; index < 10; index++) {
  payload = await run(`${index} + 1`);
  expect(payload.ok && payload.result?.value === String(index + 1), `sequential Run ${index + 1} failed`);
}

console.log("SANDBOX CONTRACT PASSED: value, stdout, persistence, DataFrame, error, recovery and empty result");
