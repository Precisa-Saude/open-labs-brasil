// Utilitários HTTP do servidor de exemplo: leitura do corpo, respostas JSON,
// OperationOutcome do capítulo 6 e formulários.

import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

export const SISTEMA_DE_ERROS = 'urn:open-labs-brasil:error-code';

export class ErroDeApi extends Error {
  readonly status: number;
  readonly codigo: string;
  readonly issueCode: string;
  readonly texto: string;
  readonly diagnostico: string | undefined;
  readonly wwwAuthenticate: string | undefined;
  readonly cabecalhos: Record<string, string>;
  readonly expressao: string[] | undefined;
  constructor(
    status: number,
    codigo: string,
    issueCode: string,
    texto: string,
    opcoes: { diagnostico?: string; wwwAuthenticate?: string; cabecalhos?: Record<string, string>; expressao?: string[] } = {},
  ) {
    super(`${codigo}: ${texto}`);
    this.status = status;
    this.codigo = codigo;
    this.issueCode = issueCode;
    this.texto = texto;
    this.diagnostico = opcoes.diagnostico;
    this.wwwAuthenticate = opcoes.wwwAuthenticate;
    this.cabecalhos = opcoes.cabecalhos ?? {};
    this.expressao = opcoes.expressao;
  }
}

/** Erro do servidor de autorização: JSON do OAuth (seção 6.2.1). */
export class ErroOAuth extends Error {
  readonly status: number;
  readonly erro: string;
  readonly descricao: string | undefined;
  constructor(status: number, erro: string, descricao?: string) {
    super(`${erro}: ${descricao ?? ''}`);
    this.status = status;
    this.erro = erro;
    this.descricao = descricao;
  }
}

export function operationOutcome(erro: ErroDeApi, severidade: 'error' | 'information' = 'error') {
  return {
    resourceType: 'OperationOutcome',
    issue: [
      {
        severity: severidade,
        code: erro.issueCode,
        details: {
          coding: [{ system: SISTEMA_DE_ERROS, code: erro.codigo }],
          text: erro.texto,
        },
        ...(erro.diagnostico ? { diagnostics: erro.diagnostico } : {}),
        ...(erro.expressao ? { expression: erro.expressao } : {}),
      },
    ],
  };
}

export async function lerCorpo(req: IncomingMessage, limite = 1_000_000): Promise<Buffer> {
  const partes: Buffer[] = [];
  let total = 0;
  for await (const parte of req) {
    const b = parte as Buffer;
    total += b.length;
    if (total > limite) throw new ErroDeApi(413, 'INVALID_REQUEST', 'invalid', 'Corpo da requisição grande demais.');
    partes.push(b);
  }
  return Buffer.concat(partes);
}

/** Lê um formulário application/x-www-form-urlencoded. Parâmetros repetidos ficam em lista. */
export function lerFormulario(corpo: Buffer): Map<string, string[]> {
  const params = new URLSearchParams(corpo.toString('utf8'));
  const mapa = new Map<string, string[]>();
  for (const [k, v] of params) {
    const lista = mapa.get(k) ?? [];
    lista.push(v);
    mapa.set(k, lista);
  }
  return mapa;
}

export function enviarJson(res: ServerResponse, status: number, corpo: unknown, cabecalhos: Record<string, string> = {}) {
  const texto = JSON.stringify(corpo);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(texto),
    ...cabecalhos,
  });
  res.end(texto);
}

export function enviarFhir(res: ServerResponse, status: number, corpo: unknown, cabecalhos: Record<string, string> = {}) {
  const texto = JSON.stringify(corpo);
  res.writeHead(status, {
    'Content-Type': 'application/fhir+json; charset=utf-8',
    'Content-Length': Buffer.byteLength(texto),
    ...cabecalhos,
  });
  res.end(texto);
}

export function enviarHtml(res: ServerResponse, status: number, html: string, cabecalhos: Record<string, string> = {}) {
  res.writeHead(status, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': Buffer.byteLength(html),
    'Cache-Control': 'no-store',
    'X-Frame-Options': 'DENY',
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'",
    ...cabecalhos,
  });
  res.end(html);
}

export function enviarVazio(res: ServerResponse, status: number, cabecalhos: Record<string, string> = {}) {
  res.writeHead(status, cabecalhos);
  res.end();
}

export function escaparHtml(texto: string): string {
  return texto
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

const PADRAO_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function eUuid(valor: string | undefined): boolean {
  return typeof valor === 'string' && PADRAO_UUID.test(valor);
}

export function novoId(): string {
  return randomUUID();
}

/** Valor único de um cabeçalho (o primeiro, se repetido). */
export function cabecalho(req: IncomingMessage, nome: string): string | undefined {
  const v = req.headers[nome.toLowerCase()];
  if (Array.isArray(v)) return v[0];
  return v;
}

/** Confere se a lista do Accept contém o tipo exigido (ignorando parâmetros e q). */
export function aceita(req: IncomingMessage, tipo: string): boolean {
  const accept = cabecalho(req, 'accept');
  if (!accept) return false;
  return accept
    .split(',')
    .map((p) => p.split(';')[0]!.trim().toLowerCase())
    .includes(tipo);
}

export function tipoDoConteudo(req: IncomingMessage): string | undefined {
  const ct = cabecalho(req, 'content-type');
  return ct?.split(';')[0]?.trim().toLowerCase();
}
