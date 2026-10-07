import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Header } from "../components/practice-shared";
import { modulesQ, progressQ } from "../queries";
export function Catalog() {
  const [f, setF] = useState("all");
  const { data: mods = [] } = useQuery({
    queryKey: ["modules"],
    queryFn: modulesQ,
  });
  const { data: p } = useQuery({ queryKey: ["progress"], queryFn: progressQ });
  const status = new Map(p?.modules.map((x) => [x.slug, x]));
  const filtered = mods.filter(
    (m) =>
      f === "all" ||
      (f === "learning" && status.get(m.slug)?.status === "learning") ||
      (f === "weak" && (status.get(m.slug)?.mastery ?? 0) < 50) ||
      (f === "mastered" && status.get(m.slug)?.status === "mastered"),
  );
  return (
    <>
      <Header title="Найдите следующую тему" crumb="Практика" />
      <section className="page">
        <p className="lead">От первых строк Python до анализа данных. Выберите то, что нужно сейчас.</p>
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
          {filtered.map((m, i) => {
            const x = status.get(m.slug);
            return (
              <Link
                to={`/topics/${m.slug}`}
                className="module-card"
                key={m.slug}
              >
                <small>
                  {String(i + 1).padStart(2, "0")} ·{" "}
                  {m.topics[0].exercises.length} ЗАДАЧИ
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
