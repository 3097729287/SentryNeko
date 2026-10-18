/** Task list layouts persisted by the settings commands. */
export const TODO_DISPLAY_MODES = ["separated", "merged", "twoColumns"] as const;

export type TodoDisplayMode = (typeof TODO_DISPLAY_MODES)[number];

export function isTodoDisplayMode(value: unknown): value is TodoDisplayMode {
  return TODO_DISPLAY_MODES.some((mode) => mode === value);
}
