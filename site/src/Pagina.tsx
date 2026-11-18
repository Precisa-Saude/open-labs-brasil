import { GridOverlay } from '@precisa-saude/ui/decorative';

import { Abertura } from './components/Abertura';
import { Cabecalho } from './components/Cabecalho';
import { Controles } from './components/Controles';
import { Escopos } from './components/Escopos';
import { Ferramentas } from './components/Ferramentas';
import { Jornada } from './components/Jornada';
import { OQueOLaboratorioConstroi } from './components/OQueOLaboratorioConstroi';
import { Rodape } from './components/Rodape';
import { Situacao } from './components/Situacao';

export function Pagina() {
  return (
    <div className="min-h-screen overflow-x-hidden">
      <Cabecalho />
      <main>
        <Abertura />
        <Jornada />
        <OQueOLaboratorioConstroi />
        <Escopos />
        <Controles />
        <Ferramentas />
        <Situacao />
      </main>
      <Rodape />
      <GridOverlay enabled={import.meta.env.DEV} />
    </div>
  );
}
