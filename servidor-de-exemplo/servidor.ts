// Monta o servidor de exemplo: host público (autorização, metadados, páginas do
// paciente), host mTLS (PAR, token, consentimentos, FHIR) e interface de
// controle de teste.

import { readFileSync } from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { exportJWK, generateKeyPair, calculateJwkThumbprint } from 'jose';
import { tratarPagina, expirarPagamentos } from './agendamento.ts';
import { caminhoDosMetadados, metadados, tratarAutorizacao, tratarCompartilhamentos, tratarPar, tratarRevogacaoDeToken, tratarToken } from './autorizacao.ts';
import { Relogio, type ConfiguracaoDoServidor } from './configuracao.ts';
import { tratarConsentimentos } from './consentimentos.ts';
import { tratarControle } from './controle.ts';
import { tratarFhir } from './fhir.ts';
import { enviarFhir, enviarHtml, enviarJson, ErroDeApi, novoId, operationOutcome } from './http.ts';
import { paginaDeErro } from './paginas.ts';
import { Provedor } from './provedor.ts';
import { comTratamentoDeErros } from './recursos.ts';
import { RegistroDoProvedor } from './registro-do-provedor.ts';

/** As quatro suítes da seção 7.5 no TLS 1.2. No TLS 1.3 valem as suítes padrão. */
export const SUITES_TLS12 = [
  'ECDHE-RSA-AES128-GCM-SHA256',
  'ECDHE-RSA-AES256-GCM-SHA384',
  'ECDHE-ECDSA-AES128-GCM-SHA256',
  'ECDHE-ECDSA-AES256-GCM-SHA384',
].join(':');

const SUITES_FRACAS = 'AES128-SHA:AES256-SHA:ECDHE-RSA-AES128-SHA:ECDHE-RSA-AES256-SHA:AES128-GCM-SHA256:ECDHE-RSA-CHACHA20-POLY1305';

export interface ServidorEmExecucao {
  provedor: Provedor;
  enderecos: { publico: string; mtls: string; controle?: string };
  fechar: () => Promise<void>;
}

function cabecalhosComuns(res: ServerResponse, provedor: Provedor) {
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  // Date pelo relógio do provedor: um cliente pode usá-lo para ajustar as asserções (seção 7.11).
  res.setHeader('Date', provedor.relogio.agora().toUTCString());
}

export async function iniciarServidor(cfg: ConfiguracaoDoServidor, opcoes: { relogio?: Relogio } = {}): Promise<ServidorEmExecucao> {
  const log = (m: string) => {
    if (cfg.registrarEmLog) console.log(`[servidor-de-exemplo] ${m}`);
  };
  const relogio = opcoes.relogio ?? new Relogio();
  const registro = await RegistroDoProvedor.carregar(cfg, relogio);
  registro.aoAvisar = log;
  const provedor = new Provedor(cfg, relogio, registro, log);

  // Chave publicada no jwks_uri. Os tokens são opacos, então ela não assina nada (seção 5.3.6).
  const { publicKey } = await generateKeyPair('PS256', { modulusLength: 2048, extractable: true });
  const jwkPublico = await exportJWK(publicKey);
  const jwks = { keys: [{ ...jwkPublico, kid: await calculateJwkThumbprint(jwkPublico), use: 'sig', alg: 'PS256' }] };

  const tls = {
    key: readFileSync(cfg.tls.chave),
    cert: readFileSync(cfg.tls.certificado),
    minVersion: cfg.violacoes.has('aceita-tls-1-1') ? ('TLSv1.1' as const) : ('TLSv1.2' as const),
    ciphers: cfg.violacoes.has('aceita-tls-1-1')
      ? `${SUITES_TLS12}:ECDHE-RSA-AES128-SHA:@SECLEVEL=0`
      : cfg.violacoes.has('tls-com-suites-fracas') ? `${SUITES_TLS12}:${SUITES_FRACAS}` : SUITES_TLS12,
    honorCipherOrder: true,
  };

  const comCaptura = (tratar: (req: IncomingMessage, res: ServerResponse) => Promise<void>) => (req: IncomingMessage, res: ServerResponse) => {
    tratar(req, res).catch((e: unknown) => {
      log(`falha não tratada: ${(e as Error).stack ?? String(e)}`);
      if (!res.headersSent) {
        if (!res.hasHeader('x-fapi-interaction-id')) res.setHeader('x-fapi-interaction-id', novoId());
        enviarFhir(res, 500, operationOutcome(new ErroDeApi(500, 'INTERNAL_ERROR', 'exception', 'Falha interna.')));
      }
      else res.destroy();
    });
  };

  const publico = https.createServer(tls, comCaptura(async (req, res) => {
    cabecalhosComuns(res, provedor);
    const url = new URL(req.url ?? '/', provedor.issuer);
    const compartilhamentos = new URL(provedor.participante.provider!.consent_management_uri).pathname;
    if (provedor.violacao('cors-na-autorizacao') && url.pathname.startsWith('/authorize')) res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') return enviarHtml(res, 405, paginaDeErro('Método não suportado.'), { Allow: 'GET, POST' });
    if (req.method === 'GET' && url.pathname === caminhoDosMetadados(provedor.issuer)) {
      return enviarJson(res, 200, metadados(provedor), { 'Cache-Control': 'max-age=3600' });
    }
    if (req.method === 'GET' && url.pathname === '/jwks') return enviarJson(res, 200, jwks);
    if (url.pathname === '/authorize' || url.pathname.startsWith('/authorize/')) return tratarAutorizacao(provedor, req, res, url);
    if (url.pathname === compartilhamentos || url.pathname.startsWith(`${compartilhamentos}/`)) return tratarCompartilhamentos(provedor, req, res, url);
    if (url.pathname.startsWith('/pagamento/')) return tratarPagina(provedor, req, res, url);
    return enviarHtml(res, 404, paginaDeErro('Página não encontrada.'));
  }));

  const mtls = https.createServer({ ...tls, requestCert: true, rejectUnauthorized: false, ca: readFileSync(cfg.tls.caConfiavel) }, comCaptura(async (req, res) => {
    cabecalhosComuns(res, provedor);
    const url = new URL(req.url ?? '/', provedor.urlMtls);
    const api = new URL(provedor.apiBaseUrl).pathname.replace(/\/$/, '');
    const fhir = new URL(provedor.fhirBaseUrl).pathname.replace(/\/$/, '');
    if (provedor.emManutencao) {
      if (['/par', '/token', '/revoke'].includes(url.pathname)) {
        return enviarJson(res, 503, { error: 'temporarily_unavailable', error_description: 'manutenção simulada' }, provedor.violacao('sem-retry-after') ? { 'Cache-Control': 'no-store' } : { 'Retry-After': '30', 'Cache-Control': 'no-store' });
      }
      return comTratamentoDeErros(provedor, req, res, async () => {
        throw new ErroDeApi(503, 'PROVIDER_UNAVAILABLE', 'transient', 'Provedor em manutenção (simulada).', { cabecalhos: provedor.violacao('sem-retry-after') ? {} : { 'Retry-After': '30' } });
      });
    }
    if (url.pathname === '/par') return tratarPar(provedor, req, res);
    if (url.pathname === '/token') return tratarToken(provedor, req, res);
    if (url.pathname === '/revoke') return tratarRevogacaoDeToken(provedor, req, res);
    if (url.pathname === api || url.pathname.startsWith(`${api}/`)) return tratarConsentimentos(provedor, req, res, url);
    if (url.pathname === fhir || url.pathname.startsWith(`${fhir}/`)) {
      expirarPagamentos(provedor);
      provedor.dados.garantirAgendas(provedor.relogio.agoraMs());
      return tratarFhir(provedor, req, res, url);
    }
    return comTratamentoDeErros(provedor, req, res, async () => {
      throw new ErroDeApi(404, 'RESOURCE_NOT_FOUND', 'not-found', 'Endpoint inexistente.');
    });
  }));

  const controle = cfg.controle.habilitado
    ? http.createServer(comCaptura((req, res) => tratarControle(provedor, req, res)))
    : undefined;

  const escutar = (s: http.Server, porta: number, host: string) =>
    new Promise<void>((resolver, rejeitar) => {
      s.once('error', rejeitar);
      s.listen(porta, host, () => resolver());
    });
  await escutar(publico, cfg.portas.publica, cfg.enderecoDeEscuta);
  await escutar(mtls, cfg.portas.mtls, cfg.enderecoDeEscuta);
  if (controle) await escutar(controle, cfg.portas.controle, cfg.controle.enderecoDeEscuta);

  const intervalo = setInterval(() => {
    provedor.varrer();
    expirarPagamentos(provedor);
    registro.talvezRecarregar().catch((e: unknown) => log(`falha ao recarregar o registro: ${(e as Error).message}`));
  }, 2000);
  intervalo.unref();

  log(`emissor (issuer) ${provedor.issuer}`);
  log(`API FHIR ${provedor.fhirBaseUrl}`);
  log(`consentimentos ${provedor.apiBaseUrl}`);
  if (controle) log(`controle de teste em http://${cfg.controle.enderecoDeEscuta}:${cfg.portas.controle}/_controle`);
  if (cfg.violacoes.size) log(`ATENÇÃO: modo de violações ativo: ${[...cfg.violacoes].join(', ')}`);

  const fecharServidor = (s: http.Server) =>
    new Promise<void>((resolver) => {
      s.close(() => resolver());
      s.closeAllConnections();
    });
  return {
    provedor,
    enderecos: {
      publico: provedor.issuer,
      mtls: provedor.urlMtls,
      ...(controle ? { controle: `http://${cfg.controle.enderecoDeEscuta}:${cfg.portas.controle}` } : {}),
    },
    fechar: async () => {
      clearInterval(intervalo);
      await Promise.all([fecharServidor(publico), fecharServidor(mtls), ...(controle ? [fecharServidor(controle)] : [])]);
    },
  };
}
