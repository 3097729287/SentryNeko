/** Right-click menu items for the dashboard's panels, shared by the page and the layout editor. */

import type { TFunction } from "i18next";

import { ActionIcon } from "../../components/ui/ActionIcon";
import type { ContextMenuItem } from "../../components/ui/ContextMenu";
import { WidgetIcon } from "../../components/ui/WidgetIcon";
import { wantedPlacement } from "../../types/dashboard";
import type { DashboardWidgetId } from "../../types/dashboard";

/** The single action a panel's own menu offers: take it off the grid. */
export function removeWidgetItem(
  id: DashboardWidgetId,
  t: TFunction,
  onSelect: () => void,
): ContextMenuItem {
  return {
    danger: true,
    icon: <ActionIcon name="remove" />,
    label: t("dashboard.layout.remove", { name: t(`dashboard.widget.${id}`) }),
    onSelect,
  };
}

/**
 * The panels a menu can put back on the grid, one item each.
 *
 * A layout holds one of every panel, so adding means returning a parked one; with nothing parked
 * there is nothing to add, and the menu says so rather than opening empty.
 */
export function addWidgetItems(
  parked: readonly DashboardWidgetId[],
  columns: number,
  t: TFunction,
  onSelect: (id: DashboardWidgetId) => void,
): ContextMenuItem[] {
  if (parked.length === 0) {
    return [{ disabled: true, label: t("dashboard.layout.libraryAll"), onSelect: () => undefined }];
  }

  return parked.map((id) => {
    const size = wantedPlacement(id, columns);

    return {
      hint: t("dashboard.widget.size", { h: size.h, w: size.w }),
      icon: <WidgetIcon id={id} />,
      label: t("dashboard.layout.add", { name: t(`dashboard.widget.${id}`) }),
      onSelect: () => {
        onSelect(id);
      },
    };
  });
}
