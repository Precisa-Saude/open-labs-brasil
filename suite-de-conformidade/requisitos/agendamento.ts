// AGD: agendamento, com token de paciente (seção 9.3).

import { randomUUID } from 'node:crypto';
import type { Contexto } from '../contexto.ts';
import { cabecalhoUnico, type Resposta } from '../http.ts';
import { esperar, falhar, naoVerificavel } from '../resultado.ts';
import { erroApi, recursos, resumo, sucesso, type Json } from '../verificacoes.ts';
import { cenario, corpoDeAgendamento, criarAgendamento, horariosLivres, horariosQueAtendem, ifNoneExist, type CenarioDeAgendamento } from './apoio.ts';
import type { Teste } from './tipos.ts';

const URL_PAYMENT_LINK = 'https://fhir-brasil.dev.br/ig/StructureDefinition/payment-link';
type Recurso = Json & { id: string };

function estavel(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(estavel).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v as Json).sort().map((k) => `${JSON.stringify(k)}:${estavel((v as Json)[k])}`).join(',')}}`;
  return JSON.stringify(v);
}

function horarios(cen: CenarioDeAgendamento, exames = cen.exames): Recurso[] {
  const h = horariosQueAtendem(cen.horariosLivres, exames);
  if (h.length < 3) naoVerificavel('menos de três horários livres atendem aos exames escolhidos');
  return h;
}

async function agendar(ctx: Contexto, cen: CenarioDeAgendamento, slot: Recurso, o: { exames?: CenarioDeAgendamento['exames']; valor?: string; codificado?: boolean } = {}): Promise<{ resposta: Resposta; corpo: Json }> {
  const corpo = corpoDeAgendamento({ cliente: cen.cliente, slot, exames: o.exames ?? cen.exames, unidade: cen.unidade, pacienteRef: cen.pacienteRef, ...(o.valor ? { valor: o.valor } : {}) });
  return { resposta: await criarAgendamento(ctx, cen, corpo, o.codificado ? { codificado: true } : {}), corpo };
}

async function agendado(ctx: Contexto, cen: CenarioDeAgendamento, slot: Recurso): Promise<{ recurso: Recurso; etag: string }> {
  const { resposta } = await agendar(ctx, cen, slot);
  const recurso = sucesso(resposta, 201) as Recurso;
  return { recurso, etag: cabecalhoUnico(resposta, 'etag') ?? falhar('201 sem ETag') };
}

async function ler(ctx: Contexto, cen: CenarioDeAgendamento, id: string): Promise<{ recurso: Recurso; etag: string }> {
  const r = await ctx.fhir(cen.autorizacao.accessToken, `Appointment/${id}`);
  return { recurso: sucesso(r) as Recurso, etag: cabecalhoUnico(r, 'etag') ?? falhar('leitura sem ETag') };
}

async function atualizar(ctx: Contexto, cen: CenarioDeAgendamento, recurso: Json, ifMatch?: string): Promise<Resposta> {
  return ctx.fhir(cen.autorizacao.accessToken, `Appointment/${String(recurso.id)}`, {
    metodo: 'PUT',
    corpo: recurso,
    cabecalhos: ifMatch ? { 'if-match': ifMatch } : {},
  });
}

async function porIdentificador(ctx: Contexto, cen: CenarioDeAgendamento, corpo: Json): Promise<Recurso[]> {
  const id = (corpo.identifier as Array<{ system: string; value: string }>)[0]!;
  return recursos(sucesso(await ctx.fhir(cen.autorizacao.accessToken, `Appointment?identifier=${encodeURIComponent(`${id.system}|${id.value}`)}`)));
}

async function horarioLivre(ctx: Contexto, cen: CenarioDeAgendamento, slotId: string): Promise<boolean> {
  return (await horariosLivres(ctx, cen.tokenDeAgenda, cen.agenda)).lista.some((s) => s.id === slotId);
}

function linkDePagamento(recurso: Json): string | undefined {
  const ext = ((recurso.extension as Json[] | undefined) ?? []).filter((e) => e.url === URL_PAYMENT_LINK);
  return ext.length === 1 ? (ext[0]!.valueUrl as string | undefined) : undefined;
}

/** Sufixos públicos de segundo nível mais comuns (com.br, gov.br, co.uk...), sem depender da lista pública de sufixos. */
const SUFIXO_DE_SEGUNDO_NIVEL = /^(com|net|org|gov|edu|med|ind|srv|art|adv|eng|inf|ong|mil|co|ac)\.[a-z]{2}$/;

/** Domínio registrável aproximado: host inteiro para IP e localhost; últimos dois rótulos, ou três sob sufixo de segundo nível. */
export function dominioRegistravel(host: string): string {
  if (/^[\d.]+$/.test(host) || host.includes(':')) return host;
  const rotulos = host.split('.');
  if (rotulos.length <= 2) return host;
  const dois = rotulos.slice(-2).join('.');
  return SUFIXO_DE_SEGUNDO_NIVEL.test(dois) ? rotulos.slice(-3).join('.') : dois;
}

function dominioDoProvedor(ctx: Contexto, url: string): boolean {
  const host = new URL(url).hostname;
  const p = ctx.provedor.provider!;
  return [p.issuer, p.fhir_base_url, p.api_base_url, p.consent_management_uri].some((u) => {
    const h = new URL(u).hostname;
    return host === h || dominioRegistravel(host) === dominioRegistravel(h);
  });
}

export const testesDeAgendamento: Teste[] = [
  {
    id: 'AGD-001',
    titulo: 'POST /Appointment com ServiceRequest contidos devolve 201 com recurso, Location e ETag',
    executar: async (ctx, r) => {
      const cen = await cenario(ctx);
      esperar(cen.exames.length >= 2, 'o horário de teste não tem dois exames do catálogo');
      const { resposta, corpo } = await agendar(ctx, cen, horarios(cen)[0]!);
      const rec = sucesso(resposta, 201);
      esperar(rec.resourceType === 'Appointment' && typeof rec.id === 'string', '201 sem o Appointment no corpo');
      esperar(cabecalhoUnico(resposta, 'location')?.includes(`Appointment/${String(rec.id)}`), 'sem cabeçalho Location do agendamento');
      esperar(cabecalhoUnico(resposta, 'etag'), 'sem ETag');
      esperar(['pending', 'booked'].includes(String(rec.status)), `status ${String(rec.status)}`);
      const contidos = (rec.contained as Json[] | undefined) ?? [];
      esperar(contidos.length === 2 && ((rec.basedOn as Json[]) ?? []).length === 2, 'pedidos contidos ou basedOn não preservados');
      esperar(estavel(contidos.map((c) => (c.code as Json).coding)) === estavel((corpo.contained as Json[]).map((c) => (c.code as Json).coding)), 'os coding dos pedidos mudaram');
      r.evidencia(`Appointment/${String(rec.id)} ${String(rec.status)} com dois pedidos contidos`);
    },
  },
  {
    id: 'AGD-002',
    titulo: 'Recusa Appointment sem pedido contido, com pedido não referenciado ou basedOn externo (422 INVALID_RESOURCE)',
    executar: async (ctx, r) => {
      const cen = await cenario(ctx);
      const slot = horarios(cen)[0]!;
      const base = () => corpoDeAgendamento({ cliente: cen.cliente, slot, exames: cen.exames.slice(0, 2), unidade: cen.unidade, pacienteRef: cen.pacienteRef });
      const semContido = { ...base(), contained: [], basedOn: [] };
      const naoReferenciado = (() => {
        const b = base();
        return { ...b, basedOn: [(b.basedOn as Json[])[0]] };
      })();
      const externo = { ...base(), basedOn: [{ reference: 'ServiceRequest/externo-1' }, { reference: '#exame-2' }] };
      for (const [nome, corpo] of [['sem pedido contido', semContido], ['pedido não referenciado', naoReferenciado], ['basedOn para fora', externo]] as const) {
        if (nome === 'pedido não referenciado' && cen.exames.length < 2) continue;
        erroApi(await criarAgendamento(ctx, cen, corpo), 422, 'INVALID_RESOURCE');
        esperar((await porIdentificador(ctx, cen, corpo)).length === 0, `${nome}: o agendamento ficou gravado`);
        r.evidencia(`${nome}: 422 INVALID_RESOURCE, nada gravado`);
      }
    },
  },
  {
    id: 'AGD-003',
    titulo: 'Recusa POST /Appointment sem If-None-Exist',
    executar: async (ctx, r) => {
      const cen = await cenario(ctx);
      const corpo = corpoDeAgendamento({ cliente: cen.cliente, slot: horarios(cen)[0]!, exames: cen.exames, unidade: cen.unidade, pacienteRef: cen.pacienteRef });
      erroApi(await criarAgendamento(ctx, cen, corpo, { semCabecalho: true }), 400, 'IF_NONE_EXIST_REQUIRED');
      r.evidencia('sem If-None-Exist: 400 IF_NONE_EXIST_REQUIRED');
    },
  },
  {
    id: 'AGD-004',
    titulo: 'Repetição da criação com o mesmo identificador devolve 200 sem criar outro',
    executar: async (ctx, r) => {
      const cen = await cenario(ctx);
      const corpo = corpoDeAgendamento({ cliente: cen.cliente, slot: horarios(cen)[0]!, exames: cen.exames, unidade: cen.unidade, pacienteRef: cen.pacienteRef });
      sucesso(await criarAgendamento(ctx, cen, corpo), 201);
      const segunda = await criarAgendamento(ctx, cen, corpo);
      esperar(segunda.status === 200, `repetição: ${resumo(segunda)}`);
      const achados = await porIdentificador(ctx, cen, corpo);
      esperar(achados.length === 1, `busca por identifier devolveu ${achados.length} agendamentos`);
      r.evidencia('201, depois 200; um agendamento só');
    },
  },
  {
    id: 'AGD-005',
    titulo: 'Horário ocupado devolve 409 SLOT_UNAVAILABLE',
    executar: async (ctx, r) => {
      const cen = await cenario(ctx);
      const slot = horarios(cen)[0]!;
      sucesso((await agendar(ctx, cen, slot)).resposta, 201);
      const outro = await agendar(ctx, cen, slot, { valor: randomUUID() });
      erroApi(outro.resposta, 409, 'SLOT_UNAVAILABLE');
      r.evidencia('segundo agendamento no mesmo horário: 409 SLOT_UNAVAILABLE');
    },
  },
  {
    id: 'AGD-006',
    titulo: 'Paciente diferente do consentimento no agendamento ou em pedido contido devolve 422 PATIENT_NOT_IN_CONSENT',
    executar: async (ctx, r) => {
      const cen = await cenario(ctx);
      const slot = horarios(cen)[0]!;
      const outro = ctx.cfg.pacientes.outro?.fhir_id ? `Patient/${ctx.cfg.pacientes.outro.fhir_id}` : 'Patient/paciente-de-outra-pessoa';
      const base = () => corpoDeAgendamento({ cliente: cen.cliente, slot, exames: cen.exames.slice(0, 1), unidade: cen.unidade, pacienteRef: cen.pacienteRef });
      const noParticipante = base();
      (((noParticipante.participant as Json[])[0]!.actor) as Json).reference = outro;
      const noPedido = base();
      ((noPedido.contained as Json[])[0]!.subject as Json).reference = outro;
      const nosDois = corpoDeAgendamento({ cliente: cen.cliente, slot, exames: cen.exames.slice(0, 1), unidade: cen.unidade, pacienteRef: outro });
      for (const [nome, corpo] of [['participante', noParticipante], ['pedido contido', noPedido], ['participante e pedido', nosDois]] as const) {
        erroApi(await criarAgendamento(ctx, cen, corpo), 422, 'PATIENT_NOT_IN_CONSENT');
        r.evidencia(`${nome}: 422 PATIENT_NOT_IN_CONSENT`);
      }
    },
  },
  {
    id: 'AGD-007',
    titulo: 'Com pagamento a fazer, devolve pending com link https em domínio do provedor',
    executar: async (ctx, r) => {
      const cen = await cenario(ctx);
      const { recurso } = await agendado(ctx, cen, horarios(cen)[0]!);
      if (recurso.status === 'booked') naoVerificavel('o exame de teste não exigiu pagamento (o agendamento já veio booked)');
      esperar(recurso.status === 'pending', `status ${String(recurso.status)}`);
      const link = linkDePagamento(recurso) ?? falhar('pending sem link de pagamento na extensão payment-link');
      esperar(link.startsWith('https://'), `link sem https: ${link}`);
      esperar(dominioDoProvedor(ctx, link), `link fora do domínio do provedor: ${link}`);
      r.evidencia(`pending com link em ${new URL(link).origin}`);
    },
  },
  {
    id: 'AGD-008',
    titulo: 'Depois do pagamento passa a booked; sem pagamento no prazo, a cancelled',
    fase: 'relogio',
    executar: async (ctx, r) => {
      const cen = await cenario(ctx);
      const [h1, h2] = horarios(cen);
      const pago = (await agendado(ctx, cen, h1!)).recurso;
      if (pago.status === 'booked') naoVerificavel('o exame de teste não exigiu pagamento');
      const rc = await ctx.controle('POST', '/_controle/pagamento', { appointment_id: pago.id });
      esperar(rc.status === 200, 'interface de controle não confirmou o pagamento');
      const depois = (await ler(ctx, cen, pago.id)).recurso;
      esperar(depois.status === 'booked', `depois do pagamento: ${String(depois.status)}`);
      if (linkDePagamento(depois)) r.evidencia('o link continua no agendamento booked (DEVERIA sair)');
      const vencido = (await agendado(ctx, cen, h2!)).recurso;
      const prazo = ctx.cfg.agenda?.prazo_de_pagamento_minutos ?? 24 * 60;
      await ctx.avancarRelogio(prazo * 60 + 120);
      const renovado = sucesso(await ctx.renovar(cen.cliente, cen.autorizacao.refreshToken));
      const lido = await ctx.fhir(String(renovado.access_token), `Appointment/${vencido.id}`, { credencial: cen.cliente.credenciais[0]! });
      esperar(sucesso(lido).status === 'cancelled', `sem pagamento depois de ${prazo} min: ${String((lido.json as Json | undefined)?.status)}`);
      r.evidencia(`pago: booked; sem pagamento por ${prazo} min: cancelled`);
    },
  },
  {
    id: 'AGD-009',
    titulo: 'PUT sem If-Match devolve 400; com versão antiga, 412',
    executar: async (ctx, r) => {
      const cen = await cenario(ctx);
      const { recurso } = await agendado(ctx, cen, horarios(cen)[0]!);
      const cancelar = { ...recurso, status: 'cancelled' };
      erroApi(await atualizar(ctx, cen, cancelar), 400, 'IF_MATCH_REQUIRED');
      erroApi(await atualizar(ctx, cen, cancelar, 'W/"versao-antiga-0"'), 412, 'VERSION_CONFLICT');
      esperar((await ler(ctx, cen, recurso.id)).recurso.status !== 'cancelled', 'o agendamento foi cancelado mesmo assim');
      r.evidencia('sem If-Match: 400 IF_MATCH_REQUIRED; versão antiga: 412 VERSION_CONFLICT');
    },
  },
  {
    id: 'AGD-010',
    titulo: 'Remarcação para horário livre devolve 200, mantém os pedidos e libera o horário anterior',
    executar: async (ctx, r) => {
      const cen = await cenario(ctx);
      const [h1, , h3] = horarios(cen);
      const { recurso, etag } = await agendado(ctx, cen, h1!);
      const remarcado = { ...recurso, slot: [{ reference: `Slot/${h3!.id}` }], start: h3!.start, end: h3!.end };
      const resp = await atualizar(ctx, cen, remarcado, etag);
      const novo = sucesso(resp);
      esperar(estavel(novo.contained) === estavel(recurso.contained), 'os pedidos contidos mudaram na remarcação');
      esperar(((novo.slot as Json[])[0]!.reference) === `Slot/${h3!.id}`, 'o agendamento não ficou no novo horário');
      esperar(await horarioLivre(ctx, cen, h1!.id), 'o horário anterior não foi liberado');
      esperar(!(await horarioLivre(ctx, cen, h3!.id)), 'o novo horário continua livre');
      r.evidencia(`Slot/${h1!.id} liberado, Slot/${h3!.id} ocupado, pedidos iguais`);
    },
  },
  {
    id: 'AGD-011',
    titulo: 'Cancelamento devolve 200 com cancelled e libera o horário',
    executar: async (ctx, r) => {
      const cen = await cenario(ctx);
      const h = horarios(cen)[0]!;
      const { recurso, etag } = await agendado(ctx, cen, h);
      const resp = await atualizar(ctx, cen, { ...recurso, status: 'cancelled', cancelationReason: { text: 'Teste de conformidade' } }, etag);
      esperar(sucesso(resp).status === 'cancelled', 'status não é cancelled');
      esperar(await horarioLivre(ctx, cen, h.id), 'o horário não foi liberado');
      const lido = await ler(ctx, cen, recurso.id);
      erroApi(await atualizar(ctx, cen, { ...lido.recurso, status: 'booked' }, lido.etag), 422, 'APPOINTMENT_NOT_MODIFIABLE');
      r.evidencia('cancelled, horário livre, agendamento cancelado não muda mais');
    },
  },
  {
    id: 'AGD-012',
    titulo: 'PUT que altera elemento não permitido devolve 422 APPOINTMENT_FIELD_NOT_MODIFIABLE',
    executar: async (ctx, r) => {
      const cen = await cenario(ctx);
      const { recurso, etag } = await agendado(ctx, cen, horarios(cen)[0]!);
      const outro = ctx.cfg.pacientes.outro?.fhir_id ? `Patient/${ctx.cfg.pacientes.outro.fhir_id}` : 'Patient/outra-pessoa';
      const comOutroPaciente = structuredClone(recurso);
      ((comOutroPaciente.participant as Json[]).find((p) => (p.actor as Json).type === 'Patient')!.actor as Json).reference = outro;
      erroApi(await atualizar(ctx, cen, comOutroPaciente, etag), 422, 'APPOINTMENT_FIELD_NOT_MODIFIABLE');
      const comOutroExame = structuredClone(recurso);
      const pedido = (comOutroExame.contained as Json[])[0]!;
      (pedido.code as Json).coding = [{ system: 'http://loinc.org', code: '718-7', display: 'Hemoglobin [Mass/volume] in Blood' }];
      erroApi(await atualizar(ctx, cen, comOutroExame, etag), 422, 'APPOINTMENT_FIELD_NOT_MODIFIABLE');
      r.evidencia('paciente alterado e código do pedido alterado: 422 APPOINTMENT_FIELD_NOT_MODIFIABLE');
    },
  },
  {
    id: 'AGD-013',
    titulo: 'Só são visíveis agendamentos criados pelo mesmo receptor pelo protocolo',
    executar: async (ctx, r) => {
      const outroCanal = ctx.cfg.pacientes.principal.agendamento_de_outro_canal;
      const cen = await cenario(ctx);
      const { recurso } = await agendado(ctx, cen, horarios(cen)[0]!);
      const meus = recursos(sucesso(await ctx.fhir(cen.autorizacao.accessToken, `Appointment?patient=${cen.pacienteRef}`)));
      esperar(meus.some((a) => a.id === recurso.id), 'a busca não mostra o agendamento do próprio receptor');
      if (!outroCanal) naoVerificavel('a configuração não traz um agendamento feito por outro canal (pacientes.principal.agendamento_de_outro_canal)');
      esperar(!meus.some((a) => a.id === outroCanal), 'a busca mostra agendamento feito por outro canal');
      erroApi(await ctx.fhir(cen.autorizacao.accessToken, `Appointment/${outroCanal}`), 404, 'RESOURCE_NOT_FOUND');
      const b = ctx.clientes.get('secundario');
      if (b) {
        const cenB = await cenario(ctx, 'secundario');
        const doB = recursos(sucesso(await ctx.fhir(cenB.autorizacao.accessToken, `Appointment?patient=${cenB.pacienteRef}`, { credencial: b.credenciais[0]! })));
        esperar(!doB.some((a) => a.id === recurso.id), 'outro receptor enxerga o agendamento do receptor principal');
        r.evidencia('o receptor B não enxerga o agendamento do A');
      }
      r.evidencia(`agendamento de outro canal (${outroCanal}) invisível: fora da busca e 404 na leitura`);
    },
  },
  {
    id: 'AGD-014',
    titulo: 'ServiceRequest não é recurso endereçável',
    executar: async (ctx, r) => {
      const cen = await cenario(ctx);
      const { recurso } = await agendado(ctx, cen, horarios(cen)[0]!);
      const contido = (recurso.contained as Json[])[0]!.id as string;
      const resp = await ctx.fhir(cen.autorizacao.accessToken, `ServiceRequest/${contido}`);
      esperar(resp.status === 404 || resp.status === 405, `GET /ServiceRequest/${contido}: ${resumo(resp)}`);
      r.evidencia(`GET /ServiceRequest/${contido}: ${resp.status}`);
    },
  },
  {
    id: 'AGD-015',
    titulo: 'If-None-Exist aceito na forma literal e com %7C',
    executar: async (ctx, r) => {
      const cen = await cenario(ctx);
      const [h1, h2] = horarios(cen);
      for (const [primeira, segunda, slot] of [[false, true, h1!], [true, false, h2!]] as const) {
        const corpo = corpoDeAgendamento({ cliente: cen.cliente, slot, exames: cen.exames, unidade: cen.unidade, pacienteRef: cen.pacienteRef });
        const a = await criarAgendamento(ctx, cen, corpo, { codificado: primeira });
        sucesso(a, 201);
        const b = await criarAgendamento(ctx, cen, corpo, { codificado: segunda });
        esperar(b.status === 200, `repetição com a outra forma (${ifNoneExist(corpo, segunda)}): ${resumo(b)}`);
        r.evidencia(`${primeira ? 'codificada' : 'literal'} 201, depois ${segunda ? 'codificada' : 'literal'} 200`);
      }
    },
  },
  {
    id: 'AGD-016',
    titulo: 'Link de pagamento só em Appointment.extension payment-link, com https',
    executar: async (ctx, r) => {
      const cen = await cenario(ctx);
      const { recurso } = await agendado(ctx, cen, horarios(cen)[0]!);
      if (recurso.status !== 'pending') naoVerificavel('o agendamento de teste não ficou pending');
      const extensoes = ((recurso.extension as Json[] | undefined) ?? []).filter((e) => e.url === URL_PAYMENT_LINK);
      esperar(extensoes.length === 1, `${extensoes.length} extensões payment-link`);
      const link = String(extensoes[0]!.valueUrl ?? '');
      esperar(link.startsWith('https://'), `valueUrl sem https: ${link}`);
      const resto = structuredClone(recurso);
      resto.extension = ((resto.extension as Json[] | undefined) ?? []).filter((e) => e.url !== URL_PAYMENT_LINK);
      delete resto.meta;
      esperar(!JSON.stringify(resto).includes(link), 'o link de pagamento aparece fora da extensão');
      for (const campo of ['comment', 'patientInstruction', 'description']) {
        esperar(!/https?:\/\//.test(String(resto[campo] ?? '')), `URL em Appointment.${campo}`);
      }
      r.evidencia('link só em extension payment-link, com https');
    },
  },
  {
    id: 'AGD-017',
    titulo: 'Recusa identificador do receptor com caractere fora do conjunto permitido',
    executar: async (ctx, r) => {
      const cen = await cenario(ctx);
      const slot = horarios(cen)[0]!;
      for (const valor of ['ab!cd', 'com espaço']) {
        const corpo = corpoDeAgendamento({ cliente: cen.cliente, slot, exames: cen.exames, unidade: cen.unidade, pacienteRef: cen.pacienteRef, valor });
        const id = (corpo.identifier as Array<{ system: string; value: string }>)[0]!;
        const resp = await criarAgendamento(ctx, cen, corpo, { cabecalho: `identifier=${id.system}|${encodeURIComponent(valor)}` });
        erroApi(resp, 422, 'INVALID_RESOURCE');
        r.evidencia(`value "${valor}": 422 INVALID_RESOURCE`);
      }
      const sistema = `${new URL(cen.cliente.redirectUri).origin}/agendamentos?x=1`;
      const comConsulta = corpoDeAgendamento({ cliente: cen.cliente, slot, exames: cen.exames, unidade: cen.unidade, pacienteRef: cen.pacienteRef, sistema, valor: 'abc' });
      erroApi(await criarAgendamento(ctx, cen, comConsulta, { cabecalho: `identifier=${encodeURIComponent(sistema)}%7Cabc` }), 422, 'INVALID_RESOURCE');
      r.evidencia('system com consulta: 422 INVALID_RESOURCE');
    },
  },
];
