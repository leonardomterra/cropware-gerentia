/**
 * Regra de força de senha — UMA para o app inteiro.
 *
 * Nasceu dentro do SignUpScreen e virou utilitário quando a troca de senha, na
 * tela de Conta, passou a exigir o mesmo critério: duas cópias divergiriam no
 * primeiro ajuste, e aí o app aceitaria no cadastro uma senha que recusa na
 * troca (ou pior, o contrário).
 */

export const MIN_SENHA = 8;

/** 0 a 4: comprimento, maiúscula+minúscula, número, símbolo. */
export function forcaDaSenha(pw: string): number {
  let score = 0;
  if (pw.length >= MIN_SENHA) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return score;
}

/**
 * Piso aceito: MÉDIA.
 *
 * Só o comprimento (score 1) deixava passar "12345678" e "senhasenha", que são
 * exatamente as que aparecem em qualquer lista de senhas vazadas. Exigir FORTE
 * (4) obrigaria símbolo em toda senha, o que empurra gente para anotar no papel
 * — piora a segurança real em vez de melhorar.
 */
export const FORCA_MINIMA = 2;

export function senhaAceita(pw: string): boolean {
  return pw.length >= MIN_SENHA && forcaDaSenha(pw) >= FORCA_MINIMA;
}

export function rotuloDaForca(score: number): string {
  return score <= 1 ? "Fraca" : score === 2 ? "Média" : "Forte";
}

/** Classe de FUNDO — para as barrinhas do medidor. */
export function corDaForca(score: number): string {
  return score <= 1
    ? "bg-red-500"
    : score === 2
      ? "bg-amber-500"
      : "bg-emerald-500";
}

/** Classe de TEXTO. Tons 600/700: o 500 reprova em 4,5:1 como texto. */
export function corDoTextoDaForca(score: number): string {
  return score <= 1
    ? "text-red-600"
    : score === 2
      ? "text-amber-700"
      : "text-emerald-700";
}

/** Aponta o PRÓXIMO passo, um de cada vez — lista inteira de regras de uma vez
 *  só é lida como parede e ignorada. */
export function dicaDeSenha(pw: string): string {
  if (!pw) return "";
  if (pw.length < MIN_SENHA) return `Use pelo menos ${MIN_SENHA} caracteres.`;
  if (!(/[a-z]/.test(pw) && /[A-Z]/.test(pw)))
    return "Misture letras maiúsculas e minúsculas.";
  if (!/\d/.test(pw)) return "Inclua ao menos um número.";
  if (!/[^A-Za-z0-9]/.test(pw)) return "Inclua um símbolo, como ! @ # $.";
  return "Senha forte — está ótima.";
}
