// Gera o ambiente local de teste:
//
// - PKI de teste com o openssl do sistema: uma autoridade certificadora,
//   certificados de servidor e certificados de cliente TLS dos receptores de
//   teste (um deles fora do registro, de propósito);
// - chaves de assinatura PS256 dos receptores e do registro (jose);
// - registro de participantes "pilot" assinado conforme a seção 8.3;
// - configuração do servidor de exemplo e da suíte de conformidade.
//
//   node ambiente-local/gerar.ts [--saida ambiente-local/gerado] [--forcar] [--se-faltar]
//     [--host localhost] [--host-hospedagem localhost] [--nome-extra outro.host ...]
//     [--porta-publica 8443] [--porta-mtls 8444] [--porta-controle 8445] [--porta-hospedagem 9443]
//     [--endereco-de-escuta 127.0.0.1]
//
// Tudo o que sai daqui é só para teste local. Nenhuma chave gerada aqui deve
// ser usada em outro lugar.

import { execFileSync } from 'node:child_process';
import { randomBytes, randomUUID, X509Certificate } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { calculateJwkThumbprint, exportJWK, generateKeyPair, importJWK, type JWK } from 'jose';

import { completarCnpj } from '../comum/cpf.ts';
import {
  assinarRegistro,
  chavePublicaDoRegistro,
  type DocumentoDoRegistro,
  type Participante,
  verificarCandidato,
  x5tS256,
} from '../comum/registro.ts';
import {
  FIXTURAS,
  PACIENTES,
  SENHA_DE_TESTE,
  SISTEMA_PRODUTOS,
} from '../servidor-de-exemplo/dados.ts';

const TODOS_OS_ESCOPOS = [
  'catalog.read',
  'locations.read',
  'schedule.read',
  'consent.manage',
  'appointment.write',
  'results.read',
  'consent.read',
] as const;

export interface OpcoesDoAmbiente {
  /** Endereço em que o servidor, o controle e a hospedagem escutam. 0.0.0.0 para uso em contêiner. */
  enderecoDeEscuta: string;
  host: string;
  hostHospedagem: string;
  /** Nome do aplicativo de demonstração no registro, mostrado na tela de consentimento. */
  nomeDaDemonstracao: string;
  nomesExtras: string[];
  portaControle: number;
  portaHospedagem: number;
  portaMtls: number;
  portaPublica: number;
  saida: string;
}

function instante(d: Date): string {
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function openssl(args: string[]): void {
  execFileSync('openssl', args, { stdio: ['ignore', 'ignore', 'pipe'] });
}

function nomesAlternativos(nomes: string[]): string {
  return [...new Set(nomes)]
    .map((n) => (/^[0-9.]+$/.test(n) || n.includes(':') ? `IP:${n}` : `DNS:${n}`))
    .join(',');
}

/** Emite um certificado assinado pela AC de teste. */
function emitir(pki: string, nome: string, assunto: string, extensoes: string[]): X509Certificate {
  const chave = join(pki, `${nome}.key`);
  const pedido = join(pki, `${nome}.csr`);
  const ext = join(pki, `${nome}.ext`);
  openssl(['genpkey', '-algorithm', 'RSA', '-pkeyopt', 'rsa_keygen_bits:2048', '-out', chave]);
  openssl(['req', '-new', '-key', chave, '-subj', assunto, '-out', pedido]);
  writeFileSync(ext, `${extensoes.join('\n')}\n`);
  openssl([
    'x509',
    '-req',
    '-in',
    pedido,
    '-CA',
    join(pki, 'ca.crt'),
    '-CAkey',
    join(pki, 'ca.key'),
    '-set_serial',
    `0x${randomBytes(12).toString('hex')}`,
    '-days',
    '365',
    '-sha256',
    '-extfile',
    ext,
    '-out',
    join(pki, `${nome}.crt`),
  ]);
  rmSync(pedido);
  rmSync(ext);
  return new X509Certificate(readFileSync(join(pki, `${nome}.crt`)));
}

function gerarAutoridade(pki: string): void {
  const chave = join(pki, 'ca.key');
  const pedido = join(pki, 'ca.csr');
  const ext = join(pki, 'ca.ext');
  openssl(['genpkey', '-algorithm', 'RSA', '-pkeyopt', 'rsa_keygen_bits:2048', '-out', chave]);
  openssl([
    'req',
    '-new',
    '-key',
    chave,
    '-subj',
    '/O=Open Labs Brasil, teste local/CN=AC de teste local (nao confiar fora deste ambiente)',
    '-out',
    pedido,
  ]);
  writeFileSync(
    ext,
    'basicConstraints=critical,CA:TRUE\nkeyUsage=critical,keyCertSign,cRLSign\nsubjectKeyIdentifier=hash\n',
  );
  openssl([
    'x509',
    '-req',
    '-in',
    pedido,
    '-signkey',
    chave,
    '-days',
    '730',
    '-sha256',
    '-extfile',
    ext,
    '-out',
    join(pki, 'ca.crt'),
  ]);
  rmSync(pedido);
  rmSync(ext);
}

async function chaveDeAssinatura(): Promise<{ privada: JWK; publica: JWK }> {
  const { privateKey, publicKey } = await generateKeyPair('PS256', {
    extractable: true,
    modulusLength: 2048,
  });
  const publica = await exportJWK(publicKey);
  const kid = await calculateJwkThumbprint(publica);
  return {
    privada: { ...(await exportJWK(privateKey)), alg: 'PS256', kid, use: 'sig' },
    publica: { ...publica, alg: 'PS256', kid, use: 'sig' },
  };
}

interface DefinicaoDeReceptor {
  certificados: number;
  letra: string;
  nome: string;
  papel: 'principal' | 'secundario' | 'sentinela' | 'suspenso' | 'retirado' | 'demonstracao';
  situacao: Participante['status'];
}

/** Nome padrão do aplicativo de demonstração (`pnpm demonstracao`). */
export const NOME_PADRAO_DA_DEMONSTRACAO = 'Aplicativo de demonstração';

/** Caminho, na hospedagem, para onde o laboratório devolve o paciente do aplicativo de demonstração. */
export const CAMINHO_DE_RETORNO_DA_DEMONSTRACAO = '/demonstracao/retorno';

const RECEPTORES: DefinicaoDeReceptor[] = [
  {
    certificados: 2,
    letra: 'a',
    nome: 'Aplicativo de Teste A',
    papel: 'principal',
    situacao: 'active',
  },
  {
    certificados: 1,
    letra: 'b',
    nome: 'Aplicativo de Teste B',
    papel: 'secundario',
    situacao: 'active',
  },
  {
    certificados: 1,
    letra: 'c',
    nome: 'Aplicativo Sentinela C',
    papel: 'sentinela',
    situacao: 'active',
  },
  {
    certificados: 1,
    letra: 'd',
    nome: 'Aplicativo Suspenso D',
    papel: 'suspenso',
    situacao: 'suspended',
  },
  {
    certificados: 1,
    letra: 'e',
    nome: 'Aplicativo Retirado E',
    papel: 'retirado',
    situacao: 'withdrawn',
  },
  {
    // Fora da suíte: é o receptor que um aplicativo de verdade usa com `pnpm demonstracao`.
    certificados: 1,
    letra: 'f',
    nome: NOME_PADRAO_DA_DEMONSTRACAO,
    papel: 'demonstracao',
    situacao: 'active',
  },
];

/**
 * O que um aplicativo de verdade precisa para usar o receptor de demonstração
 * (`pnpm demonstracao`). Caminhos absolutos, para o aplicativo ler de outro repositório.
 */
function escreverConfiguracaoDaDemonstracao(o: {
  chaves: string;
  demonstracao: { clientId: string; nome: string; redirectUri: string };
  dir: string;
  hospedagem: string;
  idDoProvedor: string;
  pki: string;
  registroDir: string;
}): void {
  writeFileSync(
    join(o.dir, 'demonstracao.json'),
    JSON.stringify(
      {
        ambiente: 'pilot',
        ca_confiavel: join(o.pki, 'ca.crt'),
        cliente: {
          certificado: join(o.pki, 'receptor-f-1.crt'),
          chave_de_assinatura: join(o.chaves, 'receptor-f.privada.jwk.json'),
          chave_do_certificado: join(o.pki, 'receptor-f-1.key'),
          client_id: o.demonstracao.clientId,
          nome: o.demonstracao.nome,
          redirect_uri: o.demonstracao.redirectUri,
        },
        pacientes: PACIENTES.filter((p) => p.usuario === 'ana' || p.usuario === 'bruno').map(
          (p) => ({
            cpf: p.cpf,
            senha: SENHA_DE_TESTE,
            usuario: p.usuario,
          }),
        ),
        provedor: { participant_id: o.idDoProvedor },
        registro: {
          assinatura: `${o.hospedagem}/registro/participantes.json.jws`,
          chaves_iniciais: join(o.registroDir, 'chaves-iniciais.json'),
          documento: `${o.hospedagem}/registro/participantes.json`,
        },
      },
      null,
      2,
    ),
  );
}

export async function gerarAmbiente(o: OpcoesDoAmbiente): Promise<void> {
  const dir = resolve(o.saida);
  const pki = join(dir, 'pki');
  const chaves = join(dir, 'chaves');
  const registroDir = join(dir, 'registro');
  for (const d of [pki, chaves, registroDir]) mkdirSync(d, { recursive: true });

  const agora = new Date(Math.floor(Date.now() / 1000) * 1000);
  const hospedagem = `https://${o.hostHospedagem}:${o.portaHospedagem}`;
  const issuer = `https://${o.host}:${o.portaPublica}`;
  const mtls = `https://${o.host}:${o.portaMtls}`;

  console.log('PKI de teste (openssl)');
  gerarAutoridade(pki);
  const nomesDoServidor = nomesAlternativos([
    'localhost',
    '127.0.0.1',
    '::1',
    o.host,
    ...o.nomesExtras,
  ]);
  emitir(pki, 'servidor', `/O=Laboratorio Exemplo (simulado)/CN=${o.host}`, [
    'basicConstraints=CA:FALSE',
    'keyUsage=critical,digitalSignature,keyEncipherment',
    'extendedKeyUsage=serverAuth',
    `subjectAltName=${nomesDoServidor}`,
  ]);
  emitir(pki, 'hospedagem', `/O=Receptores de teste/CN=${o.hostHospedagem}`, [
    'basicConstraints=CA:FALSE',
    'keyUsage=critical,digitalSignature,keyEncipherment',
    'extendedKeyUsage=serverAuth',
    `subjectAltName=${nomesAlternativos(['localhost', '127.0.0.1', '::1', o.hostHospedagem, ...o.nomesExtras])}`,
  ]);
  const cliente = (nome: string, cn: string) =>
    emitir(pki, nome, `/O=Receptor de teste/CN=${cn}`, [
      'basicConstraints=CA:FALSE',
      'keyUsage=critical,digitalSignature',
      'extendedKeyUsage=clientAuth',
    ]);
  emitir(pki, 'nao-registrado', '/O=Fora do registro/CN=cliente-nao-registrado', [
    'basicConstraints=CA:FALSE',
    'keyUsage=critical,digitalSignature',
    'extendedKeyUsage=clientAuth',
  ]);

  console.log('Chaves de assinatura (jose, PS256)');
  const chaveDoRegistro = await chaveDeAssinatura();
  writeFileSync(
    join(chaves, 'registro.privada.jwk.json'),
    JSON.stringify(chaveDoRegistro.privada, null, 2),
  );

  const participantes: Participante[] = [];
  const idDoProvedor = randomUUID();
  participantes.push({
    cnpj: completarCnpj('999999920001'),
    contacts: {
      security_email: 'seguranca@laboratorio.example',
      technical_email: 'integracao@laboratorio.example',
    },
    display_name: 'Laboratório Exemplo (simulado)',
    legal_name: 'Laboratório Exemplo Local Ltda. (fictício)',
    participant_id: idDoProvedor,
    protocol_versions: ['0.2'],
    provider: {
      api_base_url: `${mtls}/acesso/v0`,
      consent_management_uri: `${issuer}/minha-conta/compartilhamentos`,
      fhir_base_url: `${mtls}/fhir/r4`,
      issuer,
      scopes_supported: [...TODOS_OS_ESCOPOS],
    },
    role: 'provider',
    status: 'active',
    updated_at: instante(agora),
  });

  const clientes: Record<string, unknown> = {};
  let demonstracao: { clientId: string; nome: string; redirectUri: string } | undefined;
  for (const [i, r] of RECEPTORES.entries()) {
    const id = randomUUID();
    const eDemonstracao = r.papel === 'demonstracao';
    const nome = eDemonstracao ? o.nomeDaDemonstracao : r.nome;
    const base = `${hospedagem}/receptores/${r.letra}`;
    const retorno = eDemonstracao
      ? `${hospedagem}${CAMINHO_DE_RETORNO_DA_DEMONSTRACAO}`
      : `${base}/retorno`;
    const assinatura = await chaveDeAssinatura();
    const caminhoDaChave = join(chaves, `receptor-${r.letra}.privada.jwk.json`);
    writeFileSync(caminhoDaChave, JSON.stringify(assinatura.privada, null, 2));
    const jwksDir = join(dir, 'hospedagem', 'receptores', r.letra);
    mkdirSync(jwksDir, { recursive: true });
    writeFileSync(
      join(jwksDir, 'jwks.json'),
      JSON.stringify({ keys: [assinatura.publica] }, null, 2),
    );
    const certificados = [];
    for (let n = 1; n <= r.certificados; n++) {
      const cert = cliente(`receptor-${r.letra}-${n}`, `receptor-${r.letra}-${n}`);
      certificados.push({
        not_after: instante(cert.validToDate),
        not_before: instante(cert.validFromDate),
        x5c: [cert.raw.toString('base64')],
        'x5t#S256': x5tS256(new Uint8Array(cert.raw)),
      });
    }
    participantes.push({
      cnpj: completarCnpj(`99999993000${i + 1}`),
      contacts: {
        security_email: `seguranca@receptor-${r.letra}.example`,
        technical_email: `integracao@receptor-${r.letra}.example`,
      },
      display_name: nome,
      legal_name: `${nome} Tecnologia Ltda. (fictício)`,
      participant_id: id,
      protocol_versions: ['0.2'],
      receiver: {
        client_id: id,
        client_name: nome,
        eligibility: {
          declared_at: agora.toISOString().slice(0, 10),
          health_plan_operator: false,
          patient_facing: true,
        },
        jwks_uri: `${base}/jwks.json`,
        policy_uri: `${base}/privacidade`,
        redirect_uris: [retorno],
        scopes_allowed: [...TODOS_OS_ESCOPOS],
        tos_uri: `${base}/termos`,
        transport_certificates: certificados,
      },
      role: 'receiver',
      status: r.situacao,
      updated_at: instante(agora),
    });
    if (eDemonstracao) {
      demonstracao = { clientId: id, nome, redirectUri: retorno };
      continue;
    }
    clientes[r.papel] = {
      certificados: Array.from({ length: r.certificados }, (_, k) => ({
        certificado: `pki/receptor-${r.letra}-${k + 1}.crt`,
        chave: `pki/receptor-${r.letra}-${k + 1}.key`,
      })),
      chave_de_assinatura: `chaves/receptor-${r.letra}.privada.jwk.json`,
      client_id: id,
      jwks_publico: `hospedagem/receptores/${r.letra}/jwks.json`,
    };
  }

  const documento: DocumentoDoRegistro = {
    environment: 'pilot',
    expires_at: instante(new Date(agora.getTime() + 30 * 24 * 3600_000)),
    issued_at: instante(agora),
    participants: participantes,
    registry_keys: { keys: [await chavePublicaDoRegistro(chaveDoRegistro.publica)] },
    schema_version: '0.1',
    sequence: 1,
  };
  const bytes = new TextEncoder().encode(`${JSON.stringify(documento, null, 2)}\n`);
  const chavePrivada = await importJWK(chaveDoRegistro.privada, 'PS256');
  const jws = await assinarRegistro(bytes, chavePrivada, chaveDoRegistro.publica.kid!);
  writeFileSync(join(registroDir, 'participantes.json'), bytes);
  writeFileSync(join(registroDir, 'participantes.json.jws'), `${jws}\n`);
  writeFileSync(
    join(registroDir, 'chaves-iniciais.json'),
    JSON.stringify({ keys: documento.registry_keys.keys }, null, 2),
  );

  // Conferência imediata: V2 a V14 sobre o que acabou de ser escrito (V1 é feito pelo teste com HTTPS).
  const conferencia = await verificarCandidato({
    agora: new Date(),
    ambiente: 'pilot',
    bytes: new Uint8Array(readFileSync(join(registroDir, 'participantes.json'))),
    chavesConfiaveis: documento.registry_keys.keys,
    jws: readFileSync(join(registroDir, 'participantes.json.jws'), 'utf8'),
  });
  if (!conferencia.aceito)
    throw new Error(
      `O registro gerado não passou na verificação: ${conferencia.passo} ${conferencia.motivo}`,
    );
  console.log(
    `Registro assinado: sequence 1, verificação ${conferencia.passos.join(' ')} aprovada`,
  );

  const tokenDeControle = randomBytes(24).toString('base64url');
  writeFileSync(
    join(dir, 'servidor.config.json'),
    JSON.stringify(
      {
        controle: {
          endereco_de_escuta: o.enderecoDeEscuta,
          habilitado: true,
          token: tokenDeControle,
        },
        endereco_de_escuta: o.enderecoDeEscuta,
        limite_por_minuto: 120,
        participant_id: idDoProvedor,
        portas: { controle: o.portaControle, mtls: o.portaMtls, publica: o.portaPublica },
        prazo_de_pagamento_minutos: 15,
        registro: {
          ambiente: 'pilot',
          arquivo: 'registro/participantes.json',
          assinatura: 'registro/participantes.json.jws',
          chaves_iniciais: 'registro/chaves-iniciais.json',
          intervalo_minutos: 30,
          url: `${hospedagem}/registro/participantes.json`,
        },
        tls: {
          ca_confiavel: 'pki/ca.crt',
          certificado: 'pki/servidor.crt',
          chave: 'pki/servidor.key',
        },
        violacoes: [],
      },
      null,
      2,
    ),
  );

  const ana = PACIENTES.find((p) => p.usuario === 'ana')!;
  const bruno = PACIENTES.find((p) => p.usuario === 'bruno')!;
  writeFileSync(
    join(dir, 'suite.config.json'),
    JSON.stringify(
      {
        agenda: {
          exame_comum: FIXTURAS.exameComum,
          exame_indisponivel: {
            exame: FIXTURAS.exameIndisponivel.exame,
            unidade: `Location/${FIXTURAS.exameIndisponivel.unidade}`,
          },
          exame_restrito: FIXTURAS.exameRestrito,
          prazo_de_pagamento_minutos: 15,
          unidade: `Location/${FIXTURAS.unidadeDosTestes}`,
        },
        catalogo: { item_para_retirar: 'mucoproteinas', sistema_proprio: SISTEMA_PRODUTOS },
        certificado_nao_registrado: {
          certificado: 'pki/nao-registrado.crt',
          chave: 'pki/nao-registrado.key',
        },
        clientes,
        controle_de_teste: { token: tokenDeControle, url: `http://127.0.0.1:${o.portaControle}` },
        hospedagem: {
          certificado: 'pki/hospedagem.crt',
          chave: 'pki/hospedagem.key',
          endereco_de_escuta: o.enderecoDeEscuta,
          porta: o.portaHospedagem,
        },
        jornada_por_formulario: {
          campo_decisao: 'decisao',
          campo_senha: 'senha',
          campo_usuario: 'usuario',
          valor_aprovar: 'aprovar',
          valor_recusar: 'recusar',
        },
        pacientes: {
          cpf_invalido: { senha: SENHA_DE_TESTE, usuario: 'diego' },
          outro: {
            cpf: bruno.cpf,
            fhir_id: bruno.id,
            senha: SENHA_DE_TESTE,
            usuario: bruno.usuario,
          },
          principal: {
            agendamento_de_outro_canal: FIXTURAS.agendamentoDeOutroCanal,
            cpf: ana.cpf,
            fhir_id: ana.id,
            laudo_antigo: FIXTURAS.laudoAntigo,
            laudo_para_retificar: FIXTURAS.laudoParaRetificar,
            laudos_nao_liberados: FIXTURAS.laudosNaoLiberados,
            senha: SENHA_DE_TESTE,
            usuario: ana.usuario,
          },
          sem_cpf: { senha: SENHA_DE_TESTE, usuario: 'carla' },
        },
        provedor: { ca_confiavel: 'pki/ca.crt', participant_id: idDoProvedor },
        registro: {
          ambiente: 'pilot',
          assinatura: 'registro/participantes.json.jws',
          caminho_de_publicacao: '/registro/participantes.json',
          chave_privada_para_candidatos: 'chaves/registro.privada.jwk.json',
          chaves_iniciais: 'registro/chaves-iniciais.json',
          documento: 'registro/participantes.json',
        },
      },
      null,
      2,
    ),
  );
  escreverConfiguracaoDaDemonstracao({
    chaves,
    demonstracao: demonstracao!,
    dir,
    hospedagem,
    idDoProvedor,
    pki,
    registroDir,
  });
  writeFileSync(
    join(dir, 'LEIA-ME.txt'),
    [
      'Ambiente local de teste do Open Labs Brasil, gerado por ambiente-local/gerar.ts.',
      'Chaves, certificados e registro servem só para teste local. Não use em outro lugar.',
      `Gerado em ${instante(new Date())}. O registro expira em ${documento.expires_at}: gere de novo com --forcar.`,
      '',
    ].join('\n'),
  );
  console.log(`Ambiente gerado em ${dir}`);
}

/** Verdadeiro se o ambiente existe e o registro ainda vale por mais um dia. */
export function ambienteValido(saida: string): boolean {
  const caminho = join(resolve(saida), 'registro', 'participantes.json');
  if (!existsSync(caminho) || !existsSync(join(resolve(saida), 'suite.config.json'))) return false;
  const doc = JSON.parse(readFileSync(caminho, 'utf8')) as DocumentoDoRegistro;
  return Date.parse(doc.expires_at) - Date.now() > 24 * 3600_000;
}

export function opcoesDaLinhaDeComando(
  argv = process.argv.slice(2),
): OpcoesDoAmbiente & { forcar: boolean; seFaltar: boolean } {
  const { values } = parseArgs({
    args: argv,
    options: {
      'endereco-de-escuta': { default: '127.0.0.1', type: 'string' },
      forcar: { default: false, type: 'boolean' },
      host: { default: 'localhost', type: 'string' },
      'host-hospedagem': { default: 'localhost', type: 'string' },
      'nome-da-demonstracao': { default: NOME_PADRAO_DA_DEMONSTRACAO, type: 'string' },
      'nome-extra': { default: [], multiple: true, type: 'string' },
      'porta-controle': { default: '8445', type: 'string' },
      'porta-hospedagem': { default: '9443', type: 'string' },
      'porta-mtls': { default: '8444', type: 'string' },
      'porta-publica': { default: '8443', type: 'string' },
      saida: { default: 'ambiente-local/gerado', type: 'string' },
      'se-faltar': { default: false, type: 'boolean' },
    },
  });
  return {
    enderecoDeEscuta: values['endereco-de-escuta']!,
    forcar: values.forcar!,
    host: values.host!,
    hostHospedagem: values['host-hospedagem']!,
    nomeDaDemonstracao: values['nome-da-demonstracao']!,
    nomesExtras: values['nome-extra']!,
    portaControle: Number(values['porta-controle']),
    portaHospedagem: Number(values['porta-hospedagem']),
    portaMtls: Number(values['porta-mtls']),
    portaPublica: Number(values['porta-publica']),
    saida: values.saida!,
    seFaltar: values['se-faltar']!,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const o = opcoesDaLinhaDeComando();
  if (o.seFaltar && !o.forcar && ambienteValido(o.saida)) {
    console.log(`Ambiente local já existe e é válido em ${resolve(o.saida)}`);
  } else {
    if (existsSync(o.saida) && !o.forcar && !o.seFaltar) {
      console.error(`${resolve(o.saida)} já existe. Use --forcar para gerar de novo.`);
      process.exit(1);
    }
    rmSync(o.saida, { force: true, recursive: true });
    await gerarAmbiente(o);
  }
}
