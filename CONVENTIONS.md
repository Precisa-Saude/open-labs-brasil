# Convenções

## Formato de commit

[Conventional Commits](https://www.conventionalcommits.org):

```
tipo(escopo): descrição curta

corpo opcional mais longo

BREAKING CHANGE: notas (opcional)
```

**Tipos**: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `build`, `ci`, `revert`

**Escopos**: `especificacao`, `registro`, `servidor`, `suite`, `ambiente`, `ferramentas`, `docs`, `ci`, `deps`, `lint`, `config`, declarados em `.commitlintrc.cjs`.

**Idioma**: a descrição do commit é escrita em pt-BR; o tipo permanece em inglês, como manda o Conventional Commits.

**Atribuição de IA**: não inclua linhas como `Co-Authored-By: Claude`, `Generated with Claude` ou similares. O hook `commit-msg` bloqueia esses padrões.

## Versão da especificação

A versão da especificação não sai dos commits. Ela fica no índice, no README, na seção 9.1 e no [CHANGELOG.md](CHANGELOG.md), e muda pelo processo do [GOVERNANCE.md](GOVERNANCE.md). Um `feat` nas ferramentas não muda a versão do protocolo.

## Estilo de código

- TypeScript estrito, com `noUncheckedIndexedAccess`, executado direto pelo Node (sem compilação)
- Módulos ESM, importações com a extensão `.ts`
- Nomes em português, como no resto do código
- Formatação pelo Prettier (`@precisa-saude/prettier-config`: 100 colunas, aspas simples, ponto e vírgula, vírgula final)
- Regras do ESLint pelo `@precisa-saude/eslint-config`, com as exceções do repositório em `eslint.config.js`
- Imports ordenados por `eslint-plugin-simple-import-sort`; interfaces e objetos ordenados por `eslint-plugin-perfectionist`
- O Prettier não formata `especificacao/`, `docs/` nem `GOVERNANCE.md` (veja `.prettierignore`)

## Testes

Vitest, sem piso de cobertura. A evidência de que as ferramentas testam o que dizem é outra: a suíte de conformidade passa contra o servidor de exemplo, e cada violação deliberada em `servidor-de-exemplo/violacoes.ts` faz o requisito correspondente reprovar. Correção de defeito começa com um teste que falha.

## Regras de dependências

- Dependências de execução: só `jose` e `ajv`
- Qualquer outra dependência externa precisa de aprovação explícita no PR
