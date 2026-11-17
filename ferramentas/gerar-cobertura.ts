// Gera docs/cobertura-de-requisitos.md a partir do capítulo 9, da lista de
// testes da suíte, das violações do servidor de exemplo e do último relatório
// de `pnpm conformidade:local`.
//
//   pnpm conformidade:local && node ferramentas/gerar-cobertura.ts

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { VIOLACOES } from '../servidor-de-exemplo/violacoes.ts';
import { testesDeAgendamento } from '../suite-de-conformidade/requisitos/agendamento.ts';
import { testesDeApi } from '../suite-de-conformidade/requisitos/api.ts';
import { testesDeAutorizacao } from '../suite-de-conformidade/requisitos/autorizacao.ts';
import { testesDeCatalogoEAgenda } from '../suite-de-conformidade/requisitos/catalogo-e-agenda.ts';
import { testesDeConsentimento } from '../suite-de-conformidade/requisitos/consentimento.ts';
import { testesDeRegistro } from '../suite-de-conformidade/requisitos/registro.ts';
import { testesDeResultadosEErros } from '../suite-de-conformidade/requisitos/resultados-e-erros.ts';
import { testesDeSeguranca } from '../suite-de-conformidade/requisitos/seguranca.ts';

const RAIZ = resolve(dirname(new URL(import.meta.url).pathname), '..');
const ARQUIVOS: Array<[string, Array<{ id: string; fase?: string }>]> = [
  ['registro.ts', testesDeRegistro],
  ['seguranca.ts', testesDeSeguranca],
  ['autorizacao.ts', testesDeAutorizacao],
  ['consentimento.ts', testesDeConsentimento],
  ['api.ts', testesDeApi],
  ['catalogo-e-agenda.ts', testesDeCatalogoEAgenda],
  ['agendamento.ts', testesDeAgendamento],
  ['resultados-e-erros.ts', testesDeResultadosEErros],
];

const capitulo = readFileSync(resolve(RAIZ, 'especificacao/09-versionamento-e-conformidade.md'), 'utf8');
const linhas = [...capitulo.matchAll(/^\| ([A-Z]{3}-\d{3}) \| (.*?) \|(.*)\|$/gm)].map((m) => ({ id: m[1]!, requisito: m[2]!.trim(), comoTestar: m[3]!.trim() }));
const relatorio = JSON.parse(readFileSync(resolve(RAIZ, 'relatorios/conformidade-servidor-de-exemplo.json'), 'utf8')) as {
  gerado_em: string;
  resultados: Array<{ id: string; situacao: string; motivo: string }>;
};
const receptor = readFileSync(resolve(RAIZ, 'suite-de-conformidade/receptor-minimo/receptor.ts'), 'utf8');
const rcpNoReceptor = new Set([...receptor.matchAll(/RCP-\d{3}/g)].map((m) => m[0]));

const arquivoDo = new Map<string, string>();
const faseDo = new Map<string, string>();
for (const [arquivo, testes] of ARQUIVOS) for (const t of testes) {
  arquivoDo.set(t.id, arquivo);
  faseDo.set(t.id, t.fase ?? 'normal');
}
const violacoesDo = new Map<string, string[]>();
for (const [nome, v] of Object.entries(VIOLACOES)) for (const id of v.requisitos) violacoesDo.set(id, [...(violacoesDo.get(id) ?? []), nome]);

const celula = (t: string) => t.replace(/\|/g, '\\|').replace(/\n/g, ' ');
const provedor = linhas.filter((l) => !l.id.startsWith('RCP-'));
const situacao = new Map(relatorio.resultados.map((r) => [r.id, r]));
const conta = (s: string) => relatorio.resultados.filter((r) => r.situacao === s).length;

const saida: string[] = [
  '# Cobertura dos requisitos do capítulo 9',
  '',
  'Gerado por `node ferramentas/gerar-cobertura.ts` a partir de [09-versionamento-e-conformidade.md](../especificacao/09-versionamento-e-conformidade.md), da lista de testes da suíte e do relatório de `pnpm conformidade:local`. Não edite à mão: rode os dois comandos de novo.',
  '',
  `Relatório usado: ${relatorio.gerado_em}. Contra o servidor de exemplo: ${conta('aprovado')} aprovados, ${conta('reprovado')} reprovados, ${conta('não verificável automaticamente')} não verificáveis automaticamente, de ${relatorio.resultados.length} requisitos de provedor.`,
  '',
  'Colunas:',
  '',
  '- **Teste**: arquivo em `suite-de-conformidade/requisitos/` onde está o teste com o identificador do requisito. A fase diz quando ele roda: `registro` publica candidatos do registro, `relogio` adianta o relógio do provedor, `final` examina o histórico de todas as trocas.',
  '- **Situação**: resultado contra o servidor de exemplo. "Não verificável automaticamente" vem sempre com o motivo.',
  '- **Teste negativo**: violação do servidor de exemplo (`servidor-de-exemplo/violacoes.ts`) que faz o requisito ser reprovado em `suite-de-conformidade/testes/violacoes.test.ts`.',
  '',
  '## Provedor',
  '',
  '| Id | Requisito | Teste | Situação | Teste negativo |',
  '| --- | --- | --- | --- | --- |',
];
for (const l of provedor) {
  if (l.requisito.startsWith('*Retirado')) {
    saida.push(`| ${l.id} | ${celula(l.requisito)} | (retirado) | (não se aplica) | |`);
    continue;
  }
  const r = situacao.get(l.id);
  const arquivo = arquivoDo.get(l.id);
  const fase = faseDo.get(l.id);
  const teste = arquivo ? `\`${arquivo}\`${fase && fase !== 'normal' ? `, fase ${fase}` : ''}` : '**sem teste**';
  const sit = r ? (r.situacao === 'não verificável automaticamente' ? `${r.situacao}: ${r.motivo}` : r.situacao) : '(não executado)';
  saida.push(`| ${l.id} | ${celula(l.requisito)} | ${teste} | ${celula(sit)} | ${(violacoesDo.get(l.id) ?? []).map((v) => `\`${v}\``).join(', ')} |`);
}

saida.push(
  '',
  '## Receptor',
  '',
  'Os requisitos RCP são do receptor e ficam fora desta entrega: testá-los pede um provedor de teste controlado pela suíte, que devolva respostas erradas de propósito e observe o receptor. A coluna "Receptor mínimo" marca os que o receptor mínimo da jornada de ponta a ponta segue, conforme comentado no código. Isso não é verificação de conformidade de nenhum receptor.',
  '',
  '| Id | Requisito | Situação | Receptor mínimo |',
  '| --- | --- | --- | --- |',
);
for (const l of linhas.filter((x) => x.id.startsWith('RCP-'))) {
  if (l.requisito.startsWith('*Retirado')) {
    saida.push(`| ${l.id} | ${celula(l.requisito)} | (retirado) | |`);
    continue;
  }
  saida.push(`| ${l.id} | ${celula(l.requisito)} | fora desta entrega | ${rcpNoReceptor.has(l.id) ? 'segue' : ''} |`);
}
saida.push('');
writeFileSync(resolve(RAIZ, 'docs/cobertura-de-requisitos.md'), saida.join('\n'));
console.log(`docs/cobertura-de-requisitos.md: ${provedor.filter((l) => !l.requisito.startsWith("*Retirado")).length} requisitos de provedor em vigor, ${linhas.filter((l) => l.id.startsWith("RCP-") && !l.requisito.startsWith("*Retirado")).length} de receptor`);
