# KODA Practice repository instructions

## Cross-functional product review is mandatory

Before implementing any meaningful product, UX, learning-content, architecture,
performance, monetization, or significant bug-fix change, follow
`docs/product-team-review.md`.

The user is the Founder / Product Owner and has the final decision. Review the
proposal through all relevant roles: Product Manager, UX/Product Designer,
Learning Designer/Methodologist, Behavioral Designer/ADHD specialist, Tech
Lead/Full-stack Architect, QA Engineer, Data/Product Analyst, and Market/Product
Strategy. Skip a role only when it genuinely has no relevant contribution.

Record only concise conclusions, synthesize one integrated decision, implement
against the existing source of truth, run the required QA, and update project
documentation. Do not output private chain-of-thought.

## Content Pipeline is mandatory

Whenever new learning material is added or an existing source is expanded, use the Content Pipeline documented in `docs/content-pipeline.md`.

A learning material is considered integrated only when all of the following are created or updated together:

- a stable `KnowledgeUnit` entry;
- a full teaching `article` and a separately authored compact `cheatSheet` in the same KnowledgeUnit;
- a useful progression of up to ten non-duplicate tasks;
- three task-specific hints per task;
- an individual `completion_summary` per task;
- exact links to allowed official documentation;
- runnable prepared data, starter code, reference solutions, and validation;
- a successful content audit and reference-solution test run.

Before adding content, compare its concepts, learning objectives, normalized solution structure, methods, expected results, and prepared data with the existing bank. Reuse or extend existing units when the material adds detail to an already covered skill. Never create a duplicate merely by renaming variables, columns, or literal values.

Do not change stable task, theory, topic, or knowledge-unit identifiers when updating material. If replacement or removal is unavoidable, provide an explicit progress migration before changing the catalog.

Required command before committing any content change:

```bash
npm run content:audit
```

The cheat sheet is not a shortened article. Every cheat-sheet entry contains only a method or technique name, one short sentence describing it, one example of at most three lines, and an optional exact official documentation link. Detailed explanations, parameters, errors, nuances, scenarios, and conclusions belong to the article.

An article belongs to the complete KnowledgeUnit, never to an individual task. It must substantively cover every important cheat-sheet entry through coherent teaching sections, include progressive examples with expected results, and show concrete incorrect code with reasons and corrections. Task-specific wording such as “in this task”, numbered variants, prepared runtime objects, or assigning to `result` is forbidden in standalone knowledge-base articles.

Arbitrary Python from the free-practice sandbox must run only in its isolated browser Pyodide Web Worker. Never move sandbox execution into the main FastAPI process without a separately designed hardened isolation boundary. User datasets stay in private persistent Storage and are exposed to Python only through logical `/datasets/...` paths.
