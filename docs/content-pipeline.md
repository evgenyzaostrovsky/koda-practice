# KODA Practice Content Pipeline

The Content Pipeline is the single process for adding or updating learning material. It keeps theory, tasks, runtime data, validation, documentation, and user progress consistent.

## Source of truth

- `content/catalog.json` — topics and executable tasks.
- `content/theory_bank.json` — stable theory articles.
- `content/knowledge_units.json` — provenance and links between a source, concepts, theory, and tasks.
- `content/task_bank.md` — current authoring source for the imported course bank.

Identifiers are permanent strings. Ordering is presentation metadata and must never be used as identity. Existing identifiers may not be renamed to make room for new content.

## Required workflow

1. Read the complete source and record its title and version.
2. Extract concepts, methods, functions, attributes, operators, parameters, behavioral nuances, common errors, and distinct learning outcomes.
3. Run `npm run content:inspect -- --source <path>` to produce a normalized inventory and compare it with the current coverage.
4. Decide for every extracted skill whether to reuse, extend, add, replace, or skip it. Compare learning objectives, normalized solution AST, required methods, expected result, instructions, action sequence, and prepared data. Renamed literals are not novelty.
5. Create or update a stable KnowledgeUnit. Update an existing unit when the source only expands an existing method or scenario.
6. Write one or more theory articles that cover only the required methods. Include the concept, syntax, relevant parameters, a different-data example, nuances, common mistakes, and an exact official documentation page. Theory must not contain a task’s full solution.
7. Create up to ten genuinely different learning steps. Prefer the progression: basic recognition, basic syntax, prepared-data use, important parameter, edge case, common-error correction, combination with prior knowledge, applied scenario, choice between similar approaches, integrated task. Stop below ten when the source cannot support ten distinct objectives.
8. Complete every task atomically: stable ID, KnowledgeUnit link, objective, difficulty, concepts, required methods, setup, starter and solution code, validation, three progressive hints, completion summary, theory link, and documentation URLs.
9. Ensure `setup_code` creates every input object and file. Reference and user code must run in the same reset environment. CSV tasks receive a valid `csv_path`.
10. Run `npm run content:sync`, `npm run content:audit`, and `npm run verify`. Fix every failure before commit.

## KnowledgeUnit contract

```json
{
  "id": "ku-groupby",
  "title": "Группировка и агрегация",
  "topicId": "10",
  "sourceTitle": "KODA Practice task bank",
  "sourceVersion": "2",
  "concepts": ["groupby"],
  "methods": ["groupby", "sum"],
  "functions": [],
  "attributes": [],
  "operators": [],
  "theoryArticleIds": ["theory-groupby-001"],
  "taskIds": ["groupby-001"],
  "createdAt": "2026-08-11T00:00:00Z",
  "updatedAt": "2026-08-11T00:00:00Z"
}
```

## Task contract

The JSON bank uses snake_case equivalents of the public contract:

- `knowledge_unit_id`, `learning_objective`, `concepts`, `required_methods`;
- `setup_code`, `starter_code`, `solution_code`, `tests`;
- exactly three structured `hints`;
- `completion_summary`, `theory_article_id`, `documentation_urls`.

No placeholders are allowed. Hint 1 recalls the principle, hint 2 points to the API or syntax, and hint 3 approaches the answer without reproducing the reference solution. A completion summary is two to four short sentences or points and appears only after success.

## Official sources

Documentation links are restricted to `pandas.pydata.org`, `matplotlib.org`, `seaborn.pydata.org`, `numpy.org`, and `docs.python.org`. Link to a concrete method, function, or relevant section, not a project homepage.

## Commands

```bash
# Inspect a future source and write a coverage report without changing the bank
npm run content:inspect -- --source path/to/material.md --source-title "Material title"

# Rebuild KnowledgeUnit links and task metadata without changing stable IDs
npm run content:sync

# Validate the complete bank, links, duplicate protection, runtime, and solutions
npm run content:audit
```

Reusable request for a future session:

> Add the following material to the KODA Practice knowledge bank through the Content Pipeline. Analyze existing coverage, update theory, create up to ten unique progressively harder tasks, add hints, completion summaries, and exact official documentation links, then run the content audit and all checks.

If a task must be removed or replaced, stop and define a user-progress migration first.

