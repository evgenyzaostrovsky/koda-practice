import { useAuth } from "../auth";
import Editor from "@monaco-editor/react";
import { AlertTriangle, ArrowLeft, ChevronLeft, ChevronRight, Clock3, Eye, LogOut, Trophy } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { TheoryPanel } from "../TheoryPanel";
import { DataPreview, Loading, QueryError, ResultView } from "../components/practice-shared";
import { usePracticeController } from "./usePracticeController";
import { KodaCheck, KodaHint, KodaReset, KodaRun, KodaTheory } from "../koda-icons";
export function Practice() {
  const { eid = "" } = useParams();
  const { user } = useAuth();
  return <PracticeSession key={`${user?.id ?? "anonymous"}:${eid}`} />;
}
function PracticeSession() {
  const { routeTasks, e, exerciseError, refetchExercise, isFetching, code, updateCode, result, hints, hintsOpen, setHintsOpen, solution, theory, setTheory, left, editorH, splitRef, moduleTitle, number, total, action, run, go, hint, reveal, openTheory, reset, dragColumns, dragRows, persist } = usePracticeController();
  if(exerciseError) return <QueryError retry={() => refetchExercise()} pending={isFetching} focus />;
  if(!e) return <Loading />;
  return (
    <div className="practice">
      <div className="air-practice-heading"><div><small>PYTHON · PANDAS</small><h1>Место для ясных мыслей</h1><p>{moduleTitle} · {number} из {total}</p></div><nav className="air-learning-route" aria-label="Задачи темы"><svg viewBox="0 0 600 40" preserveAspectRatio="none" aria-hidden="true"><path d="M0 23 Q80 0 150 19 T300 22 T450 17 T600 21" /></svg>{routeTasks.map((task, index) => <Link key={task.id} to={`/practice/${task.id}`} title={task.title} aria-label={`Задача ${index + 1}: ${task.title}`} aria-current={task.id === e.id ? "step" : undefined}><i /><span>{index + 1}</span></Link>)}</nav></div>
      <div className="focus-header">
        <button
          className="icon-btn"
          onClick={() => go(0)}
          aria-label="Назад к теме"
        >
          <ArrowLeft />
        </button>
        <nav className="air-practice-tabs" aria-label="Материал задачи"><button aria-pressed={!theory} onClick={() => setTheory(null)}>Задача</button><button aria-pressed={Boolean(theory)} onClick={openTheory}>Теория</button></nav>
        <div className="task-position">
          <span>
            Задача {number} из {total}
          </span>
          <div className="topic-progress">
            <i style={{ width: `${(number / total) * 100}%` }} />
          </div>
        </div>
        <div className="focus-xp">
          <Trophy />+{e.xp} XP
        </div>
        <div className="task-nav">
          <button
            onClick={() => go(number - 1)}
            disabled={number === 1}
            aria-label="Предыдущая задача"
          >
            <ChevronLeft />
          </button>
          <button
            onClick={() => go(number + 1)}
            disabled={number === total}
            aria-label="Следующая задача"
          >
            <ChevronRight />
          </button>
        </div>
        <button className="exit-focus" onClick={() => go(0)}>
          <LogOut />
          Выйти
        </button>
      </div>
      <div
        className="workspace resizable"
        ref={splitRef}
        style={{
          gridTemplateColumns: `minmax(230px,${left}fr) 12px minmax(320px,${100 - left}fr)`,
        }}
      >
        <section className="problem">
          <span className="eyebrow">ЗАДАЧА · СЛОЖНОСТЬ {e.difficulty}</span>
          <div className="problem-title-row">
            <h1>{e.title}</h1>
            <button className="theory-open" onClick={openTheory}>
              <KodaTheory /> Теория
            </button>
          </div>
          <p>{e.instructions}</p>
          <div className="target">
            Сохраните результат в <code>result</code>
          </div>
          <div className="section-title">
            <h3>Исходные данные</h3>
          </div>
          <DataPreview dataset={e.dataset} />
          <div className="hints">
            <div className="hint-head">
              <span>
                <KodaHint /> Использовано {hints.length} из 3
              </span>
              {hints.length > 0 && (
                <button
                  className="ghost"
                  onClick={() => setHintsOpen(!hintsOpen)}
                >
                  {hintsOpen ? "Свернуть" : "Развернуть"}
                </button>
              )}
            </div>
            {hintsOpen &&
              hints.map((x, i) => (
                <div className="hint-item" key={x}>
                  <b>{i + 1}</b>
                  <p>{x}</p>
                </div>
              ))}
            {hints.length < 3 ? (
              <button
                className="hint-next"
                onClick={hint}
                disabled={action.isPending}
              >
                Открыть подсказку {hints.length + 1}
              </button>
            ) : !solution ? (
              <button className="show-solution" onClick={reveal}>
                <Eye /> Показать решение
              </button>
            ) : (
              <pre className="revealed-solution">{solution}</pre>
            )}
          </div>
        </section>
        <div className="col-divider" onPointerDown={dragColumns} />
        <section className="solution">
          <div className="editor-head">
            <div>
              <b>solution.py</b>
              <small>Python 3.12 · pandas</small>
            </div>
            <button
              className="ghost"
              onClick={reset}
              disabled={action.isPending}
            >
              <KodaReset /> Сбросить решение
            </button>
          </div>
          <div className="editor-area" style={{ height: editorH }}>
            <Editor
              height="100%"
              language="python"
              theme={document.documentElement.dataset.theme === "airy" || document.documentElement.dataset.theme === "neutral-light" ? "light" : "vs-dark"}
              value={code}
              onChange={(x) => updateCode(x || "")}
              options={{
                fontSize: 14,
                fontFamily: "JetBrains Mono",
                minimap: { enabled: false },
                padding: { top: 16 },
                scrollBeyondLastLine: false,
              }}
            />
          </div>
          <div className="row-divider" onPointerDown={dragRows} />
          <div className="actions">
            <button
              className="secondary"
              onClick={() => run(false)}
              disabled={action.isPending}
            >
              {action.isPending ? <Clock3 /> : <KodaRun />} Запустить{" "}
              <kbd>Ctrl/Cmd+Enter</kbd>
            </button>
            <button
              onClick={() => run(true)}
              disabled={action.isPending}
            >
              {action.isPending ? <Clock3 /> : <KodaCheck />} Проверить{" "}
              <kbd>Ctrl/Cmd+Shift+Enter</kbd>
            </button>
          </div>
          <div className="result">
            <div className="tabs">
              <b>Результат</b>
            </div>
            {action.isPending ? (
              <Loading />
            ) : (
              <>
                {action.isError && (
                  <div className="feedback error detailed" role="alert">
                    <AlertTriangle />
                    <div>
                      <h3>{action.variables?.submit ? "Не удалось проверить решение" : "Не удалось запустить код"}</h3>
                      <p>{action.error instanceof Error ? action.error.message : "Сервис временно недоступен."}</p>
                      <p>Код сохранён. Проверьте соединение и повторите запрос.</p>
                      <button onClick={() => action.variables && action.mutate(action.variables)}>Повторить</button>
                    </div>
                  </div>
                )}
                {result ? (
                  <>{action.isError && <small>Предыдущий результат</small>}<ResultView r={result} /></>
                ) : !action.isError ? (
                  <div className="empty">Результат выполнения появится здесь</div>
                ) : null}
              </>
            )}
            {result?.passed && (
              <div className="feedback success solved">
                <KodaCheck />
                <div>
                  <h3>Что ты сейчас отработал</h3>
                  <div className="success-stats">
                    <span>+{result.xp_earned} XP</span>
                    <span>Попыток: {result.attempt_number}</span>
                    <span>Подсказок: {result.hints_used}</span>
                    <span>{result.execution_ms} мс</span>
                  </div>
                  <p>
                    {result.completion_summary ||
                      result.approach ||
                      e.completion_summary}
                  </p>
                  <button onClick={() => go(number + 1)}>
                    Следующая задача <ChevronRight />
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
      {theory && (
        <TheoryPanel
          article={theory}
          fullHref={`/knowledge/${e.knowledge_unit_id.replace(/^ku-/, "")}`}
          onOpenFull={() => {
            persist();
            setTheory(null);
          }}
          onClose={() => setTheory(null)}
        />
      )}
    </div>
  );
}
