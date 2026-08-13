import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { AchievementManifest } from "./types";

const root = path.resolve("public/achievements");
const manifest = JSON.parse(
  fs.readFileSync(path.join(root, "manifest.json"), "utf8"),
) as AchievementManifest;
const definitions = manifest.families.flatMap((family) => family.achievements);
const originalIds = [
  "first_task",
  "warmup",
  "working_set",
  "fifty",
  "three_digits",
  "data_stream",
  "compute_module",
  "thousand",
  "streak_3",
  "streak_7",
  "streak_10",
  "streak_30",
  "streak_60",
  "streak_100",
  "streak_365",
  "first_module",
  "three_modules",
  "half_system",
  "full_assembly",
  "no_empty_cell",
  "absolute_coverage",
  "first_run_solution",
  "clean_streak",
  "precise_line",
  "flawless_module",
  "no_hints",
  "independent_control",
  "second_pass",
  "error_intercept",
  "error_work",
  "debugger",
  "beyond_limits",
  "high_load",
  "red_zone",
  "expert_mode",
  "hard_complete",
  "first_execution",
  "sandbox_researcher",
  "laboratory",
  "own_data",
  "first_dataframe",
  "multiple_sources",
  "independent_project",
  "data_matrix",
  "clean_dataset",
  "precise_selection",
  "aggregation_master",
  "connector",
  "time_master",
  "visual_signal",
  "visualizer",
  "data_researcher",
  "junior_analyst",
  "data_analyst",
  "koda_analyst",
];

describe("achievement manifest v2", () => {
  it("contains 114 unique achievements in 50 ordered families", () => {
    expect(manifest.achievement_count).toBe(114);
    expect(manifest.family_count).toBe(50);
    expect(new Set(definitions.map((item) => item.id)).size).toBe(114);
    expect(new Set(manifest.families.map((family) => family.slug)).size).toBe(
      50,
    );
    expect(
      manifest.families.map((family) => Number(family.slug.slice(0, 2))),
    ).toEqual(Array.from({ length: 50 }, (_, index) => index + 1));
  });

  it("preserves original stable ids and resolves every unique icon", () => {
    const ids = new Set(definitions.map((item) => item.id));
    originalIds.forEach((id) => expect(ids.has(id), id).toBe(true));
    expect(new Set(definitions.map((item) => item.icon)).size).toBe(114);
    definitions.forEach((item) =>
      expect(fs.existsSync(path.join(root, item.icon)), item.icon).toBe(true),
    );
  });

  it("contains exactly five concealed definitions", () => {
    const secrets = definitions.filter((item) => item.secret);
    expect(secrets).toHaveLength(5);
    secrets.forEach((item) => {
      expect(item.condition).toBe("Секретное достижение");
      expect(item.condition_after_unlock).toBeTruthy();
    });
  });
});
