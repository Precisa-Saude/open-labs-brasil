// API: regras comuns (seção 9.3).

import { randomUUID } from 'node:crypto';
import type { Contexto } from '../contexto.ts';
import { cabecalhoUnico, type Resposta } from '../http.ts';
import { esperar, falhar, naoVerificavel } from '../resultado.ts';
import { codigoDoErro, dentroDaBase, erroApi, linkProximo, recursos, resumo, SISTEMA_DE_ERROS, sucesso, todasAsPaginas, type Json } from '../verificacoes.ts';
import { cenario, corpoDeAgendamento, criarAgendamento, janela } from './apoio.ts';
import type { Teste } from './tipos.ts';

const BASE = 'https://fhir-brasil.dev.br/ig/StructureDefinition/';
const PERFIL_ESPERADO: Record<string, string> = {
  ActivityDefinition: 'br-lab-activity-definition',
  ChargeItemDefinition: 'br-lab-charge-item-definition',
  Location: 'br-lab-location',
  HealthcareService: 'br-lab-healthcare-service',
  Schedule: 'br-lab-schedule',
  Slot: 'br-lab-slot',
  Appointment: 'br-lab-appointment',
  DiagnosticReport: 'br-diagnostic-report',
  Observation: 'br-lab-observation',
  Patient: 'br-patient',
  Consent: 'br-lab-access-consent',
};

type R = Json & { resourceType: string; id?: string };
const lista = (v: unknown): Json[] => (Array.isArray(v) ? (v as Json[]) : []);
const codings = (cc: unknown): Array<{ system?: string; code?: string; display?: string }> => lista((cc as Json | undefined)?.coding) as never;

/** Cardinalidades mínimas de cada perfil do guia (não substitui o validador FHIR). */
export function conferirPerfil(r: R): string[] {
  const e: string[] = [];
  const perfil = PERFIL_ESPERADO[r.resourceType];
  const declarados = lista((r.meta as Json | undefined)?.profile) as unknown as string[];
  if (perfil && !declarados.includes(`${BASE}${perfil}`)) e.push(`${r.resourceType}/${r.id ?? ''} sem meta.profile ${perfil}`);
  const exigir = (cond: unknown, msg: string) => {
    if (!cond) e.push(`${r.resourceType}/${r.id ?? ''}: ${msg}`);
  };
  switch (r.resourceType) {
    case 'ActivityDefinition':
      exigir(r.url && r.title && r.kind === 'ServiceRequest' && codings(r.code).length > 0, 'url, title, kind ServiceRequest e code.coding são obrigatórios');
      break;
    case 'ChargeItemDefinition': {
      const base = lista(r.propertyGroup).flatMap((g) => lista(g.priceComponent)).find((p) => p.type === 'base');
      const amount = base?.amount as Json | undefined;
      exigir(codings(r.code).length > 0, 'code.coding é obrigatório');
      exigir(amount && typeof amount.value === 'number' && amount.currency === 'BRL', 'preço base em BRL é obrigatório');
      break;
    }
    case 'Location': {
      const a = r.address as Json | undefined;
      exigir(lista(r.identifier).length > 0 && r.status && r.name && a?.city && a?.state && r.position, 'identifier, status, name, address.city, address.state e position são obrigatórios');
      break;
    }
    case 'HealthcareService':
      exigir(typeof r.active === 'boolean' && r.name && r.providedBy && lista(r.location).length > 0, 'active, name, providedBy e location são obrigatórios');
      break;
    case 'Schedule':
      exigir(lista(r.actor).some((a) => a.type === 'Location'), 'actor com type Location é obrigatório');
      break;
    case 'Slot':
      exigir(r.schedule && r.status && r.start && r.end, 'schedule, status, start e end são obrigatórios');
      break;
    case 'Appointment':
      exigir(lista(r.basedOn).length > 0 && lista(r.contained).some((c) => c.resourceType === 'ServiceRequest'), 'basedOn e ServiceRequest contido são obrigatórios');
      exigir(lista(r.participant).some((p) => (p.actor as Json | undefined)?.type === 'Patient') && lista(r.participant).some((p) => (p.actor as Json | undefined)?.type === 'Location'), 'participantes Patient e Location com actor.type são obrigatórios');
      break;
    case 'DiagnosticReport':
      exigir(['final', 'amended', 'corrected'].includes(String(r.status)), 'status final, amended ou corrected');
      exigir(lista(r.category).some((c) => codings(c).some((x) => x.code === 'LAB')), 'category LAB é obrigatória');
      exigir(r.code && r.subject && r.effectiveDateTime && lista(r.result).length > 0 && lista(r.performer).length > 0, 'code, subject, effectiveDateTime, result e performer são obrigatórios');
      break;
    case 'Observation': {
      const loinc = codings(r.code).find((c) => c.system === 'http://loinc.org');
      exigir(['final', 'amended', 'corrected'].includes(String(r.status)), 'status final, amended ou corrected');
      exigir(loinc?.code && loinc.display, 'coding LOINC com display é obrigatório');
      exigir(lista(r.category).some((c) => codings(c).some((x) => x.code === 'laboratory')), 'category laboratory é obrigatória');
      exigir(r.subject && r.effectiveDateTime && lista(r.referenceRange).length > 0, 'subject, effectiveDateTime e referenceRange são obrigatórios');
      const q = r.valueQuantity as Json | undefined;
      if (q) exigir(q.system === 'http://unitsofmeasure.org' && q.code && q.unit && typeof q.value === 'number', 'valueQuantity em UCUM com value, unit e code');
      break;
    }
    case 'Patient':
      exigir(lista(r.identifier).some((i) => ['http://rnds.saude.gov.br/fhir/r4/NamingSystem/cpf', 'http://rnds.saude.gov.br/fhir/r4/NamingSystem/cns'].includes(String(i.system))), 'identificador CPF ou CNS é obrigatório');
      exigir(lista(r.name).length > 0 && r.birthDate && r.gender, 'name, birthDate e gender são obrigatórios');
      break;
    case 'Consent': {
      const p = r.provision as Json | undefined;
      exigir(r.patient && lista(r.organization).length > 0, 'patient e organization são obrigatórios');
      exigir(p && (p.period as Json | undefined)?.end && lista(p.actor).length > 0 && lista(p.action).length > 0, 'provision.period.end, provision.actor e provision.action são obrigatórios');
      exigir(lista(p?.action).every((a) => codings(a).every((c) => c.system === 'https://fhir-brasil.dev.br/CodeSystem/lab-access-scope' && ['appointment.write', 'results.read', 'consent.read'].includes(String(c.code)))), 'provision.action só com escopos de paciente');
      break;
    }
  }
  return e;
}

function trocaDaApi(ctx: Contexto, url: string): boolean {
  return url.startsWith(`${ctx.fhirBase}/`) || url === ctx.fhirBase || url.startsWith(`${ctx.apiBase}/`);
}

export const testesDeApi: Teste[] = [
  {
    id: 'API-001',
    titulo: 'Recusa requisição sem x-fapi-interaction-id e devolve o cabeçalho em toda resposta',
    fase: 'final',
    executar: async (ctx, r) => {
      const token = await ctx.tokenDeProvedor(ctx.cliente('principal'), 'locations.read');
      erroApi(await ctx.fhir(token, 'Location?status=active', { semInteracao: true }), 400, 'INTERACTION_ID_MISSING');
      const id = randomUUID();
      const com = await ctx.fhir(token, 'Location?status=active', { cabecalhos: { 'x-fapi-interaction-id': id } });
      esperar(cabecalhoUnico(com, 'x-fapi-interaction-id') === id, 'o provedor não devolveu o mesmo x-fapi-interaction-id');
      const trocas = ctx.http.historico.filter((t) => trocaDaApi(ctx, t.url));
      const sem = trocas.filter((t) => !t.cabecalhos['x-fapi-interaction-id']);
      esperar(sem.length === 0, `${sem.length} de ${trocas.length} respostas sem x-fapi-interaction-id (por exemplo ${sem[0]?.metodo} ${sem[0]?.url} ${sem[0]?.status})`);
      const diferentes = trocas.filter((t) => t.cabecalhosDaRequisicao['x-fapi-interaction-id'] && t.cabecalhosDaRequisicao['x-fapi-interaction-id'] !== t.cabecalhos['x-fapi-interaction-id']);
      esperar(diferentes.length === 0, `${diferentes.length} respostas com x-fapi-interaction-id diferente do enviado`);
      r.evidencia(`sem cabeçalho: 400 INTERACTION_ID_MISSING; ${trocas.length} respostas da API com o cabeçalho ecoado`);
    },
  },
  {
    id: 'API-002',
    titulo: 'Recusa token no parâmetro de consulta',
    executar: async (ctx, r) => {
      const token = await ctx.tokenDeProvedor(ctx.cliente('principal'), 'locations.read');
      const resp = await ctx.api('GET', `${ctx.fhirBase}/Location?status=active&access_token=${encodeURIComponent(token)}`);
      esperar(resp.status === 400 || resp.status === 401, `token na URL não foi recusado: ${resumo(resp)}`);
      r.evidencia(`?access_token=...: ${resp.status} ${codigoDoErro(resp) ?? ''}`);
    },
  },
  {
    id: 'API-003',
    titulo: 'Recusa token sem o escopo do recurso com 403 e insufficient_scope',
    executar: async (ctx, r) => {
      const c = ctx.cliente('principal');
      const a = await ctx.autorizar(c, { escopos: ['appointment.write'] });
      const id = ctx.paciente('principal').fhir_id ?? 'x';
      const resp = await ctx.fhir(a.accessToken, `DiagnosticReport?patient=Patient/${id}`, { credencial: c.credenciais[0]! });
      erroApi(resp, 403, 'SCOPE_INSUFFICIENT');
      esperar(/insufficient_scope/.test(cabecalhoUnico(resp, 'www-authenticate') ?? ''), 'WWW-Authenticate sem insufficient_scope');
      r.evidencia('token com appointment.write em /DiagnosticReport: 403 SCOPE_INSUFFICIENT, insufficient_scope');
    },
  },
  {
    id: 'API-004',
    titulo: 'Recusa token de provedor em recurso de paciente e o contrário',
    executar: async (ctx, r) => {
      const c = ctx.cliente('principal');
      const provedor = await ctx.tokenDeProvedor(c, 'catalog.read');
      erroApi(await ctx.fhir(provedor, `DiagnosticReport?patient=Patient/${ctx.paciente('principal').fhir_id ?? 'x'}`), 403, 'SCOPE_INSUFFICIENT');
      const a = await ctx.autorizar(c);
      erroApi(await ctx.fhir(a.accessToken, 'Location?status=active'), 403, 'SCOPE_INSUFFICIENT');
      r.evidencia('token de provedor em DiagnosticReport e de paciente em Location: 403 SCOPE_INSUFFICIENT');
    },
  },
  {
    id: 'API-005',
    titulo: 'Recusa token ligado a consentimento REVOKED ou EXPIRED com 401',
    fase: 'relogio',
    executar: async (ctx, r) => {
      const c = ctx.cliente('principal');
      const caminho = `Patient/${ctx.paciente('principal').fhir_id ?? 'x'}`;
      const revogado = await ctx.autorizar(c);
      await ctx.revogar(c, revogado.consentId);
      erroApi(await ctx.fhir(revogado.accessToken, caminho), 401, 'CONSENT_REVOKED');
      const curto = await ctx.autorizar(c, { expiracaoMs: ctx.agoraMs() + 5 * 60_000 });
      await ctx.avancarRelogio(6 * 60);
      erroApi(await ctx.fhir(curto.accessToken, caminho), 401, 'CONSENT_EXPIRED');
      r.evidencia('REVOKED: 401 CONSENT_REVOKED; EXPIRED: 401 CONSENT_EXPIRED');
    },
  },
  {
    id: 'API-006',
    titulo: 'Responde 400 UNSUPPORTED_SEARCH_PARAMETER a parâmetro não suportado',
    executar: async (ctx, r) => {
      const token = await ctx.tokenDeProvedor(ctx.cliente('principal'), 'locations.read');
      erroApi(await ctx.fhir(token, 'Location?status=active&parametro-inventado=1'), 400, 'UNSUPPORTED_SEARCH_PARAMETER');
      const cat = await ctx.tokenDeProvedor(ctx.cliente('principal'), 'catalog.read');
      erroApi(await ctx.fhir(cat, 'ActivityDefinition?status=active&nao-existe=x'), 400, 'UNSUPPORTED_SEARCH_PARAMETER');
      r.evidencia('parâmetro inventado em Location e ActivityDefinition: 400 UNSUPPORTED_SEARCH_PARAMETER');
    },
  },
  {
    id: 'API-007',
    titulo: 'Pagina com link next e respeita _count até 100',
    executar: async (ctx, r) => {
      const token = await ctx.tokenDeProvedor(ctx.cliente('principal'), 'catalog.read');
      const todas = await todasAsPaginas(ctx, token, 'ActivityDefinition?_count=2');
      esperar(todas.paginas >= 2, 'o catálogo de teste precisa de mais de dois itens para conferir a paginação');
      esperar(todas.bundles.every((b) => recursos(b).length <= 2), 'página com mais itens que _count=2');
      const ids = todas.recursos.map((x) => x.id);
      esperar(new Set(ids).size === ids.length, 'item repetido entre páginas');
      const unica = sucesso(await ctx.fhir(token, 'ActivityDefinition?_count=100'));
      const total = (unica.total as number | undefined) ?? recursos(unica).length;
      esperar(recursos(unica).length <= 100, 'página com mais de 100 itens');
      if (recursos(unica).length === total) esperar(ids.length === total, `a paginação com _count=2 trouxe ${ids.length} itens, a página única ${total}`);
      const acima = await ctx.fhir(token, 'ActivityDefinition?_count=500');
      esperar(acima.status === 400 || (acima.status === 200 && recursos(acima.json as Json).length <= 100), `_count=500: ${resumo(acima)}`);
      r.evidencia(`${todas.paginas} páginas de até 2 itens, ${ids.length} itens sem repetição; _count=500 limitado`);
    },
  },
  {
    id: 'API-008',
    titulo: 'Recursos declaram o perfil em meta.profile e validam contra ele',
    executar: async (ctx, r) => {
      const c = ctx.cliente('principal');
      const vistos: R[] = [];
      const primeiro = async (token: string, caminho: string) => {
        const b = sucesso(await ctx.fhir(token, caminho));
        vistos.push(...recursos(b).slice(0, 5), ...recursos(b, 'include').slice(0, 5));
      };
      await primeiro(await ctx.tokenDeProvedor(c, 'catalog.read'), 'ActivityDefinition?_count=5');
      await primeiro(await ctx.tokenDeProvedor(c, 'catalog.read'), 'ChargeItemDefinition?_count=5');
      const loc = await ctx.tokenDeProvedor(c, 'locations.read');
      await primeiro(loc, 'Location?status=active');
      await primeiro(loc, 'HealthcareService?active=true');
      const cen = await cenario(ctx);
      await primeiro(cen.tokenDeAgenda, 'Schedule?active=true');
      vistos.push(...(cen.horariosLivres.slice(0, 5) as R[]));
      const pac = cen.pacienteRef;
      await primeiro(cen.autorizacao.accessToken, `DiagnosticReport?patient=${pac}&_include=DiagnosticReport:result`);
      await primeiro(cen.autorizacao.accessToken, `Consent?patient=${pac}`);
      vistos.push(sucesso(await ctx.fhir(cen.autorizacao.accessToken, pac)) as R);
      const ag = await criarAgendamento(ctx, cen, corpoDeAgendamento({ cliente: cen.cliente, slot: cen.horariosLivres[0]!, exames: cen.exames.slice(0, 1), unidade: cen.unidade, pacienteRef: pac }));
      vistos.push(sucesso(ag, 201) as R);
      const erros = vistos.flatMap(conferirPerfil);
      esperar(erros.length === 0, erros.slice(0, 5).join('; '));
      const tipos = [...new Set(vistos.map((v) => v.resourceType))];
      r.evidencia(`${vistos.length} recursos de ${tipos.length} tipos com meta.profile e cardinalidades mínimas: ${tipos.join(', ')}`);
      r.marcarParcial('a validação completa contra os perfis exige o validador FHIR com o guia de implementação; a suíte confere meta.profile e as cardinalidades mínimas de cada perfil');
    },
  },
  {
    id: 'API-009',
    titulo: 'GET /metadata devolve CapabilityStatement com interações, parâmetros e perfis',
    executar: async (ctx, r) => {
      const cs = sucesso(await ctx.api('GET', `${ctx.fhirBase}/metadata`));
      esperar(cs.resourceType === 'CapabilityStatement', 'não é CapabilityStatement');
      esperar(cs.fhirVersion === '4.0.1', `fhirVersion ${String(cs.fhirVersion)}`);
      const declarados = lista(lista(cs.rest)[0]?.resource);
      const exigidos: Record<string, string[]> = {
        ActivityDefinition: ['status', 'url', '_lastUpdated'],
        ChargeItemDefinition: ['status', 'url', 'jurisdiction', '_lastUpdated'],
        Location: ['status', 'address-city', 'address-state', '_lastUpdated'],
        HealthcareService: ['location', 'active', '_lastUpdated'],
        Schedule: ['actor', 'active'],
        Slot: ['schedule', 'start', 'status', 'service-type'],
        Appointment: [],
        DiagnosticReport: ['patient', '_lastUpdated', 'date', 'status'],
        Observation: ['patient', 'code', 'date', '_lastUpdated'],
        Patient: [],
        Consent: ['patient'],
      };
      const problemas: string[] = [];
      for (const [tipo, params] of Object.entries(exigidos)) {
        const decl = declarados.find((x) => x.type === tipo);
        if (!decl) {
          problemas.push(`${tipo} ausente`);
          continue;
        }
        if (!(lista(decl.supportedProfile) as unknown as string[]).includes(`${BASE}${PERFIL_ESPERADO[tipo]}`)) problemas.push(`${tipo} sem supportedProfile ${PERFIL_ESPERADO[tipo]}`);
        const inter = lista(decl.interaction).map((i) => i.code);
        if (!inter.includes('read')) problemas.push(`${tipo} sem read`);
        if (tipo === 'Appointment' && !(inter.includes('create') && inter.includes('update'))) problemas.push('Appointment sem create e update');
        const nomes = lista(decl.searchParam).map((p) => p.name);
        for (const p of params) if (!nomes.includes(p)) problemas.push(`${tipo} sem searchParam ${p}`);
      }
      esperar(problemas.length === 0, problemas.join('; '));
      r.evidencia(`${declarados.length} recursos declarados com perfis e parâmetros; o comportamento é conferido pelos demais testes`);
    },
  },
  {
    id: 'API-010',
    titulo: 'Toda resposta 4xx e 5xx da API traz OperationOutcome com código do protocolo',
    fase: 'final',
    executar: async (ctx, r) => {
      const token = await ctx.tokenDeProvedor(ctx.cliente('principal'), 'locations.read');
      erroApi(await ctx.fhir(token, 'Location/unidade-que-nao-existe'), 404, 'RESOURCE_NOT_FOUND');
      const erros = ctx.http.historico.filter((t) => trocaDaApi(ctx, t.url) && t.status >= 400);
      const ruins = erros.filter((t) => {
        const oo = t.json as { resourceType?: string; issue?: Array<{ severity?: string; details?: { coding?: Array<{ system?: string }> } }> } | undefined;
        if (oo?.resourceType !== 'OperationOutcome' || !oo.issue?.length) return true;
        return oo.issue.some((i) => i.severity !== 'error' || (i.details?.coding ?? []).filter((c) => c.system === SISTEMA_DE_ERROS).length !== 1);
      });
      esperar(ruins.length === 0, `${ruins.length} de ${erros.length} erros sem OperationOutcome do protocolo (por exemplo ${ruins[0]?.metodo} ${ruins[0]?.url} ${ruins[0]?.status})`);
      const codigos = [...new Set(erros.map((t) => codigoDoErro({ json: t.json } as Resposta)))].filter(Boolean);
      r.evidencia(`${erros.length} respostas de erro da API conferidas; códigos vistos: ${codigos.join(', ')}`);
    },
  },
  {
    id: 'API-011',
    titulo: 'Leitura por id de recurso de outro paciente devolve 404',
    executar: async (ctx, r) => {
      const c = ctx.cliente('principal');
      const b = await ctx.autorizar(c, { paciente: ctx.paciente('outro') });
      const lb = sucesso(await ctx.consentimentos('GET', `/${b.consentId}`, b.accessToken));
      const idB = (lb.patient as { fhir_id?: string }).fhir_id!;
      const laudoB = recursos(sucesso(await ctx.fhir(b.accessToken, `DiagnosticReport?patient=Patient/${idB}`)))[0];
      if (!laudoB) naoVerificavel('o paciente "outro" não tem laudo liberado para servir de recurso alheio');
      const a = await ctx.autorizar(c);
      erroApi(await ctx.fhir(a.accessToken, `DiagnosticReport/${laudoB.id}`), 404, 'RESOURCE_NOT_FOUND');
      erroApi(await ctx.fhir(a.accessToken, `Patient/${idB}`), 404, 'RESOURCE_NOT_FOUND');
      r.evidencia('DiagnosticReport e Patient de outro paciente: 404');
    },
  },
  {
    id: 'API-012',
    titulo: 'Todo link de paginação fica dentro do fhir_base_url do registro',
    executar: async (ctx, r) => {
      const c = ctx.cliente('principal');
      const cen = await cenario(ctx);
      const j = janela(ctx, 7);
      const buscas: Array<[string, string]> = [
        [await ctx.tokenDeProvedor(c, 'catalog.read'), 'ActivityDefinition?_count=1'],
        [await ctx.tokenDeProvedor(c, 'catalog.read'), 'ChargeItemDefinition?_count=1'],
        [await ctx.tokenDeProvedor(c, 'locations.read'), 'Location?_count=1'],
        [await ctx.tokenDeProvedor(c, 'locations.read'), 'HealthcareService?_count=1'],
        [cen.tokenDeAgenda, 'Schedule?_count=1'],
        [cen.tokenDeAgenda, `Slot?schedule=${cen.agenda}&start=ge${j.inicio}&start=lt${j.fim}&_count=2`],
        [cen.autorizacao.accessToken, `DiagnosticReport?patient=${cen.pacienteRef}&_count=1`],
        [cen.autorizacao.accessToken, `Observation?patient=${cen.pacienteRef}&_count=1`],
        [cen.autorizacao.accessToken, `Consent?patient=${cen.pacienteRef}&_count=1`],
      ];
      let links = 0;
      for (const [token, caminho] of buscas) {
        let url: string | undefined = `${ctx.fhirBase}/${caminho}`;
        for (let i = 0; url && i < 3; i++) {
          const b = sucesso(await ctx.fhir(token, url));
          const proximo = linkProximo(b);
          if (proximo) {
            links++;
            if (!dentroDaBase(proximo, ctx.fhirBase)) falhar(`link next fora do fhir_base_url em ${caminho.split('?')[0]}: ${proximo}`);
          }
          url = proximo;
        }
      }
      esperar(links > 0, 'nenhuma busca produziu link next para conferir');
      r.evidencia(`${links} links next em ${buscas.length} buscas, todos dentro de ${ctx.fhirBase}`);
    },
  },
];
