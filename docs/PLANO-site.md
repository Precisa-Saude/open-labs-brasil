# Plano: página de apresentação do Open Labs Brasil

2026-11-18. O fhir-brasil e o medbench-brasil têm página própria, e o Open Labs Brasil só tinha o README. A página segue a linguagem visual do site do fhir-brasil (grade, tipografia Margem e Pausa, fundo geométrico, encerramento em roxo) e fica em `site/`.

## Objetivo

Uma página única que explica o protocolo para engenharia e segurança de laboratórios e para quem escreve aplicativos, e manda cada leitor ao documento certo do repositório.

## Critérios de aceite desta primeira etapa

| Critério | Como se confere |
| --- | --- |
| A página tem abertura, jornada do paciente, o que o laboratório constrói, escopos, base legal e controles, ferramentas, e situação e governança | `pnpm site` e abrir `http://localhost:4322/` |
| Nenhum número digitado à mão: a versão e a data saem de `especificacao/00-indice.md`, e o resultado da suíte, de `docs/cobertura-de-requisitos.md` | `site/src/dados/situacao.ts`; a compilação falha se a frase mudar de forma |
| Os exemplos de requisição e resposta são os blocos do capítulo 5, lidos na compilação, e cada aba aponta para a seção de origem | `site/src/dados/exemplos.ts`; a compilação falha se a seção ou o bloco sumir |
| Toda afirmação da página está no README, na especificação ou na apresentação para laboratórios | Leitura lado a lado |
| A página monta sem erro no console e sem rolagem horizontal em 1440 px e em 390 px | Verificação com navegador sem interface |
| `pnpm build` compila o site, e `pnpm lint`, `pnpm format:check` e `pnpm typecheck` passam com o site incluído | Saída dos comandos |
| Nenhum travessão no texto da página | Busca pelos caracteres U+2014 e U+2013 em `site/` |

## Fora desta etapa

- Domínio próprio. Decidido em 2026-11-18 que o site fica em https://open-labs-brasil.pages.dev/, no Cloudflare Pages, como o datasus-viz, publicado por `.github/workflows/site.yml` a cada mudança na `main` que toque o site ou os arquivos de onde ele lê números.
- Versão em inglês.
- Revisão de desenho, que é do mantenedor, no navegador.

## Situação

Feitos: revisão da página, primeira publicação (#13 e #14) e imagem de compartilhamento.

A imagem de compartilhamento (`site/public/imagem-de-compartilhamento.png`, 1200 × 630) é desenhada com os componentes da página em `site/compartilhamento.html`, que só existe no servidor de desenvolvimento. Como regenerar o PNG está em `site/src/compartilhamento.tsx`. Quando o título da abertura mudar, a imagem precisa ser gerada de novo.
