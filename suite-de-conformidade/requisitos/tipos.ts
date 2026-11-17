import type { Contexto } from '../contexto.ts';
import type { Relator } from '../resultado.ts';

/**
 * Fases de execução: `normal` primeiro; `registro` publica candidatos do
 * registro; `relogio` adianta o relógio do provedor; `final` examina o
 * histórico de todas as trocas.
 */
export type Fase = 'normal' | 'registro' | 'relogio' | 'final';

export interface Teste {
  executar: (ctx: Contexto, r: Relator) => Promise<void>;
  fase?: Fase;
  id: string;
  titulo: string;
}
