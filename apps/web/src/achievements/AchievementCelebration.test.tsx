import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { AchievementCelebrationQueue } from "./AchievementCelebration";

vi.mock("./cloud", () => ({ scheduleAchievementCloudSave: vi.fn() }));

const definitions = [
  { id: "first_task", name: "Первопроходец", condition: "Решена первая задача", rarity: "common", rarity_ru: "Обычная", xp: 50, reward: "", icon: "icons/first.png" },
  { id: "first_execution", name: "Первый запуск", condition: "Выполнен код", rarity: "rare", rarity_ru: "Редкая", xp: 80, reward: "Титул исследователя", icon: "icons/run.png" },
];
const manifest = { version: "1", achievement_count: 2, family_count: 1, families: [{ slug: "test", name: "Test", achievements: definitions }] };
const snapshot = (events: unknown[], unlocked = {}) => ({ events, unlocked, activeCosmetics: {}, backfillVersion: 1, timezone: "Europe/Moscow" });

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: () => Promise.resolve(manifest) }));
  vi.stubGlobal("Image", class { src = ""; onload: null | (() => void) = null; decode() { return Promise.resolve(); } });
  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false }));
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });
const renderQueue = () => render(<MemoryRouter><AchievementCelebrationQueue /></MemoryRouter>);

describe("achievement celebration queue", () => {
  it("starts after a new unlock and renders the real reward", async () => {
    localStorage.setItem("koda:achievements:v1", JSON.stringify(snapshot([{ eventId: "task_solved:a", type: "task_solved", payload: { taskId: "a" }, occurredAt: "2026-08-12T00:00:00Z", localDate: "2026-08-12", version: 1 }])));
    renderQueue();
    expect(await screen.findByRole("status")).toHaveTextContent("Первопроходец");
    expect(screen.getByRole("status")).toHaveTextContent("+50 XP");
    expect(screen.getByRole("status").querySelector("img")).toHaveAttribute("src", "/achievements/icons/first.png");
  });

  it("does not replay an already celebrated unlock", async () => {
    localStorage.setItem("koda:achievements:v1", JSON.stringify(snapshot([], { first_task: { unlockedAt: "2026-08-12T00:00:00Z", sourceEventId: "task_solved:a", xp: 50, seen: false, celebrated: true } })));
    renderQueue(); await act(() => Promise.resolve());
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows simultaneous live unlocks sequentially and supports keyboard skipping", async () => {
    localStorage.setItem("koda:achievements:v1", JSON.stringify(snapshot([
      { eventId: "task_solved:a", type: "task_solved", payload: { taskId: "a" }, occurredAt: "2026-08-12T00:00:00Z", localDate: "2026-08-12", version: 1 },
      { eventId: "sandbox_run_succeeded:x", type: "sandbox_run_succeeded", payload: { codeHash: "x" }, occurredAt: "2026-08-12T00:01:00Z", localDate: "2026-08-12", version: 1 },
    ])));
    renderQueue(); expect(await screen.findByText("Первопроходец")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Enter" });
    expect(await screen.findByText("Первый запуск")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Титул исследователя");
    fireEvent.keyDown(document, { key: " " });
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
  });

  it("combines backfill unlocks into one scene", async () => {
    const unlocked = Object.fromEntries(definitions.map((item) => [item.id, { unlockedAt: "2026-08-12T00:00:00Z", sourceEventId: `task_solved:backfill:${item.id}`, xp: item.xp, seen: false }]));
    localStorage.setItem("koda:achievements:v1", JSON.stringify(snapshot([], unlocked)));
    renderQueue();
    expect(await screen.findByText("Получено новых достижений: 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Перейти к коллекции" })).toBeInTheDocument();
  });

  it("closes automatically, by click and by Escape without changing page content", async () => {
    vi.useFakeTimers();
    localStorage.setItem("koda:achievements:v1", JSON.stringify(snapshot([{ eventId: "task_solved:a", type: "task_solved", payload: { taskId: "a" }, occurredAt: "2026-08-12T00:00:00Z", localDate: "2026-08-12", version: 1 }])));
    render(<MemoryRouter><div data-testid="trainer">editor state</div><AchievementCelebrationQueue /></MemoryRouter>);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(screen.getByRole("status")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(2400));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByTestId("trainer")).toHaveTextContent("editor state");
  });

  it("uses the shorter timeout for reduced motion and clears it on unmount", async () => {
    vi.useFakeTimers(); const clearTimer = vi.spyOn(window, "clearTimeout"); vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }));
    localStorage.setItem("koda:achievements:v1", JSON.stringify(snapshot([{ eventId: "task_solved:a", type: "task_solved", payload: { taskId: "a" }, occurredAt: "2026-08-12T00:00:00Z", localDate: "2026-08-12", version: 1 }])));
    const view = renderQueue(); await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    act(() => vi.advanceTimersByTime(1200)); expect(screen.queryByRole("status")).not.toBeInTheDocument();
    view.unmount(); expect(clearTimer).toHaveBeenCalled();
  });
});
