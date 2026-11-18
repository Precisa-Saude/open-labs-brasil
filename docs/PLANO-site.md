# Plano: página de apresentação do Open Labs Brasil

2026-11-18. O fhir-brasil e o medbench-brasil têm página própria, e o Open Labs Brasil só tinha o README. A página segue a linguagem visual do site do fhir-brasil (grade, tipografia Margem e Pausa, fundo geométrico, encerramento em roxo) e fica em `site/`.

## Objetivo

Uma página única que explica o protocolo para engenharia e segurança de laboratórios e para quem escreve aplicativos, e manda cada leitor ao documento certo do repositório.

## Critérios de aceite desta primeira etapa

| Critério | Como se confere |
| --- | --- |
| A página tem abertura, jornada do paciente, o que o laboratório constrói, escopos, base legal e controles, ferramentas, e situação e governança | `pnpm site` e abrir `http://localhost:4322/` |
| Nenhum número digitado à mão: a versão e a data saem de `especificacao/00-indice.md`, e o resultado da suíte, de `docs/cobertura-de-requisitos.md` | `site/src/dados/situacao.ts`; a compilação falha se a frase mudar de forma |
| Toda afirmação da página está no README, na especificação ou na apresentação para laboratórios | Leitura lado a lado |
| A página monta sem erro no console e sem rolagem horizontal em 1440 px e em 390 px | Verificação com navegador sem interface |
| `pnpm build` compila o site, e `pnpm lint`, `pnpm format:check` e `pnpm typecheck` passam com o site incluído | Saída dos comandos |
| Nenhum travessão no texto da página | Busca pelos caracteres U+2014 e U+2013 em `site/` |

## Fora desta etapa

- Domínio próprio. Por enquanto o site fica no GitHub Pages, em https://precisa-saude.github.io/open-labs-brasil/, publicado por `.github/workflows/site.yml` a cada mudança na `main` que toque o site ou os arquivos de onde ele lê números.
- Imagem de compartilhamento (Open Graph) e ícones em PNG. Só há o `favicon.svg`.
- Versão em inglês.
- Revisão de desenho, que é do mantenedor, no navegador.

## Próximos passos

1. Revisão da página no navegador.
2. Conferir a primeira publicação no GitHub Pages depois do merge.
3. Imagem de compartilhamento.
4. Domínio próprio, quando houver.
