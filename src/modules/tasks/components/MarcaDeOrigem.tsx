import TextboxDuotone from "~icons/ph/textbox-duotone";
import WhatsappDuotone from "~icons/ph/whatsapp-logo-duotone";
import TelegramDuotone from "~icons/ph/telegram-logo-duotone";
import CameraDuotone from "~icons/ph/camera-duotone";
import TableDuotone from "~icons/ph/table-duotone";
import RepeatDuotone from "~icons/ph/arrows-clockwise-duotone";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { cn } from "@/components/ui/utils";

/** De onde o item veio. Cada página mapeia o próprio campo para um destes. */
export type Origem =
  | "manual"
  | "whatsapp"
  | "telegram"
  | "photo"
  | "csv"
  | "recorrencia";

const MARCAS: Record<
  Origem,
  {
    Icone: typeof TextboxDuotone;
    /** Cor do ÍCONE solto, no começo do card. */
    cor: string;
    titulo: string;
    rotulo: string;
    /** Esquema do SELO. Mesma matiz da `cor`, na paleta de selos do app. */
    selo: BadgeProps["colorScheme"];
  }
> = {
  manual: {
    // Campo de texto. NÃO usar lápis: lápis é o ícone de EDITAR no app
    // inteiro, e no canto de um card lia como "clique para editar" em vez de
    // "entrou por aqui".
    Icone: TextboxDuotone,
    cor: "text-orange-500",
    titulo: "Cadastrado na tela",
    rotulo: "Manual",
    selo: "orange",
  },
  whatsapp: {
    Icone: WhatsappDuotone,
    cor: "text-emerald-500",
    titulo: "Anotado pelo WhatsApp — confira os dados",
    rotulo: "WhatsApp",
    selo: "emerald",
  },
  telegram: {
    Icone: TelegramDuotone,
    cor: "text-sky-500",
    titulo: "Anotado pelo Telegram — confira os dados",
    rotulo: "Telegram",
    selo: "sky",
  },
  photo: {
    Icone: CameraDuotone,
    cor: "text-violet-500",
    titulo: "Lido de uma foto — confira os dados",
    rotulo: "Foto",
    selo: "purple",
  },
  csv: {
    Icone: TableDuotone,
    // Índigo, e não âmbar: com o manual em laranja, dois quentes na mesma
    // legenda ficavam parecidos demais em 16px.
    cor: "text-indigo-500",
    titulo: "Importado de planilha",
    rotulo: "Planilha",
    selo: "indigo",
  },
  recorrencia: {
    Icone: RepeatDuotone,
    cor: "text-teal-500",
    titulo: "Gerado por recorrência",
    rotulo: "Recorrência",
    selo: "teal",
  },
};

/**
 * Selo de ORIGEM do item, no começo do título.
 *
 * Existe porque o quadro de Pendências mistura o que a pessoa digitou, o que
 * chegou por mensagem, o que a IA leu de uma foto e o que o sistema projetou —
 * e a confiança em cada um é diferente: o que veio de texto livre ou de imagem
 * foi INTERPRETADO e pode ter errado valor ou data.
 *
 * Todo card tem selo, inclusive o manual. Marcar só as exceções obrigava a
 * saber que "sem ícone = manual", o que é regra invisível; e um card sem marca
 * também pode ser um card cujo dado de origem faltou.
 */
export function MarcaDeOrigem({
  origem,
  className,
}: {
  origem: Origem;
  className?: string;
}) {
  const { Icone, cor, titulo } = MARCAS[origem];
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn("inline-flex shrink-0", cor, className)}>
          <Icone className="size-[18px]" />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">{titulo}</TooltipContent>
    </Tooltip>
  );
}

/** `farm_tasks.source` -> origem. Valor desconhecido cai em manual, que é o
 *  default da coluna — nunca afirmar origem automática sem o dado dizer. */
export function origemDoLembrete(source: string | null | undefined): Origem {
  if (source === "whatsapp") return "whatsapp";
  if (source === "telegram") return "telegram";
  return "manual";
}

/** Lançamento: a recorrência VENCE o `source`, porque o que importa saber é
 *  que a linha foi projetada e some se a recorrência for removida. */
export function origemDoLancamento(
  source: string | null | undefined,
  isEstimated: boolean,
): Origem {
  if (isEstimated) return "recorrencia";
  if (source === "whatsapp") return "whatsapp";
  if (source === "telegram") return "telegram";
  if (source === "photo") return "photo";
  if (source === "csv") return "csv";
  return "manual";
}

/**
 * A mesma origem, em forma de SELO com nome — para telas de leitura, onde há
 * espaço e o ícone sozinho obrigaria a passar o mouse para saber o que é.
 *
 * O selo é neutro e a cor fica no ícone: numa ficha de leitura, um selo colorido
 * competiria com o status do lançamento, que ali é a informação que importa.
 */
export function SeloDeOrigem({ origem }: { origem: Origem }) {
  const { Icone, titulo, rotulo, selo } = MARCAS[origem];
  return (
    <Tooltip>
      {/* O gatilho vai num <span> POR FORA, e não no próprio Badge com
          `asChild`: o Radix sobrescreve o `data-slot` do filho, e é por
          `[data-slot="badge"]` que o app.css aplica a tipografia de selo
          (tamanho, peso, espaçamento e caixa alta). Com `asChild` no Badge, ele
          virava um selo com a forma certa e a letra errada. */}
      <TooltipTrigger asChild>
        <span className="inline-flex">
          {/* A COR VAI NO SELO, e o ícone herda dela. Antes era um selo cinza
              com ícone colorido — híbrido que nenhum outro selo do app usa: aqui
              a cor é sempre o fundo, e o desenho acompanha. */}
          <Badge colorScheme={selo} className="gap-1.5">
            <Icone className="size-[14px] shrink-0" />
            {rotulo}
          </Badge>
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">{titulo}</TooltipContent>
    </Tooltip>
  );
}
