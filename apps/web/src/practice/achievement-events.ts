import { emitAchievementEvent, stableCodeFingerprint } from "../achievements/engine";
import type { Exercise, RunResult } from "../types";
import type { TaskState } from "../task-storage";

export function recordPracticeSubmission(e: Exercise, code: string, r: RunResult, saved: TaskState | undefined, slug: string) {
  const eid = e.id;
  const source = `${eid}:${r.attempt_number ?? Date.now()}`;
  const telemetry = {
    taskId: eid,
    codeHash: stableCodeFingerprint(code),
    topicId: slug,
    knowledgeUnitId: e?.knowledge_unit_id,
    isControl: Boolean(e?.is_control),
    exerciseType: e?.is_control
      ? "control"
      : `difficulty-${e?.difficulty ?? 0}`,
    durationMs: r.execution_ms,
    hintCount: r.hints_used ?? 0,
    maxHintLevel: r.hints_used ?? 0,
    methods: r.achievement_evidence?.methods ?? [],
  };
  emitAchievementEvent(
    "task_submitted",
    { ...telemetry, passed: Boolean(r.passed) },
    source,
  );
  if(!r.passed)
    localStorage.setItem("koda:achievement-stuck-task", eid);
  if(!r.ok)
    emitAchievementEvent("task_runtime_error", telemetry, source);
  if(r.passed)
    emitAchievementEvent(
      "task_solved",
      {
        ...telemetry,
        firstTry: r.attempt_number === 1,
        noHints: (r.hints_used ?? 0) === 0,
        hard: (e?.difficulty ?? 0) >= 3,
        review: saved?.status === "completed",
        vectorized:
          Boolean(r.achievement_evidence) &&
          !r.achievement_evidence!.hasLoop,
        vectorizationEligible:
          Boolean(r.achievement_evidence) &&
          e?.knowledge_unit_id === "ku-vectorization",
        chainDepth: r.achievement_evidence?.chainDepth ?? 0,
        chainingEligible:
          (r.achievement_evidence?.referenceChainDepth ?? 0) >= 2,
        alternativeStrategy:
          r.achievement_evidence?.alternativeStrategy ?? false,
      },
      source,
    );
  if(r.passed)
    localStorage.removeItem("koda:achievement-stuck-task");
}
