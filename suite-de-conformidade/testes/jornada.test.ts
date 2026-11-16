import { describe, expect, it } from 'vitest';
import { executarJornada } from '../receptor-minimo/jornada.ts';

describe('jornada de ponta a ponta com o receptor mínimo', () => {
  it('conecta, vê preços e horários, agenda, paga, cancela, revoga e detecta CPF divergente', async () => {
    const r = await executarJornada();
    expect(r.passos).toHaveLength(11);
    expect(r.agendamentoFinal).toBe('cancelled');
    expect(r.revogacao).toBe('revogado');
    expect(r.tokenDepoisDaRevogacao).toBe(401);
    expect(r.divergencia).toBe('PATIENT_MISMATCH');
    expect(r.estadoDaDivergencia).toBe('REVOKED PATIENT_MISMATCH');
  });
});
