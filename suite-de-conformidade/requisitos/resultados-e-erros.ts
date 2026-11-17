// RES (resultados e registros de consentimento) e ERR (erros), seção 9.3.

import { randomUUID } from 'node:crypto';

import type { Autorizacao, Contexto } from '../contexto.ts';
import { cabecalhoUnico } from '../http.ts';
import { esperar, falhar, naoVerificavel, type Relator } from '../resultado.ts';
import {
  codigoDoErro,
  erroApi,
  type Json,
  recursos,
  resumo,
  sucesso,
  todasAsPaginas,
} from '../verificacoes.ts';
import type { Teste } from './tipos.ts';

const lista = (v: unknown): Json[] => (Array.isArray(v) ? (v as Json[]) : []);

async function pacienteAutorizado(
  ctx: Contexto,
  o: Parameters<Contexto['autorizar']>[1] = {},
): Promise<{ a: Autorizacao; ref: string }> {
  const c = ctx.cliente('principal');
  const a = await ctx.autorizar(c, o);
  const leitura = sucesso(await ctx.consentimentos('GET', `/${a.consentId}`, a.accessToken));
  const id = (leitura.patient as { fhir_id?: unknown } | undefined)?.fhir_id;
  if (typeof id !== 'string') falhar('leitura do consentimento sem patient.fhir_id');
  return { a, ref: `Patient/${id}` };
}

function data(r: Json): number {
  return Date.parse(String(r.effectiveDateTime));
}

const CODIGOS_OAUTH = [
  'invalid_request',
  'invalid_client',
  'invalid_grant',
  'unauthorized_client',
  'unsupported_grant_type',
  'invalid_scope',
  'server_error',
  'temporarily_unavailable',
];

export const testesDeResultadosEErros: Teste[] = [
  {
    executar: async (ctx, r) => {
      const { a, ref } = await pacienteAutorizado(ctx);
      const todos = (await todasAsPaginas(ctx, a.accessToken, `DiagnosticReport?patient=${ref}`))
        .recursos;
      esperar(todos.length >= 2, 'o paciente de teste precisa de ao menos dois laudos liberados');
      esperar(
        todos.every((d) => (d.subject as Json).reference === ref),
        'laudo de outro paciente na busca',
      );
      const futuro = recursos(
        sucesso(
          await ctx.fhir(
            a.accessToken,
            `DiagnosticReport?patient=${ref}&_lastUpdated=gt${new Date(ctx.agoraMs() + 86_400_000).toISOString()}`,
          ),
        ),
      );
      esperar(futuro.length === 0, '_lastUpdated no futuro devolveu laudos');
      const passado = recursos(
        sucesso(
          await ctx.fhir(
            a.accessToken,
            `DiagnosticReport?patient=${ref}&_lastUpdated=gt2000-01-01&_count=100`,
          ),
        ),
      );
      esperar(
        passado.length === todos.length,
        '_lastUpdated no passado não devolveu todos os laudos',
      );
      const datas = todos.map(data).sort((x, y) => x - y);
      const corte = new Date(datas[Math.floor(datas.length / 2)]!).toISOString().slice(0, 10);
      const depois = (
        await todasAsPaginas(ctx, a.accessToken, `DiagnosticReport?patient=${ref}&date=ge${corte}`)
      ).recursos;
      esperar(depois.length > 0 && depois.length < todos.length, `date=ge${corte} não filtrou`);
      esperar(
        depois.every((d) => String(d.effectiveDateTime).slice(0, 10) >= corte),
        `date=ge${corte} devolveu laudo anterior`,
      );
      const status = String(todos[0]!.status);
      const porStatus = (
        await todasAsPaginas(ctx, a.accessToken, `DiagnosticReport?patient=${ref}&status=${status}`)
      ).recursos;
      esperar(
        porStatus.length > 0 && porStatus.every((d) => d.status === status),
        `status=${status} incorreto`,
      );
      const cancelados = recursos(
        sucesso(await ctx.fhir(a.accessToken, `DiagnosticReport?patient=${ref}&status=cancelled`)),
      );
      esperar(
        cancelados.every((d) => d.status === 'cancelled'),
        'status=cancelled devolveu laudo em outro estado: o parâmetro parece ignorado',
      );
      const semCodigo = recursos(
        sucesso(await ctx.fhir(a.accessToken, `DiagnosticReport?patient=${ref}&date=lt1900-01-01`)),
      );
      esperar(
        semCodigo.length === 0,
        'date=lt1900-01-01 devolveu laudos: o parâmetro parece ignorado',
      );
      const comInclude = sucesso(
        await ctx.fhir(
          a.accessToken,
          `DiagnosticReport?patient=${ref}&_include=DiagnosticReport:result&_count=100`,
        ),
      );
      const incluidos = new Set(recursos(comInclude, 'include').map((o) => `Observation/${o.id}`));
      const referidos = recursos(comInclude).flatMap((d) =>
        lista(d.result).map((x) => String(x.reference)),
      );
      esperar(
        referidos.length > 0 && referidos.every((ref2) => incluidos.has(ref2)),
        '_include não trouxe todas as Observation referidas',
      );
      r.evidencia(
        `${todos.length} laudos; _lastUpdated, date=ge${corte}, status=${status} e _include com ${incluidos.size} resultados`,
      );
    },
    id: 'RES-001',
    titulo:
      'DiagnosticReport com patient, _lastUpdated, date, status e _include=DiagnosticReport:result',
  },
  {
    executar: async (ctx, r) => {
      const { a, ref } = await pacienteAutorizado(ctx);
      const todas = (
        await todasAsPaginas(ctx, a.accessToken, `Observation?patient=${ref}&_count=100`)
      ).recursos;
      esperar(todas.length >= 2, 'o paciente de teste precisa de ao menos duas Observation');
      const loinc =
        lista((todas[0]!.code as Json).coding).find((c) => c.system === 'http://loinc.org') ??
        falhar('Observation sem LOINC');
      const porCodigo = (
        await todasAsPaginas(
          ctx,
          a.accessToken,
          `Observation?patient=${ref}&code=${encodeURIComponent(`http://loinc.org|${String(loinc.code)}`)}`,
        )
      ).recursos;
      esperar(
        porCodigo.length > 0 &&
          porCodigo.every((o) => lista((o.code as Json).coding).some((c) => c.code === loinc.code)),
        'busca por code incorreta',
      );
      const datas = todas.map(data).sort((x, y) => x - y);
      const corte = new Date(datas[datas.length - 1]!).toISOString().slice(0, 10);
      const ate = (
        await todasAsPaginas(
          ctx,
          a.accessToken,
          `Observation?patient=${ref}&date=lt${corte}&_count=100`,
        )
      ).recursos;
      esperar(
        ate.every((o) => data(o) < Date.parse(`${corte}T03:00:00Z`)) && ate.length < todas.length,
        `date=lt${corte} não filtrou`,
      );
      const futuro = recursos(
        sucesso(
          await ctx.fhir(
            a.accessToken,
            `Observation?patient=${ref}&_lastUpdated=gt${new Date(ctx.agoraMs() + 86_400_000).toISOString()}`,
          ),
        ),
      );
      esperar(futuro.length === 0, '_lastUpdated no futuro devolveu resultados');
      r.evidencia(
        `${todas.length} resultados; code ${String(loinc.code)}, date e _lastUpdated conferidos`,
      );
    },
    id: 'RES-002',
    titulo: 'Observation com patient, code, date e _lastUpdated',
  },
  {
    executar: async (ctx, r) => {
      const { a } = await pacienteAutorizado(ctx);
      const outro = ctx.cfg.pacientes.outro?.fhir_id ?? 'paciente-de-outra-pessoa';
      erroApi(
        await ctx.fhir(a.accessToken, `DiagnosticReport?patient=Patient/${outro}`),
        403,
        'PATIENT_NOT_IN_CONSENT',
      );
      erroApi(
        await ctx.fhir(a.accessToken, `Observation?patient=Patient/${outro}`),
        403,
        'PATIENT_NOT_IN_CONSENT',
      );
      r.evidencia('DiagnosticReport e Observation com outro paciente: 403 PATIENT_NOT_IN_CONSENT');
    },
    id: 'RES-003',
    titulo: 'Busca com patient diferente do consentimento devolve 403 PATIENT_NOT_IN_CONSENT',
  },
  {
    executar: async (ctx, r) => {
      const { a, ref } = await pacienteAutorizado(ctx);
      const todos = (
        await todasAsPaginas(ctx, a.accessToken, `DiagnosticReport?patient=${ref}&_count=100`)
      ).recursos;
      esperar(
        todos.every((d) => ['final', 'amended', 'corrected'].includes(String(d.status))),
        `laudo em estado ${todos.find((d) => !['final', 'amended', 'corrected'].includes(String(d.status)))?.status as string}`,
      );
      const retidos = ctx.cfg.pacientes.principal.laudos_nao_liberados ?? [];
      if (retidos.length === 0)
        naoVerificavel('a configuração não indica laudos parciais ou retidos do paciente de teste');
      for (const id of retidos) {
        esperar(!todos.some((d) => d.id === id), `laudo não liberado ${id} aparece na busca`);
        erroApi(await ctx.fhir(a.accessToken, `DiagnosticReport/${id}`), 404, 'RESOURCE_NOT_FOUND');
      }
      r.evidencia(
        `${todos.length} laudos visíveis, todos liberados; ${retidos.join(', ')}: fora da busca e 404`,
      );
    },
    id: 'RES-004',
    titulo: 'Só laudos final, amended ou corrected já liberados ao paciente',
  },
  {
    executar: async (ctx, r) => {
      const antigo =
        ctx.cfg.pacientes.principal.laudo_antigo ??
        naoVerificavel(
          'a configuração não indica um laudo antigo do paciente (pacientes.principal.laudo_antigo)',
        );
      const livre = await pacienteAutorizado(ctx);
      const semPeriodo = (
        await todasAsPaginas(
          ctx,
          livre.a.accessToken,
          `DiagnosticReport?patient=${livre.ref}&_count=100`,
        )
      ).recursos;
      esperar(
        semPeriodo.some((d) => d.id === antigo.id),
        'sem data_period, o laudo antigo deveria aparecer (controle positivo)',
      );
      const inicio = new Date(Date.parse(`${antigo.data}T00:00:00Z`) + 2 * 86_400_000)
        .toISOString()
        .slice(0, 10);
      const limitado = await pacienteAutorizado(ctx, { dataPeriod: { start: inicio } });
      const comPeriodo = (
        await todasAsPaginas(
          ctx,
          limitado.a.accessToken,
          `DiagnosticReport?patient=${limitado.ref}&_count=100`,
        )
      ).recursos;
      esperar(
        !comPeriodo.some((d) => d.id === antigo.id),
        'com data_period, o laudo antigo aparece na busca',
      );
      esperar(
        comPeriodo.every((d) => String(d.effectiveDateTime).slice(0, 10) >= inicio),
        'laudo anterior ao data_period na busca',
      );
      erroApi(
        await ctx.fhir(limitado.a.accessToken, `DiagnosticReport/${antigo.id}`),
        404,
        'RESOURCE_NOT_FOUND',
      );
      const obs = (
        await todasAsPaginas(
          ctx,
          limitado.a.accessToken,
          `Observation?patient=${limitado.ref}&_count=100`,
        )
      ).recursos;
      esperar(
        obs.every((o) => String(o.effectiveDateTime).slice(0, 10) >= inicio),
        'Observation anterior ao data_period',
      );
      r.evidencia(
        `data_period.start ${inicio}: ${comPeriodo.length} laudos, ${antigo.id} oculto (visível sem data_period)`,
      );
    },
    id: 'RES-005',
    titulo: 'Respeita data_period do consentimento',
  },
  {
    executar: async (ctx, r) => {
      const alvo =
        ctx.cfg.pacientes.principal.laudo_para_retificar ??
        naoVerificavel('a configuração não indica laudo para retificar');
      const { a, ref } = await pacienteAutorizado(ctx);
      const antes = sucesso(await ctx.fhir(a.accessToken, `DiagnosticReport/${alvo}`));
      const versaoAntes = Number((antes.meta as Json | undefined)?.versionId ?? 0);
      const marco = new Date(ctx.agoraMs() - 2000).toISOString();
      const rc = await ctx.controle('POST', '/_controle/resultados/retificar', { id: alvo });
      esperar(rc.status === 200, 'a interface de controle não retificou o laudo');
      const depois = sucesso(await ctx.fhir(a.accessToken, `DiagnosticReport/${alvo}`));
      esperar(
        ['amended', 'corrected'].includes(String(depois.status)),
        `status depois da retificação: ${String(depois.status)}`,
      );
      esperar(
        Number((depois.meta as Json | undefined)?.versionId ?? 0) > versaoAntes,
        'a versão não mudou',
      );
      const incrementais = recursos(
        sucesso(
          await ctx.fhir(a.accessToken, `DiagnosticReport?patient=${ref}&_lastUpdated=gt${marco}`),
        ),
      );
      esperar(
        incrementais.some((d) => d.id === alvo),
        'o laudo retificado não aparece na busca incremental',
      );
      r.evidencia(
        `${alvo}: mesmo id, versão ${versaoAntes} para ${String((depois.meta as Json).versionId)}, presente em _lastUpdated=gt${marco}`,
      );
    },
    id: 'RES-006',
    titulo: 'Laudo retificado mantém o id e aparece na busca por _lastUpdated',
  },
  {
    executar: async (ctx, r) => {
      const { a, ref } = await pacienteAutorizado(ctx);
      const todas = (
        await todasAsPaginas(ctx, a.accessToken, `Observation?patient=${ref}&_count=100`)
      ).recursos;
      esperar(todas.length > 0, 'sem Observation para conferir');
      const sem = todas.filter(
        (o) =>
          !lista((o.code as Json).coding).some((c) => c.system === 'http://loinc.org' && c.code),
      );
      esperar(sem.length === 0, `Observation sem LOINC: ${sem.map((o) => o.id).join(', ')}`);
      r.evidencia(`${todas.length} Observation com LOINC`);
    },
    id: 'RES-007',
    titulo: 'Toda Observation tem código LOINC',
  },
  {
    executar: async (ctx, r) => {
      const { a, ref } = await pacienteAutorizado(ctx);
      const p = sucesso(await ctx.fhir(a.accessToken, ref));
      esperar(`Patient/${String(p.id)}` === ref, 'Patient lido não é o do consentimento');
      const outro = ctx.cfg.pacientes.outro?.fhir_id ?? 'paciente-de-outra-pessoa';
      erroApi(await ctx.fhir(a.accessToken, `Patient/${outro}`), 404, 'RESOURCE_NOT_FOUND');
      r.evidencia(`${ref}: 200; Patient/${outro}: 404`);
    },
    id: 'RES-008',
    titulo: 'GET /Patient/{id} só para o paciente do consentimento',
  },
  {
    executar: async (ctx, r) => {
      const a = ctx.cliente('principal');
      const b = ctx.cliente('secundario');
      const deA = await ctx.autorizar(a);
      const deB = await ctx.autorizar(b);
      const leitura = sucesso(
        await ctx.consentimentos('GET', `/${deA.consentId}`, deA.accessToken),
      );
      const ref = `Patient/${String((leitura.patient as Json).fhir_id)}`;
      const consentimentos = (
        await todasAsPaginas(ctx, deA.accessToken, `Consent?patient=${ref}&_count=100`)
      ).recursos;
      const ids = consentimentos.flatMap((c) => lista(c.identifier).map((i) => String(i.value)));
      esperar(ids.includes(deA.consentId), 'o consentimento do próprio receptor não aparece');
      esperar(
        !ids.includes(deB.consentId),
        'aparece consentimento do mesmo paciente com outro receptor',
      );
      esperar(
        consentimentos.every((c) => (c.patient as Json).reference === ref),
        'Consent de outro paciente',
      );
      const ativos = (
        await todasAsPaginas(
          ctx,
          deA.accessToken,
          `Consent?patient=${ref}&status=active&_count=100`,
        )
      ).recursos;
      esperar(
        ativos.every((c) => c.status === 'active'),
        'status=active devolveu Consent em outro estado',
      );
      r.evidencia(
        `${consentimentos.length} Consent do receptor A; o consentimento com o receptor B não aparece`,
      );
    },
    id: 'RES-009',
    titulo: 'Consent?patient devolve só consentimentos entre aquele paciente e aquele receptor',
  },
  {
    executar: async (ctx, r) => {
      const oauth = [
        ctx.endpoint('token_endpoint'),
        ctx.endpoint('pushed_authorization_request_endpoint'),
      ];
      const erros = ctx.http.historico.filter((t) => oauth.includes(t.url) && t.status >= 400);
      esperar(erros.length > 0, 'nenhum erro do servidor de autorização foi provocado na execução');
      const ruins = erros.filter(
        (t) => !CODIGOS_OAUTH.includes(String((t.json as { error?: unknown } | undefined)?.error)),
      );
      esperar(
        ruins.length === 0,
        `erros com código fora da lista: ${ruins
          .slice(0, 3)
          .map((t) => `${t.status} ${t.texto.slice(0, 80)}`)
          .join('; ')}`,
      );
      const vistos = [...new Set(erros.map((t) => String((t.json as { error?: unknown }).error)))];
      r.evidencia(`${erros.length} erros de PAR e token, códigos: ${vistos.join(', ')}`);
    },
    fase: 'final',
    id: 'ERR-001',
    titulo: 'Erros do servidor de autorização só com códigos do OAuth da seção 6.2',
  },
  {
    executar: async (ctx, r) => {
      const semToken = await ctx.api('GET', `${ctx.fhirBase}/Location?status=active`);
      erroApi(semToken, 401, 'TOKEN_MISSING');
      esperar(
        /^Bearer\b/.test(cabecalhoUnico(semToken, 'www-authenticate') ?? ''),
        'sem token: WWW-Authenticate ausente',
      );
      const invalido = await ctx.fhir('token-invalido-de-teste', 'Location?status=active');
      erroApi(invalido, 401, 'TOKEN_INVALID');
      esperar(
        /error="invalid_token"/.test(cabecalhoUnico(invalido, 'www-authenticate') ?? ''),
        'token inválido: WWW-Authenticate sem invalid_token',
      );
      const catalogo = await ctx.tokenDeProvedor(ctx.cliente('principal'), 'catalog.read');
      const semEscopo = await ctx.fhir(catalogo, 'Location?status=active');
      erroApi(semEscopo, 403, 'SCOPE_INSUFFICIENT');
      esperar(
        /error="insufficient_scope"/.test(cabecalhoUnico(semEscopo, 'www-authenticate') ?? ''),
        'escopo insuficiente: WWW-Authenticate sem insufficient_scope',
      );
      r.evidencia('Bearer; invalid_token; insufficient_scope');
    },
    id: 'ERR-002',
    titulo: '401 e 403 de token trazem WWW-Authenticate conforme o RFC 6750',
  },
  {
    executar: async (ctx, r) => {
      const c = ctx.cliente('principal');
      const invalido = await ctx.consentimentos('POST', '', 'token-invalido-de-teste', {
        corpo: '{isto não é json',
        credencial: c.credenciais[0]!,
      });
      esperar(invalido.status === 401, `corpo inválido com token inválido: ${resumo(invalido)}`);
      const provedor = await ctx.tokenDeProvedor(c, 'catalog.read');
      const ag = await ctx.fhir(provedor, 'Appointment', {
        cabecalhos: { 'if-none-exist': 'identifier=x' },
        corpo: '{"resourceType":"Appointment"',
        metodo: 'POST',
      });
      esperar(ag.status === 403, `Appointment inválido com token de provedor: ${resumo(ag)}`);
      r.evidencia(
        'POST /consents inválido com token inválido: 401; POST /Appointment inválido com token de provedor: 403',
      );
    },
    id: 'ERR-003',
    titulo: 'Erros de segurança têm precedência sobre os de conteúdo',
  },
  {
    executar: async (ctx, r) => {
      const cpfs = [ctx.cfg.pacientes.principal.cpf, ctx.cfg.pacientes.outro?.cpf].filter(
        (x): x is string => Boolean(x),
      );
      const segredos = [...ctx.segredosVistos].filter((s) => s.length >= 16);
      const erros = ctx.http.historico.filter((t) => t.status >= 400);
      // Linha de pilha do V8, do Java ou do .NET: "at função (arquivo:linha:coluna)", "at pacote.Classe(Arquivo.java:12)".
      const pilha = /(?:^|\\n|\n)\s*at [\w$.<>[\]]+ ?\(?[^\s()]+:\d+(?::\d+)?\)?/;
      for (const t of erros) {
        for (const cpf of cpfs)
          if (t.texto.includes(cpf))
            falhar(`CPF de paciente em resposta de erro: ${t.metodo} ${t.url} ${t.status}`);
        for (const s of segredos)
          if (t.texto.includes(s))
            falhar(`token em resposta de erro: ${t.metodo} ${t.url} ${t.status}`);
        if (pilha.test(t.texto))
          falhar(`rastro de pilha em resposta de erro: ${t.metodo} ${t.url} ${t.status}`);
      }
      esperar(erros.length > 0, 'nenhuma resposta de erro na execução');
      r.evidencia(
        `${erros.length} respostas de erro inspecionadas, sem CPF, token ou rastro de pilha`,
      );
    },
    fase: 'final',
    id: 'ERR-004',
    titulo: 'Nenhuma resposta de erro contém dado pessoal, CPF, token ou rastro de pilha',
  },
  {
    executar: async (ctx, r: Relator) => {
      const token = await ctx.tokenDeProvedor(ctx.cliente('principal'), 'locations.read');
      let limitada;
      for (let i = 0; i < 300; i++) {
        const resp = await ctx.http.requisitar(`${ctx.fhirBase}/Location?status=active&_count=1`, {
          cabecalhos: {
            accept: 'application/fhir+json',
            authorization: `Bearer ${token}`,
            'x-fapi-interaction-id': randomUUID(),
          },
          credencial: ctx.cliente('principal').credenciais[0]!,
          semHistorico: true,
        });
        if (resp.status === 429 || resp.status === 503) {
          limitada = resp;
          break;
        }
      }
      const observadas = ctx.http.historico.filter((t) => t.status === 429 || t.status === 503);
      if (!limitada && observadas.length === 0)
        naoVerificavel(
          'nenhum 429 ou 503 provocado com 300 chamadas seguidas; o limite de chamadas é opcional (seção 7.11)',
        );
      if (limitada) {
        const espera = cabecalhoUnico(limitada, 'retry-after');
        esperar(
          espera && (/^\d+$/.test(espera) || !Number.isNaN(Date.parse(espera))),
          `${limitada.status} sem Retry-After válido`,
        );
        erroApi(
          limitada,
          limitada.status,
          limitada.status === 429 ? 'RATE_LIMITED' : 'PROVIDER_UNAVAILABLE',
        );
        r.evidencia(`${limitada.status} ${codigoDoErro(limitada) ?? ''} com Retry-After ${espera}`);
      }
      for (const t of observadas)
        esperar(t.cabecalhos['retry-after'], `${t.status} sem Retry-After em ${t.url}`);
      if (!ctx.temControle) {
        r.marcarParcial(
          'sem interface de controle para simular indisponibilidade, o 503 não foi provocado',
        );
        return;
      }
      await ctx.controle('POST', '/_controle/indisponibilidade', { ativo: true });
      try {
        const api = await ctx.fhir(token, 'Location?status=active');
        erroApi(api, 503, 'PROVIDER_UNAVAILABLE');
        const espera = cabecalhoUnico(api, 'retry-after');
        esperar(
          espera && (/^\d+$/.test(espera) || !Number.isNaN(Date.parse(espera))),
          '503 da API sem Retry-After válido',
        );
        const tok = await ctx.tokenCc(ctx.cliente('principal'), ['catalog.read']);
        esperar(
          tok.status === 503 &&
            (tok.json as { error?: string } | undefined)?.error === 'temporarily_unavailable',
          `token em manutenção: ${resumo(tok)}`,
        );
        esperar(cabecalhoUnico(tok, 'retry-after'), '503 do endpoint de token sem Retry-After');
        r.evidencia(
          `indisponibilidade simulada: API 503 PROVIDER_UNAVAILABLE e token 503 temporarily_unavailable, com Retry-After ${espera}`,
        );
      } finally {
        await ctx.controle('POST', '/_controle/indisponibilidade', { ativo: false });
      }
    },
    id: 'ERR-005',
    titulo: '429 e 503 trazem Retry-After',
  },
  {
    executar: async (ctx, r) => {
      const c = ctx.cliente('principal');
      const limite = (valor: string | undefined): boolean => {
        if (!valor) return true;
        if (/^\d+$/.test(valor)) return Number(valor) <= 86400;
        const ms = Date.parse(valor);
        return !Number.isNaN(ms) && ms - ctx.agoraMs() <= 86400_000 + 5000;
      };
      let observados = 0;
      const token = await ctx.tokenDeProvedor(c, 'consent.manage');
      // 429 no DELETE, se o provedor limitar chamadas.
      for (let i = 0; i < 300; i++) {
        const resp = await ctx.http.requisitar(
          `${ctx.apiBase}/consents/consentimento-inexistente-err-007`,
          {
            cabecalhos: {
              accept: 'application/json',
              authorization: `Bearer ${token}`,
              'x-fapi-interaction-id': randomUUID(),
            },
            credencial: c.credenciais[0]!,
            metodo: 'DELETE',
            semHistorico: true,
          },
        );
        if (resp.status === 429 || resp.status === 503) {
          esperar(
            limite(cabecalhoUnico(resp, 'retry-after')),
            `DELETE ${resp.status} com Retry-After ${cabecalhoUnico(resp, 'retry-after')}`,
          );
          observados++;
          r.evidencia(
            `DELETE ${resp.status}: Retry-After ${cabecalhoUnico(resp, 'retry-after') ?? '(ausente)'}`,
          );
          break;
        }
      }
      if (ctx.temControle) {
        await ctx.controle('POST', '/_controle/indisponibilidade', { ativo: true });
        try {
          const del = await ctx.consentimentos(
            'DELETE',
            '/consentimento-inexistente-err-007',
            token,
            { credencial: c.credenciais[0]! },
          );
          const tok = await ctx.tokenCc(c, ['consent.manage']);
          for (const [nome, resp] of [
            ['DELETE', del],
            ['token consent.manage', tok],
          ] as const) {
            if (resp.status !== 429 && resp.status !== 503) continue;
            esperar(
              limite(cabecalhoUnico(resp, 'retry-after')),
              `${nome} ${resp.status} com Retry-After ${cabecalhoUnico(resp, 'retry-after')}`,
            );
            observados++;
            r.evidencia(
              `${nome} ${resp.status}: Retry-After ${cabecalhoUnico(resp, 'retry-after') ?? '(ausente)'}`,
            );
          }
        } finally {
          await ctx.controle('POST', '/_controle/indisponibilidade', { ativo: false });
        }
      }
      if (observados === 0)
        naoVerificavel(
          'nenhum 429 ou 503 provocado no DELETE de consentimento nem no token com consent.manage',
        );
      if (!ctx.temControle) r.marcarParcial('sem interface de controle, o 503 não foi provocado');
    },
    id: 'ERR-007',
    titulo:
      'Retry-After de no máximo 86400 no DELETE de consentimento e no token com consent.manage',
  },
  {
    executar: async (ctx, r) => {
      const c = ctx.cliente('principal');
      const id = await ctx.novoConsentimento(c);
      const { resposta, state } = await ctx.par(c, id);
      const ru =
        (resposta.json as { request_uri?: string }).request_uri ??
        falhar(`PAR recusado: ${resumo(resposta)}`);
      const j = await ctx.jornada(c.clientId, ru, ctx.paciente('principal'), 'recusar');
      const u = new URL(j.location ?? falhar('recusa sem redirecionamento'));
      esperar(u.searchParams.get('error') === 'access_denied', 'sem error=access_denied');
      esperar(
        u.searchParams.get('iss') === ctx.issuer,
        `iss na resposta de erro: ${u.searchParams.get('iss') ?? '(ausente)'}`,
      );
      esperar(
        u.searchParams.get('state') === state,
        'state ausente ou diferente na resposta de erro',
      );
      if (j.origem === 'controle')
        r.marcarParcial(
          'o redirecionamento veio da interface de controle, e não das páginas reais (configure jornada_por_formulario)',
        );
      r.evidencia('error=access_denied com state e iss');
    },
    id: 'ERR-006',
    titulo: 'Respostas de erro do endpoint de autorização trazem iss',
  },
];
