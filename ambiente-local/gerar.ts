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
  verificarCandidato,
  x5tS256,
  type DocumentoDoRegistro,
  type Participante,
} from '../comum/registro.ts';
import { FIXTURAS, PACIENTES, SISTEMA_PRODUTOS } from '../servidor-de-exemplo/dados.ts';

const TODOS_OS_ESCOPOS = ['catalog.read', 'locations.read', 'schedule.read', 'consent.manage', 'appointment.write', 'results.read', 'consent.read'] as const;

export interface OpcoesDoAmbiente {
  saida: string;
  host: string;
  hostHospedagem: string;
  nomesExtras: string[];
  portaPublica: number;
  portaMtls: number;
  portaControle: number;
  portaHospedagem: number;
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
    'x509', '-req', '-in', pedido, '-CA', join(pki, 'ca.crt'), '-CAkey', join(pki, 'ca.key'),
    '-set_serial', `0x${randomBytes(12).toString('hex')}`, '-days', '365', '-sha256', '-extfile', ext, '-out', join(pki, `${nome}.crt`),
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
  openssl(['req', '-new', '-key', chave, '-subj', '/O=Open Labs Brasil, teste local/CN=AC de teste local (nao confiar fora deste ambiente)', '-out', pedido]);
  writeFileSync(ext, 'basicConstraints=critical,CA:TRUE\nkeyUsage=critical,keyCertSign,cRLSign\nsubjectKeyIdentifier=hash\n');
  openssl(['x509', '-req', '-in', pedido, '-signkey', chave, '-days', '730', '-sha256', '-extfile', ext, '-out', join(pki, 'ca.crt')]);
  rmSync(pedido);
  rmSync(ext);
}

async function chaveDeAssinatura(): Promise<{ privada: JWK; publica: JWK }> {
  const { privateKey, publicKey } = await generateKeyPair('PS256', { modulusLength: 2048, extractable: true });
  const publica = await exportJWK(publicKey);
  const kid = await calculateJwkThumbprint(publica);
  return {
    privada: { ...(await exportJWK(privateKey)), kid, alg: 'PS256', use: 'sig' },
    publica: { ...publica, kid, alg: 'PS256', use: 'sig' },
  };
}

interface DefinicaoDeReceptor {
  letra: string;
  papel: 'principal' | 'secundario' | 'sentinela' | 'suspenso' | 'retirado';
  nome: string;
  situacao: Participante['status'];
  certificados: number;
}

const RECEPTORES: DefinicaoDeReceptor[] = [
  { letra: 'a', papel: 'principal', nome: 'Aplicativo de Teste A', situacao: 'active', certificados: 2 },
  { letra: 'b', papel: 'secundario', nome: 'Aplicativo de Teste B', situacao: 'active', certificados: 1 },
  { letra: 'c', papel: 'sentinela', nome: 'Aplicativo Sentinela C', situacao: 'active', certificados: 1 },
  { letra: 'd', papel: 'suspenso', nome: 'Aplicativo Suspenso D', situacao: 'suspended', certificados: 1 },
  { letra: 'e', papel: 'retirado', nome: 'Aplicativo Retirado E', situacao: 'withdrawn', certificados: 1 },
];

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
  const nomesDoServidor = nomesAlternativos(['localhost', '127.0.0.1', '::1', o.host, ...o.nomesExtras]);
  emitir(pki, 'servidor', `/O=Laboratorio Exemplo (simulado)/CN=${o.host}`, [
    'basicConstraints=CA:FALSE', 'keyUsage=critical,digitalSignature,keyEncipherment', 'extendedKeyUsage=serverAuth', `subjectAltName=${nomesDoServidor}`,
  ]);
  emitir(pki, 'hospedagem', `/O=Receptores de teste/CN=${o.hostHospedagem}`, [
    'basicConstraints=CA:FALSE', 'keyUsage=critical,digitalSignature,keyEncipherment', 'extendedKeyUsage=serverAuth',
    `subjectAltName=${nomesAlternativos(['localhost', '127.0.0.1', '::1', o.hostHospedagem, ...o.nomesExtras])}`,
  ]);
  const cliente = (nome: string, cn: string) =>
    emitir(pki, nome, `/O=Receptor de teste/CN=${cn}`, ['basicConstraints=CA:FALSE', 'keyUsage=critical,digitalSignature', 'extendedKeyUsage=clientAuth']);
  emitir(pki, 'nao-registrado', '/O=Fora do registro/CN=cliente-nao-registrado', ['basicConstraints=CA:FALSE', 'keyUsage=critical,digitalSignature', 'extendedKeyUsage=clientAuth']);

  console.log('Chaves de assinatura (jose, PS256)');
  const chaveDoRegistro = await chaveDeAssinatura();
  writeFileSync(join(chaves, 'registro.privada.jwk.json'), JSON.stringify(chaveDoRegistro.privada, null, 2));

  const participantes: Participante[] = [];
  const idDoProvedor = randomUUID();
  participantes.push({
    participant_id: idDoProvedor,
    role: 'provider',
    status: 'active',
    legal_name: 'Laboratório Exemplo Local Ltda. (fictício)',
    display_name: 'Laboratório Exemplo (simulado)',
    cnpj: completarCnpj('999999920001'),
    contacts: { technical_email: 'integracao@laboratorio.example', security_email: 'seguranca@laboratorio.example' },
    protocol_versions: ['0.2'],
    updated_at: instante(agora),
    provider: {
      issuer,
      fhir_base_url: `${mtls}/fhir/r4`,
      api_base_url: `${mtls}/acesso/v0`,
      scopes_supported: [...TODOS_OS_ESCOPOS],
      consent_management_uri: `${issuer}/minha-conta/compartilhamentos`,
    },
  });

  const clientes: Record<string, unknown> = {};
  for (const [i, r] of RECEPTORES.entries()) {
    const id = randomUUID();
    const assinatura = await chaveDeAssinatura();
    const caminhoDaChave = join(chaves, `receptor-${r.letra}.privada.jwk.json`);
    writeFileSync(caminhoDaChave, JSON.stringify(assinatura.privada, null, 2));
    const jwksDir = join(dir, 'hospedagem', 'receptores', r.letra);
    mkdirSync(jwksDir, { recursive: true });
    writeFileSync(join(jwksDir, 'jwks.json'), JSON.stringify({ keys: [assinatura.publica] }, null, 2));
    const certificados = [];
    for (let n = 1; n <= r.certificados; n++) {
      const cert = cliente(`receptor-${r.letra}-${n}`, `receptor-${r.letra}-${n}`);
      certificados.push({
        'x5t#S256': x5tS256(new Uint8Array(cert.raw)),
        x5c: [cert.raw.toString('base64')],
        not_before: instante(cert.validFromDate),
        not_after: instante(cert.validToDate),
      });
    }
    const base = `${hospedagem}/receptores/${r.letra}`;
    participantes.push({
      participant_id: id,
      role: 'receiver',
      status: r.situacao,
      legal_name: `${r.nome} Tecnologia Ltda. (fictício)`,
      display_name: r.nome,
      cnpj: completarCnpj(`99999993000${i + 1}`),
      contacts: { technical_email: `integracao@receptor-${r.letra}.example`, security_email: `seguranca@receptor-${r.letra}.example` },
      protocol_versions: ['0.2'],
      updated_at: instante(agora),
      receiver: {
        client_id: id,
        client_name: r.nome,
        redirect_uris: [`${base}/retorno`],
        jwks_uri: `${base}/jwks.json`,
        scopes_allowed: [...TODOS_OS_ESCOPOS],
        transport_certificates: certificados,
        policy_uri: `${base}/privacidade`,
        tos_uri: `${base}/termos`,
        eligibility: { patient_facing: true, health_plan_operator: false, declared_at: agora.toISOString().slice(0, 10) },
      },
    });
    clientes[r.papel] = {
      client_id: id,
      chave_de_assinatura: `chaves/receptor-${r.letra}.privada.jwk.json`,
      jwks_publico: `hospedagem/receptores/${r.letra}/jwks.json`,
      certificados: Array.from({ length: r.certificados }, (_, k) => ({
        certificado: `pki/receptor-${r.letra}-${k + 1}.crt`,
        chave: `pki/receptor-${r.letra}-${k + 1}.key`,
      })),
    };
  }

  const documento: DocumentoDoRegistro = {
    schema_version: '0.1',
    environment: 'pilot',
    sequence: 1,
    issued_at: instante(agora),
    expires_at: instante(new Date(agora.getTime() + 30 * 24 * 3600_000)),
    registry_keys: { keys: [await chavePublicaDoRegistro(chaveDoRegistro.publica)] },
    participants: participantes,
  };
  const bytes = new TextEncoder().encode(`${JSON.stringify(documento, null, 2)}\n`);
  const chavePrivada = await importJWK(chaveDoRegistro.privada, 'PS256');
  const jws = await assinarRegistro(bytes, chavePrivada, chaveDoRegistro.publica.kid!);
  writeFileSync(join(registroDir, 'participantes.json'), bytes);
  writeFileSync(join(registroDir, 'participantes.json.jws'), `${jws}\n`);
  writeFileSync(join(registroDir, 'chaves-iniciais.json'), JSON.stringify({ keys: documento.registry_keys.keys }, null, 2));

  // Conferência imediata: V2 a V14 sobre o que acabou de ser escrito (V1 é feito pelo teste com HTTPS).
  const conferencia = await verificarCandidato({
    bytes: new Uint8Array(readFileSync(join(registroDir, 'participantes.json'))),
    jws: readFileSync(join(registroDir, 'participantes.json.jws'), 'utf8'),
    chavesConfiaveis: documento.registry_keys.keys,
    ambiente: 'pilot',
    agora: new Date(),
  });
  if (!conferencia.aceito) throw new Error(`O registro gerado não passou na verificação: ${conferencia.passo} ${conferencia.motivo}`);
  console.log(`Registro assinado: sequence 1, verificação ${conferencia.passos.join(' ')} aprovada`);

  const tokenDeControle = randomBytes(24).toString('base64url');
  writeFileSync(join(dir, 'servidor.config.json'), JSON.stringify({
    participant_id: idDoProvedor,
    endereco_de_escuta: '127.0.0.1',
    portas: { publica: o.portaPublica, mtls: o.portaMtls, controle: o.portaControle },
    tls: { certificado: 'pki/servidor.crt', chave: 'pki/servidor.key', ca_confiavel: 'pki/ca.crt' },
    registro: {
      arquivo: 'registro/participantes.json',
      assinatura: 'registro/participantes.json.jws',
      chaves_iniciais: 'registro/chaves-iniciais.json',
      url: `${hospedagem}/registro/participantes.json`,
      ambiente: 'pilot',
      intervalo_minutos: 30,
    },
    controle: { habilitado: true, token: tokenDeControle, endereco_de_escuta: '127.0.0.1' },
    prazo_de_pagamento_minutos: 15,
    limite_por_minuto: 120,
    violacoes: [],
  }, null, 2));

  const ana = PACIENTES.find((p) => p.usuario === 'ana')!;
  const bruno = PACIENTES.find((p) => p.usuario === 'bruno')!;
  writeFileSync(join(dir, 'suite.config.json'), JSON.stringify({
    registro: {
      documento: 'registro/participantes.json',
      assinatura: 'registro/participantes.json.jws',
      chaves_iniciais: 'registro/chaves-iniciais.json',
      ambiente: 'pilot',
      chave_privada_para_candidatos: 'chaves/registro.privada.jwk.json',
      caminho_de_publicacao: '/registro/participantes.json',
    },
    provedor: { participant_id: idDoProvedor, ca_confiavel: 'pki/ca.crt' },
    hospedagem: {
      endereco_de_escuta: '127.0.0.1',
      porta: o.portaHospedagem,
      certificado: 'pki/hospedagem.crt',
      chave: 'pki/hospedagem.key',
    },
    clientes,
    certificado_nao_registrado: { certificado: 'pki/nao-registrado.crt', chave: 'pki/nao-registrado.key' },
    pacientes: {
      principal: {
        usuario: ana.usuario,
        cpf: ana.cpf,
        fhir_id: ana.id,
        laudos_nao_liberados: FIXTURAS.laudosNaoLiberados,
        laudo_antigo: FIXTURAS.laudoAntigo,
        laudo_para_retificar: FIXTURAS.laudoParaRetificar,
        agendamento_de_outro_canal: FIXTURAS.agendamentoDeOutroCanal,
      },
      outro: { usuario: bruno.usuario, cpf: bruno.cpf, fhir_id: bruno.id },
      sem_cpf: { usuario: 'carla' },
    },
    agenda: {
      unidade: `Location/${FIXTURAS.unidadeDosTestes}`,
      exame_comum: FIXTURAS.exameComum,
      exame_restrito: FIXTURAS.exameRestrito,
      exame_indisponivel: { unidade: `Location/${FIXTURAS.exameIndisponivel.unidade}`, exame: FIXTURAS.exameIndisponivel.exame },
      prazo_de_pagamento_minutos: 15,
    },
    catalogo: { item_para_retirar: 'mucoproteinas', sistema_proprio: SISTEMA_PRODUTOS },
    controle_de_teste: { url: `http://127.0.0.1:${o.portaControle}`, token: tokenDeControle },
  }, null, 2));
  writeFileSync(join(dir, 'LEIA-ME.txt'), [
    'Ambiente local de teste do Open Labs Brasil, gerado por ambiente-local/gerar.ts.',
    'Chaves, certificados e registro servem só para teste local. Não use em outro lugar.',
    `Gerado em ${instante(new Date())}. O registro expira em ${documento.expires_at}: gere de novo com --forcar.`,
    '',
  ].join('\n'));
  console.log(`Ambiente gerado em ${dir}`);
}

/** Verdadeiro se o ambiente existe e o registro ainda vale por mais um dia. */
export function ambienteValido(saida: string): boolean {
  const caminho = join(resolve(saida), 'registro', 'participantes.json');
  if (!existsSync(caminho) || !existsSync(join(resolve(saida), 'suite.config.json'))) return false;
  const doc = JSON.parse(readFileSync(caminho, 'utf8')) as DocumentoDoRegistro;
  return Date.parse(doc.expires_at) - Date.now() > 24 * 3600_000;
}

export function opcoesDaLinhaDeComando(argv = process.argv.slice(2)): OpcoesDoAmbiente & { forcar: boolean; seFaltar: boolean } {
  const { values } = parseArgs({
    args: argv,
    options: {
      saida: { type: 'string', default: 'ambiente-local/gerado' },
      host: { type: 'string', default: 'localhost' },
      'host-hospedagem': { type: 'string', default: 'localhost' },
      'nome-extra': { type: 'string', multiple: true, default: [] },
      'porta-publica': { type: 'string', default: '8443' },
      'porta-mtls': { type: 'string', default: '8444' },
      'porta-controle': { type: 'string', default: '8445' },
      'porta-hospedagem': { type: 'string', default: '9443' },
      forcar: { type: 'boolean', default: false },
      'se-faltar': { type: 'boolean', default: false },
    },
  });
  return {
    saida: values.saida!,
    host: values.host!,
    hostHospedagem: values['host-hospedagem']!,
    nomesExtras: values['nome-extra']!,
    portaPublica: Number(values['porta-publica']),
    portaMtls: Number(values['porta-mtls']),
    portaControle: Number(values['porta-controle']),
    portaHospedagem: Number(values['porta-hospedagem']),
    forcar: values.forcar!,
    seFaltar: values['se-faltar']!,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const o = opcoesDaLinhaDeComando();
  if (o.seFaltar && ambienteValido(o.saida)) {
    console.log(`Ambiente local já existe e é válido em ${resolve(o.saida)}`);
  } else {
    if (existsSync(o.saida) && !o.forcar && !o.seFaltar) {
      console.error(`${resolve(o.saida)} já existe. Use --forcar para gerar de novo.`);
      process.exit(1);
    }
    rmSync(o.saida, { recursive: true, force: true });
    await gerarAmbiente(o);
  }
}
