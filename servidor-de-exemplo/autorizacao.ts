// Servidor de autorização do provedor simulado (seções 5.2, 5.3 e capítulo 7):
// metadados, PAR, autorização com login e tela de consentimento, token,
// revogação de token e JWKS.

import { createHash } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { ESCOPOS_DE_PACIENTE, ESCOPOS_DE_PROVEDOR, TODOS_OS_ESCOPOS, type Escopo } from '../comum/registro.ts';
import { autenticarCliente } from './autenticacao.ts';
import { PACIENTES, SENHA_DE_TESTE, type Paciente } from './dados.ts';
import { enviarHtml, enviarJson, enviarVazio, ErroOAuth, lerCorpo, lerFormulario, novoId, tipoDoConteudo } from './http.ts';
import { paginaDeCompartilhamentos, paginaDeErro, paginaDeLogin, telaDeConsentimento } from './paginas.ts';
import { segredo, type PedidoPar, type Provedor } from './provedor.ts';

const CABECALHOS_SEM_CACHE = { 'Cache-Control': 'no-store', Pragma: 'no-cache' };
const VALIDADE_DO_REQUEST_URI_S = 300;

export function caminhoDosMetadados(issuer: string): string {
  const u = new URL(issuer);
  const caminho = u.pathname === '/' ? '' : u.pathname.replace(/\/$/, '');
  return `/.well-known/oauth-authorization-server${caminho}`;
}

export function metadados(provedor: Provedor): Record<string, unknown> {
  const issuer = provedor.issuer;
  const base = issuer.replace(/\/$/, '');
  const mtls = provedor.urlMtls;
  const doc: Record<string, unknown> = {
    issuer,
    authorization_endpoint: `${base}/authorize`,
    token_endpoint: `${mtls}/token`,
    pushed_authorization_request_endpoint: `${mtls}/par`,
    revocation_endpoint: `${mtls}/revoke`,
    jwks_uri: `${base}/jwks`,
    require_pushed_authorization_requests: true,
    authorization_response_iss_parameter_supported: true,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token', 'client_credentials'],
    scopes_supported: provedor.participante.provider!.scopes_supported,
    token_endpoint_auth_methods_supported: ['private_key_jwt'],
    token_endpoint_auth_signing_alg_values_supported: ['PS256'],
    revocation_endpoint_auth_methods_supported: ['private_key_jwt'],
    revocation_endpoint_auth_signing_alg_values_supported: ['PS256'],
    code_challenge_methods_supported: ['S256'],
    tls_client_certificate_bound_access_tokens: true,
  };
  if (provedor.violacao('metadados-sem-iss')) delete doc.authorization_response_iss_parameter_supported;
  return doc;
}

function enviarErroOAuth(res: ServerResponse, erro: ErroOAuth, provedor?: Provedor) {
  const codigo = provedor?.violacao('erro-oauth-inventado') && erro.erro === 'invalid_client' ? 'client_not_trusted' : erro.erro;
  enviarJson(res, erro.status, { error: codigo, ...(erro.descricao ? { error_description: erro.descricao } : {}) }, CABECALHOS_SEM_CACHE);
}

async function lerFormularioOAuth(req: IncomingMessage): Promise<Map<string, string[]>> {
  if (tipoDoConteudo(req) !== 'application/x-www-form-urlencoded') {
    throw new ErroOAuth(400, 'invalid_request', 'Content-Type precisa ser application/x-www-form-urlencoded');
  }
  try {
    return lerFormulario(await lerCorpo(req));
  } catch {
    throw new ErroOAuth(400, 'invalid_request', 'corpo da requisição ilegível ou grande demais');
  }
}

function valor(form: Map<string, string[]>, nome: string, obrigatorio = false): string | undefined {
  const v = form.get(nome);
  if (v && v.length > 1) throw new ErroOAuth(400, 'invalid_request', `parâmetro repetido: ${nome}`);
  if (obrigatorio && (!v || v[0] === '')) throw new ErroOAuth(400, 'invalid_request', `parâmetro ausente: ${nome}`);
  return v?.[0];
}

// PAR ------------------------------------------------------------------------

export async function tratarPar(provedor: Provedor, req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    if (req.method !== 'POST') throw new ErroOAuth(400, 'invalid_request', 'use POST');
    const form = await lerFormularioOAuth(req);
    const cliente = await autenticarCliente(provedor, req, form);
    if (provedor.registro.modo() !== 'normal') {
      throw new ErroOAuth(400, 'unauthorized_client', 'registro de participantes expirado: novas autorizações recusadas');
    }
    if (form.has('request') || form.has('request_uri')) throw new ErroOAuth(400, 'invalid_request', 'objeto de requisição não é usado');
    const responseType = valor(form, 'response_type', true);
    if (responseType !== 'code' && !provedor.violacao('aceita-response-type-token')) throw new ErroOAuth(400, 'invalid_request', 'response_type precisa ser code');
    const redirectUri = valor(form, 'redirect_uri', true)!;
    const registrados = cliente.receptor.receiver!.redirect_uris;
    const redirectValido = registrados.includes(redirectUri) ||
      (provedor.violacao('redirect-uri-com-parametro') && registrados.some((r) => redirectUri.startsWith(r)));
    if (!redirectValido) throw new ErroOAuth(400, 'invalid_request', 'redirect_uri não é idêntico a um dos registrados');
    const state = valor(form, 'state', true)!;
    const codeChallenge = valor(form, 'code_challenge');
    const metodo = valor(form, 'code_challenge_method');
    if (!provedor.violacao('par-sem-pkce') || codeChallenge !== undefined) {
      if (!codeChallenge || !/^[A-Za-z0-9_-]{43}$/.test(codeChallenge)) throw new ErroOAuth(400, 'invalid_request', 'code_challenge ausente ou malformado');
      if (metodo !== 'S256') throw new ErroOAuth(400, 'invalid_request', 'code_challenge_method precisa ser S256');
    }
    const escopos = (valor(form, 'scope', true) ?? '').split(' ').filter(Boolean);
    const dinamicos = escopos.filter((s) => s.startsWith('consent:'));
    if (dinamicos.length !== 1) throw new ErroOAuth(400, 'invalid_request', 'escopo consent:{id} ausente ou repetido');
    const consentId = dinamicos[0]!.slice('consent:'.length);
    const consentimento = provedor.consentimento(consentId);
    if (!consentimento || (consentimento.client_id !== cliente.clientId && !provedor.violacao('par-aceita-consentimento-de-outro')) || consentimento.status !== 'AWAITING_AUTHORISATION') {
      throw new ErroOAuth(400, 'invalid_request', 'consent:{id} desconhecido, de outro cliente ou fora de AWAITING_AUTHORISATION');
    }
    const outros = escopos.filter((s) => !s.startsWith('consent:'));
    if (outros.length === 0) throw new ErroOAuth(400, 'invalid_request', 'nenhum escopo do consentimento pedido');
    if (new Set(outros).size !== outros.length) throw new ErroOAuth(400, 'invalid_request', 'escopo repetido');
    for (const s of outros) {
      if (!(TODOS_OS_ESCOPOS as readonly string[]).includes(s)) throw new ErroOAuth(400, 'invalid_scope', 'escopo desconhecido');
      if ((ESCOPOS_DE_PROVEDOR as readonly string[]).includes(s)) throw new ErroOAuth(400, 'invalid_scope', 'escopo de provedor em requisição de autorização');
      if (!consentimento.scopes.includes(s as Escopo) && !provedor.violacao('par-aceita-escopo-fora-do-consentimento')) throw new ErroOAuth(400, 'invalid_scope', 'escopo fora do consentimento');
    }
    const par: PedidoPar = {
      requestUri: `urn:ietf:params:oauth:request_uri:${segredo()}`,
      clientId: cliente.clientId,
      redirectUri,
      consentId,
      escopos: outros,
      state,
      ...(codeChallenge ? { codeChallenge } : {}),
      expiraEm: provedor.relogio.agoraMs() + VALIDADE_DO_REQUEST_URI_S * 1000,
      usado: false,
    };
    provedor.pedidosPar.set(par.requestUri, par);
    enviarJson(res, 201, { request_uri: par.requestUri, expires_in: VALIDADE_DO_REQUEST_URI_S }, CABECALHOS_SEM_CACHE);
  } catch (e) {
    if (e instanceof ErroOAuth) return enviarErroOAuth(res, e, provedor);
    throw e;
  }
}

// Autorização ----------------------------------------------------------------

class ErroDePagina extends Error {}

function pedidoParaAutorizar(provedor: Provedor, clientId: string | undefined, requestUri: string | undefined): PedidoPar {
  if (!requestUri) throw new ErroDePagina('A requisição de autorização precisa vir de um PAR (request_uri ausente).');
  const par = provedor.pedidosPar.get(requestUri);
  if (!par) throw new ErroDePagina('request_uri desconhecido.');
  if (!clientId || clientId !== par.clientId) throw new ErroDePagina('client_id desconhecido ou diferente do PAR.');
  if (par.usado && !provedor.violacao('request-uri-reutilizavel')) throw new ErroDePagina('request_uri já usado.');
  if (provedor.relogio.agoraMs() > par.expiraEm) throw new ErroDePagina('request_uri expirado.');
  const c = provedor.consentimento(par.consentId);
  if (!c || c.status !== 'AWAITING_AUTHORISATION') {
    if (!(c && provedor.violacao('request-uri-reutilizavel'))) throw new ErroDePagina('O consentimento não está mais à espera de autorização.');
  }
  return par;
}

export function autenticarPaciente(usuario: string | undefined, senha: string | undefined): Paciente | undefined {
  const p = PACIENTES.find((x) => x.usuario === usuario?.trim().toLowerCase());
  return p && senha === SENHA_DE_TESTE ? p : undefined;
}

export interface Redirecionamento {
  status: number;
  location: string;
}

function redirecionar(provedor: Provedor, par: PedidoPar, params: Record<string, string>): Redirecionamento {
  const destino = new URL(par.redirectUri);
  for (const [k, v] of Object.entries(params)) destino.searchParams.append(k, v);
  destino.searchParams.append('state', par.state);
  if (!provedor.violacao('iss-ausente-na-resposta')) destino.searchParams.append('iss', provedor.issuer);
  return { status: provedor.violacao('redirecionamento-307') ? 307 : 303, location: destino.toString() };
}

/**
 * Conclui a jornada: paciente autenticado aprova ou recusa. É o mesmo caminho da
 * tela de consentimento e da interface de controle de teste.
 */
export function concluirAutorizacao(provedor: Provedor, par: PedidoPar, paciente: Paciente, decisao: 'aprovar' | 'recusar'): Redirecionamento {
  const c = provedor.consentimento(par.consentId);
  if (!c) throw new ErroDePagina('Consentimento desconhecido.');
  if (c.status !== 'AWAITING_AUTHORISATION' && !provedor.violacao('request-uri-reutilizavel')) {
    throw new ErroDePagina('O consentimento não está mais à espera de autorização.');
  }
  par.usado = true;
  if (c.status !== 'AWAITING_AUTHORISATION') {
    // Só no modo de violação: emite outro código para o mesmo consentimento.
    const codigo = provedor.emitirCodigo(par, c);
    return redirecionar(provedor, par, { code: codigo.code });
  }
  if (!paciente.cpf) {
    provedor.transicionar(c, 'REJECTED', 'PATIENT_WITHOUT_CPF', 'SYSTEM');
    return redirecionar(provedor, par, { error: 'access_denied' });
  }
  c.paciente = { cpf: paciente.cpf, fhirId: paciente.id };
  if (decisao === 'recusar') {
    provedor.transicionar(c, 'REJECTED', 'PATIENT_REJECTED', 'PROVIDER');
    return redirecionar(provedor, par, { error: 'access_denied' });
  }
  provedor.transicionar(c, 'AUTHORISED');
  const codigo = provedor.emitirCodigo(par, c);
  return redirecionar(provedor, par, { code: codigo.code, ...(provedor.violacao('cpf-no-redirecionamento') ? { cpf: paciente.cpf } : {}) });
}

export function iniciarAutorizacaoPorControle(provedor: Provedor, clientId: string, requestUri: string): PedidoPar {
  return pedidoParaAutorizar(provedor, clientId, requestUri);
}

export async function tratarAutorizacao(provedor: Provedor, req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  try {
    if (url.pathname.endsWith('/authorize') && req.method === 'GET') {
      const par = pedidoParaAutorizar(provedor, url.searchParams.get('client_id') ?? undefined, url.searchParams.get('request_uri') ?? undefined);
      const transacao = { id: segredo(), requestUri: par.requestUri, criadaEm: provedor.relogio.agoraMs() };
      provedor.transacoes.set(transacao.id, transacao);
      return enviarHtml(res, 200, paginaDeLogin(`${url.pathname}/login`, { transacao: transacao.id }));
    }
    if (req.method !== 'POST') return enviarHtml(res, 405, paginaDeErro('Método não suportado.'), { Allow: 'GET' });
    if (tipoDoConteudo(req) !== 'application/x-www-form-urlencoded') return enviarHtml(res, 415, paginaDeErro('Formulário inválido.'));
    const form = lerFormulario(await lerCorpo(req));
    const transacao = provedor.transacoes.get(form.get('transacao')?.[0] ?? '');
    if (!transacao) throw new ErroDePagina('Sessão de autorização desconhecida ou expirada.');
    const par = provedor.pedidosPar.get(transacao.requestUri);
    if (!par) throw new ErroDePagina('request_uri desconhecido.');
    pedidoParaAutorizar(provedor, par.clientId, par.requestUri);

    if (url.pathname.endsWith('/authorize/login')) {
      const paciente = autenticarPaciente(form.get('usuario')?.[0], form.get('senha')?.[0]);
      if (!paciente) {
        return enviarHtml(res, 200, paginaDeLogin(url.pathname, { transacao: transacao.id }, 'Usuário ou senha incorretos.'));
      }
      transacao.pacienteId = paciente.id;
      if (!paciente.cpf) {
        provedor.transacoes.delete(transacao.id);
        const r = concluirAutorizacao(provedor, par, paciente, 'recusar');
        return enviarVazio(res, r.status, { Location: r.location });
      }
      const c = provedor.consentimento(par.consentId)!;
      const receptor = provedor.registro.receptor(par.clientId);
      return enviarHtml(
        res,
        200,
        telaDeConsentimento({
          acao: url.pathname.replace(/\/login$/, '/decisao'),
          transacao: transacao.id,
          nomeDoReceptor: receptor?.receiver?.client_name ?? par.clientId,
          escopos: par.escopos,
          finalidade: c.purpose,
          expiracao: new Date(c.expiraEm).toISOString().replace(/\.\d{3}Z$/, 'Z'),
          nomeDoPaciente: `${paciente.nome.given.join(' ')} ${paciente.nome.family}`,
        }),
      );
    }
    if (url.pathname.endsWith('/authorize/decisao')) {
      const paciente = PACIENTES.find((p) => p.id === transacao.pacienteId);
      if (!paciente) throw new ErroDePagina('Entre antes de decidir.');
      const decisao = form.get('decisao')?.[0];
      if (decisao !== 'aprovar' && decisao !== 'recusar') throw new ErroDePagina('Decisão inválida.');
      provedor.transacoes.delete(transacao.id);
      const r = concluirAutorizacao(provedor, par, paciente, decisao);
      return enviarVazio(res, r.status, { Location: r.location });
    }
    return enviarHtml(res, 404, paginaDeErro('Página não encontrada.'));
  } catch (e) {
    if (e instanceof ErroDePagina) return enviarHtml(res, 400, paginaDeErro(e.message));
    throw e;
  }
}

// Token ----------------------------------------------------------------------

function s256(verificador: string): string {
  return createHash('sha256').update(verificador, 'ascii').digest('base64url');
}

export async function tratarToken(provedor: Provedor, req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    if (req.method !== 'POST') throw new ErroOAuth(400, 'invalid_request', 'use POST');
    const form = await lerFormularioOAuth(req);
    const cliente = await autenticarCliente(provedor, req, form);
    const grantType = valor(form, 'grant_type', true);
    const modo = provedor.registro.modo();
    const receptor = cliente.receptor.receiver!;
    const suportados = provedor.participante.provider!.scopes_supported;

    if (grantType === 'client_credentials') {
      const escopos = (valor(form, 'scope', true) ?? '').split(' ').filter(Boolean);
      if (escopos.length === 0) throw new ErroOAuth(400, 'invalid_request', 'scope ausente');
      if (modo === 'bloqueado' || (modo === 'restrito' && !(escopos.length === 1 && escopos[0] === 'consent.manage'))) {
        throw new ErroOAuth(400, 'unauthorized_client', 'registro de participantes expirado');
      }
      for (const s of escopos) {
        const dePaciente = (ESCOPOS_DE_PACIENTE as readonly string[]).includes(s);
        if (dePaciente && provedor.violacao('escopo-de-paciente-em-client-credentials')) continue;
        if (!(ESCOPOS_DE_PROVEDOR as readonly string[]).includes(s)) throw new ErroOAuth(400, 'invalid_scope', 'escopo desconhecido ou de paciente em client_credentials');
        if (s === 'schedule.read' && provedor.violacao('recusa-schedule-read')) throw new ErroOAuth(400, 'invalid_scope', 'schedule.read não atendido');
        if (!receptor.scopes_allowed.includes(s as Escopo) || !suportados.includes(s as Escopo)) throw new ErroOAuth(400, 'invalid_scope', 'escopo fora do permitido ao receptor');
      }
      if (escopos.includes('consent.manage') && escopos.length > 1) throw new ErroOAuth(400, 'invalid_scope', 'consent.manage vai sempre sozinho');
      if (new Set(escopos).size !== escopos.length) throw new ErroOAuth(400, 'invalid_request', 'escopo repetido');
      const token = provedor.emitirToken({ tipo: 'provedor', clientId: cliente.clientId, escopos, x5t: cliente.x5t });
      const corpo: Record<string, unknown> = { access_token: token.token, token_type: 'Bearer', expires_in: provedor.validadeDoToken(), scope: escopos.join(' ') };
      if (provedor.violacao('refresh-em-client-credentials')) corpo.refresh_token = segredo();
      return enviarJson(res, 200, corpo, CABECALHOS_SEM_CACHE);
    }

    if (grantType === 'authorization_code') {
      if (modo !== 'normal') throw new ErroOAuth(400, 'unauthorized_client', 'registro de participantes expirado');
      const code = valor(form, 'code', true)!;
      const redirectUri = valor(form, 'redirect_uri', true)!;
      const verificador = valor(form, 'code_verifier', true)!;
      const codigo = provedor.codigos.get(code);
      if (!codigo || codigo.clientId !== cliente.clientId) throw new ErroOAuth(400, 'invalid_grant', 'código desconhecido ou de outro cliente');
      if (codigo.usado && !provedor.violacao('codigo-reutilizavel')) {
        // RFC 6749, seção 4.1.2: código repetido invalida o que ele emitiu.
        for (const t of codigo.tokensEmitidos) {
          const at = provedor.tokens.get(t);
          if (at) at.revogado = true;
          const rt = provedor.refreshTokens.get(t);
          if (rt) rt.revogado = true;
        }
        throw new ErroOAuth(400, 'invalid_grant', 'código já usado');
      }
      if (provedor.relogio.agoraMs() > codigo.expiraEm && !provedor.violacao('codigo-reutilizavel')) {
        throw new ErroOAuth(400, 'invalid_grant', 'código expirado');
      }
      if (codigo.redirectUri !== redirectUri) throw new ErroOAuth(400, 'invalid_grant', 'redirect_uri diferente do PAR');
      if (!/^[A-Za-z0-9._~-]{43,128}$/.test(verificador)) throw new ErroOAuth(400, 'invalid_grant', 'code_verifier malformado');
      if (codigo.codeChallenge && s256(verificador) !== codigo.codeChallenge && !provedor.violacao('pkce-ignorado')) {
        throw new ErroOAuth(400, 'invalid_grant', 'code_verifier não confere');
      }
      const c = provedor.consentimento(codigo.consentId);
      if (!c || c.status !== 'AUTHORISED') throw new ErroOAuth(400, 'invalid_grant', 'consentimento fora de AUTHORISED');
      codigo.usado = true;
      delete c.codigoPendente;
      const escopos = [`consent:${c.consent_id}`, ...codigo.escopos];
      const token = provedor.emitirToken({ tipo: 'paciente', clientId: cliente.clientId, escopos, consentId: c.consent_id, x5t: cliente.x5t });
      const refresh = { token: segredo(), clientId: cliente.clientId, consentId: c.consent_id, escopos, revogado: false };
      provedor.refreshTokens.set(refresh.token, refresh);
      codigo.tokensEmitidos.push(token.token, refresh.token);
      const corpo: Record<string, unknown> = {
        access_token: token.token,
        token_type: 'Bearer',
        expires_in: provedor.validadeDoToken(),
        refresh_token: refresh.token,
        scope: escopos.join(' '),
      };
      if (provedor.violacao('cpf-na-resposta-do-token')) corpo.patient_cpf = c.paciente?.cpf;
      return enviarJson(res, 200, corpo, CABECALHOS_SEM_CACHE);
    }

    if (grantType === 'refresh_token') {
      // Leitura conservadora: com o registro expirado, a renovação também é recusada (seção 6.2.1).
      if (modo !== 'normal') throw new ErroOAuth(400, 'unauthorized_client', 'registro de participantes expirado');
      const valorDoRefresh = valor(form, 'refresh_token', true)!;
      const refresh = provedor.refreshTokens.get(valorDoRefresh);
      if (!refresh || refresh.revogado || refresh.clientId !== cliente.clientId) throw new ErroOAuth(400, 'invalid_grant', 'refresh token inválido');
      const c = provedor.consentimento(refresh.consentId);
      if (!c || c.status !== 'AUTHORISED') {
        if (!provedor.violacao('revogacao-nao-invalida-tokens')) throw new ErroOAuth(400, 'invalid_grant', 'consentimento fora de AUTHORISED');
      }
      let escopos = refresh.escopos;
      const pedido = valor(form, 'scope');
      if (pedido !== undefined) {
        const lista = pedido.split(' ').filter(Boolean);
        if (lista.some((s) => !refresh.escopos.includes(s))) throw new ErroOAuth(400, 'invalid_scope', 'escopo fora do original');
        escopos = lista;
      }
      const token = provedor.emitirToken({ tipo: 'paciente', clientId: cliente.clientId, escopos, consentId: refresh.consentId, x5t: cliente.x5t });
      const corpo: Record<string, unknown> = { access_token: token.token, token_type: 'Bearer', expires_in: provedor.validadeDoToken(), scope: escopos.join(' ') };
      if (provedor.violacao('refresh-com-rotacao')) {
        const novo = { ...refresh, token: segredo() };
        provedor.refreshTokens.set(novo.token, novo);
        corpo.refresh_token = novo.token;
      }
      return enviarJson(res, 200, corpo, CABECALHOS_SEM_CACHE);
    }

    if (grantType === 'password' && provedor.violacao('aceita-password')) {
      const token = provedor.emitirToken({ tipo: 'provedor', clientId: cliente.clientId, escopos: [], x5t: cliente.x5t });
      return enviarJson(res, 200, { access_token: token.token, token_type: 'Bearer', expires_in: provedor.validadeDoToken() }, CABECALHOS_SEM_CACHE);
    }
    throw new ErroOAuth(400, 'unsupported_grant_type', 'concessão não suportada');
  } catch (e) {
    if (e instanceof ErroOAuth) return enviarErroOAuth(res, e, provedor);
    throw e;
  }
}

// Revogação de token (RFC 7009) ---------------------------------------------

export async function tratarRevogacaoDeToken(provedor: Provedor, req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    if (req.method !== 'POST') throw new ErroOAuth(400, 'invalid_request', 'use POST');
    const form = await lerFormularioOAuth(req);
    const cliente = await autenticarCliente(provedor, req, form);
    const token = valor(form, 'token', true)!;
    const at = provedor.tokens.get(token);
    if (at && at.clientId === cliente.clientId) at.revogado = true;
    const rt = provedor.refreshTokens.get(token);
    if (rt && rt.clientId === cliente.clientId) rt.revogado = true;
    enviarVazio(res, 200, CABECALHOS_SEM_CACHE);
  } catch (e) {
    if (e instanceof ErroOAuth) return enviarErroOAuth(res, e, provedor);
    throw e;
  }
}

// Página de consentimentos do provedor (consent_management_uri) -----------

export async function tratarCompartilhamentos(provedor: Provedor, req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  const base = new URL(provedor.participante.provider!.consent_management_uri).pathname;
  if (req.method === 'GET' && url.pathname === base) {
    return enviarHtml(res, 200, paginaDeLogin(`${base}/entrar`, {}));
  }
  if (req.method !== 'POST') return enviarHtml(res, 405, paginaDeErro('Método não suportado.'));
  const form = lerFormulario(await lerCorpo(req));
  let pacienteId: string | undefined;
  let sessaoId: string | undefined;
  if (url.pathname === `${base}/entrar`) {
    const paciente = autenticarPaciente(form.get('usuario')?.[0], form.get('senha')?.[0]);
    if (!paciente) return enviarHtml(res, 200, paginaDeLogin(`${base}/entrar`, {}, 'Usuário ou senha incorretos.'));
    sessaoId = segredo();
    provedor.sessoes.set(sessaoId, { id: sessaoId, pacienteId: paciente.id, criadaEm: provedor.relogio.agoraMs() });
    pacienteId = paciente.id;
  } else if (url.pathname === `${base}/revogar`) {
    const sessao = provedor.sessoes.get(form.get('sessao')?.[0] ?? '');
    if (!sessao) return enviarHtml(res, 400, paginaDeErro('Sessão expirada. Entre de novo.'));
    sessaoId = sessao.id;
    pacienteId = sessao.pacienteId;
    const consentId = form.get('consent_id')?.[0] ?? '';
    const c = provedor.consentimento(consentId);
    if (c?.paciente?.fhirId === pacienteId) provedor.revogarPeloPaciente(consentId);
  } else {
    return enviarHtml(res, 404, paginaDeErro('Página não encontrada.'));
  }
  const paciente = provedor.paciente(pacienteId)!;
  const linhas = [...provedor.consentimentos.values()]
    .filter((c) => {
      provedor.atualizarEstado(c);
      return c.status === 'AUTHORISED' && c.paciente?.fhirId === pacienteId;
    })
    .map((c) => ({
      consentId: c.consent_id,
      receptor: provedor.registro.receptor(c.client_id)?.receiver?.client_name ?? c.client_id,
      escopos: c.scopes,
      finalidade: c.purpose,
      expiracao: new Date(c.expiraEm).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
    }));
  return enviarHtml(res, 200, paginaDeCompartilhamentos(`${base}/revogar`, sessaoId, `${paciente.nome.given.join(' ')} ${paciente.nome.family}`, linhas));
}

export { ErroDePagina, novoId };
