import { I18nProvider } from "./components/I18nProvider";
import { LanguageSwitcher } from "./components/LanguageSwitcher";
import { useI18n } from "./hooks/useI18n";

/** Placeholder shell: routing and page layout arrive with T09. */
function Shell() {
  const { t } = useI18n();

  return (
    <main>
      <h1>{t("app.name")}</h1>
      <p>{t("app.tagline")}</p>
      <LanguageSwitcher />
    </main>
  );
}

/** Root component. */
export default function App() {
  return (
    <I18nProvider>
      <Shell />
    </I18nProvider>
  );
}
