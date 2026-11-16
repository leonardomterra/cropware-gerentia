import { Geolocation } from "@capacitor/geolocation";
import { isNativeCapacitorApp } from "./platform";

/**
 * Posição do aparelho — no app nativo pelo plugin do Capacitor (que pede a
 * permissão de localização), na web pelo navegador. Portado do Flag Field.
 *
 * O plugin nativo só passa a valer no próximo build das lojas (precisa de
 * `npx cap sync`); até lá, o app nativo antigo nem chama isto.
 */
export interface PosicaoDoAparelho {
  latitude: number;
  longitude: number;
  /** Precisão em metros. */
  precisao: number;
}

export async function posicaoAtual(
  opcoes: { altaPrecisao?: boolean; timeoutMs?: number } = {},
): Promise<PosicaoDoAparelho> {
  const options = {
    enableHighAccuracy: opcoes.altaPrecisao ?? true,
    timeout: opcoes.timeoutMs ?? 10000,
    maximumAge: 0,
  };

  if (isNativeCapacitorApp()) {
    const perm = await Geolocation.checkPermissions().catch(() => null);
    if (!perm || perm.location !== "granted") {
      await Geolocation.requestPermissions();
    }
    const p = await Geolocation.getCurrentPosition(options);
    return {
      latitude: p.coords.latitude,
      longitude: p.coords.longitude,
      precisao: p.coords.accuracy,
    };
  }

  if (typeof navigator === "undefined" || !navigator.geolocation) {
    throw new Error("Este aparelho não informa a localização.");
  }
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (p) =>
        resolve({
          latitude: p.coords.latitude,
          longitude: p.coords.longitude,
          precisao: p.coords.accuracy,
        }),
      () =>
        reject(
          new Error(
            "Não foi possível obter a localização. Confira a permissão.",
          ),
        ),
      options,
    );
  });
}
