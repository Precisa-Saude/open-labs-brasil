// Testes negativos: a suíte precisa reprovar o servidor de exemplo quando ele
// descumpre uma regra de propósito. Uma suíte que sempre aprova não passa aqui.

import { describe, expect, it } from 'vitest';

import { testesDaViolacao, type Violacao, VIOLACOES } from '../../servidor-de-exemplo/violacoes.ts';
import { executarContraServidorDeExemplo } from '../local.ts';

describe('a suíte reprova um provedor com violação deliberada', () => {
  for (const nome of Object.keys(VIOLACOES) as Violacao[]) {
    const { reprovados, executar } = testesDaViolacao(nome);
    it(`${nome}: ${reprovados.join(', ')} reprovado`, async () => {
      const resultados = await executarContraServidorDeExemplo({
        violacoes: [nome],
        somente: executar,
      });
      for (const id of reprovados) {
        const r = resultados.find((x) => x.id === id);
        expect(r, `${id} não foi executado`).toBeDefined();
        expect(r!.situacao, `${id}: ${r!.motivo}`).toBe('reprovado');
      }
    });
  }
});
