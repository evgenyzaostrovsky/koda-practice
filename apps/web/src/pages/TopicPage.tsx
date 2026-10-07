import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Check, CheckCircle2, ChevronLeft, ChevronRight, Circle, Flame, Play, Trophy } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { CodeBlock, Loading, QueryError } from "../components/practice-shared";
import { modulesQ, progressQ } from "../queries";
import type { Topic } from "../types";
export function TopicPage() {
  const { slug = "" } = useParams();
  const nav = useNavigate();
  const {
    data: t,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["topic", slug],
    queryFn: () => api<Topic>(`/topics/${slug}`),
  });
  const { data: p } = useQuery({ queryKey: ["progress"], queryFn: progressQ });
  const { data: mods = [] } = useQuery({
    queryKey: ["modules"],
    queryFn: modulesQ,
  });
  if(error) return <QueryError retry={() => refetch()} pending={isFetching} />;
  if(!t) return <Loading />;
  const mp = p?.modules.find((x) => x.slug === slug),
    solvedIds = new Set(mp?.solved_ids || []),
    done = solvedIds.size,
    nextIndex = t.exercises.findIndex((e) => !solvedIds.has(e.id)),
    current = nextIndex < 0 ? t.exercises.length - 1 : nextIndex,
    modIndex = mods.findIndex((x) => x.slug === slug);
  const taskNames =
    slug === "start"
      ? [
        "DataFrame из словаря",
        "Выбор порядка столбцов",
        "Проверка индекса и безопасная копия",
      ]
      : t.exercises.map((e, i) =>
        e.title.replace(/ · вариант \d+/, i === 0 ? "" : ` · шаг ${i + 1}`),
      );
  const outcomes =
    slug === "start"
      ? [
        "Создавать Series и DataFrame из структур Python",
        "Понимать разницу между копией и ссылкой",
        "Не изменять исходные данные случайно",
      ]
      : [
        `Применять ${t.syntax} в аналитических задачах`,
        "Проверять форму и тип полученного результата",
        "Сохранять преобразования без случайной потери данных",
      ];
  return (
    <>
      <div className="topic-topbar">
        <div>
          <span>pandas</span>
          <ChevronRight />
          <b>{t.title}</b>
        </div>
        <div>
          <span>
            <Flame /> Серия {p?.activity.length || 0}
          </span>
          <span>
            <Trophy /> {p?.xp || 0} XP
          </span>
        </div>
      </div>
      <main className="topic-page">
        <section className="topic-hero">
          <div className="topic-hero-main">
            <span className="topic-kicker">
              Теория · {t.exercises.length} задачи
            </span>
            <h1>{t.title}</h1>
            <p>
              {t.summary}. {t.theory}
            </p>
            <div className="topic-hero-actions">
              <button
                onClick={() => nav(`/practice/${t.exercises[current].id}`)}
              >
                <Play /> {done ? "Продолжить практику" : "Начать практику"}
              </button>
              <span>≈ {t.exercises.length * 4} минут</span>
            </div>
          </div>
          <aside className="topic-summary">
            <div>
              <span>Прогресс темы</span>
              <b>{Math.round((done / t.exercises.length) * 100)}%</b>
            </div>
            <div className="topic-hero-progress">
              <i style={{ width: `${(done / t.exercises.length) * 100}%` }} />
            </div>
            <dl>
              <div>
                <dt>Решено</dt>
                <dd>
                  {done}/{t.exercises.length}
                </dd>
              </div>
              <div>
                <dt>Доступно XP</dt>
                <dd>{t.exercises.reduce((a, e) => a + e.xp, 0)}</dd>
              </div>
            </dl>
          </aside>
        </section>
        <section className="topic-theory">
          <div className="theory-primary">
            <div className="section-heading">
              <span>01</span>
              <div>
                <h2>Ключевая идея</h2>
                <p>Синтаксис и практический пример</p>
              </div>
            </div>
            <CodeBlock label="Синтаксис" code={t.syntax} />
            <CodeBlock label="Разобранный пример" code={t.example} />
          </div>
          <div className="theory-secondary">
            <h3>Типичные ошибки</h3>
            <ul className="topic-mistakes">
              {t.mistakes.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
            <h3>Методы темы</h3>
            <div className="chips">
              {t.methods.map((x) => (
                <span key={x}>{x}</span>
              ))}
            </div>
          </div>
        </section>
        <section className="practice-route">
          <div className="route-heading">
            <div>
              <span className="topic-kicker">Практика</span>
              <h2>Маршрут по теме</h2>
            </div>
            <div>
              <span>
                {done} из {t.exercises.length}
              </span>
              <div className="route-progress">
                <i style={{ width: `${(done / t.exercises.length) * 100}%` }} />
              </div>
            </div>
          </div>
          <div className="route-list">
            {t.exercises.map((e, i) => {
              const solved = solvedIds.has(e.id),
                active = !solved && i === current;
              return (
                <Link
                  to={`/practice/${e.id}`}
                  className={`${solved ? "solved" : ""} ${active ? "active" : ""}`}
                  key={e.id}
                >
                  <div className="route-marker">
                    {solved ? <CheckCircle2 /> : <Circle />}
                  </div>
                  <div className="route-number">
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <div className="route-copy">
                    <b>{e.title}</b>
                    <span>
                      Сложность {e.difficulty} · {e.xp} XP
                    </span>
                  </div>
                  <div className="route-status">
                    {solved ? "Пройдено" : active ? "Продолжить" : "Открыть"}
                  </div>
                  <ArrowRight />
                </Link>
              );
            })}
          </div>
        </section>
        <section className="topic-outcomes">
          <div>
            <span className="topic-kicker">После этой темы вы сможете</span>
            <ul>
              {outcomes.map((x) => (
                <li key={x}>
                  <Check />
                  {x}
                </li>
              ))}
            </ul>
          </div>
          <nav>
            <Link
              className={modIndex <= 0 ? "disabled" : ""}
              to={modIndex > 0 ? `/topics/${mods[modIndex - 1].slug}` : "#"}
            >
              <ChevronLeft />
              <span>
                Предыдущая тема
                <small>
                  {modIndex > 0 ? mods[modIndex - 1].title : "Начало курса"}
                </small>
              </span>
            </Link>
            <Link
              className={
                modIndex < 0 || modIndex >= mods.length - 1 ? "disabled" : ""
              }
              to={
                modIndex >= 0 && modIndex < mods.length - 1
                  ? `/topics/${mods[modIndex + 1].slug}`
                  : "#"
              }
            >
              <span>
                Следующая тема
                <small>
                  {modIndex >= 0 && modIndex < mods.length - 1
                    ? mods[modIndex + 1].title
                    : "Конец курса"}
                </small>
              </span>
              <ChevronRight />
            </Link>
          </nav>
        </section>
      </main>
    </>
  );
}
