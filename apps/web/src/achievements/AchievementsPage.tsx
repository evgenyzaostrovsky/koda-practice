import { useEffect, useMemo, useState } from "react";
import { Check, Lock, Shield } from "lucide-react";
import type { AchievementManifest } from "./types";
import { backfillProgress, evaluate } from "./engine";
import { buildAchievementFamilies, type AchievementFamilyView } from "./families";
import { AchievementFamilyDialog } from "./AchievementFamilyDialog";
import { api } from "../api";
import type { Progress } from "../types";

const MANIFEST = "/achievements/manifest.json";
export function AchievementsPage() {
  const [manifest, setManifest] = useState<AchievementManifest | null>(null), [filter, setFilter] = useState("all"), [tick, setTick] = useState(0), [selected, setSelected] = useState<AchievementFamilyView | null>(null);
  useEffect(() => {
    Promise.all([fetch(MANIFEST).then((response) => response.json()), api<Progress>("/progress")]).then(([value, progress]) => { backfillProgress(progress.solved_ids || [], progress.modules, progress.total); setManifest(value); });
    const update = () => setTick((value) => value + 1); window.addEventListener("koda-achievements-updated", update); return () => window.removeEventListener("koda-achievements-updated", update);
  }, []);
  const model = useMemo(() => manifest ? evaluate(manifest) : null, [manifest, tick]);
  const families = useMemo(() => manifest && model ? buildAchievementFamilies(manifest, model.snapshot) : [], [manifest, model]);
  if (!manifest || !model) return <section className="ach-page"><p>Загружаем достижения…</p></section>;
  const visible = families.filter((family) => filter === "all" || filter === "started" && family.isStarted && !family.isCompleted || filter === "not-started" && !family.isStarted || filter === "completed" && family.isCompleted);
  const unlocked = Object.keys(model.snapshot.unlocked).length, totalXp = Object.values(model.snapshot.unlocked).reduce((total, item) => total + item.xp, 0);
  const active = selected && families.find((family) => family.slug === selected.slug);
  return <section className="ach-page"><header className="ach-head"><div><small>ПРОГРЕСС</small><h1>Достижения</h1></div><div className="ach-summary"><span><b>{unlocked} / 55</b> получено</span><span><b>{totalXp}</b> XP</span><span><b>{model.stats.currentStreak}</b> серия</span><span><b>{model.stats.maxStreak}</b> максимум</span><span><Shield />{model.stats.stabilizer ? "Стабилизатор" : "Нет стабилизатора"}</span></div></header>
    <div className="ach-body"><div className="ach-section-head"><h2>Линейки достижений</h2><div className="ach-filters" aria-label="Фильтры линеек">{[["all","Все"],["started","Начатые"],["not-started","Не начатые"],["completed","Завершённые"]].map(([id,label]) => <button key={id} className={filter === id ? "active" : ""} aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>)}</div></div>
      <div className="family-grid">{visible.map((family) => <FamilyPreview key={family.slug} family={family} onOpen={() => setSelected(family)}/>)}</div>
    </div>{active && <AchievementFamilyDialog family={active} onClose={() => setSelected(null)}/>}</section>;
}

function FamilyPreview({ family, onOpen }: { family: AchievementFamilyView; onOpen: () => void }) {
  const item = family.highestUnlockedAchievement || family.achievements[0];
  return <button className={`family-preview ${family.isStarted ? "started" : "not-started"} ${family.isCompleted ? "completed" : ""}`} onClick={onOpen} aria-label={`${family.name}. ${family.isStarted ? item.def.name : "Не начато"}`}><span className="family-preview-art"><img src={`/achievements/${item.def.icon}`} alt=""/><i>{family.isStarted ? <Check/> : <Lock/>}</i></span><span className="family-preview-copy"><b>{family.name}</b><small>{family.isStarted ? item.def.name : "Не начато"}</small></span><em>{family.completedCount} / {family.totalCount}</em></button>;
}
