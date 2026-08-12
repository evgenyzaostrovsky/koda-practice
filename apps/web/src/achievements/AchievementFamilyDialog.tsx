import { useEffect, useRef, useState } from "react";
import { Check, Lock } from "lucide-react";
import type { AchievementFamilyView } from "./families";
import "./achievement-selection.css";

type Props = { family: AchievementFamilyView; onClose: () => void };
const initialSelection = (family: AchievementFamilyView) =>
  family.highestUnlockedAchievement?.def.id ??
  family.achievements[0]?.def.id ??
  null;

export function AchievementFamilyDialog({ family, onClose }: Props) {
  const dialog = useRef<HTMLElement>(null);
  const stepRefs = useRef(new Map<string, HTMLButtonElement>());
  const [selectedAchievementId, setSelectedAchievementId] = useState<
    string | null
  >(() => initialSelection(family));

  useEffect(
    () => setSelectedAchievementId(initialSelection(family)),
    [family.slug],
  );
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.querySelector<HTMLElement>("button")?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", key);
    };
  }, [onClose]);

  const selected =
    family.achievements.find((item) => item.def.id === selectedAchievementId) ??
    null;
  const remaining = family.nextAchievement
    ? Math.max(
        0,
        family.nextAchievement.progress.target -
          family.nextAchievement.progress.current,
      )
    : 0;
  const selectAt = (index: number) => {
    const item = family.achievements[index];
    if (!item) return;
    setSelectedAchievementId(item.def.id);
    stepRefs.current.get(item.def.id)?.focus();
  };

  return (
    <div
      className="family-modal"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <article
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="family-dialog-title"
      >
        <button
          className="ach-close"
          onClick={onClose}
          aria-label="Закрыть окно"
        >
          ×
        </button>
        <header>
          <div>
            <small>ЛИНЕЙКА ДОСТИЖЕНИЙ</small>
            <h2 id="family-dialog-title">{family.name}</h2>
          </div>
          <b>
            {family.completedCount} / {family.totalCount} получено
          </b>
        </header>
        <div className="family-current">
          <strong>
            {family.isCompleted
              ? "Линейка полностью завершена"
              : family.highestUnlockedAchievement
                ? `Текущая ступень: ${family.highestUnlockedAchievement.def.name}`
                : "Линейка ещё не начата"}
          </strong>
          {family.nextAchievement && (
            <>
              <span>{family.nextAchievement.progress.text}</span>
              <p>До следующего достижения: ещё {remaining}</p>
            </>
          )}
        </div>
        <div className="family-path" aria-label="Ступени линейки">
          {family.achievements.map((item, index) => {
            const state = item.unlock
              ? "unlocked"
              : item === family.nextAchievement
                ? "next"
                : "future";
            const isSelected = item.def.id === selectedAchievementId;
            return (
              <button
                ref={(node) => {
                  if (node) stepRefs.current.set(item.def.id, node);
                  else stepRefs.current.delete(item.def.id);
                }}
                className={`family-step ${state}${isSelected ? " selected" : ""}`}
                onClick={() => setSelectedAchievementId(item.def.id)}
                onKeyDown={(event) => {
                  if (event.key === "ArrowRight" || event.key === "ArrowDown") {
                    event.preventDefault();
                    selectAt(
                      Math.min(index + 1, family.achievements.length - 1),
                    );
                  } else if (
                    event.key === "ArrowLeft" ||
                    event.key === "ArrowUp"
                  ) {
                    event.preventDefault();
                    selectAt(Math.max(index - 1, 0));
                  }
                }}
                key={item.def.id}
                aria-selected={isSelected}
                tabIndex={isSelected ? 0 : -1}
                aria-label={`${item.def.name}. ${state === "unlocked" ? "Получено" : state === "next" ? "Следующая цель" : "Будущая ступень"}`}
              >
                <span className="step-line" />
                <img src={`/achievements/${item.def.icon}`} alt="" />
                <i>{item.unlock ? <Check /> : <Lock />}</i>
                <b>{item.def.name}</b>
                <small>
                  {state === "next"
                    ? item.progress.text
                    : item.unlock
                      ? "Получено"
                      : `${index + 1} ступень`}
                </small>
              </button>
            );
          })}
        </div>
        {selected && (
          <section
            className={`family-step-details ${selected.unlock ? "unlocked" : "locked"}`}
            data-achievement-id={selected.def.id}
          >
            <img src={`/achievements/${selected.def.icon}`} alt="" />
            <div>
              <small>
                {selected.unlock ? "ПОЛУЧЕНО" : "НЕ ПОЛУЧЕНО"} ·{" "}
                {selected.def.rarity_ru}
              </small>
              <h3>{selected.def.name}</h3>
              <p>{selected.def.condition}</p>
              <b>
                {selected.progress.text} · +{selected.def.xp} XP
              </b>
              {selected.def.reward && (
                <span>Награда: {selected.def.reward}</span>
              )}
              {selected.unlock && (
                <span>
                  Получено{" "}
                  {new Date(selected.unlock.unlockedAt).toLocaleDateString(
                    "ru",
                  )}
                </span>
              )}
            </div>
          </section>
        )}
      </article>
    </div>
  );
}
