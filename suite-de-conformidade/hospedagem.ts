// Hospedagem da suíte: um servidor HTTPS que faz o papel do backend dos
// receptores de teste (publica o jwks_uri de cada um) e do mantenedor do
// registro (publica participantes.json e a assinatura, que a suíte troca para
// testar a verificação do provedor). Guarda as requisições recebidas (REG-004).

import { readFileSync } from 'node:fs';
import https from 'node:https';

export interface RequisicaoRecebida {
  caminho: string;
  em: number;
}

export class Hospedagem {
  readonly arquivos = new Map<string, { tipo: string; conteudo: Buffer }>();
  readonly recebidas: RequisicaoRecebida[] = [];
  private servidor: https.Server | undefined;

  publicar(caminho: string, conteudo: Buffer | string, tipo = 'application/json'): void {
    this.arquivos.set(caminho, { tipo, conteudo: Buffer.isBuffer(conteudo) ? conteudo : Buffer.from(conteudo) });
  }

  async iniciar(o: { endereco: string; porta: number; certificado: string; chave: string }): Promise<void> {
    this.servidor = https.createServer({ cert: readFileSync(o.certificado), key: readFileSync(o.chave), minVersion: 'TLSv1.2' }, (req, res) => {
      const caminho = new URL(req.url ?? '/', 'https://hospedagem').pathname;
      this.recebidas.push({ caminho, em: Date.now() });
      const arquivo = this.arquivos.get(caminho);
      if (req.method !== 'GET' || !arquivo) {
        res.writeHead(404);
        res.end();
        return;
      }
      res.writeHead(200, { 'Content-Type': arquivo.tipo, 'Content-Length': arquivo.conteudo.length, 'Cache-Control': 'no-store' });
      res.end(arquivo.conteudo);
    });
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
