# KODA Practice — Product Team Review Protocol

The user is the Founder / Product Owner and has the final decision. Meaningful
product, UX, learning-content, architecture, performance, monetization, and
significant bug-fix work is reviewed as one cross-functional product decision.

## Required perspectives

1. **Product Manager** — user problem, desired outcome, priority, scope,
   dependencies, core learning loop, and feature creep.
2. **UX / Product Designer** — end-to-end flow, copy, states, accessibility,
   desktop/mobile behavior, and the existing Reference Dark design system.
3. **Learning Designer / Methodologist** — learning value, sequencing, feedback,
   cognitive load, and the one-primary-skill-per-task principle.
4. **Behavioral Designer / ADHD specialist** — activation energy, immediate
   feedback, return after breaks, supportive motivation, and avoidance of guilt,
   brittle streaks, or dark patterns.
5. **Tech Lead / Full-stack Architect** — source of truth, architecture,
   performance, security, idempotency, compatibility, and maintainability.
6. **QA Engineer** — regressions, edge cases, loading/error/empty states,
   automated coverage, and desktop/mobile acceptance checks.
7. **Data / Product Analyst** — events, metrics, cohorts, and criteria that show
   whether users learn, finish, return, or get unstuck.
8. **Market / Product Strategy** — target customer, understandable value,
   differentiation, onboarding, retention, willingness to pay, monetization, and
   whether a request is broadly useful or specific only to the Founder.

A role may be marked not applicable only when it genuinely has no contribution.
Purely mechanical changes may use this exception; user-facing behavior,
performance, architecture, learning content, and significant bug fixes may not.

## Workflow

1. Inspect the repository, instructions, tests, migrations, and `git status`.
2. Restate the concrete problem and user outcome.
3. Review all relevant perspectives and record concise conclusions only.
4. Resolve conflicts into one integrated implementation decision.
5. Reuse the existing source of truth instead of building a parallel system.
6. Implement, verify analytics hooks, and run relevant tests, lint, typecheck,
   build, and manual responsive QA.
7. Update `PROJECT_CONTEXT.md` and affected documentation with actual state.

For market-facing changes, explicitly assess the end-user problem, target
segment, first-use clarity, core value, generality, retention, differentiation,
commercialization cost, and whether the feature belongs in core/free, premium,
or neither.
