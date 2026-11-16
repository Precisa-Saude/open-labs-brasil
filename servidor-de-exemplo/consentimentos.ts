// Endpoints de consentimento (seção 5.4) e regras de criação (seção 4.4).

import type { IncomingMessage, ServerResponse } from 'node:http';
import { ESCOPOS_DE_PACIENTE, type Escopo } from '../comum/registro.ts';
import { instante } from './configuracao.ts';
import { enviarJson, enviarVazio, ErroDeApi, lerCorpo } from './http.ts';
import { ESTADOS_FINAIS, type Provedor } from './provedor.ts';
import { autenticarRecurso, comTratamentoDeErros, exigirAccept, exigirConteudo, exigirEscopo, exigirIdDeInteracao, type Acesso } from './recursos.ts';

const CAMPOS_PERMITIDOS = new Set(['scopes', 'purpose', 'expiration_date_time', 'data_period']);
const PADRAO_INSTANTE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const PADRAO_DATA = /^\d{4}-\d{2}-\d{2}$/;
const MOTIVOS_DO_RECEPTOR = ['PATIENT_REQUEST', 'RECEIVER_TERMINATION', 'PATIENT_MISMATCH'] as const;

function invalida(texto: string, expressao?: string): ErroDeApi {
  return new ErroDeApi(400, 'INVALID_REQUEST', 'invalid', texto, expressao ? { expressao: [expressao] } : {});
}

function dataValida(texto: string): boolean {
  const ms = Date.parse(`${texto}T00:00:00Z`);
  return !Number.isNaN(ms) && new Date(ms).toISOString().startsWith(texto);
}

interface CorpoValidado {
  scopes: Escopo[];
  purpose: string;
  expiraEm: number;
  data_period?: { start?: string; end?: string };
}

/** Validação de formato (400) seguida das regras de negócio (422). */
function validarCriacao(provedor: Provedor, acesso: Acesso | undefined, bruto: Buffer): CorpoValidado {
  let corpo: unknown;
  try {
    corpo = JSON.parse(bruto.toString('utf8'));
  } catch {
    throw invalida('Corpo não é JSON válido.');
  }
  if (typeof corpo !== 'object' || corpo === null || Array.isArray(corpo)) throw invalida('O corpo precisa ser um objeto JSON.');
  const obj = corpo as Record<string, unknown>;
  if (!provedor.violacao('consentimento-aceita-campo-desconhecido')) {
    for (const k of Object.keys(obj)) {
      if (!CAMPOS_PERMITIDOS.has(k)) throw invalida('Campo não previsto no corpo. A criação não identifica o paciente.', k);
    }
  }
  if (!Array.isArray(obj.scopes) || obj.scopes.some((s) => typeof s !== 'string')) throw invalida('scopes precisa ser uma lista de textos.', 'scopes');
  if (typeof obj.purpose !== 'string') throw invalida('purpose é obrigatório.', 'purpose');
  if (obj.purpose.length < 10 || obj.purpose.length > 300) throw invalida('purpose precisa ter de 10 a 300 caracteres.', 'purpose');
  if (typeof obj.expiration_date_time !== 'string' || !PADRAO_INSTANTE.test(obj.expiration_date_time) || Number.isNaN(Date.parse(obj.expiration_date_time))) {
    throw invalida('expiration_date_time precisa ser data e hora UTC sem fração de segundo.', 'expiration_date_time');
  }
  let dataPeriod: { start?: string; end?: string } | undefined;
  if (obj.data_period !== undefined) {
    const dp = obj.data_period as Record<string, unknown>;
    if (typeof dp !== 'object' || dp === null || Array.isArray(dp)) throw invalida('data_period precisa ser um objeto.', 'data_period');
    for (const k of Object.keys(dp)) if (k !== 'start' && k !== 'end') throw invalida('Campo não previsto em data_period.', `data_period.${k}`);
    for (const k of ['start', 'end'] as const) {
      const v = dp[k];
      if (v !== undefined && (typeof v !== 'string' || !PADRAO_DATA.test(v) || !dataValida(v))) throw invalida(`data_period.${k} precisa ser uma data.`, `data_period.${k}`);
    }
    if (typeof dp.start === 'string' && typeof dp.end === 'string' && dp.start > dp.end) throw invalida('data_period.start depois de data_period.end.', 'data_period');
    dataPeriod = {
      ...(typeof dp.start === 'string' ? { start: dp.start } : {}),
      ...(typeof dp.end === 'string' ? { end: dp.end } : {}),
    };
  }

  const scopes = obj.scopes as string[];
  const permitidos = acesso?.receptor.receiver?.scopes_allowed ?? [];
  const suportados = provedor.participante.provider!.scopes_supported;
  const escoposInvalidos =
    scopes.length === 0 ||
    new Set(scopes).size !== scopes.length ||
    scopes.some((s) => !(ESCOPOS_DE_PACIENTE as readonly string[]).includes(s) || !permitidos.includes(s as Escopo) || !suportados.includes(s as Escopo));
  if (escoposInvalidos) {
    throw new ErroDeApi(422, 'CONSENT_INVALID_SCOPES', 'business-rule', 'scopes precisa ter ao menos um escopo de paciente suportado e permitido ao receptor, sem repetição.');
  }
  const agora = provedor.relogio.agoraMs();
  const expiraEm = Date.parse(obj.expiration_date_time);
  const hoje = new Date(agora);
  const limite = Date.UTC(hoje.getUTCFullYear() + 1, hoje.getUTCMonth(), hoje.getUTCDate(), hoje.getUTCHours(), hoje.getUTCMinutes(), hoje.getUTCSeconds());
  if (expiraEm <= agora || expiraEm > limite) {
    throw new ErroDeApi(422, 'CONSENT_INVALID_EXPIRATION', 'business-rule', 'expiration_date_time precisa estar no futuro e a no máximo 12 meses.');
  }
  return { scopes: scopes as Escopo[], purpose: obj.purpose, expiraEm, ...(dataPeriod ? { data_period: dataPeriod } : {}) };
}

export async function tratarConsentimentos(provedor: Provedor, req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  await comTratamentoDeErros(provedor, req, res, async () => {
    const base = new URL(provedor.apiBaseUrl).pathname.replace(/\/$/, '');
    const resto = url.pathname.slice(base.length);
    const m = /^\/consents(?:\/([^/]+))?$/.exec(resto);
    if (!m) throw new ErroDeApi(404, 'RESOURCE_NOT_FOUND', 'not-found', 'Endpoint inexistente.');
    const id = m[1] ? decodeURIComponent(m[1]) : undefined;

    if (!id) {
      if (req.method !== 'POST') throw new ErroDeApi(405, 'METHOD_NOT_ALLOWED', 'not-supported', 'Método não previsto.', { cabecalhos: { Allow: 'POST' } });
      let previo: CorpoValidado | undefined;
      if (provedor.violacao('conteudo-antes-da-seguranca')) previo = validarCriacao(provedor, undefined, await lerCorpo(req));
      const acesso = autenticarRecurso(provedor, req, url);
      exigirEscopo(provedor, acesso, 'provedor', 'consent.manage');
      exigirIdDeInteracao(provedor, req);
      exigirAccept(req, 'application/json');
      exigirConteudo(req, 'application/json');
      if (provedor.registro.modo() !== 'normal') {
        throw new ErroDeApi(403, 'REGISTRY_EXPIRED', 'forbidden', 'Registro de participantes expirado: consentimentos só podem ser consultados e revogados.');
      }
      const dados = previo ?? validarCriacao(provedor, acesso, await lerCorpo(req));
      const c = provedor.criarConsentimento(acesso.clientId, dados);
      return enviarJson(res, 201, provedor.representar(c, false), {
        Location: `${provedor.apiBaseUrl.replace(/\/$/, '')}/consents/${c.consent_id}`,
      });
    }

    if (req.method === 'GET') {
      const acesso = autenticarRecurso(provedor, req, url);
      exigirIdDeInteracao(provedor, req);
      exigirAccept(req, 'application/json');
      if (acesso.token.tipo === 'paciente') {
        if (acesso.token.consentId !== id) throw new ErroDeApi(404, 'CONSENT_NOT_FOUND', 'not-found', 'Consentimento não encontrado.');
        const c = provedor.consentimento(id)!;
        return enviarJson(res, 200, provedor.representar(c, true));
      }
      exigirEscopo(provedor, acesso, 'provedor', 'consent.manage');
      const c = provedor.consentimento(id);
      if (!c || (c.client_id !== acesso.clientId && !provedor.violacao('consentimento-de-outro-cliente-visivel'))) {
        throw new ErroDeApi(404, 'CONSENT_NOT_FOUND', 'not-found', 'Consentimento não encontrado.');
      }
      return enviarJson(res, 200, provedor.representar(c, provedor.violacao('cpf-com-token-de-provedor')));
    }

    if (req.method === 'DELETE') {
      const acesso = autenticarRecurso(provedor, req, url);
      exigirEscopo(provedor, acesso, 'provedor', 'consent.manage');
      exigirIdDeInteracao(provedor, req);
      exigirAccept(req, 'application/json');
      for (const k of url.searchParams.keys()) if (k !== 'reason') throw invalida(`Parâmetro não previsto: ${k}.`);
      const motivos = url.searchParams.getAll('reason');
      if (motivos.length > 1) throw invalida('reason repetido.');
      const motivo = motivos[0] ?? 'PATIENT_REQUEST';
      if (!(MOTIVOS_DO_RECEPTOR as readonly string[]).includes(motivo)) throw invalida('reason desconhecido.', 'reason');
      const c = provedor.consentimento(id);
      if (!c || c.client_id !== acesso.clientId) throw new ErroDeApi(404, 'CONSENT_NOT_FOUND', 'not-found', 'Consentimento não encontrado.');
      if (ESTADOS_FINAIS.includes(c.status)) {
        if (provedor.violacao('revogacao-repetida-aceita')) return enviarVazio(res, 204);
        throw new ErroDeApi(422, 'CONSENT_INVALID_STATE', 'business-rule', `O consentimento já está em ${c.status}.`);
      }
      if (c.status === 'AWAITING_AUTHORISATION') {
        provedor.transicionar(c, 'REJECTED', 'RECEIVER_TERMINATION', 'RECEIVER');
      } else {
        provedor.transicionar(c, 'REVOKED', motivo as (typeof MOTIVOS_DO_RECEPTOR)[number], 'RECEIVER');
      }
      return enviarVazio(res, 204);
    }

    throw new ErroDeApi(405, 'METHOD_NOT_ALLOWED', 'not-supported', 'Método não previsto.', { cabecalhos: { Allow: 'GET, DELETE' } });
  });
}

export { instante };
