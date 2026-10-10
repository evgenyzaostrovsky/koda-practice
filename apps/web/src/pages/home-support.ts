import type { Module } from "../types";
import type { AchievementManifest, AchievementSnapshot } from "../achievements/types";

export function selectHomeContinuation(modules: Module[], lastTask: string | null, solvedIds: readonly string[] = []) {
  const tasks = modules.flatMap(module => module.topics.flatMap(topic => topic.exercises.map(task => ({ task, topic, module }))));
  const solved = new Set(solvedIds);
  return tasks.find(item => item.task.id === lastTask && !solved.has(item.task.id)) ?? tasks.find(item => !solved.has(item.task.id)) ?? null;
}

export function latestEarnedAchievement(manifest: AchievementManifest, snapshot: AchievementSnapshot) {
  const definitions = new Map(manifest.families.flatMap(family => family.achievements.map(def => [def.id, { def, family }] as const)));
  return Object.entries(snapshot.unlocked).flatMap(([id, unlock]) => {
    const item = definitions.get(id);
    const time = Date.parse(unlock.unlockedAt);
    return item && Number.isFinite(time) ? [{ ...item, unlock, time }] : [];
  }).sort((a, b) => b.time - a.time || a.def.id.localeCompare(b.def.id))[0] ?? null;
}
