import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, CheckCircle2, Settings, UserRound } from "lucide-react";
import {
  loadAttempts,
  loadProfile,
  updateProfileIdentity,
  type ProfileRecord,
  type SolutionAttempt,
} from "./cloud-sync";
import { useAuth } from "./auth";
import { api } from "./api";
import type { Progress } from "./types";
import { ProfileAchievements } from "./achievements/ProfileAchievements";
import "./profile.css";

const progressQuery = () => api<Progress>("/progress");
const formatDate = (value?: string | null, withTime = false) =>
  value
    ? new Intl.DateTimeFormat("ru", {
        day: "numeric",
        month: "long",
        year: "numeric",
        ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
      }).format(new Date(value))
    : "—";

function useProfileData(historyLimit = 5) {
  const { user } = useAuth();
  const profile = useQuery<ProfileRecord | null>({
    queryKey: ["profile", user?.id],
    queryFn: loadProfile,
    enabled: Boolean(user),
  });
  const progress = useQuery({ queryKey: ["progress"], queryFn: progressQuery });
  const attempts = useQuery({
    queryKey: ["cloud-attempts", user?.id, historyLimit],
    queryFn: () => loadAttempts(historyLimit),
    enabled: Boolean(user) && historyLimit > 0,
  });
  return { user, profile, progress, attempts };
}

function ProfileBack({ title }: { title: string }) {
  return (
    <header className="profile-detail-head">
      <div>
        <Link to="/profile"><ArrowLeft /> Профиль</Link>
        <h1>{title}</h1>
      </div>
    </header>
  );
}

function ActivityRows({ attempts }: { attempts: SolutionAttempt[] }) {
  if (!attempts.length)
    return <p className="profile-empty">История решений пока пуста</p>;
  return (
    <div className="profile-activity-list">
      {attempts.map((attempt) => (
        <Link to={`/practice/${attempt.task_id}`} key={attempt.id}>
          <span>
            <b>{attempt.task_id}</b>
            <small>
              {formatDate(attempt.created_at, true)} · {attempt.execution_ms} мс
            </small>
          </span>
          <em className={attempt.passed ? "passed" : "failed"}>
            {attempt.passed ? "Решено" : "Ошибка"}
          </em>
        </Link>
      ))}
    </div>
  );
}

export function ProfilePage() {
  const { user, profile, progress, attempts } = useProfileData(5);
  if (!user)
    return <section className="page"><h1>Профиль доступен после входа</h1></section>;
  const solved = progress.data?.solved ?? 0;
  const total = progress.data?.total ?? 200;
  const percent = total ? Math.round((solved / total) * 100) : 0;
  const activeModules = progress.data?.modules.filter((m) => m.solved > 0 && m.solved < m.total) ?? [];
  const displayName = profile.data?.display_name || user.user_metadata.display_name || user.email || "Пользователь";
  const initial = displayName.trim().charAt(0).toLocaleUpperCase("ru") || "K";
  return (
    <section className="profile-overview" aria-busy={profile.isLoading || progress.isLoading}>
      <div className="profile-identity-card">
        <div className="profile-avatar" aria-hidden="true">{initial}</div>
        <div className="profile-identity">
          <small>АККАУНТ</small>
          <h1>{displayName}</h1>
          {profile.data?.username && <p className="profile-username">@{profile.data.username}</p>}
          <p>{user.email}</p>
          <div><span>Регистрация: {formatDate(user.created_at)}</span><span>Активность: {formatDate(profile.data?.last_active_at, true)}</span></div>
        </div>
        <div className="profile-identity-metrics">
          <span><b>{solved} / {total}</b><small>решено</small></span>
          <span><b>{percent}%</b><small>курс</small></span>
          <span><b>{progress.data?.attempts ?? 0}</b><small>попыток</small></span>
        </div>
      </div>

      <div className="profile-module-grid">
        <Link className="profile-module profile-progress-card" to="/progress">
          <header><div><small>ОБУЧЕНИЕ</small><h2>Прогресс</h2></div><ArrowRight /></header>
          <div className="profile-progress-numbers"><strong>{solved} / {total}</strong><span>{percent}% курса</span></div>
          <div className="profile-course-bar"><i style={{ width: `${percent}%` }} /></div>
          <p>{activeModules.length ? `${activeModules.length} тем в работе` : "Начните первую тему"}</p>
          {activeModules.slice(0, 2).map((module) => <small key={module.slug}>{module.title} · {module.mastery}%</small>)}
          <b className="profile-more">Подробнее →</b>
        </Link>

        <ProfileAchievements />

        <Link className="profile-module profile-activity-card" to="/profile/history">
          <header><div><small>НЕДАВНЕЕ</small><h2>Активность</h2></div><ArrowRight /></header>
          {attempts.isError ? <p className="profile-error">Не удалось загрузить историю</p> : attempts.isLoading ? <div className="profile-skeleton-list" aria-label="Загрузка истории"><i/><i/><i/></div> : <ActivityRows attempts={attempts.data ?? []} />}
          <b className="profile-more">Вся история →</b>
        </Link>

        <Link className="profile-module profile-account-card" to="/profile/settings">
          <header><div><small>БЕЗОПАСНОСТЬ</small><h2>Аккаунт</h2></div><Settings /></header>
          <dl><div><dt>Имя</dt><dd>{displayName}</dd></div>{profile.data?.username && <div><dt>Username</dt><dd>@{profile.data.username}</dd></div>}<div><dt>Email</dt><dd>{user.email}</dd></div><div><dt>Пароль</dt><dd>••••••••</dd></div></dl>
          <b className="profile-more">Настроить →</b>
        </Link>
      </div>
    </section>
  );
}

export function ProfileHistoryPage() {
  const { user, attempts } = useProfileData(100);
  if (!user) return <section className="page"><h1>Профиль доступен после входа</h1></section>;
  return <><ProfileBack title="История решений"/><section className="profile-detail-page">{attempts.isLoading ? <div className="profile-skeleton-list"><i/><i/><i/></div> : attempts.isError ? <div className="profile-error-panel"><p>Историю не удалось загрузить.</p><button onClick={() => attempts.refetch()}>Повторить</button></div> : <ActivityRows attempts={attempts.data ?? []}/>}</section></>;
}

type SectionStatus = { kind: "idle" | "loading" | "success" | "error"; text?: string };
const idle: SectionStatus = { kind: "idle" };

export function ProfileSettingsPage() {
  const { user, profile } = useProfileData(0);
  const { updateEmail, updatePassword, signOut } = useAuth();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordRepeat, setPasswordRepeat] = useState("");
  const [profileStatus, setProfileStatus] = useState<SectionStatus>(idle);
  const [emailStatus, setEmailStatus] = useState<SectionStatus>(idle);
  const [passwordStatus, setPasswordStatus] = useState<SectionStatus>(idle);
  useEffect(() => { setName(profile.data?.display_name ?? ""); setUsername(profile.data?.username ?? ""); }, [profile.data]);
  if (!user) return <section className="page"><h1>Профиль доступен после входа</h1></section>;
  const normalizedUsername = username.trim().toLowerCase();
  const profileDirty = name.trim() !== (profile.data?.display_name ?? "") || normalizedUsername !== (profile.data?.username ?? "");
  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    if (!/^[a-z0-9_]{3,24}$/.test(normalizedUsername)) { setProfileStatus({kind:"error",text:"Username: 3–24 символа, латиница, цифры и _."}); return; }
    setProfileStatus({kind:"loading"});
    try { await updateProfileIdentity(name.trim(), normalizedUsername); await queryClient.invalidateQueries({queryKey:["profile",user.id]}); setProfileStatus({kind:"success",text:"Профиль сохранён"}); }
    catch (error) { const message = error instanceof Error && /unique|duplicate/i.test(error.message) ? "Этот username уже занят." : "Не удалось сохранить профиль."; setProfileStatus({kind:"error",text:message}); }
  };
  const saveEmail = async (event: FormEvent) => { event.preventDefault(); setEmailStatus({kind:"loading"}); try { await updateEmail(email.trim()); setEmail(""); setEmailStatus({kind:"success",text:"Проверьте новый email и подтвердите изменение."}); } catch { setEmailStatus({kind:"error",text:"Не удалось изменить email."}); } };
  const savePassword = async (event: FormEvent) => { event.preventDefault(); if(password.length < 8){setPasswordStatus({kind:"error",text:"Минимум 8 символов."});return} if(password!==passwordRepeat){setPasswordStatus({kind:"error",text:"Пароли не совпадают."});return} setPasswordStatus({kind:"loading"}); try { await updatePassword(password); setPassword(""); setPasswordRepeat(""); setPasswordStatus({kind:"success",text:"Пароль изменён"}); } catch { setPasswordStatus({kind:"error",text:"Не удалось изменить пароль."}); } };
  return <><ProfileBack title="Аккаунт и безопасность"/><section className="profile-detail-page profile-settings-page">
    <div className="profile-settings-intro"><UserRound/><div><h2>Настройки аккаунта</h2><p>Email остаётся способом входа. Username — уникальный идентификатор профиля.</p></div></div>
    <form className="profile-settings-section" onSubmit={saveProfile}><header><div><small>ПРОФИЛЬ</small><h2>Личные данные</h2></div></header><label>Имя<input value={name} onChange={(e)=>setName(e.target.value)} autoComplete="name" maxLength={80}/></label><label>Username<input value={username} onChange={(e)=>setUsername(e.target.value)} autoComplete="username" spellCheck={false} aria-describedby="username-help"/><small id="username-help">3–24 символа: a–z, 0–9 и _</small></label><Status value={profileStatus}/><button disabled={!profileDirty || profileStatus.kind==="loading"}>{profileStatus.kind==="loading"?"Сохраняем…":"Сохранить профиль"}</button></form>
    <form className="profile-settings-section" onSubmit={saveEmail}><header><div><small>ВХОД</small><h2>Email</h2></div></header><p>Текущий email: <strong>{user.email}</strong></p><label>Новый email<input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} autoComplete="email" required/></label><Status value={emailStatus}/><button disabled={!email.trim() || emailStatus.kind==="loading"}>{emailStatus.kind==="loading"?"Отправляем…":"Изменить email"}</button></form>
    <form className="profile-settings-section" onSubmit={savePassword}><header><div><small>БЕЗОПАСНОСТЬ</small><h2>Изменить пароль</h2></div></header><label>Новый пароль<input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} autoComplete="new-password" minLength={8} required/></label><label>Повторите пароль<input type="password" value={passwordRepeat} onChange={(e)=>setPasswordRepeat(e.target.value)} autoComplete="new-password" minLength={8} required/></label><Status value={passwordStatus}/><button disabled={!password || !passwordRepeat || passwordStatus.kind==="loading"}>{passwordStatus.kind==="loading"?"Сохраняем…":"Изменить пароль"}</button></form>
    <div className="profile-signout"><button className="secondary" onClick={signOut}>Выйти из аккаунта</button></div>
  </section></>;
}

function Status({ value }: { value: SectionStatus }) { if(value.kind==="idle") return null; return <p className={`profile-form-status ${value.kind}`} role={value.kind==="error"?"alert":"status"}>{value.kind==="success"&&<CheckCircle2/>}{value.text}</p>; }
