// API FHIR R4 do provedor simulado (seção 5.5): leitura e busca de todos os
// tipos dos escopos, paginação dentro do fhir_base_url e CapabilityStatement.

import type { IncomingMessage, ServerResponse } from 'node:http';

import { tratarAtualizacaoDeAgendamento, tratarCriacaoDeAgendamento } from './agendamento.ts';
import { ORGANIZACAO, perfil, type Recurso, type Registro, SISTEMA_ESCOPOS } from './dados.ts';
import {
  analisarData,
  codeableConcepts,
  codigoSimples,
  type DefinicaoDeParametro,
  faixaDeData,
  filtrar,
  type ParametroDaBusca,
  referenciaNormalizada,
  referencias,
  type Token,
  ultimaAtualizacao,
} from './fhir-busca.ts';
import { enviarFhir, ErroDeApi, SISTEMA_DE_ERROS } from './http.ts';
import type { Consentimento, Provedor } from './provedor.ts';
import {
  type Acesso,
  autenticarRecurso,
  comTratamentoDeErros,
  exigirAccept,
  exigirCertificado,
  exigirEscopo,
  exigirIdDeInteracao,
} from './recursos.ts';

const TIPO_FHIR = 'application/fhir+json';
const ESTADOS_DE_LAUDO_VISIVEIS = ['final', 'amended', 'corrected'];

interface Contexto {
  acesso: Acesso;
  consentimento?: Consentimento;
  pacienteId?: string;
  provedor: Provedor;
}

interface ConfiguracaoDoTipo {
  buscavel?: boolean;
  /** Escopo exigido. Ausente: qualquer token de paciente. */
  escopo?: string;
  interacoesDeEscrita?: string[];
  /** Parâmetros que precisam vir na busca. */
  obrigatorios?: string[];
  ordenar?: (a: Registro, b: Registro) => number;
  /** Parâmetro que aponta o paciente e precisa ser o do consentimento. */
  parametroDoPaciente?: string;
  parametros: Record<string, DefinicaoDeParametro>;
  perfil: string;
  tipoDeToken: 'provedor' | 'paciente';
  visivel?: (reg: Registro, ctx: Contexto) => boolean;
}

const dataLastUpdated: DefinicaoDeParametro = { extrair: ultimaAtualizacao, tipo: 'date' };
const statusToken: DefinicaoDeParametro = { extrair: codigoSimples('status'), tipo: 'token' };
const pacienteRef = (pegar: (r: Recurso) => unknown): DefinicaoDeParametro => ({
  alvo: 'Patient',
  extrair: referencias(pegar),
  tipo: 'reference',
});

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
    escopo: 'catalog.read',
    parametros: {
      _lastUpdated: dataLastUpdated,
      status: statusToken,
      title: { extrair: (r) => [r.recurso.title], tipo: 'string' },
      url: { extrair: (r) => [r.recurso.url], tipo: 'uri' },
    },
    perfil: 'br-lab-activity-definition',
    tipoDeToken: 'provedor',
    visivel: (reg, ctx) =>
      !(ctx.provedor.violacao('retirado-invisivel') && reg.recurso.status === 'retired'),
  },
  Appointment: {
    escopo: 'appointment.write',
    interacoesDeEscrita: ['create', 'update'],
    parametroDoPaciente: 'patient',
    parametros: {
      date: { extrair: (r) => [r.recurso.start], tipo: 'date' },
      identifier: {
        extrair: (r) =>
          ((r.recurso.identifier as Array<{ system?: string; value?: string }>) ?? []).map(
            (i): Token => ({ ...(i.system ? { system: i.system } : {}), code: i.value ?? '' }),
          ),
        tipo: 'token',
      },
      patient: {
        alvo: 'Patient',
        extrair: (reg) => (reg.pacienteId ? [`Patient/${reg.pacienteId}`] : []),
        tipo: 'reference',
      },
      status: statusToken,
    },
    perfil: 'br-lab-appointment',
    tipoDeToken: 'paciente',
    visivel: (reg, ctx) =>
      (reg.donoClientId === ctx.acesso.clientId ||
        ctx.provedor.violacao('agendamento-de-outro-canal-visivel')) &&
      reg.pacienteId === ctx.pacienteId,
  },
  ChargeItemDefinition: {
    escopo: 'catalog.read',
    parametros: {
      _lastUpdated: dataLastUpdated,
      jurisdiction: { extrair: codeableConcepts((r) => r.jurisdiction), tipo: 'token' },
      status: statusToken,
      url: { extrair: (r) => [r.recurso.url], tipo: 'uri' },
    },
    perfil: 'br-lab-charge-item-definition',
    tipoDeToken: 'provedor',
  },
  Consent: {
    escopo: 'consent.read',
    parametroDoPaciente: 'patient',
    parametros: {
      patient: pacienteRef((r) => r.patient),
      status: statusToken,
    },
    perfil: 'br-lab-access-consent',
    tipoDeToken: 'paciente',
    visivel: () => true,
  },
  DiagnosticReport: {
    escopo: 'results.read',
    obrigatorios: ['patient'],
    parametroDoPaciente: 'patient',
    parametros: {
      _lastUpdated: dataLastUpdated,
      code: { extrair: codeableConcepts((r) => r.code), tipo: 'token' },
      date: { extrair: (r) => [r.recurso.effectiveDateTime], tipo: 'date' },
      patient: pacienteRef((r) => r.subject),
      status: statusToken,
    },
    perfil: 'br-diagnostic-report',
    tipoDeToken: 'paciente',
    visivel: resultadoVisivel,
  },
  HealthcareService: {
    escopo: 'locations.read',
    parametros: {
      _lastUpdated: dataLastUpdated,
      active: { extrair: codigoSimples('active'), tipo: 'token' },
      location: { alvo: 'Location', extrair: referencias((r) => r.location), tipo: 'reference' },
    },
    perfil: 'br-lab-healthcare-service',
    tipoDeToken: 'provedor',
  },
  Location: {
    escopo: 'locations.read',
    parametros: {
      _lastUpdated: dataLastUpdated,
      'address-city': {
        extrair: (r) => [(r.recurso.address as { city?: string })?.city].filter(Boolean),
        tipo: 'string',
      },
      'address-postalcode': {
        extrair: (r) =>
          [(r.recurso.address as { postalCode?: string })?.postalCode].filter(Boolean),
        tipo: 'string',
      },
      'address-state': {
        extrair: (r) => [(r.recurso.address as { state?: string })?.state].filter(Boolean),
        tipo: 'string',
      },
      status: statusToken,
    },
    perfil: 'br-lab-location',
    tipoDeToken: 'provedor',
  },
  Observation: {
    escopo: 'results.read',
    obrigatorios: ['patient'],
    parametroDoPaciente: 'patient',
    parametros: {
      _lastUpdated: dataLastUpdated,
      code: { extrair: codeableConcepts((r) => r.code), tipo: 'token' },
      date: { extrair: (r) => [r.recurso.effectiveDateTime], tipo: 'date' },
      patient: pacienteRef((r) => r.subject),
    },
    perfil: 'br-lab-observation',
    tipoDeToken: 'paciente',
    visivel: resultadoVisivel,
  },
  Patient: {
    buscavel: false,
    parametros: {},
    perfil: 'br-patient',
    tipoDeToken: 'paciente',
    visivel: (reg, ctx) =>
      reg.recurso.id === ctx.pacienteId || ctx.provedor.violacao('paciente-de-outro-visivel'),
  },
  Schedule: {
    escopo: 'schedule.read',
    parametros: {
      _lastUpdated: dataLastUpdated,
      active: { extrair: codigoSimples('active'), tipo: 'token' },
      actor: { extrair: referencias((r) => r.actor), tipo: 'reference' },
    },
    perfil: 'br-lab-schedule',
    tipoDeToken: 'provedor',
  },
  Slot: {
    escopo: 'schedule.read',
    obrigatorios: ['schedule', 'start'],
    ordenar: (a, b) =>
      Date.parse(String(a.recurso.start)) - Date.parse(String(b.recurso.start)) ||
      a.recurso.id.localeCompare(b.recurso.id),
    parametros: {
      schedule: { alvo: 'Schedule', extrair: referencias((r) => r.schedule), tipo: 'reference' },
      'service-type': { extrair: codeableConcepts((r) => r.serviceType), tipo: 'token' },
      start: { extrair: (r) => [r.recurso.start], tipo: 'date' },
      status: statusToken,
    },
    perfil: 'br-lab-slot',
    tipoDeToken: 'provedor',
  },
};

export const TIPOS_SUPORTADOS = Object.keys(TIPOS);

// Representação FHIR do consentimento (seção 5.5.8) -------------------------

const STATUS_FHIR: Record<string, string> = {
  AUTHORISED: 'active',
  AWAITING_AUTHORISATION: 'proposed',
  EXPIRED: 'inactive',
  REJECTED: 'rejected',
  REVOKED: 'inactive',
};

function consentimentoFhir(provedor: Provedor, c: Consentimento): Registro {
  const receptor = provedor.registro.receptor(c.client_id);
  const isoUtc = (ms: number) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
  const recurso: Recurso = {
    category: [
      {
        coding: [
          {
            code: 'INFA',
            display: 'information access',
            system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
          },
        ],
      },
    ],
    dateTime: isoUtc(c.criadoEm),
    id: c.consent_id,
    identifier: [
      { system: `${provedor.apiBaseUrl.replace(/\/$/, '')}/consents`, value: c.consent_id },
    ],
    meta: { profile: [perfil('br-lab-access-consent')] },
    organization: [ORGANIZACAO],
    patient: { reference: `Patient/${c.paciente!.fhirId}`, type: 'Patient' },
    policy: [{ uri: provedor.participante.provider!.consent_management_uri }],
    provision: {
      action: c.scopes.map((s) => ({ coding: [{ code: s, system: SISTEMA_ESCOPOS }] })),
      actor: [
        {
          reference: {
            display: receptor?.receiver?.client_name ?? c.client_id,
            identifier: { system: 'urn:open-labs-brasil:participant-id', value: c.client_id },
            type: 'Organization',
          },
          role: {
            coding: [
              {
                code: 'IRCP',
                system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType',
              },
            ],
          },
        },
      ],
      period: {
        ...(c.autorizadoEm ? { start: isoUtc(c.autorizadoEm) } : {}),
        end: isoUtc(c.expiraEm),
      },
      type: 'permit',
      ...(c.data_period ? { dataPeriod: c.data_period } : {}),
    },
    resourceType: 'Consent',
    scope: {
      coding: [
        { code: 'patient-privacy', system: 'http://terminology.hl7.org/CodeSystem/consentscope' },
      ],
    },
    status: STATUS_FHIR[c.status]!,
  };
  return {
    atualizadoEm: c.atualizadoEm,
    pacienteId: c.paciente!.fhirId,
    recurso,
    versao: c.historico.length,
  };
}

function registrosDoTipo(ctx: Contexto, tipo: string): Registro[] {
  if (tipo === 'Consent') {
    return [...ctx.provedor.consentimentos.values()]
      .filter((c) => {
        ctx.provedor.atualizarEstado(c);
        return (
          (c.client_id === ctx.acesso.clientId ||
            ctx.provedor.violacao('consentimentos-de-outros-receptores')) &&
          c.paciente &&
          c.paciente.fhirId === ctx.pacienteId
        );
      })
      .map((c) => consentimentoFhir(ctx.provedor, c));
  }
  return [...ctx.provedor.dados.tipo(tipo).values()];
}

/** Cópia do recurso com meta.versionId, meta.lastUpdated e meta.profile. */
export function exibir(provedor: Provedor, reg: Registro): Recurso {
  const r = structuredClone(reg.recurso);
  const meta: Record<string, unknown> = {
    ...((r.meta as Record<string, unknown>) ?? {}),
    lastUpdated: new Date(reg.atualizadoEm).toISOString(),
    versionId: String(reg.versao),
  };
  if (provedor.violacao('sem-meta-profile')) delete meta.profile;
  r.meta = meta;
  return r;
}

function contexto(provedor: Provedor, acesso: Acesso): Contexto {
  const ctx: Contexto = { acesso, provedor };
  if (acesso.token.consentId) {
    const c = provedor.consentimento(acesso.token.consentId);
    if (c?.paciente) {
      ctx.consentimento = c;
      ctx.pacienteId = c.paciente.fhirId;
    }
  }
  return ctx;
}

function conferirPaciente(
  ctx: Contexto,
  conf: ConfiguracaoDoTipo,
  parametros: ParametroDaBusca[],
): void {
  if (!conf.parametroDoPaciente || ctx.provedor.violacao('parametro-patient-ignorado')) return;
  for (const p of parametros.filter((x) => x.nome === conf.parametroDoPaciente)) {
    for (const v of p.valor.split(',')) {
      if (
        referenciaNormalizada(v, 'Patient', ctx.provedor.fhirBaseUrl) !==
        `Patient/${ctx.pacienteId}`
      ) {
        const cpf = ctx.consentimento?.paciente?.cpf;
        throw new ErroDeApi(
          403,
          'PATIENT_NOT_IN_CONSENT',
          'forbidden',
          'O parâmetro patient não é o paciente do consentimento.',
          ctx.provedor.violacao('cpf-no-erro') && cpf
            ? { diagnostico: `paciente do consentimento: CPF ${cpf}` }
            : {},
        );
      }
    }
  }
}

function conferirJanelaDeHorarios(ctx: Contexto, parametros: ParametroDaBusca[]): void {
  let inferior: number | undefined;
  let superior: number | undefined;
  for (const p of parametros.filter((x) => x.nome === 'start')) {
    const { faixa, prefixo } = analisarData(p.valor);
    if (prefixo === 'ge') inferior = Math.max(inferior ?? -Infinity, faixa[0]);
    if (prefixo === 'gt') inferior = Math.max(inferior ?? -Infinity, faixa[1]);
    if (prefixo === 'lt') superior = Math.min(superior ?? Infinity, faixa[0]);
    if (prefixo === 'le') superior = Math.min(superior ?? Infinity, faixa[1]);
  }
  if (inferior === undefined || superior === undefined) {
    throw new ErroDeApi(
      400,
      'INVALID_REQUEST',
      'invalid',
      'A busca de Slot exige start com limite inferior (ge ou gt) e superior (lt ou le).',
    );
  }
  if (
    superior - inferior > 31 * 24 * 3600_000 &&
    !ctx.provedor.violacao('janela-de-agenda-sem-limite')
  ) {
    throw new ErroDeApi(
      400,
      'SEARCH_WINDOW_TOO_LARGE',
      'too-costly',
      'A janela de start passa de 31 dias.',
    );
  }
}

/** Exames da cesta que a unidade da agenda não coleta (seção 5.5.4). */
function examesForaDaUnidade(ctx: Contexto, parametros: ParametroDaBusca[]): string[] {
  const agendas = parametros
    .filter((p) => p.nome === 'schedule')
    .map((p) => referenciaNormalizada(p.valor, 'Schedule', ctx.provedor.fhirBaseUrl));
  const tipos = parametros.filter((p) => p.nome === 'service-type').map((p) => p.valor);
  if (tipos.length === 0) return [];
  const faltando: string[] = [];
  for (const ref of agendas) {
    const agenda = ctx.provedor.dados.tipo('Schedule').get(ref.replace('Schedule/', ''));
    const unidade = (
      agenda?.recurso.actor as Array<{ reference?: string; type?: string }> | undefined
    )
      ?.find((a) => a.type === 'Location')
      ?.reference?.replace('Location/', '');
    const exames = unidade ? (ctx.provedor.dados.examesPorUnidade.get(unidade) ?? []) : [];
    for (const t of tipos) {
      const barra = t.indexOf('|');
      const [sistema, codigo] =
        barra >= 0 ? [t.slice(0, barra), t.slice(barra + 1)] : [undefined, t];
      const coleta = exames.some((e) => {
        const codings = [
          ...(e.loinc ? [{ code: e.loinc.code, system: 'http://loinc.org' }] : []),
          { code: e.codigoProprio, system: 'https://laboratorio.example/fhir/produtos' },
        ];
        return codings.some(
          (c) => c.code === codigo && (sistema === undefined || c.system === sistema),
        );
      });
      if (!coleta && !faltando.includes(t)) faltando.push(t);
    }
  }
  return faltando;
}

function linkDaPagina(
  provedor: Provedor,
  tipo: string,
  parametros: URLSearchParams,
  deslocamento: number,
): string {
  const p = new URLSearchParams();
  for (const [k, v] of parametros) if (k !== '_getpagesoffset') p.append(k, v);
  p.append('_getpagesoffset', String(deslocamento));
  if (provedor.violacao('paginacao-relativa')) return `?${p.toString()}`;
  let base = provedor.violacao('paginacao-fora-da-base')
    ? 'https://paginas.outro-dominio.example/fhir/r4'
    : provedor.fhirBaseUrl.replace(/\/$/, '');
  if (provedor.violacao('paginacao-com-usuario'))
    base = base.replace('https://', 'https://usuario@');
  return `${base}/${tipo}?${p.toString()}`;
}

function buscar(
  ctx: Contexto,
  tipo: string,
  conf: ConfiguracaoDoTipo,
  url: URL,
  res: ServerResponse,
): void {
  const { provedor } = ctx;
  const parametros: ParametroDaBusca[] = [];
  let quantidade = 20;
  let deslocamento = 0;
  const incluir: string[] = [];
  for (const [nome, valor] of url.searchParams) {
    if (nome === '_count') {
      const n = Number(valor);
      if (!Number.isInteger(n) || n < 0)
        throw new ErroDeApi(400, 'INVALID_REQUEST', 'invalid', '_count inválido.');
      quantidade = provedor.violacao('count-ignorado') ? 20 : Math.min(n, 100);
      continue;
    }
    if (nome === '_getpagesoffset') {
      const n = Number(valor);
      if (!Number.isInteger(n) || n < 0)
        throw new ErroDeApi(400, 'INVALID_REQUEST', 'invalid', '_getpagesoffset inválido.');
      deslocamento = n;
      continue;
    }
    if (nome === '_include' && tipo === 'DiagnosticReport' && valor === 'DiagnosticReport:result') {
      if (!provedor.violacao('include-ignorado')) incluir.push(valor);
      continue;
    }
    const ignorado =
      (nome === 'url' && provedor.violacao('busca-por-url-ignorada')) ||
      (nome === 'address-city' && provedor.violacao('busca-por-cidade-ignorada')) ||
      (tipo === 'HealthcareService' &&
        nome === 'location' &&
        provedor.violacao('servicos-de-todas-as-unidades')) ||
      (tipo === 'Schedule' &&
        nome === 'actor' &&
        provedor.violacao('agenda-de-todas-as-unidades')) ||
      (nome === 'access_token' && provedor.violacao('token-na-url'));
    if (ignorado) continue;
    if (!conf.parametros[nome]) {
      if (provedor.violacao('ignora-parametro-desconhecido')) continue;
      throw new ErroDeApi(
        400,
        'UNSUPPORTED_SEARCH_PARAMETER',
        'not-supported',
        `Parâmetro de busca não suportado: ${nome}.`,
      );
    }
    parametros.push({ nome, valor });
  }
  const semLimites = tipo === 'Slot' && provedor.violacao('slot-sem-limites');
  for (const o of semLimites ? [] : (conf.obrigatorios ?? [])) {
    if (!parametros.some((p) => p.nome === o))
      throw new ErroDeApi(
        400,
        'INVALID_REQUEST',
        'invalid',
        `Parâmetro obrigatório ausente: ${o}.`,
      );
  }
  conferirPaciente(ctx, conf, parametros);
  if (tipo === 'Slot' && !semLimites) conferirJanelaDeHorarios(ctx, parametros);

  const entradasExtras: unknown[] = [];
  let candidatos = registrosDoTipo(ctx, tipo).filter((r) => !conf.visivel || conf.visivel(r, ctx));
  if (tipo === 'Slot') {
    const faltando = examesForaDaUnidade(ctx, parametros);
    if (faltando.length > 0) {
      candidatos = [];
      if (!provedor.violacao('exame-indisponivel-silencioso'))
        entradasExtras.push({
          resource: {
            issue: [
              {
                code: 'business-rule',
                details: {
                  coding: [{ code: 'EXAM_NOT_AVAILABLE_AT_LOCATION', system: SISTEMA_DE_ERROS }],
                  text: 'Exame da cesta não é coletado nesta unidade.',
                },
                diagnostics: faltando.join(' '),
                severity: 'information',
              },
            ],
            resourceType: 'OperationOutcome',
          },
          search: { mode: 'outcome' },
        });
    }
  }
  const modoOu = new Set<string>(
    tipo === 'Slot' && provedor.violacao('cesta-com-ou') ? ['service-type'] : [],
  );
  const encontrados = filtrar(
    candidatos,
    conf.parametros,
    parametros,
    provedor.fhirBaseUrl,
    modoOu,
  ).sort(conf.ordenar ?? ((a, b) => a.recurso.id.localeCompare(b.recurso.id)));
  const pagina = encontrados.slice(deslocamento, deslocamento + quantidade);
  const base = provedor.fhirBaseUrl.replace(/\/$/, '');
  const links: Array<{ relation: string; url: string }> = [
    { relation: 'self', url: `${base}/${tipo}${url.search}` },
  ];
  if (deslocamento + quantidade < encontrados.length && quantidade > 0) {
    links.push({
      relation: 'next',
      url: linkDaPagina(provedor, tipo, url.searchParams, deslocamento + quantidade),
    });
  }
  const entradas: unknown[] = pagina.map((r) => ({
    fullUrl: `${base}/${tipo}/${r.recurso.id}`,
    resource: exibir(provedor, r),
    search: { mode: 'match' },
  }));
  if (incluir.length > 0) {
    const vistos = new Set<string>();
    for (const r of pagina) {
      for (const ref of (r.recurso.result as Array<{ reference: string }> | undefined) ?? []) {
        const id = ref.reference.replace('Observation/', '');
        const obs = provedor.dados.tipo('Observation').get(id);
        if (obs && !vistos.has(id) && TIPOS.Observation!.visivel!(obs, ctx)) {
          vistos.add(id);
          entradas.push({
            fullUrl: `${base}/Observation/${id}`,
            resource: exibir(provedor, obs),
            search: { mode: 'include' },
          });
        }
      }
    }
  }
  enviarFhir(res, 200, {
    entry: [...entradas, ...entradasExtras],
    link: links,
    resourceType: 'Bundle',
    total: encontrados.length,
    type: 'searchset',
  });
}

export function capacidades(provedor: Provedor): Recurso {
  return {
    date: '2026-11-16',
    fhirVersion: '4.0.1',
    format: ['json'],
    id: 'servidor-de-exemplo',
    implementation: {
      description: 'Provedor de dados simulado, com dados sintéticos',
      url: provedor.fhirBaseUrl,
    },
    kind: 'instance',
    publisher: 'Open Labs Brasil (servidor de exemplo)',
    resourceType: 'CapabilityStatement',
    rest: [
      {
        mode: 'server',
        resource: Object.entries(TIPOS).map(([tipo, conf]) => ({
          type: tipo,
          ...(provedor.violacao('capability-sem-perfis')
            ? {}
            : { supportedProfile: [perfil(conf.perfil)] }),
          interaction: [
            { code: 'read' },
            ...(conf.buscavel === false ? [] : [{ code: 'search-type' }]),
            ...(conf.interacoesDeEscrita ?? []).map((code) => ({ code })),
          ],
          ...(tipo === 'Appointment'
            ? { conditionalCreate: true, updateCreate: false, versioning: 'versioned' }
            : {}),
          searchParam: Object.entries(conf.parametros).map(([nome, def]) => ({
            name: nome,
            type: def.tipo,
          })),
          ...(tipo === 'DiagnosticReport' ? { searchInclude: ['DiagnosticReport:result'] } : {}),
        })),
        security: {
          description:
            'FAPI 2.0 Security Profile: PAR, PKCE S256, private_key_jwt e tokens vinculados ao certificado por mTLS.',
          service: [
            {
              coding: [
                {
                  code: 'OAuth',
                  system: 'http://terminology.hl7.org/CodeSystem/restful-security-service',
                },
              ],
            },
          ],
        },
      },
    ],
    software: { name: 'Servidor de exemplo do Open Labs Brasil', version: '0.2.2' },
    status: 'active',
  };
}

export async function tratarFhir(
  provedor: Provedor,
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
): Promise<void> {
  await comTratamentoDeErros(provedor, req, res, async () => {
    const base = new URL(provedor.fhirBaseUrl).pathname.replace(/\/$/, '');
    const brutas = url.pathname.slice(base.length).split('/').filter(Boolean);
    let partes: string[];
    try {
      partes = brutas.map(decodeURIComponent);
    } catch {
      autenticarRecurso(provedor, req, url);
      throw new ErroDeApi(400, 'INVALID_REQUEST', 'invalid', 'Caminho com codificação inválida.');
    }

    if (partes.length === 1 && partes[0] === 'metadata') {
      exigirCertificado(provedor, req);
      exigirIdDeInteracao(provedor, req);
      if (req.method !== 'GET')
        throw new ErroDeApi(405, 'METHOD_NOT_ALLOWED', 'not-supported', 'Método não previsto.');
      exigirAccept(req, TIPO_FHIR);
      return enviarFhir(res, 200, capacidades(provedor));
    }

    const acesso = autenticarRecurso(provedor, req, url);
    const [tipo, id, ...resto] = partes;
    const conf = tipo ? TIPOS[tipo] : undefined;
    if (
      tipo === 'ServiceRequest' &&
      id &&
      resto.length === 0 &&
      provedor.violacao('service-request-enderecavel')
    ) {
      const ctxSr = contexto(provedor, acesso);
      for (const reg of provedor.dados.tipo('Appointment').values()) {
        if (reg.pacienteId !== ctxSr.pacienteId) continue;
        const sr = ((reg.recurso.contained as Array<{ id?: string }> | undefined) ?? []).find(
          (c) => c.id === id,
        );
        if (sr) return enviarFhir(res, 200, sr);
      }
    }
    if (!tipo || !conf || resto.length > 0) {
      exigirIdDeInteracao(provedor, req);
      throw new ErroDeApi(404, 'RESOURCE_NOT_FOUND', 'not-found', 'Recurso inexistente.');
    }
    exigirEscopo(provedor, acesso, conf.tipoDeToken, conf.escopo);
    if ((tipo === 'Schedule' || tipo === 'Slot') && provedor.violacao('agenda-exige-paciente'))
      exigirEscopo(provedor, acesso, 'paciente');
    exigirIdDeInteracao(provedor, req);
    exigirAccept(req, TIPO_FHIR);
    const ctx = contexto(provedor, acesso);

    if (tipo === 'Appointment' && !id && req.method === 'POST')
      return tratarCriacaoDeAgendamento(provedor, ctx.acesso, ctx.consentimento!, req, res);
    if (tipo === 'Appointment' && id && req.method === 'PUT')
      return tratarAtualizacaoDeAgendamento(provedor, ctx.acesso, ctx.consentimento!, id, req, res);
    if (req.method !== 'GET')
      throw new ErroDeApi(
        405,
        'METHOD_NOT_ALLOWED',
        'not-supported',
        'Método não previsto para o recurso.',
      );

    if (!id) {
      if (conf.buscavel === false)
        throw new ErroDeApi(
          405,
          'METHOD_NOT_ALLOWED',
          'not-supported',
          'Não há busca deste recurso.',
        );
      return buscar(ctx, tipo, conf, url, res);
    }
    for (const k of url.searchParams.keys()) {
      throw new ErroDeApi(
        400,
        'UNSUPPORTED_SEARCH_PARAMETER',
        'not-supported',
        `Parâmetro não suportado na leitura: ${k}.`,
      );
    }
    const reg = registrosDoTipo(ctx, tipo).find((r) => r.recurso.id === id);
    if (!reg || (conf.visivel && !conf.visivel(reg, ctx)))
      throw new ErroDeApi(404, 'RESOURCE_NOT_FOUND', 'not-found', 'Recurso não encontrado.');
    return enviarFhir(res, 200, exibir(provedor, reg), {
      ETag: `W/"${reg.versao}"`,
      'Last-Modified': new Date(reg.atualizadoEm).toUTCString(),
    });
  });
}
