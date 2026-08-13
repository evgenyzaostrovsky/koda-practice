import type {
  AchievementDefinition,
  AchievementEvent,
  AchievementManifest,
  AchievementProgress,
  AchievementSnapshot,
  AchievementStats,
} from "./types";
import { achievementRules } from "./rules";
import { scheduleAchievementCloudSave } from "./cloud";
import { v2Progress } from "./v2-evaluator";
const KEY = "koda:achievements:v1",
  BACKFILL = 2;
const SESSION_KEY = "koda:achievement-session:v2";
const blank = (): AchievementSnapshot => ({
  events: [],
  unlocked: {},
  activeCosmetics: {},
  backfillVersion: 0,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
});
export const loadSnapshot = (): AchievementSnapshot => {
  try {
    return { ...blank(), ...JSON.parse(localStorage.getItem(KEY) || "{}") };
  } catch {
    return blank();
  }
};
export const saveSnapshot = (s: AchievementSnapshot) => {
  localStorage.setItem(KEY, JSON.stringify(s));
  scheduleAchievementCloudSave(s);
  window.dispatchEvent(new CustomEvent("koda-achievements-updated"));
};
export const stableCodeFingerprint = (code: string) => {
  let hash = 2166136261;
  for (const character of code.replace(/\s+/g, " ").trim()) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
};
const localDate = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  }).format(new Date());
export function emitAchievementEvent(
  type: AchievementEvent["type"],
  payload: Record<string, unknown>,
  source: string,
) {
  const s = loadSnapshot(),
    eventId = `${type}:${source}`;
  if (s.events.some((e) => e.eventId === eventId)) return;
  let session: { id: string; startedAt: string };
  try {
    session = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null") || {
      id: crypto.randomUUID(),
      startedAt: new Date().toISOString(),
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    session = { id: "session", startedAt: new Date().toISOString() };
  }
  const occurredAt = new Date().toISOString();
  const e: AchievementEvent = {
    eventId,
    type,
    payload: {
      ...payload,
      sessionId: payload.sessionId || session.id,
      sessionElapsedMs:
        payload.sessionElapsedMs ??
        Math.max(
          0,
          new Date(occurredAt).getTime() -
            new Date(session.startedAt).getTime(),
        ),
    },
    occurredAt,
    localDate: localDate(),
    version: 1,
  };
  s.events.push(e);
  saveSnapshot(s);
}
export function backfillProgress(
  solvedIds: string[],
  modules: Array<{ status: string }>,
  total: number,
) {
  const s = loadSnapshot();
  if (s.backfillVersion >= BACKFILL) return;
  s.events.push(
    ...solvedIds
      .filter(
        (id) =>
          !s.events.some((e) => e.eventId === `task_solved:backfill:${id}`),
      )
      .map((id) => ({
        eventId: `task_solved:backfill:${id}`,
        type: "task_solved" as const,
        payload: { taskId: id, firstTry: false, noHints: false, hard: false },
        occurredAt: new Date().toISOString(),
        localDate: localDate(),
        version: 1 as const,
      })),
  );
  s.events.push({
    eventId: `course_progress_changed:backfill:${BACKFILL}`,
    type: "task_submitted",
    payload: {
      modules: modules.filter((m) => m.status === "mastered").length,
      totalModules: modules.length,
      total,
    },
    occurredAt: new Date().toISOString(),
    localDate: localDate(),
    version: 1,
  });
  s.backfillVersion = BACKFILL;
  saveSnapshot(s);
}
const streak = (dates: string[]) => {
  const unique = [...new Set(dates)].sort(),
    toDay = (x: string) =>
      Math.floor(new Date(`${x}T12:00:00`).getTime() / 86400000);
  let max = 0,
    current = 0,
    prev = -9;
  for (const date of unique) {
    const d = toDay(date);
    current = d - prev === 1 ? current + 1 : 1;
    max = Math.max(max, current);
    prev = d;
  }
  return {
    current: unique.length && toDay(localDate()) - prev <= 1 ? current : 0,
    max,
  };
};
export function statsFrom(s: AchievementSnapshot): AchievementStats {
  const solved = new Map<string, AchievementEvent>(),
    failed = new Set<string>(),
    hinted = new Set<string>(),
    hashDays = new Set<string>(),
    sandboxDates = new Set<string>();
  let clean = 0,
    maxClean = 0,
    modules = 0,
    totalModules = 0,
    total = 200;
  for (const e of s.events) {
    const id = String(e.payload.taskId || "");
    if (e.type === "task_submitted" && e.payload.passed === false) {
      failed.add(id);
      clean = 0;
    }
    if (e.type === "hint_used") hinted.add(id);
    if (e.type === "task_solved" && !solved.has(id)) {
      solved.set(id, e);
      if (e.payload.firstTry) {
        clean++;
        maxClean = Math.max(maxClean, clean);
      } else clean = 0;
    }
    if (e.type === "sandbox_run_succeeded") {
      hashDays.add(`${e.localDate}:${e.payload.codeHash}`);
      sandboxDates.add(e.localDate);
    }
    if (e.eventId.startsWith("course_progress_changed:")) {
      modules = Number(e.payload.modules || 0);
      totalModules = Number(e.payload.totalModules || 0);
      total = Number(e.payload.total || 200);
    }
  }
  const activity = [...solved.values()]
      .map((e) => e.localDate)
      .concat([...sandboxDates]),
    st = streak(activity);
  return {
    solved: solved.size,
    modules,
    totalModules,
    firstTry: [...solved.values()].filter((e) => e.payload.firstTry).length,
    cleanStreak: maxClean,
    noHints: [...solved].filter(([id]) => !hinted.has(id)).length,
    corrected: [...solved].filter(([id]) => failed.has(id)).length,
    hardSolved: [...solved.values()].filter((e) => e.payload.hard).length,
    sandboxRuns: hashDays.size,
    sandboxDays: sandboxDates.size,
    csvUploads: s.events.filter((e) => e.type === "csv_uploaded").length,
    dataframes: s.events.filter((e) => e.type === "own_dataframe_created")
      .length,
    joins: s.events.filter((e) => e.type === "own_datasets_joined").length,
    analyses: s.events.filter((e) => e.type === "own_analysis_completed")
      .length,
    charts: s.events.filter((e) => e.type === "chart_created").length,
    eda: s.events.filter((e) => e.type === "eda_completed").length,
    projectScore: Math.max(
      0,
      ...s.events
        .filter((e) => e.type === "project_scored")
        .map((e) => Number(e.payload.score || 0)),
    ),
    currentStreak: st.current,
    maxStreak: st.max,
    stabilizer:
      Boolean(s.unlocked.streak_10) &&
      !s.events.some((e) => e.payload.stabilizerUsed),
    topicProgress: {},
    _total: total,
  } as AchievementStats & { _total: number };
}
export function progressFor(
  id: string,
  stats: AchievementStats,
  events: AchievementEvent[] = [],
): AchievementProgress {
  const advanced = v2Progress(id, events);
  if (advanced) return advanced;
  const r = achievementRules[id];
  if (!r)
    return {
      current: 0,
      target: 1,
      percentage: 0,
      text: "Правило недоступно",
      unlocked: false,
    };
  let current = 0,
    target = r.target,
    text = "";
  if (r.metric === "halfModules") {
    current =
      stats.totalModules && stats.modules / stats.totalModules >= 0.5 ? 1 : 0;
    text = `${stats.modules} / ${stats.totalModules} блоков`;
  } else if (r.metric === "allModules") {
    current =
      stats.totalModules > 0 && stats.modules >= stats.totalModules ? 1 : 0;
    text = `${stats.modules} / ${stats.totalModules} блоков`;
  } else if (r.metric === "allTasks") {
    const total =
      (stats as AchievementStats & { _total?: number })._total || 200;
    current = stats.solved >= total ? 1 : 0;
    text = `${stats.solved} / ${total} задач`;
  } else if (r.metric === "topic") {
    const p = stats.topicProgress[r.topic || ""] || {
      current: 0,
      target: r.target,
    };
    current = p.current;
    target = p.target;
    text = `${current} / ${target}`;
  } else if (r.metric === "composite") {
    const parts = r.requires || [];
    const ratios = parts.map((x) =>
      Math.min(1, Number(stats[x.metric] || 0) / x.target),
    );
    current = ratios.length && ratios.every((x) => x >= 1) ? 1 : 0;
    text = parts
      .map((x) => `${Number(stats[x.metric] || 0)} / ${x.target}`)
      .join(" · ");
  } else {
    current = Number(stats[r.metric as keyof AchievementStats] || 0);
    text = `${Math.min(current, target)} / ${target}`;
  }
  return {
    current: Math.min(current, target),
    target,
    percentage: Math.min(100, Math.round((current / target) * 100)),
    text,
    unlocked: current >= target,
  };
}
export function evaluate(manifest: AchievementManifest, s = loadSnapshot()) {
  const stats = statsFrom(s),
    defs = manifest.families.flatMap((f) => f.achievements);
  const progress = new Map<string, AchievementProgress>();
  let changed = false;
  for (const d of defs) {
    const p = progressFor(d.id, stats, s.events);
    progress.set(d.id, p);
    if (p.unlocked && !s.unlocked[d.id]) {
      s.unlocked[d.id] = {
        unlockedAt: new Date().toISOString(),
        sourceEventId: s.events.at(-1)?.eventId || "backfill",
        xp: d.xp,
        seen: false,
      };
      changed = true;
    }
  }
  if (changed) {
    localStorage.setItem(KEY, JSON.stringify(s));
    scheduleAchievementCloudSave(s);
  }
  return {
    snapshot: s,
    stats,
    items: defs.map((def) => ({
      def,
      progress: progress.get(def.id)!,
      unlock: s.unlocked[def.id],
    })),
  };
}
export const rewardKind = (d: AchievementDefinition) =>
  !d.reward
    ? null
    : d.reward.includes("Титул")
      ? "title"
      : d.reward.includes("Рамк")
        ? "frame"
        : d.reward.includes("тема") || d.reward.includes("Тема")
          ? "theme"
          : d.reward.includes("Ранг") || d.reward.includes("ранг")
            ? "rank"
            : d.reward.includes("Акцент")
              ? "accent"
              : d.reward.includes("Фон")
                ? "background"
                : d.reward.includes("анимац")
                  ? "animation"
                  : d.reward.includes("Стабилизатор")
                    ? "stabilizer"
                    : "reward";
