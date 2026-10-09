# Manual study time and ivory achievement room

The Founder requests a global start/pause/finish timer, measured time in Progress, a cumulative-time achievement and a room matching the cream architectural reference. All eight required roles reviewed this as one bounded product decision.

| Role | Integrated conclusion |
| --- | --- |
| Product | Optional explicit session beside profile; navigation retains it; finish saves time. |
| UX | Shared in-flow actions row; reachable 44px controls; no per-second screen-reader announcements; cream arches/shelves and glass trophies. |
| Learning | Timer participation is separate from mastery; no historical backfill or task-content change. |
| Behavioral | Pause on hidden/close; resume explicitly; no guilt, streak penalties or continuous-session requirement. |
| Tech | Account-scoped immutable interval journal; union overlaps; reuse RLS learning_events; preserve legacy events. |
| QA | Lifecycle, clock/tab/account/storage races, exact thresholds and real desktop/mobile room verification. |
| Analyst | One measured-time selector; idempotent intervals; timezone day splits; no code/dataset payloads. |
| Strategy | Core supportive feature; truthful measurement before polish; no time leaderboard or XP-per-minute. |

Decision: Start/Pause/Resume/Finish in the shared header. Only explicitly running visible-app time counts; reading without keystrokes still counts. Hide, unload, account switch or ownership loss pauses. Reload restores paused last-checkpoint time; closed-app hours never accrue. Valid immutable intervals provide one union-duration source for control, Progress, Dashboard and new achievement. Account identities, anonymous time and asynchronous hydration remain isolated. Storage failure is visible and cannot award undurable time. No existing task IDs, achievements, progress or legacy inferred session duration are reset or reinterpreted.

Room: retain real family buttons, actual tier art and the all-family collection; locked trophies stay subdued. Use the generated empty architectural background with separate responsive interactive glass trophy objects. Mobile must keep accessible targets and local layout rather than shrinking ten buttons into unusable points. Preserve keyboard focus restoration and reduced motion.

Implementation is complete. Independent verification passed 169 unit tests across 38 files, including real account-scoped journal recovery, interval union, exact thresholds, storage failure, 40-hour capacity, incremental cloud retry and observer metadata ownership. The existing 114 achievement definitions remain unchanged; the new family adds five stages (15 minutes, 1, 5, 15 and 40 hours).

Release checks: lint, typecheck, achievement assets (119 awards / 51 families) and production build pass. Real-browser verification uses a fresh isolated database on port 8017; the actual user database on 8014 remains at one solved task, five attempts and 15 XP. Native authenticated Supabase is unavailable: cloud pagination, incremental retry and account isolation are covered by a test client, not claimed as an authenticated production run. Native browser chrome zoom is untested; 200% text enlargement is tested.

Two supported runtime corrections are included: observers restore shared session metadata read-only, preventing stale paused state from overwriting Finish; theme button transform/padding overrides no longer displace desktop trophies below their shelves. Desktop anchoring retains its translation on hover; mobile keeps an untranslated grid. The clock's separate 70% support anchor places its base on the table.

Final independent acceptance: all seven production-browser scenarios passed in 34.2 seconds on the final clock build (reports/qa-study-room-clock-final.log). Both 1280px and 390px layouts, desktop normal/hover anchors, mobile grid, highest earned versus locked art, all-family collection, keyboard Escape/focus return, reduced motion, 200% text enlargement, Progress contrast, real timer lifecycle, hidden pause, two-tab ownership transfer and storage failure recovery passed. The orchestrator visually inspected reports/qa-room-clock-final-viewport1280.png: trophy supports meet the shelves and the clock meets the table. Full unit results remain 169/169 (reports/qa-study-room-web-final.log); the final coordinate adjustment does not change timer logic. No known blocking defect remains.

## Generated background

Built-in image_gen edit; reference supplied by the Founder. Final project asset: apps/web/public/achievements/room/ivory-room-v2.webp. The original generated PNG remains in the Codex generated_images directory. WebP conversion only changes encoding.

Final prompt:

```text
Use case: precise-object-edit. Asset type: architectural background for an interactive achievement room in the KODA learning app. Edit the supplied reference image, preserving its exact camera, framing, ivory cream sculptural architecture, large right arched window with sage frame, calm blue sky and cypress landscape, curved two shelves, steps, rounded table, olive sprig in cream vase, warm soft daylight, shadows and subtle sage floor curve. Remove EVERY achievement trophy and ALL small round pedestal bases from both shelves; remove the small clock trophy and its pedestal from the right table. The shelves and table must be clean EMPTY architectural surfaces so the application can place its own interactive SVG trophies on them. Fill removed areas with consistent wall/shelf/table surfaces and physically plausible lighting. No new objects, no typography, no symbols, no icons, no humans, no labels. Keep serene high-quality softly textured 3D illustration very close to the reference, unobtrusive minimalism, low contrast cream and muted sage palette. Preserve the reference composition and aspect ratio. Do not remove the shelves themselves or the vase/plant.
```

Timer durability: five-second visible heartbeats, sixty-second immutable interval persistence, and immediate Pause/Finish/hidden/pagehide flushing. A heartbeat gap over thirty seconds pauses at the last confirmed heartbeat; abrupt process loss may lose up to sixty unflushed seconds. Future interval endings beyond two minutes of clock skew are rejected. Manual intervals live in the account-scoped durable journal; old snapshot rows migrate before omission. Forty continuous hours produces 2,400 events, approximately 2.48 MB of UTF-16 journal keys and values (representative UUID/account identifiers), excluding unrelated existing storage. Cloud uploads only unsynced immutable intervals, with successful remote IDs remembered per account and failed batches retryable.
