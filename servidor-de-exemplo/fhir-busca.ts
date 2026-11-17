// Busca FHIR R4 simplificada: só os tipos de parâmetro que o protocolo usa
// (token, string, reference, date, uri), com "e" entre parâmetros repetidos e
// "ou" entre valores separados por vírgula [FHIR-SEARCH].

import type { Recurso, Registro } from './dados.ts';
import { ErroDeApi } from './http.ts';

export type TipoDeParametro = 'token' | 'string' | 'reference' | 'date' | 'uri';

export interface Token {
  code: string;
  system?: string;
}

export interface DefinicaoDeParametro {
  /** Tipo do recurso referenciado, para valores de reference sem tipo. */
  alvo?: string;
  extrair: (registro: Registro) => unknown[];
  tipo: TipoDeParametro;
}

type Faixa = [number, number];

const FUSO_PADRAO = '-03:00';

/** Interpreta um valor de data FHIR como faixa [início, fim) em milissegundos. */
export function faixaDeData(valor: string): Faixa | undefined {
  const m =
    /^(\d{4})(?:-(\d{2})(?:-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(Z|[+-]\d{2}:\d{2})?)?)?)?$/.exec(
      valor,
    );
  if (!m) return undefined;
  const [, a, mes, dia, h, min, s, fracao, fuso] = m;
  const zona = fuso ?? FUSO_PADRAO;
  const desloc =
    zona === 'Z'
      ? 0
      : (zona.startsWith('-') ? -1 : 1) *
        (Number(zona.slice(1, 3)) * 60 + Number(zona.slice(4, 6)));
  const ano = Number(a);
  const inicio = (y: number, mo: number, d: number, hh = 0, mm = 0, ss = 0, ms = 0) =>
    Date.UTC(y, mo, d, hh, mm, ss, ms) - desloc * 60_000;
  if (!mes) return [inicio(ano, 0, 1), inicio(ano + 1, 0, 1)];
  const mo = Number(mes) - 1;
  if (!dia) return [inicio(ano, mo, 1), inicio(ano, mo + 1, 1)];
  const d = Number(dia);
  if (!h) return [inicio(ano, mo, d), inicio(ano, mo, d + 1)];
  if (!s) {
    const t = inicio(ano, mo, d, Number(h), Number(min));
    return [t, t + 60_000];
  }
  if (!fracao) {
    const t = inicio(ano, mo, d, Number(h), Number(min), Number(s));
    return [t, t + 1000];
  }
  const ms = Number(fracao.slice(0, 3).padEnd(3, '0'));
  const t = inicio(ano, mo, d, Number(h), Number(min), Number(s), ms);
  return [t, t + 1];
}

const PREFIXOS = ['eq', 'ne', 'gt', 'lt', 'ge', 'le', 'sa', 'eb', 'ap'] as const;
type Prefixo = (typeof PREFIXOS)[number];

export function analisarData(valor: string): { prefixo: Prefixo; faixa: Faixa } {
  let prefixo: Prefixo = 'eq';
  let resto = valor;
  const p = valor.slice(0, 2);
  if ((PREFIXOS as readonly string[]).includes(p) && /^[a-z]{2}\d/.test(valor)) {
    prefixo = p as Prefixo;
    resto = valor.slice(2);
  }
  const faixa = faixaDeData(resto);
  if (!faixa)
    throw new ErroDeApi(400, 'INVALID_REQUEST', 'invalid', `Data inválida na busca: ${valor}`);
  return { faixa, prefixo };
}

function comparaData(prefixo: Prefixo, [vs, ve]: Faixa, [rs, re]: Faixa): boolean {
  switch (prefixo) {
    case 'eq':
      return rs >= vs && re <= ve;
    case 'ne':
      return !(rs >= vs && re <= ve);
    case 'gt':
      return re > ve;
    case 'lt':
      return rs < vs;
    case 'ge':
      return re > vs;
    case 'le':
      return rs < ve;
    case 'sa':
      return rs >= ve;
    case 'eb':
      return re <= vs;
    case 'ap':
      return rs < ve && re > vs;
  }
}

function normalizarTexto(t: string): string {
  return t
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

function dividirOu(valor: string): string[] {
  return valor.split(/(?<!\\),/).map((v) => v.replace(/\\,/g, ','));
}

export function faixaDoValor(v: unknown): Faixa | undefined {
  if (typeof v === 'number') return [v, v + 1];
  if (typeof v === 'string') return faixaDeData(v);
  return undefined;
}

export function referenciaNormalizada(
  valor: string,
  alvo: string | undefined,
  baseFhir: string,
): string {
  let v = valor;
  const base = baseFhir.replace(/\/$/, '');
  if (v.startsWith(`${base}/`)) v = v.slice(base.length + 1);
  if (!v.includes('/') && alvo) v = `${alvo}/${v}`;
  return v;
}

/** Confere se o registro atende a um valor (já separado por "ou") de um parâmetro. */
function atende(
  def: DefinicaoDeParametro,
  registro: Registro,
  valor: string,
  baseFhir: string,
): boolean {
  const extraidos = def.extrair(registro);
  switch (def.tipo) {
    case 'token': {
      const barra = valor.indexOf('|');
      const sistema = barra >= 0 ? valor.slice(0, barra) : undefined;
      const codigo = barra >= 0 ? valor.slice(barra + 1) : valor;
      return (extraidos as Token[]).some((t) => {
        if (sistema === undefined) return t.code === codigo;
        if (sistema === '') return !t.system && t.code === codigo;
        if (codigo === '') return t.system === sistema;
        return t.system === sistema && t.code === codigo;
      });
    }
    case 'string': {
      const alvo = normalizarTexto(valor);
      return (extraidos as string[]).some((s) => normalizarTexto(s).startsWith(alvo));
    }
    case 'uri':
      return (extraidos as string[]).includes(valor);
    case 'reference': {
      const ref = referenciaNormalizada(valor, def.alvo, baseFhir);
      return (extraidos as string[]).includes(ref);
    }
    case 'date': {
      const { faixa, prefixo } = analisarData(valor);
      return extraidos.some((v) => {
        const f = faixaDoValor(v);
        return f !== undefined && comparaData(prefixo, faixa, f);
      });
    }
  }
}

export interface ParametroDaBusca {
  nome: string;
  valor: string;
}

/** Filtra por todos os parâmetros: "e" entre ocorrências, "ou" entre valores com vírgula. */
export function filtrar(
  registros: Registro[],
  definicoes: Record<string, DefinicaoDeParametro>,
  parametros: ParametroDaBusca[],
  baseFhir: string,
  modoOu = new Set<string>(),
): Registro[] {
  let resultado = registros;
  const porNome = new Map<string, string[]>();
  for (const p of parametros) porNome.set(p.nome, [...(porNome.get(p.nome) ?? []), p.valor]);
  for (const [nome, valores] of porNome) {
    const def = definicoes[nome]!;
    if (modoOu.has(nome)) {
      // Só no modo de violações: ocorrências repetidas combinadas com "ou".
      resultado = resultado.filter((r) =>
        valores.some((v) => dividirOu(v).some((x) => atende(def, r, x, baseFhir))),
      );
    } else {
      for (const v of valores) {
        resultado = resultado.filter((r) => dividirOu(v).some((x) => atende(def, r, x, baseFhir)));
      }
    }
  }
  return resultado;
}

// Extratores de uso comum ----------------------------------------------------

export const codigoSimples =
  (campo: string) =>
  (r: Registro): Token[] => {
    const v = (r.recurso as Record<string, unknown>)[campo];
    return v === undefined ? [] : [{ code: String(v) }];
  };

export const codeableConcepts =
  (pegar: (r: Recurso) => unknown) =>
  (reg: Registro): Token[] => {
    const v = pegar(reg.recurso);
    const lista = Array.isArray(v) ? v : v ? [v] : [];
    return lista.flatMap((cc: { coding?: Array<{ system?: string; code?: string }> }) =>
      (cc.coding ?? [])
        .filter((c) => c.code)
        .map((c) => ({ ...(c.system ? { system: c.system } : {}), code: c.code! })),
    );
  };

export const referencias =
  (pegar: (r: Recurso) => unknown) =>
  (reg: Registro): string[] => {
    const v = pegar(reg.recurso);
    const lista = Array.isArray(v) ? v : v ? [v] : [];
    return lista
      .map((x: { reference?: string }) => x.reference)
      .filter((x): x is string => typeof x === 'string');
  };

export const ultimaAtualizacao = (reg: Registro): unknown[] => [reg.atualizadoEm];
