import type { KnowledgeUnit, Module } from "../types";
import type { AchievementManifest, AchievementSnapshot } from "../achievements/types";
import { progressFor, statsFrom } from "../achievements/engine";

export function knowledgePractice(unit: KnowledgeUnit, modules: Module[], solvedIds: readonly string[]) {
  const allowed = new Set(unit.relatedTaskIds), solved = new Set(solvedIds);
  const tasks = modules.flatMap(module => module.topics.flatMap(topic => topic.exercises.map(task => ({ task, topic })))).filter(item => allowed.has(item.task.id));
  const next = tasks.find(item => !solved.has(item.task.id));
  return next ? { ...next, repeat: false } : tasks[0] ? { ...tasks[0], repeat: true } : null;
}

/** Read-only: each family's first unearned public stage, ranked by evidenced progress. */
export function nearestAchievement(manifest: AchievementManifest, snapshot: AchievementSnapshot) {
  const stats = statsFrom(snapshot);
  const candidates = manifest.families.flatMap(family => {
    const def = family.achievements.find(item => !snapshot.unlocked[item.id]);
    if (!def || def.secret) return [];
    const progress = progressFor(def.id, stats, snapshot.events);
    if (progress.current <= 0 || progress.unlocked) return [];
    return [{ def, family, progress }];
  });
  return candidates.sort((a, b) => b.progress.percentage - a.progress.percentage || a.def.id.localeCompare(b.def.id))[0] ?? null;
}
