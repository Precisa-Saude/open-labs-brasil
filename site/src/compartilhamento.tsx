import './index.css';

import { FlaskConical } from 'lucide-react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { FundoDeSecao } from './components/marca/FundoDeSecao';

/**
 * Imagem de compartilhamento (Open Graph), 1200 × 630, desenhada com as peças
 * da página. Para gerar o PNG, com `pnpm site` rodando:
 *
 *   chromium --headless --hide-scrollbars --window-size=1200,630 \
 *     --screenshot=site/public/imagem-de-compartilhamento.png \
 *     http://localhost:4322/compartilhamento.html
 *
 * Qualquer Chromium serve, inclusive o do Playwright. Espere as fontes
 * carregarem (`--virtual-time-budget=5000`) para o título sair em Pausa.
 */
function ImagemDeCompartilhamento() {
  return (
    <div className="relative isolate flex h-[630px] w-[1200px] flex-col justify-between overflow-hidden bg-primary p-[72px] text-primary-foreground">
      <FundoDeSecao cx={1340} cy={470} menta opacidade={0.6} />
      <p className="relative inline-flex items-center gap-2.5 font-margem text-[30px] font-semibold tracking-tight">
        <FlaskConical aria-hidden="true" className="size-9 text-ps-violet" />
        Open Labs Brasil
      </p>
      <h1 className="relative max-w-[20ch] font-serif text-[72px] leading-[1.06] font-light tracking-[-0.025em]">
        Dados do laboratório sob <em className="brand-highlight">controle do paciente</em>
      </h1>
      <p className="relative font-sans text-[20px] font-semibold tracking-[0.1em] text-primary-foreground/80 uppercase">
        Protocolo aberto · FAPI 2.0 · FHIR R4
      </p>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ImagemDeCompartilhamento />
  </StrictMode>,
);
