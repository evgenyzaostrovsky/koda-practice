import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { ProfileAchievements } from "./ProfileAchievements";
vi.mock("./cloud", () => ({ scheduleAchievementCloudSave: vi.fn() }));
const def = (id: string, name: string) => ({ id, name, condition: name, rarity: "common", rarity_ru: "Обычная", xp: 50, reward: "", icon: `${id}.png` });
const manifest = { version: "1", achievement_count: 3, family_count: 2, families: [{ slug: "tasks", name: "Задачи", achievements: [def("first_task", "Первая"), def("warmup", "Вторая")] }, { slug: "streaks", name: "Серия", achievements: [def("streak_3", "Ритм")] }] };
beforeEach(() => {
  localStorage.setItem("koda:achievements:v1", JSON.stringify({ events: [], unlocked: { first_task: { unlockedAt: "2026-01-01", sourceEventId: "a", xp: 50, seen: true }, warmup: { unlockedAt: "2026-01-02", sourceEventId: "b", xp: 50, seen: true } }, activeCosmetics: {}, backfillVersion: 1, timezone: "UTC" }));
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(manifest) }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it("shows every unlocked achievement and no locked placeholders", async () => {
  render(<MemoryRouter><ProfileAchievements /></MemoryRouter>);
  expect(await screen.findByAltText("Первая")).toBeInTheDocument();
  expect(screen.getByAltText("Вторая")).toBeInTheDocument();
  expect(screen.queryByAltText("Ритм")).not.toBeInTheDocument();
  expect(screen.getByText("2 / 3")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /Достижения/ })).toHaveAttribute("href", "/achievements");
});
it("keeps the profile usable when the manifest fails", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
  render(<MemoryRouter><ProfileAchievements /></MemoryRouter>);
  await waitFor(() => expect(screen.getByText("Не удалось загрузить достижения")).toBeInTheDocument());
  expect(screen.getByRole("button", { name: /Повторить/ })).toBeInTheDocument();
});
