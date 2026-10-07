import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Check, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Header } from "../components/practice-shared";
import { progressQ } from "../queries";
export function Errors() {
  const { data: p } = useQuery({ queryKey: ["progress"], queryFn: progressQ });
  return (
    <>
      <Header title="Работа над ошибками" />
      <section className="page">
        <p className="lead">
          Здесь собраны последние неудачные попытки и задачи, которые стоит
          пройти повторно.
        </p>
        {!p?.recent_errors.length ? (
          <div className="empty big">
            <Check /> Ошибок пока нет. Отличное начало.
          </div>
        ) : (
          <div className="exercise-list">
            {p.recent_errors.map((x) => (
              <Link to={`/practice/${x.exercise_id}`} key={x.id}>
                <AlertTriangle />
                <span>
                  {x.exercise_id}
                  <small>
                    {x.error_type || "Неверный ответ"} ·{" "}
                    {new Date(x.created_at).toLocaleString("ru")}
                  </small>
                </span>
                <ChevronRight />
              </Link>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
