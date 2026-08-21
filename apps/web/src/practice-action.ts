import type { RunResult } from "./types";

export function visiblePracticeResult(result: RunResult, submit: boolean): RunResult {
  if (submit) return result;
  return {
    ok: result.ok,
    stdout: result.stdout,
    result: result.result,
    error: result.error,
    execution_ms: result.execution_ms,
  };
}

export function attemptsAfterPracticeAction(
  current: number,
  result: RunResult,
  submit: boolean,
): number {
  if (!submit) return current;
  return result.attempt_number ?? current + 1;
}
