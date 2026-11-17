// SEG: transporte e chaves (seção 9.3).

import { getCiphers } from 'node:tls';
import { cabecalhoUnico, type Resposta } from '../http.ts';
import { esperar, falhar, naoVerificavel } from '../resultado.ts';
import { codigoDoErro, erroOAuth, resumo } from '../verificacoes.ts';
import type { Teste } from './tipos.ts';

const SUITES_PERMITIDAS = ['ECDHE-RSA-AES128-GCM-SHA256', 'ECDHE-RSA-AES256-GCM-SHA384', 'ECDHE-ECDSA-AES128-GCM-SHA256', 'ECDHE-ECDSA-AES256-GCM-SHA384'];

/** Todas as suítes TLS 1.2 que o OpenSSL do Node conhece, menos as quatro da seção 7.5. */
function suitesProibidas(): string[] {
  return getCiphers()
    .filter((c) => !c.startsWith('tls_'))
    .map((c) => c.toUpperCase())
    .filter((c) => !SUITES_PERMITIDAS.includes(c));
}

/** Recusa de versão: o servidor manda o alerta protocol_version, ou o cliente vê versão incompatível. */
function recusaDeVersao(erro: string): boolean {
  return /PROTOCOL_VERSION|protocol version|unsupported protocol|wrong version number|version too low|ECONNRESET/i.test(erro);
}

function recusado(r: Resposta | { erro: string }): boolean {
  if ('erro' in r) return true;
  return r.status === 401 || r.status === 403 || r.status === 400;
}

export const testesDeSeguranca: Teste[] = [
  {
    id: 'SEG-001',
    titulo: 'Recusa TLS abaixo de 1.2',
    executar: async (ctx, r) => {
      const c = ctx.cliente('principal');
      const alvos = [ctx.issuer, ctx.endpoint('authorization_endpoint'), ctx.endpoint('token_endpoint'), ctx.endpoint('pushed_authorization_request_endpoint'), ctx.fhirBase, ctx.apiBase];
      for (const url of new Set(alvos.map((u) => new URL(u).origin))) {
        for (const versao of ['TLSv1', 'TLSv1.1'] as const) {
          const a = await ctx.http.aperto(url, { credencial: c.credenciais[0]!, minVersion: versao, maxVersion: versao, ciphers: 'DEFAULT:@SECLEVEL=0' });
          if (a.ok) falhar(`${url} aceitou ${versao} (${a.suite})`);
          esperar(recusaDeVersao(a.erro), `${url} com ${versao}: o aperto falhou por outro motivo, inconclusivo (${a.erro.slice(0, 120)})`);
        }
        const ok = await ctx.http.aperto(url, { credencial: c.credenciais[0]!, minVersion: 'TLSv1.2' });
        esperar(ok.ok, `${url} não completou o aperto TLS 1.2 ou superior: ${ok.ok ? '' : ok.erro}`);
        r.evidencia(`${url}: TLS 1.0 e 1.1 recusados com alerta de versão, ${ok.ok ? ok.versao : ''} aceito`);
      }
    },
  },
  {
    id: 'SEG-002',
    titulo: 'No TLS 1.2, endpoints entre servidores só com as quatro suítes da seção 7.5',
    executar: async (ctx, r) => {
      const c = ctx.cliente('principal');
      const origens = new Set([ctx.endpoint('token_endpoint'), ctx.endpoint('pushed_authorization_request_endpoint'), ctx.fhirBase, ctx.apiBase].map((u) => new URL(u).origin));
      const proibidas = suitesProibidas();
      for (const origem of origens) {
        const aceitas: string[] = [];
        let oferecidas = 0;
        for (const suite of proibidas) {
          const a = await ctx.http.aperto(origem, { credencial: c.credenciais[0]!, maxVersion: 'TLSv1.2', minVersion: 'TLSv1.2', ciphers: `${suite}:@SECLEVEL=0` });
          if (a.ok) aceitas.push(suite);
          else if (/NO_CIPHERS_AVAILABLE|no ciphers available/i.test(a.erro)) continue;
          oferecidas++;
        }
        esperar(aceitas.length === 0, `${origem} aceitou no TLS 1.2: ${aceitas.join(', ')}`);
        const negociadas: string[] = [];
        for (const suite of SUITES_PERMITIDAS) {
          const a = await ctx.http.aperto(origem, { credencial: c.credenciais[0]!, maxVersion: 'TLSv1.2', minVersion: 'TLSv1.2', ciphers: suite });
          if (a.ok) negociadas.push(a.suite);
        }
        r.evidencia(`${origem}: ${oferecidas} suítes fora da lista oferecidas e recusadas (as que o cliente não consegue oferecer não contam); TLS 1.2 com ${negociadas.join(', ') || 'nenhuma (só TLS 1.3)'}`);
      }
    },
  },
  {
    id: 'SEG-003',
    titulo: 'Exige certificado de cliente em PAR, token, consentimento e API FHIR',
    executar: async (ctx, r) => {
      const c = ctx.cliente('principal');
      const consentId = await ctx.novoConsentimento(c);
      const tentar = async (nome: string, f: () => Promise<Resposta>) => {
        let resp: Resposta | { erro: string };
        try {
          resp = await f();
        } catch (e) {
          resp = { erro: (e as Error).message };
        }
        esperar(recusado(resp), `${nome} sem certificado não foi recusado: ${'erro' in resp ? resp.erro : resumo(resp)}`);
        r.evidencia(`${nome}: ${'erro' in resp ? `aperto recusado (${resp.erro})` : `${resp.status} ${codigoDoErro(resp) ?? (resp.json as { error?: string } | undefined)?.error ?? ''}`}`);
      };
      await tentar('PAR', async () => (await ctx.par(c, consentId, { credencial: null })).resposta);
      await tentar('token', () => ctx.tokenCc(c, ['catalog.read'], { credencial: null }));
      const tokenDeConsentimento = await ctx.tokenDeProvedor(c, 'consent.manage');
      await tentar('consentimento', () => ctx.consentimentos('GET', `/${consentId}`, tokenDeConsentimento, { credencial: null }));
      const tokenDeCatalogo = await ctx.tokenDeProvedor(c, 'catalog.read');
      await tentar('API FHIR', () => ctx.fhir(tokenDeCatalogo, 'ActivityDefinition?status=active', { credencial: null }));
    },
  },
  {
    id: 'SEG-004',
    titulo: 'Recusa certificado de cliente fora do registro',
    executar: async (ctx, r) => {
      const fora = ctx.credencialNaoRegistrada;
      if (!fora) naoVerificavel('a configuração não traz um certificado de cliente fora do registro (certificado_nao_registrado)');
      const c = ctx.cliente('principal');
      let token: Resposta | { erro: string };
      try {
        token = await ctx.tokenCc(c, ['catalog.read'], { credencial: fora });
      } catch (e) {
        token = { erro: (e as Error).message };
      }
      if ('erro' in token) r.evidencia(`token: aperto recusado (${token.erro})`);
      else erroOAuth(token, 401, 'invalid_client');
      const valido = await ctx.tokenDeProvedor(c, 'catalog.read');
      let api: Resposta | { erro: string };
      try {
        api = await ctx.fhir(valido, 'ActivityDefinition?status=active', { credencial: fora });
      } catch (e) {
        api = { erro: (e as Error).message };
      }
      esperar('erro' in api || api.status === 401, `API com certificado fora do registro: ${'erro' in api ? '' : resumo(api)}`);
      r.evidencia('token e API com certificado fora do registro: recusados');
    },
  },
  {
    id: 'SEG-005',
    titulo: 'Recusa certificado de outro client_id que não o da asserção',
    executar: async (ctx, r) => {
      const a = ctx.cliente('principal');
      const b = ctx.cliente('secundario');
      erroOAuth(await ctx.tokenCc(a, ['catalog.read'], { credencial: b.credenciais[0]! }), 401, 'invalid_client');
      r.evidencia('asserção do cliente A com certificado do cliente B: 401 invalid_client');
    },
  },
  {
    id: 'SEG-006',
    titulo: 'Recusa token apresentado com certificado diferente do vinculado',
    executar: async (ctx, r) => {
      const c = ctx.cliente('principal');
      if (c.credenciais.length < 2) naoVerificavel('o cliente principal precisa de dois certificados registrados');
      const token = await ctx.tokenDeProvedor(c, 'catalog.read', c.credenciais[0]!);
      const resp = await ctx.fhir(token, 'ActivityDefinition?status=active', { credencial: c.credenciais[1]! });
      esperar(resp.status === 401, `token usado com o segundo certificado: ${resumo(resp)}`);
      const www = cabecalhoUnico(resp, 'www-authenticate') ?? '';
      esperar(/error="invalid_token"/.test(www), `WWW-Authenticate sem invalid_token: ${www}`);
      const mesmo = await ctx.fhir(token, 'ActivityDefinition?status=active', { credencial: c.credenciais[0]! });
      esperar(mesmo.status === 200, `com o certificado vinculado o token não funcionou: ${resumo(mesmo)}`);
      r.evidencia(`certificado 2: 401 ${codigoDoErro(resp) ?? ''}; certificado 1: 200`);
    },
  },
  {
    id: 'SEG-007',
    titulo: 'Recusa asserção com algoritmo diferente de PS256',
    executar: async (ctx, r) => {
      const c = ctx.cliente('principal');
      for (const alg of ['RS256', 'ES256', 'none']) {
        erroOAuth(await ctx.tokenCc(c, ['catalog.read'], { assercao: await ctx.assercao(c, { alg }) }), 401, 'invalid_client');
        r.evidencia(`${alg}: 401 invalid_client`);
      }
    },
  },
  {
    id: 'SEG-008',
    titulo: 'Endpoint de autorização sem CORS e com proteção contra rebaixamento para HTTP',
    executar: async (ctx, r) => {
      const url = ctx.endpoint('authorization_endpoint');
      const origem = 'https://outro-site.example';
      const get = await ctx.http.requisitar(url, { credencial: null, cabecalhos: { origin: origem } });
      esperar(!cabecalhoUnico(get, 'access-control-allow-origin'), 'GET com Origin devolveu Access-Control-Allow-Origin');
      const pre = await ctx.http.requisitar(url, { metodo: 'OPTIONS', credencial: null, cabecalhos: { origin: origem, 'access-control-request-method': 'GET' } });
      esperar(!cabecalhoUnico(pre, 'access-control-allow-origin'), 'pré-verificação CORS devolveu Access-Control-Allow-Origin');
      const hsts = cabecalhoUnico(get, 'strict-transport-security');
      if (!hsts) falhar('sem Strict-Transport-Security no endpoint de autorização');
      const idade = /max-age=(\d+)/.exec(hsts)?.[1];
      esperar(idade && Number(idade) > 0, `Strict-Transport-Security sem max-age positivo: ${hsts}`);
      r.evidencia(`sem cabeçalhos CORS; ${hsts}`);
    },
  },
];
