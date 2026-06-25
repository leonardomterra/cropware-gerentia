import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/inter-tight";
import "@fontsource/alumni-sans/600.css";
import "@fontsource/alumni-sans/800.css";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource-variable/mozilla-headline";
import "@fontsource-variable/mozilla-text";
import "@fontsource/space-mono/400.css";
import "@fontsource/space-mono/700.css";
import "./app.css";
import App from "./App";
import { isCapacitorIOS, isNativeCapacitorApp } from "./utils/platform";

// No iOS nativo, ativa a marca/fonte específica (.native-ios vive no app.css).
if (isCapacitorIOS()) {
  document.documentElement.classList.add("native-ios");
}

// App nativo (iOS/Android): status bar combinando com o header (zinc-600), ícones
// claros sobre fundo escuro. Import dinâmico — o plugin só existe no app nativo.
if (isNativeCapacitorApp()) {
  import("@capacitor/status-bar")
    .then(({ StatusBar, Style }) => {
      StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {});
      StatusBar.setStyle({ style: Style.Light }).catch(() => {});
      StatusBar.setBackgroundColor({ color: "#52525b" }).catch(() => {});
    })
    .catch(() => {});

  // RevenueCat (compra in-app). No-op sem a API key configurada — ver
  // src/lib/revenuecat.ts. A identidade do usuário é ligada no login (AppShell).
  import("./lib/revenuecat")
    .then((m) => m.initRevenueCat().catch(() => {}))
    .catch(() => {});
}

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element #root not found");

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
