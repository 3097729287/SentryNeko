/** Dashboard: today's focus, the timer, the tasks and the next reminder at a glance. */

import { useI18n } from "../../hooks/useI18n";
import { AlarmWidget } from "./AlarmWidget";
import { CompletionWidget } from "./CompletionWidget";
import { FocusWidget } from "./FocusWidget";
import { PomodoroWidget } from "./PomodoroWidget";
import { TodosWidget } from "./TodosWidget";
import { UsageWidget } from "./UsageWidget";

/** Renders the dashboard: each panel loads its own data, so one slow call never blocks the rest. */
export function Dashboard() {
  const { t } = useI18n();

  return (
    <>
      <h1>{t("nav.dashboard")}</h1>
      <div className="dash">
        <FocusWidget />
        <PomodoroWidget />
        <CompletionWidget />
        <TodosWidget />
        <UsageWidget />
        <AlarmWidget />
      </div>
    </>
  );
}
