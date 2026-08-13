import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import { AchievementCelebrationQueue } from "./AchievementCelebration";

vi.mock("./cloud", () => ({ scheduleAchievementCloudSave: vi.fn() }));

const definitions = [
  {
    id: "first_task",
    name: "Первопроходец",
    condition: "Решена первая задача",
    rarity: "common",
    rarity_ru: "Обычная",
    xp: 50,
    reward: "Рамка профиля",
    icon: "icons/first.png",
  },
  {
    id: "first_execution",
    name: "Первый запуск",
    condition: "Выполнен код",
    rarity: "rare",
    rarity_ru: "Редкая",
    xp: 80,
    reward: "Титул исследователя",
    icon: "icons/run.png",
  },
];
const manifest = {
  version: "1",
  achievement_count: 2,
  family_count: 1,
  families: [{ slug: "test", name: "Test", achievements: definitions }],
};
const solved = {
  eventId: "task_solved:a",
  type: "task_solved",
  payload: { taskId: "a" },
  occurredAt: "2026-08-12T00:00:00Z",
  localDate: "2026-08-12",
  version: 1,
};
const run = {
  eventId: "sandbox_run_succeeded:x",
  type: "sandbox_run_succeeded",
  payload: { codeHash: "x" },
  occurredAt: "2026-08-12T00:01:00Z",
  localDate: "2026-08-12",
  version: 1,
};
const snapshot = (events: unknown[], unlocked = {}) => ({
  events,
  unlocked,
  activeCosmetics: {},
  backfillVersion: 1,
  timezone: "Europe/Moscow",
});

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ json: () => Promise.resolve(manifest) }),
  );
  vi.stubGlobal(
    "Image",
    class {
      src = "";
      onload: null | (() => void) = null;
      decode() {
        return Promise.resolve();
      }
    },
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const store = (events: unknown[] = [solved], unlocked = {}) =>
  localStorage.setItem(
    "koda:achievements:v1",
    JSON.stringify(snapshot(events, unlocked)),
  );
const renderQueue = (child?: ReactNode) =>
  render(
    <MemoryRouter>
      {child}
      <AchievementCelebrationQueue />
    </MemoryRouter>,
  );
const scene = () => screen.getByRole("dialog");
const confirm = async () => {
  fireEvent.click(screen.getByRole("button", { name: "Получить" }));
  fireEvent.animationEnd(document.querySelector(".celebration-content")!);
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
};

describe("achievement celebration queue", () => {
  it("stays open without an automatic close or active timers", async () => {
    const timeout = vi.spyOn(window, "setTimeout");
    store();
    renderQueue();
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    await act(() => Promise.resolve());
    expect(scene()).toBeInTheDocument();
    expect(timeout).not.toHaveBeenCalledWith(expect.any(Function), 1200);
    expect(timeout).not.toHaveBeenCalledWith(expect.any(Function), 2400);
  });

  it("does not close when the intro CSS animation finishes", async () => {
    store();
    renderQueue();
    await screen.findByRole("dialog");
    fireEvent.animationEnd(document.querySelector(".celebration-art")!);
    fireEvent.animationEnd(document.querySelector(".celebration-content")!);
    expect(scene()).toBeInTheDocument();
  });

  it("does not close on backdrop click or Escape", async () => {
    store();
    renderQueue();
    await screen.findByRole("dialog");
    fireEvent.click(scene());
    fireEvent.keyDown(document, { key: "Escape" });
    expect(scene()).toBeInTheDocument();
  });

  it("closes only after the Get button confirmation animation", async () => {
    store();
    renderQueue();
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: "Получить" }));
    expect(scene()).toBeInTheDocument();
    fireEvent.animationEnd(document.querySelector(".celebration-content")!);
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  it("shows title, condition, XP, reward and focuses the action", async () => {
    store();
    renderQueue();
    expect(await screen.findByText("НОВОЕ ДОСТИЖЕНИЕ")).toBeInTheDocument();
    expect(scene()).toHaveTextContent("Первопроходец");
    expect(scene()).toHaveTextContent("Решена первая задача");
    expect(scene()).toHaveTextContent("+50 XP");
    expect(scene()).toHaveTextContent("Награда: Рамка профиля");
    expect(screen.getByRole("button", { name: "Получить" })).toHaveFocus();
  });

  it("awards XP before confirmation and never awards it twice", async () => {
    store();
    renderQueue();
    await screen.findByRole("dialog");
    const before = JSON.parse(localStorage.getItem("koda:achievements:v1")!);
    expect(before.unlocked.first_task.xp).toBe(50);
    await confirm();
    const after = JSON.parse(localStorage.getItem("koda:achievements:v1")!);
    expect(after.unlocked.first_task.xp).toBe(50);
    expect(after.unlocked.first_task.seen).toBe(true);
  });

  it("reappears after reload while it is not acknowledged", async () => {
    store();
    const first = renderQueue();
    await screen.findByRole("dialog");
    first.unmount();
    renderQueue();
    expect(await screen.findByRole("dialog")).toHaveTextContent(
      "Первопроходец",
    );
  });

  it("does not reappear after acknowledgement", async () => {
    store();
    const first = renderQueue();
    await screen.findByRole("dialog");
    await confirm();
    first.unmount();
    renderQueue();
    await act(() => Promise.resolve());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows multiple live achievements sequentially with a counter", async () => {
    store([solved, run]);
    renderQueue();
    expect(await screen.findByText("Первопроходец")).toBeInTheDocument();
    expect(scene()).toHaveTextContent("1 из 2");
    fireEvent.click(screen.getByRole("button", { name: "Получить" }));
    fireEvent.animationEnd(document.querySelector(".celebration-content")!);
    expect(await screen.findByText("Первый запуск")).toBeInTheDocument();
    expect(scene()).toHaveTextContent("2 из 2");
  });

  it("keeps exactly one bulk backfill scene", async () => {
    const unlocked = Object.fromEntries(
      definitions.map((item) => [
        item.id,
        {
          unlockedAt: "2026-08-12T00:00:00Z",
          sourceEventId: `task_solved:backfill:${item.id}`,
          xp: item.xp,
          seen: false,
        },
      ]),
    );
    store([], unlocked);
    renderQueue();
    expect(
      await screen.findByText("Получено достижений: 2"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Посмотреть достижения" }),
    ).toBeInTheDocument();
  });

  it("preserves the current page state after closing", async () => {
    store();
    renderQueue(<input aria-label="Редактор" defaultValue="editor state" />);
    await screen.findByRole("dialog");
    await confirm();
    expect(screen.getByRole("textbox", { name: "Редактор" })).toHaveValue(
      "editor state",
    );
  });

  it.each(["Enter", " "])(
    "traps focus and %s activates the focused button",
    async (key) => {
      store();
      renderQueue();
      await screen.findByRole("dialog");
      const button = screen.getByRole("button", { name: "Получить" });
      fireEvent.keyDown(document, { key: "Tab" });
      expect(button).toHaveFocus();
      fireEvent.keyDown(button, { key });
      expect(scene()).toHaveClass("confirming");
    },
  );
});
