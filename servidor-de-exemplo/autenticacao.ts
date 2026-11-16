// Autenticação do cliente no servidor de autorização: certificado da conexão
// mTLS conferido contra o registro (seção 7.5) e asserção private_key_jwt com
// PS256 (seções 5.3.1 e 7.2).

import { readFileSync } from 'node:fs';
import https from 'node:https';
import type { IncomingMessage } from 'node:http';
import type { TLSSocket } from 'node:tls';
import { rootCertificates } from 'node:tls';
import { decodeJwt, decodeProtectedHeader, importJWK, jwtVerify, type JWK } from 'jose';
import { x5tS256, type Participante } from '../comum/registro.ts';
import { ErroOAuth } from './http.ts';
import type { Provedor } from './provedor.ts';

export const TIPO_DE_ASSERCAO = 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer';

/** Hash SHA-256 do certificado de cliente apresentado na conexão, ou `undefined`. */
export function x5tDaConexao(req: IncomingMessage): string | undefined {
  const socket = req.socket as TLSSocket;
  if (typeof socket.getPeerCertificate !== 'function') return undefined;
  const cert = socket.getPeerCertificate(false);
  if (!cert || !('raw' in cert) || !cert.raw) return undefined;
  return x5tS256(new Uint8Array(cert.raw));
}

interface JwksEmCache {
  chaves: JWK[];
  buscadoEm: number;
}

const cacheDeJwks = new Map<string, JwksEmCache>();

async function baixarJwks(provedor: Provedor, uri: string): Promise<JWK[]> {
  const ca = [...rootCertificates, readFileSync(provedor.cfg.tls.caConfiavel, 'utf8')].join('\n');
  const corpo = await new Promise<string>((resolver, rejeitar) => {
    const req = https.get(uri, { ca, timeout: 5000 }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        rejeitar(new Error(`jwks_uri respondeu ${res.statusCode}`));
        return;
      }
      let texto = '';
      res.setEncoding('utf8');
      res.on('data', (p: string) => (texto += p));
      res.on('end', () => resolver(texto));
    });
    req.on('timeout', () => req.destroy(new Error('tempo esgotado no jwks_uri')));
    req.on('error', rejeitar);
  });
  const jwks = JSON.parse(corpo) as { keys?: JWK[] };
  return jwks.keys ?? [];
}

/**
 * Chave do receptor pelo kid. Busca o conjunto de novo, no máximo uma vez por
 * minuto, quando o kid não está em cache (seção 7.6).
 */
async function chaveDoReceptor(provedor: Provedor, receptor: Participante, kid: string): Promise<JWK | undefined> {
  const uri = receptor.receiver!.jwks_uri;
  const agora = Date.now();
  let cache = cacheDeJwks.get(uri);
  let chave = cache?.chaves.find((k) => k.kid === kid);
  if (!chave && (!cache || agora - cache.buscadoEm >= 60_000)) {
    try {
      cache = { chaves: await baixarJwks(provedor, uri), buscadoEm: agora };
      cacheDeJwks.set(uri, cache);
    } catch (e) {
      provedor.log(`jwks_uri de ${receptor.receiver!.client_id.slice(0, 8)} indisponível: ${(e as Error).message}`);
      return undefined;
    }
    chave = cache.chaves.find((k) => k.kid === kid);
  }
  return chave;
}

export function limparCacheDeJwks(): void {
  cacheDeJwks.clear();
}

export interface ClienteAutenticado {
  receptor: Participante;
  clientId: string;
  x5t: string;
}

function invalido(descricao: string): ErroOAuth {
  return new ErroOAuth(401, 'invalid_client', descricao);
}

/** Autentica o cliente em PAR, token e revogação. Lança `ErroOAuth` 401 `invalid_client`. */
export async function autenticarCliente(
  provedor: Provedor,
  req: IncomingMessage,
  form: Map<string, string[]>,
): Promise<ClienteAutenticado> {
  const x5t = x5tDaConexao(req);
  if (!x5t) throw invalido('certificado de cliente ausente');

  const umValor = (nome: string) => {
    const v = form.get(nome);
    if (v && v.length > 1) throw new ErroOAuth(400, 'invalid_request', `parâmetro repetido: ${nome}`);
    return v?.[0];
  };

  if (req.headers.authorization?.toLowerCase().startsWith('basic ')) throw invalido('método de autenticação não suportado');
  const tipo = umValor('client_assertion_type');
  const assercao = umValor('client_assertion');
  if (tipo !== TIPO_DE_ASSERCAO || !assercao) throw invalido('autenticação do cliente ausente: use private_key_jwt');

  let cabecalho: ReturnType<typeof decodeProtectedHeader>;
  let corpoNaoVerificado: ReturnType<typeof decodeJwt>;
  try {
    cabecalho = decodeProtectedHeader(assercao);
    corpoNaoVerificado = decodeJwt(assercao);
  } catch {
    throw invalido('asserção malformada');
  }
  const algoritmos = provedor.violacao('aceita-rs256') ? ['PS256', 'RS256', 'ES256'] : ['PS256'];
  if (typeof cabecalho.alg !== 'string' || !algoritmos.includes(cabecalho.alg)) throw invalido('algoritmo da asserção diferente de PS256');
  if (typeof cabecalho.kid !== 'string') throw invalido('asserção sem kid');

  const clientId = corpoNaoVerificado.iss;
  if (typeof clientId !== 'string') throw invalido('asserção sem iss');
  const clientIdDoFormulario = umValor('client_id');
  if (clientIdDoFormulario !== undefined && clientIdDoFormulario !== clientId) throw invalido('client_id diferente do iss da asserção');

  const receptor = provedor.registro.receptor(clientId);
  if (!receptor) throw invalido('client_id desconhecido');

  // Certificado da conexão: do mesmo cliente, no registro e dentro da validade.
  const donoDoCertificado = provedor.registro.receptorDoCertificado(x5t);
  if (!donoDoCertificado && !provedor.violacao('aceita-certificado-fora-do-registro')) {
    throw invalido('certificado de cliente fora do registro');
  }
  if (donoDoCertificado && donoDoCertificado.participant_id !== receptor.participant_id) {
    throw invalido('certificado registrado para outro cliente');
  }

  if (!provedor.violacao('aceita-cliente-suspenso') && !provedor.registro.receptorAtendivel(receptor)) {
    throw invalido('receptor sem situação ativa ou sem versão de protocolo em comum');
  }

  const jwk = await chaveDoReceptor(provedor, receptor, cabecalho.kid);
  if (!jwk) throw invalido('chave da asserção não encontrada no jwks_uri do receptor');

  const agora = provedor.relogio.agora();
  let corpo: Awaited<ReturnType<typeof jwtVerify>>['payload'];
  try {
    const chave = await importJWK(jwk, cabecalho.alg);
    ({ payload: corpo } = await jwtVerify(assercao, chave, {
      algorithms: algoritmos,
      currentDate: agora,
      clockTolerance: 10,
    }));
  } catch {
    throw invalido('assinatura, exp ou nbf da asserção inválidos');
  }

  const agoraS = Math.floor(agora.getTime() / 1000);
  if (corpo.sub !== clientId) throw invalido('sub da asserção diferente do client_id');
  const aud = corpo.aud;
  const audValido = typeof aud === 'string'
    ? aud === provedor.issuer
    : provedor.violacao('aud-em-lista') && Array.isArray(aud) && aud.includes(provedor.issuer);
  if (!audValido) throw invalido('aud da asserção precisa ser o issuer, como texto simples');
  if (typeof corpo.iat !== 'number') throw invalido('asserção sem iat');
  if (corpo.iat > agoraS + 10) throw invalido('iat da asserção no futuro');
  if (typeof corpo.exp !== 'number') throw invalido('asserção sem exp');
  if (corpo.exp - corpo.iat > 60) throw invalido('validade da asserção maior que 60 segundos');
  if (typeof corpo.jti !== 'string' || corpo.jti.length === 0) throw invalido('asserção sem jti');
  const chaveDoJti = `${clientId} ${corpo.jti}`;
  if (provedor.jtis.has(chaveDoJti) && !provedor.violacao('jti-repetido')) throw invalido('jti repetido');
  provedor.jtis.set(chaveDoJti, corpo.exp * 1000);

  return { receptor, clientId, x5t };
}
