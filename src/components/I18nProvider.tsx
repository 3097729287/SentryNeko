/** i18n provider bound to the language store. */

import type { ReactNode } from "react";
import { I18nextProvider } from "react-i18next";

import i18n from "../i18n";

/** Mounts the shared i18next instance, so everything below can translate. */
export function I18nProvider({ children }: { children: ReactNode }) {
  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
