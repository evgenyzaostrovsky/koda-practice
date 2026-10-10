import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAuth } from "../auth";
import { AchievementArt } from "../achievements/AchievementArt";
import { loadSnapshot } from "../achievements/engine";
import { getCachedAchievementManifest, loadAchievementManifest } from "../achievements/manifest";
import type { AchievementSnapshot } from "../achievements/types";
import { latestEarnedAchievement, type selectHomeContinuation } from "./home-support";

type Continuation = ReturnType<typeof selectHomeContinuation>;
export function HomeSupportColumn({ continuation }: { continuation: Continuation }) {
  const { user } = useAuth();
  const ownerId = user?.id ?? null;
  const [saved, setSaved] = useState<{ ownerId: string | null; snapshot: AchievementSnapshot } | null>(null);
  const manifest = useQuery({ queryKey: ["achievement-manifest"], queryFn: loadAchievementManifest, initialData: getCachedAchievementManifest() ?? undefined, staleTime: Infinity });
  useEffect(() => {
    let active = true;
    let scopeReady = false;
    let scopeMismatch = false;
    const refresh = () => { if (active && scopeReady) setSaved({ ownerId, snapshot: loadSnapshot() }); };
    const accountChanged = (event: Event) => {
      if ((event as CustomEvent<string | null>).detail === ownerId) { scopeMismatch = false; scopeReady = true; refresh(); }
      else { scopeMismatch = true; scopeReady = false; setSaved(null); }
    };
    // Auth's account-scope effect may run after this child's mount effect.
    queueMicrotask(() => { if (active && !scopeMismatch) { scopeReady = true; refresh(); } });
    window.addEventListener("koda-achievements-updated", refresh);
    window.addEventListener("koda-study-account-changed", accountChanged);
    return () => {
      active = false;
      window.removeEventListener("koda-achievements-updated", refresh);
      window.removeEventListener("koda-study-account-changed", accountChanged);
    };
  }, [ownerId]);
  const latest = saved?.ownerId === ownerId && manifest.data ? latestEarnedAchievement(manifest.data, saved.snapshot) : null;
  return <aside className="home-support-column" aria-label="Поддержка обучения">
    <section className="home-support-card"><h2>План занятия</h2><ol>
      <li>{continuation ? <Link to={`/topics/${continuation.topic.slug}`}>Освежите тему «{continuation.topic.title}»</Link> : <Link to="/catalog">Выберите тему в каталоге</Link>}</li>
      <li>{continuation ? `Попробуйте задачу «${continuation.task.title}»` : "Попробуйте задачу выбранной темы"}</li>
      <li>Сверьте результат и прочитайте разбор</li>
    </ol></section>
    <section className="home-support-card home-latest-award"><h2>Последнее достижение</h2>
      {manifest.isError ? <><p role="status">Не удалось загрузить коллекцию.</p><button className="secondary" onClick={() => void manifest.refetch()}>Повторить</button></> : !manifest.data || !saved || saved.ownerId !== ownerId ? <p role="status">Загрузка достижения…</p> : latest ? <><AchievementArt id={latest.def.id}/><h3>{latest.def.name}</h3><p>{latest.def.condition_after_unlock || latest.def.condition}</p><small>Получено {new Date(latest.unlock.unlockedAt).toLocaleDateString("ru-RU")}</small><Link to="/achievements">Вся коллекция →</Link></> : <><p>Полученные достижения появятся здесь.</p><Link to="/achievements">Посмотреть коллекцию →</Link></>}
    </section>
  </aside>;
}
