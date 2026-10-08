# Achievement room — October 2026

Integrated decision handed down by the orchestrator: a calm furnished room is the default achievement overview. Display at most ten highest earned family trophies, filling remaining positions with the curated learning directions. Keep all 50 families and 114 stable achievement IDs in the full collection. Names are optional in the room and visible on stages; exact requirements remain quiet text under each stage. No economy, new awards, or learning content.

Review conclusions: PM/strategy — recognition belongs in core/free with low interaction cost; UX — accessible native buttons, responsive shelves and optional labels; learning — meaningful knowledge/growth titles with exact requirements; behavior — neutral locked previews without guilt; architecture — existing evaluator, unlock storage and semantic motifs; analyst — stable identifiers and event meanings; QA — independently inspect geometry at 72px, locked contrast, focus, and responsive overflow.

| Acceptance | Implementation evidence | Independent QA |
| --- | --- | --- |
| Furnished overview; full collection retained | Room route has shelves, desk, window and plant; existing filters retained | PASS: desktop/mobile screenshots; all ten support bases contact surfaces; desk trophy has 19px clearance from plant |
| At most ten trophies; highest earned stage | Existing family model supplies highestUnlockedAchievement | PASS: component coverage and actual ten-trophy overview |
| No default visible trophy labels | Native button accessible names and optional labels toggle | PASS: default hidden; optional labels render #394b3d at full opacity on both widths |
| Meaningful titles; unchanged rules | All 114 titles changed; IDs, conditions, XP and other manifest fields retained | PASS: all non-name fields compared with HEAD |
| Distinct geometry across tiers | Eight shell shapes, progressive pedestal, handles, crown and contour details; 50 semantic motifs retained | PASS: independent 72px review of eight tiers; locked stages muted |
| Accessible dialog | Focus wrap/restore, Escape, arrow navigation, aria-pressed | PASS: component tests and runtime Escape/focus restoration at both widths |
| Narrow screens | Full-width two-column individual shelves beneath compact furnishing | PASS: 1280/1280 and 390/390 document widths; labels remain readable |
| Loading/error/empty | Skeleton, retryable manifest error and explicit empty messages | Automated coverage passed; network failure was not separately injected in browser |

Release evidence: 125 frontend tests, typecheck, lint and production build passed. Independent QA inspected reports/qa-room-final-{1280,390}.png, optional-name screenshots and reports/qa-stage-art-72px.png. The initially floating silhouettes received room-only solid supports; the desk trophy moved away from the plant; the global airy button rule's white label color received a scoped dark override. Free practice still executes only in its isolated browser Pyodide Worker.
