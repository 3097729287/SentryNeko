/** Panel component behind each dashboard id, shared by the dashboard and its layout editor. */

import type { ComponentType } from "react";

import type { DashboardWidgetId } from "../../types/dashboard";
import { AlarmWidget } from "./AlarmWidget/AlarmWidget";
import { CompletionWidget } from "./CompletionWidget/CompletionWidget";
import { FocusWidget } from "./FocusWidget/FocusWidget";
import { PomodoroWidget } from "./PomodoroWidget/PomodoroWidget";
import { TodosWidget } from "./TodosWidget/TodosWidget";
import { UsageWidget } from "./UsageWidget/UsageWidget";

/** One component per id, rendered both on the page and inside the editor. */
export const DASHBOARD_PANELS: Record<DashboardWidgetId, ComponentType> = {
  alarm: AlarmWidget,
  completion: CompletionWidget,
  focus: FocusWidget,
  pomodoro: PomodoroWidget,
  todos: TodosWidget,
  usage: UsageWidget,
};
