import { isNativeCapacitorApp } from "./platform";

/**
 * Exportação de arquivos que funciona no web E no app nativo (iOS/Android).
 *
 * No web: download normal do navegador (`<a download>`).
 * No nativo: o WKWebView do iOS não suporta download de Blob/`<a download>`/
 * `window.open` de Blob URL — então gravamos o arquivo no Filesystem (cache) e
 * abrimos a folha de compartilhamento nativa (salvar em Arquivos, enviar por
 * email/WhatsApp, imprimir, etc.).
 */

/** Remove caracteres inválidos de path, preservando extensão. */
function sanitizeFilename(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, "-").replace(/\s+/g, " ").trim();
}

/** Converte string ou Blob em base64 (sem o prefixo data:). */
async function toBase64(
  data: string | Blob,
  mimeType: string,
): Promise<string> {
  const blob =
    data instanceof Blob ? data : new Blob([data], { type: mimeType });
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const res = reader.result as string; // "data:<mime>;base64,XXXX"
      resolve(res.slice(res.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function webDownload(
  filename: string,
  data: string | Blob,
  mimeType: string,
): void {
  const blob =
    data instanceof Blob ? data : new Blob([data], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Exporta um arquivo. No web baixa; no nativo grava e abre a folha de
 * compartilhamento. `data` pode ser texto (CSV) ou Blob (PDF).
 */
export async function exportFile(
  filename: string,
  data: string | Blob,
  mimeType: string,
): Promise<void> {
  const safeName = sanitizeFilename(filename);
  if (!isNativeCapacitorApp()) {
    webDownload(safeName, data, mimeType);
    return;
  }
  const [{ Filesystem, Directory }, { Share }] = await Promise.all([
    import("@capacitor/filesystem"),
    import("@capacitor/share"),
  ]);
  const base64 = await toBase64(data, mimeType);
  await Filesystem.writeFile({
    path: safeName,
    data: base64,
    directory: Directory.Cache,
  });
  const { uri } = await Filesystem.getUri({
    path: safeName,
    directory: Directory.Cache,
  });
  await Share.share({ title: safeName, url: uri });
}

/**
 * Abre uma "página de relatório" HTML.
 * No web: abre em nova aba (com botão de imprimir/salvar PDF).
 * No nativo: compartilha o .html — o usuário abre no Safari e usa
 * Compartilhar → Imprimir → Salvar em PDF.
 */
export async function openReportHtml(
  filename: string,
  html: string,
): Promise<void> {
  if (!isNativeCapacitorApp()) {
    const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    const win = window.open(url, "_blank");
    if (win) {
      win.focus();
    } else {
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.rel = "noopener";
      a.click();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return;
  }
  await exportFile(filename, html, "text/html");
}

/**
 * Abre uma URL http(s) externa (ex.: visualizar anexo).
 * No web: nova aba. No nativo: navegador in-app (Safari View Controller).
 */
export async function openExternalUrl(url: string): Promise<void> {
  if (!isNativeCapacitorApp()) {
    window.open(url, "_blank", "noopener");
    return;
  }
  const { Browser } = await import("@capacitor/browser");
  await Browser.open({ url });
}
