// Apoio aos testes de agenda e agendamento: descoberta de unidade, agenda,
// horários livres e exames, e montagem do Appointment com pedidos contidos.

import { randomUUID } from 'node:crypto';

import type { Autorizacao, ClienteDeTeste, Contexto } from '../contexto.ts';
import { falhar, naoVerificavel } from '../resultado.ts';
import { type Json, recursos, sucesso, todasAsPaginas } from '../verificacoes.ts';

export type Coding = { system?: string; code?: string; display?: string };

export interface CenarioDeAgendamento {
  agenda: string;
  autorizacao: Autorizacao;
  cliente: ClienteDeTeste;
  /** Exames (coding do catálogo) coletáveis no primeiro horário livre. */
  exames: Coding[][];
  horariosLivres: Array<Json & { id: string }>;
  /** Referência ao paciente, com o fhir_id lido do consentimento (seção 5.1). */
  pacienteRef: string;
  tokenDeAgenda: string;
  unidade: string;
}

export function janela(ctx: Contexto, dias = 14): { inicio: string; fim: string } {
  const inicio = new Date(ctx.agoraMs());
  const fim = new Date(ctx.agoraMs() + dias * 24 * 3600_000);
  return {
    fim: fim.toISOString().replace(/\.\d{3}Z$/, 'Z'),
    inicio: inicio.toISOString().replace(/\.\d{3}Z$/, 'Z'),
  };
}

export async function catalogo(
  ctx: Contexto,
  c: ClienteDeTeste,
): Promise<Array<Json & { id: string }>> {
  const token = await ctx.tokenDeProvedor(c, 'catalog.read');
  return (await todasAsPaginas(ctx, token, 'ActivityDefinition?status=active&_count=100')).recursos;
}

export function codingsDe(ad: Json): Coding[] {
  return (((ad.code as Json | undefined)?.coding as Coding[] | undefined) ?? []).map((c) => ({
    ...(c.system ? { system: c.system } : {}),
    ...(c.code ? { code: c.code } : {}),
    ...(c.display ? { display: c.display } : {}),
  }));
}

export function contemToken(codings: Coding[], token: string): boolean {
  const barra = token.indexOf('|');
  const [sistema, codigo] =
    barra >= 0 ? [token.slice(0, barra), token.slice(barra + 1)] : [undefined, token];
  return codings.some((c) => c.code === codigo && (sistema === undefined || c.system === sistema));
}

export function unidadeConfigurada(ctx: Contexto): string | undefined {
  return ctx.cfg.agenda?.unidade;
}

/** Agenda ativa da unidade. */
export async function agendaDaUnidade(
  ctx: Contexto,
  token: string,
  unidade: string,
): Promise<string> {
  const b = sucesso(
    await ctx.fhir(token, `Schedule?actor=${encodeURIComponent(unidade)}&active=true`),
  );
  const agenda = recursos(b)[0];
  if (!agenda) falhar(`nenhuma Schedule ativa para ${unidade}`);
  return `Schedule/${agenda.id}`;
}

export async function horariosLivres(
  ctx: Contexto,
  token: string,
  agenda: string,
  servicos: string[] = [],
  dias = 14,
): Promise<{ bundle: Json; lista: Array<Json & { id: string }> }> {
  const { fim, inicio } = janela(ctx, dias);
  const q = new URLSearchParams();
  q.append('schedule', agenda);
  q.append('status', 'free');
  q.append('start', `ge${inicio}`);
  q.append('start', `lt${fim}`);
  for (const s of servicos) q.append('service-type', s);
  q.append('_count', '100');
  const b = sucesso(await ctx.fhir(token, `Slot?${q.toString()}`));
  return { bundle: b, lista: recursos(b) };
}

/** Prepara paciente autorizado, unidade, agenda e horários livres. */
export async function cenario(
  ctx: Contexto,
  papel: 'principal' | 'secundario' = 'principal',
): Promise<CenarioDeAgendamento> {
  const cliente = ctx.cliente(papel);
  const unidade = unidadeConfigurada(ctx);
  if (!unidade) naoVerificavel('a configuração não indica a unidade de teste (agenda.unidade)');
  const autorizacao = await ctx.autorizar(cliente);
  const leitura = sucesso(
    await ctx.consentimentos('GET', `/${autorizacao.consentId}`, autorizacao.accessToken, {
      credencial: cliente.credenciais[0]!,
    }),
  );
  const fhirId = (leitura.patient as { fhir_id?: unknown } | undefined)?.fhir_id;
  if (typeof fhirId !== 'string')
    falhar('a leitura do consentimento com token de paciente não trouxe patient.fhir_id');
  const tokenDeAgenda = await ctx.tokenDeProvedor(cliente, 'schedule.read');
  const agenda = await agendaDaUnidade(ctx, tokenDeAgenda, unidade);
  const { lista } = await horariosLivres(ctx, tokenDeAgenda, agenda);
  if (lista.length < 4)
    naoVerificavel('a unidade de teste tem menos de quatro horários livres nos próximos 14 dias');
  const ads = await catalogo(ctx, cliente);
  const tipos = ((lista[0]!.serviceType as Array<{ coding?: Coding[] }> | undefined) ?? []).map(
    (t) => t.coding ?? [],
  );
  const exames: Coding[][] = [];
  const comum = ctx.cfg.agenda?.exame_comum;
  const ordenados = comum
    ? [...tipos].sort((a, b) => Number(contemToken(b, comum)) - Number(contemToken(a, comum)))
    : tipos;
  const restrito = ctx.cfg.agenda?.exame_restrito;
  for (const t of ordenados) {
    if (restrito && contemToken(t, restrito)) continue;
    const ad = ads.find((a) =>
      codingsDe(a).some((c) => t.some((x) => x.system === c.system && x.code === c.code)),
    );
    if (ad) exames.push(codingsDe(ad));
    if (exames.length >= 2) break;
  }
  if (exames.length === 0)
    naoVerificavel('nenhum exame do catálogo corresponde ao serviceType do primeiro horário livre');
  return {
    agenda,
    autorizacao,
    cliente,
    exames,
    horariosLivres: lista,
    pacienteRef: `Patient/${fhirId}`,
    tokenDeAgenda,
    unidade,
  };
}

export interface OpcoesDoAgendamento {
  exames: Coding[][];
  pacienteRef: string;
  sistema?: string;
  slot: Json & { id: string };
  unidade: string;
  valor?: string;
}

export function sistemaDoReceptor(c: ClienteDeTeste): string {
  const u = new URL(c.redirectUri);
  return `${u.origin}/agendamentos`;
}

/** Appointment em proposed com um ServiceRequest contido por exame (seção 5.5.5). */
export function corpoDeAgendamento(o: OpcoesDoAgendamento & { cliente: ClienteDeTeste }): Json {
  const contidos = o.exames.map((codings, i) => ({
    code: { coding: codings },
    id: `exame-${i + 1}`,
    intent: 'order',
    meta: { profile: ['https://fhir-brasil.dev.br/ig/StructureDefinition/br-lab-service-request'] },
    resourceType: 'ServiceRequest',
    status: 'active',
    subject: { reference: o.pacienteRef, type: 'Patient' },
  }));
  return {
    basedOn: contidos.map((c) => ({ reference: `#${c.id}` })),
    contained: contidos,
    end: o.slot.end,
    identifier: [
      { system: o.sistema ?? sistemaDoReceptor(o.cliente), value: o.valor ?? randomUUID() },
    ],
    meta: { profile: ['https://fhir-brasil.dev.br/ig/StructureDefinition/br-lab-appointment'] },
    participant: [
      { actor: { reference: o.pacienteRef, type: 'Patient' }, status: 'accepted' },
      { actor: { reference: o.unidade, type: 'Location' }, status: 'needs-action' },
    ],
    resourceType: 'Appointment',
    slot: [{ reference: `Slot/${o.slot.id}` }],
    start: o.slot.start,
    status: 'proposed',
  };
}

export function ifNoneExist(corpo: Json, codificado = false): string {
  const id = (corpo.identifier as Array<{ system: string; value: string }>)[0]!;
  if (!codificado) return `identifier=${id.system}|${id.value}`;
  return `identifier=${encodeURIComponent(id.system)}%7C${id.value}`;
}

export async function criarAgendamento(
  ctx: Contexto,
  cen: CenarioDeAgendamento,
  corpo: Json,
  o: { codificado?: boolean; semCabecalho?: boolean; cabecalho?: string } = {},
) {
  const cabecalhos: Record<string, string> = { prefer: 'return=representation' };
  if (!o.semCabecalho)
    cabecalhos['if-none-exist'] = o.cabecalho ?? ifNoneExist(corpo, o.codificado);
  return ctx.fhir(cen.autorizacao.accessToken, 'Appointment', {
    cabecalhos,
    corpo,
    credencial: cen.cliente.credenciais[0]!,
    metodo: 'POST',
  });
}

/** Horários da lista que atendem a todos os exames. */
export function horariosQueAtendem(
  lista: Array<Json & { id: string }>,
  exames: Coding[][],
): Array<Json & { id: string }> {
  return lista.filter((s) => {
    const tipos = ((s.serviceType as Array<{ coding?: Coding[] }> | undefined) ?? []).map(
      (t) => t.coding ?? [],
    );
    return exames.every((codings) =>
      tipos.some((t) =>
        t.some((x) => codings.some((c) => c.system === x.system && c.code === x.code)),
      ),
    );
  });
}
