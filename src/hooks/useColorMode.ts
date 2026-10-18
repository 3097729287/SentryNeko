/** Color mode hook: the chosen appearance plus the action that changes it. */

import { useColorModeStore } from "../stores/colorModeStore";
import type { ColorMode } from "../types/colorMode";

export interface UseColorModeResult {
  mode: ColorMode;
  setMode: (mode: ColorMode) => Promise<void>;
}

/** Appearance and switching for a component. */
export function useColorMode(): UseColorModeResult {
  const mode = useColorModeStore((state) => state.mode);
  const setMode = useColorModeStore((state) => state.setMode);

  return { mode, setMode };
}
