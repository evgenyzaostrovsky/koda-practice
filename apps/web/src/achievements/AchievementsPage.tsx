import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Lock, Shield } from "lucide-react";
import type { AchievementDefinition, AchievementManifest, AchievementProgress, AchievementSnapshot } from "./types";
import { analystPath } from "./rules";
import { backfillProgress, evaluate, loadSnapshot, rewardKind, saveSnapshot } from "./engine";
import { api } from "../api";
import type { Progress } from "../types";

const MANIFEST = "/achievements/manifest.json";
type AchievementItem = { def: AchievementDefinition; progress: AchievementProgress; unlock: AchievementSnapshot["unlocked"][string] | undefined };

export function AchievementsPage() {
  const [manifest, setManifest] = useState<AchievementManifest | null>(null);
  const [filter, setFilter] = useState("all");
  const [tick, setTick] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const selectedTrigger = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    Promise.all([fetch(MANIFEST).then((r) => r.json()), api<Progress>("/progress")]).then(([m, p]) => {
      backfillProgress(p.solved_ids || [], p.modules, p.total);
      setManifest(m);
    });
    const update = () => setTick((x) => x + 1);
    window.addEventListener("koda-achievements-updated", update);
    return () => window.removeEventListener("koda-achievements-updated", update);
  }, []);
  const model = useMemo(() => (manifest ? evaluate(manifest) : null), [manifest, tick]);
  if (!manifest || !model) return <section className="ach-page"><p>Загружаем достижения…</p></section>;
  const definitions = manifest.families.flatMap((family) => family.achievements);
  const unlocked = Object.keys(model.snapshot.unlocked).length;
  const totalXp = Object.values(model.snapshot.unlocked).reduce((total, item) => total + item.xp, 0);
  const active = selected ? model.items.find((item) => item.def.id === selected) : null;
  const visible = (definition: AchievementDefinition) => filter === "all" || (filter === "unlocked" && model.snapshot.unlocked[definition.id]) || (filter === "locked" && !model.snapshot.unlocked[definition.id]) || definition.rarity === filter;
  const openDetails = (id: string, trigger: HTMLButtonElement) => { selectedTrigger.current = trigger; setSelected(id); };
  const closeDetails = () => { setSelected(null); requestAnimationFrame(() => selectedTrigger.current?.focus()); };
  return <section className="ach-page">
    <header className="ach-head"><div><small>ПРОГРЕСС</small><h1>Достижения</h1></div><div className="ach-summary"><span><b>{unlocked} / 55</b> получено</span><span><b>{totalXp}</b> XP</span><span><b>{model.stats.currentStreak}</b> серия</span><span><b>{model.stats.maxStreak}</b> максимум</span><span><Shield />{model.stats.stabilizer ? "Стабилизатор" : "Нет стабилизатора"}</span></div></header>
    <div className="ach-body"><h2>Путь аналитика</h2><div className="analyst-path">{analystPath.map((id, index) => { const item = model.items.find((candidate) => candidate.def.id === id)!; return <button className={item.unlock ? "done" : ""} onClick={(event) => openDetails(id, event.currentTarget)} key={id}><img loading="lazy" src={`/achievements/${item.def.icon}`} alt="" /><span>{index + 1}</span><b>{item.def.name}</b><small>{item.progress.percentage}%</small></button>; })}</div>
      <div className="ach-section-head"><h2>Коллекция</h2><div className="ach-filters" aria-label="Фильтры достижений">{[["all", "Все"], ["unlocked", "Полученные"], ["locked", "Неполученные"], ["rare", "Редкие"], ["epic", "Эпические"], ["legendary", "Легендарные"]].map(([id, label]) => <button className={filter === id ? "active" : ""} aria-pressed={filter === id} onClick={() => setFilter(id)} key={id}>{label}</button>)}</div></div>
      {manifest.families.map((family) => {
        const items = family.achievements.filter(visible);
        const familyUnlocked = family.achievements.filter((definition) => model.snapshot.unlocked[definition.id]).length;
        return items.length ? <section className="ach-family" key={family.slug}><h3>{family.name}<span>{familyUnlocked} / {family.achievements.length}</span></h3><div className="achievement-grid">{items.map((definition) => <AchievementTile key={definition.id} item={model.items.find((candidate) => candidate.def.id === definition.id)!} onOpen={openDetails} />)}</div></section> : null;
      })}
    </div>
    {active && <AchievementDetailsModal item={active} onClose={closeDetails} onApply={() => { const kind = rewardKind(active.def); if (!kind) return; const snapshot = loadSnapshot(); snapshot.activeCosmetics[kind] = active.def.id; snapshot.unlocked[active.def.id].seen = true; saveSnapshot(snapshot); setTick((value) => value + 1); }} />}
  </section>;
}

function AchievementTile({ item, onOpen }: { item: AchievementItem; onOpen: (id: string, trigger: HTMLButtonElement) => void }) {
  const unlocked = Boolean(item.unlock);
  return <button type="button" className={`achievement-tile ${unlocked ? "unlocked" : "locked"} ${item.def.rarity}`} title={item.def.name} aria-label={`${item.def.name}. ${unlocked ? "Получено" : "Не получено"}`} onClick={(event) => onOpen(item.def.id, event.currentTarget)}>
    <img loading="lazy" src={`/achievements/${item.def.icon}`} alt="" />
    <span className="achievement-state" aria-hidden="true">{unlocked ? <Check /> : <Lock />}</span>
  </button>;
}

function AchievementDetailsModal({ item, onClose, onApply }: { item: AchievementItem; onClose: () => void; onApply: () => void }) {
  const dialog = useRef<HTMLElement>(null);
  const unlocked = Boolean(item.unlock);
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusables = () => [...(dialog.current?.querySelectorAll<HTMLElement>('button,[href],[tabindex]:not([tabindex="-1"])') || [])].filter((element) => !element.hasAttribute("disabled"));
    focusables()[0]?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); return; }
      if (event.key !== "Tab") return;
      const nodes = focusables(); if (!nodes.length) return;
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener("keydown", onKeyDown); };
  }, [onClose]);
  return <div className="ach-modal" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><article ref={dialog} role="dialog" aria-modal="true" aria-labelledby="achievement-dialog-title" className={unlocked ? "unlocked" : "locked"}>
    <button className="ach-close" onClick={onClose} aria-label="Закрыть окно">×</button>
    <img src={`/achievements/${item.def.icon}`} alt="" />
    <span className={`ach-status ${unlocked ? "unlocked" : "locked"}`}>{unlocked ? "Получено" : "Не получено"}</span>
    <small className={item.def.rarity}>{item.def.rarity_ru}</small><h2 id="achievement-dialog-title">{item.def.name}</h2><p>{item.def.condition}</p>
    <div className="ach-big-progress"><span>{item.progress.text}</span><b>{item.progress.current} / {item.progress.target}</b><i><em style={{ width: `${item.progress.percentage}%` }} /></i></div>
    <dl><div><dt>Прогресс</dt><dd>{item.progress.percentage}%</dd></div><div><dt>Опыт</dt><dd>+{item.def.xp} XP</dd></div>{item.def.reward && <div><dt>Награда</dt><dd>{item.def.reward}</dd></div>}{item.unlock && <div><dt>Получено</dt><dd>{new Date(item.unlock.unlockedAt).toLocaleDateString("ru")}</dd></div>}</dl>
    {item.unlock && item.def.reward && rewardKind(item.def) && <button className="ach-apply" onClick={onApply}>Применить награду</button>}
  </article></div>;
}
