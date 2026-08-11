import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ExternalLink,
  Search,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { api } from "./api";
import type { KnowledgeUnit, Progress } from "./types";

const categories = [
  "Все",
  "Python",
  "pandas",
  "NumPy",
  "Matplotlib",
  "Seaborn",
];
const knowledgeQuery = () => api<KnowledgeUnit[]>("/knowledge");
const progressQuery = () => api<Progress>("/progress");

function UnitProgress({
  unit,
  progress,
}: {
  unit: KnowledgeUnit;
  progress?: Progress;
}) {
  const solved = new Set(progress?.solved_ids || []),
    done = unit.relatedTaskIds.filter((id) => solved.has(id)).length,
    total = unit.relatedTaskIds.length;
  return (
    <div className="knowledge-progress">
      <div>
        <span>Практика</span>
        <b>
          {done}/{total}
        </b>
      </div>
      <i>
        <span style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
      </i>
    </div>
  );
}

export function KnowledgeIndex() {
  const { data: units = [], isLoading } = useQuery({
    queryKey: ["knowledge"],
    queryFn: knowledgeQuery,
  });
  const { data: progress } = useQuery({
    queryKey: ["progress"],
    queryFn: progressQuery,
  });
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState("Все");
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("ru");
    return units.filter(
      (unit) =>
        (category === "Все" || unit.category === category) &&
        (!needle ||
          [
            unit.title,
            unit.description,
            ...unit.keywords,
            ...unit.methods,
            ...unit.functions,
            ...unit.attributes,
          ]
            .join(" ")
            .toLocaleLowerCase("ru")
            .includes(needle)),
    );
  }, [units, query, category]);
  const grouped = useMemo(
    () =>
      Object.entries(
        filtered.reduce<Record<string, KnowledgeUnit[]>>((result, unit) => {
          (result[unit.category] ??= []).push(unit);
          return result;
        }, {}),
      ),
    [filtered],
  );
  return (
    <>
      <header className="knowledge-header">
        <div>
          <small>СПРАВОЧНИК И УЧЕБНЫЕ МАТЕРИАЛЫ</small>
          <h1>База знаний</h1>
        </div>
      </header>
      <section className="knowledge-page">
        <p className="knowledge-lead">
          Читайте подробные материалы, быстро повторяйте синтаксис и переходите
          к связанным задачам.
        </p>
        <div className="knowledge-controls">
          <label>
            <Search />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Тема, метод, функция или ключевое слово"
            />
          </label>
          <div className="knowledge-filters">
            {categories.map((item) => (
              <button
                key={item}
                className={category === item ? "active" : ""}
                onClick={() => setCategory(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
        {isLoading ? (
          <div className="empty">Загрузка материалов…</div>
        ) : grouped.length === 0 ? (
          <div className="knowledge-empty">
            Материалы по этому запросу не найдены.
          </div>
        ) : (
          grouped.map(([group, items]) => (
            <section className="knowledge-group" key={group}>
              <div className="knowledge-group-title">
                <h2>{group}</h2>
                <span>{items.length} материалов</span>
              </div>
              <div className="knowledge-grid">
                {items.map((unit) => (
                  <article className="knowledge-card" key={unit.id}>
                    <div>
                      <span>{unit.category}</span>
                      <small>Базовый → продвинутый</small>
                    </div>
                    <h3>{unit.title}</h3>
                    <p>{unit.description}</p>
                    <div className="knowledge-tags">
                      {[...unit.methods, ...unit.functions, ...unit.attributes]
                        .slice(0, 5)
                        .map((item) => (
                          <code key={item}>{item}</code>
                        ))}
                    </div>
                    <UnitProgress unit={unit} progress={progress} />
                    <footer>
                      <span>{unit.relatedTaskIds.length} связанных задач</span>
                      <Link to={`/knowledge/${unit.slug}`}>
                        Открыть <ArrowRight />
                      </Link>
                    </footer>
                  </article>
                ))}
              </div>
            </section>
          ))
        )}
      </section>
    </>
  );
}

export function KnowledgeArticle() {
  const { articleSlug = "" } = useParams();
  const { data: unit, isLoading } = useQuery({
    queryKey: ["knowledge", articleSlug],
    queryFn: () => api<KnowledgeUnit>(`/knowledge/${articleSlug}`),
  });
  const [mode, setMode] = useState<"cheat" | "article">(() =>
    localStorage.getItem("koda:knowledge-mode") === "article"
      ? "article"
      : "cheat",
  );
  const change = (value: "cheat" | "article") => {
    setMode(value);
    localStorage.setItem("koda:knowledge-mode", value);
  };
  if (isLoading || !unit)
    return <div className="empty">Загрузка материала…</div>;
  return (
    <main className="knowledge-article-page">
      <div className="knowledge-breadcrumbs">
        <Link to="/knowledge">
          <ArrowLeft /> База знаний
        </Link>
        <span>/</span>
        <b>{unit.title}</b>
      </div>
      <header className="knowledge-article-head">
        <span>{unit.category}</span>
        <h1>{unit.title}</h1>
        <p>{unit.description}</p>
        <div>
          <span>{unit.relatedTaskIds.length} задач</span>
          <span>Версия {unit.version}</span>
        </div>
      </header>
      <div className="knowledge-mode">
        <button
          className={mode === "cheat" ? "active" : ""}
          onClick={() => change("cheat")}
        >
          Шпаргалка
        </button>
        <button
          className={mode === "article" ? "active" : ""}
          onClick={() => change("article")}
        >
          Статья
        </button>
      </div>
      {mode === "cheat" ? (
        <div className="knowledge-reading">
          <aside>
            <b>Содержание</b>
            {unit.cheatSheet.items.map((item) => (
              <a href={`#${item.id}`} key={item.id}>
                {item.name}
              </a>
            ))}
          </aside>
          <article>
            <p className="reading-lead">{unit.cheatSheet.summary}</p>
            {unit.cheatSheet.items.map((item) => (
              <section id={item.id} key={item.id}>
                <h2>{item.name}</h2>
                <p>{item.description}</p>
                <pre>
                  <code>{item.syntax}</code>
                </pre>
                <h3>Пример</h3>
                <pre>
                  <code>{item.example}</code>
                </pre>
                {item.parameters.length > 0 && (
                  <>
                    <h3>Параметры</h3>
                    <dl>
                      {item.parameters.map((param) => (
                        <div key={param.name}>
                          <dt>
                            <code>{param.name}</code>
                          </dt>
                          <dd>{param.description}</dd>
                        </div>
                      ))}
                    </dl>
                  </>
                )}
                <p>{item.result}</p>
                {[...item.errors, ...item.nuances].length > 0 && (
                  <ul>
                    {[...item.errors, ...item.nuances].map((note) => (
                      <li key={note}>{note}</li>
                    ))}
                  </ul>
                )}
                <a
                  className="knowledge-doc"
                  href={item.documentationUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Официальная документация <ExternalLink />
                </a>
              </section>
            ))}
          </article>
        </div>
      ) : (
        <div className="knowledge-reading">
          <aside>
            <b>Содержание</b>
            {unit.article.sections.map((section) => (
              <a href={`#${section.id}`} key={section.id}>
                {section.title}
              </a>
            ))}
          </aside>
          <article>
            <p className="reading-lead">{unit.article.lead}</p>
            {unit.article.sections.map((section) => (
              <section id={section.id} key={section.id}>
                <h2>{section.title}</h2>
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
                <pre>
                  <code>{section.syntax}</code>
                </pre>
                {section.examples.map((example) => (
                  <pre key={example}>
                    <code>{example}</code>
                  </pre>
                ))}
                {section.errors.length > 0 && (
                  <>
                    <h3>Типичные ошибки</h3>
                    <ul>
                      {section.errors.map((error) => (
                        <li key={error}>{error}</li>
                      ))}
                    </ul>
                  </>
                )}
                {section.nuances.length > 0 && (
                  <>
                    <h3>Практические нюансы</h3>
                    <ul>
                      {section.nuances.map((note) => (
                        <li key={note}>{note}</li>
                      ))}
                    </ul>
                  </>
                )}
              </section>
            ))}
            <div className="article-summary">
              <Check />
              <p>{unit.article.summary}</p>
            </div>
          </article>
        </div>
      )}
      <div className="knowledge-practice">
        <div>
          <BookOpen />
          <span>
            <b>Закрепите материал практикой</b>
            <small>{unit.relatedTaskIds.length} заданий по теме</small>
          </span>
        </div>
        <Link to={`/topics/${unit.slug}`}>
          Перейти к практике <ArrowRight />
        </Link>
      </div>
    </main>
  );
}
