import { readFileSync } from 'node:fs';

import { calculateJwkThumbprint, exportJWK, generateKeyPair } from 'jose';
import { describe, expect, it } from 'vitest';

import {
  cnsValido,
  completarCnpj,
  completarCnsProvisorio,
  completarCpf,
  cpfValido,
} from './cpf.ts';
import { dentroDaBase, divergenciasDosMetadados, urlDosMetadados } from './metadados.ts';
import {
  assinarRegistro,
  chavePublicaDoRegistro,
  type DocumentoDoRegistro,
  verificarCandidato,
  versaoEfetiva,
} from './registro.ts';

describe('CPF, CNPJ e CNS', () => {
  it('confere dígitos verificadores', () => {
    expect(cpfValido('52998224725')).toBe(true);
    expect(cpfValido('52998224724')).toBe(false);
    expect(cpfValido('5299822472')).toBe(false);
    expect(cpfValido('11111111111')).toBe(false);
    expect(cpfValido('529.982.247-25')).toBe(false);
    expect(completarCpf('111444777')).toBe('11144477735');
    expect(completarCnpj('999999900001')).toBe('99999990000180');
    expect(cnsValido(completarCnsProvisorio('89800000000001'))).toBe(true);
  });
});

describe('negociação de versão (seção 9.1)', () => {
  it('MAJOR 0 exige versão idêntica', () => {
    expect(versaoEfetiva(['0.2'], ['0.2'])).toBe('0.2');
    expect(versaoEfetiva(['0.2'], ['0.3'])).toBeUndefined();
  });
  it('MAJOR 1 ou mais usa o menor entre os maiores MINOR', () => {
    expect(versaoEfetiva(['1.1'], ['1.3'])).toBe('1.1');
    expect(versaoEfetiva(['1.3', '2.0'], ['1.2'])).toBe('1.2');
    expect(versaoEfetiva(['1.3', '2.1'], ['2.4', '1.0'])).toBe('2.1');
    expect(versaoEfetiva(['1.0'], ['2.0'])).toBeUndefined();
  });
});

describe('metadados e paginação', () => {
  it('insere o well-known entre o host e o caminho do issuer', () => {
    expect(urlDosMetadados('https://auth.laboratorio.example')).toBe(
      'https://auth.laboratorio.example/.well-known/oauth-authorization-server',
    );
    expect(urlDosMetadados('https://laboratorio.example/auth')).toBe(
      'https://laboratorio.example/.well-known/oauth-authorization-server/auth',
    );
  });
  it('recusa metadados sem um valor obrigatório', () => {
    const doc = JSON.parse(
      readFileSync(new URL('../especificacao/05-api.md', import.meta.url), 'utf8')
        .split('```json')[1]!
        .split('```')[0]!,
    ) as Record<string, unknown>;
    expect(
      divergenciasDosMetadados(doc, 'https://auth.laboratorio.example', ['catalog.read']),
    ).toEqual([]);
    const { authorization_response_iss_parameter_supported: _x, ...sem } = doc;
    expect(divergenciasDosMetadados(sem, 'https://auth.laboratorio.example', [])).toHaveLength(1);
    expect(
      divergenciasDosMetadados(
        {
          ...doc,
          token_endpoint_auth_methods_supported: ['private_key_jwt', 'client_secret_basic'],
        },
        'https://auth.laboratorio.example',
        [],
      ),
    ).toHaveLength(1);
    expect(divergenciasDosMetadados(doc, 'https://outro.example', [])).toHaveLength(1);
  });
  it('confere esquema, host, porta e prefixo em fronteira de segmento', () => {
    const base = 'https://api.laboratorio.example/fhir/r4';
    expect(dentroDaBase(`${base}/Slot?x=1`, base)).toBe(true);
    expect(dentroDaBase('https://api.laboratorio.example:443/fhir/r4/Slot', base)).toBe(true);
    expect(dentroDaBase('http://api.laboratorio.example/fhir/r4/Slot', base)).toBe(false);
    expect(dentroDaBase('https://api.laboratorio.example:8443/fhir/r4/Slot', base)).toBe(false);
    expect(dentroDaBase('https://outro.example/fhir/r4/Slot', base)).toBe(false);
    expect(dentroDaBase('https://api.laboratorio.example/fhir/r4x/Slot', base)).toBe(false);
    expect(dentroDaBase('https://api.laboratorio.example/fhir/Slot', base)).toBe(false);
  });
});

describe('verificação do registro, passos V2 a V14', () => {
  const exemplo = new URL('../especificacao/registro/', import.meta.url);
  it('aceita o exemplo da especificação', async () => {
    const bytes = new Uint8Array(readFileSync(new URL('participantes.exemplo.json', exemplo)));
    const jws = readFileSync(new URL('participantes.exemplo.json.jws', exemplo), 'utf8');
    const doc = JSON.parse(Buffer.from(bytes).toString()) as DocumentoDoRegistro;
    const r = await verificarCandidato({
      bytes,
      jws,
      chavesConfiaveis: doc.registry_keys.keys,
      ambiente: 'pilot',
      agora: new Date('2026-11-20T00:00:00Z'),
    });
    expect(r.aceito).toBe(true);
  });

  it('recusa cada condição no passo certo', async () => {
    const { privateKey, publicKey } = await generateKeyPair('PS256', {
      modulusLength: 2048,
      extractable: true,
    });
    const chave = await chavePublicaDoRegistro(await exportJWK(publicKey));
    const base = JSON.parse(
      readFileSync(new URL('participantes.exemplo.json', exemplo), 'utf8'),
    ) as DocumentoDoRegistro;
    const agora = new Date('2026-11-20T00:00:00Z');
    const documento = (alterar: (d: DocumentoDoRegistro) => void = () => {}) => {
      const d = structuredClone(base);
      d.issued_at = '2026-11-19T00:00:00Z';
      d.expires_at = '2026-12-15T00:00:00Z';
      d.registry_keys.keys = [{ ...chave }];
      alterar(d);
      return new TextEncoder().encode(JSON.stringify(d));
    };
    const verificar = async (bytes: Uint8Array, jws?: string) => {
      const r = await verificarCandidato({
        bytes,
        jws: jws ?? (await assinarRegistro(bytes, privateKey, chave.kid)),
        chavesConfiaveis: [chave],
        ambiente: 'pilot',
        agora,
      });
      return r.aceito ? 'aceito' : r.passo;
    };
    expect(await verificar(documento())).toBe('aceito');
    const b = documento();
    const jws = await assinarRegistro(b, privateKey, chave.kid);
    expect(await verificar(b, jws.replace('..', '.eA.'))).toBe('V2');
    expect(
      await verificar(
        b,
        await assinarRegistro(b, privateKey, chave.kid, {
          cabecalho: { alg: 'RS256', kid: chave.kid },
        }).catch(() => 'x.y'),
      ),
    ).toMatch(/V2|V3/);
    const outra = await generateKeyPair('PS256', { modulusLength: 2048, extractable: true });
    const kidOutra = await calculateJwkThumbprint(await exportJWK(outra.publicKey));
    expect(await verificar(b, await assinarRegistro(b, outra.privateKey, kidOutra))).toBe('V4');
    expect(
      (
        await verificarCandidato({
          bytes: b,
          jws,
          chavesConfiaveis: [{ ...chave, kid: kidOutra }],
          ambiente: 'pilot',
          agora,
        })
      ).aceito,
    ).toBe(false);
    expect(await verificar(new Uint8Array([...b, 0x20]), jws)).toBe('V6');
    expect(
      await verificar(
        documento((d) => {
          delete (d as Partial<DocumentoDoRegistro>).schema_version;
        }),
      ),
    ).toBe('V7');
    expect(
      await verificar(
        documento((d) => {
          d.environment = 'production';
        }),
      ),
    ).toBe('V8');
    const atual = { documento: structuredClone(base), bytes: documento() };
    atual.documento.sequence = 9;
    const menor = await verificarCandidato({
      bytes: b,
      jws,
      chavesConfiaveis: [chave],
      ambiente: 'pilot',
      agora,
      atual,
    });
    expect(menor.aceito ? 'aceito' : menor.passo).toBe('V9');
    expect(
      await verificar(
        documento((d) => {
          d.issued_at = '2026-11-20T00:05:00Z';
        }),
      ),
    ).toBe('V10');
    expect(
      await verificar(
        documento((d) => {
          d.expires_at = '2026-12-25T00:00:00Z';
        }),
      ),
    ).toBe('V11');
    expect(
      await verificar(
        documento((d) => {
          d.expires_at = '2026-11-18T00:00:00Z';
        }),
      ),
    ).toBe('V11');
    expect(
      await verificar(
        documento((d) => {
          d.issued_at = '2026-10-01T00:00:00Z';
          d.expires_at = '2026-10-30T00:00:00Z';
        }),
      ),
    ).toBe('V12');
    expect(
      await verificar(
        documento((d) => {
          d.registry_keys.keys[0]!.kid = `${chave.kid.slice(0, -1)}${chave.kid.endsWith('A') ? 'B' : 'A'}`;
        }),
      ),
    ).toBe('V13');
    expect(
      await verificar(
        documento((d) => {
          d.participants.push(structuredClone(d.participants[0]!));
        }),
      ),
    ).toBe('V14');
    expect(
      await verificar(
        documento((d) => {
          d.participants[1]!.receiver!.client_id = '00000000-0000-4000-8000-000000000000';
        }),
      ),
    ).toBe('V14');
  });
});
