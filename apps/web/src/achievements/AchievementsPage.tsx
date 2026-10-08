import { AchievementArt } from "./AchievementArt";
import { lazy, memo, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Check, Lock, Shield } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { backfillProgress, evaluate } from "./engine";
import { buildAchievementFamilies, type AchievementFamilyView } from "./families";
import { api } from "../api";
import type { Progress } from "../types";
import "./achievement-room.css";
import { getCachedAchievementManifest, loadAchievementManifest } from "./manifest";

const AchievementFamilyDialog = lazy(() => import("./AchievementFamilyDialog").then((module) => ({ default: module.AchievementFamilyDialog })));

export function AchievementsPage() {
  const [filter, setFilter] = useState("overview");
  const [showNames, setShowNames] = useState(false);
  const [tick, setTick] = useState(0);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const manifestQuery = useQuery({ queryKey: ["achievement-manifest"], queryFn: loadAchievementManifest, initialData: getCachedAchievementManifest() ?? undefined, staleTime: Infinity, gcTime: Infinity });
  const progressQuery = useQuery({ queryKey: ["progress"], queryFn: () => api<Progress>("/progress"), staleTime: 60_000 });
  useEffect(() => { const progress = progressQuery.data; if (progress) backfillProgress(progress.solved_ids || [], progress.modules, progress.total); }, [progressQuery.data]);
  useEffect(() => { const update = () => setTick((value) => value + 1); window.addEventListener("koda-achievements-updated", update); return () => window.removeEventListener("koda-achievements-updated", update); }, []);
  const manifest = manifestQuery.data ?? null;
  const model = useMemo(() => manifest ? evaluate(manifest) : null, [manifest, tick]);
  const families = useMemo(() => manifest && model ? buildAchievementFamilies(manifest, model.snapshot, model) : [], [manifest, model]);
  const openFamily = useCallback((slug: string) => setSelectedSlug(slug), []);
  if (manifestQuery.isError && !manifest) return <section className="ach-page"><h1>Комната достижений</h1><p role="alert">Не удалось загрузить коллекцию.</p><button onClick={() => void manifestQuery.refetch()}>Повторить</button></section>;
  if (!manifest || !model) return <AchievementSkeleton />;
  const visible = families.filter((family) => filter === "all" || (filter === "overview" && (["01_solved_tasks","03_course_progress","05_error_recovery","07_sandbox","08_own_data","19_comeback","20_flexible_rhythm","31_memory_echo","37_panorama","45_first_mini_analysis"].includes(family.slug) || family.isStarted)) || (filter === "started" && family.isStarted && !family.isCompleted) || (filter === "not-started" && !family.isStarted) || (filter === "completed" && family.isCompleted));
  const curated = ["01_solved_tasks","03_course_progress","05_error_recovery","07_sandbox","08_own_data","19_comeback","20_flexible_rhythm","31_memory_echo","37_panorama","45_first_mini_analysis"];
  const roomFamilies = [...families].filter(family => family.isStarted || curated.includes(family.slug)).sort((a,b) => Number(b.isStarted)-Number(a.isStarted) || b.completedCount / b.totalCount - a.completedCount / a.totalCount).slice(0,10);
  const unlocked = Object.keys(model.snapshot.unlocked).length;
  const totalXp = Object.values(model.snapshot.unlocked).reduce((total, item) => total + item.xp, 0);
  const active = selectedSlug ? families.find((family) => family.slug === selectedSlug) : null;
  return <section className="ach-page">
    <header className="ach-head"><div><small>ВАШИ ДОСТИЖЕНИЯ</small><h1>Маленькие шаги, заметные результаты</h1></div><div className="ach-summary"><span><b>{unlocked}</b> получено</span><span><b>{totalXp}</b> XP</span><span><b>{model.stats.currentStreak}</b> серия</span><span><b>{model.stats.maxStreak}</b> максимум</span><span><Shield/>{model.stats.stabilizer ? "Стабилизатор" : "Нет стабилизатора"}</span></div></header>
    <div className="ach-body"><div className="ach-section-head"><h2>Комната достижений</h2><div className="ach-filters" aria-label="Фильтры линеек">{[["overview","Главное"],["all","Вся коллекция"],["started","Начатые"],["not-started","Не начатые"],["completed","Завершённые"]].map(([id,label])=><button key={id} className={filter===id?"active":""} aria-pressed={filter===id} onClick={()=>setFilter(id)}>{label}</button>)}</div></div>{filter === "overview" ? <><button className="room-name-toggle" aria-pressed={showNames} onClick={() => setShowNames(value => !value)}>Показать названия</button><div className="achievement-room" aria-label="Комната с вашей коллекцией"><div className="room-window" aria-hidden="true"><i/></div><div className="room-plant" aria-hidden="true"><i/><i/><i/></div><div className="room-desk" aria-hidden="true"/><div className="room-trophies">{roomFamilies.map(family => { const item=family.highestUnlockedAchievement || family.achievements[0]; const concealed=Boolean(item.def.secret && !item.unlock); return <button key={family.slug} className={`room-trophy ${family.isStarted ? "earned" : "locked"}`} aria-label={`${concealed ? "Секретное достижение" : family.name}. ${family.isStarted ? item.def.name : "Не начато"}`} onClick={() => openFamily(family.slug)}><AchievementArt id={item.def.id}/>{showNames && <span>{concealed ? "Секретное достижение" : item.def.name}</span>}</button>; })}</div>{!roomFamilies.length && <p className="room-empty">Коллекция пока пуста. Ваши открытия появятся здесь.</p>}</div></> : <div className="family-grid">{visible.length === 0 && <p role="status">В этой части коллекции пока нет достижений.</p>}{visible.map((family)=><FamilyPreview key={family.slug} family={family} onOpen={openFamily}/>)}</div>}</div>
    {active && <Suspense fallback={null}><AchievementFamilyDialog family={active} onClose={()=>setSelectedSlug(null)}/></Suspense>}
  </section>;
}

function AchievementSkeleton() { return <section className="ach-page"><header className="ach-head"><div><small>ВАШИ ДОСТИЖЕНИЯ</small><h1>Маленькие шаги, заметные результаты</h1></div></header><div className="ach-body"><div className="ach-section-head"><h2>Ваши шаги</h2></div><div className="family-grid achievement-grid-skeleton" aria-label="Загрузка коллекции">{Array.from({length:12},(_,index)=><i key={index}/>)}</div></div></section>; }

const FamilyPreview = memo(function FamilyPreview({ family, onOpen }: { family: AchievementFamilyView; onOpen: (slug: string) => void }) {
  const item = family.highestUnlockedAchievement || family.achievements[0];
  const concealed = Boolean(item.def.secret && !item.unlock);
  const label = concealed ? "Секретное достижение" : item.def.name;
  return <button className={`family-preview ${family.isStarted ? "started" : "not-started"} ${family.isCompleted ? "completed" : ""}`} onClick={()=>onOpen(family.slug)} aria-label={concealed ? "Секретное достижение. Условие скрыто" : `${family.name}. ${family.isStarted ? label : "Не начато"}`}>
    <span className="family-preview-art"><AchievementArt id={item.def.id} /><i>{family.isStarted?<Check/>:<Lock/>}</i></span>
    <span className="family-preview-copy"><b>{concealed?"Секретное достижение":family.name}</b><small>{family.isStarted?label:concealed?"Условие скрыто":"Не начато"}</small></span><em>{family.completedCount} / {family.totalCount}</em>
  </button>;
});
