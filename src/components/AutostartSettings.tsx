/** The login-entry switch: Windows starts the app in the tray when the user signs in. */

import { useAutostart } from "../hooks/useAutostart";
import { useI18n } from "../hooks/useI18n";

/** One checkbox and the explanation of what it registers. */
export function AutostartSettings() {
  const { t } = useI18n();
  const { enabled, error, loading, setEnabled } = useAutostart();

  return (
    <div className="autostart">
      <h2>{t("autostart.title")}</h2>
      <p className="muted">{t("autostart.description")}</p>
      <label className="autostart-toggle">
        <input
          checked={enabled}
          className="todo-check"
          disabled={loading}
          onChange={(event) => {
            void setEnabled(event.target.checked);
          }}
          type="checkbox"
        />
        <span>{t("autostart.toggle")}</span>
      </label>
      {error !== null ? <p className="error">{t("autostart.error")}</p> : null}
    </div>
  );
}
