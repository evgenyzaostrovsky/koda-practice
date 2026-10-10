# Functional context columns

Date: 2026-10-10. Founder approved implementation of the four-page mockup and requested complete data-backed behavior, including recorded error context.

## Cross-functional decision

All eight required roles reviewed the existing runtime/source. PM and strategy: deliver the recovery loop as core functionality; avoid decorative or AI-generated diagnosis. UX and behavioral: selectable records, one useful action, explicit restoration protecting drafts, accessible compact columns and honest loading/error/legacy states. Learning: distinguish runtime exceptions, validation failures and platform faults; reuse actual KnowledgeUnits and avoid claims of mastery. Architecture: persist final diagnostics once, extend SQLite additively, reuse cloud feedback and owner-filtered history; keep sandbox execution in its worker. Analytics: submissions, execution observations and measured study intervals remain separate evidence. QA: verify exact snapshots, all modes, repeat occurrences, account races and responsive workflows independently.

## Implementation contract

- Knowledge: current article/cheat anchors, active section, existing related materials and valid linked practice; first unfinished related task or explicitly labelled repetition.
- Errors: authoritative submitted attempts plus separately labelled private local execution observations. Selected immutable code, exact available error/feedback, reliable location only when recorded, repeat occurrences and later successful task evidence. Older missing details are labelled. Guidance uses final feedback and the task's own knowledge relationship. No fabricated traceback or rerunning historical code.
- History: owner-filtered paginated solution records and selected details, real filters/actions. Submission execution duration is not study duration. Opening preserves drafts; restoring historical code is explicit and guarded.
- Progress: owner-scoped real completion, actual measured interval chart, valid unfinished continuation and real achievement condition from read-only evidence. Reading never grants awards or modifies learning progress.
- Free-practice observations store no uploaded dataset contents and execute no server-side Python. They are bounded, owner-scoped browser records, explicitly distinguished from synchronized submissions.

## Acceptance matrix

| Area | Required observable behavior |
| --- | --- |
| Persistence | Final WrongMethod/mode-aware diagnosis matches the response; additive migration preserves old records. |
| Errors | New failure is visible once with the exact sent code; repeat selection reveals each original snapshot; runtime, incorrect answer and technical failure differ. |
| Recovery | Open preserves existing draft; explicit restore can be cancelled; subsequent success retains earlier evidence. |
| Knowledge | Anchors match current view/filter; linked practice exists and respects completion; loading failure never suggests completed work. |
| Progress | No invented totals or mastery; measured time excludes pause/overlap; continuation and achievement links work. |
| History | Guest and authenticated data contracts, pagination/filters/direct selections, legacy details and unavailable task handling. |
| Privacy | Account change clears old data immediately; late responses and execution callbacks cannot write or show another owner's code. |
| Runtime | Keyboard and 1280/1440/390 px workflows, loading/error/retry/empty, sandbox output regression. |

## Verification

Completed and independently verified on 2026-10-11. No new learning material or stable content identifier changes were made.

- Full API suite: 407 tests passed; final independent history/mode/cloud-contract suite: 11 passed.
- Full frontend suite: 210 tests passed; subsequent focused history tests: 8 passed, including explicit protection of empty drafts and honest handling of legacy null code. Final diagnostic guidance tests distinguish known runtime exceptions, validation and system failures.
- Lint/typecheck and production build passed. Existing large-bundle warning remains non-blocking.
- Independent real-browser batch: 12 passed, covering Knowledge/Home/Progress/History across 1280/1440/390 px and real Pyodide outputs, warnings/errors/plots, repeated Run, Restart, Stop and timeout recovery. Separate actual Practice Run and sandbox failure capture passed with exact code and no submission-count changes. Related practice links and topic expand/collapse were exercised.
- Last delivery build: 6 browser checks passed across 1280/1440/390 px. Computed text contrast is at least 4.5:1; headings, introductions and filters do not overlap. Error details, occurrence selection, guarded restore and valid navigation passed. Evidence: reports/qa-functional-browser-last.log and reports/qa-functional-browser-final.log.
- User runtime 8014 was restarted against the same database after a SQLite backup. Independent comparison confirmed original rows in all six tables unchanged; the additive feedback column is the only intended schema extension. Health and history endpoint responded successfully without user-data writes.

Live cloud authorization/private Storage upload was not available in this environment: it reports that sandbox requires configured authorization. Owner-filtered cloud API contracts were tested with mocks; mocked private Storage transport followed by actual CSV execution in the real isolated worker passed. These are not live Supabase verification. Old missing diagnostics cannot be recovered retrospectively; device-local Run observations remain separate from synchronized submission history.
