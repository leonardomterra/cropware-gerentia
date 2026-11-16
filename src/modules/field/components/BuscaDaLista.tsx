import Search from "~icons/ph/magnifying-glass";
import Plus from "~icons/ph/plus";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BOTAO_BARRA_PRIMARIO, ICONE_BOTAO_BARRA } from "@/lib/ui-tokens";

/** Campo de busca da BarraDeTela, igual ao das outras listas do app. */
export function BuscaDaLista({
  valor,
  aoMudar,
  placeholder,
}: {
  valor: string;
  aoMudar: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative">
      <Search className="size-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
      <Input
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        placeholder={placeholder}
        className="pl-8 h-9 border-slate-200 shadow-none text-slate-500"
      />
    </div>
  );
}

/** O único botão escuro da tela: criar. */
export function BotaoNovo({
  rotulo,
  onClick,
}: {
  rotulo: string;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="default"
      onClick={onClick}
      className={BOTAO_BARRA_PRIMARIO}
    >
      <Plus className={ICONE_BOTAO_BARRA} />
      {rotulo}
    </Button>
  );
}
