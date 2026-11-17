// Duas recargas do registro ao mesmo tempo (a periódica e a pedida pela
// interface de controle) não podem deixar em vigor um documento mais antigo
// que o último aceito.

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { importJWK } from 'jose';
import { afterAll, describe, expect, it, vi } from 'vitest';

import { assinarRegistro, type DocumentoDoRegistro } from '../comum/registro.ts';
import { garantirAmbiente, PASTA_DO_AMBIENTE } from '../suite-de-conformidade/local.ts';
import { lerConfiguracao, Relogio } from './configuracao.ts';
import { RegistroDoProvedor } from './registro-do-provedor.ts';

const atrasos = new Map<number, number>();

vi.mock('../comum/registro.ts', async (importOriginal) => {
  const original = await importOriginal<typeof import('../comum/registro.ts')>();
  return {
    ...original,
    verificarCandidato: async (o: Parameters<typeof original.verificarCandidato>[0]) => {
      const r = await original.verificarCandidato(o);
      const sequencia = r.aceito ? r.documento.sequence : undefined;
      const atraso = sequencia === undefined ? 0 : (atrasos.get(sequencia) ?? 0);
      if (atraso) await new Promise((fim) => setTimeout(fim, atraso));
      return r;
    },
  };
});

const pasta = mkdtempSync(join(tmpdir(), 'olb-registro-'));
afterAll(() => rmSync(pasta, { recursive: true, force: true }));

async function publicar(
  base: DocumentoDoRegistro,
  sequencia: number,
  arquivo: string,
  assinatura: string,
): Promise<void> {
  const documento = {
    ...base,
    sequence: sequencia,
    issued_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
  };
  const bytes = new TextEncoder().encode(`${JSON.stringify(documento, null, 2)}\n`);
  const privada = JSON.parse(
    readFileSync(join(PASTA_DO_AMBIENTE, 'chaves', 'registro.privada.jwk.json'), 'utf8'),
  );
  const jws = await assinarRegistro(
    bytes,
    await importJWK(privada, 'PS256'),
    base.registry_keys.keys[0]!.kid,
  );
  writeFileSync(arquivo, bytes);
  writeFileSync(assinatura, `${jws}\n`);
}

describe('recarga do registro', () => {
  it('recargas concorrentes não voltam a uma sequence menor', async () => {
    await garantirAmbiente();
    const cfg = lerConfiguracao(join(PASTA_DO_AMBIENTE, 'servidor.config.json'), {
      registrarEmLog: false,
    });
    const arquivo = join(pasta, 'participantes.json');
    const assinatura = join(pasta, 'participantes.json.jws');
    const base = JSON.parse(readFileSync(cfg.registro.arquivo, 'utf8')) as DocumentoDoRegistro;
    await publicar(base, 1, arquivo, assinatura);
    const { url: _url, ...semUrl } = cfg.registro;
    const registro = await RegistroDoProvedor.carregar(
      { ...cfg, registro: { ...semUrl, arquivo, assinatura } },
      new Relogio(),
    );
    expect(registro.documento.sequence).toBe(1);

    // A primeira recarga lê a sequence 2 e demora na verificação. Enquanto isso
    // o mantenedor publica a 3, e a segunda recarga a lê.
    atrasos.set(2, 300);
    await publicar(base, 2, arquivo, assinatura);
    const primeira = registro.recarregar();
    await publicar(base, 3, arquivo, assinatura);
    const segunda = registro.recarregar();
    await Promise.all([primeira, segunda]);

    expect(registro.documento.sequence).toBe(3);
  });
});
