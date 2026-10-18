/** Appearance selection control: light, dark, or whatever the system uses. */

import { useColorMode } from "../hooks/useColorMode";
import { useI18n } from "../hooks/useI18n";
import { COLOR_MODES, isColorMode } from "../types/colorMode";
import { SegmentedControl } from "./ui/SegmentedControl";

/** Lets the user pin the theme or follow the system. */
export function AppearanceSettings() {
  const { t } = useI18n();
  const { mode, setMode } = useColorMode();

  return (
    <SegmentedControl
      label={t("appearance.title")}
      onChange={(next) => {
        if (isColorMode(next)) {
          void setMode(next);
        }
      }}
      options={COLOR_MODES.map((value) => ({
        label: t(`appearance.${value}`),
        value,
      }))}
      value={mode}
    />
  );
}
