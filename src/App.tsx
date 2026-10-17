import { HashRouter, Navigate, NavLink, Outlet, Route, Routes } from "react-router-dom";

import { I18nProvider } from "./components/I18nProvider";
import { LanguageSwitcher } from "./components/LanguageSwitcher";
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
  const { t } = useI18n();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">
            <span aria-hidden="true" className="brand-dot" />
            <span className="brand-name">{t("app.name")}</span>
          </span>
          <p className="brand-tagline">{t("app.tagline")}</p>
        </div>
        <nav className="nav">
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
 * Root component: the i18next instance wraps the router, which picks the page for the current
 * address. Routing is hash based on purpose — the packaged application is served from a single
 * document, so a plain path would not survive a reload.
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
