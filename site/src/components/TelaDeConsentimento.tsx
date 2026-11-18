import { cn } from '@precisa-saude/ui/utils';
import { ArrowDown, Check, Lock, RotateCcw } from 'lucide-react';
import { useState } from 'react';

import { TELA_DE_CONSENTIMENTO as TELA } from '../dados/consentimento';

const SOMBRA = 'shadow-[0_0_0_1px_#463c6d24,0_6px_16px_#463c6d12]';
const ROTULO = 'mb-2 font-sans text-xs font-semibold tracking-[0.1em] text-primary uppercase';

type Estado = 'AUTHORISED' | 'AWAITING_AUTHORISATION' | 'REJECTED';

/** O que acontece em cada estado, dito ao leitor da página. */
const EXPLICACAO: Record<Estado, string> = {
  AUTHORISED:
    'O laboratório devolve um código ao aplicativo, que o troca por tokens nos escopos aprovados.',
  AWAITING_AUTHORISATION:
    'O aplicativo criou o pedido e espera a decisão do paciente, por até 60 minutos.',
  REJECTED: 'O consentimento termina aqui, e o aplicativo não recebe código nem dado nenhum.',
};

/**
 * Ilustração da abertura: a tela de consentimento na página do laboratório e
 * o estado que ela muda. Painel lavanda opaco sobre o fundo geométrico, como
 * os números do medbench-brasil e a demonstração da /laudos. Mostra os
 * elementos que a seção 4.4 exige da tela, com os textos dos exemplos da
 * especificação, e os botões mudam o estado como as transições T2 e T3 do
 * capítulo 4. O nome do aplicativo fica genérico: o do registro de exemplo,
 * "App do Paciente Exemplo", parecia falar de um paciente.
 */
export function TelaDeConsentimento() {
  const [estado, setEstado] = useState<Estado>('AWAITING_AUTHORISATION');
  const decidido = estado !== 'AWAITING_AUTHORISATION';

  const botao =
    'inline-flex h-10 items-center justify-center rounded-full font-sans text-sm font-medium transition-colors disabled:cursor-default disabled:opacity-40';

  return (
    <figure
      aria-label={`Exemplo da tela de consentimento na página do ${TELA.laboratorio}`}
      className="col-span-full bg-[#dedcf2] p-4 md:col-span-12 md:col-start-2 md:p-6 lg:col-span-6 lg:col-start-8 3xl:col-start-9"
    >
      <p className={ROTULO}>01 · Página do laboratório</p>
      <div className={`overflow-hidden rounded-md bg-white text-[#30264f] ${SOMBRA}`}>
        <div className="flex items-center gap-2 border-b border-primary/10 bg-[#f6f5fb] px-4 py-2 font-mono text-xs text-primary/70">
          <Lock aria-hidden="true" className="size-3.5" />
          {TELA.endereco}
        </div>
        <div className="p-5 md:p-6">
          <p className="font-sans text-sm text-primary/70">{TELA.laboratorio}</p>
          <p className="mt-1 font-sans text-lg leading-snug font-semibold">
            Seu aplicativo de saúde pede autorização para
          </p>
          <ul className="mt-4 space-y-2">
            {TELA.escopos.map((texto) => (
              <li key={texto} className="flex gap-2.5 font-sans text-sm leading-snug">
                <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
                {texto}
              </li>
            ))}
          </ul>
          <p className="mt-4 border-l-2 border-ps-mint pl-3 font-sans text-sm leading-snug text-[#30264f]/80">
            {TELA.finalidade}
          </p>
          <p className="mt-4 font-sans text-xs leading-relaxed text-[#30264f]/70">
            Válido até {TELA.validade}. O laboratório vai confirmar ao aplicativo o CPF de quem está
            autorizando.
          </p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <button
              className={`${botao} border border-primary/30 text-primary enabled:hover:border-primary`}
              disabled={decidido}
              type="button"
              onClick={() => setEstado('REJECTED')}
            >
              Recusar
            </button>
            <button
              className={`${botao} bg-primary text-primary-foreground enabled:hover:bg-primary/90`}
              disabled={decidido}
              type="button"
              onClick={() => setEstado('AUTHORISED')}
            >
              Autorizar
            </button>
          </div>
        </div>
      </div>

      <div aria-hidden="true" className="flex justify-center py-2 text-primary/60">
        <ArrowDown className="size-5" />
      </div>

      <div className="flex items-baseline justify-between gap-3">
        <p className={ROTULO}>02 · Consentimento</p>
        {decidido && (
          <button
            className="mb-2 inline-flex items-center gap-1 font-sans text-xs font-medium text-primary underline-offset-4 hover:underline"
            type="button"
            onClick={() => setEstado('AWAITING_AUTHORISATION')}
          >
            <RotateCcw aria-hidden="true" className="size-3.5" />
            Repetir
          </button>
        )}
      </div>
      <div className={`rounded-md bg-white px-5 py-4 text-[#30264f] ${SOMBRA}`}>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-sm">
          {decidido && (
            <>
              <span className="text-[#30264f]/50 line-through decoration-[#30264f]/30">
                AWAITING_AUTHORISATION
              </span>
              <span aria-hidden="true" className="text-primary/60">
                →
              </span>
            </>
          )}
          <span
            key={estado}
            className={cn(
              'rounded px-1.5 py-0.5 font-semibold animate-in fade-in zoom-in-95 duration-300',
              estado === 'AUTHORISED' && 'bg-ps-mint text-primary',
              estado === 'REJECTED' && 'bg-[#F47A5C]/20 text-[#8a2f19]',
              estado === 'AWAITING_AUTHORISATION' && 'bg-[#f6f5fb] text-primary',
            )}
          >
            {estado}
          </span>
        </p>
        <p aria-live="polite" className="mt-2 font-sans text-sm leading-snug text-[#30264f]/75">
          {EXPLICACAO[estado]}
        </p>
      </div>
    </figure>
  );
}
