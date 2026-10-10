import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCheck,
  Copy,
  ExternalLink,
  Search,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { api } from "./api";
import type { KnowledgeUnit, Progress } from "./types";
import { useAuth } from "./auth";
import { modulesQ } from "./queries";
import { knowledgePractice } from "./pages/context-support";

const defaultCategories = [
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
          {progress ? `${done}/${total}` : "—"}
        </b>
      </div>
      <i>
        <span style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
      </i>
    </div>
  );
}

export function KnowledgeIndex() {
  const { user } = useAuth();
  const unitsQuery = useQuery({
    queryKey: ["knowledge"],
    queryFn: knowledgeQuery,
  });
  const { data: units = [], isLoading } = unitsQuery;
  const progressState = useQuery({
    queryKey: ["progress", user?.id ?? "anonymous"],
    queryFn: progressQuery,
  });
  const progress = progressState.data;
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState("Все");
  const categories = useMemo(
    () => [...new Set([...defaultCategories, ...units.map((unit) => unit.category)])],
    [units],
  );
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
          <small>БАЗА ЗНАНИЙ</small>
          <h1>Понимание, к которому можно вернуться</h1>
        </div>
      </header>
      <section className="knowledge-page">
        <p className="knowledge-lead">
          Короткий путь от «почему не работает» до ясного понимания.
        </p>
        {progressState.isError && <p role="status">Не удалось загрузить прогресс практики. <button onClick={() => void progressState.refetch()}>Повторить</button></p>}
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
        <div className="context-page-layout knowledge-index-context"><div className="context-main">
        {unitsQuery.isError ? <div role="alert">Не удалось загрузить материалы. <button onClick={() => void unitsQuery.refetch()}>Повторить</button></div> : isLoading ? (
          <div className="empty">Загрузка материалов…</div>
        ) : grouped.length === 0 ? (
          <div className="knowledge-empty">
            Материалы по этому запросу не найдены.
          </div>
        ) : (
          grouped.map(([group, items]) => (
            <section className="knowledge-group" key={group} id={`knowledge-category-${group}`}>
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
        )}</div><aside className="context-aside" aria-label="Навигация по базе знаний"><section className="context-card"><h2>Разделы</h2>{grouped.map(([group, items]) => <a key={group} href={`#knowledge-category-${encodeURIComponent(group)}`}>{group} · {items.length}</a>)}{!grouped.length && <p>Разделы появятся после загрузки материалов или изменения поиска.</p>}</section><section className="context-card"><h2>Под рукой</h2>{filtered.slice(0,3).map(unit => <Link key={unit.id} to={`/knowledge/${unit.slug}`}>{unit.title} →</Link>)}<p>Материалы соответствуют выбранному фильтру.</p></section></aside></div>
      </section>
    </>
  );
}

export function KnowledgeArticle() {
  const { user } = useAuth();
  const { articleSlug = "" } = useParams();
  const unitQuery = useQuery({
    queryKey: ["knowledge", articleSlug],
    queryFn: () => api<KnowledgeUnit>(`/knowledge/${articleSlug}`),
  });
  const { data: unit, isLoading } = unitQuery;
  const progress = useQuery({ queryKey: ["progress", user?.id ?? "anonymous"], queryFn: progressQuery });
  const catalog = useQuery({ queryKey: ["modules"], queryFn: modulesQ });
  const { data: units = [] } = useQuery({ queryKey: ["knowledge"], queryFn: knowledgeQuery });
  const [mode, setMode] = useState<"cheat" | "article">(() =>
    localStorage.getItem("koda:knowledge-mode") === "article"
      ? "article"
      : "cheat",
  );
  const [cheatQuery, setCheatQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeAnchor, setActiveAnchor] = useState("");
  useEffect(() => {
    if (!unit) return;
    const update = () => {
      const elements = Array.from(document.querySelectorAll<HTMLElement>(mode === "article" ? ".knowledge-reading article > section[id]" : ".cheat-group[id]"));
      const current = [...elements].reverse().find(element => element.getBoundingClientRect().top <= 150) ?? elements[0];
      setActiveAnchor(current?.id ?? "");
    };
    update(); window.addEventListener("scroll", update, true); window.addEventListener("resize", update);
    return () => { window.removeEventListener("scroll", update, true); window.removeEventListener("resize", update); };
  }, [unit, mode, cheatQuery]);
  const change = (value: "cheat" | "article") => {
    setMode(value);
    localStorage.setItem("koda:knowledge-mode", value);
  };
  if (unitQuery.isError) return <div role="alert">Не удалось загрузить материал. <button onClick={() => void unitQuery.refetch()}>Повторить</button><Link to="/knowledge">База знаний</Link></div>;
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
  const relatedUnits = units.filter(other => other.id !== unit.id && other.category === unit.category).slice(0, 3);
  const practice = progress.data && catalog.data ? knowledgePractice(unit, catalog.data, progress.data.solved_ids) : null;
  const groupAnchor = (group: string) => `cheat-group-${unit.cheatSheet.entries.find(entry => entry.group === group)!.id}`;
  const copyExample = async (id: string, example: string) => {
    await navigator.clipboard.writeText(example);
    setCopiedId(id);
    window.setTimeout(() => setCopiedId(null), 1600);
  };
  return (
    <main className={`knowledge-article-page compact-material-${mode}`}>
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
      <div className="knowledge-context-layout"><div className="knowledge-main-column">
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
            <section className="cheat-group" key={group} id={groupAnchor(group)}>
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
      </div><aside className="knowledge-context-column" aria-label="Навигация по материалу">
        <nav aria-label="Содержание"><h2>Содержание</h2>
          {mode === "article" ? unit.article.sections.map(section => <a key={section.id} href={`#${encodeURIComponent(section.id)}`} aria-current={activeAnchor === section.id ? "location" : undefined}>{section.title}</a>) : cheatGroups.length ? cheatGroups.map(([group]) => <a key={group} href={`#${encodeURIComponent(groupAnchor(group))}`} aria-current={activeAnchor === groupAnchor(group) ? "location" : undefined}>{group}</a>) : <p>Нет разделов по этому запросу.</p>}
        </nav>
        {relatedUnits.length > 0 && <section><h2>Материалы раздела</h2><small>{unit.category}</small>{relatedUnits.map(other => <Link key={other.id} to={`/knowledge/${other.slug}`}>{other.title}</Link>)}</section>}
        <section className="context-practice"><h2>Закрепить практикой</h2>{progress.isError || catalog.isError ? <><p>Не удалось загрузить задачи.</p><button onClick={() => { void progress.refetch(); void catalog.refetch(); }}>Повторить</button></> : !progress.data || !catalog.data ? <p role="status">Загрузка задач…</p> : practice ? <><p>{practice.task.title}</p><small>{practice.task.learning_objective}</small><Link to={`/practice/${practice.task.id}`}>{practice.repeat ? "Повторить задачу" : "Начать задачу"} →</Link><Link to={`/topics/${practice.topic.slug}`}>Все задачи темы →</Link></> : <p>В действующем каталоге нет связанных задач.</p>}</section>
      </aside></div>
    </main>
  );
}
