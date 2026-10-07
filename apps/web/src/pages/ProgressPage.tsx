import { useQuery } from "@tanstack/react-query";
import { Award, Check, Code2, Trophy } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, Header } from "../components/practice-shared";
import { progressQ } from "../queries";
export function ProgressPage() {
  const { data: p } = useQuery({ queryKey: ["progress"], queryFn: progressQ });
  return (
    <>
      <Header title="Прогресс" />
      <section className="page">
        <Link className="achievements-entry" to="/achievements">
          <Award />
          Открыть достижения
        </Link>
        <div className="stats">
          <Card
            label="Решено задач"
            value={`${p?.solved ?? 0}/${p?.total ?? 60}`}
            icon={<Check />}
          />
          <Card label="Попыток" value={p?.attempts ?? 0} icon={<Code2 />} />
          <Card label="XP" value={p?.xp ?? 0} icon={<Trophy />} />
        </div>
        <h3>Освоение модулей</h3>
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
