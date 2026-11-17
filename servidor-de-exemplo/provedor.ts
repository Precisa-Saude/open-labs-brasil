// Estado do provedor simulado: consentimentos (máquina de estados do capítulo
// 4), pedidos PAR, códigos de autorização e tokens. Tudo em memória.

import { randomBytes } from 'node:crypto';
import type { Escopo, Participante } from '../comum/registro.ts';
import { instante, type ConfiguracaoDoServidor, type Relogio } from './configuracao.ts';
import { DadosSinteticos, PACIENTES, type Paciente } from './dados.ts';
import { novoId } from './http.ts';
import type { RegistroDoProvedor } from './registro-do-provedor.ts';

export type EstadoDoConsentimento = 'AWAITING_AUTHORISATION' | 'AUTHORISED' | 'REJECTED' | 'REVOKED' | 'EXPIRED';
export type CodigoDoMotivo =
  | 'PATIENT_REJECTED' | 'AUTHORISATION_TIMEOUT' | 'PATIENT_WITHOUT_CPF' | 'PATIENT_MISMATCH' | 'PATIENT_REQUEST'
  | 'RECEIVER_TERMINATION' | 'RECEIVER_WITHDRAWN' | 'PROVIDER_SECURITY' | 'TECHNICAL_ISSUE' | 'MAX_DATE_REACHED';
export type EncerradoPor = 'RECEIVER' | 'PROVIDER' | 'SYSTEM';

export const ESTADOS_FINAIS: EstadoDoConsentimento[] = ['REJECTED', 'REVOKED', 'EXPIRED'];

export interface Consentimento {
  consent_id: string;
  client_id: string;
  status: EstadoDoConsentimento;
  criadoEm: number;
  atualizadoEm: number;
  expiraEm: number;
  scopes: Escopo[];
  purpose: string;
  data_period?: { start?: string; end?: string };
  status_reason?: { code: CodigoDoMotivo; ended_via: EncerradoPor; additional_information?: string };
  paciente?: { cpf: string; fhirId: string };
  autorizadoEm?: number;
  /** Código emitido na aprovação e ainda não trocado (T14). */
  codigoPendente?: { expiraEm: number };
  historico: Array<{ status: EstadoDoConsentimento; em: number; code?: CodigoDoMotivo; ended_via?: EncerradoPor }>;
}

export interface PedidoPar {
  requestUri: string;
  clientId: string;
  redirectUri: string;
  consentId: string;
  escopos: string[];
  state: string;
  codeChallenge?: string;
  expiraEm: number;
  usado: boolean;
}

export interface CodigoDeAutorizacao {
  code: string;
  clientId: string;
  redirectUri: string;
  consentId: string;
  codeChallenge?: string;
  escopos: string[];
  expiraEm: number;
  usado: boolean;
  tokensEmitidos: string[];
}

export interface TokenDeAcesso {
  token: string;
  tipo: 'provedor' | 'paciente';
  clientId: string;
  escopos: string[];
  consentId?: string;
  x5t: string;
  expiraEm: number;
  revogado: boolean;
  /** Chamadas no minuto corrente, para o limite de chamadas. */
  janela: { inicio: number; chamadas: number };
}

export interface RefreshToken {
  token: string;
  clientId: string;
  consentId: string;
  escopos: string[];
  revogado: boolean;
}

/** Transação de autorização aberta no navegador (página de login). */
export interface TransacaoDeAutorizacao {
  id: string;
  requestUri: string;
  pacienteId?: string;
  criadaEm: number;
}

/** Sessão do paciente na página de consentimentos do provedor. */
export interface SessaoDoPaciente {
  id: string;
  pacienteId: string;
  criadaEm: number;
}

const SESSENTA_MINUTOS = 60 * 60_000;
const VALIDADE_DO_CODIGO_MS = 60_000;

export function segredo(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export class Provedor {
  readonly cfg: ConfiguracaoDoServidor;
  readonly relogio: Relogio;
  readonly registro: RegistroDoProvedor;
  readonly dados: DadosSinteticos;
  readonly consentimentos = new Map<string, Consentimento>();
  readonly pedidosPar = new Map<string, PedidoPar>();
  readonly codigos = new Map<string, CodigoDeAutorizacao>();
  readonly tokens = new Map<string, TokenDeAcesso>();
  readonly refreshTokens = new Map<string, RefreshToken>();
  readonly jtis = new Map<string, number>();
  readonly transacoes = new Map<string, TransacaoDeAutorizacao>();
  readonly sessoes = new Map<string, SessaoDoPaciente>();
  /** Manutenção simulada pela interface de controle: APIs respondem 503 com Retry-After. */
  emManutencao = false;
  readonly log: (mensagem: string) => void;

  constructor(cfg: ConfiguracaoDoServidor, relogio: Relogio, registro: RegistroDoProvedor, log: (m: string) => void) {
    this.cfg = cfg;
    this.relogio = relogio;
    this.registro = registro;
    this.log = log;
    this.dados = new DadosSinteticos(relogio.agoraMs());
    if (cfg.violacoes.has('preco-sem-exame')) {
      const base = [...this.dados.tipo('ChargeItemDefinition').values()][0]!;
      this.dados.gravar({ ...structuredClone(base.recurso), id: 'preco-orfao', url: 'https://laboratorio.example/fhir/ChargeItemDefinition/preco-orfao', code: { coding: [{ system: 'https://laboratorio.example/fhir/produtos', code: 'NAO-EXISTE' }] } }, base.atualizadoEm);
    }
    if (cfg.violacoes.has('contexto-de-preco-desconhecido')) {
      const base = [...this.dados.tipo('ChargeItemDefinition').values()][0]!;
      this.dados.gravar({
        ...structuredClone(base.recurso),
        id: 'preco-de-programa',
        url: 'https://laboratorio.example/fhir/ChargeItemDefinition/preco-de-programa',
        useContext: [{ code: { system: 'http://terminology.hl7.org/CodeSystem/usage-context-type', code: 'program' }, valueCodeableConcept: { text: 'Programa de fidelidade' } }],
      }, base.atualizadoEm);
    }
    if (cfg.violacoes.has('observacao-sem-loinc')) {
      const obs = this.dados.tipo('Observation').get('obs-ana-2026-rotina-gli')!;
      obs.recurso = { ...obs.recurso, code: { coding: [{ system: 'https://laboratorio.example/fhir/produtos', code: 'GLI', display: 'Glicose' }] } };
    }
    registro.aoAceitar = (_anterior, novo) => {
      // T13: receptor retirado do registro tem os consentimentos AUTHORISED revogados.
      for (const p of novo.participants) {
        if (p.role === 'receiver' && p.status === 'withdrawn') {
          for (const c of this.consentimentos.values()) {
            this.atualizarEstado(c);
            if (c.client_id === p.participant_id && c.status === 'AUTHORISED') {
              this.transicionar(c, 'REVOKED', 'RECEIVER_WITHDRAWN', 'SYSTEM');
            }
          }
        }
      }
    };
  }

  // Endereços, todos lidos do registro.
  get participante(): Participante {
    return this.registro.provedor();
  }
  get issuer(): string {
    return this.participante.provider!.issuer;
  }
  get fhirBaseUrl(): string {
    return this.participante.provider!.fhir_base_url;
  }
  get apiBaseUrl(): string {
    return this.participante.provider!.api_base_url;
  }
  get urlMtls(): string {
    return new URL(this.fhirBaseUrl).origin;
  }

  violacao(nome: Parameters<ConfiguracaoDoServidor['violacoes']['has']>[0]): boolean {
    return this.cfg.violacoes.has(nome);
  }

  paciente(id: string): Paciente | undefined {
    return PACIENTES.find((p) => p.id === id);
  }

  // Consentimento ------------------------------------------------------------

  criarConsentimento(clientId: string, dados: { scopes: Escopo[]; purpose: string; expiraEm: number; data_period?: { start?: string; end?: string } }): Consentimento {
    const agora = this.relogio.agoraMs();
    const c: Consentimento = {
      consent_id: novoId(),
      client_id: clientId,
      status: 'AWAITING_AUTHORISATION',
      criadoEm: agora,
      atualizadoEm: agora,
      expiraEm: dados.expiraEm,
      scopes: dados.scopes,
      purpose: dados.purpose,
      ...(dados.data_period ? { data_period: dados.data_period } : {}),
      historico: [{ status: 'AWAITING_AUTHORISATION', em: agora }],
    };
    this.consentimentos.set(c.consent_id, c);
    return c;
  }

  /** Aplica uma transição permitida (seção 4.3). Estados finais não mudam. */
  transicionar(c: Consentimento, para: EstadoDoConsentimento, code?: CodigoDoMotivo, via?: EncerradoPor, em = this.relogio.agoraMs()): void {
    if (ESTADOS_FINAIS.includes(c.status)) throw new Error(`Transição a partir de estado final: ${c.status}`);
    const permitidas: Record<EstadoDoConsentimento, EstadoDoConsentimento[]> = {
      AWAITING_AUTHORISATION: ['AUTHORISED', 'REJECTED'],
      AUTHORISED: ['REVOKED', 'EXPIRED'],
      REJECTED: [],
      REVOKED: [],
      EXPIRED: [],
    };
    if (!permitidas[c.status].includes(para)) throw new Error(`Transição não permitida: ${c.status} para ${para}`);
    c.status = para;
    c.atualizadoEm = em;
    if (code && via) c.status_reason = { code, ended_via: via };
    c.historico.push({ status: para, em, ...(code ? { code } : {}), ...(via ? { ended_via: via } : {}) });
    if (para === 'AUTHORISED') c.autorizadoEm = em;
    if (para === 'REVOKED' || para === 'EXPIRED') this.invalidarTokensDoConsentimento(c.consent_id);
    this.log(`consentimento ${c.consent_id.slice(0, 8)} passou a ${para}${code ? ` (${code})` : ''}`);
  }

  /** Transições que dependem do relógio: T4, T14 e T15. */
  atualizarEstado(c: Consentimento): void {
    const agora = this.relogio.agoraMs();
    if (c.status === 'AWAITING_AUTHORISATION' && !this.violacao('consentimento-sem-prazo-de-autorizacao')) {
      const limite = c.criadoEm + SESSENTA_MINUTOS;
      if (agora >= limite) this.transicionar(c, 'REJECTED', 'AUTHORISATION_TIMEOUT', 'SYSTEM', limite);
    }
    if (c.status === 'AUTHORISED' && c.codigoPendente && agora >= c.codigoPendente.expiraEm) {
      this.transicionar(c, 'REVOKED', 'TECHNICAL_ISSUE', 'SYSTEM', c.codigoPendente.expiraEm);
    }
    if (c.status === 'AUTHORISED' && agora >= c.expiraEm && !this.violacao('consentimento-nao-expira')) {
      this.transicionar(c, 'EXPIRED', 'MAX_DATE_REACHED', 'SYSTEM', c.expiraEm);
    }
  }

  consentimento(id: string): Consentimento | undefined {
    const c = this.consentimentos.get(id);
    if (c) this.atualizarEstado(c);
    return c;
  }

  /** Representação do protocolo (seção 5.4). `comPaciente` só com token de paciente ligado ao consentimento. */
  representar(c: Consentimento, comPaciente: boolean): Record<string, unknown> {
    const corpo: Record<string, unknown> = {
      consent_id: c.consent_id,
      status: c.status,
      creation_date_time: instante(c.criadoEm),
      status_update_date_time: instante(c.atualizadoEm),
      expiration_date_time: instante(c.expiraEm),
      scopes: c.scopes,
      purpose: c.purpose,
    };
    if (c.data_period) corpo.data_period = c.data_period;
    if (c.status_reason && ESTADOS_FINAIS.includes(c.status)) corpo.status_reason = c.status_reason;
    if (comPaciente && c.paciente) corpo.patient = { cpf: this.violacao('cpf-errado-na-leitura') ? '00000000191' : c.paciente.cpf, fhir_id: c.paciente.fhirId };
    return corpo;
  }

  invalidarTokensDoConsentimento(consentId: string): void {
    if (this.violacao('revogacao-nao-invalida-tokens')) return;
    for (const t of this.tokens.values()) if (t.consentId === consentId) t.revogado = true;
    for (const r of this.refreshTokens.values()) if (r.consentId === consentId) r.revogado = true;
  }

  // Tokens -------------------------------------------------------------------

  validadeDoToken(): number {
    return this.violacao('token-longo') ? 3600 : 600;
  }

  emitirToken(dados: Omit<TokenDeAcesso, 'token' | 'expiraEm' | 'revogado' | 'janela'>): TokenDeAcesso {
    const token: TokenDeAcesso = {
      ...dados,
      token: segredo(),
      expiraEm: this.relogio.agoraMs() + this.validadeDoToken() * 1000,
      revogado: false,
      janela: { inicio: Date.now(), chamadas: 0 },
    };
    this.tokens.set(token.token, token);
    return token;
  }

  emitirCodigo(par: PedidoPar, consentimento: Consentimento): CodigoDeAutorizacao {
    const codigo: CodigoDeAutorizacao = {
      code: segredo(),
      clientId: par.clientId,
      redirectUri: par.redirectUri,
      consentId: par.consentId,
      ...(par.codeChallenge ? { codeChallenge: par.codeChallenge } : {}),
      escopos: par.escopos,
      expiraEm: this.relogio.agoraMs() + VALIDADE_DO_CODIGO_MS,
      usado: false,
      tokensEmitidos: [],
    };
    this.codigos.set(codigo.code, codigo);
    consentimento.codigoPendente = { expiraEm: codigo.expiraEm };
    return codigo;
  }

  /** Revogação feita pelo paciente na página do provedor (T10). */
  revogarPeloPaciente(consentId: string): boolean {
    const c = this.consentimento(consentId);
    if (!c || c.status !== 'AUTHORISED') return false;
    this.transicionar(c, 'REVOKED', 'PATIENT_REQUEST', 'PROVIDER');
    c.status_reason = { code: 'PATIENT_REQUEST', ended_via: 'PROVIDER', additional_information: 'Revogado pelo paciente na página de compartilhamentos.' };
    return true;
  }

  /** Limpeza periódica de estado vencido e transições de relógio. */
  varrer(): void {
    const agora = this.relogio.agoraMs();
    this.dados.garantirAgendas(agora);
    for (const c of this.consentimentos.values()) this.atualizarEstado(c);
    for (const [k, exp] of this.jtis) if (exp + 120_000 < agora) this.jtis.delete(k);
    for (const [k, p] of this.pedidosPar) if (p.expiraEm + 3600_000 < agora) this.pedidosPar.delete(k);
    for (const [k, t] of this.transacoes) if (t.criadaEm + 3600_000 < agora) this.transacoes.delete(k);
    for (const [k, s] of this.sessoes) if (s.criadaEm + 3600_000 < agora) this.sessoes.delete(k);
  }
}
