import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, RotateCcw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { evaluate } from "./engine";
import { achievementThumbnailUrl, fallbackToOriginal } from "./assets";
import { getCachedAchievementManifest, loadAchievementManifest } from "./manifest";

export function ProfileAchievements() {
  const [tick, setTick] = useState(0);
  const manifestQuery = useQuery({ queryKey:["achievement-manifest"], queryFn:loadAchievementManifest, initialData:getCachedAchievementManifest()??undefined, staleTime:Infinity, gcTime:Infinity });
  const manifest = manifestQuery.data ?? null;
  useEffect(() => {
    const update = () => setTick((value) => value + 1);
    window.addEventListener("koda-achievements-updated", update);
    return () => window.removeEventListener("koda-achievements-updated", update);
  }, []);
  const model = useMemo(() => (manifest ? evaluate(manifest) : null), [manifest, tick]);
  const definitions = useMemo(() => new Map(manifest?.families.flatMap((family) => family.achievements).map((definition) => [definition.id, definition]) ?? []), [manifest]);
  if (manifestQuery.isError)
    return <section className="profile-module profile-achievements-card profile-module-error"><header><div><small>КОЛЛЕКЦИЯ</small><h2>Достижения</h2></div></header><p>Не удалось загрузить достижения</p><button onClick={()=>manifestQuery.refetch()}><RotateCcw/> Повторить</button></section>;
  if (!manifest || !model)
    return <section className="profile-module profile-achievements-card" aria-label="Загрузка достижений"><header><div><small>КОЛЛЕКЦИЯ</small><h2>Достижения</h2></div></header><div className="profile-achievements-skeleton"><i/><i/><i/></div></section>;
  const unlocked = Object.entries(model.snapshot.unlocked)
    .map(([id, unlock]) => ({ definition: definitions.get(id), unlock }))
    .filter((item) => item.definition)
    .sort((a, b) => new Date(b.unlock.unlockedAt).getTime() - new Date(a.unlock.unlockedAt).getTime());
  const totalXp = unlocked.reduce((sum, item) => sum + item.unlock.xp, 0);
  return <Link className="profile-module profile-achievements-card" to="/achievements">
    <header><div><small>КОЛЛЕКЦИЯ</small><h2>Достижения</h2></div><ArrowRight/></header>
    <div className="profile-achievement-summary"><strong>{unlocked.length} / {manifest.achievement_count}</strong><span>{totalXp} XP</span><span>Серия: {model.stats.maxStreak}</span></div>
    {unlocked.length ? <div className="profile-unlocked-icons">{unlocked.slice(0, 6).map(({definition}) => <img key={definition!.id} src={achievementThumbnailUrl(definition!,manifest.version)} loading="lazy" decoding="async" width="160" height="160" onError={(event)=>fallbackToOriginal(event,definition!)} alt={definition!.name} title={`${definition!.name} · ${definition!.rarity_ru}`}/>)}</div> : <div className="profile-achievements-empty"><b>Пока нет полученных достижений</b><span>Первая награда появится после выполненного условия.</span></div>}
    <b className="profile-more">Все достижения →</b>
  </Link>;
}
