import { ArrowUpRight } from 'lucide-react';

import { ENDERECOS } from '../dados/enderecos';
import { ESPECIFICACAO, SUITE } from '../dados/situacao';
import { SUPERFICIE, TIPO } from '../lib/tipografia';
import { GRADE_INTERNA, SecaoEmGrade } from './marca/SecaoEmGrade';

/** Comandos do README, com o que cada um faz. */
const COMANDOS = [
  { comando: 'pnpm install', comentario: '' },
  {
    comando: 'pnpm conformidade:local',
    comentario: 'servidor de exemplo e suíte, em um comando',
  },
  { comando: 'pnpm jornada', comentario: 'jornada de ponta a ponta com um receptor mínimo' },
  {
    comando: 'pnpm demonstracao',
    comentario: 'laboratório simulado para um aplicativo de verdade',
  },
] as const;

const FERRAMENTAS = [
  {
    descricao: `Implementa o lado do provedor da especificação ${ESPECIFICACAO.versao}, com dados sintéticos, e roda na máquina de quem testa, direto pelo Node ou em Docker.`,
    titulo: 'Servidor de exemplo',
  },
  {
    descricao:
      'Apontada para qualquer endpoint, inclusive a homologação de um laboratório, executa os requisitos de provedor do capítulo 9 e diz qual passou.',
    titulo: 'Suíte de conformidade',
  },
  {
    descricao:
      'Percorre a jornada contra o servidor de exemplo, da criação do consentimento às chamadas FHIR. Quem escreve um aplicativo pode usá-lo como referência.',
    titulo: 'Receptor mínimo',
  },
] as const;

export function Ferramentas() {
  return (
    <SecaoEmGrade className={GRADE_INTERNA} id="ferramentas">
      <h2 className={`col-span-full ${TIPO.tituloDeSecao}`}>Ferramentas para testar</h2>
      <p className={`col-span-full mb-8 max-w-[56ch] ${TIPO.abertura}`}>
        Para ver o protocolo funcionando antes de escrever código, o repositório tem um laboratório
        simulado com dados sintéticos e uma suíte que mede a conformidade de qualquer provedor.
        Basta Node 22.18 ou mais novo, pnpm e openssl.
      </p>

      <div className="col-span-full md:col-span-5">
        <p className={TIPO.rotulo}>Contra o servidor de exemplo</p>
        <p className="mt-3 font-sans text-5xl font-medium tracking-tight text-primary tabular-nums">
          {SUITE.aprovados}
          <span className="text-2xl text-foreground/60"> de {SUITE.total}</span>
        </p>
        <p className="mt-2 max-w-[40ch] leading-relaxed text-foreground/75">
          requisitos de provedor aprovados e {SUITE.reprovados} reprovados. Os outros{' '}
          {SUITE.naoVerificaveis} não têm teste automático e dependem de alguém conferir.
        </p>
        <a
          className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
          href={ENDERECOS.cobertura}
          rel="noopener noreferrer"
          target="_blank"
        >
          Cobertura requisito por requisito
          <ArrowUpRight aria-hidden="true" className="size-4" />
        </a>
      </div>

      <pre
        className={`col-span-full overflow-x-auto p-5 font-mono text-sm leading-7 md:col-span-7 ${SUPERFICIE}`}
      >
        <code>
          {COMANDOS.map(({ comando, comentario }) => (
            <span key={comando} className="block">
              <span aria-hidden="true" className="text-ps-violet">
                ${' '}
              </span>
              {comando}
              {comentario && <span className="text-foreground/55">{`   # ${comentario}`}</span>}
            </span>
          ))}
        </code>
      </pre>

      {FERRAMENTAS.map((ferramenta) => (
        <div key={ferramenta.titulo} className="col-span-full border-t pt-6 md:col-span-4 md:mt-8">
          <h3 className={TIPO.subtitulo}>{ferramenta.titulo}</h3>
          <p className="mt-2 leading-relaxed text-foreground/75">{ferramenta.descricao}</p>
        </div>
      ))}

      <a
        className="col-span-full mt-6 inline-flex items-center gap-1 justify-self-start text-sm font-medium text-primary underline-offset-4 hover:underline"
        href={ENDERECOS.servidorESuite}
        rel="noopener noreferrer"
        target="_blank"
      >
        Como rodar a suíte contra a homologação do laboratório
        <ArrowUpRight aria-hidden="true" className="size-4" />
      </a>
    </SecaoEmGrade>
  );
}
