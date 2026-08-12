import { useEffect, useRef, useState } from "react";
import { Check, Lock } from "lucide-react";
import type { AchievementFamilyView, FamilyAchievement } from "./families";

export function AchievementFamilyDialog({ family, onClose }: { family: AchievementFamilyView; onClose: () => void }) {
  const dialog = useRef<HTMLElement>(null), [selected, setSelected] = useState<FamilyAchievement | null>(family.nextAchievement || family.highestUnlockedAchievement || family.achievements[0]);
  useEffect(() => {
    const previous = document.body.style.overflow; document.body.style.overflow = "hidden"; dialog.current?.querySelector<HTMLElement>("button")?.focus();
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", key); return () => { document.body.style.overflow = previous; document.removeEventListener("keydown", key); };
  }, [onClose]);
  const remaining = family.nextAchievement ? Math.max(0, family.nextAchievement.progress.target - family.nextAchievement.progress.current) : 0;
  return <div className="family-modal" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><article ref={dialog} role="dialog" aria-modal="true" aria-labelledby="family-dialog-title"><button className="ach-close" onClick={onClose} aria-label="Закрыть окно">×</button>
    <header><div><small>ЛИНЕЙКА ДОСТИЖЕНИЙ</small><h2 id="family-dialog-title">{family.name}</h2></div><b>{family.completedCount} / {family.totalCount} получено</b></header>
    <div className="family-current"><strong>{family.isCompleted ? "Линейка полностью завершена" : family.highestUnlockedAchievement ? `Текущая ступень: ${family.highestUnlockedAchievement.def.name}` : "Линейка ещё не начата"}</strong>{family.nextAchievement && <><span>{family.nextAchievement.progress.text}</span><p>До следующего достижения: ещё {remaining}</p></>}</div>
    <div className="family-path">{family.achievements.map((item, index) => { const state = item.unlock ? "unlocked" : item === family.nextAchievement ? "next" : "future"; return <button className={`family-step ${state}`} onClick={() => setSelected(item)} key={item.def.id} aria-label={`${item.def.name}. ${state === "unlocked" ? "Получено" : state === "next" ? "Следующая цель" : "Будущая ступень"}`}><span className="step-line"/><img src={`/achievements/${item.def.icon}`} alt=""/><i>{item.unlock ? <Check/> : <Lock/>}</i><b>{item.def.name}</b><small>{state === "next" ? item.progress.text : item.unlock ? "Получено" : `${index + 1} ступень`}</small></button>; })}</div>
    {selected && <section className={`family-step-details ${selected.unlock ? "unlocked" : "locked"}`}><img src={`/achievements/${selected.def.icon}`} alt=""/><div><small>{selected.unlock ? "ПОЛУЧЕНО" : "НЕ ПОЛУЧЕНО"} · {selected.def.rarity_ru}</small><h3>{selected.def.name}</h3><p>{selected.def.condition}</p><b>{selected.progress.text} · +{selected.def.xp} XP</b>{selected.def.reward && <span>Награда: {selected.def.reward}</span>}{selected.unlock && <span>Получено {new Date(selected.unlock.unlockedAt).toLocaleDateString("ru")}</span>}</div></section>}
  </article></div>;
}
