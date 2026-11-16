// AUT: servidor de autorização (seção 9.3).

import { randomUUID } from 'node:crypto';
import type { ClienteDeTeste, Contexto } from '../contexto.ts';
import { cabecalhoUnico, type Resposta } from '../http.ts';
import { esperar, falhar, naoVerificavel, type Relator } from '../resultado.ts';
import { erroOAuth, recursos, resumo, sucesso } from '../verificacoes.ts';
import type { Teste } from './tipos.ts';

const ESCOPOS_DE_PROVEDOR = ['catalog.read', 'locations.read', 'schedule.read', 'consent.manage'];

function requestUri(r: Resposta): string {
  const v = (r.json as { request_uri?: unknown } | undefined)?.request_uri;
  if (r.status !== 201 || typeof v !== 'string') falhar(`PAR válido recusado: ${resumo(r)}`);
  return v;
}

async function parValido(ctx: Contexto, c: ClienteDeTeste) {
  const consentId = await ctx.novoConsentimento(c);
  const par = await ctx.par(c, consentId);
  return { consentId, ...par, requestUri: requestUri(par.resposta) };
}

/** Confere cada valor obrigatório da tabela da seção 5.2. Devolve a lista de divergências. */
export function divergenciasDosMetadados(ctx: Contexto, m: Record<string, unknown>): string[] {
  const erros: string[] = [];
  const igual = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  const https = (v: unknown) => typeof v === 'string' && v.startsWith('https://');
  if (m.issuer !== ctx.issuer) erros.push(`issuer ${String(m.issuer)} diferente do registro (${ctx.issuer})`);
  for (const k of ['authorization_endpoint', 'token_endpoint', 'pushed_authorization_request_endpoint', 'jwks_uri']) {
    if (!https(m[k])) erros.push(`${k} ausente ou sem https`);
  }
  for (const k of ['require_pushed_authorization_requests', 'authorization_response_iss_parameter_supported', 'tls_client_certificate_bound_access_tokens']) {
    if (m[k] !== true) erros.push(`${k} precisa ser true (veio ${JSON.stringify(m[k])})`);
  }
  if (!igual(m.response_types_supported, ['code'])) erros.push('response_types_supported precisa ser exatamente ["code"]');
  const grants = m.grant_types_supported;
  if (!Array.isArray(grants) || !['authorization_code', 'refresh_token', 'client_credentials'].every((g) => grants.includes(g)) || grants.includes('password') || grants.includes('implicit')) {
    erros.push('grant_types_supported precisa conter authorization_code, refresh_token e client_credentials, sem password nem implicit');
  }
  if (!igual(m.token_endpoint_auth_methods_supported, ['private_key_jwt'])) erros.push('token_endpoint_auth_methods_supported precisa ser exatamente ["private_key_jwt"]');
  if (!igual(m.token_endpoint_auth_signing_alg_values_supported, ['PS256'])) erros.push('token_endpoint_auth_signing_alg_values_supported precisa ser exatamente ["PS256"]');
  if (!igual(m.code_challenge_methods_supported, ['S256'])) erros.push('code_challenge_methods_supported precisa ser exatamente ["S256"]');
  const escopos = m.scopes_supported;
  const doRegistro = ctx.provedor.provider!.scopes_supported;
  if (!Array.isArray(escopos) || !doRegistro.every((s) => escopos.includes(s))) erros.push('scopes_supported não contém todos os escopos do provedor no registro');
  return erros;
}

function metadados(ctx: Contexto): Record<string, unknown> {
  if (!ctx.metadados) falhar(`documento de metadados indisponível em ${ctx.urlDosMetadados()}: ${ctx.erroDosMetadados ?? ''}`);
  return ctx.metadados;
}

async function abrirAutorizacao(ctx: Contexto, url: string, cabecalhos: Record<string, string> = {}, metodo = 'GET'): Promise<Resposta> {
  return ctx.http.requisitar(url, { metodo, cabecalhos, credencial: null });
}

export const testesDeAutorizacao: Teste[] = [
  {
    id: 'AUT-001',
    titulo: 'Metadados em /.well-known/oauth-authorization-server com issuer do registro',
    executar: async (ctx, r) => {
      const m = metadados(ctx);
      esperar(m.issuer === ctx.issuer, `issuer dos metadados (${String(m.issuer)}) diferente do registro (${ctx.issuer})`);
      const faltando = ['authorization_endpoint', 'token_endpoint', 'pushed_authorization_request_endpoint', 'jwks_uri', 'require_pushed_authorization_requests',
        'authorization_response_iss_parameter_supported', 'tls_client_certificate_bound_access_tokens', 'response_types_supported', 'grant_types_supported',
        'scopes_supported', 'token_endpoint_auth_methods_supported', 'token_endpoint_auth_signing_alg_values_supported', 'code_challenge_methods_supported'].filter((k) => !(k in m));
      esperar(faltando.length === 0, `campos ausentes: ${faltando.join(', ')}`);
      r.evidencia(`${ctx.urlDosMetadados()} com issuer ${ctx.issuer}`);
    },
  },
  {
    id: 'AUT-002',
    titulo: 'Recusa autorização que não vem de PAR',
    executar: async (ctx, r) => {
      const c = ctx.cliente('principal');
      const u = new URL(ctx.endpoint('authorization_endpoint'));
      for (const [k, v] of Object.entries({ client_id: c.clientId, response_type: 'code', redirect_uri: c.redirectUri, scope: 'results.read', state: 'x', code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM', code_challenge_method: 'S256' })) {
        u.searchParams.set(k, v);
      }
      const resp = await abrirAutorizacao(ctx, u.toString());
      const destino = cabecalhoUnico(resp, 'location') ?? '';
      esperar(!destino.startsWith(c.redirectUri), `redirecionou ao receptor sem PAR: ${destino}`);
      if (resp.status >= 200 && resp.status < 300) {
        naoVerificavel('a resposta foi 200: não é possível distinguir automaticamente página de erro de página de login');
      }
      esperar(resp.status >= 400, `esperado erro, veio ${resp.status}`);
      r.evidencia(`autorização sem request_uri respondeu ${resp.status}`);
    },
  },
  {
    id: 'AUT-003',
    titulo: 'Recusa PAR sem autenticação do cliente',
    executar: async (ctx, r) => {
      const c = ctx.cliente('principal');
      const consentId = await ctx.novoConsentimento(c);
      const { resposta } = await ctx.par(c, consentId, { assercao: null });
      erroOAuth(resposta, 401, 'invalid_client');
      r.evidencia('PAR sem client_assertion: 401 invalid_client');
    },
  },
  {
    id: 'AUT-004',
    titulo: 'Recusa response_type diferente de code',
    executar: async (ctx, r) => {
      const c = ctx.cliente('principal');
      const consentId = await ctx.novoConsentimento(c);
      for (const rt of ['code id_token', 'token']) {
        const { resposta } = await ctx.par(c, consentId, { trocar: { response_type: rt } });
        erroOAuth(resposta, 400, 'invalid_request');
        r.evidencia(`response_type=${rt}: 400 invalid_request`);
      }
    },
  },
  {
    id: 'AUT-005',
    titulo: 'Recusa PAR sem code_challenge ou com método diferente de S256',
    executar: async (ctx, r) => {
      const c = ctx.cliente('principal');
      const consentId = await ctx.novoConsentimento(c);
      const sem = await ctx.par(c, consentId, { omitir: ['code_challenge', 'code_challenge_method'] });
      erroOAuth(sem.resposta, 400, 'invalid_request');
      const plain = await ctx.par(c, consentId, { trocar: { code_challenge_method: 'plain' } });
      erroOAuth(plain.resposta, 400, 'invalid_request');
      r.evidencia('sem code_challenge e com plain: 400 invalid_request');
    },
  },
  {
    id: 'AUT-006',
    titulo: 'Recusa redirect_uri ausente ou não idêntico ao registro',
    executar: async (ctx, r) => {
      const c = ctx.cliente('principal');
      const consentId = await ctx.novoConsentimento(c);
      const registrado = c.redirectUri;
      const variacoes: Array<[string, { omitir?: string[]; trocar?: Record<string, string> }]> = [
        ['omitido', { omitir: ['redirect_uri'] }],
        ['um caractere diferente', { trocar: { redirect_uri: `${registrado.slice(0, -1)}${registrado.endsWith('x') ? 'y' : 'x'}` } }],
        ['com parâmetro acrescentado', { trocar: { redirect_uri: `${registrado}${registrado.includes('?') ? '&' : '?'}extra=1` } }],
        ['com esquema http', { trocar: { redirect_uri: registrado.replace(/^https:/, 'http:') } }],
      ];
      for (const [nome, o] of variacoes) {
        const { resposta } = await ctx.par(c, consentId, o);
        erroOAuth(resposta, 400, 'invalid_request');
        r.evidencia(`redirect_uri ${nome}: 400 invalid_request`);
      }
    },
  },
  {
    id: 'AUT-007',
    titulo: 'request_uri com expires_in de 120 a 599 e de uso único contado na autorização',
    executar: async (ctx, r) => {
      const c = ctx.cliente('principal');
      const par = await parValido(ctx, c);
      const expira = (par.resposta.json as { expires_in?: unknown }).expires_in;
      esperar(typeof expira === 'number' && expira >= 120 && expira < 600, `expires_in fora de [120, 600): ${String(expira)}`);
      const url = ctx.urlDeAutorizacao(c.clientId, par.requestUri);
      for (const n of [1, 2]) {
        const p = await abrirAutorizacao(ctx, url);
        esperar(p.status === 200, `carregamento ${n} da página de autorização sem concluir foi recusado: ${p.status}`);
      }
      r.evidencia(`expires_in ${String(expira)}; página carregada duas vezes sem concluir`);
      const j = await ctx.jornada(c.clientId, par.requestUri, ctx.paciente('principal'));
      esperar(j.location?.includes('code='), `a jornada não concluiu: ${JSON.stringify(j)}`);
      const reuso = await abrirAutorizacao(ctx, url);
      if (reuso.status >= 400) {
        r.evidencia(`reuso depois de concluir: ${reuso.status}`);
        return;
      }
      const segunda = await ctx.jornada(c.clientId, par.requestUri, ctx.paciente('principal'));
      esperar(!segunda.location, `request_uri aceito de novo depois de concluída a autorização: ${segunda.location ?? ''}`);
      r.evidencia(`reuso: página ${reuso.status}, mas a autorização foi recusada`);
    },
  },
  {
    id: 'AUT-008',
    titulo: 'Autentica o cliente somente por private_key_jwt',
    executar: async (ctx, r) => {
      const c = ctx.cliente('principal');
      const basic = await ctx.token(c, { grant_type: 'client_credentials', scope: 'catalog.read', client_id: c.clientId }, { assercao: null });
      erroOAuth(basic, 401, 'invalid_client');
      const comBasic = await ctx.http.requisitar(ctx.endpoint('token_endpoint'), {
        metodo: 'POST',
        cabecalhos: { 'content-type': 'application/x-www-form-urlencoded', authorization: `Basic ${Buffer.from(`${c.clientId}:segredo-de-teste`).toString('base64')}` },
        corpo: 'grant_type=client_credentials&scope=catalog.read',
        credencial: c.credenciais[0]!,
      });
      erroOAuth(comBasic, 401, 'invalid_client');
      r.evidencia('tls_client_auth (só client_id e certificado) e client_secret_basic: 401 invalid_client');
    },
  },
  {
    id: 'AUT-009',
    titulo: 'Só aceita o próprio issuer, como texto simples, no aud da asserção',
    executar: async (ctx, r) => {
      const c = ctx.cliente('principal');
      const comEndpoint = await ctx.tokenCc(c, ['catalog.read'], { assercao: await ctx.assercao(c, { aud: ctx.endpoint('token_endpoint') }) });
      erroOAuth(comEndpoint, 401, 'invalid_client');
      const emLista = await ctx.tokenCc(c, ['catalog.read'], { assercao: await ctx.assercao(c, { aud: [ctx.issuer] }) });
      erroOAuth(emLista, 401, 'invalid_client');
      r.evidencia('aud com a URL do token e aud em lista: 401 invalid_client');
    },
  },
  {
    id: 'AUT-010',
    titulo: 'Recusa asserção com jti repetido, expirada ou com validade acima de 60 segundos',
    executar: async (ctx, r) => {
      const c = ctx.cliente('principal');
      const a = await ctx.assercao(c);
      const primeira = await ctx.tokenCc(c, ['catalog.read'], { assercao: a });
      esperar(primeira.status === 200, `primeira asserção recusada: ${resumo(primeira)}`);
      erroOAuth(await ctx.tokenCc(c, ['catalog.read'], { assercao: a }), 401, 'invalid_client');
      const agora = ctx.agoraS();
      erroOAuth(await ctx.tokenCc(c, ['catalog.read'], { assercao: await ctx.assercao(c, { iat: agora - 120, exp: agora - 60 }) }), 401, 'invalid_client');
      erroOAuth(await ctx.tokenCc(c, ['catalog.read'], { assercao: await ctx.assercao(c, { iat: agora, exp: agora + 120 }) }), 401, 'invalid_client');
      r.evidencia('jti repetido, asserção expirada e exp - iat de 120 s: 401 invalid_client');
    },
  },
  {
    id: 'AUT-011',
    titulo: 'Aceita iat até 10 segundos no futuro e recusa mais de 60',
    executar: async (ctx, r) => {
      const c = ctx.cliente('principal');
      const agora = ctx.agoraS();
      const perto = await ctx.tokenCc(c, ['catalog.read'], { assercao: await ctx.assercao(c, { iat: agora + 8, exp: agora + 60 }) });
      esperar(perto.status === 200, `iat 8 s no futuro recusado: ${resumo(perto)}`);
      erroOAuth(await ctx.tokenCc(c, ['catalog.read'], { assercao: await ctx.assercao(c, { iat: agora + 90, exp: agora + 140 }) }), 401, 'invalid_client');
      r.evidencia('iat +8 s aceito, iat +90 s recusado');
    },
  },
  {
    id: 'AUT-012',
    titulo: 'Resposta de autorização com code, state e iss, e nada mais',
    executar: async (ctx, r) => {
      const c = ctx.cliente('principal');
      const par = await parValido(ctx, c);
      const j = await ctx.jornada(c.clientId, par.requestUri, ctx.paciente('principal'));
      esperar(j.location, `sem redirecionamento: ${j.pagina_de_erro ?? ''}`);
      const u = new URL(j.location);
      const nomes = [...u.searchParams.keys()].sort();
      esperar(JSON.stringify(nomes) === JSON.stringify(['code', 'iss', 'state']), `parâmetros do redirecionamento: ${nomes.join(', ')}`);
      esperar(u.searchParams.get('iss') === ctx.issuer, `iss ${u.searchParams.get('iss') ?? '(ausente)'} diferente do issuer`);
      esperar(u.searchParams.get('state') === par.state, 'state diferente do enviado');
      esperar(`${u.origin}${u.pathname}` === new URL(c.redirectUri).origin + new URL(c.redirectUri).pathname, 'redirecionou para outro destino');
      r.evidencia(`redirecionamento com ${nomes.join(', ')}`);
    },
  },
  {
    id: 'AUT-013',
    titulo: 'Resposta de autorização sem token nem dado do paciente',
    executar: async (ctx, r) => {
      const c = ctx.cliente('principal');
      const a = await ctx.autorizar(c);
      const u = new URL(a.location);
      const proibidos = ['access_token', 'id_token', 'token', 'refresh_token', 'cpf', 'patient', 'name'];
      esperar(!proibidos.some((p) => u.searchParams.has(p)), `redirecionamento com parâmetro proibido: ${u.search}`);
      const cpf = ctx.paciente('principal').cpf;
      esperar(!cpf || !a.location.includes(cpf), 'o CPF do paciente aparece no redirecionamento');
      esperar(!a.location.includes(a.accessToken), 'o token aparece no redirecionamento');
      r.evidencia('sem token, sem CPF, sem identificador do paciente');
    },
  },
  {
    id: 'AUT-014',
    titulo: 'Recusa código depois de 60 segundos ou no segundo uso',
    fase: 'relogio',
    executar: async (ctx, r) => {
      const c = ctx.cliente('principal');
      const a = await ctx.autorizar(c);
      const code = new URL(a.location).searchParams.get('code')!;
      erroOAuth(await ctx.trocarCodigo(c, code, a.verificador, a.redirectUri), 400, 'invalid_grant');
      r.evidencia('segundo uso do código: 400 invalid_grant');
      const par = await parValido(ctx, c);
      const j = await ctx.jornada(c.clientId, par.requestUri, ctx.paciente('principal'));
      const novo = new URL(j.location!).searchParams.get('code')!;
      await ctx.avancarRelogio(61);
      erroOAuth(await ctx.trocarCodigo(c, novo, par.verificador, par.redirectUri), 400, 'invalid_grant');
      r.evidencia('código trocado 61 s depois: 400 invalid_grant');
    },
  },
  {
    id: 'AUT-015',
    titulo: 'Recusa code_verifier que não corresponde ao code_challenge',
    executar: async (ctx, r) => {
      const c = ctx.cliente('principal');
      const par = await parValido(ctx, c);
      const j = await ctx.jornada(c.clientId, par.requestUri, ctx.paciente('principal'));
      const code = new URL(j.location!).searchParams.get('code')!;
      const errado = `${par.verificador.slice(0, -1)}${par.verificador.endsWith('A') ? 'B' : 'A'}`;
      erroOAuth(await ctx.trocarCodigo(c, code, errado, par.redirectUri), 400, 'invalid_grant');
      r.evidencia('code_verifier com um caractere trocado: 400 invalid_grant');
    },
  },
  {
    id: 'AUT-016',
    titulo: 'expires_in entre 300 e 900 nas três concessões',
    executar: async (ctx, r) => {
      const c = ctx.cliente('principal');
      const valores: Record<string, unknown> = {};
      valores.client_credentials = (sucesso(await ctx.tokenCc(c, ['catalog.read']))).expires_in;
      const a = await ctx.autorizar(c);
      valores.authorization_code = (a.respostaDoToken.json as { expires_in?: unknown }).expires_in;
      valores.refresh_token = sucesso(await ctx.renovar(c, a.refreshToken)).expires_in;
      for (const [k, v] of Object.entries(valores)) {
        esperar(typeof v === 'number' && v >= 300 && v <= 900, `${k}: expires_in ${String(v)} fora de [300, 900]`);
      }
      r.evidencia(Object.entries(valores).map(([k, v]) => `${k}: ${String(v)}`).join('; '));
    },
  },
  {
    id: 'AUT-017',
    titulo: 'Resposta do token sem CPF, id de paciente nem id_token',
    executar: async (ctx, r) => {
      const c = ctx.cliente('principal');
      const a = await ctx.autorizar(c);
      const corpo = a.respostaDoToken.json as Record<string, unknown>;
      const permitidos = ['access_token', 'token_type', 'expires_in', 'refresh_token', 'scope'];
      const extras = Object.keys(corpo).filter((k) => !permitidos.includes(k));
      esperar(extras.length === 0, `membros além dos do OAuth: ${extras.join(', ')}`);
      const p = ctx.paciente('principal');
      esperar(!p.cpf || !a.respostaDoToken.texto.includes(p.cpf), 'o CPF aparece na resposta do token');
      esperar(!p.fhir_id || !a.respostaDoToken.texto.includes(`"${p.fhir_id}"`), 'o id do paciente aparece na resposta do token');
      r.evidencia(`membros: ${Object.keys(corpo).join(', ')}`);
    },
  },
  {
    id: 'AUT-018',
    titulo: 'Não troca o refresh token em operação normal',
    executar: async (ctx, r) => {
      const c = ctx.cliente('principal');
      const a = await ctx.autorizar(c);
      for (let i = 1; i <= 3; i++) {
        const corpo = sucesso(await ctx.renovar(c, a.refreshToken));
        esperar(corpo.refresh_token === undefined || corpo.refresh_token === a.refreshToken, `renovação ${i} trocou o refresh token`);
      }
      r.evidencia('três renovações sem troca do refresh token');
    },
  },
  {
    id: 'AUT-019',
    titulo: 'Sem refresh token em client_credentials',
    executar: async (ctx, r) => {
      const corpo = sucesso(await ctx.tokenCc(ctx.cliente('principal'), ['catalog.read']));
      esperar(!('refresh_token' in corpo), 'client_credentials devolveu refresh_token');
      r.evidencia('resposta sem refresh_token');
    },
  },
  {
    id: 'AUT-020',
    titulo: 'Recusa as concessões password e implicit',
    executar: async (ctx, r) => {
      const c = ctx.cliente('principal');
      const p = ctx.paciente('principal');
      erroOAuth(await ctx.token(c, { grant_type: 'password', username: p.usuario, password: p.senha ?? 'teste', scope: 'results.read' }), 400, 'unsupported_grant_type');
      erroOAuth(await ctx.token(c, { grant_type: 'implicit', scope: 'results.read' }), 400, 'unsupported_grant_type');
      const consentId = await ctx.novoConsentimento(c);
      erroOAuth((await ctx.par(c, consentId, { trocar: { response_type: 'token' } })).resposta, 400, 'invalid_request');
      r.evidencia('password e implicit: unsupported_grant_type; response_type=token no PAR: invalid_request');
    },
  },
  {
    id: 'AUT-021',
    titulo: 'Recusa escopo de paciente em client_credentials e de provedor na autorização',
    executar: async (ctx, r) => {
      const c = ctx.cliente('principal');
      erroOAuth(await ctx.tokenCc(c, ['results.read']), 400, 'invalid_scope');
      const consentId = await ctx.novoConsentimento(c);
      erroOAuth((await ctx.par(c, consentId, { escopos: ['results.read', 'catalog.read'] })).resposta, 400, 'invalid_scope');
      r.evidencia('results.read em client_credentials e catalog.read no PAR: invalid_scope');
    },
  },
  {
    id: 'AUT-022',
    titulo: 'Aceita schedule.read em client_credentials',
    executar: async (ctx, r) => {
      const c = ctx.cliente('principal');
      const token = await ctx.tokenDeProvedor(c, 'schedule.read');
      const agendas = recursos(sucesso(await ctx.fhir(token, 'Schedule?active=true')));
      esperar(agendas.length > 0, 'nenhuma Schedule ativa para buscar horários');
      const inicio = new Date(ctx.agoraMs()).toISOString();
      const fim = new Date(ctx.agoraMs() + 7 * 24 * 3600_000).toISOString();
      const slots = await ctx.fhir(token, `Slot?schedule=Schedule/${agendas[0]!.id}&status=free&start=ge${inicio}&start=lt${fim}`);
      sucesso(slots);
      r.evidencia(`token com schedule.read buscou ${recursos(slots.json as Record<string, unknown>).length} horários`);
    },
  },
  {
    id: 'AUT-023',
    titulo: 'Recusa cliente suspended ou withdrawn',
    executar: async (ctx, r) => {
      let testados = 0;
      for (const papel of ['suspenso', 'retirado'] as const) {
        const c = ctx.clientes.get(papel);
        if (!c) continue;
        esperar(c.participante.status !== 'active', `o cliente ${papel} está active no registro`);
        erroOAuth(await ctx.tokenCc(c, ['catalog.read']), 401, 'invalid_client');
        r.evidencia(`cliente ${c.participante.status}: 401 invalid_client`);
        testados++;
      }
      if (testados === 0) naoVerificavel('a configuração não tem clientes de teste suspended ou withdrawn');
      if (testados === 1) r.marcarParcial('só uma das duas situações tem cliente de teste');
    },
  },
  {
    id: 'AUT-024',
    titulo: 'Login e consentimento no domínio do provedor, sem endpoint que aceite credenciais do paciente',
    executar: async (ctx, r) => {
      const c = ctx.cliente('principal');
      const auth = new URL(ctx.endpoint('authorization_endpoint'));
      const issuer = new URL(ctx.issuer);
      const dominio = (h: string) => h.split('.').slice(-2).join('.');
      esperar(dominio(auth.hostname) === dominio(issuer.hostname), `authorization_endpoint em ${auth.hostname}, fora do domínio do issuer`);
      erroOAuth(await ctx.token(c, { grant_type: 'password', username: ctx.paciente('principal').usuario, password: 'teste' }), 400, 'unsupported_grant_type');
      const par = await parValido(ctx, c);
      const pagina = await abrirAutorizacao(ctx, ctx.urlDeAutorizacao(c.clientId, par.requestUri));
      esperar(pagina.status === 200, `página de autorização respondeu ${pagina.status}`);
      r.evidencia(`página de login servida por ${auth.origin}; concessão password recusada`);
      r.marcarParcial('a origem real das páginas de login e de consentimento e a ausência de outra interface de credenciais pedem inspeção humana');
    },
  },
  {
    id: 'AUT-025',
    titulo: 'Sem status 307 nos redirecionamentos da jornada',
    executar: async (ctx, r) => {
      const c = ctx.cliente('principal');
      const par = await parValido(ctx, c);
      const j = await ctx.jornada(c.clientId, par.requestUri, ctx.paciente('principal'));
      esperar(j.status !== 307, 'redirecionamento com 307');
      esperar(j.status >= 300 && j.status < 400, `status do redirecionamento: ${j.status}`);
      r.evidencia(`redirecionamento ao receptor com ${j.status}`);
    },
  },
  {
    id: 'AUT-026',
    titulo: 'Metadados com cada valor obrigatório da seção 5.2',
    executar: async (ctx, r) => {
      const erros = divergenciasDosMetadados(ctx, metadados(ctx));
      esperar(erros.length === 0, erros.join('; '));
      r.evidencia('14 campos conferidos');
    },
  },
  {
    id: 'AUT-027',
    titulo: 'Aceita client_credentials com um único escopo de provedor, qualquer que seja',
    executar: async (ctx, r) => {
      const c = ctx.cliente('principal');
      const suportados = ctx.provedor.provider!.scopes_supported.filter((s) => ESCOPOS_DE_PROVEDOR.includes(s));
      for (const s of suportados) {
        const resp = await ctx.tokenCc(c, [s]);
        esperar(resp.status === 200, `client_credentials só com ${s} recusado: ${resumo(resp)}`);
      }
      r.evidencia(`um token por escopo: ${suportados.join(', ')}`);
    },
  },
];

export function idDeInteracao(): string {
  return randomUUID();
}

export type { Relator };
