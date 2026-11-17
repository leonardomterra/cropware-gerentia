import { useState } from "react";
import ArrowLeft from "~icons/ph/arrow-left";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/components/ui/utils";
import { BOTAO_BARRA } from "@/lib/ui-tokens";
import { AbaConfiguracao } from "./AbaConfiguracao";
import { AbaProdutos } from "./AbaProdutos";
import { AbaAvaliacoes } from "./AbaAvaliacoes";
import { AbaColheita } from "./AbaColheita";
import { AbaRoi } from "./AbaRoi";
import { TIPOS_DE_ENSAIO } from "../../dominio/ensaios";
import type { DadosDosEnsaios } from "../../hooks/useEnsaios";
import { BotoesDoRelatorio } from "../../relatorios/BotoesDoRelatorio";
import { dadosDoEnsaio, relatorioDoEnsaio } from "../../relatorios/doEnsaio";
import type { Resultado } from "../../hooks/useCadastros";
import type {
  Fazenda,
  Plantio,
  Produto,
  ProdutoInput,
  Safra,
  Talhao,
} from "../../types";

/**
 * Editor do ensaio: Configuração · Produtos · Avaliações · Colheita · ROI.
 * Cada aba salva o que é dela na hora. Enquanto o ensaio não existe, só a
 * Configuração abre (as outras partes precisam do id dele).
 */
export function EditorDeEnsaio({
  ensaioId,
  dados,
  cadastros,
  plantioInicial,
  podeMexer,
  aoVoltar,
}: {
  ensaioId: string | null;
  dados: DadosDosEnsaios;
  cadastros: {
    fazendas: Fazenda[];
    talhoes: Talhao[];
    plantios: Plantio[];
    safras: Safra[];
    produtos: Produto[];
    salvarProduto: (d: ProdutoInput) => Promise<Resultado>;
  };
  plantioInicial?: Plantio | null;
  podeMexer: (item: { created_by: string | null }) => boolean;
  aoVoltar: () => void;
}) {
  const [id, setId] = useState<string | null>(ensaioId);
  const [aba, setAba] = useState("config");
  const ensaio = id ? (dados.ensaios.find((e) => e.id === id) ?? null) : null;
  const somenteLeitura = ensaio ? !podeMexer(ensaio) : false;

  const doEnsaio = <T extends { trial_id: string }>(xs: T[]) =>
    ensaio ? xs.filter((x) => x.trial_id === ensaio.id) : [];
  const produtos = doEnsaio(dados.produtos);
  const etapas = doEnsaio(dados.etapas);
  const avaliacoes = doEnsaio(dados.avaliacoes);
  const colheitas = doEnsaio(dados.colheitas);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="ghost"
          onClick={aoVoltar}
          className={cn(BOTAO_BARRA, "rounded-md")}
        >
          <ArrowLeft className="size-4 mr-2" />
          Voltar
        </Button>
        <span className="text-sm text-slate-500 truncate">
          {ensaio ? (
            <>
              <span
                className="inline-block size-2.5 rounded-sm mr-1.5 align-middle"
                style={{
                  backgroundColor: TIPOS_DE_ENSAIO[ensaio.trial_type].cor,
                }}
              />
              {ensaio.crop} · {ensaio.name}
              {somenteLeitura ? " · somente leitura" : ""}
            </>
          ) : (
            "Novo ensaio"
          )}
        </span>
        {/* Relatório completo (fase 6): produtos, avaliações, colheita, ROI. */}
        {ensaio && (
          <BotoesDoRelatorio
            className="sm:ml-auto"
            {...relatorioDoEnsaio(dadosDoEnsaio(ensaio, dados, cadastros))}
          />
        )}
      </div>

      <Tabs value={aba} onValueChange={setAba}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="config">Configuração</TabsTrigger>
          <TabsTrigger value="produtos" disabled={!ensaio}>
            Produtos ({produtos.length})
          </TabsTrigger>
          <TabsTrigger value="avaliacoes" disabled={!ensaio}>
            Avaliações ({avaliacoes.length})
          </TabsTrigger>
          <TabsTrigger value="colheita" disabled={!ensaio}>
            Colheita ({colheitas.length})
          </TabsTrigger>
          <TabsTrigger value="roi" disabled={!ensaio}>
            ROI
          </TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="pt-3">
          <AbaConfiguracao
            key={ensaio?.id ?? "novo"}
            ensaio={ensaio}
            fazendas={cadastros.fazendas}
            talhoes={cadastros.talhoes}
            plantios={cadastros.plantios}
            safras={cadastros.safras}
            plantioInicial={plantioInicial}
            somenteLeitura={somenteLeitura}
            salvar={(d, eid) => dados.salvar("farm_trials", d, eid)}
            aoCriado={(novo) => {
              setId(novo);
              setAba("produtos");
            }}
          />
        </TabsContent>
        {ensaio && (
          <>
            <TabsContent value="produtos" className="pt-3">
              <AbaProdutos
                ensaio={ensaio}
                produtos={produtos}
                avaliacoes={avaliacoes}
                colheitas={colheitas}
                catalogo={cadastros.produtos}
                somenteLeitura={somenteLeitura}
                salvar={(d, pid) => dados.salvar("farm_trial_products", d, pid)}
                excluir={(pid) => dados.excluir("farm_trial_products", pid)}
                salvarNoCatalogo={cadastros.salvarProduto}
              />
            </TabsContent>
            <TabsContent value="avaliacoes" className="pt-3">
              <AbaAvaliacoes
                ensaio={ensaio}
                produtos={produtos}
                etapas={etapas}
                avaliacoes={avaliacoes}
                somenteLeitura={somenteLeitura}
                salvarEtapa={(d, sid) =>
                  dados.salvar("farm_trial_steps", d, sid)
                }
                excluirEtapa={(sid) => dados.excluir("farm_trial_steps", sid)}
                salvarAvaliacao={(d, aid) =>
                  dados.salvar("farm_trial_evaluations", d, aid)
                }
                excluirAvaliacao={(aid) =>
                  dados.excluir("farm_trial_evaluations", aid)
                }
              />
            </TabsContent>
            <TabsContent value="colheita" className="pt-3">
              <AbaColheita
                ensaio={ensaio}
                produtos={produtos}
                colheitas={colheitas}
                somenteLeitura={somenteLeitura}
                salvar={(d, hid) => dados.salvar("farm_trial_harvests", d, hid)}
                excluir={(hid) => dados.excluir("farm_trial_harvests", hid)}
              />
            </TabsContent>
            <TabsContent value="roi" className="pt-3">
              <AbaRoi
                key={`${ensaio.id}-${produtos.length}`}
                ensaio={ensaio}
                produtos={produtos}
                colheitas={colheitas}
                somenteLeitura={somenteLeitura}
                salvarEnsaio={(d) => dados.salvar("farm_trials", d, ensaio.id)}
                salvarProduto={(d, pid) =>
                  dados.salvar("farm_trial_products", d, pid)
                }
              />
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}
