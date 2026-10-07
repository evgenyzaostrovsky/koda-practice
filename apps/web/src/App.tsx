import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./auth";
import { AlertTriangle, Award, BookOpen, ChartNoAxesCombined, Circle, Code2, Flame, FlaskConical, Home, Layers3, Menu, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { Fragment, lazy, Suspense, useEffect, useState } from "react";
import { Link, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { BrandMark } from "./BrandMark";
import { KnowledgeArticle, KnowledgeIndex } from "./Knowledge";
import { ProfileHistoryPage, ProfilePage, ProfileSettingsPage } from "./ProfilePage";
import { Sandbox } from "./Sandbox";
import { AchievementCelebrationQueue } from "./achievements/AchievementCelebration";
import { AchievementsPage } from "./achievements/AchievementsPage";
import { completeAchievementSession, observeMasteryProgress } from "./achievements/engine";
import { Catalog } from "./pages/Catalog";
import { Dashboard } from "./pages/Dashboard";
import { Errors } from "./pages/Errors";
import { ProgressPage } from "./pages/ProgressPage";
import { TopicPage } from "./pages/TopicPage";
import { Practice } from "./practice/Practice";
const DesignPrototype = lazy(() => import("./pages/DesignPrototype").then(module => ({ default: module.DesignPrototype })));
import { progressQ } from "./queries";
import { loadLastTask } from "./task-storage";
import { KodaBadge, KodaBook, KodaCodePath, KodaHome, KodaLab, KodaModules, KodaProfile, KodaSignal, KodaTrace } from "./koda-icons";
const DesignSystem = lazy(() => import("./pages/DesignSystem").then(module => ({ default: module.DesignSystem })));
function Layout() {
  const [mob, setMob] = useState(false),
    [collapsed, setCollapsed] = useState(
      () => localStorage.getItem("koda:sidebar") === "collapsed",
    );
  const { pathname } = useLocation();
  const { user } = useAuth();
  const lastPracticeTask = loadLastTask();
  const focus = pathname.startsWith("/practice/");
  const { data: p } = useQuery({ queryKey: ["progress"], queryFn: progressQ });
  useEffect(() => {
    const complete = () => completeAchievementSession();
    window.addEventListener("pagehide", complete);
    return () => window.removeEventListener("pagehide", complete);
  }, []);
  useEffect(() => {
    if(p?.modules) observeMasteryProgress(p.modules);
  }, [p?.modules]);
  useEffect(() => {
    if (!mob) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setMob(false); document.querySelector<HTMLButtonElement>(".mobile-menu")?.focus(); }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [mob]);
  const toggle = () =>
    setCollapsed((x) => {
      localStorage.setItem("koda:sidebar", x ? "open" : "collapsed");
      return !x;
    });
  return (
    <div
      className={`app compact-app ${focus ? "practice-shell" : ""} ${collapsed ? "sidebar-collapsed" : ""}`}
    >
      {(
        <>
          {mob && <button className="air-nav-backdrop" aria-label="Закрыть навигацию" onClick={() => setMob(false)} />}
          <button className="mobile-menu" aria-label={mob ? "Закрыть меню" : "Открыть меню"} aria-expanded={mob} onClick={() => setMob(!mob)}>
            {mob ? <X /> : <Menu />}
          </button>
          <aside className={mob ? "open" : ""}>
            <div className="side-brand">
              <Link
                className="logo"
                to="/"
                onClick={() => setMob(false)}
                title="KODA Practice"
              >
                <span>
                  <BrandMark size={20} />
                </span>
                <b>koda</b>

              </Link>
              <button
                className="collapse-side"
                onClick={toggle}
                aria-label={collapsed ? "Развернуть меню" : "Свернуть меню"}
              >
                {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
              </button>
            </div>
            <nav>
              <small className="air-nav-label">УЧИТЬСЯ</small>
              {[
                [KodaHome, "Главная", "/"],
                [
                  KodaCodePath,
                  "Практика",
                  lastPracticeTask
                    ? `/practice/${lastPracticeTask}`
                    : "/catalog",
                ],
                [KodaBook, "База знаний", "/knowledge"],
                [KodaLab, "Песочница", "/sandbox"],
                [KodaSignal, "Прогресс", "/progress"],
                [KodaTrace, "Ошибки", "/errors"],
                [KodaBadge, "Достижения", "/achievements"],
                [KodaProfile, "История", "/profile/history"],
               ].map(([I, t, to], index) => (
                <Fragment key={String(t)}>
                {index === 4 && <small className="air-nav-label air-tools-label">ВАШ ПУТЬ</small>}
                <NavLink
                  key={String(t)}
                  to={String(to)}
                  title={String(t)}
                  onClick={() => setMob(false)}
                  end={to === "/"}
                >
                  {<I size={17} />}
                  <span>{String(t)}</span>
                </NavLink>
                </Fragment>
              ))}
            </nav>
            <div className="side-foot">
              <Flame size={16} />
              <span>Локальный прогресс</span>
            </div>
          </aside>
        </>
      )}
      <main className={`compact-main compact-${pathname.startsWith("/practice/") ? "practice" : pathname.startsWith("/topics/") ? "topic" : pathname.startsWith("/knowledge/") ? "material" : pathname === "/" ? "home" : pathname.split("/").filter(Boolean).join("-")}`}>
        <Link className="compact-profile-link" to="/profile" aria-label="Открыть профиль">
          <span className="compact-profile-avatar">{(user?.user_metadata?.display_name || user?.email || "П").trim().charAt(0).toLocaleUpperCase("ru")}</span>
          <span><b>{user?.user_metadata?.display_name || user?.email?.split("@")[0] || "Ваш профиль"}</b><small>Профиль →</small></span>
        </Link>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/catalog" element={<Catalog />} />
          <Route path="/topics/:slug" element={<TopicPage />} />
          <Route path="/practice/:eid" element={<Practice />} />
          <Route path="/knowledge" element={<KnowledgeIndex />} />
          <Route path="/sandbox" element={<Sandbox />} />
          <Route
            path="/knowledge/:articleSlug"
            element={<KnowledgeArticle />}
          />
          <Route path="/errors" element={<Errors />} />
          <Route path="/progress" element={<ProgressPage />} />
          <Route path="/achievements" element={<AchievementsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/profile/history" element={<ProfileHistoryPage />} />
          <Route path="/profile/settings" element={<ProfileSettingsPage />} />
        </Routes>
      </main>
      <AchievementCelebrationQueue />
    </div>
  );
}
export default function App() {
  return <Routes><Route path="/design-system" element={<Suspense fallback={<div>Загрузка UI Kit…</div>}><DesignSystem /></Suspense>} /><Route path="/design-prototype" element={<Suspense fallback={<div>Загрузка демо…</div>}><DesignPrototype /></Suspense>} /><Route path="/*" element={<Layout />} /></Routes>;
}

