import { readFile } from "node:fs/promises";
import { loadPyodide } from "pyodide";

const source = await readFile(new URL("../apps/web/public/sandbox-worker.js", import.meta.url), "utf8");
const runner = source.match(/const RUNNER = String\.raw`([\s\S]*?)`;\r?\n\r?\n\/\/ Compile/)?.[1];
if (!runner) throw new Error("Sandbox RUNNER was not found");

const pyodide = await loadPyodide();
await pyodide.loadPackage(["numpy", "pandas"]);
pyodide.runPython("__koda_globals = {'__name__': '__main__'}");
pyodide.runPython(`def __koda_run():\n${runner.split("\n").map((line) => `    ${line}`).join("\n")}`);
const loadedPackages = ["python", "numpy", "pandas"];
pyodide.FS.mkdirTree("/datasets");
pyodide.FS.writeFile(
  "/datasets/minimal-missing.csv",
  new TextEncoder().encode("city,sales\nМосква,10\nКазань,\n"),
);

const run = async (code) => {
  pyodide.globals.set("__koda_code", code);
  pyodide.globals.set("__koda_known_paths", []);
  pyodide.globals.set("__koda_mounted_paths", []);
  pyodide.globals.set("__koda_loaded_packages", loadedPackages);
  return JSON.parse(await pyodide.runPythonAsync("__koda_run()"));
};
const expect = (condition, message) => { if (!condition) throw new Error(message); };

let payload = await run('print("KODA_STDOUT_TEST")');
expect(payload.ok && payload.stdout === "KODA_STDOUT_TEST\n", "stdout contract failed");
payload = await run("40 + 2");
expect(payload.ok && payload.result?.value === "42", "expression contract failed");
payload = await run("1 + 1");
expect(payload.ok && payload.result?.value === "2", "primitive result contract failed");
payload = await run('print("KODA")\n[1, 2, 3]');
expect(payload.stdout === "KODA\n" && payload.result?.value === "[1, 2, 3]", "stdout + result contract failed");
payload = await run("a = 10\na");
expect(payload.result?.value === "10", "variable result failed");
payload = await run("a + 5");
expect(payload.result?.value === "15", "persistent globals failed");
payload = await run("import pandas as pd\npd.DataFrame({'a': [1, 2]})");
expect(payload.result?.kind === "dataframe" && payload.result.data.length === 2, "DataFrame preview failed");
payload = await run("pd.DataFrame({'integer': [1], 'float': [1.5], 'boolean': [True], 'text': ['KODA']})");
expect(JSON.stringify(payload.result?.data?.[0]) === JSON.stringify([1, 1.5, true, "KODA"]), "non-missing values changed during preview serialization");
payload = await run("import numpy as np\nnp.array([1, 2, 3])");
expect(payload.result?.value === "array([1, 2, 3])", "NumPy result failed");
payload = await run("pd.Series([1, 2, 3])");
expect(payload.result?.kind === "series" && payload.result.data.length === 3, "Series preview failed");
payload = await run("df = pd.DataFrame({'a': [1, 2]})\ndf.head()");
expect(payload.result?.kind === "dataframe" && payload.result.shape[0] === 2, "DataFrame operation failed");
payload = await run("missing_df = pd.read_csv('/datasets/minimal-missing.csv')\nprint(missing_df)\nmissing_df.head()");
expect(payload.ok && payload.stdout.includes("NaN") && payload.result?.data?.[1]?.[1] === null, "CSV NaN preview normalization failed");
payload = await run("missing_matrix = pd.DataFrame({'none': [None], 'float_nan': [float('nan')], 'pd_na': pd.array([pd.NA], dtype='Int64'), 'nat': [pd.NaT], 'np_nan': [np.nan], 'np_nat': [np.datetime64('NaT')]})\nmissing_matrix");
expect(payload.ok && payload.result?.data?.[0]?.every((value) => value === null), "missing dtype matrix normalization failed");
payload = await run("bool(missing_matrix.isna().all().all())");
expect(payload.ok && payload.result?.value === "True", "preview serialization mutated the DataFrame");
payload = await run("1 / 0");
expect(!payload.ok && payload.errorType === "ZeroDivisionError" && Array.isArray(payload.plots), "error contract failed");
payload = await run("10");
expect(payload.ok && payload.result?.value === "10", "recovery after error failed");
payload = await run("nothing_to_display = 5");
expect(payload.ok && payload.result === null, "empty result contract failed");
payload = await run('import sys\nsys.stderr.write("KODA_STDERR_TEST\\n")');
expect(payload.ok && payload.stderr === "KODA_STDERR_TEST\n", "stderr contract failed");
payload = await run('raise ValueError("KODA_ERROR_TEST")');
expect(!payload.ok && payload.errorType === "ValueError" && payload.message === "KODA_ERROR_TEST", "ValueError contract failed");
await pyodide.loadPackage("matplotlib");
pyodide.runPython("import matplotlib\nmatplotlib.use('Agg')\nimport matplotlib.pyplot");
loadedPackages.push("matplotlib");
payload = await run("import matplotlib.pyplot as plt\nplt.plot([1, 2, 3], [2, 4, 1])\nplt.show()");
expect(payload.ok && payload.plots.length === 1 && payload.plots[0].startsWith("data:image/png;base64,"), "plot transport contract failed");
for (let index = 0; index < 10; index++) {
  payload = await run(`${index} + 1`);
  expect(payload.ok && payload.result?.value === String(index + 1), `sequential Run ${index + 1} failed`);
}

console.log("SANDBOX CONTRACT PASSED: stdout, stderr, expression, persistence, DataFrame, error, recovery, plot and empty result");
