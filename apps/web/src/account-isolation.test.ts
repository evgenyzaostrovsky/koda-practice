import { beforeEach, describe, expect, it, vi } from "vitest";

const { upsert, update, from } = vi.hoisted(() => {
  const upsert = vi.fn(async (_payload: unknown) => ({ error: null }));
  const update = vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })), in: vi.fn(async () => ({ error: null })) })) }));
  return { upsert, update, from: vi.fn(() => ({ upsert, update })) };
});

vi.mock("./supabase", () => ({ supabase: { from } }));

import { scheduleCloudTask, setCloudUser } from "./cloud-sync";
import { scheduleAchievementCloudSave, setAchievementCloudUser } from "./achievements/cloud";
import { emitAchievementEvent, loadSnapshot, setAchievementStorageUser } from "./achievements/engine";
import type { AchievementSnapshot } from "./achievements/types";

const user = (id: string) => ({ id } as never);
const task = (code: string) => ({ taskId: "start-001", code, status: "draft" as const, attempts: 0, lastRunResult: null, completedAt: null, updatedAt: "now" });
const snapshot = (eventId: string): AchievementSnapshot => ({ events: [{ eventId, type: "task_solved", payload: {}, occurredAt: "now", localDate: "2026-08-27", version: 1 }], unlocked: {}, activeCosmetics: {}, backfillVersion: 0, timezone: "UTC" });

describe("account switch isolation", () => {
  beforeEach(() => { vi.useFakeTimers(); localStorage.clear(); upsert.mockClear(); from.mockClear(); setCloudUser(null); setAchievementCloudUser(null); setAchievementStorageUser(null); });

  it("cancels task and achievement writes captured for A before switching to B", async () => {
    setCloudUser(user("A"));
    setAchievementCloudUser(user("A"));
    scheduleCloudTask(task("A code"));
    scheduleAchievementCloudSave(snapshot("A event"));
    setCloudUser(user("B"));
    setAchievementCloudUser(user("B"));
    await vi.runAllTimersAsync();
    expect(upsert).not.toHaveBeenCalled();

    scheduleCloudTask(task("B code"));
    scheduleAchievementCloudSave(snapshot("B event"));
    await vi.runAllTimersAsync();
    const payloads = upsert.mock.calls.map(([payload]) => payload);
    expect(JSON.stringify(payloads)).not.toContain('"user_id":"A"');
    expect(JSON.stringify(payloads)).toContain('"user_id":"B"');
    vi.useRealTimers();
  });

  it("keeps A and B achievement caches isolated and copies legacy without deleting it", () => {
    localStorage.setItem("koda:achievements:v1", JSON.stringify({ events: [{ eventId: "legacy" }] }));
    setAchievementStorageUser("A");
    emitAchievementEvent("task_solved", { taskId: "a" }, "A-only");
    expect(loadSnapshot().events.some((event) => event.eventId.includes("A-only"))).toBe(true);
    setAchievementStorageUser("B");
    expect(loadSnapshot().events.some((event) => event.eventId.includes("A-only"))).toBe(false);
    expect(loadSnapshot().events.some((event) => event.eventId === "legacy")).toBe(true);
    expect(localStorage.getItem("koda:achievements:v1")).not.toBeNull();
    expect(localStorage.getItem("koda:achievements:v1:A")).not.toEqual(localStorage.getItem("koda:achievements:v1:B"));
  });
});
