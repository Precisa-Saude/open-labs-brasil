// API FHIR R4 do provedor simulado (seção 5.5): leitura e busca de todos os
// tipos dos escopos, paginação dentro do fhir_base_url e CapabilityStatement.

import type { IncomingMessage, ServerResponse } from 'node:http';
import { tratarAtualizacaoDeAgendamento, tratarCriacaoDeAgendamento } from './agendamento.ts';
import { perfil, SISTEMA_ESCOPOS, ORGANIZACAO, type Recurso, type Registro } from './dados.ts';
import { enviarFhir, ErroDeApi, SISTEMA_DE_ERROS } from './http.ts';
import {
  analisarData,
  codeableConcepts,
  codigoSimples,
  faixaDeData,
  filtrar,
  referenciaNormalizada,
  referencias,
  ultimaAtualizacao,
  type DefinicaoDeParametro,
  type ParametroDaBusca,
  type Token,
} from './fhir-busca.ts';
import type { Consentimento, Provedor } from './provedor.ts';
import { autenticarRecurso, comTratamentoDeErros, exigirAccept, exigirCertificado, exigirEscopo, exigirIdDeInteracao, type Acesso } from './recursos.ts';

const TIPO_FHIR = 'application/fhir+json';
const ESTADOS_DE_LAUDO_VISIVEIS = ['final', 'amended', 'corrected'];

interface Contexto {
  provedor: Provedor;
  acesso: Acesso;
  pacienteId?: string;
  consentimento?: Consentimento;
}

interface ConfiguracaoDoTipo {
  tipoDeToken: 'provedor' | 'paciente';
  /** Escopo exigido. Ausente: qualquer token de paciente. */
  escopo?: string;
  perfil: string;
  parametros: Record<string, DefinicaoDeParametro>;
  /** Parâmetros que precisam vir na busca. */
  obrigatorios?: string[];
  /** Parâmetro que aponta o paciente e precisa ser o do consentimento. */
  parametroDoPaciente?: string;
  visivel?: (reg: Registro, ctx: Contexto) => boolean;
  ordenar?: (a: Registro, b: Registro) => number;
  buscavel?: boolean;
  interacoesDeEscrita?: string[];
}

const dataLastUpdated: DefinicaoDeParametro = { tipo: 'date', extrair: ultimaAtualizacao };
const statusToken: DefinicaoDeParametro = { tipo: 'token', extrair: codigoSimples('status') };
const pacienteRef = (pegar: (r: Recurso) => unknown): DefinicaoDeParametro => ({ tipo: 'reference', alvo: 'Patient', extrair: referencias(pegar) });

function dentroDoPeriodo(ctx: Contexto, efetivo: unknown): boolean {
  if (ctx.provedor.violacao('data-period-ignorado')) return true;
  const dp = ctx.consentimento?.data_period;
  if (!dp || typeof efetivo !== 'string') return true;
  const faixa = faixaDeData(efetivo);
  if (!faixa) return false;
  if (dp.start && faixa[0] < faixaDeData(dp.start)![0]) return false;
  if (dp.end && faixa[0] >= faixaDeData(dp.end)![1]) return false;
  return true;
}

function resultadoVisivel(reg: Registro, ctx: Contexto): boolean {
  if (reg.pacienteId !== ctx.pacienteId) return false;
  if (!ctx.provedor.violacao('laudo-parcial-visivel')) {
    if (!reg.liberado) return false;
    if (!ESTADOS_DE_LAUDO_VISIVEIS.includes(String(reg.recurso.status))) return false;
  }
  return dentroDoPeriodo(ctx, reg.recurso.effectiveDateTime);
}

const TIPOS: Record<string, ConfiguracaoDoTipo> = {
  ActivityDefinition: {
    tipoDeToken: 'provedor', escopo: 'catalog.read', perfil: 'br-lab-activity-definition',
    parametros: {
      status: statusToken,
      url: { tipo: 'uri', extrair: (r) => [r.recurso.url] },
      title: { tipo: 'string', extrair: (r) => [r.recurso.title] },
      _lastUpdated: dataLastUpdated,
    },
  },
  ChargeItemDefinition: {
    tipoDeToken: 'provedor', escopo: 'catalog.read', perfil: 'br-lab-charge-item-definition',
    parametros: {
      status: statusToken,
      url: { tipo: 'uri', extrair: (r) => [r.recurso.url] },
      jurisdiction: { tipo: 'token', extrair: codeableConcepts((r) => r.jurisdiction) },
      _lastUpdated: dataLastUpdated,
    },
  },
  Location: {
    tipoDeToken: 'provedor', escopo: 'locations.read', perfil: 'br-lab-location',
    parametros: {
      status: statusToken,
      'address-city': { tipo: 'string', extrair: (r) => [(r.recurso.address as { city?: string })?.city].filter(Boolean) },
      'address-state': { tipo: 'string', extrair: (r) => [(r.recurso.address as { state?: string })?.state].filter(Boolean) },
      'address-postalcode': { tipo: 'string', extrair: (r) => [(r.recurso.address as { postalCode?: string })?.postalCode].filter(Boolean) },
      _lastUpdated: dataLastUpdated,
    },
  },
  HealthcareService: {
    tipoDeToken: 'provedor', escopo: 'locations.read', perfil: 'br-lab-healthcare-service',
    parametros: {
      location: { tipo: 'reference', alvo: 'Location', extrair: referencias((r) => r.location) },
      active: { tipo: 'token', extrair: codigoSimples('active') },
      _lastUpdated: dataLastUpdated,
    },
  },
  Schedule: {
    tipoDeToken: 'provedor', escopo: 'schedule.read', perfil: 'br-lab-schedule',
    parametros: {
      actor: { tipo: 'reference', extrair: referencias((r) => r.actor) },
      active: { tipo: 'token', extrair: codigoSimples('active') },
      _lastUpdated: dataLastUpdated,
    },
  },
  Slot: {
    tipoDeToken: 'provedor', escopo: 'schedule.read', perfil: 'br-lab-slot',
    parametros: {
      schedule: { tipo: 'reference', alvo: 'Schedule', extrair: referencias((r) => r.schedule) },
      start: { tipo: 'date', extrair: (r) => [r.recurso.start] },
      status: statusToken,
      'service-type': { tipo: 'token', extrair: codeableConcepts((r) => r.serviceType) },
    },
    obrigatorios: ['schedule', 'start'],
    ordenar: (a, b) => Date.parse(String(a.recurso.start)) - Date.parse(String(b.recurso.start)) || a.recurso.id.localeCompare(b.recurso.id),
  },
  Appointment: {
    tipoDeToken: 'paciente', escopo: 'appointment.write', perfil: 'br-lab-appointment',
    parametros: {
      patient: pacienteRef((r) => (r.participant as Array<{ actor?: unknown }>).map((p) => p.actor)),
      status: statusToken,
      date: { tipo: 'date', extrair: (r) => [r.recurso.start] },
      identifier: {
        tipo: 'token',
        extrair: (r) => ((r.recurso.identifier as Array<{ system?: string; value?: string }>) ?? []).map((i): Token => ({ ...(i.system ? { system: i.system } : {}), code: i.value ?? '' })),
      },
    },
    parametroDoPaciente: 'patient',
    visivel: (reg, ctx) => reg.donoClientId === ctx.acesso.clientId && reg.pacienteId === ctx.pacienteId,
    interacoesDeEscrita: ['create', 'update'],
  },
  DiagnosticReport: {
    tipoDeToken: 'paciente', escopo: 'results.read', perfil: 'br-diagnostic-report',
    parametros: {
      patient: pacienteRef((r) => r.subject),
      _lastUpdated: dataLastUpdated,
      date: { tipo: 'date', extrair: (r) => [r.recurso.effectiveDateTime] },
      status: statusToken,
      code: { tipo: 'token', extrair: codeableConcepts((r) => r.code) },
    },
    obrigatorios: ['patient'],
    parametroDoPaciente: 'patient',
    visivel: resultadoVisivel,
  },
  Observation: {
    tipoDeToken: 'paciente', escopo: 'results.read', perfil: 'br-lab-observation',
    parametros: {
      patient: pacienteRef((r) => r.subject),
      code: { tipo: 'token', extrair: codeableConcepts((r) => r.code) },
      date: { tipo: 'date', extrair: (r) => [r.recurso.effectiveDateTime] },
      _lastUpdated: dataLastUpdated,
    },
    obrigatorios: ['patient'],
    parametroDoPaciente: 'patient',
    visivel: resultadoVisivel,
  },
  Patient: {
    tipoDeToken: 'paciente', perfil: 'br-patient', parametros: {}, buscavel: false,
    visivel: (reg, ctx) => reg.recurso.id === ctx.pacienteId || ctx.provedor.violacao('paciente-de-outro-visivel'),
  },
  Consent: {
    tipoDeToken: 'paciente', escopo: 'consent.read', perfil: 'br-lab-access-consent',
    parametros: {
      patient: pacienteRef((r) => r.patient),
      status: statusToken,
    },
    parametroDoPaciente: 'patient',
    visivel: () => true,
  },
};

export const TIPOS_SUPORTADOS = Object.keys(TIPOS);

// Representação FHIR do consentimento (seção 5.5.8) -------------------------

const STATUS_FHIR: Record<string, string> = {
  AWAITING_AUTHORISATION: 'proposed',
  AUTHORISED: 'active',
  REJECTED: 'rejected',
  REVOKED: 'inactive',
  EXPIRED: 'inactive',
};

function consentimentoFhir(provedor: Provedor, c: Consentimento): Registro {
  const receptor = provedor.registro.receptor(c.client_id);
  const isoUtc = (ms: number) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
  const recurso: Recurso = {
    resourceType: 'Consent',
    id: c.consent_id,
    meta: { profile: [perfil('br-lab-access-consent')] },
    identifier: [{ system: `${provedor.apiBaseUrl.replace(/\/$/, '')}/consents`, value: c.consent_id }],
    status: STATUS_FHIR[c.status]!,
    scope: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/consentscope', code: 'patient-privacy' }] },
    category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'INFA', display: 'information access' }] }],
    patient: { reference: `Patient/${c.paciente!.fhirId}`, type: 'Patient' },
    dateTime: isoUtc(c.criadoEm),
    organization: [ORGANIZACAO],
    policy: [{ uri: provedor.participante.provider!.consent_management_uri }],
    provision: {
      type: 'permit',
      period: { ...(c.autorizadoEm ? { start: isoUtc(c.autorizadoEm) } : {}), end: isoUtc(c.expiraEm) },
      actor: [
        {
          role: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType', code: 'IRCP' }] },
          reference: {
            type: 'Organization',
            identifier: { system: 'urn:open-labs-brasil:participant-id', value: c.client_id },
            display: receptor?.receiver?.client_name ?? c.client_id,
          },
        },
      ],
      action: c.scopes.map((s) => ({ coding: [{ system: SISTEMA_ESCOPOS, code: s }] })),
      ...(c.data_period ? { dataPeriod: c.data_period } : {}),
    },
  };
  return { recurso, versao: c.historico.length, atualizadoEm: c.atualizadoEm, pacienteId: c.paciente!.fhirId };
}

function registrosDoTipo(ctx: Contexto, tipo: string): Registro[] {
  if (tipo === 'Consent') {
    return [...ctx.provedor.consentimentos.values()]
      .filter((c) => {
        ctx.provedor.atualizarEstado(c);
        return c.client_id === ctx.acesso.clientId && c.paciente && c.paciente.fhirId === ctx.pacienteId;
      })
      .map((c) => consentimentoFhir(ctx.provedor, c));
  }
  return [...ctx.provedor.dados.tipo(tipo).values()];
}

/** Cópia do recurso com meta.versionId, meta.lastUpdated e meta.profile. */
export function exibir(provedor: Provedor, reg: Registro): Recurso {
  const r = structuredClone(reg.recurso);
  const meta: Record<string, unknown> = { ...((r.meta as Record<string, unknown>) ?? {}), versionId: String(reg.versao), lastUpdated: new Date(reg.atualizadoEm).toISOString() };
  if (provedor.violacao('sem-meta-profile')) delete meta.profile;
  r.meta = meta;
  return r;
}

function contexto(provedor: Provedor, acesso: Acesso): Contexto {
  const ctx: Contexto = { provedor, acesso };
  if (acesso.token.consentId) {
    const c = provedor.consentimento(acesso.token.consentId);
    if (c?.paciente) {
      ctx.consentimento = c;
      ctx.pacienteId = c.paciente.fhirId;
    }
  }
  return ctx;
}

function conferirPaciente(ctx: Contexto, conf: ConfiguracaoDoTipo, parametros: ParametroDaBusca[]): void {
  if (!conf.parametroDoPaciente) return;
  for (const p of parametros.filter((x) => x.nome === conf.parametroDoPaciente)) {
    for (const v of p.valor.split(',')) {
      if (referenciaNormalizada(v, 'Patient', ctx.provedor.fhirBaseUrl) !== `Patient/${ctx.pacienteId}`) {
        const cpf = ctx.consentimento?.paciente?.cpf;
        throw new ErroDeApi(403, 'PATIENT_NOT_IN_CONSENT', 'forbidden', 'O parâmetro patient não é o paciente do consentimento.',
          ctx.provedor.violacao('cpf-no-erro') && cpf ? { diagnostico: `paciente do consentimento: CPF ${cpf}` } : {});
      }
    }
  }
}

function conferirJanelaDeHorarios(ctx: Contexto, parametros: ParametroDaBusca[]): void {
  let inferior: number | undefined;
  let superior: number | undefined;
  for (const p of parametros.filter((x) => x.nome === 'start')) {
    const { prefixo, faixa } = analisarData(p.valor);
    if (prefixo === 'ge') inferior = Math.max(inferior ?? -Infinity, faixa[0]);
    if (prefixo === 'gt') inferior = Math.max(inferior ?? -Infinity, faixa[1]);
    if (prefixo === 'lt') superior = Math.min(superior ?? Infinity, faixa[0]);
    if (prefixo === 'le') superior = Math.min(superior ?? Infinity, faixa[1]);
  }
  if (inferior === undefined || superior === undefined) {
    throw new ErroDeApi(400, 'INVALID_REQUEST', 'invalid', 'A busca de Slot exige start com limite inferior (ge ou gt) e superior (lt ou le).');
  }
  if (superior - inferior > 31 * 24 * 3600_000 && !ctx.provedor.violacao('janela-de-agenda-sem-limite')) {
    throw new ErroDeApi(400, 'SEARCH_WINDOW_TOO_LARGE', 'too-costly', 'A janela de start passa de 31 dias.');
  }
}

/** Exames da cesta que a unidade da agenda não coleta (seção 5.5.4). */
function examesForaDaUnidade(ctx: Contexto, parametros: ParametroDaBusca[]): string[] {
  const agendas = parametros.filter((p) => p.nome === 'schedule').map((p) => referenciaNormalizada(p.valor, 'Schedule', ctx.provedor.fhirBaseUrl));
  const tipos = parametros.filter((p) => p.nome === 'service-type').map((p) => p.valor);
  if (tipos.length === 0) return [];
  const faltando: string[] = [];
  for (const ref of agendas) {
    const agenda = ctx.provedor.dados.tipo('Schedule').get(ref.replace('Schedule/', ''));
    const unidade = (agenda?.recurso.actor as Array<{ reference?: string; type?: string }> | undefined)?.find((a) => a.type === 'Location')?.reference?.replace('Location/', '');
    const exames = unidade ? ctx.provedor.dados.examesPorUnidade.get(unidade) ?? [] : [];
    for (const t of tipos) {
      const barra = t.indexOf('|');
      const [sistema, codigo] = barra >= 0 ? [t.slice(0, barra), t.slice(barra + 1)] : [undefined, t];
      const coleta = exames.some((e) => {
        const codings = [...(e.loinc ? [{ system: 'http://loinc.org', code: e.loinc.code }] : []), { system: 'https://laboratorio.example/fhir/produtos', code: e.codigoProprio }];
        return codings.some((c) => c.code === codigo && (sistema === undefined || c.system === sistema));
      });
      if (!coleta && !faltando.includes(t)) faltando.push(t);
    }
  }
  return faltando;
}

function linkDaPagina(provedor: Provedor, tipo: string, parametros: URLSearchParams, deslocamento: number): string {
  const p = new URLSearchParams();
  for (const [k, v] of parametros) if (k !== '_getpagesoffset') p.append(k, v);
  p.append('_getpagesoffset', String(deslocamento));
  const base = provedor.violacao('paginacao-fora-da-base')
    ? 'https://paginas.outro-dominio.example/fhir/r4'
    : provedor.fhirBaseUrl.replace(/\/$/, '');
  return `${base}/${tipo}?${p.toString()}`;
}

function buscar(ctx: Contexto, tipo: string, conf: ConfiguracaoDoTipo, url: URL, res: ServerResponse): void {
  const { provedor } = ctx;
  const parametros: ParametroDaBusca[] = [];
  let quantidade = 20;
  let deslocamento = 0;
  const incluir: string[] = [];
  for (const [nome, valor] of url.searchParams) {
    if (nome === '_count') {
      const n = Number(valor);
      if (!Number.isInteger(n) || n < 0) throw new ErroDeApi(400, 'INVALID_REQUEST', 'invalid', '_count inválido.');
      quantidade = Math.min(n, 100);
      continue;
    }
    if (nome === '_getpagesoffset') {
      const n = Number(valor);
      if (!Number.isInteger(n) || n < 0) throw new ErroDeApi(400, 'INVALID_REQUEST', 'invalid', '_getpagesoffset inválido.');
      deslocamento = n;
      continue;
    }
    if (nome === '_include' && tipo === 'DiagnosticReport' && valor === 'DiagnosticReport:result') {
      incluir.push(valor);
      continue;
    }
    if (!conf.parametros[nome]) {
      if (provedor.violacao('ignora-parametro-desconhecido')) continue;
      throw new ErroDeApi(400, 'UNSUPPORTED_SEARCH_PARAMETER', 'not-supported', `Parâmetro de busca não suportado: ${nome}.`);
    }
    parametros.push({ nome, valor });
  }
  for (const o of conf.obrigatorios ?? []) {
    if (!parametros.some((p) => p.nome === o)) throw new ErroDeApi(400, 'INVALID_REQUEST', 'invalid', `Parâmetro obrigatório ausente: ${o}.`);
  }
  conferirPaciente(ctx, conf, parametros);
  if (tipo === 'Slot') conferirJanelaDeHorarios(ctx, parametros);

  const entradasExtras: unknown[] = [];
  let candidatos = registrosDoTipo(ctx, tipo).filter((r) => !conf.visivel || conf.visivel(r, ctx));
  if (tipo === 'Slot') {
    const faltando = examesForaDaUnidade(ctx, parametros);
    if (faltando.length > 0) {
      candidatos = [];
      entradasExtras.push({
        resource: {
          resourceType: 'OperationOutcome',
          issue: [{
            severity: 'information',
            code: 'business-rule',
            details: { coding: [{ system: SISTEMA_DE_ERROS, code: 'EXAM_NOT_AVAILABLE_AT_LOCATION' }], text: 'Exame da cesta não é coletado nesta unidade.' },
            diagnostics: faltando.join(' '),
          }],
        },
        search: { mode: 'outcome' },
      });
    }
  }
  const modoOu = new Set<string>(tipo === 'Slot' && provedor.violacao('cesta-com-ou') ? ['service-type'] : []);
  const encontrados = filtrar(candidatos, conf.parametros, parametros, provedor.fhirBaseUrl, modoOu)
    .sort(conf.ordenar ?? ((a, b) => a.recurso.id.localeCompare(b.recurso.id)));
  const pagina = encontrados.slice(deslocamento, deslocamento + quantidade);
  const base = provedor.fhirBaseUrl.replace(/\/$/, '');
  const links: Array<{ relation: string; url: string }> = [{ relation: 'self', url: `${base}/${tipo}${url.search}` }];
  if (deslocamento + quantidade < encontrados.length && quantidade > 0) {
    links.push({ relation: 'next', url: linkDaPagina(provedor, tipo, url.searchParams, deslocamento + quantidade) });
  }
  const entradas: unknown[] = pagina.map((r) => ({ fullUrl: `${base}/${tipo}/${r.recurso.id}`, resource: exibir(provedor, r), search: { mode: 'match' } }));
  if (incluir.length > 0) {
    const vistos = new Set<string>();
    for (const r of pagina) {
      for (const ref of (r.recurso.result as Array<{ reference: string }> | undefined) ?? []) {
        const id = ref.reference.replace('Observation/', '');
        const obs = provedor.dados.tipo('Observation').get(id);
        if (obs && !vistos.has(id) && TIPOS.Observation!.visivel!(obs, ctx)) {
          vistos.add(id);
          entradas.push({ fullUrl: `${base}/Observation/${id}`, resource: exibir(provedor, obs), search: { mode: 'include' } });
        }
      }
    }
  }
  enviarFhir(res, 200, {
    resourceType: 'Bundle',
    type: 'searchset',
    total: encontrados.length,
    link: links,
    entry: [...entradas, ...entradasExtras],
  });
}

export function capacidades(provedor: Provedor): Recurso {
  return {
    resourceType: 'CapabilityStatement',
    id: 'servidor-de-exemplo',
    status: 'active',
    date: '2026-11-16',
    publisher: 'Open Labs Brasil (servidor de exemplo)',
    kind: 'instance',
    software: { name: 'Servidor de exemplo do Open Labs Brasil', version: '0.2.1' },
    implementation: { description: 'Provedor de dados simulado, com dados sintéticos', url: provedor.fhirBaseUrl },
    fhirVersion: '4.0.1',
    format: ['json'],
    rest: [
      {
        mode: 'server',
        security: {
          service: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/restful-security-service', code: 'OAuth' }] }],
          description: 'FAPI 2.0 Security Profile: PAR, PKCE S256, private_key_jwt e tokens vinculados ao certificado por mTLS.',
        },
        resource: Object.entries(TIPOS).map(([tipo, conf]) => ({
          type: tipo,
          supportedProfile: [perfil(conf.perfil)],
          interaction: [
            { code: 'read' },
            ...(conf.buscavel === false ? [] : [{ code: 'search-type' }]),
            ...(conf.interacoesDeEscrita ?? []).map((code) => ({ code })),
          ],
          ...(tipo === 'Appointment' ? { versioning: 'versioned', conditionalCreate: true, updateCreate: false } : {}),
          searchParam: Object.entries(conf.parametros).map(([nome, def]) => ({ name: nome, type: def.tipo })),
          ...(tipo === 'DiagnosticReport' ? { searchInclude: ['DiagnosticReport:result'] } : {}),
        })),
      },
    ],
  };
}

export async function tratarFhir(provedor: Provedor, req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  await comTratamentoDeErros(provedor, req, res, async () => {
    const base = new URL(provedor.fhirBaseUrl).pathname.replace(/\/$/, '');
    const partes = url.pathname.slice(base.length).split('/').filter(Boolean).map(decodeURIComponent);

    if (partes.length === 1 && partes[0] === 'metadata') {
      exigirCertificado(provedor, req);
      exigirIdDeInteracao(provedor, req);
      if (req.method !== 'GET') throw new ErroDeApi(405, 'METHOD_NOT_ALLOWED', 'not-supported', 'Método não previsto.');
      exigirAccept(req, TIPO_FHIR);
      return enviarFhir(res, 200, capacidades(provedor));
    }

    const acesso = autenticarRecurso(provedor, req, url);
    const [tipo, id, ...resto] = partes;
    const conf = tipo ? TIPOS[tipo] : undefined;
    if (!tipo || !conf || resto.length > 0) {
      exigirIdDeInteracao(provedor, req);
      throw new ErroDeApi(404, 'RESOURCE_NOT_FOUND', 'not-found', 'Recurso inexistente.');
    }
    exigirEscopo(provedor, acesso, conf.tipoDeToken, conf.escopo);
    exigirIdDeInteracao(provedor, req);
    exigirAccept(req, TIPO_FHIR);
    const ctx = contexto(provedor, acesso);

    if (tipo === 'Appointment' && !id && req.method === 'POST') return tratarCriacaoDeAgendamento(provedor, ctx.acesso, ctx.consentimento!, req, res);
    if (tipo === 'Appointment' && id && req.method === 'PUT') return tratarAtualizacaoDeAgendamento(provedor, ctx.acesso, ctx.consentimento!, id, req, res);
    if (req.method !== 'GET') throw new ErroDeApi(405, 'METHOD_NOT_ALLOWED', 'not-supported', 'Método não previsto para o recurso.');

    if (!id) {
      if (conf.buscavel === false) throw new ErroDeApi(405, 'METHOD_NOT_ALLOWED', 'not-supported', 'Não há busca deste recurso.');
      return buscar(ctx, tipo, conf, url, res);
    }
    for (const k of url.searchParams.keys()) {
      throw new ErroDeApi(400, 'UNSUPPORTED_SEARCH_PARAMETER', 'not-supported', `Parâmetro não suportado na leitura: ${k}.`);
    }
    const reg = registrosDoTipo(ctx, tipo).find((r) => r.recurso.id === id);
    if (!reg || (conf.visivel && !conf.visivel(reg, ctx))) throw new ErroDeApi(404, 'RESOURCE_NOT_FOUND', 'not-found', 'Recurso não encontrado.');
    return enviarFhir(res, 200, exibir(provedor, reg), {
      ETag: `W/"${reg.versao}"`,
      'Last-Modified': new Date(reg.atualizadoEm).toUTCString(),
    });
  });
}
