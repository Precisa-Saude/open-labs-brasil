// CAT, UNI e AGE: catálogo, unidades e agenda, com token de provedor (seção 9.3).

import { codigoDoErro, erroApi, recursos, sucesso, todasAsPaginas, type Json } from '../verificacoes.ts';
import { esperar, falhar, naoVerificavel } from '../resultado.ts';
import { agendaDaUnidade, codingsDe, contemToken, horariosLivres, janela } from './apoio.ts';
import type { Teste } from './tipos.ts';

const lista = (v: unknown): Json[] => (Array.isArray(v) ? (v as Json[]) : []);
const chave = (c: { system?: string; code?: string }) => `${c.system ?? ''}|${c.code ?? ''}`;

function instanteComMs(ms: number): string {
  return new Date(ms).toISOString();
}

export const testesDeCatalogoEAgenda: Teste[] = [
  {
    id: 'CAT-001',
    titulo: 'ActivityDefinition com status, url e _lastUpdated',
    executar: async (ctx, r) => {
      const token = await ctx.tokenDeProvedor(ctx.cliente('principal'), 'catalog.read');
      const ativos = (await todasAsPaginas(ctx, token, 'ActivityDefinition?status=active&_count=100')).recursos;
      esperar(ativos.length > 0, 'catálogo sem itens ativos');
      esperar(ativos.every((a) => a.status === 'active'), 'status=active devolveu item em outro estado');
      const alvo = ativos[0]!;
      const porUrl = recursos(sucesso(await ctx.fhir(token, `ActivityDefinition?url=${encodeURIComponent(String(alvo.url))}`)));
      esperar(porUrl.length === 1 && porUrl[0]!.id === alvo.id, `busca por url devolveu ${porUrl.length} itens`);
      const passado = recursos(sucesso(await ctx.fhir(token, 'ActivityDefinition?_lastUpdated=gt2000-01-01&_count=100')));
      esperar(passado.length > 0, '_lastUpdated=gt2000-01-01 não devolveu nada');
      const futuro = recursos(sucesso(await ctx.fhir(token, `ActivityDefinition?_lastUpdated=gt${instanteComMs(ctx.agoraMs() + 365 * 24 * 3600_000)}`)));
      esperar(futuro.length === 0, '_lastUpdated no futuro devolveu itens');
      r.evidencia(`${ativos.length} ativos; url, _lastUpdated no passado e no futuro conferidos`);
    },
  },
  {
    id: 'CAT-002',
    titulo: 'ChargeItemDefinition com status, url, jurisdiction e _lastUpdated',
    executar: async (ctx, r) => {
      const token = await ctx.tokenDeProvedor(ctx.cliente('principal'), 'catalog.read');
      const precos = (await todasAsPaginas(ctx, token, 'ChargeItemDefinition?status=active&_count=100')).recursos;
      esperar(precos.length > 0, 'sem preços ativos');
      esperar(precos.every((p) => p.status === 'active'), 'status=active devolveu preço em outro estado');
      const alvo = precos[0]!;
      const porUrl = recursos(sucesso(await ctx.fhir(token, `ChargeItemDefinition?url=${encodeURIComponent(String(alvo.url))}`)));
      esperar(porUrl.length === 1 && porUrl[0]!.id === alvo.id, 'busca por url não devolveu exatamente o preço');
      const comMunicipio = precos.find((p) => lista(p.jurisdiction).length > 0);
      if (!comMunicipio) naoVerificavel('nenhum preço com jurisdiction para testar a busca por município');
      const j = lista(lista(comMunicipio.jurisdiction)[0]!.coding)[0]!;
      const token2 = `${String(j.system)}|${String(j.code)}`;
      const porMunicipio = (await todasAsPaginas(ctx, token, `ChargeItemDefinition?jurisdiction=${encodeURIComponent(token2)}&_count=100`)).recursos;
      esperar(porMunicipio.length > 0, 'busca por jurisdiction vazia');
      esperar(porMunicipio.every((p) => lista(p.jurisdiction).some((x) => lista(x.coding).some((c) => c.system === j.system && c.code === j.code))), 'busca por jurisdiction devolveu preço de outro município');
      const futuro = recursos(sucesso(await ctx.fhir(token, `ChargeItemDefinition?_lastUpdated=gt${instanteComMs(ctx.agoraMs() + 365 * 24 * 3600_000)}`)));
      esperar(futuro.length === 0, '_lastUpdated no futuro devolveu preços');
      r.evidencia(`${precos.length} preços; url, jurisdiction ${token2} (${porMunicipio.length}) e _lastUpdated conferidos`);
    },
  },
  {
    id: 'CAT-003',
    titulo: 'Item retirado continua legível com status retired e aparece na busca por _lastUpdated',
    executar: async (ctx, r) => {
      const token = await ctx.tokenDeProvedor(ctx.cliente('principal'), 'catalog.read');
      let alvo: string | undefined = ctx.cfg.catalogo?.item_para_retirar;
      let antes = ctx.agoraMs() - 1000;
      if (ctx.temControle && alvo) {
        antes = ctx.agoraMs() - 2000;
        const rc = await ctx.controle('POST', '/_controle/catalogo/retirar', { id: alvo });
        esperar(rc.status === 200, `interface de controle não retirou ${alvo}`);
      } else {
        const retirados = recursos(sucesso(await ctx.fhir(token, 'ActivityDefinition?status=retired')));
        if (retirados.length === 0) naoVerificavel('sem item retirado no ambiente e sem interface de controle para retirar um');
        alvo = retirados[0]!.id;
        antes = Date.parse(String((retirados[0]!.meta as Json).lastUpdated)) - 1;
      }
      const lido = sucesso(await ctx.fhir(token, `ActivityDefinition/${alvo}`));
      esperar(lido.status === 'retired', `item ${alvo} legível, mas com status ${String(lido.status)}`);
      const incrementais = recursos(sucesso(await ctx.fhir(token, `ActivityDefinition?_lastUpdated=gt${instanteComMs(antes)}&_count=100`)));
      esperar(incrementais.some((x) => x.id === alvo), 'o item retirado não aparece na busca incremental por _lastUpdated');
      r.evidencia(`${alvo}: retired, legível e presente na busca por _lastUpdated`);
    },
  },
  {
    id: 'CAT-004',
    titulo: 'Todo ChargeItemDefinition ativo tem code igual ao de algum ActivityDefinition',
    executar: async (ctx, r) => {
      const token = await ctx.tokenDeProvedor(ctx.cliente('principal'), 'catalog.read');
      const ads = (await todasAsPaginas(ctx, token, 'ActivityDefinition?_count=100')).recursos;
      const precos = (await todasAsPaginas(ctx, token, 'ChargeItemDefinition?status=active&_count=100')).recursos;
      const codigos = new Set(ads.flatMap((a) => codingsDe(a).map(chave)));
      const orfaos = precos.filter((p) => !codingsDe(p).some((c) => codigos.has(chave(c))));
      esperar(orfaos.length === 0, `preços sem exame correspondente: ${orfaos.map((o) => o.id).slice(0, 5).join(', ')}`);
      r.evidencia(`${precos.length} preços ativos cruzados com ${ads.length} exames`);
    },
  },
  {
    id: 'UNI-001',
    titulo: 'Location com status, address-city, address-state e _lastUpdated',
    executar: async (ctx, r) => {
      const token = await ctx.tokenDeProvedor(ctx.cliente('principal'), 'locations.read');
      const ativas = (await todasAsPaginas(ctx, token, 'Location?status=active')).recursos;
      esperar(ativas.length > 0, 'sem unidades ativas');
      const alvo = ativas.find((l) => (l.address as Json | undefined)?.city) ?? falhar('nenhuma unidade com address.city');
      const cidade = String((alvo.address as Json).city);
      const uf = String((alvo.address as Json).state);
      const porCidade = recursos(sucesso(await ctx.fhir(token, `Location?address-city=${encodeURIComponent(cidade)}`)));
      esperar(porCidade.some((l) => l.id === alvo.id) && porCidade.every((l) => String((l.address as Json).city).toLowerCase().startsWith(cidade.toLowerCase())), 'busca por address-city incorreta');
      const porUf = recursos(sucesso(await ctx.fhir(token, `Location?address-state=${encodeURIComponent(uf)}`)));
      esperar(porUf.some((l) => l.id === alvo.id), 'busca por address-state não devolveu a unidade');
      const futuro = recursos(sucesso(await ctx.fhir(token, `Location?_lastUpdated=gt${instanteComMs(ctx.agoraMs() + 365 * 24 * 3600_000)}`)));
      esperar(futuro.length === 0, '_lastUpdated no futuro devolveu unidades');
      r.evidencia(`${ativas.length} unidades; ${cidade}/${uf} conferidos`);
    },
  },
  {
    id: 'UNI-002',
    titulo: 'HealthcareService com location, active e _lastUpdated',
    executar: async (ctx, r) => {
      const token = await ctx.tokenDeProvedor(ctx.cliente('principal'), 'locations.read');
      const unidades = ctx.cfg.agenda?.unidade
        ? [ctx.cfg.agenda.unidade.replace('Location/', '')]
        : recursos(sucesso(await ctx.fhir(token, 'Location?status=active'))).map((l) => l.id);
      let servicos: Array<Json & { id: string }> = [];
      let unidade = { id: '' };
      for (const id of unidades) {
        servicos = recursos(sucesso(await ctx.fhir(token, `HealthcareService?location=Location/${id}&active=true`)));
        unidade = { id };
        if (servicos.length > 0) break;
      }
      esperar(servicos.length > 0, 'nenhuma unidade com serviço ativo');
      esperar(servicos.every((s) => s.active === true && lista(s.location).some((l) => l.reference === `Location/${unidade.id}`)), 'serviço de outra unidade ou inativo');
      const todos = (await todasAsPaginas(ctx, token, 'HealthcareService?_count=100')).recursos;
      esperar(todos.length >= servicos.length, 'a busca sem filtro devolveu menos serviços que a filtrada');
      const futuro = recursos(sucesso(await ctx.fhir(token, `HealthcareService?_lastUpdated=gt${instanteComMs(ctx.agoraMs() + 365 * 24 * 3600_000)}`)));
      esperar(futuro.length === 0, '_lastUpdated no futuro devolveu serviços');
      r.evidencia(`${servicos.length} serviços em Location/${unidade.id}`);
    },
  },
  {
    id: 'AGE-001',
    titulo: 'Schedule e Slot com token de provedor com schedule.read, sem consentimento nem dado de paciente',
    executar: async (ctx, r) => {
      const token = await ctx.tokenDeProvedor(ctx.cliente('principal'), 'schedule.read');
      const agendas = recursos(sucesso(await ctx.fhir(token, 'Schedule?active=true')));
      esperar(agendas.length > 0, 'sem agenda ativa');
      const { lista: slots } = await horariosLivres(ctx, token, `Schedule/${agendas[0]!.id}`);
      r.evidencia(`token só com schedule.read: ${agendas.length} agendas, ${slots.length} horários livres em 14 dias`);
    },
  },
  {
    id: 'AGE-002',
    titulo: 'Schedule com actor e active',
    executar: async (ctx, r) => {
      const token = await ctx.tokenDeProvedor(ctx.cliente('principal'), 'schedule.read');
      const unidade = ctx.cfg.agenda?.unidade ?? naoVerificavel('a configuração não indica agenda.unidade');
      const b = recursos(sucesso(await ctx.fhir(token, `Schedule?actor=${encodeURIComponent(unidade)}&active=true`)));
      esperar(b.length > 0, `nenhuma agenda para ${unidade}`);
      esperar(b.every((s) => s.active === true && lista(s.actor).some((a) => a.reference === unidade)), 'agenda de outra unidade ou inativa');
      r.evidencia(`${b.length} agenda(s) de ${unidade}`);
    },
  },
  {
    id: 'AGE-003',
    titulo: 'Recusa busca de Slot sem schedule ou sem os dois limites de start',
    executar: async (ctx, r) => {
      const token = await ctx.tokenDeProvedor(ctx.cliente('principal'), 'schedule.read');
      const unidade = ctx.cfg.agenda?.unidade ?? naoVerificavel('a configuração não indica agenda.unidade');
      const agenda = await agendaDaUnidade(ctx, token, unidade);
      const { inicio, fim } = janela(ctx, 7);
      erroApi(await ctx.fhir(token, `Slot?status=free&start=ge${inicio}&start=lt${fim}`), 400, 'INVALID_REQUEST');
      erroApi(await ctx.fhir(token, `Slot?schedule=${agenda}&status=free&start=ge${inicio}`), 400, 'INVALID_REQUEST');
      erroApi(await ctx.fhir(token, `Slot?schedule=${agenda}&status=free&start=lt${fim}`), 400, 'INVALID_REQUEST');
      erroApi(await ctx.fhir(token, `Slot?schedule=${agenda}&status=free`), 400, 'INVALID_REQUEST');
      r.evidencia('sem schedule, só limite inferior, só superior e sem start: 400 INVALID_REQUEST');
    },
  },
  {
    id: 'AGE-004',
    titulo: 'Recusa janela de start maior que 31 dias',
    executar: async (ctx, r) => {
      const token = await ctx.tokenDeProvedor(ctx.cliente('principal'), 'schedule.read');
      const unidade = ctx.cfg.agenda?.unidade ?? naoVerificavel('a configuração não indica agenda.unidade');
      const agenda = await agendaDaUnidade(ctx, token, unidade);
      const { inicio, fim } = janela(ctx, 32);
      erroApi(await ctx.fhir(token, `Slot?schedule=${agenda}&start=ge${inicio}&start=lt${fim}`), 400, 'SEARCH_WINDOW_TOO_LARGE');
      const ok = janela(ctx, 31);
      const resp = await ctx.fhir(token, `Slot?schedule=${agenda}&start=ge${ok.inicio}&start=lt${ok.fim}`);
      esperar(resp.status === 200, `janela de exatamente 31 dias recusada: ${resp.status} ${codigoDoErro(resp) ?? ''}`);
      r.evidencia('32 dias: 400 SEARCH_WINDOW_TOO_LARGE; 31 dias: 200');
    },
  },
  {
    id: 'AGE-005',
    titulo: 'service-type repetido devolve só horários que atendem a todos os exames',
    executar: async (ctx, r) => {
      const token = await ctx.tokenDeProvedor(ctx.cliente('principal'), 'schedule.read');
      const a = ctx.cfg.agenda;
      if (!a?.unidade || !a.exame_comum || !a.exame_restrito) naoVerificavel('a configuração não indica agenda.unidade, exame_comum e exame_restrito');
      const agenda = await agendaDaUnidade(ctx, token, a.unidade);
      const comum = (await horariosLivres(ctx, token, agenda, [a.exame_comum])).lista;
      const restrito = (await horariosLivres(ctx, token, agenda, [a.exame_restrito])).lista;
      const cesta = (await horariosLivres(ctx, token, agenda, [a.exame_comum, a.exame_restrito])).lista;
      esperar(comum.length > 0 && restrito.length > 0, 'os exames da configuração não têm horários livres na unidade');
      esperar(restrito.length < comum.length, 'o exame restrito não restringe os horários; escolha outro na configuração');
      const atende = (s: Json, t: string) => lista(s.serviceType).some((st) => contemToken(lista(st.coding) as never, t));
      esperar(cesta.every((s) => atende(s, a.exame_comum!) && atende(s, a.exame_restrito!)), 'horário da cesta não atende os dois exames');
      const idsDoRestrito = new Set(restrito.map((s) => s.id));
      esperar(cesta.length > 0 && cesta.every((s) => idsDoRestrito.has(s.id)) && cesta.length <= restrito.length, 'a cesta não é a interseção dos horários');
      r.evidencia(`comum ${comum.length}, restrito ${restrito.length}, cesta ${cesta.length} horários`);
    },
  },
  {
    id: 'AGE-006',
    titulo: 'Exame não coletado na unidade: Bundle sem horários e OperationOutcome EXAM_NOT_AVAILABLE_AT_LOCATION',
    executar: async (ctx, r) => {
      const token = await ctx.tokenDeProvedor(ctx.cliente('principal'), 'schedule.read');
      const ind = ctx.cfg.agenda?.exame_indisponivel ?? naoVerificavel('a configuração não indica agenda.exame_indisponivel');
      const agenda = await agendaDaUnidade(ctx, token, ind.unidade);
      const comum = ctx.cfg.agenda?.exame_comum;
      const { bundle, lista: horarios } = await horariosLivres(ctx, token, agenda, comum ? [comum, ind.exame] : [ind.exame]);
      esperar(horarios.length === 0, `devolveu ${horarios.length} horários para exame que a unidade não coleta`);
      const outcome = recursos(bundle, 'outcome').find((o) => o.resourceType === 'OperationOutcome');
      const issue = lista(outcome?.issue)[0];
      const codigo = lista((issue?.details as Json | undefined)?.coding).find((c) => c.system === 'urn:open-labs-brasil:error-code')?.code;
      esperar(codigo === 'EXAM_NOT_AVAILABLE_AT_LOCATION', `entrada outcome sem EXAM_NOT_AVAILABLE_AT_LOCATION (veio ${String(codigo)})`);
      esperar(issue?.severity === 'information', `severity ${String(issue?.severity)}`);
      esperar(String(issue?.diagnostics ?? '').includes(ind.exame.split('|').pop()!), 'diagnostics sem o exame não atendido');
      r.evidencia(`${ind.exame} em ${ind.unidade}: Bundle vazio com OperationOutcome informativo`);
    },
  },
];
