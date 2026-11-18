import { useId } from 'react';

/**
 * Diagrama de sequência em SVG, com as cores do tema. Desenha participantes
 * em colunas, linhas de vida tracejadas e uma mensagem por linha, numerada na
 * margem esquerda. As mesmas etapas viram lista abaixo de `lg`, onde o
 * diagrama ficaria pequeno demais para ler.
 */

export interface Participante {
  nome: string;
  papel: string;
}

export type Etapa =
  | {
      de: number;
      /** Mensagem em destaque menta: o passo que a página quer que se veja. */
      destaque?: boolean;
      para: number;
      /** Resposta: linha tracejada, como no Mermaid. */
      resposta?: boolean;
      rotulo: string;
    }
  | { em: number; nota: string };

const LARGURA = 760;
const MARGEM_DOS_NUMEROS = 40;
const LARGURA_DA_CAIXA = 160;
const ALTURA_DA_CAIXA = 52;
const INICIO = 104;
const PASSO = 42;
const LARGURA_POR_CARACTERE = 6.4;

const COR_DA_LINHA = 'color-mix(in oklab, var(--foreground) 55%, transparent)';
const COR_SECUNDARIA = 'color-mix(in oklab, var(--foreground) 70%, transparent)';

function centroDaColuna(indice: number, total: number): number {
  const util = LARGURA - MARGEM_DOS_NUMEROS;
  return MARGEM_DOS_NUMEROS + (util / total) * (indice + 0.5);
}

export interface PropsDoDiagramaDeSequencia {
  /** Descrição longa, lida por leitores de tela. */
  descricao: string;
  etapas: readonly Etapa[];
  participantes: readonly Participante[];
  titulo: string;
}

export function DiagramaDeSequencia({
  descricao,
  etapas,
  participantes,
  titulo,
}: PropsDoDiagramaDeSequencia) {
  // Só letras, dígitos, `_` e `-` entram no id referenciado por `url(#…)`.
  const id = useId().replace(/[^\w-]/g, '');
  const altura = INICIO + etapas.length * PASSO;
  const x = (indice: number) => centroDaColuna(indice, participantes.length);
  let numero = 0;

  return (
    <svg
      aria-describedby={`${id}-descricao`}
      aria-labelledby={`${id}-titulo`}
      className="block h-auto w-full"
      role="img"
      style={{ fontFamily: 'var(--font-sans)' }}
      viewBox={`0 0 ${LARGURA} ${altura}`}
    >
      <title id={`${id}-titulo`}>{titulo}</title>
      <desc id={`${id}-descricao`}>{descricao}</desc>
      <defs>
        {(['comum', 'destaque'] as const).map((tipo) => (
          <marker
            key={tipo}
            id={`${id}-seta-${tipo}`}
            markerHeight="8"
            markerUnits="userSpaceOnUse"
            markerWidth="8"
            orient="auto"
            refX="7"
            refY="4"
            viewBox="0 0 8 8"
          >
            <path
              d="M0 0 L8 4 L0 8 Z"
              fill={tipo === 'destaque' ? 'var(--primary)' : COR_DA_LINHA}
            />
          </marker>
        ))}
      </defs>

      {participantes.map((participante, i) => (
        <g key={participante.nome + participante.papel}>
          <line
            stroke="var(--border)"
            strokeDasharray="3 4"
            strokeWidth="1.25"
            x1={x(i)}
            x2={x(i)}
            y1={8 + ALTURA_DA_CAIXA}
            y2={altura - 8}
          />
          <rect
            fill={i === 0 ? 'color-mix(in oklab, var(--ps-mint) 55%, var(--card))' : 'var(--card)'}
            height={ALTURA_DA_CAIXA}
            rx="10"
            stroke={
              i === 0
                ? 'color-mix(in oklab, var(--ps-mint) 70%, var(--foreground))'
                : 'var(--ps-violet)'
            }
            strokeWidth="1.25"
            width={LARGURA_DA_CAIXA}
            x={x(i) - LARGURA_DA_CAIXA / 2}
            y={8}
          />
          <text textAnchor="middle">
            <tspan fill="var(--foreground)" fontSize="13.5" fontWeight={600} x={x(i)} y={30}>
              {participante.nome}
            </tspan>
            <tspan fill={COR_SECUNDARIA} fontSize="12" x={x(i)} y={47}>
              {participante.papel}
            </tspan>
          </text>
        </g>
      ))}

      {etapas.map((etapa, linha) => {
        const y = INICIO + linha * PASSO;

        if ('nota' in etapa) {
          const largura = etapa.nota.length * LARGURA_POR_CARACTERE + 28;
          return (
            <g key={`nota-${linha}`}>
              <rect
                fill="color-mix(in oklab, var(--ps-violet) 14%, var(--card))"
                height="26"
                rx="6"
                stroke="var(--ps-violet)"
                strokeWidth="1"
                width={largura}
                x={x(etapa.em) - largura / 2}
                y={y - 17}
              />
              <text
                fill="var(--foreground)"
                fontSize="12"
                fontStyle="italic"
                textAnchor="middle"
                x={x(etapa.em)}
                y={y}
              >
                {etapa.nota}
              </text>
            </g>
          );
        }

        numero += 1;
        const inicio = x(etapa.de);
        const fim = x(etapa.para);
        const sentido = fim > inicio ? 1 : -1;
        const meio = (inicio + fim) / 2;
        const larguraDoRotulo = etapa.rotulo.length * LARGURA_POR_CARACTERE + 14;
        const cor = etapa.destaque ? 'var(--primary)' : COR_DA_LINHA;

        return (
          <g key={`etapa-${linha}`}>
            <circle cx="16" cy={y} fill="var(--primary)" r="10" />
            <text
              fill="var(--primary-foreground)"
              fontSize="11"
              fontWeight={600}
              textAnchor="middle"
              x="16"
              y={y + 4}
            >
              {numero}
            </text>
            <line
              markerEnd={`url(#${id}-seta-${etapa.destaque ? 'destaque' : 'comum'})`}
              stroke={cor}
              strokeDasharray={etapa.resposta ? '5 4' : undefined}
              strokeWidth={etapa.destaque ? 2 : 1.5}
              x1={inicio + sentido * 4}
              x2={fim - sentido * 2}
              y1={y + 6}
              y2={y + 6}
            />
            <rect
              fill={
                etapa.destaque
                  ? 'color-mix(in oklab, var(--ps-mint) 55%, var(--card))'
                  : 'var(--card)'
              }
              height="20"
              rx="10"
              width={larguraDoRotulo}
              x={meio - larguraDoRotulo / 2}
              y={y - 18}
            />
            <text
              fill="var(--foreground)"
              fontSize="12"
              fontWeight={etapa.destaque ? 600 : 400}
              textAnchor="middle"
              x={meio}
              y={y - 4}
            >
              {etapa.rotulo}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
