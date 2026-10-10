import { useEffect, useState } from "react";
import { useAuth } from "../auth";
import { loadSnapshot } from "../achievements/engine";
import type { AchievementSnapshot } from "../achievements/types";

export function useAchievementEvidence() {
  const { user } = useAuth(), ownerId = user?.id ?? null;
  const [saved, setSaved] = useState<{ ownerId: string | null; snapshot: AchievementSnapshot } | null>(null);
  useEffect(() => {
    let active = true, ready = false, mismatch = false;
    const refresh = () => { if (active && ready) setSaved({ ownerId, snapshot: loadSnapshot() }); };
    const accountChanged = (event: Event) => {
      mismatch = (event as CustomEvent<string | null>).detail !== ownerId;
      ready = !mismatch;
      if (mismatch) setSaved(null); else refresh();
    };
    queueMicrotask(() => { if (active && !mismatch) { ready = true; refresh(); } });
    window.addEventListener("koda-achievements-updated", refresh);
    window.addEventListener("koda-study-updated", refresh);
    window.addEventListener("koda-study-account-changed", accountChanged);
    return () => { active = false; window.removeEventListener("koda-achievements-updated", refresh); window.removeEventListener("koda-study-updated", refresh); window.removeEventListener("koda-study-account-changed", accountChanged); };
  }, [ownerId]);
  return saved?.ownerId === ownerId ? saved.snapshot : null;
}
