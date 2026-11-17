// Execução local de ponta a ponta, em um comando: gera o ambiente local se
// faltar, sobe o servidor de exemplo, executa a suíte inteira contra ele e
// imprime o relatório.
//
//   node suite-de-conformidade/local.ts [--violacao nome ...] [--somente IDS] [--relatorio arquivo.json]
//
// Para ver o registro do servidor durante a execução, suba-o à parte
// (pnpm servidor) e use pnpm suite --config ambiente-local/gerado/suite.config.json.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { ambienteValido, gerarAmbiente, opcoesDaLinhaDeComando } from '../ambiente-local/gerar.ts';
import { lerConfiguracao } from '../servidor-de-exemplo/configuracao.ts';
import { iniciarServidor } from '../servidor-de-exemplo/servidor.ts';
import { lerConfiguracaoDaSuite } from './configuracao.ts';
import { Contexto } from './contexto.ts';
import { executarSuite, linhaDeProgresso, relatorioJson, resumoDaExecucao } from './executor.ts';
import type { Resultado } from './resultado.ts';

export const PASTA_DO_AMBIENTE = resolve(
  dirname(new URL(import.meta.url).pathname),
  '..',
  'ambiente-local',
  'gerado',
);

export async function garantirAmbiente(pasta = PASTA_DO_AMBIENTE): Promise<void> {
  if (ambienteValido(pasta)) return;
  await gerarAmbiente({ ...opcoesDaLinhaDeComando([]), saida: pasta });
}

/** Sobe o servidor de exemplo e o contexto da suíte, executa `fn` e encerra os dois. */
export async function comServidorDeExemplo<T>(
  fn: (ctx: Contexto) => Promise<T>,
  violacoes: string[] = [],
): Promise<T> {
  await garantirAmbiente();
  const servidor = await iniciarServidor(
    lerConfiguracao(join(PASTA_DO_AMBIENTE, 'servidor.config.json'), {
      registrarEmLog: false,
      violacoes,
    }),
  );
  let ctx: Contexto | undefined;
  try {
    ctx = await Contexto.criar(
      lerConfiguracaoDaSuite(join(PASTA_DO_AMBIENTE, 'suite.config.json')),
    );
    return await fn(ctx);
  } finally {
    await ctx?.encerrar();
    await servidor.fechar();
  }
}

export async function executarContraServidorDeExemplo(
  o: {
    violacoes?: string[];
    somente?: string[];
    aoTerminar?: (r: Resultado) => void;
  } = {},
): Promise<Resultado[]> {
  return comServidorDeExemplo(
    (ctx) =>
      executarSuite(ctx, {
        ...(o.somente ? { somente: o.somente } : {}),
        ...(o.aoTerminar ? { aoTerminar: o.aoTerminar } : {}),
      }),
    o.violacoes ?? [],
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { values } = parseArgs({
    options: {
      relatorio: { default: 'relatorios/conformidade-servidor-de-exemplo.json', type: 'string' },
      somente: { type: 'string' },
      violacao: { multiple: true, type: 'string' },
    },
  });
  console.log('Suíte de conformidade do Open Labs Brasil 0.2.2 contra o servidor de exemplo local');
  if (values.violacao?.length) console.log(`Modo de violações: ${values.violacao.join(', ')}`);
  const inicio = Date.now();
  const resultados = await executarContraServidorDeExemplo({
    ...(values.violacao ? { violacoes: values.violacao } : {}),
    ...(values.somente ? { somente: values.somente.split(',').map((s) => s.trim()) } : {}),
    aoTerminar: (r) => console.log(linhaDeProgresso(r)),
  });
  console.log(resumoDaExecucao(resultados));
  console.log(`\nDuração: ${Math.round((Date.now() - inicio) / 1000)} s`);
  if (values.relatorio) {
    mkdirSync(dirname(values.relatorio), { recursive: true });
    writeFileSync(
      values.relatorio,
      relatorioJson(resultados, {
        provedor: 'servidor de exemplo local',
        violacoes: values.violacao ?? [],
      }),
    );
    console.log(`Relatório em ${values.relatorio}`);
  }
  process.exit(resultados.some((r) => r.situacao === 'reprovado') ? 1 : 0);
}
