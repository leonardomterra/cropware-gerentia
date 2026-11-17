import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import Camera from "~icons/ph/camera";
import FilePdf from "~icons/ph/file-pdf";
import X from "~icons/ph/x";
import { api } from "@/utils/api";
import { compressImage } from "@/utils/imageCompression";
import { Button } from "@/components/ui/button";

/**
 * Fotos e arquivos de uma atividade ou avaliação de ensaio (fase 5). Sobem
 * para o R2 privado (handlers/anexosDoCampo.ts) e o registro guarda só a key;
 * para ver, a tela pede um link temporário. Foto é comprimida antes de subir
 * (o mesmo compressor dos recibos).
 */
export interface AnexoDoCampo {
  key: string;
  nome: string;
  mime: string;
  tamanho: number;
}

const LIMITE = 10;

function paraBase64(blob: Blob): Promise<string> {
  return new Promise((ok, falha) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result));
    r.onerror = () => falha(r.error);
    r.readAsDataURL(blob);
  });
}

/** Links temporários já pedidos (valem 5 min; renova depois de 4). */
const links = new Map<string, { url: string; quando: number }>();
async function linkDe(key: string): Promise<string> {
  const hit = links.get(key);
  if (hit && Date.now() - hit.quando < 4 * 60e3) return hit.url;
  const { url } = await api<{ url: string }>(
    `/campo/anexos/url?key=${encodeURIComponent(key)}`,
    {
      method: "GET",
    },
  );
  links.set(key, { url, quando: Date.now() });
  return url;
}

function Miniatura({
  a,
  aoRemover,
}: {
  a: AnexoDoCampo;
  aoRemover?: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const imagem = a.mime.startsWith("image/");
  useEffect(() => {
    if (!imagem) return;
    let vivo = true;
    linkDe(a.key)
      .then((u) => vivo && setUrl(u))
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [a.key, imagem]);

  return (
    <div className="relative size-20 rounded-md border border-slate-200 bg-slate-50 overflow-hidden">
      <button
        type="button"
        title={a.nome}
        className="size-full flex items-center justify-center"
        onClick={async () => {
          try {
            window.open(await linkDe(a.key), "_blank", "noopener");
          } catch {
            toast.error("Não foi possível abrir o arquivo.");
          }
        }}
      >
        {imagem ? (
          url ? (
            <img src={url} alt={a.nome} className="size-full object-cover" />
          ) : (
            <span className="text-[10px] text-slate-400">carregando</span>
          )
        ) : (
          <FilePdf className="size-8 text-red-700" />
        )}
      </button>
      {aoRemover && (
        <button
          type="button"
          aria-label={`Remover ${a.nome}`}
          onClick={aoRemover}
          className="absolute top-0.5 right-0.5 size-5 rounded-full bg-black/60 text-branco flex items-center justify-center"
        >
          <X className="size-3" />
        </button>
      )}
    </div>
  );
}

export function AnexosDoCampo({
  anexos,
  aoMudar,
  somenteLeitura,
}: {
  anexos: AnexoDoCampo[];
  aoMudar: (a: AnexoDoCampo[]) => void;
  somenteLeitura?: boolean;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const [subindo, setSubindo] = useState(0);
  const atual = useRef(anexos);
  atual.current = anexos;

  async function subir(arquivos: FileList) {
    const lista = [...arquivos].slice(0, LIMITE - anexos.length);
    if (arquivos.length > lista.length)
      toast.error(`No máximo ${LIMITE} arquivos por registro.`);
    for (const f of lista) {
      setSubindo((n) => n + 1);
      try {
        const imagem = f.type.startsWith("image/");
        const blob = imagem
          ? (
              await compressImage(f, {
                format: "image/jpeg",
                maxWidth: 1920,
                maxHeight: 1920,
              })
            ).blob
          : f;
        const mime = imagem ? "image/jpeg" : f.type;
        if (!imagem && mime !== "application/pdf") {
          toast.error(`${f.name}: só fotos e PDF.`);
          continue;
        }
        const r = await api<{ key: string; tamanho: number }>("/campo/anexos", {
          method: "POST",
          body: { base64: await paraBase64(blob), mime, nome: f.name },
        });
        aoMudar([
          ...atual.current,
          { key: r.key, nome: f.name, mime, tamanho: r.tamanho },
        ]);
      } catch {
        toast.error(`Não foi possível enviar ${f.name}.`);
      } finally {
        setSubindo((n) => n - 1);
      }
    }
  }

  if (somenteLeitura && anexos.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {anexos.map((a) => (
          <Miniatura
            key={a.key}
            a={a}
            aoRemover={
              somenteLeitura
                ? undefined
                : () => aoMudar(anexos.filter((x) => x.key !== a.key))
            }
          />
        ))}
        {subindo > 0 && (
          <div className="size-20 rounded-md border border-dashed border-slate-300 flex items-center justify-center text-[11px] text-slate-500">
            enviando...
          </div>
        )}
      </div>
      {!somenteLeitura && anexos.length < LIMITE && (
        <>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => entrada.current?.click()}
          >
            <Camera className="size-4 mr-1.5" />
            Adicionar foto ou PDF
          </Button>
          <input
            ref={entrada}
            type="file"
            accept="image/*,application/pdf"
            multiple
            className="hidden"
            onChange={(e) => {
              const f = e.target.files;
              if (f?.length) void subir(f);
              e.target.value = "";
            }}
          />
        </>
      )}
    </div>
  );
}
