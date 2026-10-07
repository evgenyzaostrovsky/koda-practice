# Light design prototype

## Decision — 2026-10-06

Founder requested a new mockup inspired by Google and Apple after rejecting the previous layout and icons. Replace the isolated `/design-prototype` experience with a coherent light interface, restrained blue accents, familiar outline icons, and four interactive screens: overview, practice, catalog, progress.

## Cross-functional review

- Product: one coherent path from choosing a task through practice and feedback; visible demonstration label.
- UX: readable light surfaces, compact navigation, clear primary action, accessible keyboard and mobile layout.
- Learning: use existing exercise concepts and inputs, starter code rather than a prefilled answer, optional hints, distinct Run and Check feedback.
- Behavioral: a single next step, neutral idle state, stable editor/result layout, explanatory progress counts.
- Technical: isolate the route before production hooks and providers; local state only; strictly scoped CSS.
- QA: verify navigation, demo actions, desktop and 390px layout, keyboard drawer behavior, and absence of live progress writes.
- Analytics: explicitly label sample metrics; no production queries, learning events, or achievement storage writes.
- Strategy: a concrete visual direction for Founder evaluation; no claims about retention and no production rollout in this scope.

## Acceptance

Four working screens; persistent demo label; editable starter and separate Run/Check/Reset states; discoverable hints; narrow-screen navigation without page overflow; visible keyboard focus; no live progress mutations. Typecheck/build and independent runtime QA are required before reporting completion.

## Boundary

This is an interactive design mockup. Python execution and progress values are demonstrations held in memory. The learning catalog and production product are not redesigned by this change.

## Verification

Typecheck and production build passed; eight existing App/practice regressions passed. Independent browser QA passed isolation and desktop 1440px checks, then the final 390px rerun after fixing drawer focus restoration. Four screens, navigation, editor demo actions, hints/reset, catalog selection, overflow and runtime errors were checked. No API requests, mutating network requests or progress-storage writes were observed. Desktop overview/practice and mobile practice screenshots were visually inspected. This verifies the mockup, not real Python execution.
