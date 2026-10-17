import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import { loadLanguage } from "./stores/i18nStore";

async function render(): Promise<void> {
  // The chosen language lives in `config.json`; resolving it before the first paint keeps
  // the interface from flashing the default locale.
  await loadLanguage();

  const container = document.getElementById("root");

  if (!container) {
    return;
  }

  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void render();
