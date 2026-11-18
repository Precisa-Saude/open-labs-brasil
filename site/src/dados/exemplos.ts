import api from '../../../especificacao/05-api.md?raw';

/**
 * Exemplos de requisição e resposta lidos, na compilação, do capítulo 5 da
 * especificação. A página mostra o mesmo texto que o capítulo, sem cópia à
 * mão. Se uma seção sumir ou perder um bloco de código, a compilação falha.
 */

export type Linguagem = 'http' | 'json';

export interface Parte {
  codigo: string;
  linguagem: Linguagem;
  /** Legenda acima do bloco, como "Resposta 201". */
  rotulo?: string;
}

export interface Exemplo {
  /** Âncora do título da seção no GitHub. */
  ancora: string;
  partes: readonly Parte[];
  /** Seção do capítulo 5 de onde o exemplo saiu, como "5.4.1". */
  secao: string;
  titulo: string;
}

const ORIGEM = 'especificacao/05-api.md';

/** Texto da seção, do título até o próximo título de nível 2 ou 3. */
function secao(numero: string): string {
  const linhas = api.split('\n');
  const inicio = linhas.findIndex(
    (linha) => /^#{2,3} /.test(linha) && linha.includes(` ${numero} `),
  );
  if (inicio < 0) throw new Error(`Seção ${numero} não encontrada em ${ORIGEM}.`);
  const fim = linhas.findIndex((linha, i) => i > inicio && /^#{2,3} /.test(linha));
  return linhas.slice(inicio, fim < 0 ? undefined : fim).join('\n');
}

/** O enésimo bloco de código da seção, na linguagem esperada. */
function bloco(texto: string, numero: string, indice: number, linguagem: Linguagem): string {
  const blocos = [...texto.matchAll(/```(\w*)\n([\s\S]*?)\n```/g)];
  const achado = blocos[indice];
  if (!achado || achado[1] !== linguagem) {
    throw new Error(
      `A seção ${numero} de ${ORIGEM} não tem um bloco ${linguagem} na posição ${indice}.`,
    );
  }
  return achado[2]!;
}

/** A linha de requisição que o título da seção traz entre crases. */
function requisicaoDoTitulo(texto: string, numero: string): string {
  const achado = texto.split('\n')[0]!.match(/`([A-Z]+ [^`]+)`/);
  if (!achado) throw new Error(`O título da seção ${numero} de ${ORIGEM} não traz a requisição.`);
  return achado[1]!;
}

/** Âncora que o GitHub gera para um título: minúsculas, sem pontuação, hífen no lugar do espaço. */
function ancora(texto: string): string {
  return texto
    .split('\n')[0]!
    .replace(/^#+ /, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-');
}

function exemplo(numero: string, titulo: string, montar: (texto: string) => Parte[]): Exemplo {
  const texto = secao(numero);
  return { ancora: ancora(texto), partes: montar(texto), secao: numero, titulo };
}

export const EXEMPLOS: readonly Exemplo[] = [
  exemplo('5.4.1', 'Criar o consentimento', (texto) => [
    {
      codigo: requisicaoDoTitulo(texto, '5.4.1'),
      linguagem: 'http',
      rotulo: 'Requisição, com token do aplicativo',
    },
    { codigo: bloco(texto, '5.4.1', 0, 'json'), linguagem: 'json' },
    { codigo: bloco(texto, '5.4.1', 1, 'json'), linguagem: 'json', rotulo: 'Resposta 201' },
  ]),
  exemplo('5.3.2', 'Pedir autorização (PAR)', (texto) => [
    { codigo: bloco(texto, '5.3.2', 0, 'http'), linguagem: 'http', rotulo: 'Requisição' },
    { codigo: bloco(texto, '5.3.2', 1, 'json'), linguagem: 'json', rotulo: 'Resposta 201' },
  ]),
  exemplo('5.4.2', 'Conferir o paciente', (texto) => [
    {
      codigo: requisicaoDoTitulo(texto, '5.4.2'),
      linguagem: 'http',
      rotulo: 'Requisição, com token do paciente',
    },
    { codigo: bloco(texto, '5.4.2', 0, 'json'), linguagem: 'json', rotulo: 'Resposta 200' },
  ]),
  exemplo('5.5.5', 'Agendar exames', (texto) => [
    { codigo: bloco(texto, '5.5.5', 1, 'http'), linguagem: 'http', rotulo: 'Requisição' },
    { codigo: bloco(texto, '5.5.5', 0, 'json'), linguagem: 'json' },
  ]),
];
