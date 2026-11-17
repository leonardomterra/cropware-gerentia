import { useState } from "react";
import DownloadSimple from "~icons/ph/download-simple";
import FileText from "~icons/ph/file-text";
import Images from "~icons/ph/images";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { BOTAO_BARRA, ICONE_BOTAO_BARRA } from "@/lib/ui-tokens";
import { downloadReportCsv } from "@/modules/reports/reportExport";
import type { ReportDoc } from "@/modules/reports/reportBuilders";
import { exportarRelatorio, type AnexoParaRelatorio } from "./exportar";

/**
 * CSV · Relatório · Relatório com fotos (fase 6). O "com fotos" só aparece se
 * houver foto ou PDF. `montar` é chamado no clique — o relatório sai com o que
 * está na tela naquele momento.
 */
export function BotoesDoRelatorio({
  montar,
  nome,
  anexos = [],
  className,
}: {
  montar: () => ReportDoc | Promise<ReportDoc>;
  nome: string;
  anexos?: AnexoParaRelatorio[];
  className?: string;
}) {
  const [gerando, setGerando] = useState(false);
  async function gerar(comFotos: boolean) {
    setGerando(true);
    try {
      await exportarRelatorio(await montar(), nome, comFotos ? anexos : []);
    } finally {
      setGerando(false);
    }
  }
  const botao = cn(BOTAO_BARRA, "rounded-md");
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <Button
        type="button"
        variant="ghost"
        className={botao}
        disabled={gerando}
        onClick={async () => downloadReportCsv(await montar(), `${nome}.csv`)}
      >
        <DownloadSimple className={ICONE_BOTAO_BARRA} />
        CSV
      </Button>
      <Button
        type="button"
        variant="ghost"
        className={botao}
        disabled={gerando}
        onClick={() => void gerar(false)}
      >
        <FileText className={ICONE_BOTAO_BARRA} />
        {gerando ? "Gerando…" : "Relatório"}
      </Button>
      {anexos.length > 0 && (
        <Button
          type="button"
          variant="ghost"
          className={botao}
          disabled={gerando}
          onClick={() => void gerar(true)}
        >
          <Images className={ICONE_BOTAO_BARRA} />
          Relatório com fotos ({anexos.length})
        </Button>
      )}
    </div>
  );
}
