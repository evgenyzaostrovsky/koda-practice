import { recordPracticeSubmission } from "./achievement-events";
import { usePracticeLayout } from "./usePracticeLayout";
import { getCloudUser } from "../cloud-sync";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { emitAchievementEvent } from "../achievements/engine";
import { api } from "../api";
import { attemptsAfterPracticeAction, visiblePracticeResult } from "../practice-action";
import { modulesQ } from "../queries";
import { loadTaskState, saveLastTask, saveTaskState } from "../task-storage";
import type { Exercise, RunResult, TheoryArticle } from "../types";
export function usePracticeController() {
  const { eid = "" } = useParams();
  const nav = useNavigate(),
    qc = useQueryClient();
  const {
    data: e,
    error: exerciseError,
    refetch: refetchExercise,
    isFetching,
  } = useQuery({
    queryKey: ["exercise", eid],
    queryFn: () => api<Exercise>(`/exercises/${eid}`),
  });
  const { data: mods = [], error: modulesError, refetch: refetchModules, isFetching: modulesFetching, isPending: modulesLoading } = useQuery({
    queryKey: ["modules"],
    queryFn: modulesQ,
  });
  const moduleIndex = mods.findIndex((module) => module.topics.some((topic) => topic.exercises.some((exercise) => exercise.id === eid)));
  const module = mods[moduleIndex];
  const topic = module?.topics.find((topic) => topic.exercises.some((exercise) => exercise.id === eid));
  const slug = topic?.slug ?? "";
  const number = (topic?.exercises.findIndex((exercise) => exercise.id === eid) ?? -1) + 1;
  const total = topic?.exercises.length ?? 0;
  const moduleTitle = topic?.title ?? "";
  const [code, setCode] = useState(""),
    [result, setResult] = useState<RunResult | null>(null),
    [hints, setHints] = useState<string[]>([]),
    [hintsOpen, setHintsOpen] = useState(true),
    [solution, setSolution] = useState(""),
    [theory, setTheory] = useState<TheoryArticle | null>(null);
  const { left, editorH, splitRef, dragColumns, dragRows } = usePracticeLayout();
  const initialized = useRef(false);
  useEffect(() => {
    if(e && !initialized.current) {
      initialized.current = true;
      const saved = loadTaskState(e.id);
      setCode(saved?.code ?? e.starter_code);
      setResult(saved?.lastRunResult ?? null);
      setHints([]);
      setSolution("");
      saveLastTask(e.id);
    }
  }, [e]);
  const updateCode = (value: string) => {
    setCode(value);
    if(e) saveTaskState(e.id, { code: value });
  };
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const action = useMutation({
    mutationFn: ({ submit, taskId, submittedCode }: { submit: boolean; taskId: string; submittedCode: string; exercise: Exercise; topicId: string; accountId: string | null }) => {
      return api<RunResult>(submit ? "/attempts/submit" : "/executions/run", {
        method: "POST",
        body: JSON.stringify({ exercise_id: taskId, code: submittedCode }),
      });
    },
    onSuccess: (r, vars) => {
      if((getCloudUser()?.id ?? null) !== vars.accountId) return;
      const visibleResult = visiblePracticeResult(r, vars.submit);
      if(mounted.current) setResult(visibleResult);
      const eid = vars.taskId;
      const e = vars.exercise;
      const code = vars.submittedCode;
      const saved = loadTaskState(eid);
      saveTaskState(eid, {
        code: saved?.code ?? code,
        status: vars.submit && r.passed ? "completed" : (saved?.status ?? "draft"),
        attempts: attemptsAfterPracticeAction(saved?.attempts ?? 0, r, vars.submit),
        lastRunResult: visibleResult,
        completedAt: vars.submit && r.passed
          ? new Date().toISOString()
          : (saved?.completedAt ?? null),
      });
      if(vars.submit) {
        recordPracticeSubmission(e, code, r, saved, vars.topicId);
        qc.invalidateQueries({ queryKey: ["progress"] });
      }
    },
    onError: () => {
      // Keep the last successful output visible; the inline error below makes
      // it explicit that it belongs to the previous request.
    },
  });
  const run = (submit: boolean) => {
    if(e) action.mutate({ submit, taskId: e.id, submittedCode: code, exercise: e, topicId: slug, accountId: getCloudUser()?.id ?? null });
  };
  useEffect(() => {
    const f = (x: KeyboardEvent) => {
      if(
        (x.ctrlKey || x.metaKey) &&
        (x.key === "Enter" || x.code === "Enter") &&
        !x.repeat &&
        !action.isPending
      ) {
        x.preventDefault();
        x.stopPropagation();
        run(x.shiftKey);
      }
    };
    window.addEventListener("keydown", f, true);
    return () => window.removeEventListener("keydown", f, true);
  }, [code, e, action.isPending]);
  const persist = () => {
    if(e) saveTaskState(e.id, { code });
  },
    go = (n: number) => {
      persist();
      if(n < 1) return nav(`/topics/${slug}`);
      if(n <= total)
        return nav(`/practice/${topic!.exercises[n - 1].id}`);
      const topicIndex = module?.topics.indexOf(topic!) ?? -1;
      const nextTopic = module?.topics[topicIndex + 1] ?? mods[moduleIndex + 1]?.topics[0];
      const nextTask = nextTopic?.exercises[0];
      nav(nextTask ? `/practice/${nextTask.id}` : "/progress");
    };
  const hint = async () => {
    if(hints.length < 3 && !action.isPending) {
      const accountId = getCloudUser()?.id ?? null;
      const x = await api<{ content: string }>(
        `/exercises/${eid}/hints/${hints.length + 1}`,
        { method: "POST" },
      );
      if(!mounted.current || (getCloudUser()?.id ?? null) !== accountId) return;
      setHints([...hints, x.content]);
      emitAchievementEvent(
        "hint_used",
        { taskId: eid, level: hints.length + 1 },
        `${eid}:${hints.length + 1}`,
      );
      setHintsOpen(true);
    }
  };
  const reveal = async () => {
    const accountId = getCloudUser()?.id ?? null;
    const x = await api<{ solution: string }>(`/exercises/${eid}/solution`, {
      method: "POST",
    });
    if(!mounted.current || (getCloudUser()?.id ?? null) !== accountId) return;
    setSolution(x.solution);
    emitAchievementEvent("solution_revealed", { taskId: eid }, eid);
  };
  const openTheory = async () => {
    const article = await api<TheoryArticle>(`/theory/${e!.theory_article_id}`);
    if(mounted.current) setTheory(article);
  };
  const reset = () => {
    saveTaskState(e!.id, { code: e!.starter_code, lastRunResult: null });
    setCode(e!.starter_code);
    setResult(null);
  };
  return {
    e: topic ? e : undefined,
    exerciseError: exerciseError ?? modulesError ?? (
      !modulesLoading && e && !topic ? new Error("Task is missing from the catalog") : null
    ),
    refetchExercise: () => Promise.all([refetchExercise(), refetchModules()]),
    isFetching: isFetching || modulesFetching,
    routeTasks: topic?.exercises ?? [],
    code, updateCode, result, hints, hintsOpen, setHintsOpen, solution,
    theory, setTheory, left, editorH, splitRef, moduleTitle, number, total,
    action, run, go, hint, reveal, openTheory, reset, dragColumns, dragRows, persist,
  };
}
