// Demonstração com um aplicativo de verdade: sobe o servidor de exemplo e a
// hospedagem que faz o papel do mantenedor do registro e dos backends dos
// receptores (o jwks_uri de cada um), mais a página de retorno do aplicativo de
// demonstração, que repassa o navegador ao backend dele. O aplicativo lê o que
// precisa de ambiente-local/gerado/demonstracao.json.
//
//   pnpm demonstracao [--retorno-para http://localhost:3000/api/lab-access/retorno]
//                     [--nome "Nome do aplicativo"]
//
// Só para uso local: chaves, certificados e pacientes são de teste.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parseArgs } from 'node:util';

import { lerConfiguracao } from '../servidor-de-exemplo/configuracao.ts';
import { iniciarServidor } from '../servidor-de-exemplo/servidor.ts';
import { lerConfiguracaoDaSuite } from '../suite-de-conformidade/configuracao.ts';
import { Hospedagem } from '../suite-de-conformidade/hospedagem.ts';
import { PASTA_DO_AMBIENTE } from '../suite-de-conformidade/local.ts';
import {
  ambienteValido,
  CAMINHO_DE_RETORNO_DA_DEMONSTRACAO,
  gerarAmbiente,
  NOME_PADRAO_DA_DEMONSTRACAO,
  opcoesDaLinhaDeComando,
} from './gerar.ts';

export const RETORNO_PADRAO = 'http://localhost:3000/api/lab-access/retorno';

/** O conteúdo de `demonstracao.json`. Caminhos absolutos. */
export interface ConfiguracaoDaDemonstracao {
  ambiente: 'pilot';
  ca_confiavel: string;
  cliente: {
    certificado: string;
    chave_de_assinatura: string;
    chave_do_certificado: string;
    client_id: string;
    nome: string;
    redirect_uri: string;
  };
  pacientes: Array<{ cpf: string; senha: string; usuario: string }>;
  provedor: { participant_id: string };
  registro: { assinatura: string; chaves_iniciais: string; documento: string };
}

export interface Demonstracao {
  /** Caminho de `demonstracao.json`. */
  configuracao: string;
  fechar: () => Promise<void>;
  /** Endereço do backend do aplicativo para onde a página de retorno repassa o navegador. */
  retornoPara: string;
}

function lerConfiguracaoDaDemonstracao(pasta: string): ConfiguracaoDaDemonstracao | undefined {
  const caminho = join(pasta, 'demonstracao.json');
  if (!existsSync(caminho)) return undefined;
  return JSON.parse(readFileSync(caminho, 'utf8')) as ConfiguracaoDaDemonstracao;
}

function arquivosEm(pasta: string): string[] {
  return readdirSync(pasta, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => join(e.parentPath, e.name));
}

export async function iniciarDemonstracao(o: {
  nome: string;
  pasta?: string;
  registrarEmLog?: boolean;
  retornoPara: string;
}): Promise<Demonstracao> {
  const pasta = o.pasta ?? PASTA_DO_AMBIENTE;
  // O nome entra no registro assinado: se mudou, o ambiente é gerado de novo.
  if (!ambienteValido(pasta) || lerConfiguracaoDaDemonstracao(pasta)?.cliente.nome !== o.nome) {
    await gerarAmbiente({
      ...opcoesDaLinhaDeComando([]),
      nomeDaDemonstracao: o.nome,
      saida: pasta,
    });
  }
  const suite = lerConfiguracaoDaSuite(join(pasta, 'suite.config.json'));
  const caminhoDoRegistro = suite.registro.caminho_de_publicacao!;

  const hospedagem = new Hospedagem();
  hospedagem.publicar(
    caminhoDoRegistro,
    readFileSync(join(pasta, 'registro', 'participantes.json')),
  );
  hospedagem.publicar(
    `${caminhoDoRegistro}.jws`,
    readFileSync(join(pasta, 'registro', 'participantes.json.jws')),
  );
  // O jwks_uri de cada receptor é `{hospedagem}/receptores/{letra}/jwks.json`.
  const publicos = join(pasta, 'hospedagem');
  for (const arquivo of arquivosEm(publicos)) {
    hospedagem.publicar(`/${relative(publicos, arquivo)}`, readFileSync(arquivo));
  }
  hospedagem.redirecionar(CAMINHO_DE_RETORNO_DA_DEMONSTRACAO, o.retornoPara);
  await hospedagem.iniciar({
    certificado: join(pasta, suite.hospedagem!.certificado),
    chave: join(pasta, suite.hospedagem!.chave),
    endereco: suite.hospedagem!.endereco_de_escuta,
    porta: suite.hospedagem!.porta,
  });

  let servidor: Awaited<ReturnType<typeof iniciarServidor>>;
  try {
    servidor = await iniciarServidor(
      lerConfiguracao(join(pasta, 'servidor.config.json'), {
        registrarEmLog: o.registrarEmLog ?? false,
      }),
    );
  } catch (e) {
    await hospedagem.fechar();
    throw e;
  }
  return {
    configuracao: join(pasta, 'demonstracao.json'),
    fechar: async () => {
      await servidor.fechar();
      await hospedagem.fechar();
    },
    retornoPara: o.retornoPara,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const argumentos = process.argv.slice(2);
  // `pnpm demonstracao -- --nome X` repassa o `--` ao script.
  if (argumentos[0] === '--') argumentos.shift();
  const { values } = parseArgs({
    args: argumentos,
    options: {
      nome: { default: NOME_PADRAO_DA_DEMONSTRACAO, type: 'string' },
      'retorno-para': { default: RETORNO_PADRAO, type: 'string' },
    },
  });
  const demonstracao = await iniciarDemonstracao({
    nome: values.nome!,
    registrarEmLog: true,
    retornoPara: values['retorno-para']!,
  });
  const cfg = lerConfiguracaoDaDemonstracao(PASTA_DO_AMBIENTE)!;
  console.log(
    [
      '',
      'Demonstração do Open Labs Brasil no ar. Ctrl-C encerra.',
      '',
      `Aplicativo: ${cfg.cliente.nome} (client_id ${cfg.cliente.client_id})`,
      `Configuração para o aplicativo: ${demonstracao.configuracao}`,
      `Retorno: ${cfg.cliente.redirect_uri} repassa para ${demonstracao.retornoPara}`,
      `Registro: ${cfg.registro.documento}`,
      `AC de teste, para o navegador confiar nas páginas do laboratório: ${cfg.ca_confiavel}`,
      '',
      'Pacientes de teste (login na página do laboratório):',
      ...cfg.pacientes.map((p) => `  ${p.usuario}, senha ${p.senha}, CPF ${p.cpf}`),
      '',
    ].join('\n'),
  );
  const encerrar = () => {
    demonstracao.fechar().then(() => process.exit(0));
  };
  process.on('SIGINT', encerrar);
  process.on('SIGTERM', encerrar);
}
