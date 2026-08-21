import { describe, expect, it } from "vitest";
import { attemptsAfterPracticeAction, visiblePracticeResult } from "./practice-action";
import type { RunResult } from "./types";

describe("practice Run and Check semantics", () => {
  const checkerResponse: RunResult = {
    ok: true,
    passed: false,
    execution_ms: 7,
    result: { kind: "scalar", data: 42 },
    tests_passed: 0,
    tests_total: 1,
    attempt_number: 9,
    xp_earned: 0,
    explanation: { kind: "wrong", title: "Ошибка проверки", what: "Не совпало", check: "Проверить", nudge: "Подсказка" },
  };

  it("Run exposes execution output but strips checker feedback", () => {
    expect(visiblePracticeResult(checkerResponse, false)).toEqual({
      ok: true,
      result: { kind: "scalar", data: 42 },
      execution_ms: 7,
    });
  });

  it("Run preserves attempts while Check accepts the authoritative attempt number", () => {
    expect(attemptsAfterPracticeAction(3, checkerResponse, false)).toBe(3);
    expect(attemptsAfterPracticeAction(3, checkerResponse, true)).toBe(9);
  });
});
