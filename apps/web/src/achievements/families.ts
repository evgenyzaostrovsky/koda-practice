import type { AchievementFamily, AchievementManifest, AchievementProgress, AchievementSnapshot } from "./types";
import { evaluate } from "./engine";

export type FamilyAchievement = ReturnType<typeof evaluate>["items"][number];
export type AchievementFamilyView = {
  slug: string; name: string; achievements: FamilyAchievement[]; unlockedAchievements: FamilyAchievement[];
  highestUnlockedAchievement?: FamilyAchievement; nextAchievement?: FamilyAchievement; currentProgress: AchievementProgress;
  completedCount: number; totalCount: number; isStarted: boolean; isCompleted: boolean;
};

export function buildAchievementFamilies(manifest: AchievementManifest, snapshot?: AchievementSnapshot, evaluated?: ReturnType<typeof evaluate>): AchievementFamilyView[] {
  const model = evaluated ?? evaluate(manifest, snapshot);
  const byId = new Map(model.items.map((item) => [item.def.id, item]));
  return manifest.families.map((family: AchievementFamily) => {
    const achievements = family.achievements.map((definition) => byId.get(definition.id)!);
    const unlockedAchievements = achievements.filter((item) => Boolean(item.unlock));
    const highestUnlockedAchievement = unlockedAchievements.at(-1);
    const nextAchievement = achievements.find((item) => !item.unlock);
    return {
      slug: family.slug, name: family.name, achievements, unlockedAchievements, highestUnlockedAchievement, nextAchievement,
      currentProgress: (nextAchievement || highestUnlockedAchievement || achievements[0]).progress,
      completedCount: unlockedAchievements.length, totalCount: achievements.length,
      isStarted: unlockedAchievements.length > 0, isCompleted: unlockedAchievements.length === achievements.length,
    };
  });
}

export const currentRank = (families: AchievementFamilyView[]) => families.find((family) => family.slug === "15_analyst_path")?.highestUnlockedAchievement?.def.name || "Ученик";
