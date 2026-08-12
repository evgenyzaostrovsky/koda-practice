import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import type { AchievementDefinition, AchievementManifest } from "./types";
import { evaluate, loadSnapshot, saveSnapshot } from "./engine";
import "./celebration-static.css";

const MANIFEST = "/achievements/manifest.json";
type Celebration = {
  ids: string[];
  definitions: AchievementDefinition[];
  bulk: boolean;
};

export function AchievementCelebrationQueue() {
  const navigate = useNavigate();
  const manifest = useRef<AchievementManifest | null>(null);
  const actionRef = useRef<HTMLButtonElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const queuedIds = useRef(new Set<string>());
  const [queue, setQueue] = useState<Celebration[]>([]);
  const [ready, setReady] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [sequence, setSequence] = useState({ confirmed: 0, total: 0 });
  const current = queue[0];

  const collect = useCallback(() => {
    if (!manifest.current) return;
    const model = evaluate(manifest.current);
    const pending = model.items.filter(
      (item) => item.unlock && !item.unlock.celebrated,
    );
    if (!pending.length) return;
    const backfill = pending.filter((item) =>
      item.unlock?.sourceEventId.includes("backfill"),
    );
    const live = pending.filter(
      (item) => !item.unlock?.sourceEventId.includes("backfill"),
    );
    const additions: Celebration[] = [];
    if (backfill.length)
      additions.push({
        ids: backfill.map((item) => item.def.id),
        definitions: backfill.map((item) => item.def),
        bulk: backfill.length > 1,
      });
    additions.push(
      ...live.map((item) => ({
        ids: [item.def.id],
        definitions: [item.def],
        bulk: false,
      })),
    );
    const fresh = additions.filter((item) =>
      item.ids.some((id) => !queuedIds.current.has(id)),
    );
    if (!fresh.length) return;
    fresh
      .flatMap((item) => item.ids)
      .forEach((id) => queuedIds.current.add(id));
    setSequence((value) => ({ ...value, total: value.total + fresh.length }));
    setQueue((existing) => [...existing, ...fresh]);
  }, []);

  useEffect(() => {
    fetch(MANIFEST)
      .then((response) => response.json())
      .then((value) => {
        manifest.current = value;
        collect();
      })
      .catch(() => {});
    window.addEventListener("koda-achievements-updated", collect);
    return () =>
      window.removeEventListener("koda-achievements-updated", collect);
  }, [collect]);

  useEffect(() => {
    setReady(false);
    setConfirming(false);
    if (!current) return;
    const image = new Image();
    let active = true;
    image.src = `/achievements/${current.definitions[0].icon}`;
    const show = () => {
      if (active) setReady(true);
    };
    image.decode?.().then(show).catch(show);
    if (!image.decode) image.onload = show;
    return () => {
      active = false;
      image.onload = null;
    };
  }, [current]);

  useEffect(() => {
    if (ready) actionRef.current?.focus();
  }, [ready, current]);

  useEffect(() => {
    if (!current || !ready) return;
    const trap = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        return;
      }
      if (event.key !== "Tab") return;
      const controls = [
        ...(sceneRef.current?.querySelectorAll<HTMLElement>(
          'button, [href], [tabindex]:not([tabindex="-1"])',
        ) ?? []),
      ].filter((node) => !node.hasAttribute("disabled"));
      if (!controls.length) return;
      const first = controls[0],
        last = controls.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", trap);
    return () => document.removeEventListener("keydown", trap);
  }, [current, ready]);

  const acknowledge = useCallback(() => {
    if (!current || confirming) return;
    setConfirming(true);
  }, [current, confirming]);

  const finishConfirmation = useCallback(() => {
    if (!current || !confirming) return;
    const snapshot = loadSnapshot();
    current.ids.forEach((id) => {
      if (snapshot.unlocked[id]) snapshot.unlocked[id].celebrated = true;
      queuedIds.current.delete(id);
    });
    saveSnapshot(snapshot);
    setSequence((value) =>
      queue.length === 1
        ? { confirmed: 0, total: 0 }
        : { ...value, confirmed: value.confirmed + 1 },
    );
    setQueue((items) => items.slice(1));
    if (current.bulk) navigate("/achievements");
  }, [current, confirming, navigate, queue.length]);

  if (!current || !ready) return null;
  const definition = current.definitions[0];
  const totalXp = current.definitions.reduce((sum, item) => sum + item.xp, 0);
  const count =
    sequence.total > 1
      ? `${sequence.confirmed + 1} из ${sequence.total}`
      : null;

  return createPortal(
    <div
      className={`achievement-celebration persistent ${definition.rarity}${confirming ? " confirming" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="celebration-title"
      ref={sceneRef}
    >
      <div
        className="celebration-content"
        onAnimationEnd={(event) => {
          if (confirming && event.target === event.currentTarget)
            finishConfirmation();
        }}
      >
        <strong className="celebration-kicker">НОВОЕ ДОСТИЖЕНИЕ</strong>
        {count && <small className="celebration-count">{count}</small>}
        <div className="celebration-art">
          <img src={`/achievements/${definition.icon}`} alt="" />
        </div>
        <div className="celebration-copy" aria-live="assertive">
          <h2 id="celebration-title">
            {current.bulk
              ? `Получено достижений: ${current.ids.length}`
              : definition.name}
          </h2>
          {!current.bulk && <p>{definition.condition}</p>}
          <b>+{totalXp} XP</b>
          {!current.bulk && definition.reward && (
            <span>Награда: {definition.reward}</span>
          )}
          <button
            ref={actionRef}
            onClick={acknowledge}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                acknowledge();
              }
            }}
            disabled={confirming}
          >
            {current.bulk ? "Посмотреть достижения" : "Получить"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
