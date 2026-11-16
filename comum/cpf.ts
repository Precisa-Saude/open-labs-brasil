// CPF: 11 dígitos, os dois últimos verificadores (módulo 11).

function digitoVerificador(digitos: string): number {
  let soma = 0;
  const peso = digitos.length + 1;
  for (let i = 0; i < digitos.length; i++) {
    soma += Number(digitos[i]) * (peso - i);
  }
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

/** Completa uma base de 9 dígitos com os dois dígitos verificadores. */
export function completarCpf(base9: string): string {
  if (!/^[0-9]{9}$/.test(base9)) throw new Error('A base do CPF precisa de 9 dígitos');
  const d1 = digitoVerificador(base9);
  const d2 = digitoVerificador(base9 + String(d1));
  return base9 + String(d1) + String(d2);
}

/** 11 dígitos, sem pontuação, com dígitos verificadores válidos e sem repetir um só dígito. */
export function cpfValido(cpf: unknown): cpf is string {
  if (typeof cpf !== 'string' || !/^[0-9]{11}$/.test(cpf)) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  return completarCpf(cpf.slice(0, 9)) === cpf;
}

/** CNS provisório (começa com 7, 8 ou 9): soma ponderada de 15 a 1 divisível por 11. */
export function cnsValido(cns: string): boolean {
  if (!/^[0-9]{15}$/.test(cns)) return false;
  let soma = 0;
  for (let i = 0; i < 15; i++) soma += Number(cns[i]) * (15 - i);
  return soma % 11 === 0;
}

/** Gera um CNS provisório válido a partir de uma base de 14 dígitos começando com 7, 8 ou 9, ajustando o último dígito. */
export function completarCnsProvisorio(base14: string): string {
  if (!/^[789][0-9]{13}$/.test(base14)) throw new Error('A base do CNS provisório precisa de 14 dígitos começando com 7, 8 ou 9');
  for (let d = 0; d <= 9; d++) {
    const candidato = base14 + String(d);
    if (cnsValido(candidato)) return candidato;
  }
  throw new Error('Base sem dígito final possível; troque a base');
}

/** Completa um CNPJ numérico de 12 dígitos com os dois verificadores. */
export function completarCnpj(base12: string): string {
  if (!/^[0-9]{12}$/.test(base12)) throw new Error('A base do CNPJ precisa de 12 dígitos');
  const calcular = (digitos: string, pesos: number[]) => {
    let soma = 0;
    for (let i = 0; i < digitos.length; i++) soma += Number(digitos[i]) * pesos[i]!;
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  const d1 = calcular(base12, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = calcular(base12 + String(d1), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return base12 + String(d1) + String(d2);
}
