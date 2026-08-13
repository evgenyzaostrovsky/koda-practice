import type { AchievementEvent, AchievementProgress } from "./types";

type Result = { current: number; target: number; text?: string };
const day = 86_400_000;
const time = (event: AchievementEvent) => new Date(event.occurredAt).getTime();
const ordered = (events: AchievementEvent[]) =>
  [...events].sort((a, b) => time(a) - time(b));
const meaningful = (event: AchievementEvent) =>
  event.type === "task_solved" ||
  event.type === "sandbox_run_succeeded" ||
  event.type === "review_completed";
const solved = (events: AchievementEvent[]) =>
  ordered(events).filter((event) => event.type === "task_solved");
const value = (event: AchievementEvent, key: string) => event.payload[key];
const number = (event: AchievementEvent, key: string) =>
  Number(value(event, key) ?? 0);
const truthy = (event: AchievementEvent, key: string) =>
  value(event, key) === true;
const key = (event: AchievementEvent, field: string) =>
  String(value(event, field) ?? "");
const daysBetween = (a: AchievementEvent, b: AchievementEvent) =>
  Math.floor((time(b) - time(a)) / day);
const progress = ({ current, target, text }: Result): AchievementProgress => ({
  current: Math.min(current, target),
  target,
  percentage: Math.min(100, Math.round((current / target) * 100)),
  text: text ?? `${Math.min(current, target)} / ${target}`,
  unlocked: current >= target,
});

function maxQualifyingGap(events: AchievementEvent[]) {
  const list = ordered(events).filter(meaningful);
  let max = 0;
  for (let index = 1; index < list.length; index++)
    max = Math.max(max, daysBetween(list[index - 1], list[index]));
  return max;
}

function rollingDays(events: AchievementEvent[], window: number) {
  const dates = [
    ...new Set(events.filter(meaningful).map((event) => event.localDate)),
  ].sort();
  let max = 0;
  for (const end of dates) {
    const endTime = new Date(`${end}T12:00:00Z`).getTime();
    max = Math.max(
      max,
      dates.filter((date) => {
        const delta = (endTime - new Date(`${date}T12:00:00Z`).getTime()) / day;
        return delta >= 0 && delta < window;
      }).length,
    );
  }
  return max;
}

function consecutiveWeeks(events: AchievementEvent[]) {
  const weeks = new Set(
    events.filter(meaningful).map((event) => {
      const date = new Date(`${event.localDate}T12:00:00Z`);
      const monday = new Date(date);
      monday.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
      return Math.floor(monday.getTime() / (7 * day));
    }),
  );
  const list = [...weeks].sort((a, b) => a - b);
  let best = 0,
    run = 0,
    previous = -9;
  for (const week of list) {
    run = week === previous + 1 ? run + 1 : 1;
    best = Math.max(best, run);
    previous = week;
  }
  return best;
}

function failureBeforeSuccess(events: AchievementEvent[]) {
  const failed = new Map<string, number>();
  let best = 0;
  for (const event of ordered(events)) {
    const task = key(event, "taskId");
    if (!task) continue;
    if (event.type === "task_submitted" && !truthy(event, "passed"))
      failed.set(task, (failed.get(task) ?? 0) + 1);
    if (event.type === "task_solved") {
      best = Math.max(best, failed.get(task) ?? 0);
      failed.delete(task);
    }
  }
  return best;
}

function transition(
  events: AchievementEvent[],
  failureType: AchievementEvent["type"],
  sandbox = false,
) {
  const list = ordered(events);
  let best = 0;
  for (let i = 0; i < list.length; i++) {
    const failed = list[i];
    if (failed.type !== failureType) continue;
    if (failureType === "task_submitted" && truthy(failed, "passed")) continue;
    const scope = sandbox ? key(failed, "runtimeId") : key(failed, "taskId");
    const next = list
      .slice(i + 1)
      .find(
        (event) =>
          (sandbox
            ? event.type === "sandbox_run_succeeded"
            : event.type === "task_solved") &&
          (!scope || key(event, sandbox ? "runtimeId" : "taskId") === scope),
      );
    if (
      next &&
      key(failed, "codeHash") &&
      key(next, "codeHash") !== key(failed, "codeHash") &&
      !list
        .slice(i + 1, list.indexOf(next))
        .some((event) => event.type === "hint_used")
    )
      best = 1;
  }
  return best;
}

function cleanAfterHints(events: AchievementEvent[]) {
  let historicalHints = 0,
    clean = 0,
    best = 0;
  for (const event of ordered(events)) {
    if (event.type === "task_solved") {
      if (truthy(event, "noHints")) {
        if (historicalHints >= 3) clean++;
        best = Math.max(best, clean);
      } else {
        historicalHints++;
        clean = 0;
      }
    }
  }
  return best;
}

function hintReduction(events: AchievementEvent[], size: number) {
  const list = solved(events);
  if (list.length < size * 2) return 0;
  let best = 0;
  for (let i = size * 2; i <= list.length; i++) {
    const previous = list.slice(i - size * 2, i - size),
      current = list.slice(i - size, i);
    const previousRate =
      previous.filter((event) => !truthy(event, "noHints")).length / size;
    const currentRate =
      current.filter((event) => !truthy(event, "noHints")).length / size;
    best = Math.max(best, Math.round((previousRate - currentRate) * 100));
  }
  return best;
}

function delayedRepeat(events: AchievementEvent[], field: string) {
  const first = new Map<string, AchievementEvent>();
  let max = 0;
  for (const event of solved(events)) {
    const id = key(event, field);
    if (!id) continue;
    const prior = first.get(id);
    if (prior && truthy(event, "noHints"))
      max = Math.max(max, daysBetween(prior, event));
    else if (!prior) first.set(id, event);
  }
  return max;
}

function topicDiversity(events: AchievementEvent[], window: number) {
  const list = solved(events);
  let best = 0;
  for (const end of list)
    best = Math.max(
      best,
      new Set(
        list
          .filter(
            (event) =>
              time(end) - time(event) >= 0 &&
              time(end) - time(event) < window * day,
          )
          .map((event) => key(event, "topicId"))
          .filter(Boolean),
      ).size,
    );
  return best;
}

function distinctPayload(events: AchievementEvent[], field: string) {
  return new Set(
    events.flatMap((event) =>
      Array.isArray(value(event, field))
        ? (value(event, field) as string[])
        : key(event, field)
          ? [key(event, field)]
          : [],
    ),
  ).size;
}

function sessionCombo(events: AchievementEvent[]) {
  const sessions = new Map<string, Set<string>>();
  for (const event of events) {
    const session = key(event, "sessionId");
    if (!session) continue;
    const set = sessions.get(session) ?? new Set();
    if (event.type === "task_solved")
      set.add(truthy(event, "review") ? "review" : "task");
    if (event.type === "sandbox_run_succeeded") set.add("sandbox");
    sessions.set(session, set);
  }
  return [...sessions.values()].some(
    (set) => set.has("task") && set.has("review") && set.has("sandbox"),
  )
    ? 1
    : 0;
}

function sandboxVariants(events: AchievementEvent[]) {
  const sessions = new Map<string, Set<string>>();
  let series = 0;
  for (const event of ordered(events).filter(
    (item) => item.type === "sandbox_run_succeeded",
  )) {
    const session = key(event, "sessionId"),
      hash = key(event, "codeHash");
    if (!session || !hash) continue;
    const hashes = sessions.get(session) ?? new Set();
    const before = hashes.size;
    hashes.add(hash);
    if (before < 3 && hashes.size >= 3) series++;
    sessions.set(session, hashes);
  }
  return series;
}

function activeMonths(events: AchievementEvent[]) {
  const months = new Map<string, Set<string>>();
  for (const event of events.filter(meaningful)) {
    const month = event.localDate.slice(0, 7),
      dates = months.get(month) ?? new Set();
    dates.add(event.localDate);
    months.set(month, dates);
  }
  return [...months.values()].filter((dates) => dates.size >= 4).length;
}

function miniAnalysis(events: AchievementEvent[]) {
  const sessions = new Map<string, Set<string>>();
  for (const event of events) {
    const session = key(event, "sessionId");
    if (!session || !truthy(event, "ownDataset")) continue;
    const stages = sessions.get(session) ?? new Set<string>();
    const payloadStages = value(event, "analysisStages");
    if (Array.isArray(payloadStages))
      payloadStages.forEach((stage) => stages.add(String(stage)));
    sessions.set(session, stages);
  }
  return [...sessions.values()].some((stages) =>
    ["load", "inspect", "clean", "transform", "aggregate", "visualize"].every(
      (stage) => stages.has(stage),
    ),
  )
    ? 1
    : 0;
}

const targets: Record<string, number> = {
  quick_start: 1,
  short_loop: 1,
  minimum_counts: 1,
  comeback_2d: 2,
  comeback_7d: 7,
  comeback_30d: 30,
  comeback_90d: 90,
  rhythm_3_7: 3,
  rhythm_10_30: 10,
  rhythm_25_90: 25,
  uneven_counts: 6,
  clicked: 3,
  try_again_2: 2,
  try_again_4: 4,
  try_again_7: 7,
  self_debugger_runtime: 1,
  clean_intercept: 1,
  handrails_off: 5,
  one_hint_enough: 1,
  second_time_independent: 1,
  hints_fading_1: 20,
  hints_fading_2: 30,
  hints_fading_3: 40,
  error_with_patience: 1,
  memory_echo_7: 7,
  memory_echo_30: 30,
  memory_echo_90: 90,
  archive_open: 30,
  weak_spot: 15,
  breakthrough_mastery: 1,
  cold_control: 1,
  skill_three_forms: 3,
  panorama_3: 3,
  panorama_7: 7,
  panorama_12: 12,
  toolbelt_5: 5,
  toolbelt_10: 10,
  toolbelt_20: 20,
  combo_session: 1,
  what_if_3: 1,
  what_if_10: 10,
  what_if_25: 25,
  controlled_explosion: 1,
  reconnaissance: 1,
  lesson_to_life: 1,
  own_question: 1,
  first_mini_analysis: 1,
  no_loops_3: 3,
  no_loops_10: 10,
  no_loops_25: 25,
  chain_reaction_3: 3,
  chain_reaction_10: 10,
  chain_reaction_25: 25,
  not_by_sample: 1,
  long_run_2m: 2,
  long_run_4m: 4,
  long_run_8m: 8,
  long_run_12m: 12,
  proven_by_time: 5,
};

export function v2Progress(
  id: string,
  events: AchievementEvent[],
): AchievementProgress | null {
  const target = targets[id];
  if (!target) return null;
  events = events.filter((event) => !event.eventId.includes("backfill"));
  let current = 0;
  if (id === "quick_start")
    current = events.some(
      (event) =>
        meaningful(event) &&
        value(event, "sessionElapsedMs") !== undefined &&
        number(event, "sessionElapsedMs") <= 120_000,
    )
      ? 1
      : 0;
  else if (id === "short_loop")
    current = events.some(
      (event) =>
        event.type === "task_solved" &&
        number(event, "sessionElapsedMs") >= 300_000 &&
        number(event, "sessionElapsedMs") <= 600_000,
    )
      ? 1
      : 0;
  else if (id === "minimum_counts")
    current =
      maxQualifyingGap(events) >= 2 && solved(events).length > 0 ? 1 : 0;
  else if (id.startsWith("comeback_")) current = maxQualifyingGap(events);
  else if (id === "rhythm_3_7") current = rollingDays(events, 7);
  else if (id === "rhythm_10_30") current = rollingDays(events, 30);
  else if (id === "rhythm_25_90") current = rollingDays(events, 90);
  else if (id === "uneven_counts") current = consecutiveWeeks(events);
  else if (id === "clicked")
    current = Math.max(
      0,
      ...solved(events).map((_, i, list) => {
        let count = 0;
        for (
          let x = i;
          x >= 0 &&
          truthy(list[x], "firstTry") &&
          truthy(list[x], "noHints") &&
          number(list[x], "durationMs") <= 60_000 &&
          truthy(list[x], "review");
          x--
        )
          count++;
        return count;
      }),
    );
  else if (id.startsWith("try_again_")) current = failureBeforeSuccess(events);
  else if (id === "self_debugger_runtime")
    current = transition(events, "task_runtime_error");
  else if (id === "clean_intercept")
    current = transition(events, "task_submitted");
  else if (id === "handrails_off") current = cleanAfterHints(events);
  else if (id === "one_hint_enough")
    current = solved(events).some(
      (event) =>
        number(event, "hintCount") === 1 && number(event, "maxHintLevel") === 1,
    )
      ? 1
      : 0;
  else if (id === "second_time_independent")
    current = solved(events).some(
      (event, i, list) =>
        truthy(event, "noHints") &&
        list
          .slice(0, i)
          .some(
            (prior) =>
              key(prior, "taskId") === key(event, "taskId") &&
              !truthy(prior, "noHints"),
          ),
    )
      ? 1
      : 0;
  else if (id === "hints_fading_1") current = hintReduction(events, 10);
  else if (id === "hints_fading_2") current = hintReduction(events, 20);
  else if (id === "hints_fading_3")
    current =
      hintReduction(events, 30) >= 40 &&
      solved(events)
        .slice(-30)
        .filter((event) => !truthy(event, "noHints")).length <= 6
        ? 40
        : 0;
  else if (id === "error_with_patience")
    current = ordered(events).some(
      (event, index, list) =>
        event.type === "task_solved" &&
        truthy(event, "noHints") &&
        list
          .slice(0, index)
          .some(
            (prior) =>
              prior.type === "task_submitted" &&
              !truthy(prior, "passed") &&
              key(prior, "taskId") === key(event, "taskId") &&
              daysBetween(prior, event) >= 1,
          ),
    )
      ? 1
      : 0;
  else if (id.startsWith("memory_echo_"))
    current = delayedRepeat(events, "knowledgeUnitId");
  else if (id === "archive_open") current = delayedRepeat(events, "topicId");
  else if (id === "weak_spot")
    current = events.some(
      (event) =>
        event.type === "mastery_changed" &&
        number(event, "wasBottomRank") > 0 &&
        number(event, "to") - number(event, "from") >= 15,
    )
      ? 15
      : 0;
  else if (id === "breakthrough_mastery")
    current = events.some(
      (event) =>
        event.type === "mastery_changed" &&
        number(event, "historicalMin") < 50 &&
        number(event, "to") >= 80 &&
        truthy(event, "controlPassed"),
    )
      ? 1
      : 0;
  else if (id === "cold_control")
    current = solved(events).some(
      (event) =>
        truthy(event, "isControl") &&
        truthy(event, "firstTry") &&
        truthy(event, "noHints") &&
        number(event, "topicIdleDays") >= 30 &&
        !truthy(event, "topicWarmup"),
    )
      ? 1
      : 0;
  else if (id === "skill_three_forms")
    current = Math.max(
      0,
      ...[
        ...new Set(
          solved(events).map((event) => key(event, "knowledgeUnitId")),
        ),
      ].map(
        (unit) =>
          new Set(
            solved(events)
              .filter((event) => key(event, "knowledgeUnitId") === unit)
              .map((event) => key(event, "exerciseType")),
          ).size,
      ),
    );
  else if (id === "panorama_3") current = topicDiversity(events, 7);
  else if (id === "panorama_7") current = topicDiversity(events, 30);
  else if (id === "panorama_12") current = topicDiversity(events, 90);
  else if (id.startsWith("toolbelt_"))
    current = distinctPayload(events, "methods");
  else if (id === "combo_session") current = sessionCombo(events);
  else if (id.startsWith("what_if_")) current = sandboxVariants(events);
  else if (id === "controlled_explosion")
    current = transition(events, "sandbox_run_failed", true);
  else if (id === "reconnaissance")
    current = events.some(
      (event, index, list) =>
        event.type === "task_solved" &&
        truthy(event, "noHints") &&
        list
          .slice(0, index)
          .some(
            (failed, failedIndex) =>
              failed.type === "task_submitted" &&
              !truthy(failed, "passed") &&
              key(failed, "taskId") === key(event, "taskId") &&
              list
                .slice(failedIndex + 1, index)
                .some((middle) => middle.type === "sandbox_run_succeeded"),
          ),
    )
      ? 1
      : 0;
  else if (id === "lesson_to_life")
    current = events.some(
      (event) =>
        event.type === "sandbox_run_succeeded" &&
        truthy(event, "ownDataset") &&
        number(event, "daysSinceMethodLearned") <= 7 &&
        number(event, "daysSinceMethodLearned") >= 0,
    )
      ? 1
      : 0;
  else if (id === "own_question")
    current = events.some(
      (event) =>
        event.type === "own_question_answered" && truthy(event, "answered"),
    )
      ? 1
      : 0;
  else if (id === "first_mini_analysis") current = miniAnalysis(events);
  else if (id.startsWith("no_loops_"))
    current = new Set(
      solved(events)
        .filter(
          (event) =>
            truthy(event, "vectorized") &&
            truthy(event, "vectorizationEligible"),
        )
        .map((event) => key(event, "taskId")),
    ).size;
  else if (id.startsWith("chain_reaction_"))
    current = new Set(
      solved(events)
        .filter(
          (event) =>
            number(event, "chainDepth") >=
              (id === "chain_reaction_3" ? 2 : 3) &&
            truthy(event, "chainingEligible"),
        )
        .map((event) => key(event, "taskId")),
    ).size;
  else if (id === "not_by_sample")
    current = solved(events).some(
      (event) =>
        truthy(event, "alternativeStrategy") && truthy(event, "noHints"),
    )
      ? 1
      : 0;
  else if (id.startsWith("long_run_")) current = activeMonths(events);
  else if (id === "proven_by_time")
    current = new Set(
      solved(events)
        .filter(
          (event) =>
            truthy(event, "review") &&
            truthy(event, "noHints") &&
            number(event, "daysSinceMastered") >= 90,
        )
        .map((event) => key(event, "knowledgeUnitId")),
    ).size;
  return progress({ current, target });
}
