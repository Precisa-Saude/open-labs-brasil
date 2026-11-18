import { ArrowRight, Check, Copy } from 'lucide-react';
import { useState } from 'react';

import { ENDERECOS, REPOSITORIO } from '../dados/enderecos';
import { ESPECIFICACAO } from '../dados/situacao';
import { TIPO } from '../lib/tipografia';
import { FundoDeSecao } from './marca/FundoDeSecao';
import { estiloDaGrade } from './marca/SecaoEmGrade';

const COMANDO = `git clone ${REPOSITORIO}`;

const SELOS = ['FAPI 2.0', 'FHIR R4', 'LOINC', 'CC BY 4.0 e Apache-2.0'];

// Três colunas cada: os quatro selos ocupam exatamente as 12 colunas úteis.
const COLUNAS_DOS_SELOS = [
  'md:col-start-2 3xl:col-start-3',
  'md:col-start-5 3xl:col-start-6',
  'md:col-start-8 3xl:col-start-9',
  'md:col-start-11 3xl:col-start-12',
];

export function Abertura() {
  const [copiado, setCopiado] = useState(false);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(COMANDO);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // A API da área de transferência falha se a página não estiver em foco.
    }
  };

  return (
    <section className="relative isolate overflow-hidden border-b bg-background pt-16 text-primary">
      <FundoDeSecao opacidade={0.85} />
      <div
        className="relative mx-auto grid items-center gap-x-4 gap-y-12 px-4 pt-16 pb-12 md:px-0 lg:min-h-[calc(100svh-4rem-5rem)] lg:pt-20"
        style={estiloDaGrade}
      >
        <div className="col-span-full md:col-span-12 md:col-start-2 lg:col-span-6 lg:col-start-2 lg:pr-8 3xl:col-start-3">
          <p className={`mb-5 ${TIPO.sobretitulo}`}>
            Protocolo aberto · versão {ESPECIFICACAO.versao}, em piloto
          </p>
          <h1 className={`max-w-[19ch] ${TIPO.titulo}`}>
            Dados do laboratório sob <em className="brand-highlight">controle do paciente</em>
          </h1>
          <p className="mt-6 mb-8 max-w-[46ch] text-lg leading-relaxed">
            O aplicativo agenda exames e recebe resultados depois que o paciente aprova o acesso na
            página do próprio laboratório.
          </p>

          <a
            className="group inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-8 text-sm font-medium whitespace-nowrap text-primary-foreground transition-colors hover:bg-primary/90"
            href={ENDERECOS.indice}
            rel="noopener noreferrer"
            target="_blank"
          >
            Ler a especificação
            <ArrowRight
              aria-hidden="true"
              className="size-[18px] transition-transform duration-200 group-hover:translate-x-1"
            />
          </a>

          {/* Comando em superfície opaca sobre o fundo: é o que o desenvolvedor
              copia para rodar o servidor de exemplo e a suíte. */}
          <button
            aria-label={`Copiar: ${COMANDO}`}
            className="group mt-5 flex w-full max-w-md items-center justify-between gap-4 rounded-md bg-white px-4 py-3 font-mono text-sm text-[#30264f] shadow-[0_0_0_1px_#463c6d24,0_6px_16px_#463c6d12] transition-shadow hover:shadow-[0_0_0_1px_#463c6d52,0_6px_16px_#463c6d12]"
            type="button"
            onClick={copiar}
          >
            <span className="truncate">
              <span aria-hidden="true" className="text-ps-violet">
                $
              </span>{' '}
              {COMANDO}
            </span>
            {copiado ? (
              <Check aria-hidden="true" className="h-4 w-4 shrink-0 text-primary" />
            ) : (
              <Copy
                aria-hidden="true"
                className="h-4 w-4 shrink-0 text-primary/50 transition-colors group-hover:text-primary"
              />
            )}
          </button>
          {/* A troca de ícone é só visual; a região viva anuncia a cópia. */}
          <span aria-live="polite" className="sr-only">
            {copiado ? 'Comando copiado' : ''}
          </span>
        </div>
      </div>

      <div className="relative mx-auto grid gap-4 px-4 pb-4 md:px-0" style={estiloDaGrade}>
        {SELOS.map((selo, i) => (
          <span
            key={selo}
            className={`col-span-full border-t border-primary/20 pt-4 text-sm sm:col-span-7 md:col-span-3 ${COLUNAS_DOS_SELOS[i]}`}
          >
            {selo}
          </span>
        ))}
      </div>
    </section>
  );
}
