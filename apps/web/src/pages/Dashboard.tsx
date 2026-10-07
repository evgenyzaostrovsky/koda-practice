import { useQuery } from "@tanstack/react-query";
import { Check, ChevronRight, Code2, Play, RotateCcw } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Card, Header } from "../components/practice-shared";
import { progressQ } from "../queries";
import { loadLastTask } from "../task-storage";
export function Dashboard() {
  const nav = useNavigate();
  const { data: p } = useQuery({ queryKey: ["progress"], queryFn: progressQ });
  const next = p?.modules.find((m) => m.solved < m.total)?.slug || "start",
    lastTask = loadLastTask();
  return (
    <>
      <Header title="Ваш следующий шаг" />
      <section className="page">
        <div className="hero">
          <div>
            <span className="eyebrow">ПРОДОЛЖИТЬ ОБУЧЕНИЕ</span>
            <h2>От таблицы — к нужным данным</h2>
            <p>Вы уже умеете читать CSV. Следующий шаг — выбрать столбцы для анализа.</p>
            <button
              onClick={() =>
                nav(lastTask ? `/practice/${lastTask}` : `/topics/${next}`)
              }
            >
              <Play /> Продолжить практику →
            </button>
          </div>
          <div className="ring">
            <b>{p?.solved ?? 0}</b>
            <small>из {p?.total ?? 60}</small>
          </div>
        </div>
        <div className="stats">
          <Card label="К повторению" value={p?.due ?? 0} icon={<RotateCcw />} />
          <Card
            label="Точность с первого раза"
            value={`${p?.first_try_accuracy ?? 0}%`}
            icon={<Check />}
          />
          <Card
            label="Самостоятельно"
            value={`${p?.independent_rate ?? 0}%`}
            icon={<Code2 />}
          />
        </div>
        <div className="compact-section-head"><h2>Ваш маршрут</h2><Link to="/catalog">Все темы →</Link></div>
        <div className="compact-module-grid">
          {p?.modules.slice(0, 6).map((m, index) => (
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
      </section>
    </>
  );
}
