import cobertura from '../../../docs/cobertura-de-requisitos.md?raw';
import indice from '../../../especificacao/00-indice.md?raw';

/**
 * Números da página lidos, na compilação, dos arquivos que os definem. Assim a
 * página não repete à mão a versão da especificação nem o resultado da suíte,
 * que mudam a cada versão. Se o formato da frase mudar, a compilação falha em
 * vez de publicar um número velho.
 */

function extrair(texto: string, padrao: RegExp, origem: string): RegExpMatchArray {
  const achado = texto.match(padrao);
  if (!achado) {
    throw new Error(`Não achei ${padrao} em ${origem}. O formato da frase mudou?`);
  }
  return achado;
}

const [, versao, data] = extrair(
  indice,
  /Versão (\d+\.\d+\.\d+), (\d{4}-\d{2}-\d{2})\./,
  'especificacao/00-indice.md',
);

const [, aprovados, reprovados, naoVerificaveis, total] = extrair(
  cobertura,
  /(\d+) aprovados, (\d+) reprovados, (\d+) não verificáveis automaticamente, de (\d+) requisitos de provedor/,
  'docs/cobertura-de-requisitos.md',
);

export const ESPECIFICACAO = {
  data: data!,
  versao: versao!,
};

export const SUITE = {
  aprovados: Number(aprovados),
  naoVerificaveis: Number(naoVerificaveis),
  reprovados: Number(reprovados),
  total: Number(total),
};
