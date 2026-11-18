/**
 * Escala editorial do site do fhir-brasil, que segue a /laudos da Precisa.
 * Pausa 300 só no título da página e nos títulos de seção; Margem no resto.
 *
 *   titulo           Pausa 300, 40 a 64 px, um por página
 *   tituloDeSecao    Pausa 300, 30 a 44 px, um por seção
 *   subtitulo        Margem 600, 18 px, títulos de bloco e de cartão
 *   tituloDeCartao   Margem 600, 20 px, itens numerados
 *   sobretitulo      Margem 600, 14 px, caixa alta, acima do título
 *   rotulo           Margem 600, 12 px, caixa alta, abre um bloco
 *   abertura         Margem 400, 18 a 20 px, texto sob o título da seção
 */
export const TIPO = {
  abertura: 'text-lg leading-relaxed text-pretty text-foreground/75',
  rotulo: 'font-sans text-xs font-semibold tracking-[0.1em] text-foreground/70 uppercase',
  sobretitulo: 'font-sans text-sm font-semibold tracking-[0.1em] uppercase',
  subtitulo: 'font-sans text-lg leading-snug font-semibold',
  titulo:
    'font-serif text-[clamp(2.5rem,4.4vw,4rem)] leading-[1.08] font-light tracking-[-0.025em] text-balance',
  tituloDeCartao: 'font-sans text-xl font-semibold',
  tituloDeSecao:
    'font-serif text-[clamp(1.875rem,3.2vw,2.75rem)] leading-[1.15] font-light tracking-[-0.018em] text-balance',
} as const;

/** Superfície opaca sobre o fundo geométrico: cartões, diagramas e código. */
export const SUPERFICIE = 'rounded-md bg-card shadow-[0_0_0_1px_#463c6d24,0_6px_16px_#463c6d12]';
