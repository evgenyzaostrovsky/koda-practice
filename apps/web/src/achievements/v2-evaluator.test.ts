import { describe, expect, it } from "vitest";
import type { AchievementEvent, AchievementEventType } from "./types";
import { v2Progress } from "./v2-evaluator";

let serial = 0;
const event = (
  type: AchievementEventType,
  day: number,
  payload: Record<string, unknown> = {},
): AchievementEvent => ({
  eventId: `${type}:${serial++}`,
  type,
  payload,
  occurredAt: new Date(Date.UTC(2026, 0, day, 12)).toISOString(),
  localDate: `2026-01-${String(day).padStart(2, "0")}`,
  version: 1,
});
const unlocked = (id: string, events: AchievementEvent[]) =>
  v2Progress(id, events)?.unlocked;

describe("v2 evaluator temporal and sequence rules", () => {
  it("handles comeback boundaries and rolling rhythm", () => {
    expect(
      unlocked("comeback_7d", [
        event("task_solved", 1),
        event("task_solved", 8),
      ]),
    ).toBe(true);
    expect(
      unlocked("comeback_7d", [
        event("task_solved", 1),
        event("task_solved", 7),
      ]),
    ).toBe(false);
    expect(
      unlocked("rhythm_3_7", [
        event("task_solved", 1),
        event("task_solved", 3),
        event("task_solved", 7),
      ]),
    ).toBe(true);
    expect(
      unlocked("rhythm_3_7", [
        event("task_solved", 1),
        event("task_solved", 8),
        event("task_solved", 15),
      ]),
    ).toBe(false);
  });

  it("counts failures only for one task before its success", () => {
    const positive = [
      event("task_submitted", 1, { taskId: "a", passed: false }),
      event("task_submitted", 1, { taskId: "a", passed: false }),
      event("task_solved", 1, { taskId: "a" }),
    ];
    expect(unlocked("try_again_2", positive)).toBe(true);
    expect(
      unlocked("try_again_2", [
        event("task_submitted", 1, { taskId: "a", passed: false }),
        event("task_submitted", 1, { taskId: "b", passed: false }),
        event("task_solved", 1, { taskId: "a" }),
      ]),
    ).toBe(false);
  });

  it("requires changed code and no intervening hint for recovery", () => {
    const failed = event("task_runtime_error", 1, {
      taskId: "a",
      codeHash: "old",
    });
    const fixed = event("task_solved", 1, { taskId: "a", codeHash: "new" });
    expect(unlocked("self_debugger_runtime", [failed, fixed])).toBe(true);
    expect(
      unlocked("self_debugger_runtime", [
        failed,
        event("hint_used", 1, { taskId: "a" }),
        fixed,
      ]),
    ).toBe(false);
    expect(
      unlocked("controlled_explosion", [
        event("sandbox_run_failed", 1, { runtimeId: "r", codeHash: "a" }),
        event("sandbox_run_succeeded", 1, { runtimeId: "r", codeHash: "b" }),
      ]),
    ).toBe(true);
  });

  it("requires prior hint behaviour and comparable reduction windows", () => {
    const history = Array.from({ length: 3 }, (_, index) =>
      event("task_solved", index + 1, { noHints: false }),
    );
    const clean = Array.from({ length: 5 }, (_, index) =>
      event("task_solved", index + 5, { noHints: true }),
    );
    expect(unlocked("handrails_off", [...history, ...clean])).toBe(true);
    expect(unlocked("handrails_off", clean)).toBe(false);
    const reduced = [
      ...Array.from({ length: 10 }, (_, i) =>
        event("task_solved", i + 1, { noHints: i >= 2 }),
      ),
      ...Array.from({ length: 10 }, (_, i) =>
        event("task_solved", i + 12, { noHints: true }),
      ),
    ];
    expect(unlocked("hints_fading_1", reduced)).toBe(true);
  });

  it("uses structured evidence for secret and AST-dependent rules", () => {
    expect(
      unlocked("not_by_sample", [
        event("task_solved", 1, { alternativeStrategy: true, noHints: true }),
      ]),
    ).toBe(true);
    expect(
      unlocked("not_by_sample", [event("task_solved", 1, { noHints: true })]),
    ).toBe(false);
    const vectorized = Array.from({ length: 3 }, (_, i) =>
      event("task_solved", i + 1, {
        taskId: `v${i}`,
        vectorized: true,
        vectorizationEligible: true,
      }),
    );
    expect(unlocked("no_loops_3", vectorized)).toBe(true);
    expect(unlocked("chain_reaction_3", vectorized)).toBe(false);
  });

  it("deduplicates sandbox hypotheses and recognises a session combo", () => {
    const variants = ["a", "a", "b", "c"].map((hash, index) =>
      event("sandbox_run_succeeded", index + 1, {
        sessionId: "s",
        codeHash: hash,
      }),
    );
    expect(unlocked("what_if_3", variants)).toBe(true);
    const combo = [
      event("task_solved", 1, { sessionId: "s", review: false }),
      event("task_solved", 1, { sessionId: "s", review: true }),
      event("sandbox_run_succeeded", 1, { sessionId: "s", codeHash: "x" }),
    ];
    expect(unlocked("combo_session", combo)).toBe(true);
  });

  it("does not derive v2 achievements from legacy backfill", () => {
    const legacy = event("task_solved", 1, { sessionElapsedMs: 1 });
    legacy.eventId = "task_solved:backfill:a";
    expect(unlocked("quick_start", [legacy])).toBe(false);
  });

  it("requires an explicitly completed 5-10 minute session", () => {
    expect(
      unlocked("short_loop", [
        event("task_solved", 1, { sessionElapsedMs: 360_000 }),
      ]),
    ).toBe(false);
    expect(
      unlocked("short_loop", [
        event("session_completed", 1, {
          solvedCount: 1,
          durationMs: 360_000,
        }),
      ]),
    ).toBe(true);
  });

  it("does not award delayed repair after revealing the solution", () => {
    const failed = event("task_submitted", 1, { taskId: "a", passed: false });
    const solved = event("task_solved", 3, { taskId: "a", noHints: true });
    expect(unlocked("error_with_patience", [failed, solved])).toBe(true);
    expect(
      unlocked("error_with_patience", [
        failed,
        event("solution_revealed", 2, { taskId: "a" }),
        solved,
      ]),
    ).toBe(false);
  });

  it("binds reconnaissance to the stuck task and changed task code", () => {
    const failed = event("task_submitted", 1, {
      taskId: "a",
      passed: false,
      codeHash: "old",
    });
    const experiment = event("sandbox_run_succeeded", 1, {
      originTaskId: "a",
      codeHash: "experiment",
    });
    const fixed = event("task_solved", 1, {
      taskId: "a",
      codeHash: "new",
      noHints: true,
    });
    expect(unlocked("reconnaissance", [failed, experiment, fixed])).toBe(true);
    expect(
      unlocked("reconnaissance", [
        failed,
        { ...experiment, payload: { ...experiment.payload, originTaskId: "b" } },
        fixed,
      ]),
    ).toBe(false);
  });
});
