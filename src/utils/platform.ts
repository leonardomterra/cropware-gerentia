import { Capacitor } from "@capacitor/core";

export function isNativeCapacitorApp() {
  return Capacitor.isNativePlatform();
}

export function isCapacitorIOS() {
  return Capacitor.getPlatform() === "ios" && Capacitor.isNativePlatform();
}

/** Domínio público do app web — alvo dos redirects de e-mail no app nativo. */
const WEB_APP_URL = "https://gerentia.app";

/** Base de URL pros redirects de e-mail (recovery/invite/signup). No web usa a
 *  origin atual (dev e prod funcionam); no app nativo a origin é
 *  `capacitor://localhost`, então aponta pro domínio público (que depois faz
 *  deep-link de volta pro app). */
export function appRedirectBase(): string {
  return isNativeCapacitorApp() ? WEB_APP_URL : window.location.origin;
}
