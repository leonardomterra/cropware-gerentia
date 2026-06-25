import { Capacitor } from "@capacitor/core";
import {
  Purchases,
  type PurchasesPackage,
} from "@revenuecat/purchases-capacitor";
import { isNativeCapacitorApp } from "@/utils/platform";

/**
 * Wrapper do RevenueCat (compra in-app: Play Billing no Android, StoreKit no iOS).
 *
 * Tudo é GUARDADO: sem app nativo ou sem a API key (env), as funções são no-op /
 * retornam vazio. Assim o app web e o nativo "sem produtos" se comportam igual ao
 * de hoje (checkout do Mercado Pago segue só no web; ver SubscriptionCard).
 *
 * Pra ATIVAR a venda no app (ver docs/ANDROID.md §4 e docs/IOS.md §4):
 *  1. Criar produtos de assinatura na Play / App Store Connect.
 *  2. Mapear no painel do RevenueCat + webhook -> /gerentia-api/webhook/revenuecat.
 *  3. Setar as chaves: VITE_REVENUECAT_ANDROID_KEY / VITE_REVENUECAT_IOS_KEY.
 */

function apiKey(): string | undefined {
  const platform = Capacitor.getPlatform();
  if (platform === "ios") {
    return import.meta.env.VITE_REVENUECAT_IOS_KEY as string | undefined;
  }
  if (platform === "android") {
    return import.meta.env.VITE_REVENUECAT_ANDROID_KEY as string | undefined;
  }
  return undefined;
}

/** True só no app nativo COM a chave configurada. Gate de todo o resto. */
export function isRevenueCatConfigured(): boolean {
  return isNativeCapacitorApp() && !!apiKey();
}

let configured = false;

/** Configura o SDK (1x no boot). No-op fora do nativo / sem chave. */
export async function initRevenueCat(appUserID?: string): Promise<void> {
  if (!isRevenueCatConfigured() || configured) return;
  await Purchases.configure({ apiKey: apiKey()!, appUserID });
  configured = true;
}

/** Liga a assinatura ao usuário logado (chamar no login). */
export async function identifyRevenueCatUser(appUserID: string): Promise<void> {
  if (!isRevenueCatConfigured()) return;
  if (!configured) {
    await initRevenueCat(appUserID);
    return;
  }
  await Purchases.logIn({ appUserID });
}

/** Desvincula no logout (vira usuário anônimo). */
export async function logoutRevenueCatUser(): Promise<void> {
  if (!isRevenueCatConfigured() || !configured) return;
  try {
    await Purchases.logOut();
  } catch {
    /* usuário anônimo não pode deslogar — ignorar */
  }
}

export interface RcPackage {
  id: string;
  title: string;
  priceString: string;
  raw: PurchasesPackage;
}

/** Pacotes da oferta atual (vazio se não houver produtos configurados). */
export async function loadOfferingPackages(): Promise<RcPackage[]> {
  if (!isRevenueCatConfigured()) return [];
  const offerings = await Purchases.getOfferings();
  const pkgs = offerings.current?.availablePackages ?? [];
  return pkgs.map((p) => ({
    id: p.identifier,
    title: p.product.title,
    priceString: p.product.priceString,
    raw: p,
  }));
}

function hasActiveEntitlement(info: {
  entitlements: { active: Record<string, unknown> };
}): boolean {
  return Object.keys(info.entitlements?.active ?? {}).length > 0;
}

/** Compra um pacote. Retorna se ficou com assinatura ativa. */
export async function purchasePackage(
  pkg: PurchasesPackage,
): Promise<{ active: boolean }> {
  const res = await Purchases.purchasePackage({ aPackage: pkg });
  return { active: hasActiveEntitlement(res.customerInfo) };
}

/** Restaura compras (obrigatório ter esse botão na Apple). */
export async function restorePurchases(): Promise<{ active: boolean }> {
  const res = await Purchases.restorePurchases();
  return { active: hasActiveEntitlement(res.customerInfo) };
}
