# Notas de revisão (PRE-575)

Para: Rafael. Quarta rodada, 2026-11-17: versão 0.2.2, que decide os catorze pontos em que o cliente receptor atualizado para a 0.2.1 achou o texto ambíguo, omisso ou incoerente. A seção A é desta rodada. A seção 0 é da terceira rodada (0.2.1), e as seções 1 a 9 são da segunda (0.2.0), atualizadas onde as rodadas seguintes as alteraram.

Este arquivo é de trabalho. Ele registra o que foi decidido, o que mudou em cada rodada, o que continua pendente e o que não foi verificado. Nada foi testado contra um laboratório.

O repositório é público, e estas notas ficam à vista de propósito: as ressalvas da seção 4, a lista de itens não verificados da seção 5 e as questões em aberto da seção 6 interessam a quem avalia o protocolo. As seções de rodadas anteriores não foram reescritas. Onde elas falam em repositório privado, em ausência de implementação de referência ou em contato de segurança por definir, descrevem a situação daquela rodada. O contato de segurança hoje está em [SECURITY.md](../SECURITY.md), e o servidor de exemplo e a suíte, em [servidor-e-suite.md](servidor-e-suite.md).

## Sumário

A. [Quarta rodada: as catorze leituras do cliente (0.2.2)](#a-quarta-rodada-as-catorze-leituras-do-cliente-022), com as correções da seção A.5
0. [Terceira rodada: esclarecimentos da 0.2.1](#0-terceira-rodada-esclarecimentos-da-021)
1. [Estado de cada decisão](#1-estado-de-cada-decisão)
2. [Escolhas feitas nesta revisão](#2-escolhas-feitas-nesta-revisão)
3. [Mudanças necessárias no guia de implementação](#3-mudanças-necessárias-no-guia-de-implementação)
4. [Ressalvas que continuam de pé](#4-ressalvas-que-continuam-de-pé)
5. [Não verificado](#5-não-verificado)
6. [Questões em aberto](#6-questões-em-aberto)
7. [O que foi e o que não foi validado por máquina](#7-o-que-foi-e-o-que-não-foi-validado-por-máquina)
8. [O que convém resolver antes do primeiro commit (segunda rodada)](#8-o-que-convém-resolver-antes-do-primeiro-commit-segunda-rodada)
9. [Critérios de aceite desta rodada](#9-critérios-de-aceite-desta-rodada)

## A. Quarta rodada: as catorze leituras do cliente (0.2.2)

### A.1 Critérios de aceite

Escritos antes de mexer nos capítulos. A coluna "Situação" foi preenchida no fim, com a evidência.

| # | Critério | Como se prova | Situação |
| --- | --- | --- | --- |
| 1 | Cada um dos catorze pontos tem regra normativa nos capítulos e ao menos um item de conformidade, novo ou existente | Tabela A.2: ponto, seções e identificadores | Cumprido. Tabela A.2: os catorze pontos, cada um com seção e identificador |
| 2 | `CHANGELOG.md` tem a entrada 0.2.2 e diz, ponto a ponto, se muda o comportamento do provedor, do receptor ou de nenhum dos dois. A versão de protocolo continua `0.2` | Leitura do `CHANGELOG.md` | Cumprido. `CHANGELOG.md`, entrada 0.2.2, um item por ponto com o lado que muda |
| 3 | Ponto que só se resolveria com quebra de interoperabilidade não é resolvido com quebra: fica explicado, com o que foi feito dentro da 0.2 | Seção A.3 | Cumprido. Pontos 8 e 10 resolvidos em parte, explicados em A.3 |
| 4 | Estas notas trazem, por ponto, a regra, a alternativa e o motivo, e a lista de pendências do guia diz o que muda e o que não muda no perfil (ponto 10 em especial) | Seções A.2, A.3 e 3 | Cumprido. A.2, A.3 e seção 3, itens 7 e 10 |
| 5 | Versão do documento `0.2.2` no índice, no README, na seção 9.1 e no `CHANGELOG.md` | Busca por `0.2.1` nos textos que dão a versão atual | Cumprido. Índice, README, 9.1 e `CHANGELOG.md`. As menções a 0.2.1 que restam são históricas |
| 6 | Blocos Mermaid alterados passam no validador do Mermaid Chart, e os que não mudaram são idênticos aos de `main` | Validador e comparação por script | Cumprido. Seção 7, quarta rodada |
| 7 | Schema e exemplo de registro: o exemplo valida contra o schema alterado, a variação que fere a regra nova é recusada, e a assinatura do exemplo continua verificando | Ajv 8 em modo estrito e verificação PS256 | Cumprido. Seção 7, quarta rodada |
| 8 | Identificadores de conformidade: todos os de `main` presentes, com o mesmo número e na mesma ordem; os novos só acrescentados; nenhum repetido | Script contra `origin/main` | Cumprido. 162 de `main` intactos, 22 novos, 184 no total (depois das correções da seção A.5) |
| 9 | Links relativos resolvem, blocos JSON são válidos, todo rótulo de fonte existe em `docs/FONTES.md`, nenhum travessão | Scripts | Cumprido. Seção 7, quarta rodada |
| 10 | Toda afirmação nova sobre fonte externa conferida na fonte primária e registrada em `docs/FONTES.md` com acesso em 2026-11-17 | `docs/FONTES.md` | Cumprido. `docs/FONTES.md`, linhas marcadas **(2026-11-17)** |

Fora do escopo: o código do cliente (fhir-brasil, PR #177), o servidor de exemplo do ramo `feat/servidor-de-exemplo-e-suite` e qualquer alteração no guia de implementação. O que cada um precisa mudar fica listado na seção A.4.

### A.2 Regra escolhida em cada ponto

Desta vez li o código do cliente (PR #177, commit `b74c4b3`), além da descrição do PR. A regra geral foi ficar com a leitura do cliente quando ela é a conservadora e não briga com o resto do texto. Ela foi seguida em doze pontos. Nos pontos 3 e 7 fui além do cliente, e nos pontos 8 e 10 fiquei aquém, porque a leitura dele, tornada obrigatória, quebraria a comunicação com quem implementou a 0.2.1 de outro jeito (seção A.3).

| # | Ponto | Leitura do cliente | Regra da 0.2.2 | Onde | Muda |
| --- | --- | --- | --- | --- | --- |
| 1 | Cabeçalho do JWS do registro | Aceita outro `typ` e membros a mais | Igual, e mais duas regras: nenhum membro além de `kid` serve para achar a chave, e `crit` presente leva à recusa em V3 | 8.3, REG-011 | Os dois lados, como verificadores |
| 2 | REG-010 sem apoio no schema | Não conferível | O schema passa a conferir: lista com `0.x` tem um item só | 8.2, schema, REG-010 | Nenhum comportamento |
| 3 | Momento de gravar a revogação | Grava depois das três tentativas, como o texto dizia | Grava no momento da decisão, antes da primeira tentativa | 4.4, 2.6, RCP-038 | Receptor |
| 4 | 404 sem código | Mantém a pendência | Igual. O código é lido do `OperationOutcome` | 4.4, 6.4, RCP-039 | Receptor |
| 5 | Falha que não admite repetição | Vai direto para a pendência | Igual, com a lista das falhas | 4.4, RCP-040 | Receptor |
| 6 | `Retry-After` acima do teto | Encerra as tentativas e grava a pendência | Igual, e nenhuma tentativa, nem do calendário, antes do instante indicado, até o limite de 24 horas (A.5) | 4.4, 6.4, 6.5, RCP-041, RCP-050, ERR-007 | Os dois lados |
| 7 | CPF de algarismos iguais | Inválido, inclusive o CPF que o aplicativo informa | Igual, e o provedor trata CPF inválido no cadastro como ausência de CPF | 4.4, T5, CNS-025, RCP-042 | Os dois lados |
| 8 | Usuário na URL e link relativo | Recusa os dois | Usuário: recusa. Relativo: o receptor resolve e confere a URL resultante na 0.2 (A.5). Provedor emite link absoluto | 5.1, API-013, RCP-043, RCP-051 | Os dois lados |
| 9 | Domínio do link de pagamento | Não confere o domínio, não lê extensão repetida | Igual. O domínio é obrigação do provedor | 5.5.5, RCP-044 | Receptor, só a extensão repetida |
| 10 | Paciente só por CPF | Exige a referência | Receptor: só referência, sem `identifier`. Provedor: continua aceitando CPF na 0.2. Perfil sem mudança | 5.5.5, 3.5, RCP-045 | Receptor |
| 11 | Versão que o software não implementa | Não oferece o provedor, nem com `api_base_url` incoerente | Igual, para os dois lados | 9.1, REG-012, RCP-046 | Os dois lados |
| 12 | Código de jornada aberta antes do vencimento | Recusa, como jornada nova | Igual. O provedor já recusava, agora escrito | 8.3, 2.2, REG-013, RCP-047 | Receptor |
| 13 | Provedor suspenso e revogação | Nenhuma chamada, página do provedor à vista | Igual, e a frase da 9.1 corrigida | 8.4, 9.1, 4.4, RCP-048 | Receptor |
| 14 | Contexto de preço desconhecido | Conta como não reconhecido, preço não é geral | Igual, e o provedor só usa `venue` e `brand` com referência | 5.5.2, CAT-005, RCP-049 | Os dois lados |

**1. Cabeçalho do JWS.** Alternativa: exigir o cabeçalho exato `{"alg","kid","typ":"JOSE"}` também na verificação. Motivo da escolha: o cabeçalho protegido é coberto pela assinatura, então tudo o que está nele foi escrito por quem tem a chave do registro, e recusar por `typ` não protege de nada. O RFC 7515 manda ignorar o que não se entende e diz que `typ` é assunto da aplicação. Os dois perigos reais ficaram cobertos: usar `jwk` ou `x5u` do cabeçalho para achar a chave, e ignorar `crit`, que o RFC obriga a respeitar. Pus `crit` em V3, e não num passo novo, para não renumerar a lista.

**2. REG-010.** Alternativa: deixar REG-010 como requisito declarativo, conferido só pelo mantenedor na admissão. Motivo: o mantenedor gera o registro com uma ferramenta que valida contra o schema, então pôr a regra no schema a faz valer na origem, e todo verificador a recebe pelo passo V7 sem passo novo. A regra só restringe listas com versão `0.x`, para não precisar mudar o schema quando houver MAJOR 1. Mantive `schema_version` `0.1` e o `$id`: o formato não mudou, o texto da 8.2 já proibia a lista com duas versões, e só o schema estava incompleto. Se você preferir tratar qualquer mudança de schema como mudança de formato, o caminho é `0.2`, com exemplo regerado e assinado de novo.

**3. Gravar antes.** Alternativa: manter "grava depois das três" e aceitar a janela. Motivo: os tokens são descartados no momento da decisão, então um reinício durante as tentativas fazia a revogação sumir sem chegar ao laboratório e sem o paciente saber. Gravar antes custa uma escrita a mais por revogação. A tela de pendência só aparece depois das tentativas automáticas, ou depois de um reinício. É o próprio cliente que sugere essa regra.

**4. 404 sem código.** Alternativa: aceitar qualquer 404 como conclusão. Motivo: um 404 sem `OperationOutcome` vem tipicamente de um intermediário ou de uma URL errada, e encerrar a pendência nesse caso esconderia do paciente uma revogação que não aconteceu. A seção 6.1 já obriga o provedor a mandar o código, então o provedor conforme não é afetado.

**5. Falha que não admite repetição.** Alternativa: gastar as três tentativas em qualquer falha. Motivo: repetir `invalid_client` em segundos não muda nada (seção 6.4, regra 4). A pendência segue o calendário, que é espaçado, e por isso a 6.4 agora diz que essas repetições são a exceção prevista. Nas condições locais (registro expirado há mais de 7 dias, provedor ou receptor fora de `active`, sem versão efetiva) o receptor nem faz a chamada.

**6. `Retry-After` longo.** Alternativa: obrigar o receptor a esperar o que o provedor pedir. Motivo: segurar uma requisição por horas não serve a ninguém, e a pendência já resolve o caso. A regra que importa para o provedor é que ninguém tente antes da hora, e ela agora vale também para o calendário.

**7. CPF de algarismos iguais.** Alternativa: só o receptor recusar. Motivo de ir além: se o provedor aprovasse um paciente cujo cadastro tem `00000000000`, o receptor descartaria tudo com `RECEIVER_TERMINATION`, e o histórico do consentimento diria "o receptor desistiu", quando o problema é o cadastro do laboratório. Com a regra no provedor, o desfecho é `PATIENT_WITHOUT_CPF`, que diz a verdade. Um receptor da 0.2.1 entende esse código, então a mudança não quebra nada. Exigir que o CPF do paciente seja conferido antes da jornada evita levar o paciente ao login do laboratório para nada.

**8. Paginação.** Alternativa: tornar obrigatória a recusa do link relativo, como faz o cliente. Por que não: seções A.3 e A.5. Componente de usuário: recusa obrigatória, com apoio do RFC 9110, seção 4.2.4. O provedor passa a emitir sempre link absoluto, o que funciona com qualquer receptor.

**9. Domínio do link de pagamento.** Alternativa: acrescentar ao registro a lista de domínios de pagamento de cada provedor. Por que não: o schema do registro recusa campo desconhecido (`additionalProperties: false`), então um campo novo faria todo verificador da 0.2.1 recusar o registro inteiro. Seria mudança de formato e de protocolo, coisa para a 0.3. Do jeito que ficou, o domínio é obrigação do provedor (AGD-007), conferida na admissão e pela suíte, e o receptor confere o que tem como conferir. Abrir no navegador do sistema mostra o endereço ao paciente.

**10. Paciente só por CPF.** Alternativa: mudar o perfil do guia para exigir a referência. Decisão: **muda a especificação, não o perfil.** A invariante `br-lab-patient-reference` está definida no perfil de consentimento e é usada também nos de agendamento e de pedido de exame. A forma por CPF serve a usos do guia fora deste protocolo, e um agendamento só com referência já valida no perfil atual. O protocolo restringe por cima do perfil, como já faz em outros pontos. Do lado do receptor, a regra fecha a última porta por onde ele mandaria CPF ao laboratório. Do lado do provedor, a aceitação do CPF continua na 0.2 (seção A.3). Se um dia a aceitação sair, e se você quiser que o validador do guia pegue o desvio, a mudança no perfil seria esta, só para `BRLabAppointment` e `BRLabServiceRequest`:

- uma invariante nova, por exemplo `br-lab-patient-literal-reference`, com a expressão `reference.exists() and identifier.empty()`, no lugar de `br-lab-patient-reference` em `participant[patient].actor` e em `subject`;
- `br-lab-appointment-request-subject` reduzida à comparação da referência: `contained.ofType(ServiceRequest).subject.all(reference in %resource.participant.actor.reference)`;
- o perfil de consentimento fica como está.

Não é preciso fazer isso para a 0.2.2.

**11. Versão que o software não implementa.** Alternativa: confiar só no registro. Motivo: se a entrada do registro muda antes do software (ou o contrário), o participante passaria a falar uma versão que não implementa. Tratar como "não há comunicação" é a leitura do cliente e vale igual para o provedor. O `api_base_url` sem `/v{M}` é o mesmo caso visto pelo lado do endereço.

**12. Código de jornada aberta antes do vencimento.** Alternativa: deixar a troca acontecer, já que a jornada começou com o registro válido. Motivo: o provedor já devia recusar (a 0.2.1 recusava "as demais concessões"), então permitir do lado do receptor só geraria erro. Sem a troca, T14 encerra o consentimento sozinho em 60 segundos, sem token emitido.

**13. Provedor suspenso.** Alternativa: permitir só o `DELETE` a provedor suspenso, porque revogar reduz acesso. Motivo da escolha: os tokens já foram descartados no momento da decisão, então o acesso pelo aplicativo já acabou e a revogação no laboratório não muda o que o receptor recebe. Uma suspensão pode ter causa de segurança, e "nenhuma chamada" é uma regra simples de testar. A página do provedor continua sendo o caminho do paciente, e a pendência espera a volta a `active`. A frase da 9.1 que dizia que a revogação "continua possível pelas regras da 8.3" no caso de falta de versão efetiva ia contra isso e foi reescrita.

**14. Contexto de preço desconhecido.** Alternativa: só a regra do receptor. Motivo de ir além: com o fatiamento aberto, o receptor nunca saberia se um contexto novo restringe ou amplia o preço. Fechando o conjunto do lado do provedor, os três alcances da 5.5.2 passam a ser a lista completa. Um provedor da 0.2.1 com outro contexto não quebra a comunicação: o preço dele só deixa de aparecer como geral.

### A.3 Onde parei para não quebrar a versão de protocolo

A versão de protocolo continua `0.2`, e implementações da 0.2.0, 0.2.1 e 0.2.2 precisam continuar se falando. Em dois pontos a regra completa cortaria essa comunicação. Nos dois, a 0.2.2 fixa a parte que não quebra, e a seção 9.1 passou a dizer que um PATCH funciona assim.

- **Ponto 8, link relativo.** O FHIR R4 não exige link de paginação absoluto: diz que é opaco ao cliente, e só o exemplo usa URL absoluta (página `http`, seção 3.1.0.14). Um provedor da 0.2.1 que emite `?page=2` podia se ler conforme. Tornar a recusa obrigatória no receptor cortaria a paginação com ele. Feito: o provedor da 0.2.2 emite link absoluto (API-013), e o receptor resolve o relativo pelo RFC 3986 e confere a URL resultante (RCP-051). Na primeira versão deste PR o receptor podia escolher entre recusar e resolver, o que ainda cortava a paginação quando ele recusava. A correção está na seção A.5. **Fica para a 0.3:** recusa obrigatória do link relativo.
- **Ponto 10, provedor aceitar o CPF.** A 0.2.1 obrigava o provedor a aceitar o paciente só por CPF. Um receptor da 0.2.0 ou da 0.2.1 que tenha usado essa forma teria o agendamento recusado por um provedor da 0.2.2, se a aceitação saísse agora. Feito: o receptor da 0.2.2 só usa a referência (RCP-045), e o provedor continua aceitando o CPF na 0.2. **Fica para a 0.3:** retirar a aceitação e, se quiser, a mudança no perfil descrita no ponto 10.
- **Ponto 9, alternativa não adotada.** A lista de domínios no registro exigiria mudar o formato do registro de um jeito que verificadores da 0.2.1 recusam. Não foi preciso parar aqui porque a regra escolhida não depende dela, mas ela fica anotada para a 0.3.

### A.4 O que muda no cliente e no servidor de exemplo

**Cliente (PR #177, conferido no código, commit `b74c4b3`, antes de ele ser atualizado para a 0.2.2).** Os pontos 4, 5, 8, 9, 11, 12, 13 e 14 coincidiam com o que ele fazia. As correções da seção A.5 acrescentam mudanças nos pontos 5 (429 sem código), 6 (teto de 24 horas) e 8 (resolver link relativo). Precisam de mudança:

| Ponto | O que mudar | Requisito |
| --- | --- | --- |
| 2 | Acrescentar ao schema embutido (`registry-schema.ts`) a regra de `protocol_versions`. Com isso REG-010 deixa de ser "fora do alcance" e passa a ser coberto por REG-003 | REG-010, REG-003 |
| 3 | Gravar a pendência no `RevocationStore` antes da primeira tentativa, e não depois das três. Hoje um reinício no meio perde a revogação | RCP-038 |
| 6 | O próximo vencimento do calendário (`nextRevocationAttemptAt`) não considera `Retry-After`. Só pesa quando o provedor pede mais de uma hora, mas aí o cliente tentaria antes da hora | RCP-041 |
| 7 | O CPF esperado só é conferido em `completeAuthorization`, depois do login do paciente no laboratório. `startAuthorization` não recebe o CPF. Para cumprir RCP-042, a conferência precisa acontecer antes de criar o consentimento, no pacote ou no aplicativo | RCP-042 |
| 10 | O agendamento exige a referência certa, mas não recusa `identifier` junto dela no participante ou no `subject` | RCP-045 |

Sem mudança de comportamento, mas com ajuste pequeno: no ponto 1, a biblioteca JOSE que o cliente usa (jose 6.2.17, mesma versão) já recusa `crit` desconhecido, conferido por script, só que o erro sai como passo V6 e não V3. Faltam ainda testes com os identificadores novos (REG-011, REG-012, RCP-038 a RCP-051) e a atualização da tabela de conformidade do README do pacote. No ponto 13, a tentativa imediata quando o provedor volta a `active` é recomendação (DEVERIA), e o cliente hoje espera o próximo vencimento.

**Servidor de exemplo e suíte (ramo `feat/servidor-de-exemplo-e-suite`).** Li só o plano e a lista de arquivos do commit `016b45c`, por comandos de leitura do Git, sem abrir o código. O plano diz que o servidor implementa a 0.2.1 como está escrita e que `comum/` tem CPF, verificação do registro e negociação. Pelo que a 0.2.2 exige do provedor, a conferir ou mudar:

| Ponto | O que o servidor ou a suíte precisa | Requisito |
| --- | --- | --- |
| 1 | Verificação em `comum/`: recusar `crit`, ignorar `typ` e membros a mais. O gerador do registro local pode seguir assinando com o cabeçalho de sempre | REG-011 |
| 2 | Se `comum/` ou o gerador validam contra uma cópia do schema, atualizar a cópia | REG-010, REG-003 |
| 7 | Paciente de teste com CPF `00000000000` no cadastro, que deve terminar em `PATIENT_WITHOUT_CPF`. O CPF de `comum/` precisa recusar os onze algarismos iguais | CNS-025 |
| 8 | Links de paginação absolutos, `https`, sem usuário. Provavelmente já é assim. Teste novo na suíte | API-013 |
| 11 | Negociação em `comum/`: versão que o software não implementa conta como inexistente | REG-012 |
| 12 | Recusar `authorization_code` com registro expirado. A 0.2.1 já exigia, mas não havia requisito com número. Teste novo | REG-013 |
| 14 | Preços sintéticos só com `venue` e `brand`, com referência. Teste novo | CAT-005 |

No ponto 10 o servidor não muda: continua aceitando o paciente só por CPF. A lista de pontos ambíguos que o plano prevê (`docs/pontos-da-especificacao.md`) pode se sobrepor a esta rodada.

### A.5 Correções pedidas pelo cliente depois da primeira versão da 0.2.2

O cliente foi atualizado para o rascunho da 0.2.2 (fhir-brasil, PR #177, commit `a52b5dd`) e achou quatro problemas no texto novo. Foram corrigidos no mesmo PR, antes de a 0.2.2 entrar no ramo principal, e ficam na mesma entrada do `CHANGELOG.md`.

| # | Problema | Regra | Requisitos | O cliente muda? |
| --- | --- | --- | --- | --- |
| 1 | O item 4 da revogação pendente chamava de não repetível todo 4xx do `DELETE`, e o item 3 dava 429 e 401 `TOKEN_INVALID` como repetíveis | 429 (com ou sem código do protocolo) e 401 `TOKEN_INVALID` admitem repetição; os demais 4xx fora das conclusões do item 8 não. A regra 5 da seção 6.4, que dizia "4xx não se repete" para código desconhecido, ganhou a mesma exceção para 429 | 4.4, 6.4, RCP-040 (texto inalterado, aponta para a 4.4) | **Sim, pouco.** 429 com código do protocolo e 401 `TOKEN_INVALID` já são repetidos. Um 429 sem `OperationOutcome` cai em `retryByStatus`, que só repete 5xx: precisa repetir também 429 |
| 2 | Um `Retry-After` suspendia o calendário sem limite | Na revogação, `Retry-After` vale no máximo 24 horas; acima disso o receptor o trata como 24 horas e retoma o calendário. O provedor não envia mais que 86400 segundos no `DELETE` de consentimento nem no token de `consent.manage` | 4.4 item 5, 5.1, 6.4, 6.5, RCP-041 (texto), RCP-050, ERR-007 | **Sim.** O cliente já respeita `Retry-After` no calendário (`notBefore`), mas sem teto |
| 3 | Revogação achada no reinício que outra instância ainda está tentando | Não há trava entre instâncias. `DELETE` repetido ou concorrente é inofensivo e esperado: 204 numa chamada, 422 `CONSENT_INVALID_STATE` nas outras, e as duas encerram a pendência. O provedor aplica a transição uma vez, mantém o motivo da primeira e nunca responde 409 nem 5xx por concorrência | 4.4 itens 6 e "Encerramento", 6.5, CNS-026 | **Não.** Ele já trata 422 `CONSENT_INVALID_STATE` como conclusão e não usa trava |
| 4 | Recusar link relativo também corta a paginação com provedor da 0.2.0 ou 0.2.1 | Na 0.2 o receptor DEVE resolver o link relativo contra a URL da requisição (RFC 3986, seção 5.2) e aplicar à URL resultante as conferências de esquema, host, porta, prefixo e componente de usuário. A recusa fica para a 0.3 | 5.1, RCP-043 (texto inalterado), RCP-051 | **Sim.** `isInsideBase` faz `new URL(candidate)` sem base, e com isso todo link relativo é recusado. Precisa resolver contra a URL da requisição antes de conferir |

**Por que 24 horas no ponto 2.** É o intervalo do calendário depois do primeiro dia, então um único cabeçalho atrasa a revogação em no máximo um ciclo diário. Cobre uma janela de manutenção de um dia inteiro, que é mais do que um laboratório costuma anunciar. O atraso não reabre acesso, porque o receptor descartou os tokens no momento da decisão, e o paciente vê a página do provedor durante a pendência. O custo está no primeiro dia: um `Retry-After` de 24 horas logo de saída troca as tentativas de hora em hora por uma só. Um teto de uma hora preservaria o primeiro dia, mas proibiria o provedor de anunciar uma manutenção noturna, e por isso fiquei com o número que o cliente sugeriu.

**Por que resolver, e não recusar, no ponto 4.** Procurei no FHIR R4 um motivo para permitir a recusa e achei o contrário: o tipo `uri`, de `Bundle.link.url`, "can be absolute or relative" (página `datatypes`, seção 2.24.0.1), e a página `http` diz que os links são opacos e que o cliente usa os que o servidor dá. Um provedor que emite `?page=2` está dentro do FHIR. Resolver e depois conferir a URL resultante dá a mesma proteção da recusa: um link relativo de rede como `//outro.example/x` resolve para outro host e é recusado do mesmo jeito.

**Identificadores.** Novos: CNS-026, ERR-007, RCP-050, RCP-051. O texto de RCP-041, que entrou neste mesmo PR e ainda não foi publicado, ganhou a referência ao limite de 24 horas. O teste dele (503 com `Retry-After: 7200`) continua igual. RCP-043 não mudou: continua verdadeiro com a regra nova.

## 0. Terceira rodada: esclarecimentos da 0.2.1

Não vi o código do cliente. O que sei dele é o que veio no pedido: implementou a leitura conservadora de cada ponto, mantém a revogação pendente e descarta os tokens localmente, faz três tentativas com recuo respeitando `Retry-After`, usa um token de provedor por escopo, limita o tempo de uso do token em relação à validade e não chama a revogação de token do RFC 7009. Onde digo "a conferir no cliente", é porque a regra escrita pode ir além do que ele faz.

### 0.1 Regra escolhida em cada ponto

| # | Ponto | Regra | Onde |
| --- | --- | --- | --- |
| 1 | Registro expirado e revogação | Exceção limitada: por 7 dias depois do vencimento, o provedor aceita `client_credentials` com `consent.manage` como único escopo, só para consultar e revogar. Depois disso, revogação pendente no receptor e página do provedor como caminho garantido | 8.3, 4.4, 6.3.1 (`REGISTRY_EXPIRED`), REG-008, RCP-033 |
| 2 | Versões | Quatro números com papéis distintos: documento `0.2.1`, protocolo `0.2`, caminho `/v0`, formato do registro `0.1` | 9.1, 8.2, exemplo e schema do registro |
| 3 | Negociação | MAJOR 0: só versão idêntica. MAJOR 1 ou mais: o menor entre os maiores MINOR de cada lado, e o lado mais novo não depende de nada posterior | 9.1, REG-009, REG-010, RCP-037 |
| 4 | Conferência impossível | Não conclui o vínculo, descarta tokens, revoga com `RECEIVER_TERMINATION` | 4.4, fluxo 2.2, 6.6, RCP-027 |
| 5 | Repetição da revogação | Três tentativas automáticas, depois pendência durável, de hora em hora no primeiro dia e diária depois, visível ao paciente | 4.4 "Revogação pendente", fluxo 2.6, 6.4, RCP-028, RCP-029 |
| 6 | Metadados | Tabela de 14 campos com valor exigido, fonte e valor por omissão. O receptor recusa o provedor que não os traz | 5.2, AUT-026, RCP-031 |
| 7 | Verificação do registro | Lista única de catorze passos, V1 a V14 | 8.3, REG-007 |
| 8 | Paginação | `next` dentro do `fhir_base_url`: esquema, host, porta e prefixo de caminho. O receptor não segue o que sai disso, nem redirecionamentos | 5.1, API-012, RCP-030 |
| 9 | Link de pagamento | Só na extensão `https://fhir-brasil.dev.br/ig/StructureDefinition/payment-link`, no nível raiz do `Appointment`, em `valueUrl` | 5.5.5, AGD-016, RCP-035 |
| 10 | `If-None-Exist` | `identifier={system}|{value}` na forma literal. `value` só com caracteres não reservados, `system` sem caracteres que exijam escape. O provedor aceita também a forma codificada por `%` | 5.5.5, AGD-015, AGD-017, RCP-036 |
| 11a | Um token de provedor por escopo | Permitido e recomendado. Obrigatório só para `consent.manage`, que vai sempre sozinho. O provedor é obrigado a aceitar pedido de escopo único | 5.3.4, 3.3, 7.4, AUT-027, RCP-032 |
| 11b | Limite de uso do token | Obrigatório não usar depois de `expires_in`. Recomendada margem de ao menos 30 segundos. Margem maior é permitida | 5.3.4, 7.4, RCP-034 |
| 11c | Revogação de token do RFC 7009 | Opcional nos dois lados. Proibido usá-la no lugar da revogação do consentimento | 5.3.5, 7.4 |

### 0.2 Justificativa do ponto 1

As duas opções eram: abrir uma exceção limitada para a revogação, ou manter a leitura literal (nenhuma concessão com registro expirado) e deixar a revogação pendente no receptor.

Escolhi a exceção, por três motivos.

1. **O texto da 0.2.0 era incoerente a favor do acesso.** Com o registro expirado, a renovação por refresh token podia continuar por 7 dias, para não interromper a entrega de resultados. No mesmo período, a revogação pelo aplicativo ficava bloqueada. Um atraso administrativo mantinha o fluxo de dados e tirava do paciente o meio de interrompê-lo por ali.
2. **A exceção só reduz acesso.** O risco de um registro expirado é o provedor não saber se o receptor foi suspenso ou retirado. O pior que um receptor nessa situação consegue com um token que só consulta e revoga consentimentos é revogar consentimentos dele mesmo. Criar consentimento com esse token é recusado (`REGISTRY_EXPIRED`).
3. **É limitada.** Sete dias, o mesmo prazo da tolerância de refresh token, e só para receptor que estava `active` no último documento aceito. Depois disso vale a leitura literal.

A exceção não substitui a pendência. Depois dos 7 dias, ou se o provedor estiver fora do ar, o que protege o paciente é o que o cliente já faz: descartar os tokens na hora e manter a revogação pendente. A 0.2.1 acrescenta que a pendência é durável, tem calendário e aparece para o paciente com o endereço da página do provedor.

**O que o cliente já entregue faz hoje e onde difere.** Ele mantém a revogação pendente e descarta os tokens localmente, o que é o comportamento exigido depois da janela de 7 dias e em qualquer falha. A diferença está dentro da janela: pela leitura conservadora da 0.2.0 ele não pede nenhum token com o registro expirado, e a 0.2.1 exige que ele continue tentando as revogações pendentes com tokens de escopo único `consent.manage` (RCP-033). Enquanto o cliente não mudar, o efeito é só que a revogação demora mais a chegar ao laboratório. Nenhum dado trafega nesse intervalo, porque os tokens já foram descartados.

Custo da escolha: é comportamento novo do lado do provedor em um PATCH. Está marcado no `CHANGELOG.md`, e a seção 9.1 passou a dizer que, na fase 0, um PATCH pode fixar comportamento.

### 0.3 Onde o cliente entregue pode diferir da especificação

Viram trabalho de acompanhamento no cliente. Os três primeiros são diferenças certas pelo que o pedido descreve. Os demais são regras novas que eu não tenho como saber se ele já cumpre.

| # | Regra da 0.2.1 | Situação no cliente |
| --- | --- | --- |
| 1 | Com o registro local expirado, continuar tentando revogações pendentes com token só de `consent.manage` (RCP-033) | **Difere.** Hoje não pede token nenhum nessa situação |
| 2 | Versão de protocolo `0.2`, caminho `/v0`, formato do registro `0.1` | **Difere se** ele fixou `1.0`, `/v1` ou `schema_version` `1.x`. O exemplo de registro e o schema mudaram, e o exemplo tem chave e assinatura novas: vetores de teste baseados no exemplo da 0.2.0 deixam de valer |
| 3 | Calendário da revogação pendente: de hora em hora nas primeiras 24 horas, diária depois, armazenamento durável, aviso ao paciente com o endereço da página do provedor (RCP-028) | **A conferir.** O pedido diz que ele mantém a pendência, não com que calendário, nem se sobrevive a reinício, nem o que mostra ao paciente |
| 4 | 404 e 422 `CONSENT_INVALID_STATE` na revogação encerram a pendência (RCP-029) | A conferir |
| 5 | Conferência impossível: `RECEIVER_TERMINATION` (RCP-027), incluindo CPF com dígitos verificadores inválidos | Deve coincidir, foi a leitura dele. A conferir o caso do CPF malformado |
| 6 | Passos V2, V5 (tamanho da chave), V8 (ambiente), V11 (validade não invertida), V13 e V14 da verificação do registro | A conferir. V3, V4, V6, V7, V9, V10 e V12 já estavam na 0.2.0 |
| 7 | Tabela de metadados: `jwks_uri`, `scopes_supported` contendo os escopos do registro, e `response_types_supported`, métodos e algoritmos com valor exato | A conferir quais campos ele exige e se compara por igualdade |
| 8 | Paginação: também porta e fronteira de segmento do caminho, e não seguir redirecionamento HTTP | A conferir |
| 9 | `consent.manage` sempre sozinho (RCP-032) | Deve coincidir, ele usa um token por escopo |
| 10 | Margem de uso do token | Deve coincidir. A especificação só obriga a não passar de `expires_in` |
| 11 | `If-None-Exist` literal, `value` de até 64 caracteres não reservados, `system` restrito | A conferir o conjunto de caracteres que ele aceita gerar |
| 12 | Link de pagamento só pela URL canônica, só `https`, e não enviar a extensão na criação | A conferir |
| 13 | Agendamento: `actor.type` nos participantes e no `subject`, e cópia dos `coding` do catálogo sem exigir LOINC | A conferir. Sem `actor.type` o recurso não valida no perfil atual |
| 14 | Leitura dos três alcances de preço, inclusive o contexto de marca | A conferir |
| 15 | Negociação de versão (RCP-037) | A conferir |

### 0.4 Escolhas menores desta rodada que você pode querer rever

- **Formato do registro em `0.1`.** Podia ter ficado `1.0`, por ser numeração independente. Rebaixei para não haver um "1.0" dentro de um rascunho 0.x. Custo: schema e exemplo mudaram.
- **Uma versão de protocolo por participante na fase 0.** Decorre de `/v0` não distinguir `0.2` de `0.3`. Torna a troca de MINOR um evento combinado entre todos.
- **PATCH que fixa comportamento.** Redefini o PATCH para a fase 0, porque a 0.2.1 faz exatamente isso. A alternativa era chamar esta versão de 0.3.0, o que pela regra nova de negociação cortaria a comunicação com quem declara `0.2`.
- **Proibição de seguir redirecionamento HTTP** nas APIs. Acrescentei junto com a regra de paginação, pelo mesmo motivo.
- **O receptor copia os `coding` do catálogo para o pedido**, sem acrescentar nem retirar. É a forma de não exigir LOINC sem deixar o código em aberto.
- **Tokens de provedor fora de armazenamento durável.** Regra nova, pequena.

## 1. Estado de cada decisão

Os identificadores D1 a D24 são os da primeira rodada. "Decidida" quer dizer decidida pelo Rafael em 2026-11-16. "Mantida" quer dizer que a escolha da primeira rodada não foi contestada e segue no texto, ainda sujeita a revisão.

| Id | Tema | Situação | Como ficou |
| --- | --- | --- | --- |
| D1 | Perfil de segurança | **Decidida, substitui a anterior** | FAPI 2.0 Security Profile. Código de autorização puro, PAR, PKCE. Sem fluxo híbrido, sem `id_token`, sem cifragem |
| D2 | Cinco estados de consentimento | Mantida | Sem mudança |
| D3 | Escopo `consent.manage` | Mantida | Sem mudança |
| D4 | Endpoints de consentimento em JSON do protocolo | Mantida | Ganhou a leitura com token de paciente (D6) |
| D5 | Registro estático, sem registro dinâmico | **Decidida** | Aceito para o piloto |
| D6 | CPF do paciente | **Decidida, substitui a anterior** | O receptor não envia CPF. O provedor devolve o CPF do paciente autenticado, e o receptor compara e revoga se divergir. As mitigações do desenho antigo (resposta igual para qualquer CPF, não repetir o CPF) saíram do texto |
| D7 | Consentimento de até 12 meses, sem renovação silenciosa | **Decidida** | Como estava |
| D8 | Formato do agendamento | **Decidida, substitui a anterior** | Um `Appointment` com `ServiceRequest` em `contained`. Sem Bundle `transaction` |
| D9 | Remarcar e cancelar por `PUT` com `If-Match` | Mantida | Os pedidos contidos não mudam na remarcação |
| D10 | Sem notificações do provedor | Mantida | Sem mudança |
| D11 | `OperationOutcome` em todos os erros de API | Mantida | Sistema de códigos agora `urn:open-labs-brasil:error-code` |
| D12 | `patient` e `consent_id` na resposta do token | **Substituída** | A resposta do token só tem membros do OAuth. O id do paciente vem na leitura do consentimento com token de paciente (seção 2.2) |
| D13 | `appointment.write` e `consent.read` restritos ao que é do próprio receptor | Mantida | Sem mudança |
| D14 | Catálogo por sincronização | Mantida | Sem mudança |
| D15 | Assinatura do registro por JWS destacado, com encadeamento de chaves | **Decidida** | Aceito para o piloto, com a limitação declarada em 7.10 e 8.5 da especificação |
| D16 | Valores numéricos | Parte substituída | Código de autorização: 60 segundos, agora por exigência do FAPI 2.0. `request_uri`: menor que 600 por exigência do FAPI 2.0, mínimo de 120 por escolha. Os demais valores continuam escolhas minhas |
| D17 | Valores de `acr` | **Substituída** | Sem OpenID Connect não há `acr`. O receptor não é informado de como o paciente se autenticou |
| D18 | Itens do perfil do Open Finance deixados de fora | **Substituída** | Não se aplica: o perfil deixou de ser o do Open Finance |
| D19 | Refresh token ligado ao cliente, não ao certificado | Mantida | O FAPI 2.0 cita a mesma vantagem na seção 6.1 |
| D20 | `suspended` mantém consentimentos, `withdrawn` revoga | Mantida | Sem mudança |
| D21 | Aprovação do conjunto inteiro de escopos | Mantida | Sem mudança |
| D22 | Governança | Parte decidida | Mantenedor nomeado: Precisa Saúde. Os limiares (dois provedores e dois receptores, maioria por lado, prazos) continuam propostas minhas |
| D23 | Só o titular adulto | Mantida | Agora com CPF obrigatório no cadastro do provedor |
| D24 | `snake_case` e grafia `AUTHORISED` | Mantida | Sem mudança |
| (nova) | Nome | **Decidida** | Open Labs Brasil. Identificadores com `open-labs-brasil` |
| (nova) | `schedule.read` | **Decidida** | Escopo de provedor, sem consentimento |
| (nova) | Coleta domiciliar | **Decidida** | Fora da versão 1 (seções 1.8 e 3.6) |
| (nova) | Biblioteca JOSE | **Decidida** | Recomendação em 7.11 e no índice |

## 2. Escolhas feitas nesta revisão

### 2.1 Perfil FAPI 2.0 (item 3)

Li por inteiro a seção 5 do FAPI 2.0 Security Profile final [FAPI2-SP] e segui o que ela exige. Onde ela dá alternativas:

| Alternativa | Escolha | Fonte e motivo |
| --- | --- | --- |
| Token vinculado por mTLS ou DPoP | mTLS (RFC 8705) | [FAPI2-SP] 5.3.2.1. O texto não dá razão contra o mTLS neste caso. A vantagem que ele atribui ao DPoP, na seção 5.5, é a implantação mais fácil quando falta integração com a camada TLS, e o protocolo já exige mTLS em todo endpoint entre servidores |
| Cliente autenticado por `private_key_jwt` ou mTLS | `private_key_jwt` | [FAPI2-SP] 5.3.2.1. A seção 5.2.2.1 dá justamente `private_key_jwt` com conectividade mTLS como exemplo de ecossistema |
| PS256, ES256 ou EdDSA | Só PS256 | [FAPI2-SP] 5.4.1. Restringir é permitido pela seção 5.1.2. Motivo: um algoritmo só, e compatibilidade com ICP-Brasil, que segundo [OFB-FAPI] 6 emite apenas RSA |
| Metadados por OpenID Connect Discovery ou RFC 8414 | RFC 8414, `/.well-known/oauth-authorization-server` | [FAPI2-SP] 5.3.2.1; [RFC8414] 3. Não há OpenID Connect |
| Com ou sem OpenID Connect | Sem | [FAPI2-SP] permite e não exige |

O que o FAPI 2.0 trouxe e não estava na primeira rodada:

- parâmetro `iss` na resposta de autorização, que o cliente é obrigado a conferir [RFC9207];
- `aud` da asserção do cliente só pode ser o `issuer`, como texto simples;
- código de autorização com no máximo 60 segundos;
- `request_uri` com `expires_in` menor que 600;
- o servidor aceita `iat` e `nbf` até 10 segundos no futuro e recusa acima de 60;
- rotação de refresh token proibida salvo circunstância extraordinária, e o cliente precisa aceitar um token novo;
- suítes de TLS 1.2 conforme o BCP 195 atual [RFC9325], que não inclui mais as suítes `DHE` listadas no FAPI 1.0;
- sem CORS no endpoint de autorização, sem status 307, proteção contra rebaixamento para HTTP;
- adesão ao [RFC8725] ao criar e processar JWT.

**Consequência que precisa da sua confirmação: o objeto de requisição assinado saiu.** O ticket listava "signed request objects" entre os itens reaproveitados do Open Finance. O FAPI 2.0 Security Profile não os usa: a tabela da seção 5.5 diz que o PAR substitui o JAR na proteção de integridade da requisição. Assinar a requisição no FAPI 2.0 é assunto de outra especificação, o FAPI 2.0 Message Signing [FAPI2-MS], que não adotei. Se você quiser manter a assinatura da requisição, o caminho é acrescentar o Message Signing, com o custo correspondente para o laboratório.

Outras consequências:

- O receptor não precisa mais de chave de cifragem. Ele publica uma chave de assinatura e registra um certificado.
- O laboratório não precisa de OpenID Connect, de `userinfo` nem de emitir `id_token`.
- O `x-fapi-interaction-id` ficou como acréscimo do protocolo. O FAPI 2.0 moveu os cabeçalhos `x-fapi-*` para um documento de orientação que não consultei (item 3 da seção 5).
- `client_credentials` é usado sob os requisitos gerais do FAPI 2.0. A nota 2 da seção 5.3.2.1 admite isso e avisa que só o fluxo de código e o CIBA passaram por análise formal.
- O `state` continua obrigatório por escolha minha, para ligar o retorno à jornada. No FAPI 2.0 ele não é a proteção contra CSRF.
- O escopo dinâmico `consent:{id}` ficou. O FAPI 2.0 recomenda o RFC 9396 quando `scope` não basta (nota 5 da seção 5.3.2.2). Não abri o RFC 9396.

### 2.2 Onde o CPF é devolvido (item 4)

**Escolha: na leitura do consentimento com o token de paciente**, `GET {api_base_url}/consents/{consent_id}`, que nessa condição devolve `patient.cpf` e `patient.fhir_id`. Não na resposta do token.

O motivo vem do próprio texto do FAPI 2.0. A seção 5.3.2.3 diz: se se deseja entregar ao cliente o identificador do usuário autenticado na resposta do token, o servidor de autorização deve suportar OpenID Connect. O CPF do paciente autenticado é exatamente um identificador do usuário autenticado. Pôr o CPF em um membro próprio da resposta do token contornaria essa cláusula. Cumpri-la significaria exigir OpenID Connect e `id_token` de todo laboratório, por causa de um único dado, o que desfaz boa parte do ganho de ter saído do fluxo híbrido.

A leitura do consentimento não tem esse problema. É um recurso protegido como os outros, atrás de um token vinculado ao certificado que só existe porque o paciente aprovou. Também não depende de o consentimento incluir `consent.read` nem do conteúdo do perfil FHIR.

Pelo mesmo raciocínio tirei da resposta do token o id do paciente (`patient`) e o `consent_id`, que eu tinha posto lá na primeira rodada.

O que foi escrito:

| Pedido | Onde está |
| --- | --- |
| Requisito | [04](../especificacao/04-ciclo-de-vida-do-consentimento.md), seção 4.4, "Conferência do titular". Justificativa do canal em [07](../especificacao/07-perfil-de-seguranca.md), seção 7.7 |
| Passo do fluxo | [02](../especificacao/02-fluxos.md), fluxo 2.2, passos 10 e 11, e o diagrama |
| Formato | [05](../especificacao/05-api.md), seções 5.4.2 e 5.4.3 |
| Código de erro | `PATIENT_MISMATCH`: motivo do `DELETE`, `status_reason.code` do consentimento revogado, transição T8. [06](../especificacao/06-erros.md), seção 6.6 |
| Conformidade | Provedor: CNS-005, CNS-011 a CNS-014, CNS-017, AUT-013, AUT-017. Receptor: RCP-011 a RCP-015 |

Pontos que decidi sozinho e que você pode querer mudar:

- **Paciente sem CPF no cadastro do laboratório** não consegue autorizar: `access_denied`, consentimento `REJECTED` com `PATIENT_WITHOUT_CPF`. Isso exclui estrangeiros sem CPF e cadastros antigos incompletos.
- **O erro de quem usa `PATIENT_MISMATCH`.** Para não confundir com a divergência de titular, renomeei o erro de API que antes tinha esse nome (parâmetro `patient` apontando para outro paciente) para `PATIENT_NOT_IN_CONSENT`.
- **O provedor não tem como obrigar o receptor a conferir.** A ordem das chamadas é requisito do receptor (RCP-012, RCP-013), testável com um provedor simulado. Um provedor poderia recusar chamadas FHIR até a leitura do consentimento ter acontecido. Não pus isso, por ser estado a mais no laboratório.
- **A tela de consentimento avisa** que o CPF será confirmado ao aplicativo. Pareceu necessário para o consentimento ser informado.
- **A qualidade da conferência depende do cadastro do receptor.** Se o aplicativo aceita um CPF digitado sem validação, a conferência só garante que os dois lados falam do mesmo número.

### 2.3 Agendamento com pedidos contidos (item 7)

**Escolha:** `POST /Appointment` com os `ServiceRequest` em `contained`, referenciados por `basedOn` com `#id`. Idempotência por criação condicional do FHIR (`If-None-Exist` com o identificador do receptor). Remarcar e cancelar por `PUT` com `If-Match`, sem tocar nos pedidos contidos. Trocar exames é cancelar e criar outro.

Fontes e ressalvas:

- A criação condicional está em [FHIR-HTTP], seção 3.1.0.8.1: sem correspondência o servidor cria (201), com uma correspondência ignora o `POST` e devolve 200. A mesma seção diz que a criação condicional é de uso experimental e que nem todo servidor a implementa. Mantive porque sem ela a repetição depois de falha de rede duplica agendamentos. A obrigação ficou restrita a `Appointment` e ao parâmetro `identifier`.
- A seção 2.3.0.8 de [FHIR-REFS] diz que recursos contidos não têm existência independente e que o recurso NÃO DEVERIA ser contido quando o conteúdo pode ser identificado propriamente. O uso aqui vai contra essa recomendação de forma deliberada, e o texto da seção 5.5.5 diz isso. O argumento é que, neste protocolo, o pedido só existe como parte do agendamento.
- Consequência: `ServiceRequest` deixa de ser endereçável. Não há `GET /ServiceRequest/{id}` (AGD-014).
- A regra "todo recurso contido deve ser referenciado" está no texto como regra do protocolo. Não conferi a invariante correspondente do FHIR (item 12 da seção 5).

### 2.4 Outras mudanças desta rodada

- `schedule.read` passou a escopo de provedor. A agenda é consultada com token `client_credentials`, e o provedor não pode exigir dado de paciente nessa busca (AGE-001).
- Os escopos de paciente são três: `appointment.write`, `results.read`, `consent.read`.
- Coleta domiciliar fora da versão 1, dito em 1.8, 3.6 e 5.5.4.
- Recomendação de biblioteca JOSE em 7.11 e no índice, ancorada na recomendação do próprio FAPI 2.0 de construir sobre implementações existentes (seção 5.1.1).
- Seção 1.6, "Relação com o Open Finance Brasil", com o que é igual e o que é diferente.
- Os identificadores de conformidade foram renumerados. Como nada foi publicado, não tratei isso como quebra da regra de identificadores estáveis, e o texto de 9.2 diz que a regra vale a partir da primeira versão publicada.
- A versão da especificação passou de 0.1.0 para 0.2.0.
- `$id` do schema: `https://open-labs-brasil.example/schemas/registro/1.0/participantes.schema.json`. **O host é provisório.** Usei o domínio de topo `.example` para não inventar um domínio real. Precisa ser trocado quando houver domínio.
- `GOVERNANCE.md` ganhou uma frase dizendo que, enquanto o repositório for privado, "público" significa visível a todos os participantes do piloto.

## 3. Mudanças necessárias no guia de implementação

Atualizado na terceira rodada, contra o ramo principal do guia no remoto (commit `8ffa7b9`, pacote 3.1.0), lido sem alteração. Na quarta rodada, os perfis de agendamento, pedido de exame, consentimento e preço foram relidos no commit `cbfcddf` (versão 3.1.2), também sem alteração. A 0.2.2 não pede mudança obrigatória no guia: o item 7 abaixo foi resolvido no texto da especificação, e o item 10 é recomendação.

**Resolvido no guia**

| Pendência da 0.2.0 | Como ficou no guia |
| --- | --- |
| `basedOn` com agregação `contained` | Feito. `basedOn` é `1..*`, só referência a `br-lab-service-request`, com agregação `contained` |
| Invariantes de pedidos contidos | Feito, três: `br-lab-appointment-contained-request`, `br-lab-appointment-based-on-contained`, `br-lab-appointment-request-subject` |
| Exemplo de agendamento com `contained` | Feito |
| Descrição do escopo `appointment.write` | Feito: diz que o pedido vai contido |
| Conjunto de valores só com escopos de paciente em `Consent.provision.action` | Feito: `lab-access-patient-scope-vs`, com ligação obrigatória |
| `Consent.identifier` para o `consent_id` | Documentado no perfil como identificador dado pelo laboratório, sem sistema fixo |
| Extensão de link de pagamento | Publicada: `PaymentLink`, id `payment-link`, contexto `Appointment`, valor `url`, no máximo uma por agendamento |
| Fatias de participante | Passaram a se distinguir por `actor.type`, o que a especificação agora exige |
| LOINC no código do pedido e do preço | Opcional, com ao menos um `coding` |
| Preço por marca | Fatia `brand` em `useContext`, com sistema de códigos `lab-price-context` |

**Ainda pendente no guia**

1. **Sistema de códigos de `Slot.serviceType`.** O perfil `br-lab-slot` continua restringindo só `schedule`. A busca por cesta da seção 5.5.4 supõe o mesmo código do catálogo. Com LOINC opcional, a regra precisa dizer qual `coding` vale quando há mais de um.
2. **Parâmetros de busca próprios** para preço por exame, por unidade e por marca.
3. **`CodeSystem` com URL canônica para os códigos de erro** e para `status_reason`, hoje em `urn:open-labs-brasil:error-code`.
4. **`CapabilityStatement` de referência** para o provedor.
5. **`Appointment.status`** permitido na criação (`proposed`) e os estados devolvidos. O perfil não restringe.
6. **Invariante "todo pedido contido tem um `basedOn`".** O guia garante que cada `basedOn` aponta para um pedido contido, não o inverso. A especificação exige o inverso como regra do protocolo.
7. **O paciente identificado só por CPF.** *Resolvido na 0.2.2 sem mudar o guia.* O perfil continua admitindo as duas formas. A especificação manda o receptor usar só a referência, sem `identifier`, e o provedor continuar aceitando o CPF enquanto a versão de protocolo for `0.2`. A mudança no perfil que acompanharia a retirada dessa aceitação, numa versão de protocolo posterior, está descrita na seção A.2, ponto 10. Ela é opcional: sem ela, o protocolo continua restringindo por cima do perfil.
8. **As URLs canônicas não devolviam os artefatos.** *Resolvido em 2026-11-17.* O site do guia passou a servir cada recurso, em JSON, na própria URL canônica, com índice em `https://fhir-brasil.dev.br/ig/` e o pacote em `https://fhir-brasil.dev.br/ig/package.tgz`. Conferido em produção: `.../ig/StructureDefinition/payment-link` e `.../CodeSystem/lab-access-scope` respondem 200 com `application/fhir+json`. O pacote continua fora dos registros de pacotes FHIR.
9. **URL canônica do conjunto de valores de escopos de paciente.** *Resolvido em 2026-11-17.* O artefato publicado declara `https://fhir-brasil.dev.br/ig/ValueSet/lab-access-patient-scope-vs`. A especificação continua citando o conjunto pelo id, e pode passar a citar a URL na próxima versão do documento.
10. **Fatiamento de `useContext` no preço (recomendado, da 0.2.2).** A especificação passou a permitir só `venue` e `brand` em `ChargeItemDefinition.useContext` (CAT-005). O perfil `br-lab-charge-item-definition` tem fatiamento aberto, então o validador do guia aceita outros contextos e não pega o desvio. A mudança precisa seria, em `BRLabChargeItemDefinition.fsh`, trocar `* useContext ^slicing.rules = #open` por `* useContext ^slicing.rules = #closed`, e, para exigir a referência, acrescentar `* useContext[venue].valueReference.reference 1..1` e `* useContext[brand].valueReference.reference 1..1`. Só convém se o perfil não tiver uso fora do protocolo que precise de outros contextos.

## 4. Ressalvas que continuam de pé

1. **Cobrança pelo acesso e o art. 11, § 4º.** O § 4º veda o uso compartilhado de dados de saúde entre controladores "com objetivo de obter vantagem econômica", com exceção para "a portabilidade de dados quando solicitada pelo titular". Um laboratório que cobra do receptor por resultados entra nesse terreno. Pede parecer jurídico antes de conversa comercial.
2. **Art. 18 como base.** O inciso V condiciona a portabilidade à regulamentação da autoridade nacional, que não saiu (Q3). O apoio mais firme no texto atual é o consentimento do art. 11, I, com a exceção do § 4º, I.
3. **Exclusão de operadoras só por governança.** O protocolo não impede tecnicamente que um receptor repasse dados. Convém constar também nos termos entre receptor e laboratório.
4. **O CPF agora trafega do laboratório para o aplicativo.** É dado pessoal comum, entregue depois da aprovação do titular e com aviso na tela. A base legal desse envio merece a mesma revisão jurídica.
5. **A raiz de confiança é uma chave do mantenedor, que também é receptor.** Aceito para o piloto.

A ressalva da primeira rodada sobre `schedule.read` exigir consentimento foi resolvida pela decisão 8.

## 5. Não verificado

Nada desta lista é afirmado como fato na especificação.

1. **Qual versão das especificações do Open Finance Brasil está em vigor por norma.** Conferi o que o portal lista como atual. Não abri ato do Banco Central. Com a troca de perfil, isso só afeta a seção 1.6.
2. **FAPI 2.0 Attacker Model e a análise formal** citados pelo FAPI 2.0. Não abertos.
3. **O documento de orientação de implementação do FAPI 2.0**, para onde foram os cabeçalhos `x-fapi-*`. Não aberto.
4. **RFC 9396** (autorização detalhada), recomendado pelo FAPI 2.0 como alternativa ao escopo. Não aberto.
5. **RFC 9525 e RFC 9449.** Baixados, só título e data conferidos. O primeiro é citado por exigência do FAPI 2.0, o segundo é a alternativa não escolhida.
6. **Disponibilidade de produtos de servidor de autorização com FAPI 2.0** e de planos de teste de FAPI 2.0 na suíte de conformidade da OpenID Foundation. Não pesquisei. A orientação de 7.11 de usar um produto que já implemente PAR, PKCE, `private_key_jwt` e tokens vinculados a certificado supõe que eles existam ao alcance de um laboratório.
7. **FAPI-LIP**, citado pelo Open Finance Brasil para o escopo dinâmico. Não aberto. O formato `consent:<id>` foi conferido no perfil do Open Finance.
8. **Documentos da ICP-Brasil.** Conheço só pelo que o padrão de certificados do Open Finance diz deles. Que certificado serviria a laboratórios e aplicativos não foi investigado.
9. **ANPD, além da página da Agenda Regulatória.** Vi em resultado de busca, sem abrir: um parecer da AGU de 2025 sobre a minuta de direitos dos titulares, uma notícia de janeiro de 2025 e a Nota Técnica nº 20/2026. As Resoluções CD/ANPD nº 23/2024 e nº 31/2025 são nomeadas na página da agenda e não foram abertas.
10. **CNPJ alfanumérico.** O schema aceita letras por suposição minha.
11. **HL7 Brasil, SBIS, ABRAMED e Ministério da Saúde.** Nada verificado sobre processo, interesse ou competência. Relação com a RNDS não investigada.
12. **Invariantes do FHIR sobre recursos contidos** além do que está na página de referências (por exemplo, a que exige que todo recurso contido seja referenciado). Não conferida.
13. **Regras da ANS, do CFM e da Anvisa** sobre troca de dados com operadoras, liberação de resultados e pedido médico. Não consultadas.
14. **O nome "Open Labs Brasil".** Não verifiquei registro de marca, domínio disponível nem risco de confusão com o Open Finance Brasil ou com outra iniciativa de mesmo nome.
15. **A reserva do domínio de topo `.example`**, que usei nos exemplos e no `$id` provisório. Não abri a norma que o reserva.
16. **LOINC.** `loinc.org` devolveu 403 na primeira rodada. O código do exemplo foi conferido só no exemplo oficial do FHIR R4.
17. **Renderização dos diagramas no GitHub.** Validados no serviço Mermaid Chart.
18. **Números de exemplo.** CNPJs e CPF com dígitos verificadores válidos, sem conferência de que não são reais.
19. **Conteúdo das URLs canônicas do guia.** Responderam 200 na primeira rodada, sem inspeção do conteúdo.
20. **Sintaxe do parâmetro `near`** de `Location`.

21. **O código do cliente receptor.** Não tive acesso. As diferenças da seção 0.3 marcadas "a conferir" são suposições sobre o que ele pode não fazer.
22. **URL canônica do conjunto de valores `lab-access-patient-scope-vs`** e a publicação dos artefatos do guia nas URLs canônicas (seção 3, itens 8 e 9).
23. **A norma que reserva o domínio `.example`** continua sem ser aberta. O RFC 3986 foi aberto só para a seção 2.3.

24. **Fonte normativa do cálculo dos dígitos verificadores do CPF.** Não abri ato da Receita Federal. A afirmação da seção 4.4 de que as dez sequências de um só algarismo passam no cálculo foi conferida por script, com o cálculo de módulo 11 que o cliente usa, o mesmo que valida o CPF do exemplo (`52998224725`).
25. **Semântica de vários `useContext` no FHIR R4** (se valem juntos ou alternativamente). Não conferida. A regra da 5.5.2 não depende dela: o receptor não trata como geral nem atribui a uma unidade o preço com contexto desconhecido.
26. **O código do servidor de exemplo** no ramo `feat/servidor-de-exemplo-e-suite`. Li só o plano e a lista de arquivos. O que a seção A.4 diz dele é dedução do que a 0.2.2 exige do provedor.

São 26 itens. Os que podem mudar o desenho: 6 (se não houver servidor de autorização acessível com FAPI 2.0, o custo para o laboratório sobe), 8, 9 e 13.

Saíram da lista em relação à primeira rodada: o BCP 195, agora aberto [RFC9325], e a especificação de tipos de resposta múltiplos do OAuth, que deixou de importar sem o fluxo híbrido.

## 6. Questões em aberto

### As três do ticket

**Q1. Os mecanismos de login para parceiros que os laboratórios já têm se encaixam neste fluxo?**
Para perguntar em conversa. Não inferi nada de sistemas de laboratórios. Roteiro, atualizado para o perfil novo:

- O portal do paciente tem um provedor de identidade próprio ou terceirizado? Ele faz OAuth 2.0 com PAR e PKCE? Emite tokens vinculados a certificado?
- O cadastro do paciente tem CPF para todos? O que acontece com quem não tem?
- Há segundo fator no login do paciente?
- Já existe integração com parceiros em que o paciente autoriza algo? Onde a autorização fica registrada?
- A equipe consegue hospedar uma tela de consentimento no próprio domínio, depois do login existente?
- Existe hoje alguma integração em que um parceiro recebe a senha do paciente? Há disposição para encerrá-la?
- A terminação TLS do laboratório consegue passar o certificado do cliente até a aplicação?
- Há servidor FHIR, ou os resultados saem de um sistema de laboratório por outra interface? Os resultados têm LOINC?
- O agendamento online e o pagamento são do próprio laboratório ou de um fornecedor? A agenda pode ser consultada sem identificar o paciente?

**Q2. Que entidade poderia adotar o protocolo?**
Em aberto. `GOVERNANCE.md` lista as quatro do ticket sem afirmar nada sobre elas e fixa condições para a transferência.

**Q3. Uma orientação da ANPD sobre a portabilidade do art. 18 mudaria o modelo de consentimento?**
O que encontrei não mudou desde a primeira rodada: a página de acompanhamento da Agenda Regulatória da ANPD, com tabela atualizada em 12/11/2026, lista a ação "Direitos dos titulares" (arts. 9º, 18, 19 e 20) como "Em andamento", com "Consulta à sociedade: Não realizada até o momento" e "Ação regulatória em fase de elaboração interna" [ANPD-AGENDA]. Não encontrei regulamento nem guia publicado sobre portabilidade.

O art. 40 da LGPD diz: "A autoridade nacional poderá dispor sobre padrões de interoperabilidade para fins de portabilidade, livre acesso aos dados e segurança, assim como sobre o tempo de guarda dos registros, tendo em vista especialmente a necessidade e a transparência." [LGPD]

Minha leitura do risco, que não é parecer jurídico: um regulamento poderia mexer na forma do pedido (a lei fala em "requisição expressa", papel que o consentimento do protocolo cumpre), em prazos de atendimento, na gratuidade (o § 5º do art. 18 fala em atendimento "sem custos para o titular") e no formato, já que o art. 40 permite fixar padrões de interoperabilidade. Iniciativa do paciente, autenticação no laboratório, escopos, prazo e revogação pelos dois lados me parecem compatíveis com qualquer desfecho razoável.

### Outras

**Q4. Papéis de tratamento** de laboratório e receptor, e base legal do envio do CPF. Pede revisão jurídica.

**Q5. Pedido médico.** A versão 1 não transporta o pedido. Com os pedidos contidos no agendamento, anexar o documento exigiria mais um recurso contido ou uma referência.

**Q6. Menores, responsáveis legais e pacientes sem CPF.** Fora da versão 1. A exigência de CPF tornou a exclusão mais visível.

**Q7. Política de liberação de resultados.** Falta confirmar com um laboratório se "liberado no portal" é um evento bem definido nos sistemas deles.

**Q8. Operação do registro em produção** e revogação da chave do registro.

**Q9. Perfil de certificado ICP-Brasil para produção.**

**Q10. Grupos com várias marcas.** Uma entrada de provedor por CNPJ, por marca ou por servidor de autorização?

**Q11. Governança.** Assento de pacientes, forma da declaração de origem das contribuições, política de patentes para o texto.

**Q12. Domínio.** Onde publicar o registro, o `$id` definitivo do schema e um eventual `CodeSystem` de erros.

**Q13. Assinatura da requisição.** Confirmar que sair do objeto de requisição assinado é aceitável (seção 2.1), ou adotar o FAPI 2.0 Message Signing.

**Q14. Nível de autenticação.** Sem `acr`, o receptor não sabe se o paciente usou um ou dois fatores. Se isso importar, as saídas são OpenID Connect só na resposta do token ou um campo no consentimento.

## 7. O que foi e o que não foi validado por máquina

**Validado na quarta rodada (0.2.2)**

- Blocos Mermaid: um script comparou os nove blocos com os de `origin/main`. Mudaram dois, o fluxo 2.6 e o diagrama de estados da seção 4.2. Os dois passaram no validador do Mermaid Chart, e o código aprovado é idêntico ao dos arquivos. Os outros sete não mudaram.
- Schema e exemplo de registro, com Ajv 8.18 (rascunho 2020-12, modo estrito padrão): o exemplo valida. Sete variações inválidas são recusadas, entre elas `["0.2", "0.3"]` e `["0.2", "1.0"]` em `protocol_versions`, que o schema de `main` aceitava. A lista `["1.0", "1.2"]` continua aceita, porque a regra é só da fase 0. Com `strict: true` explícito, o Ajv acusa `strictRequired` no bloco `allOf` que separa provedor e receptor, e o schema de `main` acusa o mesmo: não é desta rodada.
- O exemplo de registro e a assinatura não mudaram. A assinatura PS256 verifica, o `kid` é o thumbprint da chave, e o segundo campo do JWS está vazio. Nenhuma chave nova foi gerada.
- Cabeçalho do JWS: com a biblioteca jose 6.2.17, a verificação compacta aceita `typ` igual a `JWT` com membro a mais e recusa `crit` desconhecido (`ERR_JOSE_NOT_SUPPORTED`), com uma chave RSA gerada em memória e descartada.
- CPF: as dez sequências de um só algarismo passam no cálculo dos dígitos verificadores, conferido por script.
- Identificadores de conformidade, contra `origin/main`: os 162 continuam presentes, na mesma ordem e com o mesmo texto, salvo a coluna de teste de REG-010, que ganhou uma frase. Foram acrescentados 22 (18 na primeira versão deste PR, 4 nas correções da seção A.5), sem repetição e em sequência contínua dentro de cada prefixo. Total 184, 2 retirados, 182 em vigor.
- Links relativos de todos os Markdown resolvem para arquivos existentes. Todo bloco JSON dos Markdown é JSON válido. Todo rótulo de fonte da especificação está em `docs/FONTES.md`. Nenhum travessão (nem meia-risca) e nenhuma chave dupla.
- `docs/FONTES.md` tinha, desde a 0.2.1, uma cópia quase inteira do próprio arquivo colada no meio da linha de [FHIR-SEARCH], onde deveria estar o caractere `$`. O trecho foi tirado e a linha voltou ao texto pretendido.

**Validado na terceira rodada (0.2.1)**

- Os dois blocos Mermaid alterados (fluxos 2.2 e 2.6) passaram no validador do Mermaid Chart. Os outros sete não mudaram desde a validação anterior. Um script comparou os nove blocos dos arquivos com o código aprovado, e os nove coincidem.
- O exemplo de registro foi gerado de novo (versões e caminho corrigidos, chave de exemplo nova) e valida contra o schema alterado, com Ajv 8 em modo estrito. As cinco variações inválidas continuam rejeitadas. A assinatura destacada verifica, o `kid` confere com o thumbprint e o `x5t#S256` com o certificado. A chave privada nova foi gerada em memória e descartada.
- Identificadores de conformidade: os 141 da 0.2.0 continuam presentes, com o mesmo número e na mesma ordem, e 21 foram acrescentados (162 no total, 2 marcados como retirados). Conferido por script contra o commit `e3b2a5e`.
- Links relativos, blocos JSON, rótulos de fonte e ausência de travessões e de chaves duplas, pelos mesmos scripts.
- Não validado: os exemplos de `Appointment` contra o perfil publicado, com o validador FHIR.

**Validado na segunda rodada (0.2.0)**

- Os seis blocos Mermaid alterados nesta rodada (fluxos 2.1, 2.2, 2.3, 2.4 e 2.8 e o diagrama de estados) foram submetidos ao validador do Mermaid Chart e voltaram como válidos. Os três que não mudaram (2.5, 2.6, 2.7) tinham sido validados na primeira rodada. Um script comparou, bloco a bloco, o código dos nove blocos dos arquivos com o código que o validador aprovou, e os nove coincidem.
- `participantes.exemplo.json` valida contra `participantes.schema.json` com Ajv 8 em modo estrito (rascunho 2020-12), agora com `$id`, usando uma instalação já existente na máquina. Cinco variações inválidas foram rejeitadas.
- A assinatura destacada do exemplo verifica (PS256). O `kid` confere com o thumbprint do RFC 7638 e o `x5t#S256` com o certificado. O arquivo de exemplo não mudou nesta rodada.
- Unicidade dos identificadores de conformidade e a contagem (141).
- Links relativos entre arquivos: todo destino existe.
- Busca de texto: nenhum marcador de nome pendente (chaves duplas) e nenhum travessão em todo o diretório.
- Todo bloco marcado como JSON nos arquivos Markdown é JSON sintaticamente válido.
- Todo rótulo de fonte usado na especificação existe em `docs/FONTES.md`.
- `LICENSE` é idêntico, byte a byte, ao texto baixado de apache.org.

**Não validado**

- Os exemplos JSON dos arquivos Markdown contra schemas ou perfis. O `Appointment` com pedidos contidos não foi validado com o validador FHIR nem contra o perfil `br-lab-appointment`.
- Nenhum fluxo foi executado. Não existe implementação de referência.
- O schema não foi testado com outro validador.
- As âncoras dos links (só a existência do arquivo).
- A renderização no GitHub.

## 8. O que convém resolver antes do primeiro commit (segunda rodada)

Nada impede tecnicamente o commit em repositório privado. Estes pontos eu resolveria antes, ou registraria como pendência conhecida no próprio commit:

1. **Confirmar a saída do objeto de requisição assinado** (seção 2.1 e Q13). É a única mudança desta rodada que contraria um item do ticket original, e decorre da troca de perfil.
2. **Confirmar o canal do CPF** (seção 2.2). Você deu duas opções. Escolhi a leitura do consentimento por causa da seção 5.3.2.3 do FAPI 2.0.
3. **O nome.** Não verifiquei marca nem domínio (item 14 dos não verificados). Trocar o nome depois do primeiro commit é barato em repositório privado e caro depois de aberto.
4. **O `$id` provisório do schema** e a ausência de URL de publicação do registro. Estão marcados no schema, em 8.1 e aqui.
5. **Este arquivo e `docs/FONTES.md` ficam no histórico.** Este arquivo é de trabalho e nomeia pendências jurídicas. Enquanto o repositório for privado, tudo bem. Se a intenção for abrir o mesmo repositório depois, convém decidir agora se ele entra no primeiro commit ou fica fora.
6. **Contato de segurança.** `GOVERNANCE.md`, seção 4.3, manda comunicar falhas "ao contato de segurança do repositório", que ainda não existe. Falta um endereço.
7. **Regra de licença para exemplos embutidos.** O README diz que trechos de código e JSON dentro do texto podem ser usados sob Apache 2.0. É uma decisão minha para evitar dúvida, e não estava no ticket.
8. **Não há arquivo de mudanças** nem instruções de contribuição. `GOVERNANCE.md` cita um arquivo de mudanças na raiz. Dá para criar no segundo commit.

## 9. Critérios de aceite desta rodada

| Critério | Situação | Evidência |
| --- | --- | --- |
| Nome trocado em todo lugar, identificadores com `open-labs-brasil` | Cumprido | Busca por chaves duplas sem resultado |
| Mantenedor nomeado em `GOVERNANCE.md` e onde o mantenedor atual aparece | Cumprido | `GOVERNANCE.md`, `README.md`, seção 1.4 |
| Perfil FAPI 2.0, com capítulo de segurança, fluxos, diagramas, API, erros e conformidade reescritos | Cumprido | Capítulos 02, 05, 06, 07, 09 |
| Seção "Relação com o Open Finance Brasil" | Cumprido | Seção 1.6 |
| CPF: não enviado na criação, devolvido por canal de servidor, conferido pelo receptor, com requisito, passo, código e conformidade | Cumprido | Seção 2.2 deste arquivo |
| Desenho antigo de CPF na criação removido | Cumprido | Busca por `patient.cpf` na criação: só aparece como algo a recusar |
| Consentimento de até 12 meses, sem renovação silenciosa | Cumprido | Seção 4.4 |
| Registro assinado como única raiz, limitação declarada | Cumprido | Seções 7.10 e 8.5 |
| Agendamento com `ServiceRequest` contido, com nota sobre o perfil | Cumprido | Seção 5.5.5 e seção 3 deste arquivo |
| `schedule.read` como escopo de provedor | Cumprido | Capítulos 02, 03, 05, 09 |
| Coleta domiciliar fora do escopo, dito no capítulo de escopos | Cumprido | Seção 3.6 |
| Recomendação de biblioteca JOSE | Cumprido | Seção 7.11 e índice |
| README, LICENSE, licença do texto, `docs/` | Cumprido | Raiz do diretório |
| Notas atualizadas, com estado de cada decisão e lista de não verificados | Cumprido | Seções 1 e 5 |
| Toda afirmação nova conferida na fonte e citada com data de 2026-11-16 | Cumprido | `docs/FONTES.md`, linhas marcadas |
| Revalidação | Cumprido | Seção 7 |
| Sem `git init`, sem commit, sem tocar outros repositórios | Cumprido | Só leitura em outros diretórios |
