# KODA Practice — current project context

Updated: 2026-08-13

## Achievements

KODA Achievements v2 is integrated into the existing system as one collection:

- 114 achievement definitions;
- 50 ordered families;
- 5 secret achievements;
- 5 new prestige legendary achievements;
- all original 55 stable IDs and icon files retained;
- counts in collection and profile are read dynamically from the manifest.

The evaluator consumes idempotent domain events. Added event vocabulary includes task runtime errors, sandbox failures, reviews, mastery changes and a structured own-question completion event. Task and sandbox producers now attach session IDs, elapsed session time, code fingerprints and available task/dataset metadata.

Temporal and sequence evaluators cover comeback gaps, rolling active-day windows, retry chains, error recovery, hint behaviour, delayed repetition, topic diversity, sandbox variants, session combinations and long-term monthly activity. Potentially ambiguous rules such as vectorization, method chaining, alternative strategies and full mini-analysis require explicit structured evidence and do not guess from source text.

Backfill version 2 is conservative and idempotent: legacy solved-task/course progress remains available to v1 achievements, while v2 rules ignore synthetic backfill events. Session- and code-dependent achievements begin tracking after deployment.

No database migration was required for v2. The existing `learning_events` JSON payload, `user_achievements` primary key, `xp_awarded`, `reward_payload`, `seen_at` and `backfill_version` columns already support the new event metadata and acknowledgement state.

The reward queue remains persistent until explicit confirmation, survives refresh, presents multiple unlocks sequentially and groups bulk historical rewards.

Validation commands and their latest results belong in the implementation commit/report rather than this evergreen context file.
