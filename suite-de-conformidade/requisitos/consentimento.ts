// CNS: consentimento (seção 9.3).

import type { ClienteDeTeste, Contexto } from '../contexto.ts';
import { cabecalhoUnico, type Resposta } from '../http.ts';
import { esperar, falhar, naoVerificavel } from '../resultado.ts';
import { codigoDoErro, erroApi, erroOAuth, resumo, sucesso, type Json } from '../verificacoes.ts';
import type { Teste } from './tipos.ts';

async function lerComProvedor(ctx: Contexto, c: ClienteDeTeste, id: string): Promise<Json> {
  return sucesso(await ctx.lerConsentimento(c, id));
}

function estado(corpo: Json): { status: unknown; code: unknown; via: unknown } {
  const motivo = corpo.status_reason as { code?: unknown; ended_via?: unknown } | undefined;
  return { status: corpo.status, code: motivo?.code, via: motivo?.ended_via };
}

/** 401 com invalid_token; o código do protocolo esperado é o do consentimento, e TOKEN_INVALID também é aceito. */
export function tokenRecusado(r: Resposta, esperado: 'CONSENT_EXPIRED' | 'CONSENT_REVOKED'): void {
  const codigo = codigoDoErro(r);
  esperar(r.status === 401 && (codigo === esperado || codigo === 'TOKEN_INVALID'), `esperado 401 ${esperado}: ${resumo(r)}`);
  esperar(/error="invalid_token"/.test(cabecalhoUnico(r, 'www-authenticate') ?? ''), 'WWW-Authenticate sem invalid_token');
}

async function criarComCorpo(ctx: Contexto, c: ClienteDeTeste, corpo: unknown): Promise<Resposta> {
  const token = await ctx.tokenDeProvedor(c, 'consent.manage');
  return ctx.consentimentos('POST', '', token, { corpo, credencial: c.credenciais[0]! });
}

async function usarTokens(ctx: Contexto, c: ClienteDeTeste, consentId: string, acesso: string, refresh: string): Promise<{ acesso: Resposta; refresh: Resposta }> {
  return {
    acesso: await ctx.consentimentos('GET', `/${consentId}`, acesso, { credencial: c.credenciais[0]! }),
    refresh: await ctx.renovar(c, refresh),
  };
}

export const testesDeConsentimento: Teste[] = [
  {
    id: 'CNS-001',
    titulo: 'POST /consents válido devolve 201 em AWAITING_AUTHORISATION',
    executar: async (ctx, r) => {
      const c = ctx.cliente('principal');
      const resp = await criarComCorpo(ctx, c, ctx.corpoDeConsentimento());
      const corpo = sucesso(resp, 201);
      esperar(corpo.status === 'AWAITING_AUTHORISATION', `status ${String(corpo.status)}`);
      esperar(typeof corpo.consent_id === 'string' && /^[A-Za-z0-9\-._~]{1,128}$/.test(corpo.consent_id), `consent_id fora do formato: ${String(corpo.consent_id)}`);
      esperar(!('patient' in corpo), 'a criação devolveu patient');
      r.evidencia(`consent_id ${String(corpo.consent_id)}`);
    },
  },
  {
    id: 'CNS-002',
    titulo: 'Recusa scopes vazio, com escopo de provedor ou desconhecido (422 CONSENT_INVALID_SCOPES)',
    executar: async (ctx, r) => {
      const c = ctx.cliente('principal');
      for (const scopes of [[], ['results.read', 'schedule.read'], ['results.read', 'escopo.inventado']]) {
        erroApi(await criarComCorpo(ctx, c, { ...ctx.corpoDeConsentimento(), scopes }), 422, 'CONSENT_INVALID_SCOPES');
        r.evidencia(`scopes ${JSON.stringify(scopes)}: 422 CONSENT_INVALID_SCOPES`);
      }
    },
  },
  {
    id: 'CNS-003',
    titulo: 'Recusa expiration_date_time no passado ou a mais de 12 meses (422 CONSENT_INVALID_EXPIRATION)',
    executar: async (ctx, r) => {
      const c = ctx.cliente('principal');
      const passado = ctx.corpoDeConsentimento({ expiracaoMs: ctx.agoraMs() - 3600_000 });
      erroApi(await criarComCorpo(ctx, c, passado), 422, 'CONSENT_INVALID_EXPIRATION');
      const longe = ctx.corpoDeConsentimento({ expiracaoMs: ctx.agoraMs() + 400 * 24 * 3600_000 });
      erroApi(await criarComCorpo(ctx, c, longe), 422, 'CONSENT_INVALID_EXPIRATION');
      r.evidencia('no passado e a 400 dias: 422 CONSENT_INVALID_EXPIRATION');
    },
  },
  {
    id: 'CNS-004',
    titulo: 'Recusa criação sem purpose (400 INVALID_REQUEST)',
    executar: async (ctx, r) => {
      const c = ctx.cliente('principal');
      const { purpose: _p, ...sem } = ctx.corpoDeConsentimento();
      erroApi(await criarComCorpo(ctx, c, sem), 400, 'INVALID_REQUEST');
      r.evidencia('sem purpose: 400 INVALID_REQUEST');
    },
  },
  {
    id: 'CNS-005',
    titulo: 'Recusa identificação de paciente ou campo desconhecido no corpo (400 INVALID_REQUEST)',
    executar: async (ctx, r) => {
      const c = ctx.cliente('principal');
      const cpf = ctx.paciente('principal').cpf ?? '52998224725';
      erroApi(await criarComCorpo(ctx, c, { ...ctx.corpoDeConsentimento(), patient: { cpf } }), 400, 'INVALID_REQUEST');
      erroApi(await criarComCorpo(ctx, c, { ...ctx.corpoDeConsentimento(), cpf }), 400, 'INVALID_REQUEST');
      erroApi(await criarComCorpo(ctx, c, { ...ctx.corpoDeConsentimento(), campo_desconhecido: true }), 400, 'INVALID_REQUEST');
      r.evidencia('patient.cpf, cpf e campo desconhecido: 400 INVALID_REQUEST');
    },
  },
  {
    id: 'CNS-006',
    titulo: 'Passa a REJECTED com AUTHORISATION_TIMEOUT 60 minutos depois da criação',
    fase: 'relogio',
    executar: async (ctx, r) => {
      const c = ctx.cliente('principal');
      const id = await ctx.novoConsentimento(c);
      await ctx.avancarRelogio(59 * 60);
      esperar((await lerComProvedor(ctx, c, id)).status === 'AWAITING_AUTHORISATION', 'o consentimento saiu de AWAITING_AUTHORISATION antes de 60 minutos');
      await ctx.avancarRelogio(2 * 60);
      const e = estado(await lerComProvedor(ctx, c, id));
      esperar(e.status === 'REJECTED' && e.code === 'AUTHORISATION_TIMEOUT' && e.via === 'SYSTEM', `depois de 61 minutos: ${JSON.stringify(e)}`);
      r.evidencia('59 min: AWAITING_AUTHORISATION; 61 min: REJECTED AUTHORISATION_TIMEOUT SYSTEM');
    },
  },
  {
    id: 'CNS-007',
    titulo: 'Recusa PAR com consent:{id} inexistente, de outro cliente ou fora de AWAITING_AUTHORISATION',
    executar: async (ctx, r) => {
      const a = ctx.cliente('principal');
      const b = ctx.cliente('secundario');
      erroOAuth((await ctx.par(a, 'consentimento-que-nao-existe')).resposta, 400, 'invalid_request');
      const deB = await ctx.novoConsentimento(b);
      erroOAuth((await ctx.par(a, deB)).resposta, 400, 'invalid_request');
      const aut = await ctx.autorizar(a);
      erroOAuth((await ctx.par(a, aut.consentId)).resposta, 400, 'invalid_request');
      r.evidencia('inexistente, de outro cliente e AUTHORISED: 400 invalid_request');
    },
  },
  {
    id: 'CNS-008',
    titulo: 'Tela de consentimento com receptor, escopos, finalidade, validade e aviso do CPF',
    executar: async (ctx, r) => {
      if (!ctx.cfg.jornada_por_formulario) naoVerificavel('o conteúdo da tela de consentimento depende de inspeção humana (seção 9.3); com jornada_por_formulario a suíte confere parte dele');
      const c = ctx.cliente('principal');
      const id = await ctx.novoConsentimento(c);
      const { resposta } = await ctx.par(c, id);
      const ru = (resposta.json as { request_uri?: string }).request_uri ?? falhar(`PAR recusado: ${resumo(resposta)}`);
      const j = await ctx.jornada(c.clientId, ru, ctx.paciente('principal'), 'recusar');
      const tela = j.telaDeConsentimento ?? falhar('a jornada não passou por uma tela de consentimento');
      const nome = c.participante.receiver!.client_name;
      const finalidade = String(ctx.corpoDeConsentimento().purpose);
      esperar(tela.includes(nome), `a tela não mostra o nome do receptor como está no registro (${nome})`);
      esperar(tela.includes(finalidade), 'a tela não mostra a finalidade enviada, sem alteração');
      r.evidencia(`tela de consentimento com "${nome}" e a finalidade enviada`);
      r.marcarParcial('escopos em linguagem comum, data de expiração e aviso de confirmação do CPF admitem redação do provedor e pedem inspeção humana');
    },
  },
  {
    id: 'CNS-009',
    titulo: 'Recusa pelo paciente: access_denied e REJECTED com PATIENT_REJECTED',
    executar: async (ctx, r) => {
      const c = ctx.cliente('principal');
      const id = await ctx.novoConsentimento(c);
      const { resposta } = await ctx.par(c, id);
      const ru = (resposta.json as { request_uri?: string }).request_uri;
      if (!ru) falhar(`PAR recusado: ${resumo(resposta)}`);
      const j = await ctx.jornada(c.clientId, ru, ctx.paciente('principal'), 'recusar');
      esperar(j.location && new URL(j.location).searchParams.get('error') === 'access_denied', `redirecionamento sem access_denied: ${j.location ?? j.pagina_de_erro ?? ''}`);
      const e = estado(await lerComProvedor(ctx, c, id));
      esperar(e.status === 'REJECTED' && e.code === 'PATIENT_REJECTED' && e.via === 'PROVIDER', `estado depois da recusa: ${JSON.stringify(e)}`);
      r.evidencia(`access_denied; REJECTED PATIENT_REJECTED PROVIDER (jornada pela ${j.origem === 'formulario' ? 'página real' : 'interface de controle'})`);
    },
  },
  {
    id: 'CNS-010',
    titulo: 'Aprovação passa o consentimento a AUTHORISED',
    executar: async (ctx, r) => {
      const c = ctx.cliente('principal');
      const a = await ctx.autorizar(c);
      const corpo = await lerComProvedor(ctx, c, a.consentId);
      esperar(corpo.status === 'AUTHORISED', `status ${String(corpo.status)}`);
      r.evidencia('AUTHORISED depois da aprovação');
    },
  },
  {
    id: 'CNS-011',
    titulo: 'Paciente sem CPF: access_denied e REJECTED com PATIENT_WITHOUT_CPF',
    executar: async (ctx, r) => {
      const c = ctx.cliente('principal');
      const semCpf = ctx.paciente('sem_cpf');
      const id = await ctx.novoConsentimento(c);
      const { resposta } = await ctx.par(c, id);
      const ru = (resposta.json as { request_uri?: string }).request_uri;
      if (!ru) falhar(`PAR recusado: ${resumo(resposta)}`);
      const j = await ctx.jornada(c.clientId, ru, semCpf, 'aprovar');
      esperar(j.location && new URL(j.location).searchParams.get('error') === 'access_denied', `redirecionamento sem access_denied: ${j.location ?? ''}`);
      const e = estado(await lerComProvedor(ctx, c, id));
      esperar(e.status === 'REJECTED' && e.code === 'PATIENT_WITHOUT_CPF', `estado: ${JSON.stringify(e)}`);
      r.evidencia('access_denied; REJECTED PATIENT_WITHOUT_CPF');
    },
  },
  {
    id: 'CNS-012',
    titulo: 'GET /consents/{id} com token de paciente devolve patient.cpf e patient.fhir_id',
    executar: async (ctx, r) => {
      const c = ctx.cliente('principal');
      const p = ctx.paciente('principal');
      const a = await ctx.autorizar(c);
      const corpo = sucesso(await ctx.consentimentos('GET', `/${a.consentId}`, a.accessToken, { credencial: c.credenciais[0]! }));
      const patient = corpo.patient as { cpf?: unknown; fhir_id?: unknown } | undefined;
      esperar(patient && typeof patient.cpf === 'string' && typeof patient.fhir_id === 'string', 'leitura com token de paciente sem patient.cpf ou patient.fhir_id');
      esperar(/^[0-9]{11}$/.test(patient.cpf as string), 'patient.cpf não tem 11 dígitos');
      if (p.cpf) esperar(patient.cpf === p.cpf, 'patient.cpf não é o do paciente que se autenticou');
      else r.marcarParcial('a configuração não traz o CPF do paciente principal para comparar');
      if (p.fhir_id) esperar(patient.fhir_id === p.fhir_id, 'patient.fhir_id não é o do paciente que se autenticou');
      else r.marcarParcial('a configuração não traz o fhir_id do paciente principal para comparar');
      ctx.segredosVistos.add(patient.cpf as string);
      r.evidencia('patient.cpf e patient.fhir_id iguais aos do paciente de teste');
    },
  },
  {
    id: 'CNS-013',
    titulo: 'GET /consents/{id} com token de provedor nunca devolve patient',
    executar: async (ctx, r) => {
      const c = ctx.cliente('principal');
      const aguardando = await ctx.novoConsentimento(c);
      const a = await ctx.autorizar(c);
      for (const [nome, id] of [['AWAITING_AUTHORISATION', aguardando], ['AUTHORISED', a.consentId]] as const) {
        esperar(!('patient' in (await lerComProvedor(ctx, c, id))), `patient devolvido com token de provedor em ${nome}`);
      }
      const rev = await ctx.revogar(c, a.consentId);
      esperar(rev.status === 204, `revogação: ${resumo(rev)}`);
      esperar(!('patient' in (await lerComProvedor(ctx, c, a.consentId))), 'patient devolvido com token de provedor em REVOKED');
      r.evidencia('sem patient em AWAITING_AUTHORISATION, AUTHORISED e REVOKED');
    },
  },
  {
    id: 'CNS-014',
    titulo: 'Token de paciente de outro consentimento devolve 404',
    executar: async (ctx, r) => {
      const c = ctx.cliente('principal');
      const um = await ctx.autorizar(c);
      const outro = await ctx.autorizar(c);
      erroApi(await ctx.consentimentos('GET', `/${outro.consentId}`, um.accessToken, { credencial: c.credenciais[0]! }), 404, 'CONSENT_NOT_FOUND');
      r.evidencia('token do consentimento 1 no caminho do 2: 404 CONSENT_NOT_FOUND');
    },
  },
  {
    id: 'CNS-015',
    titulo: 'O token não carrega escopo fora do consentimento',
    executar: async (ctx, r) => {
      const c = ctx.cliente('principal');
      const id = await ctx.novoConsentimento(c, { escopos: ['results.read'] });
      erroOAuth((await ctx.par(c, id, { escopos: ['results.read', 'appointment.write'] })).resposta, 400, 'invalid_scope');
      const a = await ctx.autorizar(c, { escopos: ['results.read'] });
      const escopo = String((a.respostaDoToken.json as { scope?: unknown }).scope ?? '');
      const extras = escopo.split(' ').filter((s) => s && s !== 'results.read' && !s.startsWith('consent:'));
      esperar(extras.length === 0, `token com escopos fora do consentimento: ${extras.join(', ')}`);
      r.evidencia('PAR com escopo fora do consentimento: invalid_scope; token só com results.read');
    },
  },
  {
    id: 'CNS-016',
    titulo: 'DELETE em AUTHORISED devolve 204, passa a REVOKED e invalida os tokens',
    executar: async (ctx, r) => {
      const c = ctx.cliente('principal');
      const a = await ctx.autorizar(c);
      const rev = await ctx.revogar(c, a.consentId, 'PATIENT_REQUEST');
      esperar(rev.status === 204, `DELETE: ${resumo(rev)}`);
      esperar((await lerComProvedor(ctx, c, a.consentId)).status === 'REVOKED', 'não passou a REVOKED');
      const u = await usarTokens(ctx, c, a.consentId, a.accessToken, a.refreshToken);
      tokenRecusado(u.acesso, 'CONSENT_REVOKED');
      erroOAuth(u.refresh, 400, 'invalid_grant');
      r.evidencia('204; REVOKED; token de acesso 401; refresh invalid_grant');
    },
  },
  {
    id: 'CNS-017',
    titulo: 'DELETE com reason=PATIENT_MISMATCH grava PATIENT_MISMATCH e RECEIVER',
    executar: async (ctx, r) => {
      const c = ctx.cliente('principal');
      const a = await ctx.autorizar(c);
      esperar((await ctx.revogar(c, a.consentId, 'PATIENT_MISMATCH')).status === 204, 'DELETE com PATIENT_MISMATCH recusado');
      const e = estado(await lerComProvedor(ctx, c, a.consentId));
      esperar(e.status === 'REVOKED' && e.code === 'PATIENT_MISMATCH' && e.via === 'RECEIVER', `estado: ${JSON.stringify(e)}`);
      r.evidencia('REVOKED PATIENT_MISMATCH RECEIVER');
    },
  },
  {
    id: 'CNS-018',
    titulo: 'DELETE em estado final devolve 422 CONSENT_INVALID_STATE',
    executar: async (ctx, r) => {
      const c = ctx.cliente('principal');
      const a = await ctx.autorizar(c);
      esperar((await ctx.revogar(c, a.consentId)).status === 204, 'primeira revogação recusada');
      erroApi(await ctx.revogar(c, a.consentId), 422, 'CONSENT_INVALID_STATE');
      r.evidencia('segunda revogação: 422 CONSENT_INVALID_STATE');
    },
  },
  {
    id: 'CNS-019',
    titulo: 'Em expiration_date_time passa a EXPIRED e invalida os tokens',
    fase: 'relogio',
    executar: async (ctx, r) => {
      const c = ctx.cliente('principal');
      const a = await ctx.autorizar(c, { expiracaoMs: ctx.agoraMs() + 90_000 });
      const validade = Number((a.respostaDoToken.json as { expires_in?: unknown }).expires_in ?? 300);
      esperar(validade > 130, `expires_in ${validade} curto demais para separar a expiração do consentimento da do token`);
      await ctx.avancarRelogio(120);
      const e = estado(await lerComProvedor(ctx, c, a.consentId));
      esperar(e.status === 'EXPIRED' && e.code === 'MAX_DATE_REACHED' && e.via === 'SYSTEM', `estado depois da expiração: ${JSON.stringify(e)}`);
      const u = await usarTokens(ctx, c, a.consentId, a.accessToken, a.refreshToken);
      tokenRecusado(u.acesso, 'CONSENT_EXPIRED');
      erroOAuth(u.refresh, 400, 'invalid_grant');
      r.evidencia(`EXPIRED MAX_DATE_REACHED; token de acesso ainda dentro de expires_in recusado com 401 ${codigoDoErro(u.acesso) ?? ''}; refresh invalid_grant`);
    },
  },
  {
    id: 'CNS-020',
    titulo: 'Revogação pela página do provedor: REVOKED com ended_via PROVIDER e tokens invalidados',
    executar: async (ctx, r) => {
      const c = ctx.cliente('principal');
      const a = await ctx.autorizar(c);
      const rc = await ctx.controle('POST', '/_controle/revogar-pelo-paciente', { consent_id: a.consentId });
      esperar(rc.status === 200, `interface de controle recusou a revogação pelo paciente: ${rc.status}`);
      const e = estado(await lerComProvedor(ctx, c, a.consentId));
      esperar(e.status === 'REVOKED' && e.code === 'PATIENT_REQUEST' && e.via === 'PROVIDER', `estado: ${JSON.stringify(e)}`);
      const u = await usarTokens(ctx, c, a.consentId, a.accessToken, a.refreshToken);
      tokenRecusado(u.acesso, 'CONSENT_REVOKED');
      erroOAuth(u.refresh, 400, 'invalid_grant');
      r.evidencia('REVOKED PATIENT_REQUEST PROVIDER; tokens invalidados (revogação feita pela interface de controle, no papel da página; a página em si é CNS-023)');
    },
  },
  {
    id: 'CNS-021',
    titulo: 'GET /consents/{id} de outro cliente devolve 404',
    executar: async (ctx, r) => {
      const a = ctx.cliente('principal');
      const b = ctx.cliente('secundario');
      const id = await ctx.novoConsentimento(a);
      erroApi(await ctx.lerConsentimento(b, id), 404, 'CONSENT_NOT_FOUND');
      const tokenB = await ctx.tokenDeProvedor(b, 'consent.manage');
      erroApi(await ctx.consentimentos('DELETE', `/${id}`, tokenB, { credencial: b.credenciais[0]! }), 404, 'CONSENT_NOT_FOUND');
      r.evidencia('GET e DELETE pelo cliente B: 404 CONSENT_NOT_FOUND');
    },
  },
  {
    id: 'CNS-022',
    titulo: 'Estados finais não mudam',
    fase: 'relogio',
    executar: async (ctx, r) => {
      const c = ctx.cliente('principal');
      const rejeitado = await ctx.novoConsentimento(c);
      esperar((await ctx.revogar(c, rejeitado)).status === 204, 'DELETE em AWAITING_AUTHORISATION recusado');
      esperar((await lerComProvedor(ctx, c, rejeitado)).status === 'REJECTED', 'DELETE em AWAITING_AUTHORISATION não levou a REJECTED');
      const revogado = (await ctx.autorizar(c)).consentId;
      esperar((await ctx.revogar(c, revogado)).status === 204, 'revogação recusada');
      const expirado = (await ctx.autorizar(c, { expiracaoMs: ctx.agoraMs() + 5 * 60_000 })).consentId;
      await ctx.avancarRelogio(6 * 60 + 30);
      esperar((await lerComProvedor(ctx, c, expirado)).status === 'EXPIRED', 'consentimento curto não passou a EXPIRED');
      for (const [nome, id] of [['REJECTED', rejeitado], ['REVOKED', revogado], ['EXPIRED', expirado]] as const) {
        erroOAuth((await ctx.par(c, id)).resposta, 400, 'invalid_request');
        erroApi(await ctx.revogar(c, id), 422, 'CONSENT_INVALID_STATE');
        esperar((await lerComProvedor(ctx, c, id)).status === nome, `${nome} mudou de estado`);
        r.evidencia(`${nome}: PAR invalid_request, DELETE 422, estado mantido`);
      }
    },
  },
  {
    id: 'CNS-023',
    titulo: 'Página de gestão de consentimentos em consent_management_uri',
    executar: async (ctx, r) => {
      const uri = ctx.provedor.provider!.consent_management_uri;
      const resp = await ctx.http.requisitar(uri, { credencial: null });
      esperar(resp.status === 200, `consent_management_uri respondeu ${resp.status}`);
      r.evidencia(`${uri} respondeu 200`);
      r.marcarParcial('listar os consentimentos AUTHORISED e revogar cada um pede inspeção humana da página');
    },
  },
  {
    id: 'CNS-024',
    titulo: 'GET /consents/{id} com token de provedor responde em estado final',
    executar: async (ctx, r) => {
      const c = ctx.cliente('principal');
      const a = await ctx.autorizar(c);
      await ctx.revogar(c, a.consentId);
      const corpo = await lerComProvedor(ctx, c, a.consentId);
      esperar(corpo.status === 'REVOKED' && typeof corpo.status_reason === 'object', 'consentimento revogado sem status ou status_reason');
      r.evidencia('REVOKED legível com status_reason');
    },
  },
];
