import { useLayoutEffect, useRef, useState } from "react";
import { HashRouter, Navigate, NavLink, Outlet, Route, Routes, useLocation } from "react-router-dom";

import { I18nProvider } from "./components/I18nProvider";
import { LanguageSwitcher } from "./components/LanguageSwitcher";
import { TitleBar } from "./components/TitleBar";
import { useI18n } from "./hooks/useI18n";
import { AlarmsPage } from "./pages/AlarmsPage";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import { Dashboard } from "./pages/Dashboard";
import { EventsPage } from "./pages/EventsPage";
import { HeatmapPage } from "./pages/HeatmapPage";
import { PomodoroPage } from "./pages/PomodoroPage";
import { SettingsPage } from "./pages/SettingsPage";
import { TodosPage } from "./pages/TodosPage";

/** Every page of the shell, in navigation order; each label doubles as the page heading. */
const PAGES = [
  { path: "/", label: "nav.dashboard", Page: Dashboard },
  { path: "/todos", label: "nav.todos", Page: TodosPage },
  { path: "/pomodoro", label: "nav.pomodoro", Page: PomodoroPage },
  { path: "/heatmap", label: "nav.heatmap", Page: HeatmapPage },
  { path: "/alarms", label: "nav.alarms", Page: AlarmsPage },
  { path: "/events", label: "nav.events", Page: EventsPage },
  { path: "/analytics", label: "nav.analytics", Page: AnalyticsPage },
  { path: "/settings", label: "nav.settings", Page: SettingsPage },
] as const;

/** Window frame shared by every page: brand, navigation and language choice. */
function Shell() {
  const { t, language } = useI18n();
  const navRef = useRef<HTMLElement>(null);
  const { pathname } = useLocation();
  const [indicator, setIndicator] = useState({ top: 0, height: 0 });

  // The sliding highlight is placed from the active link, so no geometry is hard-coded.
  useLayoutEffect(() => {
    const active = navRef.current?.querySelector<HTMLElement>('[aria-current="page"]');

    setIndicator({ top: active?.offsetTop ?? 0, height: active?.offsetHeight ?? 0 });
  }, [pathname, language]);

  return (
    <div className="app-shell">
      <TitleBar />
      <aside className="sidebar" data-tauri-drag-region="deep">
        <div className="brand">
          <span className="brand-mark">
            <span aria-hidden="true" className="brand-dot" />
            <span className="brand-name">{t("app.name")}</span>
          </span>
          <p className="brand-tagline">{t("app.tagline")}</p>
        </div>
        <nav className="nav" ref={navRef}>
          <span
            aria-hidden="true"
            className="nav-indicator"
            style={{ height: indicator.height, transform: `translateY(${indicator.top}px)` }}
          />
          {PAGES.map(({ path, label }) => (
            <NavLink className="nav-link" end={path === "/"} key={path} to={path}>
              {t(label)}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <LanguageSwitcher />
        </div>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}

/**
 * Root component: the i18n provider wraps the router that picks the page. Hash routing keeps
 * reloads working, because the packaged app is served from a single document.
 */
export default function App() {
  return (
    <I18nProvider>
      <HashRouter>
        <Routes>
          <Route element={<Shell />}>
            {PAGES.map(({ path, Page }) => (
              <Route element={<Page />} key={path} path={path} />
            ))}
          </Route>
          <Route element={<Navigate replace to="/" />} path="*" />
        </Routes>
      </HashRouter>
    </I18nProvider>
  );
}
