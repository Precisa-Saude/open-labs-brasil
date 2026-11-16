# Mudanças

Histórico das versões da especificação do Open Labs Brasil. O significado de cada parte do número de versão está em [especificacao/09-versionamento-e-conformidade.md](especificacao/09-versionamento-e-conformidade.md), seção 9.1.

Enquanto o MAJOR for 0, um PATCH pode fixar um comportamento que antes ficava a critério de quem implementava. Esses casos vêm marcados com **(fixa comportamento)**.

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
