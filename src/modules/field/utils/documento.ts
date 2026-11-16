/**
 * CPF/CNPJ do produtor — máscara e validação dos dígitos verificadores.
 * Portado do Flag Field (utils/formatters.ts).
 */
const soDigitos = (v: string) => v.replace(/\D/g, "");

function mascaraCpf(v: string): string {
  const d = soDigitos(v).slice(0, 11);
  if (d.length > 9)
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  if (d.length > 6) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  if (d.length > 3) return `${d.slice(0, 3)}.${d.slice(3)}`;
  return d;
}

function mascaraCnpj(v: string): string {
  const d = soDigitos(v).slice(0, 14);
  if (d.length > 12)
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  if (d.length > 8)
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  if (d.length > 5) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length > 2) return `${d.slice(0, 2)}.${d.slice(2)}`;
  return d;
}

/** Máscara de CPF até 11 dígitos; de CNPJ a partir do 12º. */
export function mascaraDocumento(v: string): string {
  return soDigitos(v).length <= 11 ? mascaraCpf(v) : mascaraCnpj(v);
}

function cpfValido(cpf: string): boolean {
  const d = soDigitos(cpf);
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  for (const tam of [9, 10]) {
    let soma = 0;
    for (let i = 0; i < tam; i++) soma += Number(d[i]) * (tam + 1 - i);
    let resto = (soma * 10) % 11;
    if (resto === 10) resto = 0;
    if (resto !== Number(d[tam])) return false;
  }
  return true;
}

function cnpjValido(cnpj: string): boolean {
  const d = soDigitos(cnpj);
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  for (const tam of [12, 13]) {
    let soma = 0;
    let pos = tam - 7;
    for (let i = 0; i < tam; i++) {
      soma += Number(d[i]) * pos--;
      if (pos < 2) pos = 9;
    }
    const resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
    if (resultado !== Number(d[tam])) return false;
  }
  return true;
}

/** Vazio conta como válido (o campo é opcional). */
export function documentoValido(v: string): boolean {
  const d = soDigitos(v);
  if (!d) return true;
  return d.length <= 11 ? cpfValido(d) : cnpjValido(d);
}

export { soDigitos };
