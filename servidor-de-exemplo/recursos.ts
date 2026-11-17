// Servidor de recursos: conferências comuns aos endpoints de consentimento e à
// API FHIR (seções 5.1, 6.1, 6.3.1, 6.5 e 7.5). Segurança primeiro, conteúdo
// depois.

import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Participante } from '../comum/registro.ts';
import { x5tDaConexao } from './autenticacao.ts';
import { aceita, cabecalho, eUuid, enviarFhir, ErroDeApi, novoId, operationOutcome, tipoDoConteudo } from './http.ts';
import type { Provedor, TokenDeAcesso } from './provedor.ts';

export interface Acesso {
  receptor: Participante;
  clientId: string;
  token: TokenDeAcesso;
  x5t: string;
}

function erroDeToken(provedor: Provedor, status: number, codigo: string, issue: string, texto: string, erroBearer?: string, descricao?: string): ErroDeApi {
  let www = erroBearer ? `Bearer error="${erroBearer}"${descricao ? `, error_description="${descricao}"` : ''}` : 'Bearer';
  if (provedor.violacao('sem-www-authenticate')) www = '';
  return new ErroDeApi(status, codigo, issue, texto, www ? { wwwAuthenticate: www } : {});
}

/** Certificado de cliente da conexão, conferido contra o registro. */
export function exigirCertificado(provedor: Provedor, req: IncomingMessage): { x5t: string; receptor: Participante | undefined } {
  const x5t = x5tDaConexao(req);
  if (!x5t) throw new ErroDeApi(401, 'CLIENT_CERTIFICATE_REQUIRED', 'security', 'Conexão sem certificado de cliente.');
  const receptor = provedor.registro.receptorDoCertificado(x5t);
  if (!receptor && !provedor.violacao('aceita-certificado-fora-do-registro')) {
    throw new ErroDeApi(401, 'CLIENT_CERTIFICATE_REQUIRED', 'security', 'Certificado de cliente fora do registro de participantes.');
  }
  if (receptor && !provedor.registro.receptorAtendivel(receptor) && !provedor.violacao('aceita-cliente-suspenso')) {
    throw new ErroDeApi(403, 'RECEIVER_NOT_ALLOWED', 'forbidden', 'O provedor não atende este receptor.');
  }
  return { x5t, receptor };
}

/** Certificado, token, vínculo e consentimento (seção 6.5, regra 1). */
export function autenticarRecurso(provedor: Provedor, req: IncomingMessage, url: URL): Acesso {
  const { x5t, receptor: donoDoCertificado } = exigirCertificado(provedor, req);
  let autorizacao = cabecalho(req, 'authorization');
  if (!autorizacao && provedor.violacao('token-na-url') && url.searchParams.get('access_token')) autorizacao = `Bearer ${url.searchParams.get('access_token')}`;
  if (!autorizacao) {
    throw erroDeToken(provedor, 401, 'TOKEN_MISSING', 'login', 'Requisição sem token de acesso no cabeçalho Authorization.');
  }
  const m = /^Bearer ([A-Za-z0-9\-._~+/]+=*)$/.exec(autorizacao);
  if (!m) throw erroDeToken(provedor, 401, 'TOKEN_INVALID', 'login', 'Cabeçalho Authorization malformado.', 'invalid_token');
  const token = provedor.tokens.get(m[1]!);
  if (!token || token.expiraEm <= provedor.relogio.agoraMs()) {
    throw erroDeToken(provedor, 401, 'TOKEN_INVALID', 'login', 'Token desconhecido ou expirado.', 'invalid_token');
  }
  if (token.x5t !== x5t && !provedor.violacao('token-sem-vinculo')) {
    throw erroDeToken(provedor, 401, 'TOKEN_CERTIFICATE_MISMATCH', 'security', 'O certificado da conexão não é o vinculado ao token.', 'invalid_token');
  }
  if (token.consentId) {
    const c = provedor.consentimento(token.consentId);
    if (c?.status === 'REVOKED' && !provedor.violacao('revogacao-nao-invalida-tokens')) {
      throw erroDeToken(provedor, 401, 'CONSENT_REVOKED', 'security', 'O consentimento do token foi revogado.', 'invalid_token', 'consent revoked');
    }
    if (c?.status === 'EXPIRED') {
      throw erroDeToken(provedor, 401, 'CONSENT_EXPIRED', 'expired', 'O consentimento do token expirou.', 'invalid_token', 'consent expired');
    }
  }
  if (token.revogado) {
    throw erroDeToken(provedor, 401, 'TOKEN_INVALID', 'login', 'Token revogado.', 'invalid_token');
  }
  const receptor = donoDoCertificado ?? provedor.registro.receptor(token.clientId);
  if (!receptor) throw new ErroDeApi(403, 'RECEIVER_NOT_ALLOWED', 'forbidden', 'O provedor não atende este receptor.');
  if (url.searchParams.has('access_token') && !provedor.violacao('token-na-url')) {
    throw new ErroDeApi(400, 'INVALID_REQUEST', 'invalid', 'Token de acesso não é aceito na URL.');
  }
  // Limite de chamadas por token (seção 7.11): janela de um minuto.
  if (provedor.cfg.limitePorMinuto > 0) {
    const agora = Date.now();
    if (agora - token.janela.inicio >= 60_000) token.janela = { inicio: agora, chamadas: 0 };
    token.janela.chamadas++;
    if (token.janela.chamadas > provedor.cfg.limitePorMinuto) {
      const espera = Math.max(1, Math.ceil((token.janela.inicio + 60_000 - agora) / 1000));
      throw new ErroDeApi(429, 'RATE_LIMITED', 'throttled', 'Limite de chamadas excedido.', { cabecalhos: provedor.violacao('sem-retry-after') ? {} : { 'Retry-After': provedor.violacao('retry-after-longo') ? '172800' : String(espera) } });
    }
  }
  return { receptor, clientId: receptor.participant_id, token, x5t };
}

export function exigirEscopo(provedor: Provedor, acesso: Acesso, tipo: 'provedor' | 'paciente', escopo?: string): void {
  if (provedor.violacao('escopo-nao-conferido')) return;
  const ok = acesso.token.tipo === tipo && (escopo === undefined || acesso.token.escopos.includes(escopo));
  if (!ok) {
    throw erroDeToken(provedor, 403, 'SCOPE_INSUFFICIENT', 'forbidden', 'O token não tem o escopo exigido por este recurso.', 'insufficient_scope');
  }
}

/** x-fapi-interaction-id (seção 5.1). */
export function exigirIdDeInteracao(provedor: Provedor, req: IncomingMessage): void {
  if (provedor.violacao('sem-interaction-id')) return;
  if (!eUuid(cabecalho(req, 'x-fapi-interaction-id'))) {
    throw new ErroDeApi(400, 'INTERACTION_ID_MISSING', 'required', 'Cabeçalho x-fapi-interaction-id ausente ou que não é UUID.');
  }
}

export function exigirAccept(req: IncomingMessage, tipo: string): void {
  if (!aceita(req, tipo)) throw new ErroDeApi(406, 'NOT_ACCEPTABLE', 'not-supported', `O cabeçalho Accept precisa incluir ${tipo}.`);
}

export function exigirConteudo(req: IncomingMessage, tipo: string): void {
  if (tipoDoConteudo(req) !== tipo) throw new ErroDeApi(415, 'UNSUPPORTED_MEDIA_TYPE', 'not-supported', `Content-Type precisa ser ${tipo}.`);
}

/** Envolve um tratador de API: x-fapi-interaction-id na resposta e erros como OperationOutcome. */
export async function comTratamentoDeErros(
  provedor: Provedor,
  req: IncomingMessage,
  res: ServerResponse,
  tratar: () => Promise<void>,
): Promise<void> {
  if (!provedor.violacao('sem-interaction-id')) {
    const recebido = cabecalho(req, 'x-fapi-interaction-id');
    res.setHeader('x-fapi-interaction-id', eUuid(recebido) ? recebido! : novoId());
  }
  try {
    await tratar();
  } catch (e) {
    let erro: ErroDeApi;
    if (e instanceof ErroDeApi) {
      erro = e;
    } else {
      provedor.log(`erro interno: ${(e as Error).stack ?? String(e)}`);
      erro = new ErroDeApi(500, 'INTERNAL_ERROR', 'exception', 'Falha interna do servidor de exemplo.');
    }
    if (res.headersSent) {
      res.destroy();
      return;
    }
    const cabecalhos: Record<string, string> = { ...erro.cabecalhos };
    if (erro.wwwAuthenticate) cabecalhos['WWW-Authenticate'] = erro.wwwAuthenticate;
    if (erro.status === 404 && provedor.violacao('erro-sem-operation-outcome')) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', ...cabecalhos });
      res.end('não encontrado');
      return;
    }
    enviarFhir(res, erro.status, operationOutcome(erro), cabecalhos);
  }
}
