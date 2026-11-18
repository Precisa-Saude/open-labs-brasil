import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@precisa-saude/ui/primitives';
import { cn } from '@precisa-saude/ui/utils';
import { ArrowUpRight } from 'lucide-react';
import { useId, useState } from 'react';

import { noRepositorio } from '../dados/enderecos';
import { EXEMPLOS } from '../dados/exemplos';
import { realcar } from '../lib/realce';
import { TIPO } from '../lib/tipografia';
import { SecaoEmGrade } from './marca/SecaoEmGrade';

export function Exemplos() {
  const [ativo, setAtivo] = useState(0);
  const id = useId().replace(/[^\w-]/g, '');
  const exemplo = EXEMPLOS[ativo]!;

  return (
    <SecaoEmGrade id="exemplos">
      <h2 className={TIPO.tituloDeSecao}>Exemplos da especificação</h2>
      <p className={`mt-4 max-w-[58ch] ${TIPO.abertura}`}>
        As chamadas que o aplicativo faz ao laboratório na jornada, do consentimento ao primeiro
        agendamento.
      </p>

      <div className="mt-8 mb-4 lg:hidden">
        <Select
          value={exemplo.titulo}
          onValueChange={(valor) => setAtivo(EXEMPLOS.findIndex((e) => e.titulo === valor))}
        >
          <SelectTrigger aria-label="Exemplo" className="w-full bg-card text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {EXEMPLOS.map((e) => (
              <SelectItem key={e.titulo} className="text-sm" value={e.titulo}>
                {e.titulo}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="mt-8 mb-4 hidden lg:flex">
        <div
          aria-label="Exemplos"
          className="relative inline-grid min-w-max rounded-full bg-card p-1 ring-1 ring-border"
          role="tablist"
          style={{ gridTemplateColumns: `repeat(${EXEMPLOS.length}, 1fr)` }}
        >
          <div
            aria-hidden="true"
            className="absolute top-1 bottom-1 rounded-full bg-primary transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={{
              left: `calc(4px + ${ativo} * ((100% - 8px) / ${EXEMPLOS.length}))`,
              width: `calc((100% - 8px) / ${EXEMPLOS.length})`,
            }}
          />
          {EXEMPLOS.map((e, i) => (
            <button
              key={e.titulo}
              aria-controls={`${id}-painel`}
              aria-selected={ativo === i}
              className={cn(
                'relative z-10 rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors duration-200',
                ativo === i
                  ? 'text-primary-foreground'
                  : 'text-foreground/70 hover:text-foreground',
              )}
              id={`${id}-aba-${i}`}
              role="tab"
              type="button"
              onClick={() => setAtivo(i)}
            >
              {e.titulo}
            </button>
          ))}
        </div>
      </div>

      <div
        aria-labelledby={`${id}-aba-${ativo}`}
        className="overflow-hidden rounded-[0.625rem] border border-ps-violet/40 bg-[#463C6D]"
        id={`${id}-painel`}
        role="tabpanel"
      >
        {exemplo.partes.map((parte, i) => (
          <div key={i} className={cn(parte.rotulo && i > 0 && 'border-t border-white/10')}>
            {parte.rotulo && (
              <p className="px-5 pt-4 font-sans text-xs font-semibold tracking-[0.1em] text-[#BDB8D0] uppercase">
                {parte.rotulo}
              </p>
            )}
            <pre
              className={cn(
                'overflow-x-auto px-5 font-mono text-sm leading-[1.65] text-[#F5F3FA]',
                // Sem legenda, a parte continua a anterior depois de uma linha em
                // branco, como o corpo depois dos cabeçalhos no HTTP.
                parte.rotulo ? 'pt-2' : 'pt-[1.65em]',
                exemplo.partes[i + 1]?.rotulo === undefined && i + 1 < exemplo.partes.length
                  ? 'pb-0'
                  : 'pb-5',
              )}
            >
              <code>{realcar(parte.codigo, parte.linguagem)}</code>
            </pre>
          </div>
        ))}
      </div>

      <a
        className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
        href={`${noRepositorio('especificacao/05-api.md')}#${exemplo.ancora}`}
        rel="noopener noreferrer"
        target="_blank"
      >
        Seção {exemplo.secao}, com as regras de cada campo
        <ArrowUpRight aria-hidden="true" className="size-4" />
      </a>
    </SecaoEmGrade>
  );
}
