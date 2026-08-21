import { beforeEach, describe, expect, it, vi } from "vitest";
import { localApi } from "./local-api";

const exercise = { id: "task-001", solution_code: "result = 42", xp: 15, hints: ["Подсказка"], explanation: "Ответ" };
const catalog = { modules: [{ slug: "module", title: "Модуль", topics: [{ slug: "topic", exercises: [exercise] }] }] };

describe("local API run semantics", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: () => Promise.resolve(catalog) }));
  });

  it("does not grade code or increment attempts on Run", async () => {
    const run = await localApi<Record<string, unknown>>("/executions/run", { method: "POST", body: JSON.stringify({ exercise_id: exercise.id, code: exercise.solution_code }) });
    const progress = await localApi<{ attempts: number; solved: number }>("/progress");
    expect(run).not.toHaveProperty("passed");
    expect(run).not.toHaveProperty("attempt_number");
    expect(progress).toMatchObject({ attempts: 0, solved: 0 });
  });

  it("grades and increments only on Check", async () => {
    const checked = await localApi<{ passed: boolean; attempt_number: number }>("/attempts/submit", { method: "POST", body: JSON.stringify({ exercise_id: exercise.id, code: exercise.solution_code }) });
    const progress = await localApi<{ attempts: number; solved: number }>("/progress");
    expect(checked).toMatchObject({ passed: true, attempt_number: 1 });
    expect(progress).toMatchObject({ attempts: 1, solved: 1 });
  });
});
