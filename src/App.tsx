import { useLayoutEffect, useRef, useState } from "react";
import { HashRouter, Navigate, NavLink, Outlet, Route, Routes, useLocation } from "react-router-dom";

import { I18nProvider } from "./components/I18nProvider";
import { TitleBar } from "./components/TitleBar";
import { ToastHost } from "./components/ToastHost";
import { useI18n } from "./hooks/useI18n";
import { BACKEND_EVENTS, useTauriEvent } from "./hooks/useTauriEvent";
import { AlarmsPage } from "./pages/AlarmsPage";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import { Dashboard } from "./pages/Dashboard";
import { EventsPage } from "./pages/EventsPage";
import { HeatmapPage } from "./pages/HeatmapPage";
import { PomodoroPage } from "./pages/PomodoroPage";
import { SettingsPage } from "./pages/SettingsPage";
import { TodosPage } from "./pages/TodosPage";
import { useAppEventStore } from "./stores/appEventStore";
import type { AppEvent } from "./types/appEvent";

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
  const recordAppSwitch = useAppEventStore((state) => state.record);
  const navRef = useRef<HTMLElement>(null);
  const { pathname } = useLocation();
  // Null until the first measurement: the highlight must appear already in place instead of
  // sliding in from the top of the list on mount.
  const [indicator, setIndicator] = useState<{ top: number; height: number } | null>(null);

  // The shell owns the push, so the live tail keeps growing while another page is mounted.
  useTauriEvent<AppEvent>(BACKEND_EVENTS.appSwitch, recordAppSwitch);

  // The sliding highlight is placed from the active link, so no geometry is hard-coded.
  useLayoutEffect(() => {
    const active = navRef.current?.querySelector<HTMLElement>('[aria-current="page"]');

    if (!active) {
      return;
    }

    const next = { top: active.offsetTop, height: active.offsetHeight };

    setIndicator((current) =>
      current && current.top === next.top && current.height === next.height ? current : next,
    );
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
          {indicator ? (
            <span
              aria-hidden="true"
              className="nav-indicator"
              style={{ height: indicator.height, transform: `translateY(${indicator.top}px)` }}
            />
          ) : null}
          {PAGES.map(({ path, label }) => (
            <NavLink className="nav-link" end={path === "/"} key={path} to={path}>
              {t(label)}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="content">
        <Outlet />
      </main>
      <ToastHost />
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
