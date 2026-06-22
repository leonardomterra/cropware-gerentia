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
import { isCapacitorIOS } from "./utils/platform";

// No iOS nativo, ativa a marca/fonte específica (.native-ios vive no app.css).
if (isCapacitorIOS()) {
  document.documentElement.classList.add("native-ios");
}

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element #root not found");

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
