import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Header } from "../components/practice-shared";
import { modulesQ, progressQ } from "../queries";
import type { ExerciseMode } from "../types";
import { marketCourseQuery, marketTaskHref } from "../market-course";
export function Catalog() {
  const [search, setSearch] = useSearchParams();
  const projectView = search.get("course") === "koda-market";
  const [f, setF] = useState("all");
  const [mode, setMode] = useState<ExerciseMode | "all">("all");
  const { data: mods = [] } = useQuery({
    queryKey: ["modules"],
    queryFn: modulesQ,
  });
  const { data: p } = useQuery({ queryKey: ["progress"], queryFn: progressQ });
  const { data: course, error: courseError, isPending: courseLoading, refetch: refetchCourse } = useQuery({ ...marketCourseQuery, enabled: projectView });
  const solvedIds = new Set(p?.solved_ids ?? []);
  const lessons = course?.lessons.filter(lesson => {
    const solved = lesson.taskIds.filter(id => solvedIds.has(id)).length;
    const mastery = solved / lesson.taskIds.length * 100;
    return (mode === "all" || lesson.exercise_mode === mode) && (f === "all" || (f === "learning" && solved > 0 && solved < lesson.taskIds.length) || (f === "weak" && mastery < 50) || (f === "mastered" && solved === lesson.taskIds.length));
  }) ?? [];
  const status = new Map(p?.modules.map((x) => [x.slug, x]));
  const filtered = mods.filter(
    (m) => (mode === "all" || m.topics.some(t => t.exercises.some(e => (e.exercise_mode ?? "python") === mode))) && (
      f === "all" ||
      (f === "learning" && status.get(m.slug)?.status === "learning") ||
      (f === "weak" && (status.get(m.slug)?.mastery ?? 0) < 50) ||
      (f === "mastered" && status.get(m.slug)?.status === "mastered")),
  );
  return (
    <>
      <Header title="Найдите следующую тему" crumb="Практика" />
      <section className="page">
        <p className="lead">Python, SQL, Excel и Power BI. Выберите навык, который нужен сейчас.</p>
        <div className="filters" role="group" aria-label="Маршрут практики">
          <button className={!projectView ? "active" : ""} aria-pressed={!projectView} onClick={() => setSearch({})}>Темы и навыки</button>
          <button className={projectView ? "active" : ""} aria-pressed={projectView} onClick={() => setSearch({ course: "koda-market" })}>KODA Market — проект аналитика</button>
        </div>
        {projectView && <div><h2>{course?.title ?? "KODA Market — проект аналитика"}</h2><p>Пройдите путь аналитика на данных одного магазина: от загрузки и проверки до отчёта. Уроки сохраняют порядок проекта и используют ваш общий прогресс.</p></div>}
        <div className="filters" role="group" aria-label="Инструмент практики">
          {([["all", "Все инструменты"], ["python", "Python / pandas"], ["sql", "SQL"], ["excel", "Excel"], ["power-bi", "Power BI"]] as const).map(([value, label]) => <button key={value} className={mode === value ? "active" : ""} aria-pressed={mode === value} onClick={() => setMode(value)}>{label}</button>)}
        </div>
        <div className="filters">
          {[
            ["all", "Все"],
            ["learning", "Изучаю"],
            ["weak", "Слабые"],
            ["mastered", "Освоенные"],
          ].map((x) => (
            <button
              className={f === x[0] ? "active" : ""}
              onClick={() => setF(x[0])}
              key={x[0]}
            >
              {x[1]}
            </button>
          ))}
        </div>
        <div className="catalog">
          {projectView && courseLoading && <p role="status">Загружаем уроки проекта…</p>}
          {projectView && courseError && <div role="alert"><p>Не удалось загрузить уроки KODA Market.</p><button onClick={() => refetchCourse()}>Повторить</button></div>}
          {projectView && course && !lessons.length && <p role="status">В этом фильтре пока нет уроков. Выберите другой инструмент или статус.</p>}
          {projectView && lessons.map(lesson => {
            const solved = lesson.taskIds.filter(id => solvedIds.has(id)).length;
            const mastery = Math.round(solved / lesson.taskIds.length * 100);
            return <Link className="module-card" key={lesson.id} to={marketTaskHref(lesson.taskIds[0], lesson.id)}><small>УРОК {course!.lessons.indexOf(lesson) + 1} · {lesson.taskIds.length} ЗАДАЧ · {{python:"Python / pandas",sql:"SQL",excel:"Excel","power-bi":"Power BI"}[lesson.exercise_mode]}</small><h2>{lesson.title}</h2><p>{solved} из {lesson.taskIds.length} выполнено</p><div><div className="bar"><i style={{ width: `${mastery}%` }} /></div><b>{mastery}%</b></div></Link>;
          })}
          {!projectView && !filtered.length && <p role="status">В этом фильтре пока нет тем. Выберите другой инструмент или статус.</p>}
          {!projectView && filtered.map((m, i) => {
            const x = status.get(m.slug);
            return (
              <Link
                to={`/topics/${m.slug}`}
                className="module-card"
                key={m.slug}
              >
                <small>
                  {String(i + 1).padStart(2, "0")} ·{" "}
                  {m.topics.reduce((count, topic) => count + topic.exercises.length, 0)} ЗАДАЧИ
                </small>
                <h2>{m.title}</h2>
                <p>{m.description}</p>
                <div>
                  <div className="bar">
                    <i style={{ width: `${x?.mastery ?? 0}%` }} />
                  </div>
                  <b>{x?.mastery ?? 0}%</b>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </>
  );
}
