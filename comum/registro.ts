// Registro de participantes: tipos, assinatura e verificação (seção 8.3).
//
// A verificação segue a lista V1 a V14 da seção 8.3, na ordem, e recusa no
// primeiro passo que falha. V1 (baixar por HTTPS com o certificado do servidor
// validado) fica com quem baixa: as funções daqui recebem os bytes já baixados,
// e `baixarRegistro` faz o V1 quando o registro vem por HTTPS.

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import https from 'node:https';
import {
  base64url,
  calculateJwkThumbprint,
  compactVerify,
  CompactSign,
  importJWK,
  type CryptoKey,
  type JWK,
  type KeyObject,
} from 'jose';
import { Ajv2020 } from 'ajv/dist/2020.js';

export const ESCOPOS_DE_PROVEDOR = ['catalog.read', 'locations.read', 'schedule.read', 'consent.manage'] as const;
export const ESCOPOS_DE_PACIENTE = ['appointment.write', 'results.read', 'consent.read'] as const;
export const TODOS_OS_ESCOPOS = [...ESCOPOS_DE_PROVEDOR, ...ESCOPOS_DE_PACIENTE] as const;
export type Escopo = (typeof TODOS_OS_ESCOPOS)[number];

export interface ChaveDoRegistro {
  kty: 'RSA';
  kid: string;
  use: 'sig';
  alg: 'PS256';
  n: string;
  e: string;
}

export interface CertificadoDeTransporte {
  'x5t#S256': string;
  x5c: string[];
  not_before: string;
  not_after: string;
}

export interface BlocoProvedor {
  issuer: string;
  fhir_base_url: string;
  api_base_url: string;
  scopes_supported: Escopo[];
  consent_management_uri: string;
  logo_uri?: string;
}

export interface BlocoReceptor {
  client_id: string;
  client_name: string;
  redirect_uris: string[];
  jwks_uri: string;
  scopes_allowed: Escopo[];
  transport_certificates: CertificadoDeTransporte[];
  policy_uri: string;
  tos_uri: string;
  logo_uri?: string;
  eligibility: { patient_facing: true; health_plan_operator: false; declared_at: string };
}

export type SituacaoDoParticipante = 'active' | 'suspended' | 'withdrawn';

export interface Participante {
  participant_id: string;
  role: 'provider' | 'receiver';
  status: SituacaoDoParticipante;
  legal_name: string;
  display_name: string;
  cnpj: string;
  contacts: { technical_email: string; security_email: string };
  protocol_versions: string[];
  updated_at: string;
  provider?: BlocoProvedor;
  receiver?: BlocoReceptor;
}

export interface DocumentoDoRegistro {
  schema_version: string;
  environment: 'pilot' | 'production';
  sequence: number;
  issued_at: string;
  expires_at: string;
  registry_keys: { keys: ChaveDoRegistro[] };
  participants: Participante[];
}

export const CAMINHO_DO_SCHEMA = new URL('../especificacao/registro/participantes.schema.json', import.meta.url);

let validadorDoSchema: ((dado: unknown) => boolean) & { errors?: unknown } | undefined;

function validador() {
  if (!validadorDoSchema) {
    const schema = JSON.parse(readFileSync(CAMINHO_DO_SCHEMA, 'utf8')) as object;
    const ajv = new Ajv2020({ strict: true, strictRequired: false, allErrors: false });
    validadorDoSchema = ajv.compile(schema);
  }
  return validadorDoSchema;
}

/** Valida um objeto contra o schema do registro. Devolve a mensagem do primeiro erro, ou `undefined`. */
export function erroDeSchema(documento: unknown): string | undefined {
  const validar = validador();
  if (validar(documento)) return undefined;
  const erros = (validar.errors ?? []) as Array<{ instancePath?: string; message?: string }>;
  const primeiro = erros[0];
  return primeiro ? `${primeiro.instancePath || '/'} ${primeiro.message ?? ''}`.trim() : 'documento inválido';
}

export type PassoDeVerificacao =
  | 'V1' | 'V2' | 'V3' | 'V4' | 'V5' | 'V6' | 'V7' | 'V8' | 'V9' | 'V10' | 'V11' | 'V12' | 'V13' | 'V14';

export interface DocumentoAceito {
  documento: DocumentoDoRegistro;
  bytes: Uint8Array;
}

export interface EntradaDaVerificacao {
  /** Bytes exatos de participantes.json, como baixados. */
  bytes: Uint8Array;
  /** Conteúdo de participantes.json.jws. */
  jws: string;
  /** registry_keys do documento N já aceito, ou o conjunto inicial. */
  chavesConfiaveis: ChaveDoRegistro[];
  /** Ambiente em que o participante opera. */
  ambiente: 'pilot' | 'production';
  /** Documento N já aceito, se houver. */
  atual?: DocumentoAceito;
  agora: Date;
  /** Só para o modo de violações do servidor de exemplo: passos que não são aplicados. */
  pular?: PassoDeVerificacao[];
}

export type ResultadoDaVerificacao =
  | { aceito: true; documento: DocumentoDoRegistro; inalterado: boolean; passos: PassoDeVerificacao[] }
  | { aceito: false; passo: PassoDeVerificacao; motivo: string; passos: PassoDeVerificacao[] };

const TOLERANCIA_DE_EMISSAO_MS = 60_000;
const VALIDADE_MAXIMA_MS = 30 * 24 * 3600_000;

function iguais(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function tamanhoDoModuloEmBits(n: string): number {
  const bytes = base64url.decode(n);
  let i = 0;
  while (i < bytes.length && bytes[i] === 0) i++;
  if (i === bytes.length) return 0;
  const primeiro = bytes[i]!;
  return (bytes.length - i - 1) * 8 + (32 - Math.clz32(primeiro));
}

function decodificarCabecalho(parte: string): Record<string, unknown> | undefined {
  try {
    const texto = new TextDecoder().decode(base64url.decode(parte));
    const cabecalho = JSON.parse(texto) as unknown;
    return typeof cabecalho === 'object' && cabecalho !== null && !Array.isArray(cabecalho)
      ? (cabecalho as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Aplica os passos V2 a V14 da seção 8.3 a um candidato. V1 é de quem baixa
 * (ver `baixarRegistro`). Devolve o primeiro passo que falhou.
 */
export async function verificarCandidato(entrada: EntradaDaVerificacao): Promise<ResultadoDaVerificacao> {
  const passos: PassoDeVerificacao[] = [];
  const pular = new Set(entrada.pular ?? []);
  const recusa = (passo: PassoDeVerificacao, motivo: string): ResultadoDaVerificacao => ({ aceito: false, passo, motivo, passos });

  // V2: três campos, o segundo vazio.
  const partes = entrada.jws.trim().split('.');
  if (partes.length !== 3 || partes[1] !== '' || !partes[0] || !partes[2]) {
    return recusa('V2', 'a assinatura não tem três campos com o segundo vazio');
  }
  passos.push('V2');
  const [cabecalhoB64, , assinaturaB64] = partes as [string, string, string];

  // V3: alg PS256.
  const cabecalho = decodificarCabecalho(cabecalhoB64);
  if (!cabecalho || cabecalho.alg !== 'PS256') {
    return recusa('V3', `algoritmo do cabeçalho diferente de PS256: ${String(cabecalho?.alg)}`);
  }
  passos.push('V3');

  // V4: kid entre as chaves confiáveis (do documento N, nunca do candidato).
  const kid = cabecalho.kid;
  const chave = typeof kid === 'string' ? entrada.chavesConfiaveis.find((c) => c.kid === kid) : undefined;
  if (!chave) return recusa('V4', 'kid do cabeçalho não está nas chaves do documento atual');
  passos.push('V4');

  // V5: kid é o thumbprint da chave, e a chave é RSA de 2048 bits ou mais.
  const thumbprint = await calculateJwkThumbprint({ kty: chave.kty, n: chave.n, e: chave.e }, 'sha256');
  if (thumbprint !== chave.kid) return recusa('V5', 'kid da chave não é o thumbprint dela');
  if (chave.kty !== 'RSA' || tamanhoDoModuloEmBits(chave.n) < 2048) return recusa('V5', 'chave menor que 2048 bits');
  passos.push('V5');

  // V6: assinatura PS256 sobre os bytes baixados.
  try {
    const chavePublica = await importJWK({ kty: chave.kty, n: chave.n, e: chave.e }, 'PS256');
    const jwsAnexado = `${cabecalhoB64}.${base64url.encode(entrada.bytes)}.${assinaturaB64}`;
    await compactVerify(jwsAnexado, chavePublica, { algorithms: ['PS256'] });
  } catch {
    if (!pular.has('V6')) return recusa('V6', 'assinatura não verifica');
  }
  passos.push('V6');

  // V7: JSON válido contra o schema.
  let documento: DocumentoDoRegistro;
  try {
    documento = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(entrada.bytes)) as DocumentoDoRegistro;
  } catch {
    return recusa('V7', 'os bytes não são JSON válido');
  }
  const erro = erroDeSchema(documento);
  if (erro) return recusa('V7', `documento inválido contra o schema: ${erro}`);
  passos.push('V7');

  // V8: ambiente.
  if (documento.environment !== entrada.ambiente) return recusa('V8', `registro do ambiente ${documento.environment}`);
  passos.push('V8');

  // V9: sequência maior que N. Igual: mesmos bytes seguem, bytes diferentes são recusados.
  let inalterado = false;
  if (entrada.atual) {
    const n = entrada.atual.documento.sequence;
    if (documento.sequence < n && !pular.has('V9')) return recusa('V9', `sequence ${documento.sequence} menor que a atual ${n}`);
    if (documento.sequence === n) {
      if (!iguais(entrada.bytes, entrada.atual.bytes)) {
        return recusa('V9', `sequence ${n} repetida com bytes diferentes`);
      }
      inalterado = true;
    }
  }
  passos.push('V9');

  const emissao = Date.parse(documento.issued_at);
  const expiracao = Date.parse(documento.expires_at);
  const agora = entrada.agora.getTime();

  // V10: emissão até 60 segundos no futuro.
  if (emissao - agora > TOLERANCIA_DE_EMISSAO_MS) return recusa('V10', 'issued_at no futuro');
  passos.push('V10');

  // V11: validade não invertida e de no máximo 30 dias.
  if (!(expiracao > emissao) || expiracao - emissao > VALIDADE_MAXIMA_MS) {
    return recusa('V11', 'expires_at invertido ou mais de 30 dias depois de issued_at');
  }
  passos.push('V11');

  // V12: não expirado.
  if (expiracao <= agora) return recusa('V12', 'documento já expirado');
  passos.push('V12');

  // V13: kid de cada chave do candidato é o thumbprint dela.
  for (const k of documento.registry_keys.keys) {
    const t = await calculateJwkThumbprint({ kty: k.kty, n: k.n, e: k.e }, 'sha256');
    if (t !== k.kid) return recusa('V13', 'kid de uma chave do candidato não é o thumbprint dela');
  }
  passos.push('V13');

  // V14: participant_id único, client_id igual ao participant_id.
  const ids = new Set<string>();
  for (const p of documento.participants) {
    if (ids.has(p.participant_id)) return recusa('V14', 'participant_id repetido');
    ids.add(p.participant_id);
    if (p.role === 'receiver' && p.receiver?.client_id !== p.participant_id) {
      return recusa('V14', 'client_id diferente do participant_id');
    }
  }
  passos.push('V14');

  return { aceito: true, documento, inalterado, passos };
}

/** Cabeçalho protegido do registro, na ordem de campos da seção 8.3. */
export function cabecalhoDoRegistro(kid: string): Record<string, string> {
  return { alg: 'PS256', kid, typ: 'JOSE' };
}

/**
 * Assina os bytes do registro com JWS destacado (seção 8.3, passos 1 a 4).
 * `cabecalho` permite gerar candidatos inválidos para teste.
 */
export async function assinarRegistro(
  bytes: Uint8Array,
  chavePrivada: KeyObject | CryptoKey | Uint8Array,
  kid: string,
  opcoes: { cabecalho?: Record<string, unknown>; alg?: string } = {},
): Promise<string> {
  const cabecalho = opcoes.cabecalho ?? cabecalhoDoRegistro(kid);
  const compacto = await new CompactSign(bytes)
    .setProtectedHeader(cabecalho as { alg: string })
    .sign(chavePrivada);
  const [h, , s] = compacto.split('.');
  return `${h}..${s}`;
}

/** Chave pública do registro em JWK, com kid igual ao thumbprint. */
export async function chavePublicaDoRegistro(jwk: JWK): Promise<ChaveDoRegistro> {
  if (jwk.kty !== 'RSA' || !jwk.n || !jwk.e) throw new Error('A chave do registro precisa ser RSA');
  const kid = await calculateJwkThumbprint({ kty: 'RSA', n: jwk.n, e: jwk.e }, 'sha256');
  return { kty: 'RSA', kid, use: 'sig', alg: 'PS256', n: jwk.n, e: jwk.e };
}

/**
 * V1: baixa participantes.json e participantes.json.jws por HTTPS, validando o
 * certificado do servidor contra `ca` (ou as autoridades do sistema).
 */
export async function baixarRegistro(
  urlDoDocumento: string,
  opcoes: { ca?: string | Buffer; urlDaAssinatura?: string } = {},
): Promise<{ bytes: Uint8Array; jws: string } | { erro: string }> {
  const urlDaAssinatura = opcoes.urlDaAssinatura ?? `${urlDoDocumento}.jws`;
  for (const url of [urlDoDocumento, urlDaAssinatura]) {
    if (new URL(url).protocol !== 'https:') return { erro: `V1: ${url} não é HTTPS` };
  }
  const baixar = (url: string) =>
    new Promise<Buffer>((resolver, rejeitar) => {
      const req = https.get(url, { ca: opcoes.ca, rejectUnauthorized: true, timeout: 10_000 }, (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          rejeitar(new Error(`status ${res.statusCode}`));
          return;
        }
        const partes: Buffer[] = [];
        res.on('data', (p: Buffer) => partes.push(p));
        res.on('end', () => resolver(Buffer.concat(partes)));
        res.on('error', rejeitar);
      });
      req.on('timeout', () => req.destroy(new Error('tempo esgotado')));
      req.on('error', rejeitar);
    });
  try {
    const [bytes, jws] = await Promise.all([baixar(urlDoDocumento), baixar(urlDaAssinatura)]);
    return { bytes: new Uint8Array(bytes), jws: jws.toString('utf8') };
  } catch (e) {
    return { erro: `V1: ${(e as Error).message}` };
  }
}

/** Versão efetiva entre duas listas `protocol_versions` (seção 9.1). `undefined`: sem comunicação. */
export function versaoEfetiva(a: string[], b: string[]): string | undefined {
  const analisar = (v: string) => {
    const m = /^([0-9]+)\.([0-9]+)$/.exec(v);
    return m ? { major: Number(m[1]), minor: Number(m[2]) } : undefined;
  };
  const va = a.map(analisar).filter((v) => v !== undefined);
  const vb = b.map(analisar).filter((v) => v !== undefined);
  const majoresComuns = [...new Set(va.map((v) => v.major))].filter((m) => vb.some((v) => v.major === m));
  if (majoresComuns.length === 0) return undefined;
  const major = Math.max(...majoresComuns);
  const minoresA = va.filter((v) => v.major === major).map((v) => v.minor);
  const minoresB = vb.filter((v) => v.major === major).map((v) => v.minor);
  if (major === 0) {
    const identicos = minoresA.filter((m) => minoresB.includes(m));
    if (identicos.length === 0) return undefined;
    return `0.${Math.max(...identicos)}`;
  }
  return `${major}.${Math.min(Math.max(...minoresA), Math.max(...minoresB))}`;
}

/** SHA-256 do certificado em DER, em base64url (RFC 8705, seção 3.1). */
export function x5tS256(der: Uint8Array): string {
  return base64url.encode(createHash('sha256').update(der).digest());
}
