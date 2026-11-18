import { Header } from '@precisa-saude/ui';
import { useWideGrid } from '@precisa-saude/ui/hooks';
import { ExternalLink, FlaskConical, Github, Route, ShieldCheck, Wrench } from 'lucide-react';
import { useState } from 'react';

import { REPOSITORIO } from '../dados/enderecos';
import { ESPECIFICACAO } from '../dados/situacao';

const LINKS = [
  { coluna: 5, endereco: '#jornada', icone: Route, rotulo: 'Jornada', vao: 2 },
  { coluna: 7, endereco: '#ferramentas', icone: Wrench, rotulo: 'Ferramentas', vao: 2 },
  { coluna: 9, endereco: '#situacao', icone: ShieldCheck, rotulo: 'Situação', vao: 3 },
] as const;

const logo = (
  <a
    className="inline-flex h-full items-center gap-1.5 font-margem text-xl font-semibold tracking-tight whitespace-nowrap text-primary-foreground"
    href="#"
  >
    <FlaskConical className="h-6 w-6 shrink-0 text-ps-violet" />
    Open Labs Brasil
  </a>
);

const classeDoLinkNoCelular =
  'flex w-full items-center gap-3 rounded-md px-3 py-2.5 font-margem text-base text-foreground transition-colors hover:bg-muted';

export function Cabecalho() {
  const [aberto, setAberto] = useState(false);
  const largo = useWideGrid();
  const deslocamento = largo ? 1 : 0;

  const itens = (
    <>
      {LINKS.map((link) => (
        <a
          key={link.endereco}
          className="hidden h-full items-center justify-center border-b-2 border-transparent font-margem text-base font-medium text-primary-foreground transition-colors hover:border-white lg:flex"
          href={link.endereco}
          style={{ gridColumn: `${link.coluna + deslocamento} / span ${link.vao}` }}
        >
          {link.rotulo}
        </a>
      ))}
    </>
  );

  const acoes = (
    <a
      className="hidden h-10 items-center justify-center gap-1.5 self-center rounded-full border border-white bg-transparent px-3 font-margem text-sm font-medium text-white transition-colors hover:border-ps-mint hover:bg-ps-mint hover:text-primary lg:inline-flex"
      href={REPOSITORIO}
      rel="noopener noreferrer"
      style={{ gridColumn: `${12 + deslocamento} / span 2` }}
      target="_blank"
    >
      GitHub
      <ExternalLink className="h-3.5 w-3.5" />
    </a>
  );

  const itensNoCelular = (
    <div className="flex min-h-0 flex-1 flex-col">
      <button
        aria-label="Voltar ao início"
        className="mb-2 flex cursor-pointer justify-center px-3 py-2"
        onClick={() => {
          setAberto(false);
          window.scrollTo({ behavior: 'smooth', top: 0 });
        }}
      >
        <FlaskConical className="size-8 text-primary" />
      </button>
      <div className="mb-2 border-t border-border" />

      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3">
        {LINKS.map((link) => {
          const Icone = link.icone;
          return (
            <a
              key={link.endereco}
              className={classeDoLinkNoCelular}
              href={link.endereco}
              onClick={() => setAberto(false)}
            >
              <Icone className="size-5" />
              {link.rotulo}
            </a>
          );
        })}
      </div>

      <div className="border-t border-border" />
      <div className="mt-auto px-3 pt-4 pb-4">
        <a
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-primary px-4 py-2.5 font-margem text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
          href={REPOSITORIO}
          rel="noopener noreferrer"
          target="_blank"
        >
          <Github className="size-4" />
          GitHub
          <ExternalLink className="size-3.5" />
        </a>
      </div>

      <div className="border-t border-border" />
      <div
        className="pt-3 pb-6 text-center font-margem text-xs text-muted-foreground"
        style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}
      >
        Especificação {ESPECIFICACAO.versao}
      </div>
    </div>
  );

  return (
    <Header
      actions={acoes}
      className="border-b border-primary-foreground/20 bg-primary"
      containerClassName="mx-auto px-4 md:px-0"
      contentClassName="grid h-16 items-center gap-4"
      iconClassName="text-white"
      isMobileMenuOpen={aberto}
      logo={logo}
      mobileNavItems={itensNoCelular}
      navItems={itens}
      onToggleMobileMenu={setAberto}
    />
  );
}
