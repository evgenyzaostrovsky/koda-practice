import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCheck,
  Copy,
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
  const [cheatQuery, setCheatQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const change = (value: "cheat" | "article") => {
    setMode(value);
    localStorage.setItem("koda:knowledge-mode", value);
  };
  if (isLoading || !unit)
    return <div className="empty">Загрузка материала…</div>;
  const needle = cheatQuery.trim().toLocaleLowerCase("ru");
  const cheatEntries = unit.cheatSheet.entries.filter((entry) =>
    [entry.name, entry.description, entry.group, entry.nuance, ...(entry.parameters ?? []).flatMap((item) => [item.name, item.description])]
      .join(" ")
      .toLocaleLowerCase("ru")
      .includes(needle),
  );
  const cheatGroups = Object.entries(
    cheatEntries.reduce<Record<string, typeof cheatEntries>>((result, entry) => {
      (result[entry.group] ??= []).push(entry);
      return result;
    }, {}),
  );
  const copyExample = async (id: string, example: string) => {
    await navigator.clipboard.writeText(example);
    setCopiedId(id);
    window.setTimeout(() => setCopiedId(null), 1600);
  };
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
        <div className="cheat-sheet">
          <label className="cheat-search">
            <Search />
            <input
              value={cheatQuery}
              onChange={(event) => setCheatQuery(event.target.value)}
              placeholder="Найти метод или приём"
              aria-label="Поиск по шпаргалке"
            />
          </label>
          {cheatGroups.length === 0 ? (
            <div className="knowledge-empty">В этой шпаргалке ничего не найдено.</div>
          ) : cheatGroups.map(([group, entries]) => (
            <section className="cheat-group" key={group}>
              <h2>{group}</h2>
              <div className="cheat-table" role="table" aria-label={group}>
                <div className="cheat-row cheat-head" role="row">
                  <span role="columnheader">Метод</span>
                  <span role="columnheader">Что делает</span>
                  <span role="columnheader">Пример</span>
                </div>
                {entries.map((entry) => (
                  <div className="cheat-row" role="row" key={entry.id}>
                    <div className="cheat-name" role="cell">
                      <code>{entry.name}</code>
                      {entry.documentationUrl && (
                        <a href={entry.documentationUrl} target="_blank" rel="noreferrer" aria-label={`Документация: ${entry.name}`}>
                          <ExternalLink />
                        </a>
                      )}
                    </div>
                    <div className="cheat-description" role="cell">
                      <p>{entry.description}</p>
                      {entry.parameters && entry.parameters.length > 0 && (
                        <div className="cheat-parameters">
                          <b>Параметры</b>
                          {entry.parameters.map((parameter) => (
                            <span key={parameter.name}><code>{parameter.name}</code> — {parameter.description}</span>
                          ))}
                        </div>
                      )}
                      {entry.nuance && <small>{entry.nuance}</small>}
                    </div>
                    <div className="cheat-example" role="cell">
                      <code>{entry.example}</code>
                      <button onClick={() => copyExample(entry.id, entry.example)} aria-label={`Копировать пример: ${entry.name}`}>
                        {copiedId === entry.id ? <CheckCheck /> : <Copy />}
                        <span>{copiedId === entry.id ? "Скопировано" : "Копировать"}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
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
                {section.syntax && (
                  <pre><code>{section.syntax}</code></pre>
                )}
                {section.examples.map((example) => (
                  <div className="article-example" key={example.code}>
                    <pre><code>{example.code}</code></pre>
                    <p>{example.explanation}</p>
                    <div><b>Ожидаемый результат</b><span>{example.result}</span></div>
                  </div>
                ))}
                {section.errors.length > 0 && (
                  <>
                    <h3>Типичные ошибки</h3>
                    <ul>
                      {section.errors.map((error) => (
                        <li className="article-error" key={error.wrongCode}>
                          <pre><code>{error.wrongCode}</code></pre>
                          <p>{error.why}</p>
                          <b>Исправление</b>
                          <pre><code>{error.correctCode}</code></pre>
                        </li>
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
