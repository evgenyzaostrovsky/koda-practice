# KODA Achievements v2

The application uses one achievement system backed by `apps/web/public/achievements/manifest.json`. Version 2 contains 114 immutable display definitions grouped into 50 ordered families. The original 55 IDs and assets are preserved.

## Sources of truth

- The manifest owns names, descriptions, secret display text, rarity, XP, rewards, family order and icon paths.
- `rules.ts` declares every machine rule. Russian manifest text is never parsed to award an achievement.
- `engine.ts` owns the idempotent event log, unlock records and XP awards.
- `v2-evaluator.ts` evaluates temporal, sequence and structured-metadata rules.
- Unlock and acknowledgement are separate: XP is stored on unlock; `celebrated` records explicit confirmation of the reward scene.

## Events and idempotency

Every event has a stable ID, timestamp, local date, type and structured payload. Repeated delivery of the same event ID is ignored. Task telemetry includes task/topic/KnowledgeUnit identifiers, code fingerprint, attempts, hints, duration and control/review metadata. Sandbox telemetry includes a runtime ID, code fingerprint, owned-dataset IDs, result kind, plots and failures.

Events are persisted locally and, for authenticated users, upserted into `learning_events`. Unlocks are upserted by `(user_id, achievement_id)`, so retries cannot duplicate XP.

## Secrets

Five v2 definitions are secret. Until unlock, collection UI renders “Секретное достижение” and does not expose the real condition or progress. After unlock, `condition_after_unlock`, the real name, icon, rarity, XP and date are shown.

## Conservative structured rules

Rules involving vectorization, method chaining, alternative solutions, analytical questions or multi-stage analysis require explicit structured metadata (`vectorized`, `chainDepth`, `alternativeStrategy`, `own_question_answered`, `analysisStages`). They deliberately remain locked when that evidence is absent. No achievement is inferred from fragile source-code regexes.

## Backfill

Backfill version 2 preserves old unlocks and imports only objectively known solved-task/course totals. New v2 rules ignore `backfill` events because historical session, code-change and hint-transition evidence is incomplete. New mechanics start collecting proof after deployment.

## Validation

`node scripts/validate-achievements.mjs` checks counts, unique IDs/families/icon paths, explicit rules, PNG format, 512×512 dimensions, alpha channels, missing assets and orphan assets.
