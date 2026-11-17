// Cliente HTTPS da suíte: mTLS com o certificado escolhido, nunca segue
// redirecionamento (seção 5.1) e guarda cada troca para as conferências
// transversais (API-001, API-010, ERR-001, ERR-004).

import type { OutgoingHttpHeaders } from 'node:http';
import https from 'node:https';
import tls from 'node:tls';

export interface CredencialTls {
  cert: Buffer;
  key: Buffer;
}

export interface OpcoesDaRequisicao {
  cabecalhos?: OutgoingHttpHeaders;
  corpo?: string | Buffer;
  /** Certificado de cliente. `null`: conexão sem certificado. */
  credencial?: CredencialTls | null;
  metodo?: string;
  /** Não guardar a troca no histórico. */
  semHistorico?: boolean;
  tls?: { minVersion?: tls.SecureVersion; maxVersion?: tls.SecureVersion; ciphers?: string };
}

export interface Resposta {
  cabecalhos: Record<string, string | string[] | undefined>;
  json: unknown;
  metodo: string;
  status: number;
  texto: string;
  url: string;
}

export interface Troca {
  cabecalhos: Record<string, string | string[] | undefined>;
  cabecalhosDaRequisicao: OutgoingHttpHeaders;
  json: unknown;
  metodo: string;
  status: number;
  texto: string;
  url: string;
}

export class ClienteHttp {
  readonly ca: string;
  readonly historico: Troca[] = [];
  constructor(ca: string) {
    this.ca = ca;
  }

  async requisitar(url: string, o: OpcoesDaRequisicao = {}): Promise<Resposta> {
    const metodo = o.metodo ?? 'GET';
    const cabecalhos: OutgoingHttpHeaders = { ...(o.cabecalhos ?? {}) };
    if (o.corpo !== undefined) cabecalhos['content-length'] = Buffer.byteLength(o.corpo);
    const resposta = await new Promise<Resposta>((resolver, rejeitar) => {
      const req = https.request(
        url,
        {
          agent: false,
          ca: this.ca,
          headers: cabecalhos,
          method: metodo,
          timeout: 20_000,
          ...(o.credencial ? { cert: o.credencial.cert, key: o.credencial.key } : {}),
          ...(o.tls ?? {}),
        },
        (res) => {
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
            resolver({
              cabecalhos: res.headers,
              json,
              metodo,
              status: res.statusCode ?? 0,
              texto,
              url,
            });
          });
          res.on('error', rejeitar);
        },
      );
      req.on('timeout', () => req.destroy(new Error(`tempo esgotado em ${metodo} ${url}`)));
      req.on('error', rejeitar);
      if (o.corpo !== undefined) req.write(o.corpo);
      req.end();
    });
    if (!o.semHistorico) {
      this.historico.push({
        cabecalhos: resposta.cabecalhos,
        cabecalhosDaRequisicao: cabecalhos,
        json: resposta.json,
        metodo,
        status: resposta.status,
        texto: resposta.texto,
        url,
      });
    }
    return resposta;
  }

  /** Tenta só o handshake TLS. Devolve a versão e a suíte negociadas, ou o erro. */
  aperto(
    url: string,
    o: {
      credencial?: CredencialTls | null;
      minVersion?: tls.SecureVersion;
      maxVersion?: tls.SecureVersion;
      ciphers?: string;
    },
  ): Promise<{ ok: true; versao: string; suite: string } | { ok: false; erro: string }> {
    const u = new URL(url);
    return new Promise((resolver) => {
      const socket = tls.connect({
        ca: this.ca,
        host: u.hostname,
        port: Number(u.port || 443),
        servername: /^[0-9.]+$/.test(u.hostname) ? undefined : u.hostname,
        ...(o.credencial ? { cert: o.credencial.cert, key: o.credencial.key } : {}),
        ...(o.minVersion ? { minVersion: o.minVersion } : {}),
        ...(o.maxVersion ? { maxVersion: o.maxVersion } : {}),
        ...(o.ciphers ? { ciphers: o.ciphers } : {}),
      });
      const fim = (
        r: { ok: true; versao: string; suite: string } | { ok: false; erro: string },
      ) => {
        socket.destroy();
        resolver(r);
      };
      socket.setTimeout(5_000, () => fim({ erro: 'tempo esgotado', ok: false }));
      socket.once('secureConnect', () =>
        fim({
          ok: true,
          suite: socket.getCipher()?.name ?? '?',
          versao: socket.getProtocol() ?? '?',
        }),
      );
      socket.once('error', (e) => fim({ erro: e.message, ok: false }));
    });
  }
}

export function cabecalhoUnico(r: Resposta, nome: string): string | undefined {
  const v = r.cabecalhos[nome.toLowerCase()];
  return Array.isArray(v) ? v[0] : v;
}
