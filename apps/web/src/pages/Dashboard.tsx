import { useEffect, useState } from "react";
import { useMeasuredStudyTotals } from "../StudySessionControl";
import { formatStudyDuration } from "../study-time";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { modulesQ, progressQ } from "../queries";
import { HomeSupportColumn } from "./HomeSupportColumn";
import { selectHomeContinuation } from "./home-support";
import { loadTaskState, loadLastTask } from "../task-storage";
export function Dashboard() {
  const time=useMeasuredStudyTotals();
  const nav = useNavigate();
  const { user } = useAuth();
  const name = user?.user_metadata?.display_name || user?.email?.split("@")[0];
  const { data: p } = useQuery({ queryKey: ["progress", user?.id ?? "anonymous"], queryFn: progressQ });
  const catalog = useQuery({ queryKey: ["modules"], queryFn: modulesQ });
  const ownerId = user?.id ?? null;
  const [localContinuation, setLocalContinuation] = useState<{ ownerId: string | null; taskId: string | null; completed: boolean } | null>(null);
  useEffect(() => {
    let active = true;
    const refresh = () => queueMicrotask(() => {
      if (!active) return;
      const taskId = loadLastTask();
      setLocalContinuation({ ownerId, taskId, completed: Boolean(taskId && loadTaskState(taskId)?.status === "completed") });
    });
    refresh();
    window.addEventListener("koda-study-account-changed", refresh);
    return () => { active = false; window.removeEventListener("koda-study-account-changed", refresh); };
  }, [ownerId]);
  const currentLocal = localContinuation?.ownerId === ownerId ? localContinuation : null;
  const lastTask = currentLocal?.taskId ?? null;
  const solvedIds = [...(p?.solved_ids ?? [])];
  if (lastTask && currentLocal?.completed) solvedIds.push(lastTask);
  const continuation = selectHomeContinuation(catalog.data ?? [], lastTask, solvedIds);
  const destination = continuation ? `/practice/${continuation.task.id}` : "/catalog";
  return (
    <>

      <section className="page dashboard-mockup"><div className="dashboard-context-layout"><div className="dashboard-main-column">
        <div className="dashboard-greeting"><p className="eyebrow">ВАШ СЛЕДУЮЩИЙ ШАГ</p><h1>Рады видеть вас{name ? `, ${name}` : ""}</h1><p className="lead">Немного практики сегодня — больше уверенности завтра.</p></div>
        <div className="hero">
          <div>
            <span className="eyebrow">ПРОДОЛЖИТЬ ОБУЧЕНИЕ</span>
            <h2>{continuation?.task.title || (catalog.isPending ? "Загрузка следующего шага…" : "Выберите следующую тему")}</h2>
            <p>{continuation?.task.learning_objective || "Выберите тему и попробуйте одну задачу. К материалам можно вернуться в любое время."}</p>
            <button
              onClick={() =>
                nav(destination)
              }
            >
              {continuation ? "Продолжить практику →" : "Открыть каталог →"}
            </button>
            <div className="dashboard-meta">{continuation?.topic.title || "Каталог тем"}</div>
          </div>
          <svg className="hero-art" viewBox="0 0 160 130" fill="none" aria-hidden="true"><circle cx="80" cy="65" r="54" stroke="currentColor" opacity=".12"/><circle cx="80" cy="65" r="38" stroke="currentColor" opacity=".2"/><path d="M18 65C40 12 48 118 72 65S103 12 127 65" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/><circle cx="140" cy="65" r="3" fill="currentColor"/><path d="M45 108h70" stroke="currentColor" opacity=".2"/></svg>
        </div>
        <div className="stats"><div className="stat"><strong>{p?.solved ?? 0}</strong><span>задачи решены</span></div><div className="stat"><strong>{formatStudyDuration(time.totalSeconds)}</strong><span>время занятий · по таймеру</span></div><div className="stat"><strong>{p?.modules.filter(m => m.total > 0 && m.solved === m.total).length ?? 0} из {p?.modules.filter(m => m.total > 0).length ?? 0}</strong><span>темы освоены</span></div></div>
        <div className="compact-section-head"><h2>Ваши темы</h2><Link to="/catalog">Все темы →</Link></div>
        <div className="compact-module-grid">
          {p?.modules.slice(0, 2).map((m, index) => (
            <Link to={`/topics/${m.slug}`} className="compact-module-card" key={m.slug}>
              <small>{String(index + 1).padStart(2, "0")} · {m.solved} / {m.total} задач</small>
              <h3>{m.title}</h3>
              <div className="bar"><i style={{ width: `${m.mastery}%` }} /></div>
              <div className="compact-module-footer"><span>{m.mastery}% освоено</span><ChevronRight /></div>
            </Link>
          ))}
        </div>
        <div className="compact-section-head"><h2>Под рукой</h2></div>
        <div className="compact-tool-links"><Link to="/knowledge">База знаний →</Link><Link to="/sandbox">Песочница →</Link><Link to="/errors">Разбор ошибок →</Link></div>
      </div><HomeSupportColumn continuation={continuation}/></div></section>
    </>
  );
}

