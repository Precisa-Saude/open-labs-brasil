import type React from 'react';

/**
 * Fundo abstrato portado do site do fhir-brasil, que por sua vez o portou da
 * /laudos da Precisa. Campo de 1440 × 700 unidades: círculo preenchido, bloco
 * de canto arredondado, contorno deslocado, um conjunto de linhas de
 * movimento, matriz de pontos e um acento coral. As posições são fixas para a
 * composição não mudar entre renderizações.
 */
export interface PropsDoFundoDeSecao {
  cx?: number;
  cy?: number;
  espelhado?: boolean;
  /** Troca lavanda por menta no círculo principal. */
  menta?: boolean;
  /** Intensidade do conjunto no desktop. */
  opacidade?: number;
}

const DESLOCAMENTOS_DAS_LINHAS = [32, 4, 57, 19, 71, 0, 43];
const CORES_DOS_FRAGMENTOS = ['#463C6D', '#8E8BD8', '#9EF2E2'];

export function FundoDeSecao({
  cx = 1210,
  cy = 430,
  espelhado,
  menta,
  opacidade = 0.72,
}: PropsDoFundoDeSecao) {
  return (
    <svg
      aria-hidden="true"
      className={espelhado ? 'brand-backdrop brand-backdrop-flip' : 'brand-backdrop'}
      focusable="false"
      preserveAspectRatio="xMidYMax slice"
      style={{ '--backdrop-opacity': opacidade } as React.CSSProperties}
      viewBox="0 0 1440 700"
    >
      <g transform={espelhado ? 'translate(1440 0) scale(-1 1)' : undefined}>
        <circle cx={cx} cy={cy} fill={menta ? '#9EF2E2' : '#8E8BD8'} r="300" />
        <path
          d={`M${cx - 120} ${cy + 110}h360v280h-180a180 180 0 0 1-180-180Z`}
          fill={menta ? '#8E8BD8' : '#9EF2E2'}
        />
        <circle cx={cx - 120} cy={cy + 25} fill="none" r="350" stroke="#8E8BD8" strokeWidth="2" />
        <g fill="#463C6D">
          {Array.from({ length: 20 }, (_, i) => (
            <circle key={i} cx={1320 + (i % 4) * 15} cy={100 + Math.floor(i / 4) * 15} r="2.5" />
          ))}
        </g>
        <g>
          {DESLOCAMENTOS_DAS_LINHAS.map((deslocamento, linha) => (
            <g key={linha} transform={`translate(${990 + deslocamento} ${178 + linha * 15})`}>
              <path d="M0 3h410" opacity=".2" stroke="#8E8BD8" strokeWidth="1" />
              {Array.from({ length: 10 }, (_, coluna) => (
                <rect
                  key={coluna}
                  fill={CORES_DOS_FRAGMENTOS[(coluna + linha * 2) % 3]}
                  height={2 + ((coluna + linha) % 3) * 2}
                  opacity={0.45 + ((coluna * 3 + linha) % 4) * 0.15}
                  width={8 + ((coluna * 7 + linha * 11) % 27)}
                  x={coluna * 40 + ((coluna * 17 + linha * 23 + coluna * linha * 7) % 23) - 11}
                  y={(coluna % 2) * 2}
                />
              ))}
            </g>
          ))}
        </g>
        <circle cx="1400" cy="310" fill="#F47A5C" r="9" />
      </g>
    </svg>
  );
}
