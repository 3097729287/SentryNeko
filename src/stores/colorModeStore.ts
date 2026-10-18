/** Color mode store: the chosen appearance, applied to the document element. */

import { invoke, isTauri } from "@tauri-apps/api/core";
import { create } from "zustand";

import type { ApiResponse } from "../types";
import { isColorMode } from "../types/colorMode";
import type { ColorMode } from "../types/colorMode";

/** Key the boot script in `index.html` reads before the first paint. */
export const COLOR_MODE_STORAGE_KEY = "sentryneko.colorMode";

/** Media query whose answer the `system` mode follows. */
const SYSTEM_QUERY = "(prefers-color-scheme: dark)";

interface ColorModeState {
  mode: ColorMode;
  setMode: (mode: ColorMode) => Promise<void>;
}

function systemTheme(): "dark" | "light" {
  return window.matchMedia(SYSTEM_QUERY).matches ? "dark" : "light";
}

/** Paints the resolved theme and mirrors the choice for the boot script. */
function apply(mode: ColorMode): void {
  const theme = mode === "system" ? systemTheme() : mode;
  const root = document.documentElement;

  root.dataset.theme = theme;
  root.style.colorScheme = theme;

  try {
    localStorage.setItem(COLOR_MODE_STORAGE_KEY, mode);
  } catch {
    // Storage disabled: the page still paints, the choice just does not survive a restart.
  }
}

function mirroredMode(): ColorMode {
  try {
    const stored = localStorage.getItem(COLOR_MODE_STORAGE_KEY);

    return isColorMode(stored) ? stored : "system";
  } catch {
    return "system";
  }
}

let watching = false;

/** Repaints as soon as the system scheme changes, while the choice is `system`. */
function watchSystem(): void {
  if (watching) {
    return;
  }

  watching = true;

  window.matchMedia(SYSTEM_QUERY).addEventListener("change", () => {
    if (useColorModeStore.getState().mode === "system") {
      apply("system");
    }
  });
}

export const useColorModeStore = create<ColorModeState>((set) => ({
  mode: mirroredMode(),
  setMode: async (mode) => {
    apply(mode);
    set({ mode });
    watchSystem();

    if (!isTauri()) {
      return;
    }

    try {
      await invoke<ApiResponse<string>>("set_color_mode", { mode });
    } catch {
      // Backend unreachable (browser preview); the choice holds for this session.
    }
  },
}));

/** Paints the mirrored choice at once, then the mode stored in `config.json`. */
export async function loadColorMode(): Promise<void> {
  const mirrored = mirroredMode();

  apply(mirrored);
  useColorModeStore.setState({ mode: mirrored });
  watchSystem();

  if (!isTauri()) {
    return;
  }

  try {
    const response = await invoke<ApiResponse<string>>("get_color_mode");

    if (isColorMode(response.data)) {
      apply(response.data);
      useColorModeStore.setState({ mode: response.data });
    }
  } catch {
    // Keep the mirrored choice instead of blocking the first render.
  }
}
