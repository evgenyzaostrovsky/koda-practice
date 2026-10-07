import { useEffect, useRef, useState } from "react";
import { ArrowRight, BookOpen, Check, ChevronRight, Code2, Home, Lightbulb, Menu, Play, RotateCcw, Search, TrendingUp, X } from "lucide-react";
import catalogText from "../../../../content/catalog.json?raw";

type Task = { id: string; title: string; instructions: string; starter_code: string; setup_code: string; difficulty: number; hints: { text: string }[] };
type Topic = { slug: string; title: string; exercises: Task[] };
const topics = (JSON.parse(catalogText) as { modules: { topics: Topic[] }[] }).modules.flatMap(module => module.topics);
const navigation = [{ id: "overview", label: "Обзор", icon: Home }, { id: "practice", label: "Практика", icon: Code2 }, { id: "catalog", label: "Каталог", icon: BookOpen }, { id: "progress", label: "Прогресс", icon: TrendingUp }] as const;
type Screen = typeof navigation[number]["id"];

export function DesignPrototype() {
  const [screen, setScreen] = useState<Screen>("overview");
  const [menu, setMenu] = useState(false);
  const [task, setTask] = useState(topics[0].exercises[0]);
  const [code, setCode] = useState(task.starter_code);
  const [hints, setHints] = useState(0);
  const [output, setOutput] = useState<"idle" | "run" | "check">("idle");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const trigger = useRef<HTMLButtonElement>(null);
  const drawer = useRef<HTMLElement>(null);
  const close = () => { setMenu(false); requestAnimationFrame(() => trigger.current?.focus()); };
  const changeScreen = (next: Screen) => { setScreen(next); if (menu) close(); };
  const selectTask = (next: Task) => { setTask(next); setCode(next.starter_code); setHints(0); setOutput("idle"); changeScreen("practice"); };
  const selectedTopic = topics.find(topic => topic.exercises.some(item => item.id === task.id))!;
  const count = topics.reduce((sum, topic) => sum + topic.exercises.length, 0);
  useEffect(() => {
    if (!menu) return;
    drawer.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); close(); }
      if (event.key === "Tab") {
        const buttons = drawer.current?.querySelectorAll<HTMLButtonElement>("button");
        if (!buttons?.length) return;
        const first = buttons[0], last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", keyboard);
    return () => document.removeEventListener("keydown", keyboard);
  }, [menu]);
  const visibleTopics = topics.filter(topic => (filter === "all" || topic.slug === filter) && (topic.title + topic.exercises.map(item => item.title).join(" ")).toLowerCase().includes(search.toLowerCase()));
  return <div className="koda-demo">
    {menu && <button className="kd-overlay" onClick={close} aria-label="Закрыть меню навигации" tabIndex={-1} />}
    <aside ref={drawer} className={`kd-sidebar ${menu ? "kd-open" : ""}`} aria-label="Навигация прототипа">
      <div className="kd-brand"><span>K</span><div><strong>KODA</strong><small>Practice</small></div><button className="kd-close" onClick={close} aria-label="Закрыть меню"><X size={20} /></button></div>
      <nav>{navigation.map(({ id, label, icon: Icon }) => <button key={id} aria-current={screen === id ? "page" : undefined} onClick={() => changeScreen(id)}><Icon size={19} />{label}</button>)}</nav>
      <div className="kd-sidebar-note"><span className="kd-dot" /> Пространство для практики<small>Python и pandas</small></div>
    </aside>
    <main className="kd-main" inert={menu ? true : undefined}>
      <header className="kd-top"><button ref={trigger} className="kd-menu" onClick={() => setMenu(true)} aria-label="Открыть меню" aria-expanded={menu}><Menu size={21} /></button><span>Рабочее пространство</span><span className="kd-demo-label">Демо · без сохранения</span></header>
      <div className="kd-body">
        <div className="kd-heading"><div><p className="kd-eyebrow">KODA PRACTICE</p><h1>{navigation.find(item => item.id === screen)!.label}</h1></div><span className="kd-caption">{screen === "practice" ? selectedTopic.title : "Учимся работать с данными"}</span></div>
        {screen === "overview" && <>
          <section className="kd-resume"><div><span className="kd-tag">Следующий шаг</span><h2>{task.title}</h2><p>{selectedTopic.title} · Задача {selectedTopic.exercises.findIndex(item => item.id === task.id) + 1} из {selectedTopic.exercises.length}</p><button className="kd-primary" onClick={() => changeScreen("practice")}>Продолжить задачу <ArrowRight size={17} /></button></div><div className="kd-resume-symbol"><Code2 size={48} strokeWidth={1.3} /><span>Python / pandas</span></div></section>
          <div className="kd-metrics"><div><small>Решено в демо</small><strong>0 <span>/ {count}</span></strong><p>Проверка здесь не оценивает код</p></div><div><small>Темы в каталоге</small><strong>{topics.length}</strong><p>От основ к работе с данными</p></div><div><small>Текущая тема</small><strong className="kd-metric-title">{selectedTopic.title}</strong><p>{selectedTopic.exercises.length} практических задач</p></div></div>
          <div className="kd-section-title"><h2>Темы для практики</h2><button className="kd-text-button" onClick={() => changeScreen("catalog")}>Весь каталог <ArrowRight size={16} /></button></div>
          <div className="kd-topic-list">{topics.slice(0, 5).map((topic, index) => <button key={topic.slug} onClick={() => { setFilter(topic.slug); changeScreen("catalog"); }}><span className="kd-topic-index">{String(index + 1).padStart(2, "0")}</span><span><strong>{topic.title}</strong><small>{topic.exercises.length} задач · pandas</small></span><ChevronRight size={18} /></button>)}</div>
        </>}
        {screen === "practice" && <>
          <div className="kd-practice"><section className="kd-panel kd-problem"><div className="kd-task-meta"><span className="kd-tag">{task.id}</span><span>Уровень {task.difficulty}</span></div><h2>{task.title}</h2><p className="kd-instructions">{task.instructions}</p><h3>Исходные данные</h3><pre className="kd-data">{task.setup_code}</pre><div className="kd-help"><h3><Lightbulb size={18} /> Подсказки</h3><p>Открывайте по одной, когда нужна опора.</p>{task.hints.slice(0, hints).map((hint, index) => <div className="kd-hint" key={index}><strong>Подсказка {index + 1}</strong><p>{hint.text}</p></div>)}<button className="kd-secondary" disabled={hints >= task.hints.length} onClick={() => setHints(value => value + 1)}>{hints >= task.hints.length ? "Все подсказки открыты" : `Открыть подсказку ${hints + 1}`}</button></div></section>
          <section className="kd-panel kd-work"><div className="kd-editor-heading"><strong>solution.py</strong><span>Редактор демо</span></div><label className="kd-editor-label" htmlFor="demo-code">Код решения</label><textarea id="demo-code" spellCheck={false} value={code} onChange={event => { setCode(event.target.value); setOutput("idle"); }} /><div className="kd-actions"><button className="kd-reset" onClick={() => { setCode(task.starter_code); setOutput("idle"); setHints(0); }}><RotateCcw size={16} /> Сбросить</button><button className="kd-secondary" onClick={() => setOutput("run")}><Play size={16} /> Запустить</button><button className="kd-primary" onClick={() => setOutput("check")}><Check size={16} /> Проверить</button></div><div className={`kd-output kd-output-${output}`} role="status" aria-live="polite"><h3>{output === "idle" ? "Результат" : output === "run" ? "Вывод запуска" : "Проверка решения"}</h3><p>{output === "idle" ? "Запустите код, чтобы посмотреть состояние вывода." : output === "run" ? `Демонстрация запуска: редактор содержит ${code.split("\n").length} строк. Python в этом макете не выполняется.` : "Демонстрация проверки: правильность решения не оценивалась. Прогресс не изменён."}</p>{output !== "idle" && <span className="kd-tag">Локальное демо</span>}</div><p className="kd-work-note">Изменения живут только на этой странице и исчезнут после обновления.</p></section></div>
        </>}
        {screen === "catalog" && <>
          <div className="kd-filters"><label><Search size={18} /><input aria-label="Поиск по каталогу" placeholder="Найти тему или задачу" value={search} onChange={event => setSearch(event.target.value)} /></label><select aria-label="Фильтр по теме" value={filter} onChange={event => setFilter(event.target.value)}><option value="all">Все темы</option>{topics.map(topic => <option key={topic.slug} value={topic.slug}>{topic.title}</option>)}</select></div>
          <p className="kd-caption">{visibleTopics.length} тем · материалы из существующего каталога</p>
          <div className="kd-catalog">{visibleTopics.map(topic => <section className="kd-panel" key={topic.slug}><div className="kd-catalog-head"><BookOpen size={20} /><h2>{topic.title}</h2><span>{topic.exercises.length} задач</span></div>{topic.exercises.filter(item => topic.title.toLowerCase().includes(search.toLowerCase()) || item.title.toLowerCase().includes(search.toLowerCase())).map((item, index) => <button className="kd-task-row" key={item.id} onClick={() => selectTask(item)}><span className="kd-topic-index">{index + 1}</span><span><strong>{item.title}</strong><small>Уровень {item.difficulty} · {item.id}</small></span><ChevronRight size={17} /></button>)}</section>)}</div>{visibleTopics.length === 0 && <div className="kd-panel kd-empty">Ничего не найдено. Попробуйте другой запрос.</div>}
        </>}
        {screen === "progress" && <><section className="kd-panel kd-progress-summary"><div><p className="kd-eyebrow">РЕШЁННЫЕ ЗАДАЧИ</p><strong>0 <span>из {count}</span></strong><h2>Прогресс начинается с практики</h2><p>В этом макете нет реальных попыток. Нажатие «Проверить» показывает состояние интерфейса и не засчитывает задачу.</p></div><button className="kd-primary" onClick={() => changeScreen("practice")}>К практике <ArrowRight size={17} /></button></section><div className="kd-section-title"><h2>По темам</h2><span className="kd-caption">Демонстрационные значения</span></div><div className="kd-topic-list">{topics.map(topic => <button key={topic.slug} onClick={() => { setFilter(topic.slug); changeScreen("catalog"); }}><BookOpen size={19} /><span><strong>{topic.title}</strong><small>0 из {topic.exercises.length} задач решено</small></span><span className="kd-zero">0%</span><ChevronRight size={17} /></button>)}</div></>}
      </div>
    </main>
  </div>;
}
