# Servidor de exemplo e suíte de conformidade

Ferramentas da especificação 0.2.2 (protocolo `0.2`). Código sob a Apache License 2.0 ([LICENSE](../LICENSE)), este texto sob a CC BY 4.0 ([LICENSE-spec](../LICENSE-spec)).

| Parte | Pasta | Para que serve |
| --- | --- | --- |
| Servidor de exemplo | `servidor-de-exemplo/` | Um provedor de dados simulado que implementa a especificação como está escrita, com dados sintéticos. Serve de referência de comportamento e de alvo para a suíte |
| Suíte de conformidade | `suite-de-conformidade/` | Executa os requisitos de provedor do capítulo 9 contra um provedor qualquer, apontado por configuração |
| Ambiente local | `ambiente-local/` | Gera a PKI de teste, as chaves e o registro de participantes assinado para rodar tudo numa máquina |
| Receptor mínimo | `suite-de-conformidade/receptor-minimo/` | Backend de aplicativo reduzido ao necessário para a jornada de ponta a ponta |
| Código comum | `comum/` | CPF, verificação do registro (V1 a V14), negociação de versão, conferência dos metadados |

Nada aqui é para produção. Laboratório, unidades, pacientes, CPFs, preços e resultados são fictícios. As chaves e os certificados gerados servem só para teste local.

A tabela de cobertura dos requisitos está em [cobertura-de-requisitos.md](cobertura-de-requisitos.md), e os pontos em que a especificação se mostrou ambígua, com a leitura adotada, em [pontos-da-especificacao.md](pontos-da-especificacao.md).

## Começo rápido

Requisitos: Node 22.18 ou mais novo (executa TypeScript direto, sem compilação), pnpm 10 e o `openssl` do sistema, usado só para gerar os certificados de teste.

```sh
pnpm install
pnpm conformidade:local   # gera o ambiente se faltar, sobe o servidor e roda a suíte inteira
pnpm jornada              # jornada de ponta a ponta com o receptor mínimo
pnpm test                 # testes, inclusive os negativos (uma violação de cada vez)
```

`pnpm conformidade:local` termina com código 0 só quando nenhum requisito é reprovado, e grava o relatório em `relatorios/conformidade-servidor-de-exemplo.json`.

Outros comandos:

| Comando | O que faz |
| --- | --- |
| `pnpm ambiente:gerar` | Gera o ambiente local em `ambiente-local/gerado/`, se ainda não existir ou se o registro estiver perto de vencer |
| `pnpm servidor` | Sobe o servidor de exemplo com a configuração do ambiente local |
| `pnpm suite --config <arquivo>` | Roda a suíte contra o provedor da configuração. `--somente AUT-001,CNS-002` filtra, `--relatorio arquivo.json` grava o resultado |
| `pnpm typecheck` | Confere os tipos com o TypeScript em modo estrito |
| `pnpm docs:links` | Confere que todo link relativo dos arquivos Markdown resolve |
| `pnpm lint`, `pnpm format:check` | ESLint e Prettier, com as configurações compartilhadas da Precisa Saúde (`eslint.config.js`, `.prettierrc`) |
| `pnpm conferir` | Suíte local e links |
| `pnpm verificar` | Tudo acima em sequência: lint, formatação, tipos, testes, suíte local e links. A CI roda as mesmas partes em todo PR e em todo push no ramo principal, no Node 22.18, pelo fluxo de verificações compartilhado (`.github/workflows/ci.yml`) |

## Ambiente local

`node ambiente-local/gerar.ts` cria, em `ambiente-local/gerado/` (fora do controle de versão):

| Arquivo | Conteúdo |
| --- | --- |
| `pki/ca.crt`, `pki/ca.key` | Autoridade certificadora de teste |
| `pki/servidor.*` | Certificado TLS do servidor de exemplo (`localhost`, `127.0.0.1` e nomes extras) |
| `pki/hospedagem.*` | Certificado TLS da hospedagem da suíte, que publica o `jwks_uri` dos receptores de teste e o registro |
| `pki/receptor-*.crt`, `pki/receptor-*.key` | Certificados de cliente TLS dos receptores de teste. O receptor A tem dois |
| `pki/nao-registrado.*` | Certificado de cliente válido, emitido pela mesma AC, que não está no registro |
| `chaves/receptor-*.privada.jwk.json` | Chaves de assinatura PS256 dos receptores |
| `chaves/registro.privada.jwk.json` | Chave que assina o registro de teste |
| `hospedagem/receptores/*/jwks.json` | `jwks_uri` público de cada receptor |
| `registro/participantes.json`, `.jws` | Registro `pilot` assinado com JWS destacado (seção 8.3) |
| `registro/chaves-iniciais.json` | Conjunto inicial de chaves do registro |
| `servidor.config.json`, `suite.config.json` | Configurações do servidor e da suíte |

O registro tem um provedor e cinco receptores de teste:

| Receptor | Situação | Uso na suíte |
| --- | --- | --- |
| A, principal | `active`, dois certificados | Quase todos os testes. O segundo certificado prova o vínculo do token (SEG-006) |
| B, secundário | `active` | Isolamento entre clientes (CNS-021, SEG-005, RES-009) |
| C, sentinela | `active` | Observar se o provedor aceitou um candidato do registro (REG) |
| D | `suspended` | AUT-023 |
| E | `withdrawn` | AUT-023 |

O gerador confere V2 a V14 sobre o registro que acabou de escrever. O teste `ambiente-local/registro-local.test.ts` faz a verificação completa, com V1 por HTTPS e o certificado do servidor validado contra a AC de teste.

Opções: `--forcar` (gera de novo), `--se-faltar`, `--host`, `--host-hospedagem`, `--nome-extra` (nomes a mais nos certificados de servidor), `--endereco-de-escuta` (0.0.0.0 para contêiner), `--porta-publica 8443`, `--porta-mtls 8444`, `--porta-controle 8445`, `--porta-hospedagem 9443`.

O registro gerado vale 30 dias. Depois disso, gere de novo com `--forcar`.

## Servidor de exemplo

```sh
pnpm servidor
```

Endereços, todos lidos do registro de participantes:

| Endereço | Serve | mTLS |
| --- | --- | --- |
| `https://localhost:8443/.well-known/oauth-authorization-server` | Metadados (seção 5.2) | Não |
| `https://localhost:8443/authorize` | Autorização, login e tela de consentimento | Não |
| `https://localhost:8443/jwks` | Chaves do servidor de autorização | Não |
| `https://localhost:8443/minha-conta/compartilhamentos` | Página de consentimentos do paciente (`consent_management_uri`) | Não |
| `https://localhost:8443/pagamento/{token}` | Página de pagamento simulado | Não |
| `https://localhost:8444/par`, `/token`, `/revoke` | PAR, token, revogação de token | Sim |
| `https://localhost:8444/acesso/v0/consents` | Endpoints de consentimento (`api_base_url`) | Sim |
| `https://localhost:8444/fhir/r4` | API FHIR R4 (`fhir_base_url`) | Sim |
| `http://127.0.0.1:8445/_controle` | Interface de controle de teste | Não, só local, com token |

O servidor pede o certificado de cliente no host mTLS e o confere contra o registro na aplicação, para poder responder com o `OperationOutcome` da seção 6.3.1 em vez de cortar o aperto TLS.

### Pacientes sintéticos

A página de login lista os pacientes de teste. A senha de todos é `teste`.

| Usuário | Paciente | CPF fictício | Para que serve |
| --- | --- | --- | --- |
| `ana` | Ana Exemplo Sintética, `pac-ana` | 529.982.247-25 (o mesmo do exemplo da seção 5.4.2) | Paciente principal: laudos liberados, um parcial, um retido, um antigo, agendamento feito por outro canal |
| `bruno` | Bruno Exemplo Sintético, `pac-bruno` | 111.444.777-35 | Outro paciente, para testes de isolamento e de CPF divergente |
| `carla` | Carla Sem CPF Sintética, `pac-carla` | (sem CPF, CNS provisório) | Paciente sem CPF (T5, CNS-011) |
| `diego` | Diego CPF Inválido Sintético, `pac-diego` | `00000000000` no cadastro | CPF de preenchimento, que passa nos dígitos e é inválido pela seção 4.4: tratado como sem CPF (CNS-025) |

### Dados sintéticos

No formato dos perfis do guia (`https://fhir-brasil.dev.br/ig/StructureDefinition/`): 27 itens de catálogo (com LOINC e com código próprio, um combo sem LOINC, um exame só com horário até as 8h, um exame coletado só numa unidade, um item gratuito e um retirado), preços por município, por unidade e por marca e região, três unidades e uma região de preço, serviços de coleta, agendas e horários de 15 minutos nos dias úteis dos próximos 21 dias (a agenda acompanha o relógio do servidor), laudos e resultados com LOINC e UCUM.

### Interface de controle de teste

Não faz parte do protocolo. É o que permite, num ambiente de homologação, fazer o que o capítulo 9 descreve como "no ambiente de teste": adiantar o relógio, concluir a jornada do paciente sem um navegador, pagar, retirar um item do catálogo, retificar um laudo, pedir ao provedor que busque o registro. Um laboratório que implementar a mesma interface no próprio ambiente de homologação deixa a suíte verificar quase tudo automaticamente.

Todas as chamadas levam `Authorization: Bearer {token}` (o `controle.token` da configuração) e corpo JSON.

| Operação | Corpo | Resposta |
| --- | --- | --- |
| `GET /_controle/estado` | | `agora` e `agora_ms` (relógio do provedor), `sequencia_do_registro`, `registro_expira_em`, `modo_do_registro` (`normal`, `restrito` ou `bloqueado`) |
| `POST /_controle/relogio` | `{"avancar_segundos": 3600}` | Estado depois de adiantar. O relógio só anda para a frente |
| `POST /_controle/registro/recarregar` | | Busca o registro agora (V1 a V14). `aceito`, `passo` e `motivo` quando recusa. A suíte não decide nada por essa resposta: ela observa o comportamento |
| `POST /_controle/jornada` | `{"client_id", "request_uri", "usuario", "senha", "decisao": "aprovar"}` | O paciente de teste entra e decide. `{"status": 303, "location": "..."}` como o redirecionamento que o navegador receberia, ou `{"status": 400, "pagina_de_erro": "..."}` |
| `POST /_controle/revogar-pelo-paciente` | `{"consent_id"}` | Revogação pela página do provedor (T10) |
| `POST /_controle/pagamento` | `{"appointment_id"}` | Pagamento confirmado: o agendamento passa a `booked` |
| `POST /_controle/catalogo/retirar` | `{"id"}` | `ActivityDefinition` passa a `retired` |
| `POST /_controle/resultados/retificar` | `{"id"}` | `DiagnosticReport` passa a `corrected`, com nova versão |
| `POST /_controle/indisponibilidade` | `{"ativo": true}` | APIs e token respondem 503 com `Retry-After` até `{"ativo": false}` |

### Modo de violações

`servidor-de-exemplo/violacoes.ts` lista 109 regras que o servidor pode quebrar de propósito, cada uma com os requisitos que ela viola. `node servidor-de-exemplo/principal.ts --listar-violacoes` mostra a lista, e `pnpm servidor -- --violacao par-sem-pkce` sobe o servidor com uma delas. O teste `suite-de-conformidade/testes/violacoes.test.ts` sobe o servidor com uma violação de cada vez e exige que a suíte reprove o requisito correspondente. É o que prova que a suíte não aprova qualquer coisa.

### Contêiner

O `Dockerfile` da raiz constrói uma imagem só com o servidor de exemplo. O ambiente é gerado fora da imagem e montado em `/ambiente`. A imagem não é publicada em nenhum registro de imagens.

```sh
pnpm ambiente:gerar -- --forcar --endereco-de-escuta 0.0.0.0 \
  --host-hospedagem host.docker.internal --nome-extra host.docker.internal
docker build -t open-labs-brasil/servidor-de-exemplo .
docker run --rm -p 8443:8443 -p 8444:8444 -p 8445:8445 \
  --add-host host.docker.internal:host-gateway \
  -v "$PWD/ambiente-local/gerado:/ambiente:ro" open-labs-brasil/servidor-de-exemplo
pnpm suite --config ambiente-local/gerado/suite.config.json
```

`--host-hospedagem host.docker.internal` é necessário porque o servidor, dentro do contêiner, busca o `jwks_uri` dos receptores e o registro na hospedagem da suíte, que roda fora dele.

## Suíte de conformidade

### O que ela verifica

Os requisitos de provedor do capítulo 9 (prefixos REG, SEG, AUT, CNS, API, CAT, UNI, AGE, AGD, RES e ERR): 132 em vigor na 0.2.2. Cada um é um teste com o próprio identificador, que termina em:

| Situação | Quando |
| --- | --- |
| `aprovado` | Todas as conferências passaram |
| `reprovado` | Alguma conferência falhou. O motivo diz qual, com a resposta do provedor |
| `não verificável automaticamente` | O requisito, ou parte dele, pede inspeção humana, o validador FHIR, ou um recurso que a configuração não tem (por exemplo a interface de controle). O motivo diz qual. Se uma parte verificável falha, o resultado é `reprovado` |

Contra o servidor de exemplo, quatro ficam como não verificáveis: AUT-024, CNS-008 e CNS-023, que o capítulo 9 diz dependerem de olhar telas, e API-008, porque a validação completa contra os perfis pede o validador FHIR com o guia. A suíte confere o que dá para conferir nesses quatro (`meta.profile` e as cardinalidades mínimas de cada perfil; que login e consentimento ficam no domínio do provedor; que a tela de consentimento mostra o nome do receptor como está no registro e a finalidade sem alteração; que a página de consentimentos responde) e reprova se algo disso falha. Os textos dos escopos, a data de expiração e o aviso do CPF admitem redação do provedor e ficam para inspeção.

Na 0.2.2 a suíte passou a conferir também: `crit` recusado e `typ` ou membros a mais aceitos no cabeçalho do registro (REG-011), versão efetiva que o software não implementa (REG-012), troca de código com o registro expirado (REG-013), CPF inválido no cadastro (CNS-025), `DELETE` repetido e concorrente (CNS-026), links de paginação absolutos `https` sem componente de usuário (API-013), contextos de preço (CAT-005) e o teto de 86400 segundos de `Retry-After` na revogação (ERR-007). Os links relativos que um provedor da 0.2.0 ou 0.2.1 ainda emita são resolvidos contra a URL da requisição antes da conferência de API-012, como a seção 5.1 manda ao receptor; a forma do link é API-013.

Algumas conferências aceitam mais de uma resposta conforme: um token recusado depois de revogação ou expiração pode vir com `CONSENT_REVOKED`, `CONSENT_EXPIRED` ou `TOKEN_INVALID`, sempre com 401 e `invalid_token`; o relógio é adiantado dentro da validade do token, para que a recusa venha do consentimento e não do token vencido. SEG-002 oferece, uma de cada vez, todas as suítes TLS 1.2 que o OpenSSL do Node conhece, menos as quatro da seção 7.5, e só conta as que o cliente consegue oferecer.

Os requisitos do receptor (RCP) ficam fora: testá-los pede um provedor de teste controlado pela suíte.

### Como um laboratório aponta a suíte para o próprio provedor

A suíte faz o papel de receptores de teste registrados. Num ambiente de homologação, o laboratório precisa de:

1. **Um registro de teste** (`environment` `pilot`) em que o provedor dele e os clientes de teste estão, assinado por uma chave em que o provedor confia, e as chaves iniciais desse registro.
2. **Clientes de teste** com chave de assinatura PS256 e certificado TLS no registro: o principal com dois certificados, o secundário, o sentinela, um `suspended` e um `withdrawn`. Só o principal é obrigatório: os testes que dependem dos outros terminam não verificáveis sem eles.
3. **O `jwks_uri` dos clientes acessível ao provedor.** A suíte pode hospedá-lo (bloco `hospedagem`), ou o laboratório publica os arquivos onde preferir.
4. **Pacientes de teste** no sistema do laboratório: um principal com CPF, outro com CPF diferente e um sem CPF, e os identificadores de alguns laudos.
5. **Opcional, mas recomendado: a interface de controle de teste** descrita acima. Sem ela, todos os testes que precisam adiantar o relógio ou recarregar o registro terminam não verificáveis.
6. **Para concluir a jornada do paciente**, uma de duas: login e consentimento em formulários HTML simples (`jornada_por_formulario`), que a suíte percorre como um navegador, ou a operação `jornada` da interface de controle. Com a interface de controle, os testes que olham o redirecionamento (AUT-012, AUT-013, AUT-025, ERR-006) dizem que ele foi informado pelo provedor, e não observado, e terminam não verificáveis. Contra o servidor de exemplo sem interface de controle, só com a jornada pelas páginas, a suíte termina com 107 aprovados e 25 não verificáveis; sem nenhuma das duas, com 55 aprovados e 77 não verificáveis.

Para os testes do registro (REG), a suíte publica candidatos assinados na hospedagem e o provedor precisa buscá-los ali (`registro.caminho_de_publicacao`). Ela precisa também da chave privada do registro de teste (`registro.chave_privada_para_candidatos`). Isso só faz sentido com um registro de teste, nunca com o registro real.

### Configuração

O arquivo gerado em `ambiente-local/gerado/suite.config.json` é um exemplo completo. Caminhos relativos são resolvidos a partir da pasta do arquivo.

| Campo | Obrigatório | Conteúdo |
| --- | --- | --- |
| `registro.documento`, `registro.assinatura` | Sim | `participantes.json` e `.jws` do registro de teste |
| `registro.chaves_iniciais` | Sim | Conjunto inicial de chaves (JWK Set) |
| `registro.ambiente` | Sim | `pilot` |
| `registro.chave_privada_para_candidatos` | Não | Chave privada (JWK) do registro de teste, para os testes REG |
| `registro.caminho_de_publicacao` | Não | Caminho, na hospedagem, de onde o provedor busca o registro |
| `provedor.participant_id` | Sim | Entrada do provedor no registro |
| `provedor.ca_confiavel` | Não | AC do certificado do servidor, se não for publicamente confiável |
| `hospedagem` | Não | `endereco_de_escuta`, `porta`, `certificado`, `chave` do servidor HTTPS da suíte |
| `clientes.principal` | Sim | `client_id`, `chave_de_assinatura` (JWK privado), `jwks_publico`, `certificados` (lista de `certificado` e `chave` em PEM) |
| `clientes.secundario`, `sentinela`, `suspenso`, `retirado` | Não | Mesmo formato |
| `certificado_nao_registrado` | Não | Certificado de cliente válido fora do registro (SEG-004) |
| `pacientes.principal` | Sim | `usuario`, `senha` (usada só pela jornada por formulário, dentro do domínio do provedor), `cpf`, `fhir_id`, e opcionalmente `laudos_nao_liberados`, `laudo_antigo` (`id`, `data`), `laudo_para_retificar`, `agendamento_de_outro_canal` |
| `pacientes.outro`, `pacientes.sem_cpf`, `pacientes.cpf_invalido` | Não | `usuario`, `senha`, `cpf`, `fhir_id`. `cpf_invalido` é um paciente cujo CPF no cadastro do provedor não é válido, por exemplo `00000000000` (CNS-025) |
| `agenda.unidade` | Não | Unidade dos testes de agenda e agendamento, `Location/{id}` |
| `agenda.exame_comum`, `agenda.exame_restrito` | Não | `sistema\|código` de um exame comum e de um que só cabe em parte dos horários (AGE-005) |
| `agenda.exame_indisponivel` | Não | `unidade` e `exame` que ela não coleta (AGE-006) |
| `agenda.prazo_de_pagamento_minutos` | Não | Prazo do provedor para o pagamento (AGD-008). Sem ele, o relógio é adiantado 24 horas |
| `catalogo.item_para_retirar` | Não | `ActivityDefinition` que a interface de controle pode retirar (CAT-003) |
| `controle_de_teste` | Não | `url` e `token` da interface de controle |
| `jornada_por_formulario` | Não | `campo_usuario`, `campo_senha`, `campo_decisao`, `valor_aprovar`, `valor_recusar`. Quando a página de login e a tela de consentimento do provedor são formulários HTML simples, a suíte conclui a jornada por elas, como um navegador, e registra cada redirecionamento. Tem precedência sobre a interface de controle para a jornada |

### Efeitos colaterais

A suíte cria consentimentos, agendamentos e revogações no provedor. Com a interface de controle, ela também adianta o relógio do provedor (em mais de 38 dias no total), suspende e reativa o cliente sentinela e deixa o registro expirar em REG-008, publicando um novo no fim. Rode só contra homologação. Duas execuções seguidas contra o mesmo provedor funcionam: a suíte parte da `sequence` em vigor no provedor e do relógio dele (pelo controle, ou pelo cabeçalho `Date`, como a seção 7.11 permite).

### Ordem de execução

Primeiro os testes comuns, depois os que publicam candidatos do registro, depois os que adiantam o relógio (REG-008 por último, porque leva o registro à expiração), e por fim os que examinam o histórico de todas as trocas: API-001 (`x-fapi-interaction-id` em toda resposta), API-010 (`OperationOutcome` em todo erro), ERR-001 (só códigos OAuth da seção 6.2) e ERR-004 (nenhum CPF, token ou rastro de pilha em erro).

## Receptor mínimo e jornada de ponta a ponta

`pnpm jornada` sobe o servidor de exemplo e faz, com o receptor mínimo:

1. baixa o registro por HTTPS e verifica V1 a V14;
2. confere os metadados campo a campo e a versão efetiva;
3. sincroniza o catálogo e lê o preço de dois exames numa unidade, nos três alcances (unidade, marca e região, município);
4. busca horários livres para a cesta;
5. cria o consentimento, faz o PAR, e um navegador simulado faz o papel do paciente na página de login e na tela de consentimento do servidor;
6. troca o código, lê o consentimento com o token de paciente e confere o CPF;
7. lê os laudos;
8. agenda, abre o link de pagamento, paga, vê o agendamento passar a `booked` e cancela;
9. revoga, e confere que o token antigo recebe 401;
10. abre uma segunda conexão em que o CPF do aplicativo não é o de quem entrou no laboratório, e confere a revogação com `PATIENT_MISMATCH` sem nenhuma chamada à API FHIR.

O receptor mínimo não depende do pacote cliente do fhir-brasil. Ele segue as regras do receptor por onde a jornada passa (os comentários no código citam o requisito RCP), mas não é um receptor completo: a revogação pendente fica só em memória.

## Dependências

| Pacote | Tipo | Por quê |
| --- | --- | --- |
| `jose` | Produção | JWT, JWS e JWK: asserção do cliente, verificação da assinatura do registro, thumbprints. A seção 7.11 pede biblioteca JOSE estabelecida |
| `ajv` | Produção | Passo V7 da seção 8.3: validar o registro contra o JSON Schema 2020-12 da especificação. Escrever um validador de JSON Schema à mão seria a fonte de erro que a seção 7.11 desaconselha para JOSE |
| `typescript` | Desenvolvimento | Conferência de tipos (`pnpm typecheck`). O Node executa o TypeScript direto, sem compilação. Fica na 6.0 porque o typescript-eslint ainda não aceita a 7 |
| `vitest` | Desenvolvimento | Testes |
| `@types/node` | Desenvolvimento | Tipos do Node 22 |
| `eslint`, `prettier`, `prettier-plugin-packagejson` e as configurações `@precisa-saude/eslint-config` e `@precisa-saude/prettier-config` | Desenvolvimento | Lint e formatação compartilhados com os outros repositórios da Precisa Saúde |
| `@commitlint/cli`, `@precisa-saude/commitlint-config`, `husky`, `lint-staged` | Desenvolvimento | Mensagens de commit no padrão Conventional Commits e ganchos de pre-commit, commit-msg e pre-push |
| `@precisa-saude/agent-instructions` | Desenvolvimento | Regras compartilhadas para agentes de código, importadas pelo `CLAUDE.md` |

Os certificados de teste usam o `openssl` do sistema, chamado pelo gerador, sem dependência. O servidor HTTP é o `node:https`, sem framework.
