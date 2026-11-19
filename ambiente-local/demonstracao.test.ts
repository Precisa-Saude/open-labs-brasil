// A demonstração serve um aplicativo que só conhece demonstracao.json: ele
// baixa e verifica o registro, conecta o paciente na página do laboratório,
// recebe o navegador de volta pela página de retorno e lê os laudos.

import { readFileSync } from 'node:fs';
import { rootCertificates } from 'node:tls';

import type { JWK } from 'jose';
import { describe, expect, it } from 'vitest';

import { baixarRegistro, type ChaveDoRegistro, verificarCandidato } from '../comum/registro.ts';
import { Hospedagem } from '../suite-de-conformidade/hospedagem.ts';
import {
  Navegador,
  pacienteNoNavegador,
} from '../suite-de-conformidade/receptor-minimo/jornada.ts';
import { ReceptorMinimo } from '../suite-de-conformidade/receptor-minimo/receptor.ts';
import { type ConfiguracaoDaDemonstracao, iniciarDemonstracao } from './demonstracao.ts';

describe('pnpm demonstracao', () => {
  it('um aplicativo que só lê demonstracao.json conecta o paciente e lê os laudos', async () => {
    const nome = 'Aplicativo de demonstração do teste';
    const retornoPara = 'http://localhost:3999/api/lab-access/retorno?tenant=teste';
    const demonstracao = await iniciarDemonstracao({ nome, retornoPara });
    try {
      const cfg = JSON.parse(
        readFileSync(demonstracao.configuracao, 'utf8'),
      ) as ConfiguracaoDaDemonstracao;
      expect(cfg.cliente.nome).toBe(nome);
      const ca = [...rootCertificates, readFileSync(cfg.ca_confiavel, 'utf8')].join('\n');

      // O registro vem da hospedagem, por HTTPS, e passa em V1 a V14.
      const baixado = await baixarRegistro(cfg.registro.documento, {
        ca,
        urlDaAssinatura: cfg.registro.assinatura,
      });
      if ('erro' in baixado) throw new Error(baixado.erro);
      const iniciais = JSON.parse(readFileSync(cfg.registro.chaves_iniciais, 'utf8')) as {
        keys: ChaveDoRegistro[];
      };
      const verificado = await verificarCandidato({
        ...baixado,
        agora: new Date(),
        ambiente: cfg.ambiente,
        chavesConfiaveis: iniciais.keys,
      });
      if (!verificado.aceito) throw new Error(`registro recusado em ${verificado.passo}`);

      const receptor = new ReceptorMinimo({
        ca,
        certificado: {
          cert: readFileSync(cfg.cliente.certificado),
          key: readFileSync(cfg.cliente.chave_do_certificado),
        },
        chaveDeAssinatura: JSON.parse(readFileSync(cfg.cliente.chave_de_assinatura, 'utf8')) as JWK,
        clientId: cfg.cliente.client_id,
        participantIdDoProvedor: cfg.provedor.participant_id,
        registro: verificado.documento,
      });
      // Autenticação do cliente: o servidor busca o jwks_uri na hospedagem.
      await receptor.descobrir();

      const ana = cfg.pacientes.find((p) => p.usuario === 'ana')!;
      const jornada = await receptor.iniciarConexao(ana.cpf);
      const nav = new Navegador(ca);
      const retorno = await pacienteNoNavegador(
        nav,
        jornada.urlDeAutorizacao,
        ana.usuario,
        'aprovar',
        (html) => expect(html).toContain(nome),
      );
      expect(retorno.startsWith(`${cfg.cliente.redirect_uri}?`)).toBe(true);

      // A página de retorno repassa o navegador ao backend, com a consulta intacta.
      const repasse = await nav.pedir(retorno);
      expect(repasse.status).toBe(303);
      const destino = new URL(repasse.location!);
      const backend = new URL(retornoPara);
      expect(`${destino.origin}${destino.pathname}`).toBe(`${backend.origin}${backend.pathname}`);
      expect(destino.searchParams.get('tenant')).toBe('teste');
      for (const [chave, valor] of new URL(retorno).searchParams) {
        expect(destino.searchParams.get(chave)).toBe(valor);
      }

      const retornoComEscapes = await nav.pedir(`${retorno}&tenant=outro&exemplo=a%20b%2Fc`);
      expect(retornoComEscapes.location).toContain('exemplo=a%20b%2Fc');
      expect(new URL(retornoComEscapes.location!).searchParams.get('tenant')).toBe('teste');

      const conexao = await receptor.concluirConexao(repasse.location!);
      if (!conexao.ok) throw new Error(`conexão falhou: ${conexao.motivo} ${conexao.detalhe}`);
      expect((await receptor.resultados(conexao.vinculo)).length).toBeGreaterThan(0);
    } finally {
      await demonstracao.fechar();
    }
  });

  it('recusa um destino relativo ao registrar o redirecionamento', () => {
    const hospedagem = new Hospedagem();
    expect(() => hospedagem.redirecionar('/demonstracao/retorno', '/retorno')).toThrow(TypeError);
  });
});
