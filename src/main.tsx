import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/inter-tight";
import "@fontsource/alumni-sans/600.css";
import "@fontsource/alumni-sans/800.css";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource-variable/mozilla-text";
// Nome dos módulos no selo do menu ("finance", "field"), 18/11/2026.
import "@fontsource/press-start-2p/latin-400.css";
import "@fontsource/space-mono/400.css";
import "@fontsource/space-mono/700.css";
import "./app.css";
import App from "./App";
import { iniciarTema } from "./lib/tema";
import { isCapacitorIOS, isNativeCapacitorApp } from "./utils/platform";

// No iOS nativo, ativa a marca/fonte específica (.native-ios vive no app.css).
if (isCapacitorIOS()) {
  document.documentElement.classList.add("native-ios");
}

// Tema claro/escuro (lib/tema.ts): classe .dark no <html>, cor do navegador e
// barra de status do app nativo. O index.html já aplicou a classe antes do
// React; aqui liga o resto e passa a seguir o sistema.
iniciarTema();

// App nativo (iOS/Android): a status bar não sobrepõe a página. Cor e estilo
// (ícones claros/escuros) vêm do tema — lib/tema.ts, pintarBarraDeStatus.
if (isNativeCapacitorApp()) {
  import("@capacitor/status-bar")
    .then(({ StatusBar }) => {
      StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {});
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
