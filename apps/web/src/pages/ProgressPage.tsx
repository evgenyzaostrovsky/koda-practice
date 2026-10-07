import { useQuery } from "@tanstack/react-query";
import { Check, Code2, Trophy } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, Header } from "../components/practice-shared";
import { progressQ } from "../queries";
export function ProgressPage() {
  const { data: p } = useQuery({ queryKey: ["progress"], queryFn: progressQ });
  return (
    <>
      <Header title="Видно, как растёт уверенность" crumb="Ваше обучение" />
      <section className="page">
        <p className="lead">Каждая решённая задача — ещё один навык, который можно применить.</p>
        <div className="stats">
          <Card
            label="Решено задач"
            value={`${p?.solved ?? 0}/${p?.total ?? 60}`}
            icon={<Check />}
          />
          <Card label="Попыток" value={p?.attempts ?? 0} icon={<Code2 />} />
          <Card label="XP" value={p?.xp ?? 0} icon={<Trophy />} />
        </div>
        <h2>Практика за неделю</h2>
        <div className="compact-week-card"><div className="compact-week-chart">{Array.from({length:7}, (_, i) => { const day = new Date(); day.setDate(day.getDate() - 6 + i); const count = p?.activity.find(a => a.day === day.toISOString().slice(0,10))?.solved ?? 0; const maximum = Math.max(1, ...(p?.activity.map(a => a.solved) ?? [])); return <div key={i}><span title={`${count} решённых задач`} style={{height: `${Math.max(2, count / maximum * 120)}px`}}/><small>{day.toLocaleDateString("ru", {weekday:"short"})}</small></div>; })}</div></div>
        <h2>Прогресс по темам</h2>
        <div className="module-list">
          {p?.modules.map((m) => (
            <Link to={`/topics/${m.slug}`} className="module-row" key={m.slug}>
              <span>
                {m.title}
                <small>
                  {m.solved} из {m.total}
                </small>
              </span>
              <div className="bar">
                <i style={{ width: `${m.mastery}%` }} />
              </div>
              <b>{m.mastery}%</b>
            </Link>
          ))}
        </div>
        <h3>Активность</h3>
        <div className="activity">
          {Array.from({ length: 28 }, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - 27 + i);
            const x = p?.activity.find(
              (a) => a.day === d.toISOString().slice(0, 10),
            );
            return (
              <span
                key={i}
                title={`${d.toLocaleDateString("ru")}: ${x?.attempts || 0}`}
                className={x?.attempts ? "hot" : ""}
              />
            );
          })}
        </div>
      </section>
    </>
  );
}
