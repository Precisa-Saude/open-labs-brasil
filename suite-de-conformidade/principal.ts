// Suíte de conformidade do Open Labs Brasil, lado do provedor.
//
//   node suite-de-conformidade/principal.ts --config minha-configuracao.json
//     [--somente AUT-001,CNS-002] [--relatorio relatorio.json]
//
// Código de saída 0 quando nenhum requisito é reprovado, 1 quando algum é, e 2
// quando a suíte não consegue começar (configuração ou registro inválidos).

import { writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { lerConfiguracaoDaSuite } from './configuracao.ts';
import { Contexto } from './contexto.ts';
import { executarSuite, linhaDeProgresso, relatorioJson, resumoDaExecucao } from './executor.ts';

const { values } = parseArgs({
  options: {
    config: { type: 'string' },
    somente: { type: 'string' },
    relatorio: { type: 'string' },
  },
});

if (!values.config) {
  console.error('Uso: node suite-de-conformidade/principal.ts --config <arquivo> [--somente IDS] [--relatorio arquivo.json]');
  process.exit(2);
}

let ctx: Contexto;
try {
  ctx = await Contexto.criar(lerConfiguracaoDaSuite(values.config));
} catch (e) {
  console.error(`A suíte não pôde começar: ${(e as Error).message}`);
  process.exit(2);
}

console.log(`Suíte de conformidade do Open Labs Brasil 0.2.2 contra ${ctx.provedor.display_name} (${ctx.issuer})`);
const resultados = await executarSuite(ctx, {
  ...(values.somente ? { somente: values.somente.split(',').map((s) => s.trim()) } : {}),
  aoTerminar: (r) => console.log(linhaDeProgresso(r)),
});
await ctx.encerrar();
console.log(resumoDaExecucao(resultados));
if (values.relatorio) {
  writeFileSync(values.relatorio, relatorioJson(resultados, { provedor: ctx.issuer }));
  console.log(`\nRelatório em ${values.relatorio}`);
}
process.exit(resultados.some((r) => r.situacao === 'reprovado') ? 1 : 0);
