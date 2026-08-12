import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { loadAttempts, loadProfile, updateDisplayName } from "./cloud-sync";
import { useAuth } from "./auth";
import { api } from "./api";
import type { Progress } from "./types";
import { ProfileAchievements } from "./achievements/ProfileAchievements";
import "./profile.css";
export function ProfilePage() {
  const { user, signOut } = useAuth(),
    [tab, setTab] = useState<"progress" | "history" | "settings">("progress"),
    [name, setName] = useState(""),
    [open, setOpen] = useState<string | null>(null);
  const { data: profile, refetch } = useQuery({
      queryKey: ["profile", user?.id],
      queryFn: loadProfile,
      enabled: Boolean(user),
    }),
    { data: progress } = useQuery({
      queryKey: ["progress"],
      queryFn: () => api<Progress>("/progress"),
    }),
    { data: attempts = [] } = useQuery({
      queryKey: ["cloud-attempts", user?.id],
      queryFn: loadAttempts,
      enabled: Boolean(user),
    });
  useEffect(() => setName(profile?.display_name || ""), [profile]);
  if (!user)
    return (
      <section className="page">
        <h1>Профиль доступен после входа</h1>
      </section>
    );
  const completed = progress?.solved ?? 0,
    total = progress?.total ?? 200;
  return (
    <>
      <header className="profile-header">
        <div>
          <small>АККАУНТ</small>
          <h1>{profile?.display_name || user.email}</h1>
          <p>{user.email}</p>
        </div>
      </header>
      <section className="page profile-page">
        <div className="profile-summary">
          <div>
            <small>Регистрация</small>
            <b>{new Date(user.created_at).toLocaleDateString("ru")}</b>
          </div>
          <div>
            <small>Последняя активность</small>
            <b>
              {profile?.last_active_at
                ? new Date(profile.last_active_at).toLocaleString("ru")
                : "—"}
            </b>
          </div>
          <div>
            <small>Выполнено</small>
            <b>
              {completed} / {total}
            </b>
          </div>
          <div>
            <small>Прохождение</small>
            <b>{Math.round((completed / total) * 100)}%</b>
          </div>
          <div>
            <small>Попыток</small>
            <b>{progress?.attempts ?? 0}</b>
          </div>
        </div>
        <ProfileAchievements />
        <div className="filters">
          <button
            className={tab === "progress" ? "active" : ""}
            onClick={() => setTab("progress")}
          >
            Прогресс
          </button>
          <button
            className={tab === "history" ? "active" : ""}
            onClick={() => setTab("history")}
          >
            История решений
          </button>
          <button
            className={tab === "settings" ? "active" : ""}
            onClick={() => setTab("settings")}
          >
            Настройки
          </button>
        </div>
        {tab === "progress" && (
          <div className="module-list">
            {progress?.modules.map((m) => (
              <Link
                to={`/topics/${m.slug}`}
                className="module-row"
                key={m.slug}
              >
                <span>
                  {m.title}
                  <small>
                    {m.solved} из {m.total}
                  </small>
                </span>
                <div className="bar">
                  <i style={{ width: `${m.mastery}%` }} />
                </div>
                <b>{m.mastery}%</b>
              </Link>
            ))}
          </div>
        )}
        {tab === "history" && (
          <div className="attempt-history">
            {attempts.length === 0 ? (
              <div className="empty big">История пока пуста</div>
            ) : (
              attempts.map((a) => (
                <article key={a.id}>
                  <button onClick={() => setOpen(open === a.id ? null : a.id)}>
                    <span>
                      <b>{a.task_id}</b>
                      <small>
                        {new Date(a.created_at).toLocaleString("ru")} ·{" "}
                        {a.execution_ms} мс
                      </small>
                    </span>
                    <em className={a.passed ? "passed" : "failed"}>
                      {a.passed ? "Правильно" : "Ошибка"}
                    </em>
                  </button>
                  {open === a.id && (
                    <div>
                      <pre>{a.code}</pre>
                      <Link to={`/practice/${a.task_id}`}>Открыть задачу</Link>
                    </div>
                  )}
                </article>
              ))
            )}
          </div>
        )}
        {tab === "settings" && (
          <div className="profile-settings">
            <label>
              Отображаемое имя
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <button
              onClick={async () => {
                await updateDisplayName(name);
                await refetch();
              }}
            >
              Сохранить имя
            </button>
            <button
              className="secondary"
              onClick={async () => {
                await signOut();
              }}
            >
              Выйти из аккаунта
            </button>
          </div>
        )}
      </section>
    </>
  );
}
