# Pontos da especificação encontrados na implementação

Lista de trabalho, da implementação do servidor de exemplo e da suíte de conformidade contra a versão 0.2.1, conferida depois contra a 0.2.2 (PR #2, commit `4c8cb76`). Os capítulos da especificação não foram alterados aqui. Em cada ponto, o servidor de exemplo seguiu a leitura mais conservadora, e a suíte não reprova um provedor que siga a outra leitura possível, salvo onde está dito.

## Situação de cada ponto na 0.2.2

Nenhum dos 28 pontos foi resolvido por inteiro pela 0.2.2. Dois foram em parte, e um ficou mais nítido. Os demais continuam em aberto, com a mesma leitura no servidor de exemplo.

| # | Situação na 0.2.2 |
| --- | --- |
| 1 | **Em aberto, e mais nítido.** A tabela de 8.3 ainda diz que a renovação por refresh token "PODE continuar" nos 7 dias, e a regra logo abaixo agora diz que o provedor recusa "as demais concessões com `unauthorized_client`, inclusive `authorization_code`". 6.2.1 não mudou. O servidor continua recusando |
| 2 | Em aberto. 5.3.4 e 3.3 continuam falando só da obrigação do receptor |
| 3 a 18 | Em aberto. Nenhuma das seções citadas mudou nesses pontos. A 0.2.2 tocou 5.5.2 (contextos de preço) e 5.5.5 (paciente por referência, link de pagamento), mas não a região de preço (4), o número de horários (7), o exame fora do horário (8), a extensão enviada na criação (9) nem a ordem dos erros (10) |
| 19 | **Resolvido em parte.** A 0.2.2 diz que o domínio do link de pagamento é obrigação do provedor (AGD-007) e que o receptor não confere, porque o registro não lista domínios. Do lado do provedor, "domínio do provedor" continua sem definição, e a suíte mantém a heurística |
| 20 a 24 | Em aberto (testabilidade). REG-004, V5, REG-009 1.x, AGD-005 e o 503 de ERR-005 não mudaram. ERR-007, novo, também pede provocar 429 e 503 "no ambiente de teste" |
| 25 | **Resolvido em parte.** A nota da quarta rodada em `docs/NOTAS-DE-REVISAO.md` agora diz que o Ajv acusa `strictRequired` com `strict: true` explícito. O schema continua com o mesmo padrão, e a validação aqui segue sem `strictRequired` |
| 26 a 28 | Em aberto |

Pontos novos, da implementação da 0.2.2:

| # | Ponto | Onde | Leitura adotada |
| --- | --- | --- | --- |
| 29 | "Mantém o `status_reason` da primeira chamada" em `DELETE` concorrente: por fora, a primeira chamada não é observável | 4.4, CNS-026 | A suíte exige pelo menos um 204, nenhum 409 ou 5xx, e, quando só um `DELETE` recebe 204, que o motivo gravado seja o dele. No `DELETE` repetido em sequência, exige 422 e o motivo da primeira |
| 30 | `crit` e bibliotecas JOSE | 8.3, REG-011 | O `jose` já recusa `crit` desconhecido na verificação da assinatura (V6), antes de qualquer conferência própria de V3. Um verificador baseado em biblioteca estabelecida cumpre REG-011 sem código a mais. A violação deliberada do servidor precisou instruir a biblioteca a aceitar a extensão |
| 31 | Como testar REG-012 contra um provedor | 9.1, REG-012 | Exige mudar a entrada do próprio provedor no registro de teste. A suíte publica um candidato em que o provedor e o sentinela declaram `0.9`, observa a recusa do sentinela e restaura |
| 32 | `api_base_url` terminado em `/v{M}` | 8.2, 9.1 | A 0.2.2 dá ao receptor a recusa (RCP-046), mas não há requisito de provedor sobre a própria entrada. A suíte confere a entrada do provedor dentro de REG-012 |
| 33 | ERR-007 só é provocável se o provedor limita chamadas no `DELETE` ou tem um modo de indisponibilidade no ambiente de teste | 6.5, ERR-007 | Sem 429 nem 503 provocados, o teste termina não verificável |

## Contradições ou lacunas que mudam comportamento

| # | Ponto | Onde | Leitura adotada | Sugestão |
| --- | --- | --- | --- | --- |
| 1 | Renovação por refresh token com o registro expirado. A tabela de 8.3 diz que ela "PODE continuar" nos 7 dias; 6.2.1 manda responder `unauthorized_client` quando o registro está expirado e o pedido não é `client_credentials` só com `consent.manage` | 8.3, 6.2.1 | O servidor recusa a renovação com `unauthorized_client` durante todo o modo restrito. A suíte não testa a renovação nesse período | Escolher uma das duas e alinhar o outro trecho |
| 2 | `consent.manage` junto com outros escopos. O receptor NÃO DEVE pedir (RCP-032), mas o que o provedor faz com o pedido não está escrito | 5.3.4, 3.3 | O servidor recusa com `invalid_scope` | Dizer se o provedor recusa ou atende |
| 3 | Asserção com `iat` entre 10 e 60 segundos no futuro: DEVE aceitar até 10 e DEVE recusar acima de 60, sem regra para o meio | 7.2 | O servidor recusa acima de 10 segundos. A suíte só testa +8 (aceito) e +90 (recusado) | Fixar um limite só |
| 4 | Região de preço. O preço por marca e região aponta para um `Location` de região, mas 3.5 exige que todo recurso devolvido declare o perfil correspondente e valide contra ele, e o exemplo do guia usa um `Location` base para a região | 3.5, 5.5.2 | O servidor serve a região com o perfil `br-lab-location` (`physicalType` `area`, endereço e coordenadas aproximadas), e ela aparece na busca de `Location` junto com as unidades | Dizer se a região é servida e com qual perfil, ou se as unidades bastam |
| 5 | Página de erro da autorização sem status definido. "O servidor mostra uma página de erro" não diz o status | 5.3.3, 6.2.2 | O servidor responde 400. A suíte aceita qualquer 4xx e marca como não verificável quando vem 200, porque não dá para distinguir página de erro de página de login | Fixar 400 |
| 6 | `Accept` obrigatório, sem dizer se `*/*` ou a ausência do cabeçalho são aceitos | 5.1, 6.3.2 | O servidor exige o tipo exato na lista do `Accept` (`application/fhir+json` ou `application/json`) e responde 406 caso contrário, inclusive no `/metadata` | Dizer se `*/*` serve |
| 7 | Agendamento com mais de um horário. `Appointment.slot` é lista, e nada diz quantos | 5.5.5 | O servidor exige exatamente um | Fixar um, ou dizer como vários se combinam |
| 8 | Exame que a unidade coleta, mas não no horário escolhido (por exemplo, curva glicêmica só até as 8h). Não há código para isso no agendamento | 5.5.5, 6.3.4 | 422 `EXAM_NOT_AVAILABLE_AT_LOCATION`, com o exame em `diagnostics` | Ampliar a descrição do código, ou criar outro |
| 9 | Receptor que envia a extensão `payment-link` na criação. O receptor NÃO DEVE, mas a reação do provedor não está escrita | 5.5.5 | 422 `INVALID_RESOURCE` | Dizer se o provedor recusa ou ignora |
| 10 | Precedência entre `PATIENT_NOT_IN_CONSENT` e `INVALID_RESOURCE`. O teste de AGD-006 troca o paciente "em cada lugar", o que quebra também a invariante `br-lab-appointment-request-subject` | 5.5.5, 9.3 | O servidor confere as referências ao paciente antes das invariantes do perfil | Dizer a ordem |
| 11 | Repetição da criação condicional quando o identificador já existe com outro paciente do mesmo receptor | 5.5.5 | 200 sem corpo, para não devolver dado de outro paciente ao token | Dizer o que vai no corpo do 200 |
| 12 | Busca de `Appointment` sem `patient`. A tabela pede `patient`, mas 5.5.5 manda buscar por `identifier` depois de um 200 | 5.5.5 | O servidor aceita `identifier` sem `patient`, restrito ao paciente do token | Dizer que `patient` é opcional nessa busca |
| 13 | `GET /Patient` sem id ("não há busca de pacientes") sem status | 5.5.7 | 405 `METHOD_NOT_ALLOWED` | Fixar o status |
| 14 | Datas sem fuso nas buscas (`start=ge2026-11-20`) | 5.5.4 | Fuso de Brasília, UTC-3 | Fixar o fuso, ou exigir data e hora com fuso nas buscas de horário |
| 15 | Limite de 12 meses do consentimento sem definição de mês | 4.4 | Mesmo dia e hora do mês, 12 meses depois, em UTC | Dizer se é calendário ou 365 dias |
| 16 | `Slot.serviceType` com mais de um `coding` por exame (LOINC e código próprio) | 5.5.4 | O horário lista todos os `coding` do item do catálogo, e a busca aceita qualquer um deles | Já marcado como pendência do guia |

## Pontos de forma e de testabilidade

| # | Ponto | Onde | Observação |
| --- | --- | --- | --- |
| 17 | Sistema do identificador do receptor em `Consent.provision.actor` | 5.5.8 | O perfil aceita `Organization` ou `Device` e não há sistema para o `participant_id`. O servidor usa `urn:open-labs-brasil:participant-id`, que é um identificador inventado aqui |
| 18 | Sistema de `Consent.identifier` | 5.5.8 | Sem sistema fixo no perfil. O servidor usa `{api_base_url}/consents` |
| 19 | "Domínio do provedor" do link de pagamento | 5.5.5, AGD-007 | Não está definido. A suíte aceita o mesmo host de algum endereço do provedor no registro, ou o mesmo domínio registrável (os dois últimos rótulos, ou três sob sufixos como `com.br`), sem usar a lista pública de sufixos |
| 20 | REG-004 pede observar as buscas por 2 horas | 9.3 | A suíte adianta o relógio do provedor pela interface de controle e espera a busca. Um provedor que agenda pelo relógio real fica não verificável |
| 21 | REG-007 cita "`kid` diferente do thumbprint" | 8.3, 9.3 | V5 não é testável por fora: exigiria uma chave com `kid` errado no documento já aceito. A suíte testa o mesmo defeito em V13, nas chaves do candidato |
| 22 | REG-009 cita o caso `1.1` com `1.3` | 9.3 | Não se aplica a um provedor `0.2`. A suíte testa `0.2` com `0.3` |
| 23 | AGD-005 fala em "dois clientes disputam o mesmo horário" | 9.3 | A suíte usa o mesmo cliente com dois identificadores. O efeito no horário é o mesmo |
| 24 | ERR-005 pede provocar 503 | 9.3 | Só dá para provocar com algo do ambiente de teste. A interface de controle do servidor de exemplo tem uma operação de indisponibilidade simulada |
| 25 | O schema do registro não compila no Ajv 8.20 com `strict: true` completo: a opção `strictRequired` reclama do padrão `not` com `required` em `allOf` | `registro/participantes.schema.json` | A validação usa o modo estrito sem `strictRequired`. O padrão é válido em JSON Schema; a nota em `docs/NOTAS-DE-REVISAO.md`, seção 7, que diz "modo estrito", deveria dizer qual |
| 26 | Código de erro do token depois de revogação ou expiração | 6.3.1, CNS-016, CNS-019, API-005 | A tabela tem `CONSENT_REVOKED` e `CONSENT_EXPIRED`, mas os requisitos só pedem 401. Um provedor que apaga os tokens responde `TOKEN_INVALID`. A suíte aceita os três, sempre com 401 e `invalid_token`. Convém dizer se o código específico é obrigatório |
| 27 | Jornada do paciente na suíte | 9.3 | Concluir a jornada exige login. A suíte percorre formulários HTML simples ou usa a interface de controle. Provedores com login em JavaScript ou com segundo fator vão precisar da interface de controle no ambiente de homologação |
| 28 | Testes que dependem do ambiente de teste | 9.3 | CAT-003, RES-006, CNS-006, CNS-019, AGD-008 e outros pedem que o laboratório controle o relógio ou os dados. A especificação poderia definir, como anexo informativo, uma interface de controle de teste parecida com a do servidor de exemplo, para que a suíte seja a mesma em todo laboratório |
