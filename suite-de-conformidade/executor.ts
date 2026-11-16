// Executa os testes de requisito e monta o relatório.

import type { Contexto } from './contexto.ts';
import { emOrdemDeExecucao, emOrdemDoCapitulo, TODOS_OS_TESTES } from './requisitos/index.ts';
import type { Teste } from './requisitos/tipos.ts';
import { NaoVerificavel, Relator, Reprovacao, ROTULO, type Resultado, type Situacao } from './resultado.ts';

export interface OpcoesDaExecucao {
  /** Identificadores a executar. Vazio: todos. */
  somente?: string[];
  /** Chamado ao fim de cada teste. */
  aoTerminar?: (r: Resultado) => void;
}

export async function executarTeste(ctx: Contexto, t: Teste): Promise<Resultado> {
  const r = new Relator();
  const inicio = Date.now();
  let situacao: Situacao = 'aprovado';
  let motivo = '';
  try {
    await t.executar(ctx, r);
    if (r.parcial) {
      situacao = 'nao_verificavel';
      motivo = r.parcial;
    }
  } catch (e) {
    if (e instanceof Reprovacao) {
      situacao = 'reprovado';
      motivo = e.message;
    } else if (e instanceof NaoVerificavel) {
      situacao = 'nao_verificavel';
      motivo = e.message;
    } else {
      situacao = 'reprovado';
      motivo = `erro durante o teste: ${(e as Error).message}`;
    }
  }
  return { id: t.id, titulo: t.titulo, situacao, motivo, evidencias: r.evidencias, duracaoMs: Date.now() - inicio };
}

export async function executarSuite(ctx: Contexto, o: OpcoesDaExecucao = {}): Promise<Resultado[]> {
  const somente = new Set(o.somente ?? []);
  const testes = emOrdemDeExecucao(TODOS_OS_TESTES).filter((t) => somente.size === 0 || somente.has(t.id));
  const resultados: Resultado[] = [];
  for (const t of testes) {
    const r = await executarTeste(ctx, t);
    resultados.push(r);
    o.aoTerminar?.(r);
  }
  return emOrdemDoCapitulo(resultados);
}

export function linhaDeProgresso(r: Resultado): string {
  const marca = { aprovado: 'ok  ', reprovado: 'FALHA', nao_verificavel: 'n/v ' }[r.situacao];
  const detalhe = r.situacao === 'aprovado' ? '' : `\n         ${r.motivo}`;
  return `  ${marca} ${r.id.padEnd(8)} ${r.titulo} (${r.duracaoMs} ms)${detalhe}`;
}

export function resumoDaExecucao(resultados: Resultado[]): string {
  const conta = (s: Situacao) => resultados.filter((r) => r.situacao === s).length;
  const linhas = [
    '',
    `Requisitos executados: ${resultados.length}`,
    `  ${ROTULO.aprovado}: ${conta('aprovado')}`,
    `  ${ROTULO.reprovado}: ${conta('reprovado')}`,
    `  ${ROTULO.nao_verificavel}: ${conta('nao_verificavel')}`,
  ];
  const reprovados = resultados.filter((r) => r.situacao === 'reprovado');
  if (reprovados.length) linhas.push('', 'Reprovados:', ...reprovados.map((r) => `  ${r.id}: ${r.motivo}`));
  const nv = resultados.filter((r) => r.situacao === 'nao_verificavel');
  if (nv.length) linhas.push('', 'Não verificáveis automaticamente:', ...nv.map((r) => `  ${r.id}: ${r.motivo}`));
  return linhas.join('\n');
}

export function relatorioJson(resultados: Resultado[], extra: Record<string, unknown> = {}): string {
  return JSON.stringify({
    especificacao: '0.2.1',
    protocolo: '0.2',
    gerado_em: new Date().toISOString(),
    ...extra,
    resultados: resultados.map((r) => ({ id: r.id, titulo: r.titulo, situacao: ROTULO[r.situacao], motivo: r.motivo, evidencias: r.evidencias, duracao_ms: r.duracaoMs })),
  }, null, 2);
}
