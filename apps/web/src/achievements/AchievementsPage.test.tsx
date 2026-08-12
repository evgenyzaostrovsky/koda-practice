import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AchievementsPage } from "./AchievementsPage";

vi.mock("../api", () => ({ api: vi.fn().mockResolvedValue({ solved_ids: [], modules: [], total: 200 }) }));
vi.mock("./rules", async (importOriginal) => ({ ...(await importOriginal<typeof import("./rules")>()), analystPath: [] }));
const manifest = { version: "1", achievement_count: 3, family_count: 2, families: [
  { slug: "tasks", name: "Задачи", achievements: [
    { id: "first_task", name: "Первая", condition: "Решить одну задачу", rarity: "common", rarity_ru: "Обычная", xp: 50, reward: "", icon: "icons/one.png" },
    { id: "warmup", name: "Десятая", condition: "Решить десять задач", rarity: "rare", rarity_ru: "Редкая", xp: 100, reward: "", icon: "icons/ten.png" },
  ] },
  { slug: "epic", name: "Эпические", achievements: [
    { id: "working_set", name: "Двадцать пять", condition: "Решить 25 задач", rarity: "epic", rarity_ru: "Эпическая", xp: 200, reward: "Титул", icon: "icons/twenty-five.png" },
  ] },
] };

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("koda:achievements:v1", JSON.stringify({
    events: [{ eventId: "task_solved:test", type: "task_solved", payload: { taskId: "test" }, occurredAt: "2026-08-12T00:00:00Z", localDate: "2026-08-12", version: 1 }],
    unlocked: { first_task: { unlockedAt: "2026-08-12T00:00:00Z", sourceEventId: "task_solved:test", xp: 50, seen: true } },
    activeCosmetics: {}, backfillVersion: 1, timezone: "Europe/Moscow",
  }));
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: () => Promise.resolve(manifest) }));
});
afterEach(cleanup);

async function renderPage() { render(<AchievementsPage />); await screen.findByRole("heading", { name: "Коллекция" }); }

describe("achievement collection", () => {
  it("renders every achievement as a compact tile with distinct states", async () => {
    await renderPage();
    const tiles = screen.getAllByRole("button", { name: /Получено|Не получено/ });
    expect(tiles).toHaveLength(3);
    expect(screen.getByRole("button", { name: "Первая. Получено" })).toHaveClass("unlocked");
    expect(screen.getByRole("button", { name: "Десятая. Не получено" })).toHaveClass("locked");
    expect(screen.getByRole("button", { name: "Десятая. Не получено" }).querySelector("img")).toBeVisible();
  });

  it("opens the selected achievement and shows evaluator progress", async () => {
    await renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Десятая. Не получено" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Десятая" })).toBeInTheDocument();
    expect(within(dialog).getAllByText("1 / 10")).toHaveLength(2);
    expect(within(dialog).getByText("Не получено")).toBeInTheDocument();
  });

  it("closes with Escape and restores focus", async () => {
    await renderPage();
    const tile = screen.getByRole("button", { name: "Десятая. Не получено" });
    fireEvent.click(tile); fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(tile).toHaveFocus());
  });

  it("filters tiles and hides empty families without changing family totals", async () => {
    await renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Полученные" }));
    expect(screen.getByRole("button", { name: "Первая. Получено" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Десятая. Не получено" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Эпические/ })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Задачи/ })).toHaveTextContent("1 / 2");
  });
});
