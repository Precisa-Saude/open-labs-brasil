// Hospedagem da suíte: um servidor HTTPS que faz o papel do backend dos
// receptores de teste (publica o jwks_uri de cada um) e do mantenedor do
// registro (publica participantes.json e a assinatura, que a suíte troca para
// testar a verificação do provedor). Guarda as requisições recebidas (REG-004).
// Na demonstração (`pnpm demonstracao`), também faz a página de retorno do
// aplicativo, que repassa o navegador ao backend dele.

import { readFileSync } from 'node:fs';
import https from 'node:https';

export interface RequisicaoRecebida {
  caminho: string;
  em: number;
}

export class Hospedagem {
  readonly arquivos = new Map<string, { tipo: string; conteudo: Buffer }>();
  readonly recebidas: RequisicaoRecebida[] = [];
  readonly redirecionamentos = new Map<string, string>();
  private servidor: https.Server | undefined;

  publicar(caminho: string, conteudo: Buffer | string, tipo = 'application/json'): void {
    this.arquivos.set(caminho, {
      conteudo: Buffer.isBuffer(conteudo) ? conteudo : Buffer.from(conteudo),
      tipo,
    });
  }

  /** Responde 303 para `destino`, com a consulta da requisição sem alteração. */
  redirecionar(caminho: string, destino: string): void {
    this.redirecionamentos.set(caminho, destino);
  }

  async iniciar(o: {
    endereco: string;
    porta: number;
    certificado: string;
    chave: string;
  }): Promise<void> {
    this.servidor = https.createServer(
      { cert: readFileSync(o.certificado), key: readFileSync(o.chave), minVersion: 'TLSv1.2' },
      (req, res) => {
        const url = new URL(req.url ?? '/', 'https://hospedagem');
        const caminho = url.pathname;
        this.recebidas.push({ caminho, em: Date.now() });
        const destino = this.redirecionamentos.get(caminho);
        if (req.method === 'GET' && destino) {
          res.writeHead(303, { 'Cache-Control': 'no-store', Location: `${destino}${url.search}` });
          res.end();
          return;
        }
        const arquivo = this.arquivos.get(caminho);
        if (req.method !== 'GET' || !arquivo) {
          res.writeHead(404);
          res.end();
          return;
        }
        res.writeHead(200, {
          'Cache-Control': 'no-store',
          'Content-Length': arquivo.conteudo.length,
          'Content-Type': arquivo.tipo,
        });
        res.end(arquivo.conteudo);
      },
    );
    await new Promise<void>((resolver, rejeitar) => {
      this.servidor!.once('error', rejeitar);
      this.servidor!.listen(o.porta, o.endereco, () => resolver());
    });
  }

  async fechar(): Promise<void> {
    const s = this.servidor;
    if (!s) return;
    await new Promise<void>((resolver) => {
      s.close(() => resolver());
      s.closeAllConnections();
    });
  }
}
