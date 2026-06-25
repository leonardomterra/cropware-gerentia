import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Config Capacitor — minimalista de propósito (padrão herdado do Cropware).
 * Plugins (StatusBar, etc.) são configurados em runtime no main.tsx, não aqui —
 * mais fácil de debugar e mais flexível.
 *
 * webDir = "build" (saída do Vite). A API continua remota (Supabase edge); o app
 * empacota só o shell web local.
 */
const config: CapacitorConfig = {
  appId: "app.gerentia",
  appName: "Gerentia",
  webDir: "build",
};

export default config;
