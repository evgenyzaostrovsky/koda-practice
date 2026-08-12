import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AchievementFamilyDialog } from "./AchievementFamilyDialog";
import { buildAchievementFamilies } from "./families";
import type { AchievementManifest, AchievementSnapshot } from "./types";

const definitions = [
  {
    id: "first",
    name: "Первопроходец",
    condition: "Решить 1 задачу",
    rarity: "common" as const,
    rarity_ru: "Обычная",
    xp: 10,
    reward: "",
    icon: "first.png",
  },
  {
    id: "warmup",
    name: "Разогрев",
    condition: "Решить 10 задач",
    rarity: "common" as const,
    rarity_ru: "Обычная",
    xp: 20,
    reward: "",
    icon: "warmup.png",
  },
  {
    id: "future",
    name: "Практик",
    condition: "Решить 25 задач",
    rarity: "rare" as const,
    rarity_ru: "Редкая",
    xp: 30,
    reward: "",
    icon: "future.png",
  },
];
const manifest: AchievementManifest = {
  version: "1",
  achievement_count: 3,
  family_count: 1,
  families: [
    { slug: "tasks", name: "Решённые задачи", achievements: definitions },
  ],
};
const snapshot = (unlocked: string[]): AchievementSnapshot => ({
  events: [],
  activeCosmetics: {},
  backfillVersion: 1,
  timezone: "UTC",
  unlocked: Object.fromEntries(
    unlocked.map((id, index) => [
      id,
      {
        unlockedAt: `2026-01-0${index + 1}`,
        sourceEventId: id,
        xp: 10,
        seen: true,
      },
    ]),
  ),
});
const open = (unlocked: string[] = ["first"]) => {
  const state = snapshot(unlocked);
  const family = buildAchievementFamilies(manifest, state)[0];
  const view = render(
    <AchievementFamilyDialog family={family} onClose={vi.fn()} />,
  );
  return { state, family, ...view };
};
const step = (name: string) =>
  screen.getByRole("button", { name: new RegExp(`^${name}\\.`) });

afterEach(cleanup);

describe("AchievementFamilyDialog selection", () => {
  it("selects the highest unlocked achievement on open", () => {
    open(["first", "warmup"]);
    expect(step("Разогрев")).toHaveAttribute("aria-selected", "true");
    expect(
      screen.getByRole("heading", { name: "Разогрев", level: 3 }),
    ).toBeInTheDocument();
  });

  it("selects the first step for an unstarted family", () => {
    open([]);
    expect(step("Первопроходец")).toHaveAttribute("aria-selected", "true");
  });

  it("moves selection and the blue-frame class to the clicked achievement", () => {
    open();
    fireEvent.click(step("Разогрев"));
    expect(step("Разогрев")).toHaveClass("selected");
    expect(step("Первопроходец")).not.toHaveClass("selected");
  });

  it("shows details for exactly the selected achievement", () => {
    open();
    fireEvent.click(step("Практик"));
    expect(
      screen.getByRole("heading", { name: "Практик", level: 3 }),
    ).toBeInTheDocument();
    expect(document.querySelector(".family-step-details")).toHaveAttribute(
      "data-achievement-id",
      "future",
    );
  });

  it("does not select the next target unless the user selects it", () => {
    open();
    expect(step("Разогрев")).toHaveClass("next");
    expect(step("Разогрев")).not.toHaveClass("selected");
    expect(step("Разогрев")).toHaveAttribute("aria-selected", "false");
  });

  it("does not mutate progress when a future step is selected", () => {
    const { state, family } = open();
    const before = JSON.stringify({
      state,
      current: family.currentProgress,
      completed: family.completedCount,
    });
    fireEvent.click(step("Практик"));
    expect(
      JSON.stringify({
        state,
        current: family.currentProgress,
        completed: family.completedCount,
      }),
    ).toBe(before);
  });

  it("keeps one selected step and supports arrow, Enter and Space selection", () => {
    open();
    fireEvent.keyDown(step("Первопроходец"), { key: "ArrowRight" });
    expect(step("Разогрев")).toHaveFocus();
    expect(step("Разогрев")).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(step("Разогрев"), { key: "ArrowRight" });
    fireEvent.keyDown(step("Практик"), { key: " " });
    fireEvent.keyDown(step("Практик"), { key: "Enter" });
    expect(
      document.querySelectorAll('.family-step[aria-selected="true"]'),
    ).toHaveLength(1);
  });
});
