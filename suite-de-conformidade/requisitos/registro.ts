// REG: registro de participantes, do lado do provedor (seção 9.3).
//
// A suíte publica candidatos na hospedagem (o endereço de onde o provedor busca
// o registro de teste) e pede ao provedor que busque de novo. Cada candidato
// suspende o cliente sentinela: se o provedor aceitou o candidato, o sentinela
// deixa de obter tokens. Assim a suíte observa a aceitação por comportamento,
// sem depender do que o provedor diz de si. Um candidato válido de controle
// prova que o provedor de fato aceita documentos novos.

import { base64url, CompactSign, generateKeyPair, importJWK, calculateJwkThumbprint, exportJWK, type CryptoKey, type JWK, type KeyObject } from 'jose';
import { versaoEfetiva, type DocumentoDoRegistro } from '../../comum/registro.ts';
import type { Contexto } from '../contexto.ts';
import { esperar, falhar, naoVerificavel, type Relator } from '../resultado.ts';
import { erroApi, erroOAuth, resumo } from '../verificacoes.ts';
import type { Teste } from './tipos.ts';

interface ChaveDoRegistro {
  chave: CryptoKey | KeyObject;
  jwk: JWK;
  kid: string;
}

async function chaveDoRegistro(ctx: Contexto): Promise<ChaveDoRegistro> {
  const caminho = ctx.cfg.registro.chave_privada_para_candidatos;
  if (!caminho) naoVerificavel('a configuração não traz a chave privada do registro de teste (registro.chave_privada_para_candidatos)');
  const jwk = ctx.lerJsonDaConfiguracao(caminho) as JWK;
  return { jwk, chave: (await importJWK(jwk, 'PS256')) as CryptoKey | KeyObject, kid: jwk.kid ?? (await calculateJwkThumbprint(jwk)) };
}

function exigirPublicacao(ctx: Contexto): string {
  const caminho = ctx.cfg.registro.caminho_de_publicacao;
  if (!ctx.hospedagem || !caminho) naoVerificavel('a configuração não publica o registro de teste pela hospedagem da suíte (hospedagem e registro.caminho_de_publicacao)');
  ctx.exigirControle('pedir ao provedor que busque o registro de novo');
  return caminho;
}

function instante(ms: number): string {
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function bytesDe(doc: DocumentoDoRegistro): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(doc, null, 2)}\n`);
}

/** Cópia do documento original da configuração, com sequence e datas novas, e a alteração pedida. */
function candidato(ctx: Contexto, alterar: (d: DocumentoDoRegistro) => void = () => {}, sequencia = ctx.registroAceito.documento.sequence + 1): DocumentoDoRegistro {
  const d = structuredClone(ctx.documento);
  const emissao = ctx.agoraMs() - 5000;
  d.sequence = sequencia;
  d.issued_at = instante(emissao);
  d.expires_at = instante(emissao + 29 * 24 * 3600_000);
  alterar(d);
  return d;
}

function sentinela(ctx: Contexto, d: DocumentoDoRegistro) {
  const id = ctx.cliente('sentinela').clientId;
  return d.participants.find((p) => p.participant_id === id)!;
}

function suspenderSentinela(ctx: Contexto) {
  return (d: DocumentoDoRegistro) => {
    sentinela(ctx, d).status = 'suspended';
  };
}

async function assinar(bytes: Uint8Array, chave: CryptoKey | KeyObject, cabecalho: Record<string, unknown>): Promise<string> {
  const compacto = await new CompactSign(bytes).setProtectedHeader(cabecalho as { alg: string }).sign(chave);
  const [h, , s] = compacto.split('.');
  return `${h}..${s}`;
}

async function publicarERecarregar(ctx: Contexto, bytes: Uint8Array, jws: string): Promise<Record<string, unknown>> {
  const caminho = exigirPublicacao(ctx);
  ctx.hospedagem!.publicar(caminho, Buffer.from(bytes));
  ctx.hospedagem!.publicar(`${caminho}.jws`, jws);
  const r = await ctx.controle('POST', '/_controle/registro/recarregar');
  if (r.status !== 200) falhar(`a interface de controle não recarregou o registro: ${r.status}`);
  return r.json;
}

async function sentinelaAtendido(ctx: Contexto): Promise<boolean> {
  const resp = await ctx.tokenCc(ctx.cliente('sentinela'), ['catalog.read']);
  if (resp.status === 200) return true;
  erroOAuth(resp, 401, 'invalid_client');
  return false;
}

/** Publica um documento válido e o registra como aceito, se o provedor o aceitar. */
async function publicarValido(ctx: Contexto, chave: ChaveDoRegistro, doc: DocumentoDoRegistro): Promise<void> {
  const bytes = bytesDe(doc);
  const jws = await assinar(bytes, chave.chave, { alg: 'PS256', kid: chave.kid, typ: 'JOSE' });
  await publicarERecarregar(ctx, bytes, jws);
  ctx.registroAceito = { documento: doc, bytes, jws };
}

/** Volta a publicar o documento aceito, para que buscas periódicas não peguem um candidato inválido. */
async function republicarAceito(ctx: Contexto): Promise<void> {
  const caminho = ctx.cfg.registro.caminho_de_publicacao;
  if (!ctx.hospedagem || !caminho) return;
  ctx.hospedagem.publicar(caminho, Buffer.from(ctx.registroAceito.bytes));
  ctx.hospedagem.publicar(`${caminho}.jws`, ctx.registroAceito.jws);
}

/**
 * Controle positivo: um candidato válido que suspende o sentinela precisa ser
 * aceito (o sentinela passa a ser recusado). Depois, outro válido o reativa.
 */
async function controlePositivo(ctx: Contexto, chave: ChaveDoRegistro, r: Relator): Promise<void> {
  esperar(await sentinelaAtendido(ctx), 'o cliente sentinela não obtém token com o registro atual');
  await publicarValido(ctx, chave, candidato(ctx, suspenderSentinela(ctx)));
  esperar(!(await sentinelaAtendido(ctx)), 'o provedor não aplicou um registro válido que suspende o sentinela');
  await publicarValido(ctx, chave, candidato(ctx));
  esperar(await sentinelaAtendido(ctx), 'o provedor não aplicou o registro válido que reativa o sentinela');
  r.evidencia(`controle positivo: sequences ${ctx.registroAceito.documento.sequence - 1} e ${ctx.registroAceito.documento.sequence} aceitas`);
}

/** Publica um candidato que deve ser recusado e confere que o sentinela continua atendido. */
async function deveRecusar(ctx: Contexto, r: Relator, nome: string, bytes: Uint8Array, jws: string): Promise<void> {
  const resposta = await publicarERecarregar(ctx, bytes, jws);
  const atendido = await sentinelaAtendido(ctx);
  await republicarAceito(ctx);
  if (!atendido) {
    // O provedor aceitou o candidato: publica um válido com sequence maior para desfazer o efeito.
    let sequencia = ctx.registroAceito.documento.sequence;
    try {
      sequencia = Math.max(sequencia, (JSON.parse(new TextDecoder().decode(bytes)) as DocumentoDoRegistro).sequence);
    } catch {
      // bytes ilegíveis: mantém a sequence aceita
    }
    const chave = await chaveDoRegistro(ctx);
    await publicarValido(ctx, chave, candidato(ctx, () => {}, sequencia + 1));
    falhar(`candidato aceito: ${nome}`);
  }
  r.evidencia(`${nome}: recusado${typeof resposta.passo === 'string' ? ` (o provedor informou ${resposta.passo})` : ''}`);
}

async function candidatoAssinado(ctx: Contexto, chave: ChaveDoRegistro, alterar: (d: DocumentoDoRegistro) => void, sequencia?: number): Promise<{ bytes: Uint8Array; jws: string }> {
  const doc = candidato(ctx, (d) => {
    suspenderSentinela(ctx)(d);
    alterar(d);
  }, sequencia);
  const bytes = bytesDe(doc);
  return { bytes, jws: await assinar(bytes, chave.chave, { alg: 'PS256', kid: chave.kid, typ: 'JOSE' }) };
}

export const testesDeRegistro: Teste[] = [
  {
    id: 'REG-001',
    titulo: 'Recusa registro cuja assinatura não verifica',
    fase: 'registro',
    executar: async (ctx, r) => {
      const chave = await chaveDoRegistro(ctx);
      await controlePositivo(ctx, chave, r);
      const { bytes, jws } = await candidatoAssinado(ctx, chave, () => {});
      const [h, , s] = jws.split('.');
      const adulterada = `${h}..${s!.slice(0, 10)}${s![10] === 'A' ? 'B' : 'A'}${s!.slice(11)}`;
      await deveRecusar(ctx, r, 'assinatura adulterada', bytes, adulterada);
      await deveRecusar(ctx, r, 'bytes alterados depois da assinatura', new Uint8Array([...bytes, 0x20]), jws);
    },
  },
  {
    id: 'REG-002',
    titulo: 'Recusa registro com sequence menor que a do documento atual',
    fase: 'registro',
    executar: async (ctx, r) => {
      const chave = await chaveDoRegistro(ctx);
      await controlePositivo(ctx, chave, r);
      const atual = ctx.registroAceito.documento.sequence;
      const antigo = await candidatoAssinado(ctx, chave, () => {}, atual - 1);
      await deveRecusar(ctx, r, `sequence ${atual - 1}, menor que a atual ${atual}`, antigo.bytes, antigo.jws);
      const igual = await candidatoAssinado(ctx, chave, () => {}, atual);
      await deveRecusar(ctx, r, `sequence ${atual} igual à atual com bytes diferentes`, igual.bytes, igual.jws);
    },
  },
  {
    id: 'REG-003',
    titulo: 'Recusa registro que não valida contra o schema',
    fase: 'registro',
    executar: async (ctx, r) => {
      const chave = await chaveDoRegistro(ctx);
      await controlePositivo(ctx, chave, r);
      const semCampo = await candidatoAssinado(ctx, chave, (d) => {
        delete (d as Partial<DocumentoDoRegistro>).schema_version;
      });
      await deveRecusar(ctx, r, 'sem schema_version', semCampo.bytes, semCampo.jws);
      const operadora = await candidatoAssinado(ctx, chave, (d) => {
        (sentinela(ctx, d).receiver!.eligibility as { health_plan_operator: boolean }).health_plan_operator = true;
      });
      await deveRecusar(ctx, r, 'receptor com health_plan_operator true', operadora.bytes, operadora.jws);
    },
  },
  {
    id: 'REG-004',
    titulo: 'Busca o registro ao menos a cada 60 minutos',
    fase: 'relogio',
    executar: async (ctx, r) => {
      const caminho = exigirPublicacao(ctx);
      const contar = () => ctx.hospedagem!.recebidas.filter((x) => x.caminho === caminho).length;
      const antes = contar();
      await ctx.avancarRelogio(61 * 60);
      const limite = Date.now() + 15_000;
      while (contar() === antes && Date.now() < limite) await new Promise((res) => setTimeout(res, 250));
      if (contar() === antes) {
        naoVerificavel('nenhuma busca do registro em 15 segundos depois de adiantar o relógio em 61 minutos; se o provedor agenda a busca pelo relógio real, a conferência pede 2 horas de observação');
      }
      r.evidencia(`relógio adiantado 61 minutos: ${contar() - antes} busca(s) a ${caminho}`);
    },
  },
  {
    id: 'REG-005',
    titulo: 'Aplica mudança de status em até 60 minutos',
    fase: 'registro',
    executar: async (ctx, r) => {
      const chave = await chaveDoRegistro(ctx);
      esperar(await sentinelaAtendido(ctx), 'o sentinela não obtém token com o registro atual');
      await publicarValido(ctx, chave, candidato(ctx, suspenderSentinela(ctx)));
      esperar(!(await sentinelaAtendido(ctx)), 'o provedor continua atendendo o sentinela suspenso depois de buscar o registro');
      r.evidencia('sentinela suspended: recusado logo depois da busca');
      await publicarValido(ctx, chave, candidato(ctx));
      esperar(await sentinelaAtendido(ctx), 'o sentinela reativado continua recusado');
      r.evidencia('sentinela active de novo: atendido');
    },
  },
  {
    id: 'REG-007',
    titulo: 'Aplica os catorze passos de verificação e recusa o candidato que falha em qualquer um',
    fase: 'registro',
    executar: async (ctx, r) => {
      const chave = await chaveDoRegistro(ctx);
      await controlePositivo(ctx, chave, r);
      const cab = { alg: 'PS256', kid: chave.kid, typ: 'JOSE' };

      // V2: assinatura com conteúdo anexado.
      {
        const { bytes } = await candidatoAssinado(ctx, chave, () => {});
        const anexado = await new CompactSign(bytes).setProtectedHeader(cab).sign(chave.chave);
        await deveRecusar(ctx, r, 'V2 conteúdo anexado no .jws', bytes, anexado);
      }
      // V3: algoritmo diferente de PS256.
      {
        const { bytes } = await candidatoAssinado(ctx, chave, () => {});
        const rs = (await importJWK(chave.jwk, 'RS256')) as CryptoKey | KeyObject;
        await deveRecusar(ctx, r, 'V3 alg RS256', bytes, await assinar(bytes, rs, { ...cab, alg: 'RS256' }));
        const none = `${base64url.encode(JSON.stringify({ alg: 'none', kid: chave.kid }))}..${base64url.encode('x')}`;
        await deveRecusar(ctx, r, 'V3 alg none', bytes, none);
      }
      // V4: chave fora das registry_keys do documento atual.
      {
        const { bytes } = await candidatoAssinado(ctx, chave, () => {});
        const outra = await generateKeyPair('PS256', { modulusLength: 2048, extractable: true });
        const kid = await calculateJwkThumbprint(await exportJWK(outra.publicKey));
        await deveRecusar(ctx, r, 'V4 chave desconhecida', bytes, await assinar(bytes, outra.privateKey, { ...cab, kid }));
      }
      const casos: Array<[string, (d: DocumentoDoRegistro) => void]> = [
        ['V8 ambiente production', (d) => { d.environment = 'production'; }],
        ['V10 issued_at duas horas no futuro', (d) => {
          const e = ctx.agoraMs() + 2 * 3600_000;
          d.issued_at = instante(e);
          d.expires_at = instante(e + 10 * 24 * 3600_000);
        }],
        ['V11 validade de 31 dias', (d) => { d.expires_at = instante(Date.parse(d.issued_at) + 31 * 24 * 3600_000); }],
        ['V11 validade invertida', (d) => { d.expires_at = instante(Date.parse(d.issued_at) - 3600_000); }],
        ['V12 documento expirado', (d) => {
          const e = ctx.agoraMs() - 31 * 24 * 3600_000;
          d.issued_at = instante(e);
          d.expires_at = instante(e + 29 * 24 * 3600_000);
        }],
        ['V13 kid de registry_keys diferente do thumbprint', (d) => {
          const k = d.registry_keys.keys[0]!;
          k.kid = `${k.kid.slice(0, -1)}${k.kid.endsWith('A') ? 'B' : 'A'}`;
        }],
        ['V14 participant_id repetido', (d) => { d.participants.push(structuredClone(sentinela(ctx, d))); }],
        ['V14 client_id diferente do participant_id', (d) => { sentinela(ctx, d).receiver!.client_id = '00000000-0000-4000-8000-000000000000'; }],
      ];
      for (const [nome, alterar] of casos) {
        const c = await candidatoAssinado(ctx, chave, alterar);
        await deveRecusar(ctx, r, nome, c.bytes, c.jws);
      }
      r.evidencia('V5 não é testável por fora: exigiria uma chave com kid errado no documento já aceito');
    },
  },
  {
    id: 'REG-008',
    titulo: 'Modo restrito por 7 dias depois de expires_at, e recusa total depois',
    fase: 'relogio',
    executar: async (ctx, r) => {
      const c = ctx.cliente('principal');
      exigirPublicacao(ctx);
      const chave = await chaveDoRegistro(ctx);
      const autorizado = await ctx.autorizar(c);
      const aguardando = await ctx.novoConsentimento(c);
      await ctx.sincronizarRelogio();
      const expira = Date.parse(ctx.registroDoProvedorExpiraEm ?? ctx.registroAceito.documento.expires_at);
      await ctx.avancarRelogio(Math.ceil((expira - ctx.agoraMs()) / 1000) + 3600);
      r.evidencia('relógio do provedor 1 hora depois de expires_at');
      // O consentimento à espera também venceu (60 minutos), então invalid_request é uma recusa aceitável aqui.
      erroOAuth((await ctx.par(c, aguardando)).resposta, 400, ['unauthorized_client', 'invalid_request']);
      erroOAuth(await ctx.tokenCc(c, ['catalog.read']), 400, 'unauthorized_client');
      const token = await ctx.tokenDeProvedor(c, 'consent.manage');
      const lido = await ctx.consentimentos('GET', `/${autorizado.consentId}`, token);
      esperar(lido.status === 200, `GET de consentimento no modo restrito: ${resumo(lido)}`);
      const del = await ctx.consentimentos('DELETE', `/${autorizado.consentId}?reason=PATIENT_REQUEST`, token);
      esperar(del.status === 204, `DELETE no modo restrito: ${resumo(del)}`);
      erroApi(await ctx.consentimentos('POST', '', token, { corpo: ctx.corpoDeConsentimento() }), 403, 'REGISTRY_EXPIRED');
      r.evidencia('dia 1: PAR e catalog.read unauthorized_client; consent.manage aceito; GET 200; DELETE 204; POST /consents 403 REGISTRY_EXPIRED');
      await ctx.avancarRelogio(7 * 24 * 3600);
      erroOAuth(await ctx.tokenCc(c, ['consent.manage']), 400, 'unauthorized_client');
      r.evidencia('dia 8: consent.manage unauthorized_client');
      await publicarValido(ctx, chave, candidato(ctx));
      const normal = await ctx.tokenCc(c, ['catalog.read']);
      esperar(normal.status === 200, `com registro novo o provedor não voltou ao normal: ${resumo(normal)}`);
      r.evidencia('registro novo aceito: operação normal restabelecida');
    },
  },
  {
    id: 'REG-009',
    titulo: 'Calcula a versão efetiva e não se comunica sem ela',
    fase: 'registro',
    executar: async (ctx, r) => {
      const chave = await chaveDoRegistro(ctx);
      esperar(versaoEfetiva(['0.2'], ['0.3']) === undefined && versaoEfetiva(['1.1'], ['1.3']) === '1.1', 'cálculo de referência da suíte');
      await publicarValido(ctx, chave, candidato(ctx, (d) => { sentinela(ctx, d).protocol_versions = ['0.3']; }));
      esperar(!(await sentinelaAtendido(ctx)), 'o provedor 0.2 atende receptor que declara só 0.3');
      r.evidencia('sentinela com 0.3: recusado com invalid_client');
      await publicarValido(ctx, chave, candidato(ctx));
      esperar(await sentinelaAtendido(ctx), 'o sentinela de volta a 0.2 continua recusado');
      r.evidencia('sentinela de volta a 0.2: atendido; o caso 1.1 com 1.3 não se aplica a provedor 0.x');
    },
  },
  {
    id: 'REG-010',
    titulo: 'Enquanto o MAJOR for 0, lista exatamente uma versão em protocol_versions',
    executar: async (ctx, r) => {
      const versoes = ctx.provedor.protocol_versions;
      if (versoes.some((v) => v.startsWith('0.'))) esperar(versoes.length === 1, `protocol_versions com ${versoes.length} versões: ${versoes.join(', ')}`);
      r.evidencia(`protocol_versions do provedor: ${versoes.join(', ')}`);
    },
  },
];
