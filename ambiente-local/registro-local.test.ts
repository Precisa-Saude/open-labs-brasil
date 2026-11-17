// O registro gerado para o ambiente local passa nos catorze passos da seção
// 8.3, com V1 feito por HTTPS de verdade (certificado validado contra a AC de
// teste).

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { baixarRegistro, type ChaveDoRegistro, verificarCandidato } from '../comum/registro.ts';
import { Hospedagem } from '../suite-de-conformidade/hospedagem.ts';
import { garantirAmbiente, PASTA_DO_AMBIENTE } from '../suite-de-conformidade/local.ts';

describe('registro local', () => {
  it('passa em V1 a V14', async () => {
    await garantirAmbiente();
    const g = (p: string) => join(PASTA_DO_AMBIENTE, p);
    const h = new Hospedagem();
    h.publicar('/registro/participantes.json', readFileSync(g('registro/participantes.json')));
    h.publicar(
      '/registro/participantes.json.jws',
      readFileSync(g('registro/participantes.json.jws')),
    );
    await h.iniciar({
      endereco: '127.0.0.1',
      porta: 9443,
      certificado: g('pki/hospedagem.crt'),
      chave: g('pki/hospedagem.key'),
    });
    try {
      const ca = readFileSync(g('pki/ca.crt'), 'utf8');
      expect(
        await baixarRegistro('http://localhost:9443/registro/participantes.json', { ca }),
      ).toMatchObject({ erro: expect.stringContaining('V1') });
      expect(
        await baixarRegistro('https://localhost:9443/registro/participantes.json'),
      ).toMatchObject({ erro: expect.stringContaining('V1') });
      expect(
        await baixarRegistro('https://localhost:9443/registro/nao-existe.json', { ca }),
      ).toMatchObject({ erro: expect.stringContaining('V1') });
      const baixado = await baixarRegistro('https://localhost:9443/registro/participantes.json', {
        ca,
      });
      if ('erro' in baixado) throw new Error(baixado.erro);
      const iniciais = JSON.parse(readFileSync(g('registro/chaves-iniciais.json'), 'utf8')) as {
        keys: ChaveDoRegistro[];
      };
      const r = await verificarCandidato({
        ...baixado,
        chavesConfiaveis: iniciais.keys,
        ambiente: 'pilot',
        agora: new Date(),
      });
      expect(r.aceito).toBe(true);
      expect(['V1', ...r.passos]).toEqual([
        'V1',
        'V2',
        'V3',
        'V4',
        'V5',
        'V6',
        'V7',
        'V8',
        'V9',
        'V10',
        'V11',
        'V12',
        'V13',
        'V14',
      ]);
      console.log(`registro local: ${['V1', ...r.passos].join(' ')} aprovados`);
    } finally {
      await h.fechar();
    }
  });
});
