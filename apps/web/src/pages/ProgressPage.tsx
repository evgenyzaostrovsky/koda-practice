import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Code2, Trophy } from "lucide-react";
import { useAuth } from "../auth";
import { Card, Header } from "../components/practice-shared";
import { modulesQ, progressQ } from "../queries";
import { formatStudyDuration, studyTotals } from "../study-time";
import { selectHomeContinuation } from "./home-support";
import { nearestAchievement } from "./context-support";
import { useAchievementEvidence } from "./useAchievementEvidence";
import { getCachedAchievementManifest, loadAchievementManifest } from "../achievements/manifest";
import { AchievementArt } from "../achievements/AchievementArt";
import { loadLastTask, loadTaskState } from "../task-storage";

export function ProgressPage() {
  const { user } = useAuth();
  const ownerId = user?.id ?? null;
  const [expandedFor, setExpandedFor] = useState<{ ownerId: string | null; expanded: boolean }>({ ownerId, expanded: false });
  const showAllTopics = expandedFor.ownerId === ownerId && expandedFor.expanded;
  useEffect(() => { setExpandedFor({ ownerId, expanded: false }); }, [ownerId]);
  const [local, setLocal] = useState<{ ownerId: string | null; taskId: string | null; completed: boolean } | null>(null);
  useEffect(() => {
    let active = true, mismatch = false;
    const refresh = () => queueMicrotask(() => {
      if (!active || mismatch) return;
      const taskId = loadLastTask();
      setLocal({ ownerId, taskId, completed: Boolean(taskId && loadTaskState(taskId)?.status === "completed") });
    });
    const changed = (event: Event) => {
      mismatch = (event as CustomEvent<string | null>).detail !== ownerId;
      if (mismatch) setLocal(null); else refresh();
    };
    refresh(); window.addEventListener("koda-study-account-changed", changed);
    return () => { active = false; window.removeEventListener("koda-study-account-changed", changed); };
  }, [ownerId]);
  const progress = useQuery({ queryKey: ["progress", user?.id ?? "anonymous"], queryFn: progressQ });
  const catalog = useQuery({ queryKey: ["modules"], queryFn: modulesQ });
  const manifest = useQuery({ queryKey: ["achievement-manifest"], queryFn: loadAchievementManifest, initialData: getCachedAchievementManifest() ?? undefined, staleTime: Infinity });
  const snapshot = useAchievementEvidence();
  const time = snapshot ? studyTotals(snapshot.events) : null;
  const p = progress.data;
  const activeTopics = p?.modules.filter(module => module.total > 0) ?? [];
  const currentLocal = local?.ownerId === ownerId ? local : null;
  const solvedIds = [...(p?.solved_ids ?? [])];
  if (currentLocal?.taskId && currentLocal.completed) solvedIds.push(currentLocal.taskId);
  const next = p && catalog.data && currentLocal ? selectHomeContinuation(catalog.data, currentLocal.taskId, solvedIds) : null;
  const nextTopicProgress = next && p ? p.modules.find(item => item.slug === next.topic.slug) : null;
  const repeat = !next && p && catalog.data && currentLocal ? catalog.data.flatMap(module => module.topics.flatMap(topic => topic.exercises.map(task => ({ task, topic })) ))[0] : null;
  const award = snapshot && manifest.data ? nearestAchievement(manifest.data, snapshot) : null;
  const days = Array.from({ length: 7 }, (_, i) => { const day = new Date(); day.setDate(day.getDate() - 6 + i); const key = `${day.getFullYear()}-${String(day.getMonth()+1).padStart(2,"0")}-${String(day.getDate()).padStart(2,"0")}`; return { day, key, seconds: time?.daily[key] ?? 0 }; });
  const maximum = Math.max(1, ...days.map(day => day.seconds));
  return <><Header title="Видно, как растёт уверенность" crumb="Ваше обучение" /><section className="page progress-context-page"><div className="context-page-layout"><div className="context-main">
    <p className="lead">Решённые задачи и измеренное время занятий.</p>
    {progress.isError ? <div role="alert">Не удалось загрузить прогресс. <button onClick={() => void progress.refetch()}>Повторить</button></div> : !p ? <p role="status">Загрузка прогресса…</p> : <>
      <div className="stats"><Card label="Решено задач" value={`${p.solved} / ${p.total}`} icon={<Check/>}/><Card label="Попыток" value={p.attempts} icon={<Code2/>}/><Card label="XP" value={p.xp} icon={<Trophy/>}/></div>

    </>}
    <h2>Время занятий · по таймеру</h2>{!time ? <p role="status">Загрузка времени…</p> : <><div className="study-time-summary"><div><strong>{formatStudyDuration(time.totalSeconds)}</strong><span>Всего</span></div><div><strong>{formatStudyDuration(time.todaySeconds)}</strong><span>Сегодня</span></div><div><strong>{formatStudyDuration(time.weekSeconds)}</strong><span>За последние 7 дней</span></div></div><div className="compact-week-card"><h3>Занятия за неделю</h3><div className="compact-week-chart" aria-label="Измеренное время занятий за семь дней">{days.map(({day,key,seconds}) => <div key={key}><span title={`${day.toLocaleDateString("ru-RU")}: ${formatStudyDuration(seconds)}`} style={{height:`${seconds ? Math.max(3,seconds/maximum*120) : 0}px`}}/><small>{day.toLocaleDateString("ru",{weekday:"short"})}</small><small>{formatStudyDuration(seconds)}</small></div>)}</div>{time.weekSeconds === 0 && <p>Записанных занятий за эту неделю пока нет. Запустите таймер, когда начнёте заниматься.</p>}</div></>}

    {p && !progress.isError && <>
      <h2>Прогресс по темам</h2><p>{p.modules.filter(m => m.total > 0 && m.solved === m.total).length} из {p.modules.filter(m => m.total > 0).length} тем: все задачи решены.</p>
      <div className="module-list">{(showAllTopics ? activeTopics : activeTopics.slice(0,6)).map(m => <Link to={`/topics/${m.slug}`} className="module-row" key={m.slug}><span>{m.title}<small>{m.solved} из {m.total} задач</small></span><div className="bar"><i style={{width:`${Math.min(100,m.solved/m.total*100)}%`}}/></div><b>{Math.round(m.solved/m.total*100)}%</b></Link>)}</div>
      {activeTopics.length > 6 && <button className="secondary" aria-expanded={showAllTopics} onClick={() => setExpandedFor({ ownerId, expanded: !showAllTopics })}>{showAllTopics ? 'Свернуть темы' : `Показать все темы (${activeTopics.length})`}</button>}
    </>}
  </div><aside className="context-aside" aria-label="Следующие шаги"><section className="context-card"><h2>Следующий шаг</h2>{progress.isError || catalog.isError ? <><p>Не удалось определить следующую задачу.</p><button onClick={() => { void progress.refetch(); void catalog.refetch(); }}>Повторить</button></> : !p || !catalog.data || !currentLocal ? <p role="status">Загрузка задач…</p> : next ? <><small>{next.topic.title}</small>{nextTopicProgress && <p>{nextTopicProgress.solved} из {nextTopicProgress.total} задач темы решено.</p>}<h3>{next.task.title}</h3><p>{next.task.learning_objective}</p><Link to={`/practice/${next.task.id}`}>Продолжить практику →</Link><Link to={`/topics/${next.topic.slug}`}>Все задачи темы →</Link></> : repeat ? <><p>Все доступные задачи решены. Можно повторить материал.</p><Link to={`/practice/${repeat.task.id}`}>Повторить «{repeat.task.title}» →</Link></> : <p>Задач пока нет в каталоге.</p>}</section><section className="context-card context-award"><h2>Ближайшее достижение</h2>{manifest.isError ? <><p>Не удалось загрузить коллекцию.</p><button onClick={() => void manifest.refetch()}>Повторить</button></> : !snapshot || !manifest.data ? <p role="status">Загрузка коллекции…</p> : award ? <><AchievementArt id={award.def.id}/><h3>{award.def.name}</h3><p>{award.def.condition}</p><small>{award.progress.text} · по записанным действиям</small><Link to={`/achievements?family=${encodeURIComponent(award.family.slug)}`}>Открыть эту линейку →</Link></> : <><p>Пока нет незавершённой ступени с записанным прогрессом.</p><Link to="/achievements">Посмотреть коллекцию →</Link></>}</section></aside></div></section></>;
}
