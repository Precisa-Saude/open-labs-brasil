import { cn } from '@precisa-saude/ui/utils';
import type { ReactNode } from 'react';

import { FundoDeSecao, type PropsDoFundoDeSecao } from './FundoDeSecao';

export const estiloDaGrade = {
  gridTemplateColumns: 'repeat(var(--grid-cols), minmax(0, 1fr))',
  maxWidth: 'var(--grid-max-w)',
  width: '100%',
} as const;

/** Colunas úteis do grid: 2 a 13 no desktop, 3 a 14 a partir de 1440 px. */
export const COLUNAS_PRINCIPAIS = 'col-span-full md:col-span-12 md:col-start-2 3xl:col-start-3';

/**
 * Grade interna das 12 colunas úteis. Mesmo gutter do grid externo, então
 * `md:col-span-6` aqui coincide com seis colunas da página.
 */
export const GRADE_INTERNA = 'grid grid-cols-1 gap-4 md:grid-cols-12';

const CLASSE_DO_TOM = {
  /** Um passo abaixo do fundo, para alternar seções. */
  muted: 'bg-muted',
  neutro: 'bg-background',
  /** Roxo escuro da marca, para o encerramento. */
  roxo: 'bg-primary text-primary-foreground',
} as const;

export interface PropsDaSecaoEmGrade {
  children: ReactNode;
  className?: string;
  /** Composição geométrica de fundo; omitida em seções de código e listas. */
  fundo?: PropsDoFundoDeSecao;
  id?: string;
  tom?: keyof typeof CLASSE_DO_TOM;
}

/**
 * Seção de largura total com o grid de 14/16 colunas da marca e a divisória
 * de 1 px entre seções. O fundo pinta até a borda da janela; o conteúdo fica
 * nas colunas úteis.
 */
export function SecaoEmGrade({
  children,
  className,
  fundo,
  id,
  tom = 'neutro',
}: PropsDaSecaoEmGrade) {
  return (
    <section
      className={cn('relative isolate overflow-hidden border-b py-16 md:py-24', CLASSE_DO_TOM[tom])}
      id={id}
    >
      {fundo && <FundoDeSecao {...fundo} />}
      <div className="relative mx-auto grid gap-4 px-4 md:px-0" style={estiloDaGrade}>
        <div className={cn(COLUNAS_PRINCIPAIS, className)}>{children}</div>
      </div>
    </section>
  );
}
