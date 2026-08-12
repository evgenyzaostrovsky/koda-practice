import { useEffect, useMemo, useState } from "react";
import { Check, Lock, Shield } from "lucide-react";
import type { AchievementDefinition, AchievementManifest } from "./types";
import { analystPath } from "./rules";
import { backfillProgress, evaluate, loadSnapshot, rewardKind, saveSnapshot } from "./engine";
import { api } from "../api";
import type { Progress } from "../types";

const MANIFEST = "/achievements/manifest.json";

export function AchievementsPage() {
  const [manifest, setManifest] = useState<AchievementManifest | null>(null);
  const [filter, setFilter] = useState("all");
  const [tick, setTick] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
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
  const definitions = manifest.families.flatMap((f) => f.achievements);
  const unlocked = Object.keys(model.snapshot.unlocked).length;
  const totalXp = Object.values(model.snapshot.unlocked).reduce((n, x) => n + x.xp, 0);
  const active = selected ? definitions.find((x) => x.id === selected) : null;
  const activeItem = active ? model.items.find((x) => x.def.id === active.id) : null;
  const visible = (d: AchievementDefinition) => filter === "all" || (filter === "unlocked" && model.snapshot.unlocked[d.id]) || (filter === "locked" && !model.snapshot.unlocked[d.id]) || d.rarity === filter;
  return <section className="ach-page">
    <header className="ach-head"><div><small>ПРОГРЕСС</small><h1>Достижения</h1></div><div className="ach-summary"><span><b>{unlocked} / 55</b> получено</span><span><b>{totalXp}</b> XP</span><span><b>{model.stats.currentStreak}</b> серия</span><span><b>{model.stats.maxStreak}</b> максимум</span><span><Shield />{model.stats.stabilizer ? "Стабилизатор" : "Нет стабилизатора"}</span></div></header>
    <div className="ach-body"><h2>Путь аналитика</h2><div className="analyst-path">{analystPath.map((id, index) => { const item = model.items.find((x) => x.def.id === id)!; return <button className={item.unlock ? "done" : ""} onClick={() => setSelected(id)} key={id}><img loading="lazy" src={`/achievements/${item.def.icon}`} alt="" /><span>{index + 1}</span><b>{item.def.name}</b><small>{item.progress.percentage}%</small></button>; })}</div>
      <div className="ach-section-head"><h2>Коллекция</h2><div className="ach-filters">{[["all", "Все"], ["unlocked", "Полученные"], ["locked", "Неполученные"], ["rare", "Редкие"], ["epic", "Эпические"], ["legendary", "Легендарные"]].map(([id, label]) => <button className={filter === id ? "active" : ""} onClick={() => setFilter(id)} key={id}>{label}</button>)}</div></div>
      {manifest.families.map((family) => { const items = family.achievements.filter(visible); return items.length ? <section className="ach-family" key={family.slug}><h3>{family.name}<span>{items.filter((x) => model.snapshot.unlocked[x.id]).length} / {family.achievements.length}</span></h3><div>{items.map((def) => { const item = model.items.find((x) => x.def.id === def.id)!; return <button className={`ach-card ${item.unlock ? "unlocked" : "locked"} ${def.rarity}`} onClick={() => setSelected(def.id)} key={def.id}><img loading="lazy" src={`/achievements/${def.icon}`} alt="" /><span>{item.unlock ? <Check /> : <Lock />}</span><b>{def.name}</b><small>{def.condition}</small><i><em style={{ width: `${item.progress.percentage}%` }} /></i><footer>{item.progress.text}<strong>+{def.xp} XP</strong></footer></button>; })}</div></section> : null; })}
    </div>
    {active && activeItem && <div className="ach-modal" onClick={() => setSelected(null)}><article onClick={(e) => e.stopPropagation()}><button className="ach-close" onClick={() => setSelected(null)}>×</button><img src={`/achievements/${active.icon}`} alt="" /><small className={active.rarity}>{active.rarity_ru}</small><h2>{active.name}</h2><p>{active.condition}</p><div className="ach-big-progress"><span>{activeItem.progress.text}</span><b>{activeItem.progress.percentage}%</b><i><em style={{ width: `${activeItem.progress.percentage}%` }} /></i></div><dl><div><dt>Опыт</dt><dd>+{active.xp} XP</dd></div>{active.reward && <div><dt>Награда</dt><dd>{active.reward}</dd></div>}{activeItem.unlock && <div><dt>Получено</dt><dd>{new Date(activeItem.unlock.unlockedAt).toLocaleDateString("ru")}</dd></div>}</dl>{activeItem.unlock && active.reward && rewardKind(active) && <button className="ach-apply" onClick={() => { const s = loadSnapshot(); s.activeCosmetics[rewardKind(active)!] = active.id; s.unlocked[active.id].seen = true; saveSnapshot(s); setTick((x) => x + 1); }}>Применить награду</button>}</article></div>}
    <AchievementToast manifest={manifest} />
  </section>;
}

function AchievementToast({ manifest }: { manifest: AchievementManifest }) {
  const [tick, setTick] = useState(0);
  const snapshot = loadSnapshot();
  const entry = Object.entries(snapshot.unlocked).find(([, x]) => !x.seen);
  const def = entry && manifest.families.flatMap((f) => f.achievements).find((x) => x.id === entry[0]);
  if (!entry || !def) return null;
  return <aside className={`ach-toast ${def.rarity}`}><img src={`/achievements/${def.icon}`} alt="" /><div><small>НОВОЕ ДОСТИЖЕНИЕ</small><b>{def.name}</b><span>+{def.xp} XP{def.reward ? ` · ${def.reward}` : ""}</span></div><button onClick={() => { snapshot.unlocked[entry[0]].seen = true; saveSnapshot(snapshot); setTick(tick + 1); }}>×</button></aside>;
}
