/**
 * Compressão de imagem (portada do CDM, zero-dep).
 * Converte imagens para WebP com qualidade adaptativa usando APIs nativas do
 * browser (OffscreenCanvas + createImageBitmap). Sem libs externas.
 * Usada no upload de recibos/anexos antes de enviar pro backend.
 */

const DEFAULT_MAX_WIDTH = 1920;
const DEFAULT_MAX_HEIGHT = 1080;
const DEFAULT_MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2MB
const DEFAULT_INITIAL_QUALITY = 0.85;
const MIN_QUALITY = 0.3;

interface CompressImageOptions {
  maxWidth?: number;
  maxHeight?: number;
  maxSizeBytes?: number;
  initialQuality?: number;
  format?: "image/webp" | "image/jpeg";
}

interface CompressImageResult {
  blob: Blob;
  file: File;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  width: number;
  height: number;
  quality: number;
}

export async function compressImage(
  input: File | Blob,
  options: CompressImageOptions = {},
): Promise<CompressImageResult> {
  const {
    maxWidth = DEFAULT_MAX_WIDTH,
    maxHeight = DEFAULT_MAX_HEIGHT,
    maxSizeBytes = DEFAULT_MAX_SIZE_BYTES,
    initialQuality = DEFAULT_INITIAL_QUALITY,
    format = "image/webp",
  } = options;

  const originalSize = input.size;

  // Cria o bitmap a partir do arquivo
  const img = await createImageBitmap(input);

  // Calcula dimensões mantendo o aspect ratio
  let width = img.width;
  let height = img.height;

  if (width > maxWidth || height > maxHeight) {
    const ratio = Math.min(maxWidth / width, maxHeight / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  // Desenha no canvas nas dimensões alvo
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to get canvas context");

  ctx.drawImage(img, 0, 0, width, height);

  // Compressão adaptativa: reduz qualidade até ficar abaixo do tamanho máximo
  let quality = initialQuality;
  let blob: Blob;

  do {
    blob = await canvas.convertToBlob({ type: format, quality });

    if (blob.size > maxSizeBytes && quality > MIN_QUALITY) {
      quality -= 0.1;
    }
  } while (blob.size > maxSizeBytes && quality > MIN_QUALITY);

  // Extensão
  const ext = format === "image/webp" ? ".webp" : ".jpg";
  const baseName =
    input instanceof File ? input.name.replace(/\.[^/.]+$/, "") : "image";

  const file = new File([blob], `${baseName}${ext}`, { type: format });

  const compressionRatio =
    originalSize > 0 ? Math.round((1 - blob.size / originalSize) * 100) : 0;

  return {
    blob,
    file,
    originalSize,
    compressedSize: blob.size,
    compressionRatio,
    width,
    height,
    quality,
  };
}

/** Verifica se o arquivo é uma imagem. */
export function isImageFile(file: File): boolean {
  return file.type.startsWith("image/");
}

/** Verifica se o browser suporta encoding WebP. */
export async function supportsWebP(): Promise<boolean> {
  try {
    const canvas = new OffscreenCanvas(1, 1);
    const blob = await canvas.convertToBlob({ type: "image/webp" });
    return blob.type === "image/webp";
  } catch {
    return false;
  }
}
