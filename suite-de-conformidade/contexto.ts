// Contexto de execução da suíte: registro verificado, metadados, clientes de
// teste, hospedagem, interface de controle e as operações do protocolo que os
// testes usam (asserção, token, consentimento, PAR, jornada, chamadas de API).

import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { rootCertificates } from 'node:tls';
import { base64url, importJWK, SignJWT, type CryptoKey, type JWK, type KeyObject } from 'jose';
import { urlDosMetadados } from '../comum/metadados.ts';
import { verificarCandidato, type DocumentoDoRegistro, type Participante } from '../comum/registro.ts';
import { caminhoDe, lerArquivo, type ConfiguracaoDaSuite, type PacienteDeTeste, type PapelDoCliente } from './configuracao.ts';
import { Hospedagem } from './hospedagem.ts';
import { ClienteHttp, type CredencialTls, type Resposta } from './http.ts';
import { falhar, naoVerificavel } from './resultado.ts';

export const TIPO_DE_ASSERCAO = 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer';
export const ESCOPOS_DE_PACIENTE = ['appointment.write', 'results.read', 'consent.read'];

export interface ClienteDeTeste {
  papel: PapelDoCliente;
  clientId: string;
  participante: Participante;
  jwk: JWK;
  chave: CryptoKey | KeyObject;
  kid: string;
  credenciais: CredencialTls[];
  redirectUri: string;
}

export interface OpcoesDaAssercao {
  alg?: string;
  aud?: unknown;
  iss?: string;
  sub?: string;
  iat?: number;
  exp?: number;
  nbf?: number;
  jti?: string;
  kid?: string;
  semJti?: boolean;
}

export interface Autorizacao {
  consentId: string;
  accessToken: string;
  refreshToken: string;
  respostaDoToken: Resposta;
  location: string;
  state: string;
  verificador: string;
  redirectUri: string;
}

export interface ResultadoDaJornada {
  status: number;
  location?: string;
  pagina_de_erro?: string;
  /** Como a jornada foi feita: pelas páginas reais ou pela interface de controle. */
  origem: 'formulario' | 'controle';
  /** Cada requisição da jornada pelas páginas, com o status recebido. */
  saltos: Array<{ metodo: string; url: string; status: number }>;
  /** HTML da tela de consentimento, na jornada pelas páginas. */
  telaDeConsentimento?: string;
}

const ENTIDADES: Record<string, string> = { '&amp;': '&', '&quot;': '"', '&#39;': "'", '&lt;': '<', '&gt;': '>' };
const desescapar = (t: string) => t.replace(/&(amp|quot|#39|lt|gt);/g, (m) => ENTIDADES[m]!);

/** Primeiro formulário POST da página: endereço e campos ocultos. */
export function lerFormulario(html: string, base: string): { acao: string; campos: Record<string, string> } | undefined {
  const inicio = /<form\b[^>]*>/i.exec(html);
  if (!inicio || !/method\s*=\s*"post"/i.test(inicio[0])) return undefined;
  const acao = desescapar(/action\s*=\s*"([^"]*)"/i.exec(inicio[0])?.[1] ?? '');
  const corpo = html.slice(inicio.index, html.indexOf('</form>', inicio.index) >>> 0);
  const campos: Record<string, string> = {};
  for (const m of corpo.matchAll(/<input\b[^>]*>/gi)) {
    const atributos = Object.fromEntries([...m[0].matchAll(/([\w-]+)\s*=\s*"([^"]*)"/g)].map((a) => [a[1]!.toLowerCase(), desescapar(a[2]!)]));
    if (atributos.type === 'hidden' && atributos.name) campos[atributos.name] = atributos.value ?? '';
  }
  return { acao: new URL(acao || base, base).toString(), campos };
}

function pkce(): { verificador: string; desafio: string } {
  const verificador = randomBytes(32).toString('base64url');
  return { verificador, desafio: createHash('sha256').update(verificador).digest('base64url') };
}

export class Contexto {
  readonly cfg: ConfiguracaoDaSuite;
  readonly http: ClienteHttp;
  readonly documento: DocumentoDoRegistro;
  readonly bytesDoRegistro: Uint8Array;
  readonly provedor: Participante;
  readonly clientes = new Map<PapelDoCliente, ClienteDeTeste>();
  hospedagem: Hospedagem | undefined;
  metadados: Record<string, unknown> | undefined;
  erroDosMetadados: string | undefined;
  credencialNaoRegistrada: CredencialTls | undefined;
  deslocamentoMs = 0;
  /** Último documento do registro que a suíte publicou e o provedor deve ter aceito. */
  registroAceito: { documento: DocumentoDoRegistro; bytes: Uint8Array; jws: string };
  /** Valores sensíveis vistos na execução (tokens, CPFs), para a conferência ERR-004. */
  readonly segredosVistos = new Set<string>();
  /** Certificado com que cada token foi obtido: é o que vai na conexão quando o teste não escolhe outro. */
  readonly certificadoDoToken = new Map<string, CredencialTls>();

  private constructor(cfg: ConfiguracaoDaSuite, http: ClienteHttp, documento: DocumentoDoRegistro, bytes: Uint8Array, jws: string) {
    this.cfg = cfg;
    this.http = http;
    this.documento = documento;
    this.bytesDoRegistro = bytes;
    this.registroAceito = { documento, bytes, jws };
    const p = documento.participants.find((x) => x.participant_id === cfg.provedor.participant_id && x.role === 'provider');
    if (!p?.provider) throw new Error(`O provedor ${cfg.provedor.participant_id} não está no registro configurado`);
    this.provedor = p;
  }

  static async criar(cfg: ConfiguracaoDaSuite): Promise<Contexto> {
    const ca = [...rootCertificates, ...(cfg.provedor.ca_confiavel ? [lerArquivo(cfg, cfg.provedor.ca_confiavel).toString('utf8')] : [])].join('\n');
    const bytes = new Uint8Array(lerArquivo(cfg, cfg.registro.documento));
    const jws = lerArquivo(cfg, cfg.registro.assinatura).toString('utf8');
    const iniciais = JSON.parse(lerArquivo(cfg, cfg.registro.chaves_iniciais).toString('utf8')) as { keys: DocumentoDoRegistro['registry_keys']['keys'] };
    const r = await verificarCandidato({ bytes, jws, chavesConfiaveis: iniciais.keys, ambiente: cfg.registro.ambiente, agora: new Date() });
    if (!r.aceito) throw new Error(`O registro configurado não passou na verificação (${r.passo}: ${r.motivo})`);
    const ctx = new Contexto(cfg, new ClienteHttp(ca), r.documento, bytes, jws);

    for (const [papel, c] of Object.entries(cfg.clientes) as Array<[PapelDoCliente, NonNullable<ConfiguracaoDaSuite['clientes'][PapelDoCliente]>]>) {
      const participante = r.documento.participants.find((p) => p.role === 'receiver' && p.receiver?.client_id === c.client_id);
      if (!participante) throw new Error(`O cliente ${papel} (${c.client_id}) não está no registro`);
      const jwk = JSON.parse(lerArquivo(cfg, c.chave_de_assinatura).toString('utf8')) as JWK;
      ctx.clientes.set(papel, {
        papel,
        clientId: c.client_id,
        participante,
        jwk,
        chave: await importJWK(jwk, 'PS256') as CryptoKey | KeyObject,
        kid: jwk.kid ?? '',
        credenciais: c.certificados.map((x) => ({ cert: lerArquivo(cfg, x.certificado), key: lerArquivo(cfg, x.chave) })),
        redirectUri: participante.receiver!.redirect_uris[0]!,
      });
    }
    if (cfg.certificado_nao_registrado) {
      ctx.credencialNaoRegistrada = {
        cert: lerArquivo(cfg, cfg.certificado_nao_registrado.certificado),
        key: lerArquivo(cfg, cfg.certificado_nao_registrado.chave),
      };
    }

    if (cfg.hospedagem) {
      const h = new Hospedagem();
      for (const c of Object.values(cfg.clientes)) {
        if (!c?.jwks_publico) continue;
        const participante = r.documento.participants.find((p) => p.receiver?.client_id === c.client_id)!;
        h.publicar(new URL(participante.receiver!.jwks_uri).pathname, lerArquivo(cfg, c.jwks_publico));
      }
      if (cfg.registro.caminho_de_publicacao) {
        h.publicar(cfg.registro.caminho_de_publicacao, Buffer.from(bytes));
        h.publicar(`${cfg.registro.caminho_de_publicacao}.jws`, jws);
      }
      await h.iniciar({
        endereco: cfg.hospedagem.endereco_de_escuta,
        porta: cfg.hospedagem.porta,
        certificado: caminhoDe(cfg, cfg.hospedagem.certificado),
        chave: caminhoDe(cfg, cfg.hospedagem.chave),
      });
      ctx.hospedagem = h;
    }

    await ctx.lerMetadados();
    await ctx.sincronizarRelogio();
    return ctx;
  }

  async encerrar(): Promise<void> {
    await this.hospedagem?.fechar();
  }

  // Endereços -----------------------------------------------------------------

  get issuer(): string {
    return this.provedor.provider!.issuer;
  }
  get fhirBase(): string {
    return this.provedor.provider!.fhir_base_url.replace(/\/$/, '');
  }
  get apiBase(): string {
    return this.provedor.provider!.api_base_url.replace(/\/$/, '');
  }

  urlDosMetadados(): string {
    return urlDosMetadados(this.issuer);
  }

  async lerMetadados(): Promise<void> {
    try {
      const r = await this.http.requisitar(this.urlDosMetadados(), { credencial: null });
      if (r.status !== 200 || typeof r.json !== 'object' || r.json === null) {
        this.erroDosMetadados = `metadados responderam ${r.status}`;
        return;
      }
      this.metadados = r.json as Record<string, unknown>;
    } catch (e) {
      this.erroDosMetadados = (e as Error).message;
    }
  }

  /** Endpoint do documento de metadados, com mtls_endpoint_aliases quando houver (seção 5.2). */
  endpoint(nome: 'token_endpoint' | 'pushed_authorization_request_endpoint' | 'revocation_endpoint' | 'authorization_endpoint'): string {
    if (!this.metadados) falhar(`sem documento de metadados: ${this.erroDosMetadados ?? 'desconhecido'}`);
    const aliases = this.metadados.mtls_endpoint_aliases as Record<string, string> | undefined;
    const valor = (nome !== 'authorization_endpoint' ? aliases?.[nome] : undefined) ?? this.metadados[nome];
    if (typeof valor !== 'string') {
      if (nome === 'revocation_endpoint') naoVerificavel('o provedor não anuncia revocation_endpoint');
      falhar(`metadados sem ${nome}`);
    }
    return valor;
  }

  cliente(papel: PapelDoCliente): ClienteDeTeste {
    const c = this.clientes.get(papel);
    if (!c) naoVerificavel(`a configuração não tem o cliente de teste "${papel}"`);
    return c;
  }

  paciente(papel: 'principal' | 'outro' | 'sem_cpf' | 'cpf_invalido'): PacienteDeTeste {
    const p = this.cfg.pacientes[papel];
    if (!p) naoVerificavel(`a configuração não tem o paciente de teste "${papel}"`);
    return p;
  }

  // Relógio ---------------------------------------------------------------------

  agoraMs(): number {
    return Date.now() + this.deslocamentoMs;
  }
  agoraS(): number {
    return Math.floor(this.agoraMs() / 1000);
  }

  get temControle(): boolean {
    return Boolean(this.cfg.controle_de_teste);
  }

  exigirControle(para: string): void {
    if (!this.temControle) naoVerificavel(`${para} exige a interface de controle de teste, ausente na configuração`);
  }

  async controle(metodo: 'GET' | 'POST', caminho: string, corpo?: unknown): Promise<{ status: number; json: Record<string, unknown> }> {
    this.exigirControle('esta verificação');
    const c = this.cfg.controle_de_teste!;
    const r = await fetch(`${c.url.replace(/\/$/, '')}${caminho}`, {
      method: metodo,
      headers: { Authorization: `Bearer ${c.token}`, 'Content-Type': 'application/json' },
      ...(corpo !== undefined ? { body: JSON.stringify(corpo) } : {}),
    });
    const texto = await r.text();
    return { status: r.status, json: texto ? (JSON.parse(texto) as Record<string, unknown>) : {} };
  }

  /** Expiração do registro em vigor no provedor, quando a interface de controle informa. */
  registroDoProvedorExpiraEm: string | undefined;

  /**
   * Relógio do provedor: pela interface de controle, quando há; senão pelo
   * cabeçalho Date das respostas, como a seção 7.11 permite ao cliente.
   */
  async sincronizarRelogio(): Promise<void> {
    if (!this.temControle) {
      const r = await this.http.requisitar(this.urlDosMetadados(), { credencial: null, semHistorico: true }).catch(() => undefined);
      const data = r?.cabecalhos.date;
      const ms = typeof data === 'string' ? Date.parse(data) : NaN;
      if (!Number.isNaN(ms)) this.deslocamentoMs = ms - Date.now();
      return;
    }
    const r = await this.controle('GET', '/_controle/estado');
    if (typeof r.json.agora_ms === 'number') this.deslocamentoMs = r.json.agora_ms - Date.now();
    if (typeof r.json.sequencia_do_registro === 'number' && r.json.sequencia_do_registro > this.registroAceito.documento.sequence) {
      // O provedor já aceitou documentos de uma execução anterior: os candidatos partem da sequence dele.
      this.registroAceito = { ...this.registroAceito, documento: { ...this.registroAceito.documento, sequence: r.json.sequencia_do_registro } };
    }
    if (typeof r.json.registro_expira_em === 'string') this.registroDoProvedorExpiraEm = r.json.registro_expira_em;
  }

  async avancarRelogio(segundos: number): Promise<void> {
    this.exigirControle('adiantar o relógio do provedor');
    const r = await this.controle('POST', '/_controle/relogio', { avancar_segundos: segundos });
    if (r.status !== 200) falhar(`interface de controle recusou adiantar o relógio: ${r.status}`);
    await this.sincronizarRelogio();
  }

  // Asserção do cliente (seção 5.3.1) -----------------------------------------

  async assercao(c: ClienteDeTeste, o: OpcoesDaAssercao = {}): Promise<string> {
    const iat = o.iat ?? this.agoraS();
    const exp = o.exp ?? iat + 60;
    const corpo: Record<string, unknown> = {
      iss: o.iss ?? c.clientId,
      sub: o.sub ?? c.clientId,
      aud: o.aud ?? this.issuer,
      iat,
      exp,
      ...(o.semJti ? {} : { jti: o.jti ?? randomUUID() }),
      ...(o.nbf !== undefined ? { nbf: o.nbf } : {}),
    };
    const alg = o.alg ?? 'PS256';
    const kid = o.kid ?? c.kid;
    if (alg === 'none') {
      const h = base64url.encode(JSON.stringify({ alg: 'none', kid }));
      return `${h}.${base64url.encode(JSON.stringify(corpo))}.`;
    }
    let chave: CryptoKey | KeyObject = c.chave;
    if (alg === 'RS256') chave = (await importJWK(c.jwk, 'RS256')) as CryptoKey | KeyObject;
    if (alg === 'ES256') {
      const { generateKeyPair } = await import('jose');
      chave = (await generateKeyPair('ES256')).privateKey;
    }
    return new SignJWT(corpo).setProtectedHeader({ alg, kid, typ: 'JWT' }).sign(chave);
  }

  // Servidor de autorização -----------------------------------------------------

  async postOAuth(
    url: string,
    c: ClienteDeTeste,
    params: Record<string, string | undefined>,
    o: { credencial?: CredencialTls | null; assercao?: string | null; cabecalhos?: Record<string, string> } = {},
  ): Promise<Resposta> {
    const form = new URLSearchParams();
    if (o.assercao !== null) {
      form.append('client_assertion_type', TIPO_DE_ASSERCAO);
      form.append('client_assertion', o.assercao ?? (await this.assercao(c)));
    }
    for (const [k, v] of Object.entries(params)) if (v !== undefined) form.append(k, v);
    const r = await this.http.requisitar(url, {
      metodo: 'POST',
      cabecalhos: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json', ...(o.cabecalhos ?? {}) },
      corpo: form.toString(),
      credencial: o.credencial === undefined ? c.credenciais[0]! : o.credencial,
    });
    const j = r.json as Record<string, unknown> | undefined;
    for (const k of ['access_token', 'refresh_token']) if (typeof j?.[k] === 'string') this.segredosVistos.add(j[k] as string);
    const usada = o.credencial === undefined ? c.credenciais[0]! : o.credencial;
    if (typeof j?.access_token === 'string' && usada) this.certificadoDoToken.set(j.access_token, usada);
    return r;
  }

  async token(c: ClienteDeTeste, params: Record<string, string | undefined>, o: { credencial?: CredencialTls | null; assercao?: string | null } = {}): Promise<Resposta> {
    return this.postOAuth(this.endpoint('token_endpoint'), c, params, o);
  }

  async tokenCc(c: ClienteDeTeste, escopos: string[], o: { credencial?: CredencialTls | null; assercao?: string | null } = {}): Promise<Resposta> {
    return this.token(c, { grant_type: 'client_credentials', scope: escopos.join(' ') }, o);
  }

  /** Token de provedor. Um escopo por pedido, e consent.manage sempre sozinho (RCP-032). */
  async tokenDeProvedor(c: ClienteDeTeste, escopo: string, credencial?: CredencialTls): Promise<string> {
    const r = await this.tokenCc(c, [escopo], credencial ? { credencial } : {});
    const token = (r.json as { access_token?: unknown } | undefined)?.access_token;
    if (r.status !== 200 || typeof token !== 'string') falhar(`token client_credentials com ${escopo} recusado: ${r.status} ${r.texto.slice(0, 200)}`);
    return token;
  }

  // Endpoints de consentimento e API FHIR ---------------------------------------

  async api(
    metodo: string,
    url: string,
    o: { token?: string; credencial?: CredencialTls | null; cabecalhos?: Record<string, string>; corpo?: unknown; semInteracao?: boolean; accept?: string | null; tipo?: string } = {},
  ): Promise<Resposta> {
    const fhir = url.startsWith(this.fhirBase);
    const cabecalhos: Record<string, string> = {};
    const accept = o.accept === undefined ? (fhir ? 'application/fhir+json' : 'application/json') : o.accept;
    if (accept !== null) cabecalhos.accept = accept;
    if (!o.semInteracao) cabecalhos['x-fapi-interaction-id'] = randomUUID();
    if (o.token) cabecalhos.authorization = `Bearer ${o.token}`;
    let corpo: string | undefined;
    if (o.corpo !== undefined) {
      corpo = typeof o.corpo === 'string' ? o.corpo : JSON.stringify(o.corpo);
      cabecalhos['content-type'] = o.tipo ?? (fhir ? 'application/fhir+json' : 'application/json');
    }
    return this.http.requisitar(url, {
      metodo,
      cabecalhos: { ...cabecalhos, ...(o.cabecalhos ?? {}) },
      ...(corpo !== undefined ? { corpo } : {}),
      credencial: o.credencial === undefined ? (o.token && this.certificadoDoToken.get(o.token)) || this.cliente('principal').credenciais[0]! : o.credencial,
    });
  }

  async fhir(token: string, caminho: string, o: Parameters<Contexto['api']>[2] & { metodo?: string } = {}): Promise<Resposta> {
    const url = caminho.startsWith('https://') ? caminho : `${this.fhirBase}/${caminho.replace(/^\//, '')}`;
    return this.api(o.metodo ?? 'GET', url, { ...o, token });
  }

  async consentimentos(metodo: string, caminho: string, token: string, o: Parameters<Contexto['api']>[2] = {}): Promise<Resposta> {
    return this.api(metodo, `${this.apiBase}/consents${caminho}`, { ...o, token });
  }

  corpoDeConsentimento(o: { escopos?: string[]; expiracaoMs?: number; dataPeriod?: { start?: string; end?: string } } = {}): Record<string, unknown> {
    const expira = new Date(o.expiracaoMs ?? this.agoraMs() + 90 * 24 * 3600_000).toISOString().replace(/\.\d{3}Z$/, 'Z');
    return {
      scopes: o.escopos ?? ESCOPOS_DE_PACIENTE,
      purpose: 'Teste de conformidade do Open Labs Brasil com dados sintéticos.',
      expiration_date_time: expira,
      ...(o.dataPeriod ? { data_period: o.dataPeriod } : {}),
    };
  }

  /** Cria um consentimento e devolve o consent_id. */
  async novoConsentimento(c: ClienteDeTeste, o: Parameters<Contexto['corpoDeConsentimento']>[0] = {}): Promise<string> {
    const token = await this.tokenDeProvedor(c, 'consent.manage');
    const r = await this.consentimentos('POST', '', token, { corpo: this.corpoDeConsentimento(o), credencial: c.credenciais[0]! });
    const id = (r.json as { consent_id?: unknown } | undefined)?.consent_id;
    if (r.status !== 201 || typeof id !== 'string') falhar(`POST /consents recusado: ${r.status} ${r.texto.slice(0, 200)}`);
    return id;
  }

  async lerConsentimento(c: ClienteDeTeste, consentId: string, token?: string): Promise<Resposta> {
    const t = token ?? (await this.tokenDeProvedor(c, 'consent.manage'));
    return this.consentimentos('GET', `/${encodeURIComponent(consentId)}`, t, { credencial: c.credenciais[0]! });
  }

  async revogar(c: ClienteDeTeste, consentId: string, motivo?: string): Promise<Resposta> {
    const t = await this.tokenDeProvedor(c, 'consent.manage');
    const q = motivo ? `?reason=${encodeURIComponent(motivo)}` : '';
    return this.consentimentos('DELETE', `/${encodeURIComponent(consentId)}${q}`, t, { credencial: c.credenciais[0]! });
  }

  /** PAR com valores padrão válidos. `omitir` tira parâmetros; `trocar` substitui valores. */
  async par(
    c: ClienteDeTeste,
    consentId: string,
    o: { escopos?: string[]; trocar?: Record<string, string>; omitir?: string[]; credencial?: CredencialTls | null; assercao?: string | null } = {},
  ): Promise<{ resposta: Resposta; verificador: string; state: string; redirectUri: string }> {
    const { verificador, desafio } = pkce();
    const state = randomBytes(12).toString('base64url');
    const params: Record<string, string | undefined> = {
      client_id: c.clientId,
      response_type: 'code',
      redirect_uri: c.redirectUri,
      scope: [`consent:${consentId}`, ...(o.escopos ?? ESCOPOS_DE_PACIENTE)].join(' '),
      state,
      code_challenge: desafio,
      code_challenge_method: 'S256',
      ...(o.trocar ?? {}),
    };
    for (const k of o.omitir ?? []) delete params[k];
    const resposta = await this.postOAuth(this.endpoint('pushed_authorization_request_endpoint'), c, params, {
      ...(o.credencial !== undefined ? { credencial: o.credencial } : {}),
      ...(o.assercao !== undefined ? { assercao: o.assercao } : {}),
    });
    return { resposta, verificador, state, redirectUri: params.redirect_uri ?? c.redirectUri };
  }

  urlDeAutorizacao(clientId: string, requestUri: string): string {
    const u = new URL(this.endpoint('authorization_endpoint'));
    u.searchParams.set('client_id', clientId);
    u.searchParams.set('request_uri', requestUri);
    return u.toString();
  }

  /**
   * O paciente de teste conclui a jornada (login e decisão): pelas páginas
   * reais do provedor quando a configuração descreve os formulários, senão
   * pela interface de controle.
   */
  async jornada(clientId: string, requestUri: string, paciente: PacienteDeTeste, decisao: 'aprovar' | 'recusar' = 'aprovar'): Promise<ResultadoDaJornada> {
    if (this.cfg.jornada_por_formulario) return this.jornadaPorFormulario(clientId, requestUri, paciente, decisao);
    this.exigirControle('concluir a jornada do paciente');
    const r = await this.controle('POST', '/_controle/jornada', {
      client_id: clientId,
      request_uri: requestUri,
      usuario: paciente.usuario,
      ...(paciente.senha ? { senha: paciente.senha } : {}),
      decisao,
    });
    if (r.status !== 200) falhar(`interface de controle recusou a jornada: ${r.status} ${JSON.stringify(r.json)}`);
    return { ...(r.json as { status: number; location?: string; pagina_de_erro?: string }), origem: 'controle', saltos: [] };
  }

  private async jornadaPorFormulario(clientId: string, requestUri: string, paciente: PacienteDeTeste, decisao: 'aprovar' | 'recusar'): Promise<ResultadoDaJornada> {
    const f = this.cfg.jornada_por_formulario!;
    const senha = paciente.senha ?? naoVerificavel(`a configuração não traz a senha do paciente de teste ${paciente.usuario}`);
    const destino = new URL([...this.clientes.values()].find((c) => c.clientId === clientId)?.redirectUri ?? 'https://destino.invalido/');
    const saltos: ResultadoDaJornada['saltos'] = [];
    const pedir = async (metodo: string, url: string, campos?: Record<string, string>) => {
      const r = await this.http.requisitar(url, {
        metodo,
        credencial: null,
        ...(campos ? { cabecalhos: { 'content-type': 'application/x-www-form-urlencoded' }, corpo: new URLSearchParams(campos).toString() } : {}),
      });
      saltos.push({ metodo, url: url.replace(/\?.*$/, ''), status: r.status });
      return r;
    };
    const eDestino = (u: string) => {
      const x = new URL(u);
      return x.origin === destino.origin && x.pathname === destino.pathname;
    };
    /** Segue redirecionamentos dentro do provedor; para no destino do receptor. */
    const seguir = async (r: Resposta, url: string): Promise<{ r: Resposta; url: string; final?: string }> => {
      for (let i = 0; i < 5; i++) {
        const loc = r.cabecalhos.location;
        if (r.status < 300 || r.status >= 400 || typeof loc !== 'string') return { r, url };
        const proximo = new URL(loc, url).toString();
        if (eDestino(proximo)) return { r, url, final: proximo };
        url = proximo;
        r = await pedir('GET', url);
      }
      return { r, url };
    };
    const encerrar = (p: { r: Resposta; final?: string }, tela?: string): ResultadoDaJornada => ({
      status: p.r.status,
      ...(p.final ? { location: p.final } : { pagina_de_erro: p.r.texto.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300) }),
      origem: 'formulario',
      saltos,
      ...(tela ? { telaDeConsentimento: tela } : {}),
    });
    let url = this.urlDeAutorizacao(clientId, requestUri);
    let passo = await seguir(await pedir('GET', url), url);
    if (passo.final || passo.r.status >= 400) return encerrar(passo);
    const login = lerFormulario(passo.r.texto, passo.url) ?? falhar('a página de login não tem formulário POST');
    passo = await seguir(await pedir('POST', login.acao, { ...login.campos, [f.campo_usuario]: paciente.usuario, [f.campo_senha]: senha }), login.acao);
    if (passo.final || passo.r.status >= 400) return encerrar(passo);
    const tela = passo.r.texto;
    const consentimento = lerFormulario(tela, passo.url) ?? falhar('a tela de consentimento não tem formulário POST');
    url = consentimento.acao;
    passo = await seguir(await pedir('POST', url, { ...consentimento.campos, [f.campo_decisao]: decisao === 'aprovar' ? f.valor_aprovar : f.valor_recusar }), url);
    return encerrar(passo, tela);
  }

  async trocarCodigo(c: ClienteDeTeste, code: string, verificador: string, redirectUri: string, credencial?: CredencialTls): Promise<Resposta> {
    return this.token(c, { grant_type: 'authorization_code', code, redirect_uri: redirectUri, code_verifier: verificador }, credencial ? { credencial } : {});
  }

  /** Fluxo 2.2 completo: consentimento, PAR, jornada aprovada e troca do código. */
  async autorizar(
    c: ClienteDeTeste,
    o: { escopos?: string[]; paciente?: PacienteDeTeste; expiracaoMs?: number; dataPeriod?: { start?: string; end?: string } } = {},
  ): Promise<Autorizacao> {
    if (!this.cfg.jornada_por_formulario) this.exigirControle('concluir a jornada do paciente');
    const consentId = await this.novoConsentimento(c, o);
    const { resposta, verificador, state, redirectUri } = await this.par(c, consentId, o.escopos ? { escopos: o.escopos } : {});
    const requestUri = (resposta.json as { request_uri?: unknown } | undefined)?.request_uri;
    if (resposta.status !== 201 || typeof requestUri !== 'string') falhar(`PAR recusado: ${resposta.status} ${resposta.texto.slice(0, 200)}`);
    const j = await this.jornada(c.clientId, requestUri, o.paciente ?? this.paciente('principal'));
    if (!j.location) falhar(`a jornada não redirecionou: ${j.pagina_de_erro ?? j.status}`);
    const retorno = new URL(j.location);
    const code = retorno.searchParams.get('code');
    if (!code) falhar(`redirecionamento sem code: ${retorno.search}`);
    const r = await this.trocarCodigo(c, code, verificador, redirectUri);
    const corpo = r.json as { access_token?: unknown; refresh_token?: unknown } | undefined;
    if (r.status !== 200 || typeof corpo?.access_token !== 'string' || typeof corpo.refresh_token !== 'string') {
      falhar(`troca do código recusada: ${r.status} ${r.texto.slice(0, 200)}`);
    }
    return { consentId, accessToken: corpo.access_token, refreshToken: corpo.refresh_token, respostaDoToken: r, location: j.location, state, verificador, redirectUri };
  }

  async renovar(c: ClienteDeTeste, refreshToken: string, credencial?: CredencialTls): Promise<Resposta> {
    return this.token(c, { grant_type: 'refresh_token', refresh_token: refreshToken }, credencial ? { credencial } : {});
  }

  /** Lê o registro de teste como publicado (bytes e JSON). */
  registroAtualComoTexto(): string {
    return Buffer.from(this.bytesDoRegistro).toString('utf8');
  }

  lerJsonDaConfiguracao(caminho: string): unknown {
    return JSON.parse(readFileSync(caminhoDe(this.cfg, caminho), 'utf8'));
  }
}
