import { lazy, memo, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Check, Lock, Shield } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { backfillProgress, evaluate } from "./engine";
import { buildAchievementFamilies, type AchievementFamilyView } from "./families";
import { api } from "../api";
import type { Progress } from "../types";
import { achievementThumbnailUrl, fallbackToOriginal } from "./assets";
import { getCachedAchievementManifest, loadAchievementManifest } from "./manifest";

const AchievementFamilyDialog = lazy(() => import("./AchievementFamilyDialog").then((module) => ({ default: module.AchievementFamilyDialog })));

export function AchievementsPage() {
  const [filter, setFilter] = useState("all");
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
  if (!manifest || !model) return <AchievementSkeleton />;
  const visible = families.filter((family) => filter === "all" || (filter === "started" && family.isStarted && !family.isCompleted) || (filter === "not-started" && !family.isStarted) || (filter === "completed" && family.isCompleted));
  const unlocked = Object.keys(model.snapshot.unlocked).length;
  const totalXp = Object.values(model.snapshot.unlocked).reduce((total, item) => total + item.xp, 0);
  const active = selectedSlug ? families.find((family) => family.slug === selectedSlug) : null;
  return <section className="ach-page">
    <header className="ach-head"><div><small>ПРОГРЕСС</small><h1>Достижения</h1></div><div className="ach-summary"><span><b>{unlocked} / {manifest.achievement_count}</b> получено</span><span><b>{totalXp}</b> XP</span><span><b>{model.stats.currentStreak}</b> серия</span><span><b>{model.stats.maxStreak}</b> максимум</span><span><Shield/>{model.stats.stabilizer ? "Стабилизатор" : "Нет стабилизатора"}</span></div></header>
    <div className="ach-body"><div className="ach-section-head"><h2>Линейки достижений</h2><div className="ach-filters" aria-label="Фильтры линеек">{[["all","Все"],["started","Начатые"],["not-started","Не начатые"],["completed","Завершённые"]].map(([id,label])=><button key={id} className={filter===id?"active":""} aria-pressed={filter===id} onClick={()=>setFilter(id)}>{label}</button>)}</div></div><div className="family-grid">{visible.map((family)=><FamilyPreview key={family.slug} family={family} manifestVersion={manifest.version} onOpen={openFamily}/>)}</div></div>
    {active && <Suspense fallback={null}><AchievementFamilyDialog family={active} onClose={()=>setSelectedSlug(null)}/></Suspense>}
  </section>;
}

function AchievementSkeleton() { return <section className="ach-page"><header className="ach-head"><div><small>ПРОГРЕСС</small><h1>Достижения</h1></div></header><div className="ach-body"><div className="ach-section-head"><h2>Линейки достижений</h2></div><div className="family-grid achievement-grid-skeleton" aria-label="Загрузка коллекции">{Array.from({length:12},(_,index)=><i key={index}/>)}</div></div></section>; }

const FamilyPreview = memo(function FamilyPreview({ family, manifestVersion, onOpen }: { family: AchievementFamilyView; manifestVersion: string; onOpen: (slug: string) => void }) {
  const item = family.highestUnlockedAchievement || family.achievements[0];
  const concealed = Boolean(item.def.secret && !item.unlock);
  const label = concealed ? "Секретное достижение" : item.def.name;
  return <button className={`family-preview ${family.isStarted ? "started" : "not-started"} ${family.isCompleted ? "completed" : ""}`} onClick={()=>onOpen(family.slug)} aria-label={concealed ? "Секретное достижение. Условие скрыто" : `${family.name}. ${family.isStarted ? label : "Не начато"}`}>
    <span className="family-preview-art"><img src={achievementThumbnailUrl(item.def, manifestVersion)} alt="" loading="lazy" decoding="async" width="160" height="160" onError={(event)=>fallbackToOriginal(event,item.def)}/><i>{family.isStarted?<Check/>:<Lock/>}</i></span>
    <span className="family-preview-copy"><b>{concealed?"Секретное достижение":family.name}</b><small>{family.isStarted?label:concealed?"Условие скрыто":"Не начато"}</small></span><em>{family.completedCount} / {family.totalCount}</em>
  </button>;
});
