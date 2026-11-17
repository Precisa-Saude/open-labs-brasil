# Plano: servidor de exemplo e suíte de conformidade

Ticket: PRE-575. Versão da especificação: 0.2.1 (protocolo `0.2`, caminho `/v0`, formato do registro `0.1`).

Este arquivo define o que conta como pronto antes de qualquer código. Cada critério diz o comportamento observável, o comando que o prova e o que fica de fora. A situação de cada um é atualizada no fim, com a evidência.

## Disposição do código

O README diz que ferramentas e a suíte de conformidade ficam sob a Apache License 2.0, sem fixar pasta. A proposta, registrada também no README:

| Pasta | Conteúdo |
| --- | --- |
| `servidor-de-exemplo/` | Provedor de dados simulado: servidor de autorização, endpoints de consentimento, API FHIR, páginas do paciente e interface de controle de teste |
| `suite-de-conformidade/` | Executor dos requisitos de provedor do capítulo 9, receptor mínimo e teste de ponta a ponta |
| `ambiente-local/` | Gerador da PKI de teste e do registro de participantes local assinado |
| `comum/` | Código usado pelos três: CPF, verificação do registro (V1 a V14), negociação de versão |

Um único `package.json` na raiz, com `pnpm-lock.yaml`. Node 22.18 ou mais novo, que executa TypeScript diretamente (remoção de tipos), sem etapa de compilação.

## Critérios de aceite

### 1. Servidor de exemplo

Comportamento: um provedor que implementa a 0.2.1 como está escrita.

- Servidor de autorização FAPI 2.0: PAR obrigatório, PKCE S256, `private_key_jwt` só com PS256, tokens vinculados ao certificado por mTLS, `iss` na resposta de autorização, metadados em `/.well-known/oauth-authorization-server` com os 14 campos da seção 5.2.
- Endpoints de consentimento com os cinco estados, as transições T1 a T15, o prazo de 60 minutos, a expiração, a revogação pelos dois lados e o modo restrito de 7 dias com registro expirado.
- Página de login e aprovação claramente de teste, com pacientes sintéticos de CPF fictício com dígitos verificadores válidos, inclusive um paciente sem CPF.
- API FHIR R4 para todos os escopos: catálogo e preços nos três alcances, unidades, serviços, agendas, horários, agendamento com pedidos contidos e criação condicional, remarcação, cancelamento, resultados, paciente e registros de consentimento. Paginação dentro do `fhir_base_url`. Erros com `OperationOutcome` e os códigos do capítulo 6.
- Dados sintéticos no formato dos perfis do guia (`https://fhir-brasil.dev.br/ig/StructureDefinition/`).
- Modo de violações deliberadas, em que cada violação quebra uma regra conhecida.

Prova: `pnpm test` (testes do servidor) e o critério 4, que exercita o servidor por fora.

Fora do escopo: persistência em disco (tudo em memória), alta disponibilidade, interface de administração além da interface de controle de teste, validação com o validador FHIR oficial.

### 2. PKI de teste e registro local

Comportamento: um comando cria uma autoridade certificadora de teste, certificados de servidor e de cliente, chaves de assinatura dos receptores e um registro de participantes `pilot` assinado conforme a seção 8.3. O registro gerado passa nos catorze passos V1 a V14, com V1 feito por HTTPS de verdade.

Prova: `pnpm ambiente:gerar` e o teste `ambiente-local/registro-local.test.ts` (dentro de `pnpm test`), que imprime o resultado de cada passo.

Fora do escopo: certificados ICP-Brasil, revogação de certificado, chaves fora de arquivo.

### 3. Imagem de contêiner

Comportamento: um `Dockerfile` que instala as dependências de produção e executa o servidor de exemplo. Nada é publicado em registro de imagens.

Prova: `docker build -t open-labs-brasil/servidor-de-exemplo .`, se o Docker estiver disponível nesta máquina. Se não estiver, o relatório diz que a imagem não foi construída.

Fora do escopo: publicação, orquestração, imagem da suíte.

### 4. Suíte de conformidade

Comportamento: um executor que um laboratório aponta para o próprio provedor por configuração (registro, chaves iniciais, credenciais dos clientes de teste, pacientes de teste e, opcionalmente, a interface de controle de teste). Cada requisito de provedor do capítulo 9 (prefixos REG, SEG, AUT, CNS, API, CAT, UNI, AGE, AGD, RES, ERR) é um teste com o identificador do requisito, que termina em `aprovado`, `reprovado` ou `não verificável automaticamente`, sempre com o motivo.

- Contra o servidor de exemplo, nenhum teste termina `reprovado`.
- Testes negativos: para cada violação do modo de violações, a suíte é executada contra o servidor com aquela violação, e o teste do requisito correspondente termina `reprovado`. Uma suíte que sempre aprova não passa nesse teste.

Prova:

- `pnpm conformidade:local`: gera o ambiente local se faltar, sobe o servidor de exemplo, executa a suíte inteira e imprime a tabela. Código de saída 0 só sem reprovação.
- `pnpm test`: inclui `suite-de-conformidade/testes/violacoes.test.ts`.

Fora do escopo: requisitos do receptor (RCP), que pedem um provedor de teste controlado pela suíte. Ficam listados na tabela de cobertura como fora desta entrega.

### 5. Jornada de ponta a ponta

Comportamento: um receptor mínimo, escrito dentro da suíte e sem depender do pacote cliente do fhir-brasil, conecta o paciente (consentimento, PAR, login e aprovação na página do provedor, troca do código, conferência do CPF), vê preços e horários, agenda, paga na página simulada, cancela e revoga. Os tokens deixam de valer depois da revogação. Uma segunda jornada com CPF divergente termina em revogação com `PATIENT_MISMATCH`.

Prova: `pnpm jornada` (imprime cada passo) e `suite-de-conformidade/testes/jornada.test.ts` dentro de `pnpm test`.

Fora do escopo: aplicativo móvel, navegador real, armazenamento durável da revogação pendente no receptor mínimo.

### 6. Documentação

Comportamento: em pt-BR, como um laboratório roda o servidor de exemplo e a suíte, o formato da configuração, a interface de controle de teste e uma tabela de cobertura com requisito, teste e situação. Uma lista curta dos pontos da especificação que se mostraram ambíguos e da leitura adotada.

Prova: os arquivos `docs/servidor-e-suite.md`, `docs/cobertura-de-requisitos.md` e `docs/pontos-da-especificacao.md`, e `pnpm docs:links`, que confere que todo link relativo dos Markdown aponta para um arquivo existente.

Fora do escopo: alterar os capítulos da especificação.

### Verificações gerais

| Verificação | Comando |
| --- | --- |
| Tipos | `pnpm typecheck` |
| Testes | `pnpm test` |
| Suíte completa contra o servidor de exemplo | `pnpm conformidade:local` |
| Links da documentação | `pnpm docs:links` |

Não há linter configurado: a verificação estática é o `tsc` em modo estrito, para não acrescentar dependências.

## Situação

Atualizada em 2026-11-16, no fim do trabalho, com a evidência de cada critério.

| Critério | Situação | Evidência |
| --- | --- | --- |
| 1. Servidor de exemplo | Cumprido | `pnpm conformidade:local`: 120 aprovados, 0 reprovados, 4 não verificáveis automaticamente (AUT-024, CNS-008, CNS-023, API-008). `servidor-de-exemplo/servidor.test.ts` confere as páginas de login, consentimento e compartilhamentos e os dados sintéticos contra as cardinalidades dos perfis |
| 2. PKI e registro local | Cumprido | `node ambiente-local/gerar.ts --forcar` termina com "verificação V2 V3 ... V14 aprovada"; `ambiente-local/registro-local.test.ts` baixa o registro por HTTPS (V1) e aprova V1 a V14 |
| 3. Imagem de contêiner | Não construída | O Docker não está instalado nesta máquina. O conjunto de arquivos da imagem foi reproduzido numa pasta temporária (mesmos `COPY`, `pnpm install --prod --frozen-lockfile`) e o servidor subiu dali e respondeu os metadados. Falta `docker build` |
| 4. Suíte de conformidade | Cumprido | `pnpm conformidade:local` como acima, em cerca de 10 segundos; `suite-de-conformidade/testes/conformidade.test.ts` confere que os 124 requisitos de provedor em vigor têm teste; `violacoes.test.ts`: 98 violações, cada uma reprova o requisito que viola. Também roda com servidor e suíte em processos separados, duas vezes seguidas contra o mesmo servidor, e sem interface de controle: com a jornada pelas páginas, 103 aprovados, 0 reprovados, 21 não verificáveis; sem jornada nenhuma, 54, 0 e 70 |
| 5. Jornada de ponta a ponta | Cumprido | `pnpm jornada`: 11 passos, de registro verificado até revogação com `PATIENT_MISMATCH`; `suite-de-conformidade/testes/jornada.test.ts` |
| 6. Documentação | Cumprido | [servidor-e-suite.md](servidor-e-suite.md), [cobertura-de-requisitos.md](cobertura-de-requisitos.md), [pontos-da-especificacao.md](pontos-da-especificacao.md); `pnpm docs:links`: 107 links relativos, todos resolvem |
| Verificações gerais | Cumprido | `pnpm verificar` (tipos, 115 testes, suíte local, links) termina com código 0. Suíte e jornada também passam no Node 22.23 |
