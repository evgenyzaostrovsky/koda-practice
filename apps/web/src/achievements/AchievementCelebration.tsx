import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import type { AchievementDefinition, AchievementManifest } from "./types";
import { evaluate, loadSnapshot, saveSnapshot } from "./engine";

const MANIFEST = "/achievements/manifest.json";
type Celebration = { ids: string[]; definitions: AchievementDefinition[]; bulk: boolean };

export function AchievementCelebrationQueue() {
  const navigate = useNavigate();
  const manifest = useRef<AchievementManifest | null>(null);
  const [queue, setQueue] = useState<Celebration[]>([]);
  const [ready, setReady] = useState(false);
  const current = queue[0];

  const collect = useCallback(() => {
    if (!manifest.current) return;
    const model = evaluate(manifest.current);
    const pending = model.items.filter((item) => item.unlock && !item.unlock.celebrated);
    if (!pending.length) return;
    const backfill = pending.filter((item) => item.unlock?.sourceEventId.includes("backfill"));
    const live = pending.filter((item) => !item.unlock?.sourceEventId.includes("backfill"));
    const additions: Celebration[] = [];
    if (backfill.length) additions.push({ ids: backfill.map((item) => item.def.id), definitions: backfill.map((item) => item.def), bulk: backfill.length > 1 });
    additions.push(...live.map((item) => ({ ids: [item.def.id], definitions: [item.def], bulk: false })));
    setQueue((existing) => {
      const known = new Set(existing.flatMap((item) => item.ids));
      return [...existing, ...additions.filter((item) => item.ids.some((id) => !known.has(id)))];
    });
  }, []);

  useEffect(() => {
    fetch(MANIFEST).then((response) => response.json()).then((value) => { manifest.current = value; collect(); }).catch(() => {});
    window.addEventListener("koda-achievements-updated", collect);
    return () => window.removeEventListener("koda-achievements-updated", collect);
  }, [collect]);

  useEffect(() => {
    setReady(false);
    if (!current) return;
    const source = `/achievements/${current.definitions[0].icon}`;
    const image = new Image();
    let active = true;
    image.src = source;
    const show = () => { if (active) setReady(true); };
    image.decode?.().then(show).catch(show);
    if (!image.decode) image.onload = show;
    return () => { active = false; image.onload = null; };
  }, [current]);

  const dismiss = useCallback(() => {
    if (!current) return;
    const snapshot = loadSnapshot();
    current.ids.forEach((id) => { if (snapshot.unlocked[id]) snapshot.unlocked[id].celebrated = true; });
    saveSnapshot(snapshot);
    setQueue((items) => items.slice(1));
  }, [current]);

  useEffect(() => {
    if (!current || !ready) return;
    const timer = window.setTimeout(dismiss, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 1200 : 2400);
    const keyboard = (event: KeyboardEvent) => { if (["Escape", "Enter", " "].includes(event.key)) { event.preventDefault(); dismiss(); } };
    document.addEventListener("keydown", keyboard);
    return () => { window.clearTimeout(timer); document.removeEventListener("keydown", keyboard); };
  }, [current, ready, dismiss]);

  if (!current || !ready) return null;
  const definition = current.definitions[0];
  const totalXp = current.definitions.reduce((sum, item) => sum + item.xp, 0);
  return createPortal(<div className={`achievement-celebration ${definition.rarity}`} role="status" aria-live="assertive" aria-atomic="true" onClick={dismiss}>
    <div className="celebration-content" onClick={(event) => event.stopPropagation()}>
      <strong className="celebration-kicker">ПОЗДРАВЛЯЕМ С ДОСТИЖЕНИЕМ!</strong>
      <div className="celebration-art"><img src={`/achievements/${definition.icon}`} alt="" /></div>
      <div className="celebration-copy">
        <h2>{current.bulk ? `Получено новых достижений: ${current.ids.length}` : definition.name}</h2>
        {!current.bulk && <p>{definition.condition}</p>}
        <b>+{totalXp} XP</b>
        {!current.bulk && definition.reward && <span>Получена награда: {definition.reward}</span>}
        {current.bulk && <button onClick={() => { dismiss(); navigate("/achievements"); }}>Перейти к коллекции</button>}
      </div>
    </div>
  </div>, document.body);
}
