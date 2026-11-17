// A suíte inteira contra o servidor de exemplo: nenhum requisito reprovado,
// e só os que dependem de inspeção humana ou do validador FHIR ficam como não
// verificáveis. Também confere que cada requisito de provedor do capítulo 9
// tem um teste.

import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { executarContraServidorDeExemplo } from '../local.ts';
import { TODOS_OS_TESTES } from '../requisitos/index.ts';

const PREFIXOS_DO_PROVEDOR = [
  'REG',
  'SEG',
  'AUT',
  'CNS',
  'API',
  'CAT',
  'UNI',
  'AGE',
  'AGD',
  'RES',
  'ERR',
];

describe('suíte de conformidade', () => {
  it('cobre todos os requisitos de provedor em vigor no capítulo 9', () => {
    const texto = readFileSync(
      new URL('../../especificacao/09-versionamento-e-conformidade.md', import.meta.url),
      'utf8',
    );
    const linhas = [...texto.matchAll(/^\| ([A-Z]{3}-\d{3}) \| (.*)$/gm)];
    const emVigor = linhas
      .filter(([, , resto]) => !resto!.startsWith('*Retirado'))
      .map(([, id]) => id!);
    const doProvedor = emVigor.filter((id) => PREFIXOS_DO_PROVEDOR.includes(id.split('-')[0]!));
    const testados = new Set(TODOS_OS_TESTES.map((t) => t.id));
    expect(doProvedor.filter((id) => !testados.has(id))).toEqual([]);
    expect([...testados].filter((id) => !doProvedor.includes(id))).toEqual([]);
    expect(doProvedor.length).toBe(132);
  });

  it('passa por inteiro contra o servidor de exemplo', async () => {
    const resultados = await executarContraServidorDeExemplo();
    const reprovados = resultados
      .filter((r) => r.situacao === 'reprovado')
      .map((r) => `${r.id}: ${r.motivo}`);
    expect(reprovados).toEqual([]);
    const naoVerificaveis = resultados
      .filter((r) => r.situacao === 'nao_verificavel')
      .map((r) => r.id)
      .sort();
    expect(naoVerificaveis).toEqual(['API-008', 'AUT-024', 'CNS-008', 'CNS-023']);
    expect(resultados).toHaveLength(132);
  });
});
