// Entradas fora do caminho feliz que o servidor de exemplo precisa recusar com
// o erro do capítulo 6, e não com 500 nem aceitando: datas impossíveis, corpos
// com tipo errado, caminhos estranhos, busca vazia, cesta com "ou" e horário
// que já passou.

import { describe, expect, it } from 'vitest';

import type { Contexto } from '../suite-de-conformidade/contexto.ts';
import type { Resposta } from '../suite-de-conformidade/http.ts';
import { comServidorDeExemplo } from '../suite-de-conformidade/local.ts';
import {
  agendaDaUnidade,
  cenario,
  corpoDeAgendamento,
  criarAgendamento,
  horariosLivres,
  ifNoneExist,
  unidadeConfigurada,
} from '../suite-de-conformidade/requisitos/apoio.ts';
import { dentroDoPeriodo } from './fhir.ts';

type Json = Record<string, unknown>;

function codigoDoErro(r: Resposta): string | undefined {
  const issue = (
    (r.json as Json | undefined)?.issue as
      Array<{ details?: { coding?: Array<{ code?: string }> } }> | undefined
  )?.[0];
  return issue?.details?.coding?.[0]?.code;
}

async function criarConsentimento(ctx: Contexto, expiracao: string): Promise<Resposta> {
  const c = ctx.cliente('principal');
  const token = await ctx.tokenDeProvedor(c, 'consent.manage');
  const corpo = { ...ctx.corpoDeConsentimento(), expiration_date_time: expiracao };
  return ctx.consentimentos('POST', '', token, { corpo, credencial: c.credenciais[0]! });
}

describe('consentimento', () => {
  it('recusa expiration_date_time com data impossível, como 31 de fevereiro', async () => {
    await comServidorDeExemplo(async (ctx) => {
      const ano = new Date(ctx.agoraMs()).getUTCFullYear() + 1;
      const r = await criarConsentimento(ctx, `${ano}-02-31T03:00:00Z`);
      expect(r.status).toBe(400);
      expect(codigoDoErro(r)).toBe('INVALID_REQUEST');
    });
  });
});

describe('agendamento', () => {
  it('corpo com tipo errado recebe 400 INVALID_REQUEST, nunca 500', async () => {
    await comServidorDeExemplo(async (ctx) => {
      const cen = await cenario(ctx);
      const valido = corpoDeAgendamento({
        cliente: cen.cliente,
        slot: cen.horariosLivres[0]!,
        exames: cen.exames,
        unidade: cen.unidade,
        pacienteRef: cen.pacienteRef,
      });
      // O cabeçalho vem do corpo válido, porque algumas variações estragam o identifier.
      const cabecalho = ifNoneExist(valido);
      const variacoes: Array<[string, unknown]> = [
        ['contained', [null]],
        ['participant', 'x'],
        ['participant', [null]],
        ['basedOn', [null]],
        ['slot', 'x'],
        ['identifier', 'x'],
        ['extension', 'x'],
      ];
      for (const [campo, valor] of variacoes) {
        const r = await criarAgendamento(ctx, cen, { ...valido, [campo]: valor }, { cabecalho });
        expect(r.status, `${campo}: ${JSON.stringify(valor)}`).toBe(400);
        expect(codigoDoErro(r), `${campo}: ${JSON.stringify(valor)}`).toBe('INVALID_REQUEST');
      }
    });
  });

  it('horário que já começou recebe 409 SLOT_UNAVAILABLE', async () => {
    await comServidorDeExemplo(async (ctx) => {
      const cen = await cenario(ctx);
      const slot = cen.horariosLivres[0]!;
      await ctx.avancarRelogio(
        Math.ceil((Date.parse(String(slot.start)) - ctx.agoraMs()) / 1000) + 60,
      );
      const renovado = await ctx.renovar(cen.cliente, cen.autorizacao.refreshToken);
      expect(renovado.status).toBe(200);
      cen.autorizacao.accessToken = (renovado.json as { access_token: string }).access_token;
      const corpo = corpoDeAgendamento({
        cliente: cen.cliente,
        slot,
        exames: cen.exames,
        unidade: cen.unidade,
        pacienteRef: cen.pacienteRef,
      });
      const r = await criarAgendamento(ctx, cen, corpo);
      expect(r.status).toBe(409);
      expect(codigoDoErro(r)).toBe('SLOT_UNAVAILABLE');
    });
  });
});

describe('busca', () => {
  it('busca sem resultado devolve Bundle sem entry, já que o FHIR JSON não admite lista vazia', async () => {
    await comServidorDeExemplo(async (ctx) => {
      const a = await ctx.autorizar(ctx.cliente('principal'));
      const r = await ctx.fhir(
        a.accessToken,
        `DiagnosticReport?patient=${ctx.paciente('principal').fhir_id}&date=lt1900-01-01`,
      );
      expect(r.status).toBe(200);
      const bundle = r.json as Json;
      expect(bundle.total).toBe(0);
      expect('entry' in bundle).toBe(false);
    });
  });

  it('service-type com vírgula é "ou": basta uma alternativa ser coletada na unidade', async () => {
    await comServidorDeExemplo(async (ctx) => {
      const token = await ctx.tokenDeProvedor(ctx.cliente('principal'), 'schedule.read');
      const agenda = await agendaDaUnidade(ctx, token, unidadeConfigurada(ctx)!);
      const comum = ctx.cfg.agenda!.exame_comum!;
      const so = await horariosLivres(ctx, token, agenda, [comum]);
      const comOu = await horariosLivres(ctx, token, agenda, [`${comum},http://loinc.org|0000-0`]);
      expect(so.lista.length).toBeGreaterThan(0);
      expect(comOu.lista.map((s) => s.id)).toEqual(so.lista.map((s) => s.id));
      const avisos = (
        (comOu.bundle.entry as Array<{ search?: { mode?: string } }> | undefined) ?? []
      ).filter((e) => e.search?.mode === 'outcome');
      expect(avisos).toEqual([]);
    });
  });
});

describe('caminhos', () => {
  it('caminho que começa com // recebe 4xx nos dois hosts, nunca 500', async () => {
    await comServidorDeExemplo(async (ctx) => {
      const mtls = new URL(ctx.fhirBase).origin;
      for (const origem of [ctx.issuer, mtls]) {
        for (const caminho of ['//', '//outro.example/x']) {
          const r = await ctx.http.requisitar(`${origem}${caminho}`, {
            cabecalhos: { 'x-fapi-interaction-id': crypto.randomUUID() },
            credencial: ctx.cliente('principal').credenciais[0]!,
          });
          expect(r.status, `${origem}${caminho}`).toBeGreaterThanOrEqual(400);
          expect(r.status, `${origem}${caminho}`).toBeLessThan(500);
        }
      }
    });
  });
});

describe('data_period', () => {
  const periodo = { start: '2024-01-01', end: '2024-12-31' };
  it('sem data_period, tudo passa', () => {
    expect(dentroDoPeriodo(undefined, { resourceType: 'Observation' })).toBe(true);
  });
  it('effectiveDateTime dentro e fora do período', () => {
    expect(
      dentroDoPeriodo(periodo, {
        resourceType: 'Observation',
        effectiveDateTime: '2024-06-01T10:00:00-03:00',
      }),
    ).toBe(true);
    expect(
      dentroDoPeriodo(periodo, {
        resourceType: 'Observation',
        effectiveDateTime: '2023-06-01T10:00:00-03:00',
      }),
    ).toBe(false);
  });
  it('effectivePeriod conta pelo início', () => {
    expect(
      dentroDoPeriodo(periodo, {
        resourceType: 'DiagnosticReport',
        effectivePeriod: { start: '2024-06-01T10:00:00-03:00', end: '2024-06-02T10:00:00-03:00' },
      }),
    ).toBe(true);
    expect(
      dentroDoPeriodo(periodo, {
        resourceType: 'DiagnosticReport',
        effectivePeriod: { start: '2025-06-01T10:00:00-03:00' },
      }),
    ).toBe(false);
  });
  it('resultado sem data clínica fica de fora quando há data_period', () => {
    expect(dentroDoPeriodo(periodo, { resourceType: 'Observation' })).toBe(false);
    expect(
      dentroDoPeriodo(periodo, { resourceType: 'Observation', effectiveDateTime: 'ontem' }),
    ).toBe(false);
  });
});
