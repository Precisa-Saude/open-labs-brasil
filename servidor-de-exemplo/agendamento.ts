// Agendamento (seção 5.5.5): criação condicional com pedidos contidos,
// remarcação e cancelamento por PUT com If-Match, link de pagamento e página de
// pagamento simulada.

import type { IncomingMessage, ServerResponse } from 'node:http';
import { cabecalho, enviarFhir, enviarHtml, ErroDeApi, lerCorpo, lerFormulario, novoId } from './http.ts';
import { codingsDoExame, EXAMES, perfil, SISTEMA_CPF, URL_PAYMENT_LINK, type Exame, type Recurso, type Registro } from './dados.ts';
import { paginaDeErro, paginaDePagamento } from './paginas.ts';
import { segredo, type Consentimento, type Provedor } from './provedor.ts';
import { exigirConteudo, type Acesso } from './recursos.ts';

type Json = Record<string, unknown>;
interface Referencia { reference?: string; type?: string; identifier?: { system?: string; value?: string } }
interface Participante { actor?: Referencia; status?: string }

const ESTADOS_FINAIS_DO_AGENDAMENTO = ['cancelled', 'fulfilled', 'noshow', 'entered-in-error'];
const POLITICA_DE_ALTERACAO_MS = 2 * 3600_000;

function invalido(texto: string, expressao?: string): ErroDeApi {
  return new ErroDeApi(422, 'INVALID_RESOURCE', 'invariant', texto, expressao ? { expressao: [expressao] } : {});
}

function pagamentoPendente(reg: Registro): reg is Registro & { pagamento: { token: string; ate: number } } {
  return Boolean((reg as { pagamento?: unknown }).pagamento);
}

function registroDoPagamento(reg: Registro): { token: string; ate: number } | undefined {
  return (reg as { pagamento?: { token: string; ate: number } }).pagamento;
}

function definirPagamento(reg: Registro, valor: { token: string; ate: number } | undefined): void {
  if (valor) (reg as { pagamento?: unknown }).pagamento = valor;
  else delete (reg as { pagamento?: unknown }).pagamento;
}

function linkDePagamento(provedor: Provedor, token: string): string {
  return `${provedor.issuer.replace(/\/$/, '')}/pagamento/${token}`;
}

function semExtensaoDePagamento(extensoes: unknown): Json[] {
  return ((extensoes as Json[] | undefined) ?? []).filter((e) => e.url !== URL_PAYMENT_LINK);
}

function aplicarLink(provedor: Provedor, recurso: Recurso, token: string | undefined): void {
  const extensoes = semExtensaoDePagamento(recurso.extension);
  if (token) extensoes.push({ url: URL_PAYMENT_LINK, valueUrl: linkDePagamento(provedor, token) });
  if (extensoes.length) recurso.extension = extensoes;
  else delete recurso.extension;
  if (provedor.violacao('link-de-pagamento-em-comment')) {
    if (token) recurso.comment = `Pague em ${linkDePagamento(provedor, token)}`;
    else delete recurso.comment;
  }
}

function mudarSlot(provedor: Provedor, slotId: string, status: 'free' | 'busy'): void {
  const reg = provedor.dados.tipo('Slot').get(slotId);
  if (!reg || reg.recurso.status === status) return;
  provedor.dados.atualizar(reg, { ...reg.recurso, status }, provedor.relogio.agoraMs());
}

/** Cancela o agendamento: libera o horário, revoga os pedidos contidos, tira o link. */
function cancelar(provedor: Provedor, reg: Registro, recurso: Recurso): void {
  recurso.status = 'cancelled';
  for (const sr of (recurso.contained as Json[] | undefined) ?? []) sr.status = 'revoked';
  aplicarLink(provedor, recurso, undefined);
  definirPagamento(reg, undefined);
  const slot = ((recurso.slot as Referencia[] | undefined) ?? [])[0]?.reference?.replace('Slot/', '');
  if (slot) mudarSlot(provedor, slot, 'free');
}

/** Agendamentos pendentes de pagamento além do prazo passam a cancelled. */
export function expirarPagamentos(provedor: Provedor): void {
  const agora = provedor.relogio.agoraMs();
  for (const reg of provedor.dados.tipo('Appointment').values()) {
    const p = registroDoPagamento(reg);
    if (p && reg.recurso.status === 'pending' && agora > p.ate) {
      const recurso = structuredClone(reg.recurso);
      cancelar(provedor, reg, recurso);
      recurso.cancelationReason = { text: 'Pagamento não feito no prazo.' };
      provedor.dados.atualizar(reg, recurso, agora);
      provedor.log(`agendamento ${reg.recurso.id} cancelado por falta de pagamento`);
    }
  }
}

/** Confirma o pagamento: o agendamento passa a booked. */
export function confirmarPagamento(provedor: Provedor, appointmentId: string): boolean {
  expirarPagamentos(provedor);
  const reg = provedor.dados.tipo('Appointment').get(appointmentId);
  if (!reg || reg.recurso.status !== 'pending' || !pagamentoPendente(reg)) return false;
  const recurso = structuredClone(reg.recurso);
  recurso.status = 'booked';
  aplicarLink(provedor, recurso, undefined);
  definirPagamento(reg, undefined);
  provedor.dados.atualizar(reg, recurso, provedor.relogio.agoraMs());
  return true;
}

function referenciaDoPaciente(ref: Referencia | undefined, c: Consentimento, base: string): boolean {
  if (!ref) return false;
  if (ref.reference) {
    const r = ref.reference.startsWith(`${base}/`) ? ref.reference.slice(base.length + 1) : ref.reference;
    return r === `Patient/${c.paciente!.fhirId}`;
  }
  return ref.identifier?.system === SISTEMA_CPF && ref.identifier.value === c.paciente!.cpf;
}

function mesmaReferencia(a: Referencia | undefined, b: Referencia | undefined): boolean {
  if (!a || !b) return false;
  if (a.reference || b.reference) return a.reference !== undefined && a.reference === b.reference;
  return a.identifier?.system === SISTEMA_CPF && a.identifier?.value !== undefined && a.identifier.value === b.identifier?.value && b.identifier?.system === SISTEMA_CPF;
}

function exameDosCodings(codings: Array<{ system?: string; code?: string }>): Exame | undefined {
  const chave = (x: { system?: string; code?: string }) => `${x.system ?? ''}|${x.code ?? ''}`;
  const pedido = new Set(codings.map(chave));
  return EXAMES.find((e) => {
    if (e.status !== 'active') return false;
    const doCatalogo = new Set(codingsDoExame(e).map(chave));
    return doCatalogo.size === pedido.size && [...pedido].every((k) => doCatalogo.has(k));
  });
}

const PADRAO_SISTEMA = /^https:\/\/[A-Za-z0-9\-._~:/]+$/;
const PADRAO_VALOR = /^[A-Za-z0-9\-._~]{1,64}$/;

/** Formato de If-None-Exist (seção 5.5.5): literal ou com a barra e o system codificados por %. */
function lerIfNoneExist(valor: string | undefined): { system: string; value: string } {
  const falha = (t: string) => new ErroDeApi(400, 'IF_NONE_EXIST_REQUIRED', 'required', t);
  if (!valor) throw falha('POST /Appointment exige o cabeçalho If-None-Exist.');
  if (!valor.startsWith('identifier=') || valor.includes('&') || /\s/.test(valor)) {
    throw falha('If-None-Exist precisa ter exatamente um parâmetro identifier.');
  }
  let texto: string;
  try {
    texto = decodeURIComponent(valor.slice('identifier='.length));
  } catch {
    throw falha('If-None-Exist com codificação inválida.');
  }
  const barra = texto.indexOf('|');
  if (barra <= 0 || barra === texto.length - 1) throw falha('If-None-Exist precisa ser identifier={system}|{value}.');
  return { system: texto.slice(0, barra), value: texto.slice(barra + 1) };
}

interface AgendamentoValidado {
  identificador: { system: string; value: string };
  slotId: string;
  unidadeId: string;
  exames: Exame[];
}

/** Conferências do perfil br-lab-appointment e do protocolo. Ordem: paciente, invariantes, catálogo. */
function validarAgendamento(provedor: Provedor, c: Consentimento, corpo: Json, criacao: boolean): AgendamentoValidado {
  const base = provedor.fhirBaseUrl.replace(/\/$/, '');
  const participantes = (corpo.participant as Participante[] | undefined) ?? [];
  const contidos = (corpo.contained as Json[] | undefined) ?? [];
  const pacientes = participantes.filter((p) => p.actor?.type === 'Patient');
  for (const p of pacientes) {
    if (!referenciaDoPaciente(p.actor, c, base)) {
      throw new ErroDeApi(422, 'PATIENT_NOT_IN_CONSENT', 'business-rule', 'O agendamento referencia paciente diferente do paciente do consentimento.', { expressao: ['Appointment.participant.actor'] });
    }
  }
  for (const sr of contidos) {
    if (sr.subject && !referenciaDoPaciente(sr.subject as Referencia, c, base)) {
      throw new ErroDeApi(422, 'PATIENT_NOT_IN_CONSENT', 'business-rule', 'Um pedido contido referencia paciente diferente do paciente do consentimento.', { expressao: ['Appointment.contained.subject'] });
    }
  }

  if (criacao && corpo.status !== 'proposed') throw invalido('O Appointment precisa chegar com status proposed.', 'Appointment.status');
  if (criacao && semExtensaoDePagamento(corpo.extension).length !== ((corpo.extension as unknown[] | undefined)?.length ?? 0)) {
    throw invalido('O receptor não envia a extensão de link de pagamento na criação.', 'Appointment.extension');
  }
  const identificadores = (corpo.identifier as Array<{ system?: string; value?: string }> | undefined) ?? [];
  if (identificadores.length !== 1) throw invalido('O Appointment precisa de exatamente um identifier do receptor.', 'Appointment.identifier');
  const { system, value } = identificadores[0]!;
  if (typeof system !== 'string' || typeof value !== 'string') throw invalido('identifier sem system ou value.', 'Appointment.identifier');
  if (!provedor.violacao('aceita-identificador-invalido')) {
    if (!PADRAO_SISTEMA.test(system) || system.length > 200) throw invalido('identifier.system fora das regras da seção 5.5.5.', 'Appointment.identifier.system');
    if (!PADRAO_VALOR.test(value)) throw invalido('identifier.value fora do conjunto A-Z, a-z, 0-9, -, ., _, ~ ou com mais de 64 caracteres.', 'Appointment.identifier.value');
  }

  if (contidos.length === 0 || contidos.some((x) => x.resourceType !== 'ServiceRequest')) {
    throw invalido('O agendamento precisa de ao menos um ServiceRequest em contained, e só deles (br-lab-appointment-contained-request).', 'Appointment.contained');
  }
  const ids = new Set<string>();
  for (const sr of contidos) {
    if (typeof sr.id !== 'string' || ids.has(sr.id)) throw invalido('Pedido contido sem id ou com id repetido.', 'Appointment.contained.id');
    ids.add(sr.id);
    if (sr.status !== 'active' && criacao) throw invalido('Pedido contido precisa de status active.', 'Appointment.contained.status');
    if (sr.intent !== 'order') throw invalido('Pedido contido precisa de intent order.', 'Appointment.contained.intent');
    const meta = sr.meta as Json | undefined;
    if (meta?.versionId !== undefined || meta?.lastUpdated !== undefined) throw invalido('Recurso contido não leva meta.versionId nem meta.lastUpdated.', 'Appointment.contained.meta');
    const codings = ((sr.code as Json | undefined)?.coding as Array<{ system?: string; code?: string }> | undefined) ?? [];
    if (codings.length === 0) throw invalido('Pedido contido sem code.coding.', 'Appointment.contained.code');
  }
  const basedOn = (corpo.basedOn as Referencia[] | undefined) ?? [];
  if (basedOn.length === 0) throw invalido('basedOn é obrigatório.', 'Appointment.basedOn');
  const apontados = new Set<string>();
  for (const b of basedOn) {
    const ref = b.reference;
    if (!ref || !ref.startsWith('#') || !ids.has(ref.slice(1))) {
      throw invalido('Cada basedOn precisa ser referência local a um ServiceRequest contido (br-lab-appointment-based-on-contained).', 'Appointment.basedOn');
    }
    apontados.add(ref.slice(1));
  }
  for (const id of ids) if (!apontados.has(id)) throw invalido('Todo pedido contido precisa de um basedOn que aponte para ele.', 'Appointment.contained');

  if (pacientes.length !== 1) throw invalido('O agendamento precisa de exatamente um participante com actor.type Patient.', 'Appointment.participant');
  const unidades = participantes.filter((p) => p.actor?.type === 'Location');
  if (unidades.length !== 1 || !unidades[0]!.actor?.reference?.startsWith('Location/')) {
    throw invalido('O agendamento precisa de exatamente um participante com actor.type Location.', 'Appointment.participant');
  }
  const unidadeId = unidades[0]!.actor!.reference!.slice('Location/'.length);
  if (!provedor.dados.examesPorUnidade.has(unidadeId)) throw invalido('Unidade desconhecida.', 'Appointment.participant.actor');
  for (const sr of contidos) {
    if (!mesmaReferencia(sr.subject as Referencia, pacientes[0]!.actor)) {
      throw invalido('O subject de cada pedido contido precisa repetir o paciente do agendamento (br-lab-appointment-request-subject).', 'Appointment.contained.subject');
    }
  }
  const slots = (corpo.slot as Referencia[] | undefined) ?? [];
  if (slots.length !== 1 || !slots[0]!.reference?.startsWith('Slot/')) throw invalido('O agendamento precisa de exatamente um slot.', 'Appointment.slot');
  if (typeof corpo.start !== 'string' || typeof corpo.end !== 'string') throw invalido('start e end são obrigatórios.', 'Appointment.start');

  const exames: Exame[] = [];
  for (const sr of contidos) {
    const exame = exameDosCodings(((sr.code as Json).coding as Array<{ system?: string; code?: string }>));
    if (!exame) throw invalido('Os coding do pedido não são os de um item ativo do catálogo.', 'Appointment.contained.code');
    exames.push(exame);
  }
  return { identificador: { system, value }, slotId: slots[0]!.reference!.slice('Slot/'.length), unidadeId, exames };
}

/** Horário existe, é da unidade, está livre, atende os exames e bate com start e end. */
function conferirHorario(provedor: Provedor, v: AgendamentoValidado, corpo: Json, slotAtual?: string): Registro {
  const slot = provedor.dados.tipo('Slot').get(v.slotId);
  if (!slot) throw invalido('Horário desconhecido.', 'Appointment.slot');
  const agenda = provedor.dados.tipo('Schedule').get(String((slot.recurso.schedule as Referencia).reference).replace('Schedule/', ''));
  const unidade = (agenda?.recurso.actor as Referencia[] | undefined)?.find((a) => a.type === 'Location')?.reference;
  if (unidade !== `Location/${v.unidadeId}`) throw invalido('O horário não é da unidade do agendamento.', 'Appointment.slot');
  if (Date.parse(String(corpo.start)) !== Date.parse(String(slot.recurso.start)) || Date.parse(String(corpo.end)) !== Date.parse(String(slot.recurso.end))) {
    throw invalido('start e end precisam ser os do horário.', 'Appointment.start');
  }
  if (slot.recurso.status !== 'free' && v.slotId !== slotAtual) {
    throw new ErroDeApi(409, 'SLOT_UNAVAILABLE', 'conflict', 'O horário escolhido não está mais disponível.', { diagnostico: `Slot/${v.slotId} não está livre.` });
  }
  const tipos = (slot.recurso.serviceType as Array<{ coding: Array<{ system: string; code: string }> }>) ?? [];
  const naUnidade = provedor.dados.examesPorUnidade.get(v.unidadeId) ?? [];
  const faltando = v.exames.filter(
    (e) => !naUnidade.includes(e) || !tipos.some((t) => t.coding.some((c) => c.system === 'https://laboratorio.example/fhir/produtos' && c.code === e.codigoProprio)),
  );
  if (faltando.length) {
    throw new ErroDeApi(422, 'EXAM_NOT_AVAILABLE_AT_LOCATION', 'business-rule', 'Exame que a unidade não coleta neste horário.', { diagnostico: faltando.map((e) => e.codigoProprio).join(' ') });
  }
  return slot;
}

function lerJson(bruto: Buffer): Json {
  let corpo: unknown;
  try {
    corpo = JSON.parse(bruto.toString('utf8'));
  } catch {
    throw new ErroDeApi(400, 'INVALID_REQUEST', 'invalid', 'Corpo não é JSON válido.');
  }
  if (typeof corpo !== 'object' || corpo === null || Array.isArray(corpo) || (corpo as Json).resourceType !== 'Appointment') {
    throw new ErroDeApi(400, 'INVALID_REQUEST', 'invalid', 'O corpo precisa ser um recurso Appointment.');
  }
  return corpo as Json;
}

function responder(provedor: Provedor, res: ServerResponse, status: number, reg: Registro): void {
  const base = provedor.fhirBaseUrl.replace(/\/$/, '');
  const r = structuredClone(reg.recurso);
  const meta: Json = { ...((r.meta as Json) ?? {}), versionId: String(reg.versao), lastUpdated: new Date(reg.atualizadoEm).toISOString() };
  if (provedor.violacao('sem-meta-profile')) delete meta.profile;
  r.meta = meta;
  enviarFhir(res, status, r, {
    Location: `${base}/Appointment/${reg.recurso.id}/_history/${reg.versao}`,
    ETag: `W/"${reg.versao}"`,
    'Last-Modified': new Date(reg.atualizadoEm).toUTCString(),
  });
}

export async function tratarCriacaoDeAgendamento(provedor: Provedor, acesso: Acesso, c: Consentimento, req: IncomingMessage, res: ServerResponse): Promise<void> {
  expirarPagamentos(provedor);
  exigirConteudo(req, 'application/fhir+json');
  const cabecalhoIne = cabecalho(req, 'if-none-exist');
  const pedido = provedor.violacao('criacao-nao-idempotente') && !cabecalhoIne ? undefined : lerIfNoneExist(cabecalhoIne);
  const corpo = lerJson(await lerCorpo(req));
  const v = validarAgendamento(provedor, c, corpo, true);
  if (pedido && (pedido.system !== v.identificador.system || pedido.value !== v.identificador.value)) {
    throw new ErroDeApi(400, 'IF_NONE_EXIST_REQUIRED', 'required', 'If-None-Exist não corresponde ao identifier do corpo.');
  }
  if (!provedor.violacao('criacao-nao-idempotente')) {
    const existente = [...provedor.dados.tipo('Appointment').values()].find(
      (r) => r.donoClientId === acesso.clientId &&
        ((r.recurso.identifier as Array<{ system?: string; value?: string }> | undefined) ?? []).some((i) => i.system === v.identificador.system && i.value === v.identificador.value),
    );
    if (existente) {
      if (existente.pacienteId === c.paciente!.fhirId) return responder(provedor, res, 200, existente);
      res.writeHead(200, { 'Content-Length': 0 });
      res.end();
      return;
    }
  }
  conferirHorario(provedor, v, corpo);

  const total = v.exames.reduce((s, e) => s + (provedor.dados.precoNaUnidade(e, v.unidadeId) ?? 0), 0);
  const recurso = structuredClone(corpo) as Recurso;
  recurso.id = `ag-${novoId().slice(0, 13)}`;
  recurso.meta = { profile: [perfil('br-lab-appointment')] };
  recurso.participant = ((recurso.participant as Participante[]) ?? []).map((p) => ({ ...p, status: 'accepted' }));
  const agora = provedor.relogio.agoraMs();
  const reg = provedor.dados.gravar(recurso, agora, { pacienteId: c.paciente!.fhirId, donoClientId: acesso.clientId });
  if (total > 0) {
    recurso.status = 'pending';
    const token = segredo(16);
    definirPagamento(reg, { token, ate: agora + provedor.cfg.prazoDePagamentoMinutos * 60_000 });
    aplicarLink(provedor, recurso, token);
  } else {
    recurso.status = 'booked';
  }
  mudarSlot(provedor, v.slotId, 'busy');
  provedor.log(`agendamento ${recurso.id} criado (${recurso.status})`);
  responder(provedor, res, 201, reg);
}

/** JSON estável, com chaves ordenadas, para comparar recursos. */
function estavel(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(estavel).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v as Json).sort().map((k) => `${JSON.stringify(k)}:${estavel((v as Json)[k])}`).join(',')}}`;
  }
  return JSON.stringify(v);
}

const ALTERAVEIS = new Set(['meta', 'id', 'slot', 'start', 'end', 'status', 'cancelationReason', 'extension']);

export async function tratarAtualizacaoDeAgendamento(provedor: Provedor, acesso: Acesso, c: Consentimento, id: string, req: IncomingMessage, res: ServerResponse): Promise<void> {
  expirarPagamentos(provedor);
  exigirConteudo(req, 'application/fhir+json');
  const ifMatch = cabecalho(req, 'if-match');
  const ignorarIfMatch = provedor.violacao('if-match-ignorado');
  if (!ifMatch && !ignorarIfMatch) throw new ErroDeApi(400, 'IF_MATCH_REQUIRED', 'required', 'PUT exige o cabeçalho If-Match.');
  const corpo = lerJson(await lerCorpo(req));
  if (corpo.id !== id) throw new ErroDeApi(400, 'INVALID_REQUEST', 'invalid', 'O id do corpo precisa ser o do caminho.');
  const reg = provedor.dados.tipo('Appointment').get(id);
  if (!reg || reg.donoClientId !== acesso.clientId || reg.pacienteId !== c.paciente!.fhirId) {
    throw new ErroDeApi(404, 'RESOURCE_NOT_FOUND', 'not-found', 'Agendamento não encontrado.');
  }
  const versao = ifMatch ? /^(?:W\/)?"([^"]+)"$/.exec(ifMatch)?.[1] : undefined;
  if (!ignorarIfMatch && versao !== String(reg.versao)) {
    throw new ErroDeApi(412, 'VERSION_CONFLICT', 'conflict', 'If-Match não corresponde à versão atual.');
  }
  const atual = reg.recurso;
  if (ESTADOS_FINAIS_DO_AGENDAMENTO.includes(String(atual.status))) {
    throw new ErroDeApi(422, 'APPOINTMENT_NOT_MODIFIABLE', 'business-rule', `Agendamento em ${String(atual.status)} não admite alteração.`);
  }
  if (Date.parse(String(atual.start)) - provedor.relogio.agoraMs() < POLITICA_DE_ALTERACAO_MS) {
    throw new ErroDeApi(422, 'APPOINTMENT_NOT_MODIFIABLE', 'business-rule', 'Alteração a menos de 2 horas do horário não é aceita pela política do laboratório.');
  }

  // Só slot, start, end, status (para cancelled) e cancelationReason podem mudar.
  const chaves = new Set([...Object.keys(atual), ...Object.keys(corpo)]);
  for (const k of chaves) {
    if (ALTERAVEIS.has(k)) continue;
    if (k === 'contained' && provedor.violacao('pedido-contido-alteravel')) continue;
    if (k === 'comment' && provedor.violacao('link-de-pagamento-em-comment')) continue;
    if (estavel(atual[k]) !== estavel(corpo[k])) {
      throw new ErroDeApi(422, 'APPOINTMENT_FIELD_NOT_MODIFIABLE', 'business-rule', `O receptor não pode alterar ${k}.`, { expressao: [`Appointment.${k}`] });
    }
  }
  if (estavel(semExtensaoDePagamento(atual.extension)) !== estavel(semExtensaoDePagamento(corpo.extension))) {
    throw new ErroDeApi(422, 'APPOINTMENT_FIELD_NOT_MODIFIABLE', 'business-rule', 'O receptor não pode alterar extensões.', { expressao: ['Appointment.extension'] });
  }
  const cancelando = corpo.status !== atual.status;
  if (cancelando && corpo.status !== 'cancelled') {
    throw new ErroDeApi(422, 'APPOINTMENT_FIELD_NOT_MODIFIABLE', 'business-rule', 'status só pode mudar para cancelled.', { expressao: ['Appointment.status'] });
  }
  const mudouHorario = estavel(atual.slot) !== estavel(corpo.slot) || estavel(atual.start) !== estavel(corpo.start) || estavel(atual.end) !== estavel(corpo.end);
  if (!cancelando && estavel(atual.cancelationReason) !== estavel(corpo.cancelationReason)) {
    throw new ErroDeApi(422, 'APPOINTMENT_FIELD_NOT_MODIFIABLE', 'business-rule', 'cancelationReason só muda no cancelamento.', { expressao: ['Appointment.cancelationReason'] });
  }
  const novo = structuredClone(atual);
  if (provedor.violacao('pedido-contido-alteravel')) novo.contained = corpo.contained;
  if (cancelando) {
    if (mudouHorario) throw new ErroDeApi(422, 'APPOINTMENT_FIELD_NOT_MODIFIABLE', 'business-rule', 'Cancelamento não muda o horário.');
    cancelar(provedor, reg, novo);
    if (corpo.cancelationReason) novo.cancelationReason = corpo.cancelationReason;
  } else if (mudouHorario) {
    const v = validarAgendamento(provedor, c, { ...corpo, status: atual.status }, false);
    const slotAnterior = ((atual.slot as Referencia[])[0]?.reference ?? '').replace('Slot/', '');
    conferirHorario(provedor, v, corpo, slotAnterior);
    novo.slot = corpo.slot;
    novo.start = corpo.start;
    novo.end = corpo.end;
    if (v.slotId !== slotAnterior) {
      mudarSlot(provedor, slotAnterior, 'free');
      mudarSlot(provedor, v.slotId, 'busy');
    }
  }
  provedor.dados.atualizar(reg, novo, provedor.relogio.agoraMs());
  responder(provedor, res, 200, reg);
}

// Página de pagamento simulada ------------------------------------------------

function agendamentoDoToken(provedor: Provedor, token: string): Registro | undefined {
  return [...provedor.dados.tipo('Appointment').values()].find((r) => registroDoPagamento(r)?.token === token);
}

export async function tratarPagina(provedor: Provedor, req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  expirarPagamentos(provedor);
  const token = url.pathname.split('/').pop() ?? '';
  const reg = agendamentoDoToken(provedor, token);
  if (!reg) return enviarHtml(res, 404, paginaDeErro('Link de pagamento inexistente, já pago ou vencido.'));
  if (req.method === 'POST') {
    const form = lerFormulario(await lerCorpo(req));
    if (form.get('acao')?.[0] === 'pagar') confirmarPagamento(provedor, reg.recurso.id);
    return enviarHtml(res, 200, paginaDeErro('Pagamento confirmado (simulado). Volte ao aplicativo.'));
  }
  const exames = ((reg.recurso.contained as Json[]) ?? []).map((sr) => String((sr.code as Json & { text?: string }).text ?? ((sr.code as Json).coding as Array<{ display?: string }>)[0]?.display ?? 'exame'));
  return enviarHtml(res, 200, paginaDePagamento(url.pathname, `Exames: ${exames.join(', ')}.`, 'aguardando pagamento'));
}

export { lerFormulario };
