# KODA Practice achievements

`apps/web/public/achievements/manifest.json` and its 55 PNG files are the immutable display definitions. Machine rules live in `apps/web/src/achievements/rules.ts`; conditions are never parsed from Russian display text.

The client domain records idempotent learning events with stable IDs, incrementally derives cached statistics, performs versioned backfill from confirmed task progress, evaluates progress, queues unseen rewards, and stores the local snapshot under `koda:achievements:v1`. The Supabase migration adds the equivalent persistent model (`learning_events`, `user_achievements`, stats, daily activity, cosmetics) with ownership RLS and uniqueness constraints.

Qualifying streak activity is a newly solved task or a successful sandbox run with a new normalized-code hash. Dates use the browser IANA timezone. `streak_10` grants a single stabilizer; storage allows at most one. The UI exposes all 15 families, the 12-stage Analyst Path, progress, XP, dates, unseen state, and cosmetic selection.

To add an achievement, add its unchanged display definition and 512×512 alpha PNG, then add a typed rule and tests. To add a reward type, extend `rewardKind` and the cosmetics UI. Run `node scripts/validate-achievements.mjs`, `npm test`, `npm run lint`, and the frontend production build.

Events requiring unavailable product proof (review sessions, scored final project, and full EDA/join instrumentation) remain locked until their trusted runner/API events exist; no synthetic unlock is emitted.
