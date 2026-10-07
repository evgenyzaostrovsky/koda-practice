# Architecture review — 2026-10-06

Scope: review the current working tree, especially App.tsx and main.py. All eight non-implementation roles reviewed the source. Existing uncommitted work was preserved. This is an audit, not a completed refactor or runtime bug certification.

## Integrated decision

The application already has separate frontend, API, content, storage and execution modules. However, App.tsx combines multiple pages with the practice lifecycle, while main.py combines HTTP wiring with validation and progress persistence. Decompose incrementally by responsibility. Resolve ownership defects separately from mechanical extraction; do not rewrite the application or change learning content.

## Role conclusions

| Role | Conclusion |
| --- | --- |
| Product Manager | Extract pages, then practice orchestration; preserve all routes and the learning loop. |
| UX Designer | Practice needs task-bound async responses and separate help state; preserve DOM/CSS, keyboard and mobile behavior during extraction. |
| Learning Designer | Navigation reconstructs IDs rather than using catalog order; content.py enforces exactly ten tasks per topic despite the pipeline allowing up to ten. Preserve stable IDs and authoritative KnowledgeUnit links. |
| Behavioral Designer | Debounced saves, task switching, help restoration and destructive reset need explicit regression scenarios. |
| Tech Lead | Separate submission validation and progress persistence from routers; retain browser-worker sandbox and private Storage boundaries. |
| QA Engineer | Existing focused tests pass, but core practice browser coverage is insufficient for a broad refactor. |
| Product Analyst | Multiple writers own progress: cloud draft saves send hints_opened=0, conflicting with API hint updates; metric definitions differ between backends. |
| Market/Product Strategy | Bounded maintenance work is justified; no evidence supports a rewrite or performance/retention claims. |

## Priority findings

1. Investigate progress ownership first: main.py:156 writes shared SQLite even for authenticated submissions; solution/review endpoints at :188/:195/:199 lack user scoping. cloud-sync.ts:15 sends hints_opened=0 in draft upserts. These code facts need isolated runtime reproduction before fixes are declared.
2. App.tsx:833 combines loading, editor state, autosave, execution, validation, hints, events and layout. Mutations at :893 carry only submit rather than immutable task/code identity. Late-response and rapid-navigation scenarios need reproduction.
3. Extract independent pages at App.tsx:226/:303/:391/:1298/:1333 and result components at :620/:713/:766; keep App responsible for composition/routing.
4. Extract validation/submission and progress services before splitting main.py into catalog, practice, progress/review and sandbox-file routers. Preserve API paths and deployment middleware.
5. Follow-up debt: ID-derived navigation (App.tsx:850/:1001), slug inference (:1287), backend metric discrepancies (main.py:205 onward), and shadowed run definition in runner.py. Do not silently change semantics during extraction.

## Acceptance matrix for subsequent implementation

| Area | Required evidence |
| --- | --- |
| Drafts | Immediate navigation/reload preserves newest code; delayed response from A cannot alter B. |
| Run/Submit | Run does not count attempts/completion; Submit records correct attempts and non-duplicate events. |
| Help | Hint usage survives autosave/run/submit/reload; theory and responses belong to current task. |
| Accounts | Two-account test demonstrates separate progress, hints, reviews and achievement context. |
| Routes/UI | Direct links, navigation, network retry, shortcuts and mobile behavior remain functional. |
| API/runtime | Existing URL contracts, /api prefix, SPA fallback and worker cache behavior preserved; sandbox Python remains in browser worker. |
| Verification | Relevant tests, lint/typecheck/build plus independent QA of observable scenarios. API tests use an isolated KODA_DB_PATH. |

## Evidence and limitations

Independent QA ran `npm --prefix apps/web run test -- --run src/App.test.tsx src/PracticeErrors.test.tsx src/practice-action.test.ts src/task-storage.test.ts`: 4 files, 10 tests passed. These cover navigation labels, rejected Run/Check retry, action semantics and task storage.

Browser behavior, API runtime, complete test suite, typecheck and production build were not verified in this audit. Source findings are not proof of deployed user impact. No production implementation was changed.
