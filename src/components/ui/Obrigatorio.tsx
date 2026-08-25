/**
 * O `*` de campo obrigatório.
 *
 * A REGRA, adotada em 25/08/2026 e válida para o app inteiro: campo obrigatório
 * leva `*`; campo opcional não leva marca NENHUMA. Antes convivia o oposto —
 * vários formulários escreviam "(opcional)" em quase todo rótulo —, e isso é
 * mais texto do que informação: numa tela com seis campos e cinco "(opcional)",
 * quem lê tem que ler cinco vezes para descobrir qual é o único que importa.
 * Com o `*`, a exceção é que fica marcada, e ela é sempre a minoria.
 *
 * Discreto de propósito: mesma fonte e mesmo tamanho do rótulo, sem sobrescrito,
 * em cinza claro. Ele avisa, não grita — o rótulo continua sendo o que se lê.
 *
 * Não leva `aria-hidden`: "Nome asterisco" é como leitor de tela anuncia campo
 * obrigatório desde sempre, e esconder isso tiraria a informação de quem mais
 * depende dela.
 *
 *   <Label>Nome<Obrigatorio /></Label>
 */
export function Obrigatorio() {
  return <span className="font-normal text-slate-400"> *</span>;
}
