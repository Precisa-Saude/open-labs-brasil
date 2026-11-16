// Receptor mínimo: o backend de um aplicativo do paciente, só com o que a
// jornada de ponta a ponta precisa. Não depende do pacote cliente do
// fhir-brasil. Segue as regras do receptor onde a jornada passa por elas
// (identificadas pelo requisito RCP), mas não é um receptor completo: a
// revogação pendente fica só em memória, e não há tela nem armazenamento.

import { createHash, randomBytes, randomUUID } from 'node:crypto';
import https from 'node:https';
import { importJWK, SignJWT, type CryptoKey, type JWK, type KeyObject } from 'jose';
import { cpfValido } from '../../comum/cpf.ts';
import { dentroDaBase, divergenciasDosMetadados, urlDosMetadados } from '../../comum/metadados.ts';
import { versaoEfetiva, type DocumentoDoRegistro, type Participante } from '../../comum/registro.ts';

type Json = Record<string, unknown>;

export interface Credencial {
  cert: Buffer;
  key: Buffer;
}

export interface ConfiguracaoDoReceptor {
  /** Registro já verificado (V1 a V14) por quem cria o receptor. */
  registro: DocumentoDoRegistro;
  participantIdDoProvedor: string;
  clientId: string;
  chaveDeAssinatura: JWK;
  certificado: Credencial;
  /** Autoridades em que o receptor confia para o certificado do servidor. */
  ca: string;
}

interface Resposta {
  status: number;
  cabecalhos: Record<string, string | string[] | undefined>;
  json: unknown;
  texto: string;
}

export interface JornadaAberta {
  consentId: string;
  state: string;
  verificador: string;
  cpfDoPaciente: string;
  urlDeAutorizacao: string;
}

export interface Vinculo {
  consentId: string;
  pacienteFhirId: string;
  accessToken?: string;
  refreshToken?: string;
  acessoExpiraEm: number;
}

export type ResultadoDaConexao =
  | { ok: true; vinculo: Vinculo }
  | { ok: false; motivo: 'PATIENT_MISMATCH' | 'RECEIVER_TERMINATION' | 'RECUSADO_PELO_PACIENTE' | 'RESPOSTA_INVALIDA'; detalhe: string };

const MARGEM_DO_TOKEN_MS = 30_000;

export class ReceptorMinimo {
  readonly cfg: ConfiguracaoDoReceptor;
  readonly provedor: Participante;
  readonly eu: Participante;
  metadados: Json = {};
  private chave: CryptoKey | KeyObject | undefined;
  /** Tokens de provedor, um por escopo, só em memória (seção 5.3.4). */
  private readonly tokensDeProvedor = new Map<string, { token: string; expiraEm: number }>();
  private readonly jornadas = new Map<string, JornadaAberta>();
  readonly revogacoesPendentes: Array<{ consentId: string; motivo: string; desde: number }> = [];
  readonly log: string[] = [];

  constructor(cfg: ConfiguracaoDoReceptor) {
    this.cfg = cfg;
    const p = cfg.registro.participants.find((x) => x.participant_id === cfg.participantIdDoProvedor && x.role === 'provider');
    const eu = cfg.registro.participants.find((x) => x.role === 'receiver' && x.receiver?.client_id === cfg.clientId);
    if (!p?.provider || !eu?.receiver) throw new Error('Provedor ou receptor ausente do registro');
    this.provedor = p;
    this.eu = eu;
  }

  get fhirBase(): string {
    return this.provedor.provider!.fhir_base_url.replace(/\/$/, '');
  }
  get apiBase(): string {
    return this.provedor.provider!.api_base_url.replace(/\/$/, '');
  }

  // Transporte ------------------------------------------------------------------

  /** Requisição HTTPS com mTLS. Nunca segue redirecionamento (seção 5.1). */
  private requisitar(url: string, o: { metodo?: string; cabecalhos?: Record<string, string>; corpo?: string; semCertificado?: boolean } = {}): Promise<Resposta> {
    return new Promise((resolver, rejeitar) => {
      const cabecalhos: Record<string, string | number> = { ...(o.cabecalhos ?? {}) };
      if (o.corpo !== undefined) cabecalhos['content-length'] = Buffer.byteLength(o.corpo);
      const req = https.request(url, {
        method: o.metodo ?? 'GET',
        headers: cabecalhos,
        ca: this.cfg.ca,
        agent: false,
        ...(o.semCertificado ? {} : { cert: this.cfg.certificado.cert, key: this.cfg.certificado.key }),
      }, (res) => {
        const partes: Buffer[] = [];
        res.on('data', (p: Buffer) => partes.push(p));
        res.on('end', () => {
          const texto = Buffer.concat(partes).toString('utf8');
          let json: unknown;
          try {
            json = texto ? JSON.parse(texto) : undefined;
          } catch {
            json = undefined;
          }
          resolver({ status: res.statusCode ?? 0, cabecalhos: res.headers, json, texto });
        });
      });
      req.on('error', rejeitar);
      if (o.corpo !== undefined) req.write(o.corpo);
      req.end();
    });
  }

  /** Chamada às APIs do provedor: x-fapi-interaction-id novo a cada chamada (RCP-016). */
  private async api(metodo: string, url: string, token: string, o: { corpo?: unknown; cabecalhos?: Record<string, string> } = {}): Promise<Resposta> {
    const fhir = url.startsWith(this.fhirBase);
    const tipo = fhir ? 'application/fhir+json' : 'application/json';
    return this.requisitar(url, {
      metodo,
      cabecalhos: {
        authorization: `Bearer ${token}`,
        accept: tipo,
        'x-fapi-interaction-id': randomUUID(),
        ...(o.corpo !== undefined ? { 'content-type': tipo } : {}),
        ...(o.cabecalhos ?? {}),
      },
      ...(o.corpo !== undefined ? { corpo: JSON.stringify(o.corpo) } : {}),
    });
  }

  // Descoberta --------------------------------------------------------------------

  /** Versão efetiva (RCP-037) e metadados com todos os valores da seção 5.2 (RCP-008, RCP-031). */
  async descobrir(): Promise<void> {
    const versao = versaoEfetiva(this.eu.protocol_versions, this.provedor.protocol_versions);
    if (!versao) throw new Error('Sem versão de protocolo efetiva com o provedor: ele não é oferecido ao paciente');
    if (this.provedor.status !== 'active') throw new Error('Provedor fora de active no registro');
    const r = await this.requisitar(urlDosMetadados(this.provedor.provider!.issuer), { semCertificado: true });
    if (r.status !== 200) throw new Error(`Metadados indisponíveis: ${r.status}`);
    const m = r.json as Json;
    const erros = divergenciasDosMetadados(m, this.provedor.provider!.issuer, this.provedor.provider!.scopes_supported);
    if (erros.length) throw new Error(`Provedor recusado: ${erros.join('; ')}`);
    this.metadados = m;
    this.chave = (await importJWK(this.cfg.chaveDeAssinatura, 'PS256')) as CryptoKey | KeyObject;
    this.log.push(`provedor ${this.provedor.display_name}, versão efetiva ${versao}, metadados conferidos`);
  }

  private endpoint(nome: string): string {
    const aliases = this.metadados.mtls_endpoint_aliases as Record<string, string> | undefined;
    const v = aliases?.[nome] ?? this.metadados[nome];
    if (typeof v !== 'string') throw new Error(`Metadados sem ${nome}`);
    return v;
  }

  // Servidor de autorização -----------------------------------------------------

  /** Asserção private_key_jwt com o issuer, como texto simples, em aud (RCP-007). */
  private async assercao(): Promise<string> {
    const agora = Math.floor(Date.now() / 1000);
    return new SignJWT({ jti: randomUUID() })
      .setProtectedHeader({ alg: 'PS256', kid: this.cfg.chaveDeAssinatura.kid!, typ: 'JWT' })
      .setIssuer(this.cfg.clientId)
      .setSubject(this.cfg.clientId)
      .setAudience(this.provedor.provider!.issuer)
      .setIssuedAt(agora)
      .setExpirationTime(agora + 60)
      .sign(this.chave!);
  }

  private async postOAuth(endpoint: string, params: Record<string, string>): Promise<Resposta> {
    const form = new URLSearchParams({
      client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
      client_assertion: await this.assercao(),
      ...params,
    });
    return this.requisitar(this.endpoint(endpoint), {
      metodo: 'POST',
      cabecalhos: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
      corpo: form.toString(),
    });
  }

  /** Um token por escopo; consent.manage sempre sozinho (RCP-032). Usado só até expires_in menos a margem (RCP-034). */
  async tokenDeProvedor(escopo: string): Promise<string> {
    const atual = this.tokensDeProvedor.get(escopo);
    if (atual && Date.now() < atual.expiraEm) return atual.token;
    const r = await this.postOAuth('token_endpoint', { grant_type: 'client_credentials', scope: escopo });
    const corpo = r.json as { access_token?: string; expires_in?: number } | undefined;
    if (r.status !== 200 || !corpo?.access_token) throw new Error(`Token de provedor (${escopo}) recusado: ${r.status} ${r.texto}`);
    this.tokensDeProvedor.set(escopo, { token: corpo.access_token, expiraEm: Date.now() + (corpo.expires_in ?? 300) * 1000 - MARGEM_DO_TOKEN_MS });
    return corpo.access_token;
  }

  // Leitura sem paciente -------------------------------------------------------

  /** Busca paginada que não segue link fora do fhir_base_url (RCP-030). */
  async buscarTudo(token: string, caminho: string): Promise<Json[]> {
    const itens: Json[] = [];
    let url: string | undefined = `${this.fhirBase}/${caminho}`;
    while (url) {
      if (!dentroDaBase(url, this.fhirBase)) throw new Error(`Link de paginação fora do fhir_base_url: ${url}`);
      const r = await this.api('GET', url, token);
      if (r.status !== 200) throw new Error(`Busca ${caminho} falhou: ${r.status} ${r.texto}`);
      const b = r.json as { entry?: Array<{ resource: Json; search?: { mode?: string } }>; link?: Array<{ relation: string; url: string }> };
      itens.push(...(b.entry ?? []).filter((e) => (e.search?.mode ?? 'match') === 'match').map((e) => e.resource));
      url = b.link?.find((l) => l.relation === 'next')?.url;
    }
    return itens;
  }

  async catalogo(): Promise<{ exames: Json[]; precos: Json[] }> {
    const token = await this.tokenDeProvedor('catalog.read');
    return {
      exames: await this.buscarTudo(token, 'ActivityDefinition?status=active&_count=100'),
      precos: await this.buscarTudo(token, 'ChargeItemDefinition?status=active&_count=100'),
    };
  }

  async unidades(): Promise<Json[]> {
    return this.buscarTudo(await this.tokenDeProvedor('locations.read'), 'Location?status=active');
  }

  /**
   * Preço de um exame numa unidade, lendo os três alcances (seção 5.5.2): a
   * unidade, a região (com ou sem marca) e o município. Não supõe que um preço
   * com contexto valha para todas as unidades.
   */
  precoNaUnidade(exame: Json, precos: Json[], unidade: Json, municipio?: string): number | undefined {
    const chave = (c: { system?: string; code?: string }) => `${c.system}|${c.code}`;
    const codigos = new Set(((exame.code as Json).coding as Array<{ system?: string; code?: string }>).map(chave));
    const doExame = precos.filter((p) => ((p.code as Json).coding as Array<{ system?: string; code?: string }>).some((c) => codigos.has(chave(c))));
    const valor = (p: Json) => (((p.propertyGroup as Json[])[0]!.priceComponent as Json[]).find((x) => x.type === 'base')!.amount as { value: number }).value;
    const contextos = (p: Json) => ((p.useContext as Array<{ valueReference?: { reference?: string } }> | undefined) ?? []).map((u) => u.valueReference?.reference);
    const ref = `Location/${String(unidade.id)}`;
    const regiao = (unidade.partOf as { reference?: string } | undefined)?.reference;
    const daUnidade = doExame.find((p) => contextos(p).includes(ref));
    if (daUnidade) return valor(daUnidade);
    const daRegiao = regiao ? doExame.find((p) => contextos(p).includes(regiao)) : undefined;
    if (daRegiao) return valor(daRegiao);
    const doMunicipio = municipio
      ? doExame.find((p) => contextos(p).length === 0 && ((p.jurisdiction as Array<{ coding: Array<{ code: string }> }> | undefined) ?? []).some((j) => j.coding.some((c) => c.code === municipio)))
      : undefined;
    return doMunicipio ? valor(doMunicipio) : undefined;
  }

  async horarios(unidade: string, exames: Json[], dias = 7): Promise<Json[]> {
    const token = await this.tokenDeProvedor('schedule.read');
    const agendas = await this.buscarTudo(token, `Schedule?actor=${encodeURIComponent(unidade)}&active=true`);
    if (!agendas[0]) return [];
    const q = new URLSearchParams();
    q.append('schedule', `Schedule/${String(agendas[0].id)}`);
    q.append('status', 'free');
    q.append('start', `ge${new Date().toISOString()}`);
    q.append('start', `lt${new Date(Date.now() + dias * 86_400_000).toISOString()}`);
    for (const e of exames) {
      const c = ((e.code as Json).coding as Array<{ system: string; code: string }>)[0]!;
      q.append('service-type', `${c.system}|${c.code}`);
    }
    q.append('_count', '100');
    return this.buscarTudo(token, `Slot?${q.toString()}`);
  }

  // Conexão do paciente (fluxo 2.2) ---------------------------------------------

  /** Cria o consentimento sem identificar o paciente (RCP-011) e faz o PAR com PKCE novo (RCP-004). */
  async iniciarConexao(cpfDoPaciente: string, escopos = ['appointment.write', 'results.read', 'consent.read'], finalidade = 'Reunir seus resultados de exames e agendar exames quando você pedir.'): Promise<JornadaAberta> {
    const token = await this.tokenDeProvedor('consent.manage');
    const expira = new Date(Date.now() + 180 * 86_400_000).toISOString().replace(/\.\d{3}Z$/, 'Z');
    const c = await this.api('POST', `${this.apiBase}/consents`, token, { corpo: { scopes: escopos, purpose: finalidade, expiration_date_time: expira } });
    const consentId = (c.json as { consent_id?: string } | undefined)?.consent_id;
    if (c.status !== 201 || !consentId) throw new Error(`Consentimento recusado: ${c.status} ${c.texto}`);
    const verificador = randomBytes(32).toString('base64url');
    const state = randomBytes(16).toString('base64url');
    const par = await this.postOAuth('pushed_authorization_request_endpoint', {
      client_id: this.cfg.clientId,
      response_type: 'code',
      redirect_uri: this.eu.receiver!.redirect_uris[0]!,
      scope: [`consent:${consentId}`, ...escopos].join(' '),
      state,
      code_challenge: createHash('sha256').update(verificador).digest('base64url'),
      code_challenge_method: 'S256',
    });
    const requestUri = (par.json as { request_uri?: string } | undefined)?.request_uri;
    if (par.status !== 201 || !requestUri) throw new Error(`PAR recusado: ${par.status} ${par.texto}`);
    const u = new URL(this.endpoint('authorization_endpoint'));
    u.searchParams.set('client_id', this.cfg.clientId);
    u.searchParams.set('request_uri', requestUri);
    const jornada = { consentId, state, verificador, cpfDoPaciente, urlDeAutorizacao: u.toString() };
    this.jornadas.set(state, jornada);
    return jornada;
  }

  /**
   * Retorno do navegador: confere state (RCP-005) e iss (RCP-006), troca o
   * código e faz a conferência do titular antes de qualquer chamada FHIR
   * (RCP-012, RCP-013, RCP-027).
   */
  async concluirConexao(urlDeRetorno: string): Promise<ResultadoDaConexao> {
    const u = new URL(urlDeRetorno);
    const jornada = this.jornadas.get(u.searchParams.get('state') ?? '');
    if (!jornada) return { ok: false, motivo: 'RESPOSTA_INVALIDA', detalhe: 'state desconhecido' };
    if (u.searchParams.get('iss') !== this.provedor.provider!.issuer) return { ok: false, motivo: 'RESPOSTA_INVALIDA', detalhe: 'iss ausente ou diferente do issuer' };
    this.jornadas.delete(jornada.state);
    if (u.searchParams.get('error')) return { ok: false, motivo: 'RECUSADO_PELO_PACIENTE', detalhe: u.searchParams.get('error')! };
    const code = u.searchParams.get('code');
    if (!code) return { ok: false, motivo: 'RESPOSTA_INVALIDA', detalhe: 'sem code' };
    const t = await this.postOAuth('token_endpoint', {
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.eu.receiver!.redirect_uris[0]!,
      code_verifier: jornada.verificador,
    });
    const tokens = t.json as { access_token?: string; refresh_token?: string; expires_in?: number } | undefined;
    if (t.status !== 200 || !tokens?.access_token) return { ok: false, motivo: 'RESPOSTA_INVALIDA', detalhe: `troca do código: ${t.status}` };

    const leitura = await this.api('GET', `${this.apiBase}/consents/${jornada.consentId}`, tokens.access_token);
    const paciente = (leitura.json as { patient?: { cpf?: unknown; fhir_id?: unknown } } | undefined)?.patient;
    if (leitura.status !== 200 || !cpfValido(paciente?.cpf) || typeof paciente?.fhir_id !== 'string') {
      await this.revogar({ consentId: jornada.consentId, pacienteFhirId: '', acessoExpiraEm: 0 }, 'RECEIVER_TERMINATION');
      return { ok: false, motivo: 'RECEIVER_TERMINATION', detalhe: 'conferência do titular impossível' };
    }
    if (paciente.cpf !== jornada.cpfDoPaciente.replace(/\D/g, '')) {
      // O CPF recebido é descartado aqui, sem ir a log nem ao aplicativo (RCP-015).
      await this.revogar({ consentId: jornada.consentId, pacienteFhirId: '', acessoExpiraEm: 0 }, 'PATIENT_MISMATCH');
      return { ok: false, motivo: 'PATIENT_MISMATCH', detalhe: 'a conta usada no laboratório é de outra pessoa' };
    }
    this.log.push(`vínculo ${jornada.consentId.slice(0, 8)} concluído, titular conferido`);
    return {
      ok: true,
      vinculo: {
        consentId: jornada.consentId,
        pacienteFhirId: paciente.fhir_id,
        accessToken: tokens.access_token,
        ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
        acessoExpiraEm: Date.now() + (tokens.expires_in ?? 300) * 1000 - MARGEM_DO_TOKEN_MS,
      },
    };
  }

  /** Token de paciente válido: renova antes de passar de expires_in (RCP-034) e aceita refresh token novo (RCP-010). */
  private async tokenDoVinculo(v: Vinculo): Promise<string> {
    if (v.accessToken && Date.now() < v.acessoExpiraEm) return v.accessToken;
    if (!v.refreshToken) throw new Error('Vínculo sem tokens');
    const r = await this.postOAuth('token_endpoint', { grant_type: 'refresh_token', refresh_token: v.refreshToken });
    const t = r.json as { access_token?: string; refresh_token?: string; expires_in?: number } | undefined;
    if (r.status !== 200 || !t?.access_token) throw new Error(`Renovação recusada: ${r.status} ${r.texto}`);
    v.accessToken = t.access_token;
    if (t.refresh_token) v.refreshToken = t.refresh_token;
    v.acessoExpiraEm = Date.now() + (t.expires_in ?? 300) * 1000 - MARGEM_DO_TOKEN_MS;
    return t.access_token;
  }

  async resultados(v: Vinculo): Promise<Json[]> {
    return this.buscarTudo(await this.tokenDoVinculo(v), `DiagnosticReport?patient=Patient/${v.pacienteFhirId}&_include=DiagnosticReport:result`);
  }

  // Agendamento (fluxo 2.4) ------------------------------------------------------

  /** Cria o agendamento: coding do catálogo copiados (seção 5.5.5), If-None-Exist literal (RCP-036), 200 tratado como sucesso (RCP-021). */
  async agendar(v: Vinculo, o: { slot: Json; exames: Json[]; unidade: string }): Promise<Json> {
    const token = await this.tokenDoVinculo(v);
    const paciente = `Patient/${v.pacienteFhirId}`;
    const contidos = o.exames.map((e, i) => ({
      resourceType: 'ServiceRequest',
      id: `exame-${i + 1}`,
      status: 'active',
      intent: 'order',
      code: { coding: (e.code as Json).coding },
      instantiatesCanonical: [e.url],
      subject: { reference: paciente, type: 'Patient' },
    }));
    const sistema = `${new URL(this.eu.receiver!.redirect_uris[0]!).origin}/agendamentos`;
    const valor = randomUUID();
    const corpo = {
      resourceType: 'Appointment',
      meta: { profile: ['https://fhir-brasil.dev.br/ig/StructureDefinition/br-lab-appointment'] },
      contained: contidos,
      identifier: [{ system: sistema, value: valor }],
      status: 'proposed',
      start: o.slot.start,
      end: o.slot.end,
      slot: [{ reference: `Slot/${String(o.slot.id)}` }],
      basedOn: contidos.map((c) => ({ reference: `#${c.id}` })),
      participant: [
        { actor: { reference: paciente, type: 'Patient' }, status: 'accepted' },
        { actor: { reference: o.unidade, type: 'Location' }, status: 'needs-action' },
      ],
    };
    const cabecalhos = { 'if-none-exist': `identifier=${sistema}|${valor}`, prefer: 'return=representation' };
    let r = await this.api('POST', `${this.fhirBase}/Appointment`, token, { corpo, cabecalhos });
    if (r.status === 200) {
      r = await this.api('GET', `${this.fhirBase}/Appointment?identifier=${encodeURIComponent(`${sistema}|${valor}`)}`, token);
      const existente = (r.json as { entry?: Array<{ resource: Json }> }).entry?.[0]?.resource;
      if (existente) return existente;
    }
    if (r.status !== 201) throw new Error(`Agendamento recusado: ${r.status} ${r.texto}`);
    return r.json as Json;
  }

  /** Só a extensão de URL canônica, e só https (RCP-035). */
  linkDePagamento(agendamento: Json): string | undefined {
    const ext = ((agendamento.extension as Json[] | undefined) ?? []).find((e) => e.url === 'https://fhir-brasil.dev.br/ig/StructureDefinition/payment-link');
    const link = ext?.valueUrl;
    return typeof link === 'string' && link.startsWith('https://') ? link : undefined;
  }

  async lerAgendamento(v: Vinculo, id: string): Promise<{ recurso: Json; etag: string }> {
    const r = await this.api('GET', `${this.fhirBase}/Appointment/${id}`, await this.tokenDoVinculo(v));
    if (r.status !== 200) throw new Error(`Leitura do agendamento: ${r.status}`);
    const etag = r.cabecalhos.etag;
    return { recurso: r.json as Json, etag: Array.isArray(etag) ? etag[0]! : etag ?? '' };
  }

  async cancelar(v: Vinculo, id: string, motivo = 'Cancelado pelo paciente no aplicativo'): Promise<Json> {
    const { recurso, etag } = await this.lerAgendamento(v, id);
    const r = await this.api('PUT', `${this.fhirBase}/Appointment/${id}`, await this.tokenDoVinculo(v), {
      corpo: { ...recurso, status: 'cancelled', cancelationReason: { text: motivo } },
      cabecalhos: { 'if-match': etag },
    });
    if (r.status !== 200) throw new Error(`Cancelamento recusado: ${r.status} ${r.texto}`);
    return r.json as Json;
  }

  // Revogação (fluxo 2.6) -----------------------------------------------------------

  /**
   * Descarta os tokens antes de chamar o provedor (RCP-017), faz no máximo três
   * tentativas com recuo e Retry-After (RCP-028) e trata 404 e 422 como
   * concluída (RCP-029). Sem sucesso, a revogação fica pendente (aqui, só em
   * memória).
   */
  async revogar(v: Vinculo, motivo = 'PATIENT_REQUEST'): Promise<'revogado' | 'pendente'> {
    delete v.accessToken;
    delete v.refreshToken;
    v.acessoExpiraEm = 0;
    let espera = 1000;
    for (let tentativa = 1; tentativa <= 3; tentativa++) {
      try {
        const token = await this.tokenDeProvedor('consent.manage');
        const r = await this.api('DELETE', `${this.apiBase}/consents/${v.consentId}?reason=${motivo}`, token);
        if (r.status === 204 || r.status === 404 || r.status === 422) return 'revogado';
        if (r.status < 500 && r.status !== 429) break;
        const ra = Number(Array.isArray(r.cabecalhos['retry-after']) ? r.cabecalhos['retry-after'][0] : r.cabecalhos['retry-after']);
        if (ra > 0) espera = Math.max(espera, ra * 1000);
      } catch {
        // falha de rede: tenta de novo
      }
      if (tentativa < 3) await new Promise((res) => setTimeout(res, espera));
      espera *= 2;
    }
    this.revogacoesPendentes.push({ consentId: v.consentId, motivo, desde: Date.now() });
    return 'pendente';
  }
}
