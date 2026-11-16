# Mudanças

Histórico das versões da especificação do Open Labs Brasil. O significado de cada parte do número de versão está em [especificacao/09-versionamento-e-conformidade.md](especificacao/09-versionamento-e-conformidade.md), seção 9.1.

Enquanto o MAJOR for 0, um PATCH pode fixar um comportamento que antes ficava a critério de quem implementava. Esses casos vêm marcados com **(fixa comportamento)**.

## 0.2.2, 2026-11-17

Decide os catorze pontos em que o cliente receptor, ao ser atualizado para a 0.2.1, achou o texto ambíguo, omisso ou incoerente. A versão de protocolo continua `0.2`.

Em dois pontos (8 e 10) a regra mais estrita cortaria a comunicação com uma implementação da 0.2.0 ou da 0.2.1 que tivesse lido o texto anterior de outro jeito. Nesses, a 0.2.2 fixa só o que não quebra e deixa o resto para a próxima versão de protocolo. A seção 9.1 passou a dizer que um PATCH funciona assim.

### Comportamento, ponto a ponto

1. **Cabeçalho da assinatura do registro (fixa comportamento, provedor e receptor, como verificadores).** `typ` diferente de `JOSE` e membros a mais no cabeçalho são ignorados, nenhum membro além de `kid` serve para obter a chave, e `crit` presente leva à recusa (passo V3). Seção 8.3, REG-011.
2. **Uma versão por participante na fase 0 (nenhum comportamento muda).** O schema do registro passou a recusar a lista de `protocol_versions` que traz uma versão `0.x` junto com outra. O texto já proibia isso. Quem valida o registro contra o schema passa a recusar o documento com esse erro (REG-003). Seção 8.2, schema, coluna de teste de REG-010.
3. **Quando gravar a revogação (fixa comportamento, receptor).** A revogação é gravada em armazenamento durável no momento em que é decidida, antes da primeira tentativa, e não só depois das três. Seção 4.4, fluxo 2.6, RCP-038.
4. **404 sem código na revogação (fixa comportamento, receptor).** Só o 404 com `CONSENT_NOT_FOUND` no `OperationOutcome` encerra a pendência. Seções 4.4 e 6.4, RCP-039.
5. **Falha que não admite repetição (fixa comportamento, receptor).** `invalid_client`, `unauthorized_client`, outros 4xx (salvo 429 e 401 `TOKEN_INVALID`, que admitem repetição) e as condições locais que impedem a chamada encerram as tentativas automáticas na hora, e a revogação fica pendente. Seção 4.4, RCP-040.
6. **`Retry-After` longo (fixa comportamento, provedor e receptor).** O receptor pode ter um teto de espera. Acima dele, as tentativas automáticas terminam e a revogação fica pendente. Nenhuma tentativa acontece antes do instante indicado, mas na revogação um `Retry-After` vale por no máximo 24 horas, e o provedor não envia valor maior nesses endpoints. Seções 4.4, 6.4 e 6.5, RCP-041, RCP-050, ERR-007.
7. **CPF de onze algarismos iguais (fixa comportamento, provedor e receptor).** Passa no cálculo dos dígitos verificadores e mesmo assim é inválido. O provedor trata o paciente com CPF inválido no cadastro como paciente sem CPF (T5). O receptor o trata como inválido no CPF recebido e no do paciente, e com o do paciente inválido a jornada não começa. Seção 4.4, CNS-025, RCP-042.
8. **Paginação (fixa comportamento, provedor e receptor).** O provedor emite links absolutos `https` sem componente de usuário. O receptor recusa link com componente de usuário. Link relativo: na 0.2 o receptor resolve contra a URL da requisição e aplica à URL resultante as mesmas conferências. A recusa do link relativo fica para a próxima versão de protocolo. Seção 5.1, API-013, RCP-043, RCP-051.
9. **Domínio do link de pagamento (fixa comportamento, receptor, só no caso de extensão repetida).** O domínio é obrigação do provedor, e o receptor não é obrigado a conferi-lo, porque o registro não lista domínios. Com mais de uma extensão `payment-link`, o receptor não abre nenhuma. Seção 5.5.5, RCP-044.
10. **Paciente no agendamento (fixa comportamento, receptor; provedor sem mudança).** O receptor identifica o paciente só por `Patient/{fhir_id}`, sem `identifier`. O provedor continua aceitando o paciente só por CPF enquanto a versão de protocolo for `0.2`. O perfil do guia não muda. Seção 5.5.5, RCP-045.
11. **Versão que o software não implementa (fixa comportamento, provedor e receptor).** A versão efetiva que o próprio software não implementa conta como inexistente. O receptor também não se comunica com provedor cujo `api_base_url` não termina em `/v{M}`. Seção 9.1, REG-012, RCP-046.
12. **Código de jornada aberta antes do vencimento do registro (fixa comportamento, receptor; provedor sem mudança).** Com o registro local expirado, o receptor não troca o código. O provedor já recusava a concessão `authorization_code` nessa situação, e isso agora está escrito. Seção 8.3, fluxo 2.2, REG-013, RCP-047.
13. **Provedor suspenso e revogação (fixa comportamento, receptor).** Nenhuma chamada a provedor fora de `active` ou sem versão efetiva, nem para revogar. As pendências esperam, com a página do provedor à vista do paciente. A frase da seção 9.1 que dizia o contrário foi corrigida. Seções 8.4, 9.1 e 4.4, RCP-048.
14. **Contexto de preço desconhecido (fixa comportamento, provedor e receptor).** O provedor só usa `venue` e `brand` em `useContext`, com referência. O receptor não trata como geral o preço com contexto que não reconhece. Seção 5.5.2, CAT-005, RCP-049.

### Correções antes da publicação

O cliente atualizado para o rascunho da 0.2.2 achou quatro problemas no próprio texto da 0.2.2, corrigidos antes de ela entrar no ramo principal:

- **Item 4 da revogação pendente contradizia o item 3.** Chamava de não repetível todo 4xx do `DELETE`, inclusive 429 e 401 `TOKEN_INVALID`, que o item 3 dá como repetíveis. Agora os dois ficam fora. A regra 5 da seção 6.4 dizia o mesmo de códigos desconhecidos e também foi corrigida (receptor).
- **`Retry-After` sem limite.** Um único cabeçalho podia adiar a revogação indefinidamente. Agora vale por no máximo 24 horas na revogação, e o provedor não envia mais que 86400 segundos nos endpoints dela. Seções 4.4, 5.1 e 6.5, RCP-050, ERR-007 (provedor e receptor).
- **Revogação achada no reinício e outra instância.** `DELETE` repetido ou concorrente é inofensivo e esperado: 204 numa chamada, 422 `CONSENT_INVALID_STATE` nas outras, e as duas encerram a pendência. O receptor não precisa de trava entre instâncias, e o provedor aplica a transição uma só vez. Seção 4.4, CNS-026 (provedor).
- **Link relativo.** A 0.2.2 deixava o receptor recusar ou resolver, mas recusar corta a paginação com um provedor da 0.2.0 ou da 0.2.1 que emite link relativo, o que o FHIR R4 admite. Agora o receptor DEVE resolver e conferir a URL resultante. Seção 5.1, RCP-051 (receptor).
- O texto de RCP-041, ainda não publicado, ganhou a referência ao limite de 24 horas. O teste dele não mudou.

### Requisitos de conformidade

- Acrescentados: REG-011 a REG-013, CNS-025, CNS-026, API-013, CAT-005, ERR-007 e RCP-038 a RCP-051.
- Retirados: nenhum. Nenhum identificador foi renumerado. REG-010 manteve o texto e ganhou um teste a mais.

### Registro

- O exemplo de registro e a assinatura dele não mudaram. O schema mudou só para conferir uma regra que o texto já tinha, e por isso `schema_version` continua `0.1` e o `$id` é o mesmo.

### Documentação

- `docs/FONTES.md` tinha um trecho duplicado no meio da linha de [FHIR-SEARCH]. Foi corrigido.

## 0.2.1, 2026-11-16

Esclarecimentos pedidos pela primeira implementação de um cliente receptor, que encontrou pontos ambíguos ou omissos na 0.2.0. A versão de protocolo continua `0.2`.

### Comportamento

- **Registro expirado e revogação (fixa comportamento, lado do provedor).** Nos 7 dias seguintes ao vencimento do registro, o provedor aceita `client_credentials` com `consent.manage` como único escopo, só para consultar e revogar consentimentos. Antes, o texto bloqueava toda concessão e, com isso, a revogação pedida pelo paciente. Seção 8.3, erro `REGISTRY_EXPIRED`, requisitos REG-008 e RCP-033.
- **Revogação pendente (fixa comportamento, lado do receptor).** "Repetir até conseguir" virou: três tentativas automáticas, depois pendência durável, repetida em calendário e mostrada ao paciente com o endereço da página do provedor. Seção 4.4, requisitos RCP-028 e RCP-029.
- **Conferência do titular impossível (fixa comportamento, lado do receptor).** Se a leitura do consentimento falha ou vem sem CPF válido, o receptor não conclui o vínculo e revoga com `RECEIVER_TERMINATION`, não com `PATIENT_MISMATCH`. Seções 4.4 e 6.6, requisito RCP-027.
- **Paginação (fixa comportamento, dos dois lados).** Links de paginação ficam dentro do `fhir_base_url` do registro, e o receptor não segue os que saem dele. Seção 5.1, requisitos API-012 e RCP-030.
- **Metadados do servidor de autorização (fixa comportamento, dos dois lados).** A lista de campos obrigatórios e seus valores passou a ser explícita, e o receptor recusa o provedor que não os traz. Seção 5.2, requisitos AUT-026 e RCP-031.
- **Tokens de provedor (fixa comportamento).** O provedor aceita pedido com um único escopo. O receptor pede `consent.manage` sempre sozinho e, por recomendação, um token por escopo. Seção 5.3.4, requisitos AUT-027 e RCP-032.
- **Uso do token de acesso (fixa comportamento, lado do receptor).** Nunca depois de `expires_in`. Seção 5.3.4, requisito RCP-034.
- **`If-None-Exist` (fixa comportamento, dos dois lados).** Formato do cabeçalho e conjunto de caracteres do identificador do receptor. Seção 5.5.5, requisitos AGD-015, AGD-017 e RCP-036.
- **Link de pagamento (fixa comportamento, dos dois lados).** Trafega só na extensão `https://fhir-brasil.dev.br/ig/StructureDefinition/payment-link` do `Appointment`. Seção 5.5.5, requisitos AGD-016 e RCP-035.
- **Verificação do registro.** As regras que estavam fora da lista numerada (validade máxima, `kid` igual ao thumbprint) entraram em uma lista única de catorze passos, que também passou a conferir o algoritmo do cabeçalho, o ambiente e a unicidade de `participant_id`. Seção 8.3, requisito REG-007.

### Versões

- A especificação é `0.2.x`, e o exemplo de registro declarava `1.0` com caminho `/v1`. Agora: versão de protocolo `0.2`, caminho `/v0`, versão do formato do registro `0.1`. A seção 9.1 define os quatro números e o que cada um significa.
- Negociação de versão definida, inclusive quando o MAJOR coincide e nenhum MINOR é idêntico. Na fase 0, MINOR diferente não se comunica. Seção 9.1, requisitos REG-009, REG-010 e RCP-037.

### Alinhamento com o guia de implementação

- Participantes do agendamento distinguidos por `actor.type`, que passa a constar do exemplo e das regras.
- As três invariantes de pedidos contidos do perfil `br-lab-appointment` citadas pelo nome.
- LOINC opcional no código do pedido, com ao menos um `coding`.
- Contexto de marca nos preços.
- Conjunto de valores dos escopos de paciente (`lab-access-patient-scope-vs`).

### Exemplo de registro

- `participantes.exemplo.json` foi gerado de novo com as versões corrigidas e assinado com uma chave de exemplo nova. O `kid` mudou. Quem usava o exemplo da 0.2.0 como vetor de teste precisa atualizá-lo.
- O `$id` do schema passou a `.../schemas/registro/0.1/participantes.schema.json`, ainda em host provisório.

### Requisitos de conformidade

- Acrescentados: REG-007 a REG-010, AUT-026, AUT-027, API-012, AGD-015 a AGD-017, RCP-027 a RCP-037.
- Retirados: REG-006 (substituído por REG-008) e RCP-014 (substituído por RCP-028).
- Nenhum identificador foi renumerado.

## 0.2.0, 2026-11-16

Primeira versão no repositório. Perfil de segurança FAPI 2.0 Security Profile, conferência do titular pelo receptor, agendamento com pedidos contidos, `schedule.read` como escopo de provedor.

## 0.1.0, 2026-11-15

Rascunho inicial, anterior ao repositório. Perfil de segurança baseado no do Open Finance Brasil (FAPI 1.0 Advanced). Não foi publicado.
