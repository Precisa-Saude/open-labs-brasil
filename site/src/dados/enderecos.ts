export const REPOSITORIO = 'https://github.com/Precisa-Saude/open-labs-brasil';

/** Arquivo do ramo principal, no GitHub. */
export function noRepositorio(caminho: string): string {
  return `${REPOSITORIO}/blob/main/${caminho}`;
}

export const ENDERECOS = {
  apresentacao: noRepositorio('docs/apresentacao-para-laboratorios.md'),
  cobertura: noRepositorio('docs/cobertura-de-requisitos.md'),
  escopos: noRepositorio('especificacao/03-escopos.md'),
  fluxos: noRepositorio('especificacao/02-fluxos.md'),
  governanca: noRepositorio('GOVERNANCE.md'),
  indice: noRepositorio('especificacao/00-indice.md'),
  issues: `${REPOSITORIO}/issues`,
  piloto: noRepositorio('docs/roteiro-do-piloto.md'),
  seguranca: noRepositorio('especificacao/07-perfil-de-seguranca.md'),
  servidorESuite: noRepositorio('docs/servidor-e-suite.md'),
} as const;
