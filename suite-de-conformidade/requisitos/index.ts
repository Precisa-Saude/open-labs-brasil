import { testesDeAgendamento } from './agendamento.ts';
import { testesDeApi } from './api.ts';
import { testesDeAutorizacao } from './autorizacao.ts';
import { testesDeCatalogoEAgenda } from './catalogo-e-agenda.ts';
import { testesDeConsentimento } from './consentimento.ts';
import { testesDeRegistro } from './registro.ts';
import { testesDeResultadosEErros } from './resultados-e-erros.ts';
import { testesDeSeguranca } from './seguranca.ts';
import type { Fase, Teste } from './tipos.ts';

/** Ordem da fase de relógio: cada teste adianta o relógio, e REG-008 leva o registro à expiração. */
const ORDEM_DO_RELOGIO = ['AUT-014', 'CNS-006', 'CNS-019', 'CNS-022', 'API-005', 'AGD-008', 'REG-004', 'REG-008'];
const FASES: Fase[] = ['normal', 'registro', 'relogio', 'final'];

export const TODOS_OS_TESTES: Teste[] = [
  ...testesDeRegistro,
  ...testesDeSeguranca,
  ...testesDeAutorizacao,
  ...testesDeConsentimento,
  ...testesDeApi,
  ...testesDeCatalogoEAgenda,
  ...testesDeAgendamento,
  ...testesDeResultadosEErros,
];

/** Testes na ordem de execução. */
export function emOrdemDeExecucao(testes: Teste[] = TODOS_OS_TESTES): Teste[] {
  const porFase = (f: Fase) => testes.filter((t) => (t.fase ?? 'normal') === f);
  return FASES.flatMap((f) => {
    const lista = porFase(f);
    if (f !== 'relogio') return lista;
    return [...lista].sort((a, b) => ORDEM_DO_RELOGIO.indexOf(a.id) - ORDEM_DO_RELOGIO.indexOf(b.id));
  });
}

/** Ordem do capítulo 9 (prefixo e número), para relatórios. */
export function emOrdemDoCapitulo<T extends { id: string }>(itens: T[]): T[] {
  const prefixos = ['REG', 'SEG', 'AUT', 'CNS', 'API', 'CAT', 'UNI', 'AGE', 'AGD', 'RES', 'ERR'];
  return [...itens].sort((a, b) => {
    const [pa, na] = a.id.split('-');
    const [pb, nb] = b.id.split('-');
    return prefixos.indexOf(pa!) - prefixos.indexOf(pb!) || Number(na) - Number(nb);
  });
}
