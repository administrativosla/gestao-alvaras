/** Mantém somente os 14 dígitos aceitos no CNPJ. */
export function obterDigitosCnpj(valor: string): string {
  return valor.replace(/\D/g, "").slice(0, 14);
}

/** Aplica a máscara de CNPJ enquanto o usuário digita. */
export function formatarCnpj(valor: string): string {
  const digitos = obterDigitosCnpj(valor);

  return digitos
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function calcularDigito(base: string, pesos: number[]): number {
  const soma = base
    .split("")
    .reduce((total, digito, indice) => total + Number(digito) * pesos[indice], 0);
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

/** Valida tamanho, sequências repetidas e os dois dígitos verificadores. */
export function cnpjValido(valor: string): boolean {
  const digitos = obterDigitosCnpj(valor);
  if (digitos.length !== 14 || /^(\d)\1{13}$/.test(digitos)) return false;

  const primeiro = calcularDigito(digitos.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const segundo = calcularDigito(`${digitos.slice(0, 12)}${primeiro}`, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);

  return digitos.endsWith(`${primeiro}${segundo}`);
}
