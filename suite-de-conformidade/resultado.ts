// Tipos de resultado e asserções da suíte.

export type Situacao = 'aprovado' | 'reprovado' | 'nao_verificavel';

export const ROTULO: Record<Situacao, string> = {
  aprovado: 'aprovado',
  reprovado: 'reprovado',
  nao_verificavel: 'não verificável automaticamente',
};

export interface Resultado {
  id: string;
  titulo: string;
  situacao: Situacao;
  motivo: string;
  evidencias: string[];
  duracaoMs: number;
}

/** O provedor descumpriu o requisito. */
export class Reprovacao extends Error {}

/** O requisito não pode ser verificado automaticamente nesta configuração. */
export class NaoVerificavel extends Error {}

export function falhar(mensagem: string): never {
  throw new Reprovacao(mensagem);
}

export function esperar(condicao: unknown, mensagem: string): asserts condicao {
  if (!condicao) throw new Reprovacao(mensagem);
}

export function naoVerificavel(motivo: string): never {
  throw new NaoVerificavel(motivo);
}

/** Registro do andamento de um teste. */
export class Relator {
  readonly evidencias: string[] = [];
  /** Motivo pelo qual parte do requisito não foi verificada; o teste termina "não verificável" se nada falhar. */
  parcial: string | undefined;

  evidencia(texto: string): void {
    this.evidencias.push(texto);
  }

  /** Parte do requisito exige inspeção humana ou um recurso ausente na configuração. */
  marcarParcial(motivo: string): void {
    this.parcial = this.parcial ? `${this.parcial}; ${motivo}` : motivo;
  }
}
