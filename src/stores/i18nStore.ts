/** Language state store. */

import { invoke, isTauri } from "@tauri-apps/api/core";
import { create } from "zustand";

import i18n from "../i18n";
import { AVAILABLE_LANGUAGES, DEFAULT_LANGUAGE, isAvailableLanguage } from "../i18n/config";
import type { ApiResponse } from "../types";
import type { LanguageCode, LanguageOption } from "../types/i18n";

interface I18nState {
  language: LanguageCode;
  languages: readonly LanguageOption[];
  setLanguage: (language: LanguageCode) => Promise<void>;
}

/** Applies a language to i18next and to the document element. */
async function applyLanguage(language: LanguageCode): Promise<void> {
  await i18n.changeLanguage(language);
  document.documentElement.lang = language;
}

/** Reads the tag stored in `config.json` by `config.rs`, falling back to the default. */
async function readPersistedLanguage(): Promise<LanguageCode> {
  if (!isTauri()) {
    return DEFAULT_LANGUAGE;
  }

  try {
    const response = await invoke<ApiResponse<string>>("get_language");

    return isAvailableLanguage(response.data) ? response.data : DEFAULT_LANGUAGE;
  } catch {
    // Transport-level failure: fall back instead of blocking the first render.
    return DEFAULT_LANGUAGE;
  }
}

export const useI18nStore = create<I18nState>((set) => ({
  language: DEFAULT_LANGUAGE,
  languages: AVAILABLE_LANGUAGES,
  setLanguage: async (language) => {
    await applyLanguage(language);
    set({ language });

    if (!isTauri()) {
      return;
    }

    try {
      await invoke<ApiResponse<string>>("set_language", { language });
    } catch {
      // The backend is unreachable (browser preview); the choice holds for this session.
    }
  },
}));

/** Resolves the stored language and applies it; call it before the first render. */
export async function loadLanguage(): Promise<void> {
  const language = await readPersistedLanguage();

  await applyLanguage(language);
  useI18nStore.setState({ language });
}
