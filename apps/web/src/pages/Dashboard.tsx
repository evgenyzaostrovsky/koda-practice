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
      <Header title="Продолжим практику" />
      <section className="page">
        <div className="hero">
          <div>
            <span className="eyebrow">ЕЖЕДНЕВНАЯ ПРАКТИКА</span>
            <h2>Десять минут, которые закрепляют pandas</h2>
            <p>
              Короткая очередь из новой задачи, слабой темы и запланированного
              повторения.
            </p>
            <button
              onClick={() =>
                nav(lastTask ? `/practice/${lastTask}` : `/topics/${next}`)
              }
            >
              <Play /> Начать практику
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
        <h3>Прогресс обучения</h3>
        <div className="module-list">
          {p?.modules.slice(0, 6).map((m) => (
            <Link to={`/topics/${m.slug}`} className="module-row" key={m.slug}>
              <span>{m.title}</span>
              <div className="bar">
                <i style={{ width: `${m.mastery}%` }} />
              </div>
              <b>{m.mastery}%</b>
              <ChevronRight />
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
