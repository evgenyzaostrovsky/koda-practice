# Native practice modes

Exercises declare optional `exercise_mode`: absent means the existing Python/pandas flow. SQL uses Monaco SQL and submits the query unchanged to the existing practice API. Excel and Power BI are explicitly labeled educational simulators, using task-defined `response_spec` controls for their supported subset rather than a general workbook or report designer.

`response_spec.initial` holds the operation and initial state. Labeled fields use dotted paths, including numeric array indices; number, text/formula, select, checkbox, and multiselect controls preserve this structure in the existing saved draft `code` slot. Transport serialization is internal. Corrupt drafts show an actionable reset message and cannot silently overwrite user data. Run/check, hints, progress, task identifiers, account boundaries, and reset semantics reuse the practice controller.

The catalog exposes independent instrument and progress filters. Practice headings, SQL filename, language, and result instructions reflect the tool. Simulator output renders tables and named values in a readable report preview; it does not claim a native Excel workbook or Power BI report export. The browser Pyodide sandbox is untouched.

The KODA Market project view is available through the catalog's project toggle or `/catalog?course=koda-market`. Its nineteen lessons read `public/market-course.json`; links keep `course` and `lesson` query parameters. The practice controller projects ordered existing task IDs, including twelve GroupBy steps across KnowledgeUnits. Next/previous and the route wave preserve this context; leaving a lesson returns to the project catalog. Shared progress remains keyed by the original task IDs.

Validation: nested numeric edits, corrupted drafts, existing practice lifecycle/error tests and typecheck passed. Independent actual-server QA verified wrong/correct SQL, Excel and Power BI submissions at 1280/390 px and source-ordered project navigation, including GroupBy steps eleven/twelve across units. Native Office/Power BI engines and workbook/report export are outside this bounded simulator contract.
