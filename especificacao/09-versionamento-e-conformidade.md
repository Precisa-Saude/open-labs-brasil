# 9. Versionamento e conformidade

## 9.1 Versionamento

Há quatro números de versão, com papéis diferentes.

| Número | Formato | Onde aparece | O que significa | Valor hoje |
| --- | --- | --- | --- | --- |
| **Versão do documento** | `MAJOR.MINOR.PATCH` | Índice, README, `CHANGELOG.md` | Edição do texto da especificação | `0.2.2` |
| **Versão do protocolo** | `MAJOR.MINOR` | `protocol_versions` de cada participante no registro | O comportamento que o participante implementa. São os dois primeiros números da versão do documento que ele seguiu | `0.2` |
| **Segmento de caminho** | `v{MAJOR}` | Final de `api_base_url` | Só o MAJOR da versão do protocolo. Existe para que dois MAJOR convivam no mesmo servidor | `v0` |
| **Versão do formato do registro** | `MAJOR.MINOR` | `schema_version` do registro | Formato do arquivo de participantes. Numeração própria, sem relação com as outras três | `0.1` |

O PATCH nunca aparece no registro nem em caminho. Implementações de `0.2.0`, `0.2.1` e `0.2.2` declaram a mesma versão de protocolo, `0.2`. Por isso um PATCH não pode exigir de um lado algo que corte a comunicação com o outro lado de um PATCH anterior da mesma versão de protocolo: quando a correção de um ponto exigiria isso, o PATCH fixa o que pode fixar sem quebra e deixa o resto para a versão de protocolo seguinte, dizendo o que ficou para depois.

A API FHIR não leva a versão do protocolo no caminho. A versão do FHIR (R4) e os perfis suportados são declarados no `CapabilityStatement`.

**O que cada parte da versão do documento significa**

| Parte | Com MAJOR igual a 1 ou mais | Com MAJOR igual a 0 (fase atual) |
| --- | --- | --- |
| MAJOR | Um cliente ou servidor conforme deixa de funcionar com a outra ponta | Passa a 1 quando houver piloto com ao menos um provedor e um receptor independentes entre si |
| MINOR | Acréscimo compatível: escopo novo, campo opcional novo, código de erro novo, parâmetro de busca opcional novo | **Pode quebrar a versão anterior.** É tratado como incompatível |
| PATCH | Correção de texto, exemplo ou diagrama, sem efeito no comportamento | Correções de texto e esclarecimentos de pontos em que o texto era ambíguo ou omisso. Um esclarecimento pode fixar um comportamento que antes ficava a critério de quem implementava, e o `CHANGELOG.md` DEVE listar cada um desses casos |

**Negociação de versão entre dois participantes**

A versão efetiva entre um receptor e um provedor é calculada pelos dois, da mesma forma, a partir de `protocol_versions` de cada um no registro. Ela não é enviada em nenhuma mensagem.

1. Toma-se o maior MAJOR que aparece nas duas listas. Se não há MAJOR em comum, não há comunicação.
2. **Se esse MAJOR é 0:** a versão efetiva é a maior versão `0.MINOR` idêntica nas duas listas. Se não há versão idêntica, não há comunicação. `0.2` e `0.3` não se falam.
3. **Se esse MAJOR é 1 ou mais:** quem lista `M.n` se compromete a operar corretamente com qualquer `M.k` em que `k` é menor ou igual a `n`. A versão efetiva é `M.m`, em que `m` é o menor entre o maior MINOR de cada lado para aquele MAJOR. Não é preciso haver MINOR idêntico. O lado com MINOR maior NÃO DEVE depender de nada introduzido depois de `M.m`: não envia campo, escopo ou parâmetro que a outra ponta não conhece, e não exige dela resposta que só exista em versão posterior.
4. O caminho usado é o `api_base_url` do provedor cujo final é `/v{M}`. Se o `api_base_url` não termina assim, a entrada do provedor está incoerente, e o receptor trata o caso como "não há comunicação".
5. **A versão efetiva precisa ser implementada pelo software.** Cada participante DEVE declarar em `protocol_versions` só versões que o próprio software implementa. Se, ainda assim, a versão efetiva calculada não é uma que o software do participante implementa (por exemplo, a entrada do registro foi atualizada antes do software, ou o contrário), o participante a trata como inexistente: não há comunicação. O cálculo dos passos 1 a 3 continua sendo feito sobre o registro, que é o que a outra ponta também vê.

"Não há comunicação" quer dizer: o receptor não oferece aquele provedor ao paciente e não chama nenhum endpoint dele, nem para revogar consentimento, e o provedor recusa o receptor com `invalid_client` no servidor de autorização e com 403 `RECEIVER_NOT_ALLOWED` nas APIs.

Enquanto o MAJOR for 0, cada participante DEVE listar exatamente uma versão em `protocol_versions`. Um mesmo caminho `/v0` não tem como atender duas versões incompatíveis ao mesmo tempo, então a troca de `0.x` para `0.y` é combinada entre os participantes do piloto e feita em data marcada.

Consentimentos e tokens existentes não mudam de versão. Se a versão efetiva entre dois participantes deixa de existir (um deles mudou de MINOR na fase 0), o provedor aplica as regras de receptor `suspended`: nada novo é aceito, e os consentimentos ficam como estão até a compatibilidade voltar, expirarem ou serem revogados. O receptor aplica as de provedor fora de `active` ([08-registro-de-participantes.md](08-registro-de-participantes.md), seção 8.4): não faz chamada nenhuma, nem de revogação. O paciente continua podendo revogar pela página de consentimentos do provedor, e o receptor guarda as revogações pendentes, mostrando essa página ao paciente, até a compatibilidade voltar ou o consentimento expirar.

**Regras de compatibilidade**

- Receptores DEVEM ignorar campos JSON que não conhecem em respostas, e tratar códigos de erro desconhecidos pelo status HTTP ([06-erros.md](06-erros.md), seção 6.4).
- Provedores DEVEM recusar campos desconhecidos no corpo de `POST /consents` com `INVALID_REQUEST`, para que um receptor não acredite que uma restrição foi aplicada quando não foi.
- Quando sai um MAJOR novo, a partir do 1, o anterior continua válido por ao menos 12 meses. Um provedor que implementa dois MAJOR tem dois caminhos, `/v{M}` e `/v{M+1}`. Como o registro traz um só `api_base_url` por entrada, o formato do registro precisará de um MINOR para acomodar isso, a definir quando o caso existir.
- Os perfis FHIR têm versionamento próprio, no guia de implementação. Esta especificação referencia perfis pela URL canônica sem versão. Uma mudança incompatível em um perfil exige um MINOR ou MAJOR daqui que diga qual versão do guia passa a valer.

**Mudanças.** Toda mudança entra por proposta pública e fica registrada em `CHANGELOG.md`, na raiz do repositório. Quem aprova está em `GOVERNANCE.md`.

## 9.2 Conformidade

Um participante é conforme a uma versão quando cumpre todos os requisitos DEVE e NÃO DEVE que se aplicam ao seu papel. No piloto, a conformidade é autodeclarada contra a lista da seção 9.3. Uma suíte automatizada é trabalho futuro, e a lista foi escrita para servir de roteiro dela.

Cada requisito tem um identificador estável. A partir da primeira versão publicada, um identificador nunca é reaproveitado: requisito removido fica marcado como retirado, e requisito alterado de forma incompatível ganha número novo. Os identificadores foram renumerados uma única vez, antes do primeiro commit, quando o perfil de segurança mudou. Desde a versão 0.2.0 a regra vale: a versão 0.2.1 só acrescentou identificadores e marcou dois como retirados, e a 0.2.2 só acrescentou identificadores.

Prefixos: `REG` registro, `SEG` transporte e chaves, `AUT` servidor de autorização, `CNS` consentimento, `API` regras comuns da API, `CAT` catálogo, `UNI` unidades, `AGE` agenda, `AGD` agendamento, `RES` resultados, `ERR` erros, `RCP` receptor.

A coluna "Como testar" descreve o estímulo e o resultado esperado. "Cliente de teste" é um receptor de teste registrado, com chaves e certificado válidos. "Provedor de teste" é um provedor simulado controlado pela suíte.

## 9.3 Requisitos testáveis

### Registro (provedor e receptor)

| Id | Requisito | Como testar |
| --- | --- | --- |
| REG-001 | Recusa um registro cuja assinatura destacada não verifica com uma chave de `registry_keys` do documento anterior | Servir um documento com assinatura adulterada. O participante mantém o documento anterior |
| REG-002 | Recusa um registro com `sequence` menor que o do documento atual | Servir um documento antigo validamente assinado. O participante o ignora |
| REG-003 | Recusa um registro que não valida contra o schema | Servir um documento assinado com campo obrigatório ausente |
| REG-004 | Busca o registro ao menos a cada 60 minutos | Observar as requisições ao endereço do registro por 2 horas |
| REG-005 | Aplica mudança de `status` em até 60 minutos | Suspender o cliente de teste e medir quando o provedor passa a recusá-lo |
| REG-006 | *Retirado na 0.2.1.* Substituído por REG-008, que mantém a regra e abre a exceção da revogação | |
| REG-007 | Aplica os catorze passos de verificação da seção 8.3 e recusa o candidato que falha em qualquer um: algoritmo diferente de PS256, `kid` diferente do thumbprint, validade maior que 30 dias, ambiente errado, `participant_id` repetido | Servir um candidato por condição, cada um validamente assinado quando a condição não é a assinatura |
| REG-008 | Depois de `expires_at` sem documento novo, recusa PAR, criação de consentimento e `client_credentials` de catálogo, unidades e agenda. Por 7 dias, aceita `client_credentials` com `consent.manage` como único escopo e atende `GET` e `DELETE` de consentimento. Depois dos 7 dias, recusa também | Deixar o registro expirar. No dia 1: PAR falha, `catalog.read` falha, `consent.manage` sozinho funciona, `DELETE` devolve 204, `POST /consents` devolve 403 `REGISTRY_EXPIRED`. No dia 8: `consent.manage` falha |
| REG-009 | Calcula a versão efetiva pela regra da seção 9.1 e não se comunica com participante sem versão efetiva | Registro com par `0.2` e `0.3`: sem comunicação. Registro com `1.1` e `1.3`: comunicação como `1.1` |
| REG-010 | Enquanto o MAJOR for 0, lista exatamente uma versão em `protocol_versions` | Ler a entrada do participante. Desde a 0.2.2 o schema também confere: um documento com uma entrada que lista uma versão `0.x` e outra versão não valida, e é recusado (REG-003) |
| REG-011 | Na verificação do registro, ignora `typ` e os membros do cabeçalho protegido além de `alg` e `kid`, não usa nenhum deles para obter a chave, e recusa o candidato que traz `crit` | Servir candidatos validamente assinados com a chave de `registry_keys`: com `typ` igual a `JWT`, com um membro a mais e com `jwk` de outra chave (aceitos); com `crit` (recusado) |
| REG-012 | Trata como inexistente a versão efetiva que o próprio software não implementa, e não se comunica com a outra ponta nesse caso | Registro em que o participante e a outra ponta declaram uma versão que o software do participante não implementa |
| REG-013 | Com o registro expirado, o provedor recusa a concessão `authorization_code` com `unauthorized_client`, inclusive de jornada aberta antes do vencimento | Abrir a jornada, deixar o registro do provedor expirar antes da troca, trocar o código |

### Transporte e chaves (provedor)

| Id | Requisito | Como testar |
| --- | --- | --- |
| SEG-001 | Recusa TLS abaixo de 1.2 em todos os endpoints | Tentar handshake TLS 1.1 |
| SEG-002 | No TLS 1.2, os endpoints entre servidores aceitam somente as quatro suítes da seção 7.5 | Enumerar suítes em cada endpoint |
| SEG-003 | Exige certificado de cliente em PAR, token, consentimento e API FHIR | Chamar cada endpoint sem certificado |
| SEG-004 | Recusa certificado de cliente que não está em `transport_certificates` de um receptor `active` | Chamar com certificado válido, mas fora do registro |
| SEG-005 | Recusa certificado registrado para outro `client_id` que não o da asserção ou do token | Asserção do cliente A sobre conexão com certificado do cliente B |
| SEG-006 | Recusa token de acesso apresentado em conexão com certificado diferente do vinculado, com 401 e `invalid_token` | Obter token com o certificado 1 e usá-lo com o certificado 2 do mesmo cliente |
| SEG-007 | Não aceita asserção de cliente assinada com algoritmo diferente de PS256 | Enviar asserção com RS256, ES256 e `none` |
| SEG-008 | O endpoint de autorização não responde a requisições CORS e impede rebaixamento para HTTP | Requisição com `Origin`. Inspecionar o cabeçalho de segurança de transporte |

### Servidor de autorização (provedor)

| Id | Requisito | Como testar |
| --- | --- | --- |
| AUT-001 | Publica metadados em `/.well-known/oauth-authorization-server` com `issuer` igual ao do registro e os campos da seção 5.2 | Ler e comparar |
| AUT-002 | Recusa requisição de autorização que não vem de PAR | Abrir o endpoint de autorização com parâmetros na URL, sem `request_uri` |
| AUT-003 | Recusa PAR sem autenticação do cliente | PAR sem `client_assertion`. `invalid_client` |
| AUT-004 | Recusa `response_type` diferente de `code` | Enviar `code id_token` e `token` |
| AUT-005 | Recusa PAR sem `code_challenge` ou com método diferente de `S256` | `invalid_request` |
| AUT-006 | Recusa PAR sem `redirect_uri` ou com valor que não é idêntico a um do registro | Omitir, variar um caractere, acrescentar parâmetro, trocar o esquema para `http` |
| AUT-007 | Devolve `request_uri` com `expires_in` de ao menos 120 e menor que 600, e o aceita uma única vez, contando o uso na autorização | Carregar a página de autorização duas vezes sem concluir (permitido), concluir, e tentar reusar (recusado) |
| AUT-008 | Autentica o cliente somente por `private_key_jwt` | Tentar `client_secret_basic` e `tls_client_auth` |
| AUT-009 | Só aceita o próprio `issuer`, como texto simples, no `aud` da asserção | Enviar a URL do endpoint de token em `aud`, e o `issuer` dentro de uma lista. `invalid_client` |
| AUT-010 | Recusa asserção com `jti` repetido, expirada, ou com `exp` mais de 60 segundos depois de `iat` | Três requisições. `invalid_client` |
| AUT-011 | Aceita asserção com `iat` até 10 segundos no futuro e recusa com mais de 60 segundos no futuro | Duas requisições |
| AUT-012 | A resposta de autorização traz `code`, `state` e `iss` na consulta da URL, com `iss` igual ao `issuer`, e nada mais | Inspecionar o redirecionamento |
| AUT-013 | A resposta de autorização não contém token nem dado do paciente | Inspecionar o redirecionamento |
| AUT-014 | Recusa código de autorização depois de 60 segundos ou no segundo uso | Trocar com atraso, e trocar duas vezes. `invalid_grant` |
| AUT-015 | Recusa `code_verifier` que não corresponde ao `code_challenge` | `invalid_grant` |
| AUT-016 | Emite token de acesso com `expires_in` entre 300 e 900 | Ler a resposta do token nas três concessões |
| AUT-017 | A resposta do token não contém CPF, id de paciente nem `id_token` | Inspecionar a resposta da concessão `authorization_code` |
| AUT-018 | Não troca o refresh token em operação normal | Renovar três vezes e comparar |
| AUT-019 | Não emite refresh token na concessão `client_credentials` | Ler a resposta |
| AUT-020 | Recusa as concessões `password` e `implicit` | Tentar as duas |
| AUT-021 | Recusa escopo de paciente em `client_credentials` e escopo de provedor em requisição de autorização | `invalid_scope` |
| AUT-022 | Aceita `schedule.read` em `client_credentials` | Pedir o escopo e buscar horários |
| AUT-023 | Recusa cliente `suspended` ou `withdrawn` | `invalid_client` |
| AUT-024 | A página de login e a tela de consentimento são servidas pelo domínio do provedor, e nenhum endpoint aceita credenciais do paciente enviadas pelo cliente | Inspecionar a origem das páginas e os metadados |
| AUT-025 | Não usa status 307 nos redirecionamentos da jornada de autorização | Inspecionar os redirecionamentos |
| AUT-026 | Os metadados trazem cada valor obrigatório da tabela da seção 5.2, com o valor exigido | Comparar campo a campo |
| AUT-027 | Aceita `client_credentials` com um único escopo de provedor, qualquer que seja | Uma requisição por escopo |

### Consentimento (provedor)

| Id | Requisito | Como testar |
| --- | --- | --- |
| CNS-001 | `POST /consents` válido devolve 201 com `status` igual a `AWAITING_AUTHORISATION` | Criar |
| CNS-002 | Recusa `scopes` vazio, com escopo de provedor (inclusive `schedule.read`) ou com escopo desconhecido, com 422 e `CONSENT_INVALID_SCOPES` | Três requisições |
| CNS-003 | Recusa `expiration_date_time` no passado ou a mais de 12 meses, com 422 e `CONSENT_INVALID_EXPIRATION` | Duas requisições |
| CNS-004 | Recusa criação sem `purpose` | 400 `INVALID_REQUEST` |
| CNS-005 | Recusa criação com identificação de paciente ou outro campo desconhecido no corpo | Enviar `patient.cpf`. 400 `INVALID_REQUEST` |
| CNS-006 | Passa a `REJECTED` com `AUTHORISATION_TIMEOUT` 60 minutos depois da criação sem aprovação | Criar, esperar, consultar |
| CNS-007 | Recusa PAR cujo `consent:{id}` aponta para consentimento inexistente, de outro cliente ou fora de `AWAITING_AUTHORISATION` | Três requisições. `invalid_request` |
| CNS-008 | A tela de consentimento mostra o nome do receptor do registro, os escopos, a finalidade enviada e a data de expiração, e informa que o CPF será confirmado ao aplicativo | Inspeção da tela |
| CNS-009 | Recusa pelo paciente devolve `access_denied` e o consentimento passa a `REJECTED` com `PATIENT_REJECTED` | Recusar na tela |
| CNS-010 | Aprovação passa o consentimento a `AUTHORISED` | Aprovar e consultar |
| CNS-011 | Paciente sem CPF no cadastro: `access_denied` e `REJECTED` com `PATIENT_WITHOUT_CPF` | Autenticar com paciente de teste sem CPF |
| CNS-012 | `GET /consents/{id}` com token de paciente devolve `patient.cpf` e `patient.fhir_id` do paciente que se autenticou | Autenticar com paciente de teste de CPF conhecido e comparar |
| CNS-013 | `GET /consents/{id}` com token de provedor nunca devolve `patient` | Ler em `AWAITING_AUTHORISATION`, `AUTHORISED` e `REVOKED` |
| CNS-014 | `GET /consents/{id}` com token de paciente de outro consentimento devolve 404 | Dois consentimentos, token de um no caminho do outro |
| CNS-015 | O token emitido não carrega escopo fora do consentimento | Pedir no PAR um escopo que o consentimento não tem. `invalid_scope` |
| CNS-016 | `DELETE /consents/{id}` em `AUTHORISED` devolve 204, passa a `REVOKED` e invalida os tokens de imediato | Revogar, depois usar o token de acesso e o refresh token |
| CNS-017 | `DELETE` com `reason=PATIENT_MISMATCH` grava `status_reason.code` igual a `PATIENT_MISMATCH` e `ended_via` igual a `RECEIVER` | Revogar com o motivo e consultar |
| CNS-018 | `DELETE` em estado final devolve 422 `CONSENT_INVALID_STATE` | Revogar duas vezes |
| CNS-019 | Em `expiration_date_time`, passa a `EXPIRED` e invalida os tokens | Criar consentimento curto, esperar |
| CNS-020 | Revogação pela página do provedor passa a `REVOKED` com `ended_via` igual a `PROVIDER` e invalida os tokens | Revogar na página e consultar |
| CNS-021 | `GET /consents/{id}` de outro cliente devolve 404 | Consultar com o cliente B |
| CNS-022 | Estados finais não mudam | Tentar autorizar e revogar a partir de cada estado final |
| CNS-023 | Oferece página de gestão de consentimentos em `consent_management_uri`, com revogação | Inspeção |
| CNS-024 | `GET /consents/{id}` com token de provedor responde para consentimento em estado final | Consultar depois de revogar |
| CNS-025 | Paciente cujo CPF no cadastro não é válido pela regra da seção 4.4 (dígitos verificadores errados, ou onze algarismos iguais) é tratado como paciente sem CPF: `access_denied` e `REJECTED` com `PATIENT_WITHOUT_CPF` | Autenticar com paciente de teste cujo CPF no cadastro é `00000000000` |

### API: regras comuns (provedor)

| Id | Requisito | Como testar |
| --- | --- | --- |
| API-001 | Recusa requisição sem `x-fapi-interaction-id` com 400 e devolve o cabeçalho em toda resposta | Chamar sem e com o cabeçalho |
| API-002 | Recusa token no parâmetro de consulta | `?access_token=...` |
| API-003 | Recusa token sem o escopo do recurso com 403 e `insufficient_scope` | Token com `appointment.write` em `/DiagnosticReport` |
| API-004 | Recusa token de provedor em recurso de paciente e token de paciente em recurso de provedor | Duas requisições |
| API-005 | Recusa token ligado a consentimento `REVOKED` ou `EXPIRED` com 401 | Após revogar e após expirar |
| API-006 | Responde 400 `UNSUPPORTED_SEARCH_PARAMETER` a parâmetro de busca não suportado | Enviar parâmetro inventado |
| API-007 | Pagina com `link` `next` e respeita `_count` até 100 | Buscar com `_count=2` e seguir os links |
| API-008 | Todo recurso devolvido declara o perfil em `meta.profile` e valida contra ele | Validar com o validador FHIR e o guia de implementação |
| API-009 | `GET /metadata` devolve `CapabilityStatement` com interações, parâmetros e perfis suportados | Ler e comparar com o comportamento |
| API-010 | Toda resposta 4xx e 5xx traz `OperationOutcome` com um código de `urn:open-labs-brasil:error-code` | Provocar cada erro da seção 6.3 |
| API-011 | Leitura por id de recurso de outro paciente devolve 404 | Usar id de recurso do paciente B com token do paciente A |
| API-012 | Todo `link` de paginação fica dentro do `fhir_base_url` do registro | Paginar cada busca e comparar esquema, host, porta e prefixo de caminho |
| API-013 | Todo `link` de paginação é URL absoluta com esquema `https` e sem componente de usuário | Paginar cada busca e inspecionar os links |

### Catálogo, unidades e agenda (provedor, token de provedor)

| Id | Requisito | Como testar |
| --- | --- | --- |
| CAT-001 | Suporta `ActivityDefinition` com `status`, `url`, `_lastUpdated` | Uma busca por parâmetro |
| CAT-002 | Suporta `ChargeItemDefinition` com `status`, `url`, `jurisdiction`, `_lastUpdated` | Uma busca por parâmetro |
| CAT-003 | Item retirado continua legível com `status` igual a `retired` e aparece na busca por `_lastUpdated` | Retirar um item no ambiente de teste |
| CAT-004 | Todo `ChargeItemDefinition` ativo tem `code` igual ao de algum `ActivityDefinition` | Sincronizar tudo e cruzar |
| CAT-005 | Em `ChargeItemDefinition.useContext`, usa só os contextos `venue` e `brand` da seção 5.5.2, cada um com `valueReference.reference` | Sincronizar tudo e inspecionar cada `useContext` |
| UNI-001 | Suporta `Location` com `status`, `address-city`, `address-state`, `_lastUpdated` | Uma busca por parâmetro |
| UNI-002 | Suporta `HealthcareService` com `location`, `active`, `_lastUpdated` | Uma busca por parâmetro |
| AGE-001 | Atende `Schedule` e `Slot` com token de provedor que tem `schedule.read`, sem consentimento e sem dado de paciente | Buscar horários só com token de provedor |
| AGE-002 | Suporta `Schedule` com `actor` e `active` | Buscar por unidade |
| AGE-003 | Recusa busca de `Slot` sem `schedule` ou sem os dois limites de `start` | 400 `INVALID_REQUEST` |
| AGE-004 | Recusa janela maior que 31 dias | 400 `SEARCH_WINDOW_TOO_LARGE` |
| AGE-005 | Com `service-type` repetido, devolve só horários que atendem a todos os exames | Cesta com exame restrito a certos horários |
| AGE-006 | Com exame não coletado na unidade, devolve Bundle sem horários e `OperationOutcome` com `EXAM_NOT_AVAILABLE_AT_LOCATION` | Cesta com exame fora da unidade |

### Agendamento (provedor, token de paciente)

| Id | Requisito | Como testar |
| --- | --- | --- |
| AGD-001 | Aceita `POST /Appointment` com `ServiceRequest` em `contained` referenciado por `basedOn`, e devolve 201 com o recurso, `Location` e `ETag` | Criar com dois exames |
| AGD-002 | Recusa `Appointment` sem pedido contido, com pedido contido não referenciado, ou com `basedOn` para fora do recurso, com 422 `INVALID_RESOURCE` | Três requisições. Nada fica gravado |
| AGD-003 | Recusa `POST /Appointment` sem `If-None-Exist` | 400 `IF_NONE_EXIST_REQUIRED` |
| AGD-004 | Repetição da criação com o mesmo identificador devolve 200 e não cria segundo agendamento | Enviar duas vezes e buscar por `identifier` |
| AGD-005 | Horário ocupado devolve 409 `SLOT_UNAVAILABLE` | Dois clientes disputam o mesmo horário |
| AGD-006 | Referência a paciente diferente do paciente do consentimento, no agendamento ou em pedido contido, devolve 422 `PATIENT_NOT_IN_CONSENT` | Trocar o id do paciente em cada lugar |
| AGD-007 | Quando há pagamento, devolve `pending` com link de pagamento `https` em domínio do provedor | Agendar exame pago |
| AGD-008 | Depois do pagamento, o `Appointment` passa a `booked`. Sem pagamento no prazo, passa a `cancelled` | Pagar, e deixar vencer |
| AGD-009 | `PUT` sem `If-Match` devolve 400. Com versão antiga, 412 | Duas requisições |
| AGD-010 | Remarcação para horário livre devolve 200, mantém os pedidos contidos e libera o horário anterior | Remarcar, ler e buscar o horário antigo |
| AGD-011 | Cancelamento devolve 200 com `cancelled` e libera o horário | Cancelar e buscar |
| AGD-012 | `PUT` que altera elemento não permitido, inclusive um pedido contido, devolve 422 `APPOINTMENT_FIELD_NOT_MODIFIABLE` | Alterar o paciente. Alterar o código de um pedido |
| AGD-013 | Só são visíveis agendamentos criados pelo mesmo receptor pelo protocolo | Criar agendamento por outro canal e buscar |
| AGD-014 | Não expõe `ServiceRequest` como recurso endereçável | `GET /ServiceRequest/{id}` devolve 404 ou 405 |
| AGD-015 | Aceita `If-None-Exist` na forma literal `identifier={system}\|{value}` e na forma com `%7C` no lugar da barra vertical | Criar com cada forma e repetir com a outra: a segunda devolve 200 |
| AGD-016 | Devolve o link de pagamento em `Appointment.extension` com a URL canônica `https://fhir-brasil.dev.br/ig/StructureDefinition/payment-link` e `valueUrl` com esquema `https`, e em nenhum outro lugar | Agendar exame pago e inspecionar o recurso |
| AGD-017 | Recusa `Appointment` cujo identificador do receptor tem caractere fora do conjunto permitido | 422 `INVALID_RESOURCE` |

### Resultados e registros de consentimento (provedor)

| Id | Requisito | Como testar |
| --- | --- | --- |
| RES-001 | Suporta `DiagnosticReport` com `patient`, `_lastUpdated`, `date`, `status` e `_include=DiagnosticReport:result` | Uma busca por parâmetro |
| RES-002 | Suporta `Observation` com `patient`, `code`, `date`, `_lastUpdated` | Uma busca por parâmetro |
| RES-003 | Busca com `patient` diferente do paciente do consentimento devolve 403 `PATIENT_NOT_IN_CONSENT` | Trocar o id |
| RES-004 | Só devolve laudos `final`, `amended` ou `corrected` já liberados ao paciente | Paciente de teste com laudo parcial e laudo retido |
| RES-005 | Respeita `data_period` do consentimento | Consentimento com `start` recente e paciente com laudos antigos |
| RES-006 | Laudo retificado mantém o id e aparece na busca por `_lastUpdated` | Retificar no ambiente de teste |
| RES-007 | Toda `Observation` tem código LOINC | Validar contra `br-lab-observation` |
| RES-008 | `GET /Patient/{id}` funciona só para o paciente do consentimento | Ler o próprio e outro |
| RES-009 | `GET /Consent?patient={id}` devolve só consentimentos entre aquele paciente e aquele receptor | Paciente de teste com consentimentos para dois receptores |

### Erros (provedor)

| Id | Requisito | Como testar |
| --- | --- | --- |
| ERR-001 | Erros do servidor de autorização usam somente códigos do OAuth listados na seção 6.2 | Provocar cada um |
| ERR-002 | 401 e 403 causados por token trazem `WWW-Authenticate` conforme o RFC 6750 | Token expirado, token sem escopo |
| ERR-003 | Erros de segurança têm precedência sobre os de conteúdo | Corpo inválido com token inválido devolve 401 |
| ERR-004 | Nenhuma resposta de erro contém dado pessoal, CPF, token ou rastro de pilha | Inspecionar todos os erros provocados |
| ERR-005 | 429 e 503 trazem `Retry-After` | Exceder o limite no ambiente de teste |
| ERR-006 | Respostas de erro do endpoint de autorização trazem `iss` | Recusar o consentimento e inspecionar o redirecionamento |

### Receptor

| Id | Requisito | Como testar |
| --- | --- | --- |
| RCP-001 | Abre a autorização em agente de usuário externo e nunca em WebView | Inspeção do aplicativo em execução |
| RCP-002 | Não pede nem armazena credencial do paciente no provedor | Inspeção de telas, do tráfego e do armazenamento |
| RCP-003 | Envia ao endpoint de autorização somente `client_id` e `request_uri` | Provedor de teste inspeciona a URL |
| RCP-004 | Usa PKCE com `S256` e `code_verifier` novo a cada jornada | Duas jornadas, comparar |
| RCP-005 | Recusa resposta de autorização com `state` diferente do enviado | Provedor de teste troca o `state` |
| RCP-006 | Recusa resposta de autorização sem `iss` ou com `iss` diferente do `issuer` do provedor da jornada, e não troca o código | Provedor de teste omite e troca o `iss` |
| RCP-007 | Usa o `issuer`, como texto simples, no `aud` da asserção | Provedor de teste inspeciona a asserção |
| RCP-008 | Recusa provedor cujo `issuer` nos metadados difere do registro | Provedor de teste publica `issuer` diferente |
| RCP-009 | Usa `mtls_endpoint_aliases` quando presentes | Provedor de teste anuncia aliases |
| RCP-010 | Aceita e passa a usar um refresh token novo quando a renovação devolve um | Provedor de teste troca o refresh token |
| RCP-011 | Não envia CPF nem outro identificador do paciente em `POST /consents` nem no PAR | Provedor de teste inspeciona as requisições |
| RCP-012 | Depois de receber os tokens, a primeira chamada a recurso é `GET /consents/{id}` com o token de paciente | Provedor de teste registra a ordem das chamadas |
| RCP-013 | Com `patient.cpf` diferente do CPF do paciente que iniciou a jornada, não chama a API FHIR, envia `DELETE` com `reason=PATIENT_MISMATCH` e descarta os tokens | Provedor de teste devolve outro CPF e registra as chamadas seguintes |
| RCP-014 | *Retirado na 0.2.1.* Substituído por RCP-028, que limita a repetição automática e define a revogação pendente | |
| RCP-015 | Não grava CPF em log e não usa o CPF recebido para outra finalidade | Inspeção de logs e do fluxo de dados declarado |
| RCP-016 | Envia `x-fapi-interaction-id` novo a cada chamada | Inspeção |
| RCP-017 | Envia `DELETE /consents/{id}` quando o paciente revoga no aplicativo e para de usar os tokens mesmo se a chamada falhar | Revogar com o provedor de teste fora do ar |
| RCP-018 | Diante de `invalid_grant` na renovação, consulta o consentimento e reflete o estado para o paciente | Provedor de teste revoga |
| RCP-019 | Consulta o estado de cada consentimento `AUTHORISED` ao menos a cada 24 horas | Observar por 48 horas |
| RCP-020 | Respeita `Retry-After` e não repete erros 4xx sem mudança | Provedor de teste devolve 429 e 422 |
| RCP-021 | Cria agendamento com `If-None-Exist` e identificador único, e trata o 200 da repetição como sucesso | Provedor de teste derruba a primeira resposta |
| RCP-022 | Abre o link de pagamento no navegador do sistema, sem alterar a URL | Inspeção |
| RCP-023 | Mantém chaves privadas e refresh tokens somente no backend | Inspeção do pacote do aplicativo e do tráfego |
| RCP-024 | Oferece tela com os consentimentos do paciente e a opção de revogar | Inspeção |
| RCP-025 | Grava os resultados somente no registro do paciente que consentiu | Inspeção do fluxo de dados declarado e amostragem |
| RCP-026 | Ignora campos desconhecidos em respostas | Provedor de teste acrescenta campos |
| RCP-027 | Quando a conferência do titular não pode ser feita (a leitura do consentimento falha depois das tentativas, ou vem sem `patient.cpf` válido), não conclui o vínculo, não chama a API FHIR, descarta os tokens e revoga com `reason=RECEIVER_TERMINATION` | Provedor de teste devolve 500 na leitura. Devolve 200 sem `patient`. Devolve `patient.cpf` com 10 dígitos |
| RCP-028 | Na revogação, faz no máximo três tentativas automáticas seguidas, respeitando `Retry-After`. Persistindo a falha, grava a revogação como pendente em armazenamento durável, repete conforme o calendário da seção 4.4 e mostra a pendência ao paciente com o endereço da página do provedor | Provedor de teste fora do ar: contar tentativas, reiniciar o backend do receptor, inspecionar a tela e observar as repetições |
| RCP-029 | Trata 404 `CONSENT_NOT_FOUND` e 422 `CONSENT_INVALID_STATE` na revogação como revogação concluída | Provedor de teste devolve cada um |
| RCP-030 | Não segue `link` de paginação fora do `fhir_base_url` do provedor e não envia token nem certificado para esse endereço | Provedor de teste devolve `next` para outro host, para outro esquema e para caminho fora da base |
| RCP-031 | Recusa provedor cujos metadados não trazem, ou contradizem, um valor obrigatório da seção 5.2 | Provedor de teste omite cada valor, um por vez |
| RCP-032 | Pede `consent.manage` sempre sozinho, sem outro escopo no mesmo token | Provedor de teste inspeciona os pedidos de token |
| RCP-033 | Com o registro local expirado, não inicia jornadas nem pede tokens de catálogo, unidades ou agenda, e continua tentando as revogações pendentes | Deixar o registro expirar com uma revogação pendente |
| RCP-034 | Não usa um token de acesso depois de decorrido o `expires_in` informado | Provedor de teste emite token de 300 segundos e observa as chamadas |
| RCP-035 | Lê o link de pagamento somente da extensão de URL canônica `payment-link` e só o abre se o esquema for `https` | Provedor de teste devolve link com `http`, e link em outro elemento |
| RCP-036 | Envia `If-None-Exist` na forma literal `identifier={system}\|{value}`, com `value` restrito ao conjunto de caracteres da seção 5.5.5 | Provedor de teste inspeciona o cabeçalho |
| RCP-037 | Calcula a versão efetiva pela regra da seção 9.1 e não oferece ao paciente provedor sem versão efetiva | Registro com provedor `0.3` e receptor `0.2` |
| RCP-038 | Grava a revogação em armazenamento durável no momento em que ela é decidida, antes da primeira tentativa, e um reinício durante as tentativas automáticas não a perde | Provedor de teste segura a resposta do primeiro `DELETE`. Reiniciar o backend do receptor. A revogação aparece como pendente e volta a ser tentada |
| RCP-039 | Só trata um 404 da revogação como conclusão quando o `OperationOutcome` traz o código `CONSENT_NOT_FOUND`. Um 404 sem esse código mantém a revogação pendente | Provedor de teste devolve 404 sem corpo, e 404 com outro código |
| RCP-040 | Diante de falha que não admite repetição na revogação (seção 4.4), encerra as tentativas automáticas na hora e mantém a revogação pendente | Provedor de teste devolve `invalid_client` no endpoint de token: uma tentativa só, pendência gravada |
| RCP-041 | Não faz tentativa de revogação, automática ou do calendário, antes do instante indicado por `Retry-After`, e encerra as tentativas automáticas quando a espera passa do próprio teto | Provedor de teste devolve 503 com `Retry-After: 7200` e observa as chamadas seguintes |
| RCP-042 | Trata como inválido o CPF que não tem 11 dígitos com dígitos verificadores certos ou que tem onze algarismos iguais, tanto no `patient.cpf` recebido quanto no CPF do paciente que inicia a jornada. Com o CPF do paciente inválido, não inicia a jornada nem troca o código | Provedor de teste devolve `11111111111`: revogação com `RECEIVER_TERMINATION`. Aplicativo informa `00000000000`: nenhuma chamada ao provedor |
| RCP-043 | Não segue `link` de paginação com componente de usuário e não faz requisição fora do `fhir_base_url` a partir de link relativo | Provedor de teste devolve `next` com `usuario@` antes do host certo, e `next` relativos que resolvem dentro e fora da base |
| RCP-044 | Com mais de uma extensão `payment-link` no `Appointment`, não abre link nenhum | Provedor de teste devolve duas extensões |
| RCP-045 | No agendamento, identifica o paciente só pela referência `Patient/{fhir_id}`, sem `identifier`, no participante e no `subject` de cada pedido contido | Provedor de teste inspeciona o corpo do `POST` |
| RCP-046 | Não oferece nem chama provedor cujo `api_base_url` não termina em `/v{M}` da versão efetiva | Registro com provedor `0.2` e `api_base_url` terminado em `/v1` |
| RCP-047 | Com o registro local expirado, não troca código de autorização, nem de jornada aberta antes do vencimento | Abrir a jornada, deixar o registro do receptor expirar, entregar o retorno da autorização |
| RCP-048 | Não chama provedor que não está `active` no registro aceito, ou sem versão efetiva, nem para revogar. Mantém as revogações pendentes para ele à vista do paciente, com a página do provedor, e retoma o calendário quando ele volta a `active` | Suspender o provedor de teste com uma revogação pendente, observar as chamadas, reativar |
| RCP-049 | Não trata como geral um preço que traz contexto de uso que o receptor não reconhece | Provedor de teste devolve preço com `useContext` de outro sistema de códigos, e com `venue` sem referência |

São 180 identificadores, dos quais 2 retirados e 178 em vigor (contados por script sobre este arquivo). A versão 0.2.1 acrescentou REG-007 a REG-010, AUT-026, AUT-027, API-012, AGD-015 a AGD-017 e RCP-027 a RCP-037. A versão 0.2.2 acrescentou REG-011 a REG-013, CNS-025, API-013, CAT-005 e RCP-038 a RCP-049.

RCP-002, RCP-015, RCP-023, RCP-025 e as partes de tela de RCP-028 e RCP-048 não se provam só com teste de caixa-preta. Uma suíte automatizada cobre os demais, e esses pedem inspeção ou declaração auditável. O mesmo vale, do lado do provedor, para AUT-024, CNS-008 e CNS-023, que dependem de olhar telas.
