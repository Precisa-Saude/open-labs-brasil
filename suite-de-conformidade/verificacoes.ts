// Conferências reutilizadas pelos testes de requisito.

import type { Contexto } from './contexto.ts';
import { cabecalhoUnico, type Resposta } from './http.ts';
import { esperar, falhar } from './resultado.ts';

export const SISTEMA_DE_ERROS = 'urn:open-labs-brasil:error-code';

export type Json = Record<string, unknown>;

export function resumo(r: Resposta): string {
  return `${r.metodo} ${r.url.replace(/\?.*$/, '')} respondeu ${r.status} ${r.texto.slice(0, 160)}`;
}

/** Erro OAuth (seção 6.2.1): status e `error` esperados. */
export function erroOAuth(r: Resposta, status: number, codigos: string | string[]): void {
  const lista = Array.isArray(codigos) ? codigos : [codigos];
  const erro = (r.json as { error?: unknown } | undefined)?.error;
  esperar(
    r.status === status && typeof erro === 'string' && lista.includes(erro),
    `esperado ${status} ${lista.join(' ou ')}: ${resumo(r)}`,
  );
}

export function codigoDoErro(r: Resposta): string | undefined {
  const oo = r.json as
    | {
        resourceType?: string;
        issue?: Array<{ details?: { coding?: Array<{ system?: string; code?: string }> } }>;
      }
    | undefined;
  if (oo?.resourceType !== 'OperationOutcome') return undefined;
  return oo.issue?.[0]?.details?.coding?.find((c) => c.system === SISTEMA_DE_ERROS)?.code;
}

/** Erro de API (seção 6.3): status e código do protocolo no OperationOutcome. */
export function erroApi(r: Resposta, status: number, codigo: string): void {
  esperar(
    r.status === status && codigoDoErro(r) === codigo,
    `esperado ${status} ${codigo}: ${resumo(r)}`,
  );
}

export function sucesso(r: Resposta, status = 200): Json {
  esperar(r.status === status, `esperado ${status}: ${resumo(r)}`);
  return (r.json ?? {}) as Json;
}

export interface Entrada {
  fullUrl?: string;
  resource?: Json & { resourceType: string; id?: string };
  search?: { mode?: string };
}

export function entradas(bundle: Json, modo = 'match'): Entrada[] {
  esperar(
    bundle.resourceType === 'Bundle' && bundle.type === 'searchset',
    'a busca não devolveu Bundle searchset',
  );
  return ((bundle.entry as Entrada[] | undefined) ?? []).filter(
    (e) => (e.search?.mode ?? 'match') === modo,
  );
}

export function recursos(
  bundle: Json,
  modo = 'match',
): Array<Json & { resourceType: string; id: string }> {
  return entradas(bundle, modo).map(
    (e) => e.resource as Json & { resourceType: string; id: string },
  );
}

export function linkProximo(bundle: Json): string | undefined {
  return ((bundle.link as Array<{ relation?: string; url?: string }> | undefined) ?? []).find(
    (l) => l.relation === 'next',
  )?.url;
}

export { dentroDaBase } from '../comum/metadados.ts';
import { dentroDaBase } from '../comum/metadados.ts';

/** Segue todas as páginas, conferindo cada link contra o fhir_base_url (seção 5.1). */
export async function todasAsPaginas(
  ctx: Contexto,
  token: string,
  caminho: string,
  limite = 200,
): Promise<{
  recursos: Array<Json & { resourceType: string; id: string }>;
  paginas: number;
  bundles: Json[];
}> {
  const lista: Array<Json & { resourceType: string; id: string }> = [];
  const bundles: Json[] = [];
  let url: string | undefined = caminho.startsWith('https://')
    ? caminho
    : `${ctx.fhirBase}/${caminho.replace(/^\//, '')}`;
  let paginas = 0;
  let anterior: string | undefined;
  while (url) {
    // Link relativo resolvido contra a URL da requisição que devolveu o Bundle (seção 5.1).
    if (!dentroDaBase(url, ctx.fhirBase, anterior))
      falhar(`link de paginação fora do fhir_base_url: ${url}`);
    url = anterior ? new URL(url, anterior).toString() : url;
    const r = await ctx.fhir(token, url);
    const b = sucesso(r);
    bundles.push(b);
    lista.push(...recursos(b));
    paginas++;
    if (paginas > limite) falhar('paginação não termina');
    anterior = url;
    url = linkProximo(b);
  }
  return { bundles, paginas, recursos: lista };
}

export function interacao(r: Resposta): string | undefined {
  return cabecalhoUnico(r, 'x-fapi-interaction-id');
}

export function paramsDoRedirecionamento(location: string): URLSearchParams {
  return new URL(location).searchParams;
}
