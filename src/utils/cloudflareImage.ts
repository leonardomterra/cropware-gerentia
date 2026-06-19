/**
 * Cloudflare Image Transformations — envolve uma URL (R2 presigned) numa
 * transformação servida pelo CDN da Cloudflare (resize/format/quality).
 * Portado do CDM (`cloudflare_transform.tsx`).
 *
 * **Por que existe:** processar imagem no edge Deno não é viável (imagescript
 * falha). A Cloudflare faz no nível da URL, sem código no servidor — usamos só
 * na EXIBIÇÃO (uploads do app já sobem em WebP; o WhatsApp guarda o original).
 *
 * **URL final:** https://gerentia.app/cdn-cgi/image/<options>/<source-url>
 *
 * Requer Image Transformations ativo na zona `gerentia.app`. Enquanto não
 * estiver, deixe `VITE_CF_IMAGE_RESIZING` desligado: o helper devolve o URL
 * presigned cru (fallback) e o visualizador funciona normalmente.
 */

const CF_TRANSFORM_BASE = "https://gerentia.app/cdn-cgi/image";

/** Liga/desliga o wrap da Cloudflare (default: desligado → presigned cru). */
const CF_ENABLED = import.meta.env.VITE_CF_IMAGE_RESIZING === "true";

export type ImageVariant = "thumbnail" | "full";

const VARIANT_OPTS: Record<ImageVariant, string> = {
  // Miniatura pra listagens/grid
  thumbnail: "width=300,height=300,fit=cover,format=webp,quality=75",
  // Documento inteiro (sem crop) pra visualização
  full: "width=1600,fit=scale-down,format=webp,quality=82",
};

/**
 * Envolve uma URL absoluta numa transformação Cloudflare. Idempotente e seguro:
 * se as transformações estão desligadas, a URL é vazia, ou já contém
 * /cdn-cgi/image/, devolve a original (fallback pro presigned cru).
 */
export function transformImageUrl(
  originalUrl: string | null | undefined,
  variant: ImageVariant,
): string {
  if (!originalUrl) return originalUrl ?? "";
  if (!CF_ENABLED) return originalUrl;
  if (originalUrl.includes("/cdn-cgi/image/")) return originalUrl;
  return `${CF_TRANSFORM_BASE}/${VARIANT_OPTS[variant]}/${originalUrl}`;
}
