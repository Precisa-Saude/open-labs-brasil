# Contribuindo

Obrigado por considerar contribuir com o Open Labs Brasil.

## Que tipo de mudança

| Mudança                                                                        | Como entra                                                                                                                                            |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Comportamento do protocolo: escopo, campo, código de erro, fluxo, regra `DEVE` | Proposta em issue, prazo de comentário e decisão, conforme a seção 4 do [GOVERNANCE.md](GOVERNANCE.md). O texto entra depois, por PR que cita a issue |
| Correção editorial da especificação, sem efeito no comportamento               | PR direto                                                                                                                                             |
| Ambiguidade achada ao implementar                                              | Issue, ou um item em `docs/pontos-da-especificacao.md` com a leitura adotada                                                                          |
| Servidor de exemplo, suíte de conformidade, ferramentas                        | PR direto                                                                                                                                             |
| Falha de segurança                                                             | Em privado, pelos canais do [SECURITY.md](SECURITY.md)                                                                                                |

Mudança na especificação atualiza a versão do documento e ganha entrada no [CHANGELOG.md](CHANGELOG.md), dizendo se muda o comportamento do provedor, do receptor ou de nenhum dos dois.

## Desenvolvimento

Node 22.18 ou mais novo, pnpm 10.33.0 e o `openssl` do sistema.

```bash
pnpm install
pnpm verificar   # lint, formatação, tipos, testes, suíte de conformidade e links
```

Os comandos isolados são `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test` e `pnpm conferir` (suíte de conformidade contra o servidor de exemplo e conferência de links). Os testes usam portas fixas, então rode um processo de testes por vez na mesma máquina. Como usar o servidor de exemplo e a suíte está em [docs/servidor-e-suite.md](docs/servidor-e-suite.md).

Correção de defeito começa com um teste que falha no `main`. Conferência nova ou mais estrita na suíte vem com uma violação deliberada em `servidor-de-exemplo/violacoes.ts` que a faz reprovar.

## Fluxo

1. Branch a partir de `main` (ou fork)
2. PR com critérios de aceite e a evidência de cada um. Pushes diretos para `main` não são permitidos
3. CI verde
4. Revisão e integração pelo editor, conforme o [GOVERNANCE.md](GOVERNANCE.md)

Commits seguem [Conventional Commits](https://www.conventionalcommits.org), com a descrição em pt-BR e o tipo em inglês. Os escopos válidos estão em `.commitlintrc.cjs`. Detalhes em [CONVENTIONS.md](CONVENTIONS.md).

## Licença das contribuições

Quem contribui licencia a contribuição nos mesmos termos do repositório: texto da especificação e documentação sob CC BY 4.0, código e artefatos legíveis por máquina sob Apache 2.0 ([GOVERNANCE.md](GOVERNANCE.md), seção 11).

## Dependências

Pergunte antes de adicionar dependência de execução. Hoje são duas, `jose` e `ajv`. Na descrição do PR, explique o que o pacote faz, por que é necessário e por que as existentes não bastam.

## Assinatura

Todos os commits devem ser assinados via GPG. O hook `commit-msg` bloqueia atribuições de IA (`Co-Authored-By: Claude` e similares).
