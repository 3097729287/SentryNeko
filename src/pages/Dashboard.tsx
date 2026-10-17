/** Main dashboard page. */

import { useI18n } from "../hooks/useI18n";

/** Renders the dashboard landing page. */
export function Dashboard() {
  const { t } = useI18n();

  return <h1>{t("nav.dashboard")}</h1>;
}
