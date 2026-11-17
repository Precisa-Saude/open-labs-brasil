// Jornada de ponta a ponta contra o servidor de exemplo, com o receptor mínimo:
// conectar, ver preços e horários, agendar, pagar, cancelar e revogar, e uma
// segunda conexão com CPF divergente. O "navegador" aqui faz o papel do
// paciente nas páginas de teste do servidor de exemplo (login e tela de
// consentimento): ele não faz parte do receptor, que nunca vê a senha.
//
//   node suite-de-conformidade/receptor-minimo/jornada.ts

import { randomUUID } from 'node:crypto';
import https from 'node:https';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { rootCertificates } from 'node:tls';
import type { JWK } from 'jose';
import { verificarCandidato, baixarRegistro, type ChaveDoRegistro } from '../../comum/registro.ts';
import { lerConfiguracao } from '../../servidor-de-exemplo/configuracao.ts';
import { iniciarServidor } from '../../servidor-de-exemplo/servidor.ts';
import { caminhoDe, lerConfiguracaoDaSuite } from '../configuracao.ts';
import { Hospedagem } from '../hospedagem.ts';
import { garantirAmbiente, PASTA_DO_AMBIENTE } from '../local.ts';
import { ReceptorMinimo, type Vinculo } from './receptor.ts';

type Json = Record<string, unknown>;

const real = (v: number | undefined) => (v === undefined ? 'sem preço' : `R$ ${v.toFixed(2).replace('.', ',')}`);

/** Navegador mínimo: GET e POST de formulário, sem certificado de cliente, sem seguir redirecionamento. */
class Navegador {
  readonly ca: string;
  constructor(ca: string) {
    this.ca = ca;
  }
  pedir(url: string, form?: Record<string, string>): Promise<{ status: number; html: string; location?: string }> {
    return new Promise((resolver, rejeitar) => {
      const corpo = form ? new URLSearchParams(form).toString() : undefined;
      const req = https.request(url, {
        method: form ? 'POST' : 'GET',
        ca: this.ca,
        agent: false,
        headers: form ? { 'content-type': 'application/x-www-form-urlencoded', 'content-length': Buffer.byteLength(corpo!) } : {},
      }, (res) => {
        let html = '';
        res.setEncoding('utf8');
        res.on('data', (p: string) => (html += p));
        res.on('end', () => resolver({ status: res.statusCode ?? 0, html, ...(res.headers.location ? { location: res.headers.location } : {}) }));
      });
      req.on('error', rejeitar);
      if (corpo) req.write(corpo);
      req.end();
    });
  }
}

function formulario(html: string, base: string): { acao: string; campos: Record<string, string> } {
  const acao = /<form method="post" action="([^"]+)"/.exec(html)?.[1];
  if (!acao) throw new Error('página sem formulário');
  const campos: Record<string, string> = {};
  for (const m of html.matchAll(/<input type="hidden" name="([^"]+)" value="([^"]*)">/g)) campos[m[1]!] = m[2]!.replace(/&amp;/g, '&');
  return { acao: new URL(acao.replace(/&amp;/g, '&'), base).toString(), campos };
}

/** O paciente entra na página do laboratório e decide. Devolve o endereço de retorno ao aplicativo. */
async function pacienteNoNavegador(nav: Navegador, url: string, usuario: string, decisao: 'aprovar' | 'recusar', conferirTela?: (html: string) => void): Promise<string> {
  const login = await nav.pedir(url);
  if (login.status !== 200) throw new Error(`página de login respondeu ${login.status}`);
  const f1 = formulario(login.html, url);
  const tela = await nav.pedir(f1.acao, { ...f1.campos, usuario, senha: 'teste' });
  if (tela.status !== 200) throw new Error(`login respondeu ${tela.status}`);
  conferirTela?.(tela.html);
  const f2 = formulario(tela.html, url);
  const fim = await nav.pedir(f2.acao, { ...f2.campos, decisao });
  if (fim.status !== 303 || !fim.location) throw new Error(`decisão respondeu ${fim.status}`);
  return fim.location;
}

export interface ResumoDaJornada {
  passos: string[];
  agendamentoFinal: string;
  revogacao: string;
  tokenDepoisDaRevogacao: number;
  divergencia: string;
  estadoDaDivergencia: string;
}

export async function executarJornada(imprimir: (linha: string) => void = () => {}): Promise<ResumoDaJornada> {
  await garantirAmbiente();
  const servidor = await iniciarServidor(lerConfiguracao(join(PASTA_DO_AMBIENTE, 'servidor.config.json'), { registrarEmLog: false }));
  const cfg = lerConfiguracaoDaSuite(join(PASTA_DO_AMBIENTE, 'suite.config.json'));
  const ca = [...rootCertificates, readFileSync(caminhoDe(cfg, cfg.provedor.ca_confiavel!), 'utf8')].join('\n');
  const passos: string[] = [];
  const passo = (t: string) => {
    passos.push(t);
    imprimir(`[ok] ${t}`);
  };

  // O backend do receptor publica o próprio jwks_uri; o mantenedor publica o registro.
  const hospedagem = new Hospedagem();
  const principal = cfg.clientes.principal;
  const bytes = readFileSync(caminhoDe(cfg, cfg.registro.documento));
  const jws = readFileSync(caminhoDe(cfg, cfg.registro.assinatura), 'utf8');
  hospedagem.publicar(cfg.registro.caminho_de_publicacao!, bytes);
  hospedagem.publicar(`${cfg.registro.caminho_de_publicacao!}.jws`, jws);
  try {
    const doc = JSON.parse(bytes.toString('utf8')) as { participants: Array<{ receiver?: { client_id: string; jwks_uri: string } }> };
    const eu = doc.participants.find((p) => p.receiver?.client_id === principal.client_id)!;
    hospedagem.publicar(new URL(eu.receiver!.jwks_uri).pathname, readFileSync(caminhoDe(cfg, principal.jwks_publico!)));
    await hospedagem.iniciar({ endereco: cfg.hospedagem!.endereco_de_escuta, porta: cfg.hospedagem!.porta, certificado: caminhoDe(cfg, cfg.hospedagem!.certificado), chave: caminhoDe(cfg, cfg.hospedagem!.chave) });

    // V1 a V14: o receptor baixa o registro por HTTPS e verifica com as chaves iniciais.
    const url = `https://localhost:${cfg.hospedagem!.porta}${cfg.registro.caminho_de_publicacao!}`;
    const baixado = await baixarRegistro(url, { ca });
    if ('erro' in baixado) throw new Error(baixado.erro);
    const iniciais = JSON.parse(readFileSync(caminhoDe(cfg, cfg.registro.chaves_iniciais), 'utf8')) as { keys: ChaveDoRegistro[] };
    const v = await verificarCandidato({ ...baixado, chavesConfiaveis: iniciais.keys, ambiente: 'pilot', agora: new Date() });
    if (!v.aceito) throw new Error(`registro recusado em ${v.passo}`);
    passo(`registro baixado por HTTPS e verificado (V1 a V14), sequence ${v.documento.sequence}`);

    const receptor = new ReceptorMinimo({
      registro: v.documento,
      participantIdDoProvedor: cfg.provedor.participant_id,
      clientId: principal.client_id,
      chaveDeAssinatura: JSON.parse(readFileSync(caminhoDe(cfg, principal.chave_de_assinatura), 'utf8')) as JWK,
      certificado: { cert: readFileSync(caminhoDe(cfg, principal.certificados[0]!.certificado)), key: readFileSync(caminhoDe(cfg, principal.certificados[0]!.chave)) },
      ca,
    });
    await receptor.descobrir();
    passo(`metadados de ${receptor.provedor.provider!.issuer} conferidos campo a campo`);

    // Preços e horários, antes de o paciente se conectar.
    const { exames, precos } = await receptor.catalogo();
    const unidades = await receptor.unidades();
    const centro = unidades.find((u) => u.id === 'unidade-centro')!;
    const glicose = exames.find((e) => e.id === 'glicose')!;
    const hemograma = exames.find((e) => e.id === 'hemograma')!;
    const precoGlicose = receptor.precoNaUnidade(glicose, precos, centro, '4314902');
    const precoHemograma = receptor.precoNaUnidade(hemograma, precos, centro, '4314902');
    passo(`catálogo com ${exames.length} exames e ${precos.length} preços; na unidade Centro, glicose ${real(precoGlicose)} e hemograma ${real(precoHemograma)}`);
    const horarios = await receptor.horarios('Location/unidade-centro', [glicose, hemograma]);
    if (horarios.length === 0) throw new Error('sem horários livres');
    passo(`${horarios.length} horários livres para glicose e hemograma na unidade Centro; primeiro: ${String(horarios[0]!.start)}`);

    // Conexão: o paciente autoriza na página do laboratório.
    const nav = new Navegador(ca);
    const ana = cfg.pacientes.principal;
    const jornada = await receptor.iniciarConexao(ana.cpf!);
    const retorno = await pacienteNoNavegador(nav, jornada.urlDeAutorizacao, ana.usuario, 'aprovar', (html) => {
      for (const esperado of ['Aplicativo de Teste A', 'Reunir seus resultados', 'confirmar ao aplicativo o CPF', 'Página de teste']) {
        if (!html.includes(esperado)) throw new Error(`tela de consentimento sem "${esperado}"`);
      }
    });
    const conexao = await receptor.concluirConexao(retorno);
    if (!conexao.ok) throw new Error(`conexão falhou: ${conexao.motivo} ${conexao.detalhe}`);
    const vinculo: Vinculo = conexao.vinculo;
    passo('paciente entrou na página do laboratório, aprovou; código trocado e CPF do titular conferido');

    const laudos = await receptor.resultados(vinculo);
    passo(`${laudos.length} laudos liberados lidos com o token de paciente`);

    // Agendar, pagar e cancelar.
    const agendamento = await receptor.agendar(vinculo, { slot: horarios[0]!, exames: [glicose, hemograma], unidade: 'Location/unidade-centro' });
    const link = receptor.linkDePagamento(agendamento);
    if (agendamento.status !== 'pending' || !link) throw new Error(`agendamento sem pagamento pendente: ${String(agendamento.status)}`);
    passo(`agendado Appointment/${String(agendamento.id)} (pending), link de pagamento https no domínio do laboratório`);
    const pagina = await nav.pedir(link);
    const pagamento = formulario(pagina.html, link);
    await nav.pedir(pagamento.acao, { ...pagamento.campos, acao: 'pagar' });
    const pago = await receptor.lerAgendamento(vinculo, String(agendamento.id));
    if (pago.recurso.status !== 'booked') throw new Error(`depois do pagamento: ${String(pago.recurso.status)}`);
    passo('pagamento na página do laboratório; agendamento passou a booked');
    const cancelado = await receptor.cancelar(vinculo, String(agendamento.id));
    if (cancelado.status !== 'cancelled') throw new Error('cancelamento sem cancelled');
    passo('agendamento cancelado com PUT e If-Match');

    // Revogar: o receptor descarta os tokens e o provedor os invalida.
    const tokenAntigo = vinculo.accessToken!;
    const revogacao = await receptor.revogar(vinculo);
    const depois = await new Promise<number>((resolver, rejeitar) => {
      const req = https.request(`${receptor.fhirBase}/Patient/${vinculo.pacienteFhirId}`, {
        ca, agent: false, cert: readFileSync(caminhoDe(cfg, principal.certificados[0]!.certificado)), key: readFileSync(caminhoDe(cfg, principal.certificados[0]!.chave)),
        headers: { authorization: `Bearer ${tokenAntigo}`, accept: 'application/fhir+json', 'x-fapi-interaction-id': randomUUID() },
      }, (res) => {
        res.resume();
        resolver(res.statusCode ?? 0);
      });
      req.on('error', rejeitar);
      req.end();
    });
    if (revogacao !== 'revogado' || depois !== 401) throw new Error(`revogação ${revogacao}, token antigo respondeu ${depois}`);
    passo('consentimento revogado (204); o token antigo passou a receber 401');

    // Segunda jornada: o aplicativo acha que é o Bruno, mas quem entra no laboratório é a Ana.
    const bruno = cfg.pacientes.outro!;
    const j2 = await receptor.iniciarConexao(bruno.cpf!);
    const r2 = await pacienteNoNavegador(nav, j2.urlDeAutorizacao, ana.usuario, 'aprovar');
    const divergente = await receptor.concluirConexao(r2);
    if (divergente.ok || divergente.motivo !== 'PATIENT_MISMATCH') throw new Error('CPF divergente não foi detectado');
    const tokenDeConsulta = await receptor.tokenDeProvedor('consent.manage');
    const estado = await new Promise<Json>((resolver, rejeitar) => {
      const req = https.request(`${receptor.apiBase}/consents/${j2.consentId}`, {
        ca, agent: false, cert: readFileSync(caminhoDe(cfg, principal.certificados[0]!.certificado)), key: readFileSync(caminhoDe(cfg, principal.certificados[0]!.chave)),
        headers: { authorization: `Bearer ${tokenDeConsulta}`, accept: 'application/json', 'x-fapi-interaction-id': randomUUID() },
      }, (res) => {
        let t = '';
        res.on('data', (p: Buffer) => (t += p.toString()));
        res.on('end', () => resolver(JSON.parse(t) as Json));
      });
      req.on('error', rejeitar);
      req.end();
    });
    const motivo = (estado.status_reason as { code?: string } | undefined)?.code;
    if (estado.status !== 'REVOKED' || motivo !== 'PATIENT_MISMATCH') throw new Error(`estado depois da divergência: ${String(estado.status)} ${String(motivo)}`);
    passo('CPF divergente: o receptor revogou com PATIENT_MISMATCH sem chamar a API FHIR');

    return {
      passos,
      agendamentoFinal: String(cancelado.status),
      revogacao,
      tokenDepoisDaRevogacao: depois,
      divergencia: divergente.motivo,
      estadoDaDivergencia: `${String(estado.status)} ${String(motivo)}`,
    };
  } finally {
    await hospedagem.fechar();
    await servidor.fechar();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('Jornada de ponta a ponta: receptor mínimo contra o servidor de exemplo\n');
  try {
    await executarJornada((l) => console.log(l));
    console.log('\nJornada concluída.');
  } catch (e) {
    console.error(`\nA jornada falhou: ${(e as Error).message}`);
    process.exit(1);
  }
}
