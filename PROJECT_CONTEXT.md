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

## Profile

- `/profile` is a compact modular overview with account identity, aggregate progress, unlocked achievement preview, recent activity, and an account/security entry point.
- Detailed course progress remains on `/progress`; the profile no longer renders every topic row.
- Achievement preview counts definitions dynamically and shows only actual unlocked rewards (up to six newest), never silhouettes, locked stages, or locked secrets.
- Full solution history lives at `/profile/history`; independent account forms live at `/profile/settings`. Both use router navigation and link back to Profile.
- Display name and a unique normalized `username` are editable. Username is a public profile identifier, not an authentication credential. Email remains the login and email/password changes use Supabase Auth.
- The overview is constrained to 1080 px on desktop and switches to one column at mobile widths, including 320, 375, 390, and 430 px.

## Achievement collection performance

- The collection still renders exactly one preview per family (50 cards) and mounts stage/detail UI only after a family is opened.
- The measured bottleneck was image payload: the 50 first-stage family PNG previews total 9,680,874 bytes. Generated 160×160 WebP previews total 322,550 bytes for the same representative set (96.7% smaller); all 114 thumbnails total 787,882 bytes versus 23,892,703 bytes of source PNGs.
- Preview images use versioned `.thumb.webp` URLs, native lazy loading, asynchronous decoding, explicit dimensions, and original-PNG fallback. Original assets remain unchanged for detail and reward scenes.
- The static manifest is deduplicated in memory and retained indefinitely in the TanStack Query cache. Progress uses the existing aggregate `/progress` request and stale-while-revalidate behavior; filters are entirely local.
- Cold load renders a header/filter/grid skeleton immediately. In the measured desktop viewport native lazy loading requested 35 visible/near-viewport thumbnails, no full PNGs, while all 50 family cards were available in the DOM. Warm remount showed 50 cards immediately with no skeleton and no manifest refetch.
- Family detail is a separate lazy JavaScript chunk; opening a family then loads only that family's full-size PNG stages. Immutable icon responses use a one-year cache, while the versioned manifest uses a one-hour cache with stale-while-revalidate.
