/** Color mode chosen in the settings page and persisted in `config.json`. */

export type ColorMode = "dark" | "light" | "system";

/** Every mode, in the order the switcher shows them. */
export const COLOR_MODES = ["light", "dark", "system"] as const satisfies readonly ColorMode[];

/** Whether `value` is one of the persisted modes. */
export function isColorMode(value: unknown): value is ColorMode {
  return COLOR_MODES.some((mode) => mode === value);
}
