# Cobertura dos requisitos do capítulo 9

Gerado por `node ferramentas/gerar-cobertura.ts` a partir de [09-versionamento-e-conformidade.md](../especificacao/09-versionamento-e-conformidade.md), da lista de testes da suíte e do relatório de `pnpm conformidade:local`. Não edite à mão: rode os dois comandos de novo.

Relatório usado: 2026-11-17T18:40:25.584Z. Contra o servidor de exemplo: 128 aprovados, 0 reprovados, 4 não verificáveis automaticamente, de 132 requisitos de provedor.

Colunas:

- **Teste**: arquivo em `suite-de-conformidade/requisitos/` onde está o teste com o identificador do requisito. A fase diz quando ele roda: `registro` publica candidatos do registro, `relogio` adianta o relógio do provedor, `final` examina o histórico de todas as trocas.
- **Situação**: resultado contra o servidor de exemplo. "Não verificável automaticamente" vem sempre com o motivo.
- **Teste negativo**: violação do servidor de exemplo (`servidor-de-exemplo/violacoes.ts`) que faz o requisito ser reprovado em `suite-de-conformidade/testes/violacoes.test.ts`.

## Provedor

| Id | Requisito | Teste | Situação | Teste negativo |
| --- | --- | --- | --- | --- |
| REG-001 | Recusa um registro cuja assinatura destacada não verifica com uma chave de `registry_keys` do documento anterior | `registro.ts`, fase registro | aprovado | `registro-sem-conferir-assinatura` |
| REG-002 | Recusa um registro com `sequence` menor que o do documento atual | `registro.ts`, fase registro | aprovado | `registro-aceita-sequencia-menor` |
| REG-003 | Recusa um registro que não valida contra o schema | `registro.ts`, fase registro | aprovado | `registro-sem-schema` |
| REG-004 | Busca o registro ao menos a cada 60 minutos | `registro.ts`, fase relogio | aprovado |  |
| REG-005 | Aplica mudança de `status` em até 60 minutos | `registro.ts`, fase registro | aprovado | `aceita-cliente-suspenso` |
| REG-006 | *Retirado na 0.2.1.* Substituído por REG-008, que mantém a regra e abre a exceção da revogação | (retirado) | (não se aplica) | |
| REG-007 | Aplica os catorze passos de verificação da seção 8.3 e recusa o candidato que falha em qualquer um: algoritmo diferente de PS256, `kid` diferente do thumbprint, validade maior que 30 dias, ambiente errado, `participant_id` repetido | `registro.ts`, fase registro | aprovado | `registro-sem-conferir-ambiente` |
| REG-008 | Depois de `expires_at` sem documento novo, recusa PAR, criação de consentimento e `client_credentials` de catálogo, unidades e agenda. Por 7 dias, aceita `client_credentials` com `consent.manage` como único escopo e atende `GET` e `DELETE` de consentimento. Depois dos 7 dias, recusa também | `registro.ts`, fase relogio | aprovado | `registro-expirado-sem-modo-restrito` |
| REG-009 | Calcula a versão efetiva pela regra da seção 9.1 e não se comunica com participante sem versão efetiva | `registro.ts`, fase registro | aprovado | `aceita-cliente-suspenso` |
| REG-010 | Enquanto o MAJOR for 0, lista exatamente uma versão em `protocol_versions` | `registro.ts` | aprovado |  |
| REG-011 | Na verificação do registro, ignora `typ` e os membros do cabeçalho protegido além de `alg` e `kid`, não usa nenhum deles para obter a chave, e recusa o candidato que traz `crit` | `registro.ts`, fase registro | aprovado | `registro-aceita-crit`, `registro-exige-typ-jose`, `registro-usa-jwk-do-cabecalho` |
| REG-012 | Trata como inexistente a versão efetiva que o próprio software não implementa, e não se comunica com a outra ponta nesse caso | `registro.ts`, fase registro | aprovado | `versao-nao-implementada-aceita` |
| REG-013 | Com o registro expirado, o provedor recusa a concessão `authorization_code` com `unauthorized_client`, inclusive de jornada aberta antes do vencimento | `registro.ts`, fase relogio | aprovado | `troca-de-codigo-com-registro-expirado` |
| SEG-001 | Recusa TLS abaixo de 1.2 em todos os endpoints | `seguranca.ts` | aprovado | `aceita-tls-1-1` |
| SEG-002 | No TLS 1.2, os endpoints entre servidores aceitam somente as quatro suítes da seção 7.5 | `seguranca.ts` | aprovado | `tls-com-suites-fracas` |
| SEG-003 | Exige certificado de cliente em PAR, token, consentimento e API FHIR | `seguranca.ts` | aprovado | `aceita-sem-certificado` |
| SEG-004 | Recusa certificado de cliente que não está em `transport_certificates` de um receptor `active` | `seguranca.ts` | aprovado | `aceita-certificado-fora-do-registro` |
| SEG-005 | Recusa certificado registrado para outro `client_id` que não o da asserção ou do token | `seguranca.ts` | aprovado | `certificado-de-outro-cliente` |
| SEG-006 | Recusa token de acesso apresentado em conexão com certificado diferente do vinculado, com 401 e `invalid_token` | `seguranca.ts` | aprovado | `token-sem-vinculo` |
| SEG-007 | Não aceita asserção de cliente assinada com algoritmo diferente de PS256 | `seguranca.ts` | aprovado | `aceita-rs256` |
| SEG-008 | O endpoint de autorização não responde a requisições CORS e impede rebaixamento para HTTP | `seguranca.ts` | aprovado | `cors-na-autorizacao` |
| AUT-001 | Publica metadados em `/.well-known/oauth-authorization-server` com `issuer` igual ao do registro e os campos da seção 5.2 | `autorizacao.ts` | aprovado | `metadados-sem-iss` |
| AUT-002 | Recusa requisição de autorização que não vem de PAR | `autorizacao.ts` | aprovado |  |
| AUT-003 | Recusa PAR sem autenticação do cliente | `autorizacao.ts` | aprovado | `par-sem-autenticacao` |
| AUT-004 | Recusa `response_type` diferente de `code` | `autorizacao.ts` | aprovado | `aceita-response-type-token` |
| AUT-005 | Recusa PAR sem `code_challenge` ou com método diferente de `S256` | `autorizacao.ts` | aprovado | `par-sem-pkce` |
| AUT-006 | Recusa PAR sem `redirect_uri` ou com valor que não é idêntico a um do registro | `autorizacao.ts` | aprovado | `redirect-uri-com-parametro` |
| AUT-007 | Devolve `request_uri` com `expires_in` de ao menos 120 e menor que 600, e o aceita uma única vez, contando o uso na autorização | `autorizacao.ts` | aprovado | `request-uri-reutilizavel` |
| AUT-008 | Autentica o cliente somente por `private_key_jwt` | `autorizacao.ts` | aprovado | `par-sem-autenticacao` |
| AUT-009 | Só aceita o próprio `issuer`, como texto simples, no `aud` da asserção | `autorizacao.ts` | aprovado | `aud-em-lista` |
| AUT-010 | Recusa asserção com `jti` repetido, expirada, ou com `exp` mais de 60 segundos depois de `iat` | `autorizacao.ts` | aprovado | `jti-repetido` |
| AUT-011 | Aceita asserção com `iat` até 10 segundos no futuro e recusa com mais de 60 segundos no futuro | `autorizacao.ts` | aprovado | `iat-sem-tolerancia` |
| AUT-012 | A resposta de autorização traz `code`, `state` e `iss` na consulta da URL, com `iss` igual ao `issuer`, e nada mais | `autorizacao.ts` | aprovado | `iss-ausente-na-resposta`, `cpf-no-redirecionamento` |
| AUT-013 | A resposta de autorização não contém token nem dado do paciente | `autorizacao.ts` | aprovado | `cpf-no-redirecionamento` |
| AUT-014 | Recusa código de autorização depois de 60 segundos ou no segundo uso | `autorizacao.ts`, fase relogio | aprovado | `codigo-reutilizavel` |
| AUT-015 | Recusa `code_verifier` que não corresponde ao `code_challenge` | `autorizacao.ts` | aprovado | `pkce-ignorado` |
| AUT-016 | Emite token de acesso com `expires_in` entre 300 e 900 | `autorizacao.ts` | aprovado | `token-longo` |
| AUT-017 | A resposta do token não contém CPF, id de paciente nem `id_token` | `autorizacao.ts` | aprovado | `cpf-na-resposta-do-token` |
| AUT-018 | Não troca o refresh token em operação normal | `autorizacao.ts` | aprovado | `refresh-com-rotacao` |
| AUT-019 | Não emite refresh token na concessão `client_credentials` | `autorizacao.ts` | aprovado | `refresh-em-client-credentials` |
| AUT-020 | Recusa as concessões `password` e `implicit` | `autorizacao.ts` | aprovado | `aceita-password` |
| AUT-021 | Recusa escopo de paciente em `client_credentials` e escopo de provedor em requisição de autorização | `autorizacao.ts` | aprovado | `escopo-de-paciente-em-client-credentials` |
| AUT-022 | Aceita `schedule.read` em `client_credentials` | `autorizacao.ts` | aprovado | `recusa-schedule-read` |
| AUT-023 | Recusa cliente `suspended` ou `withdrawn` | `autorizacao.ts` | aprovado | `aceita-cliente-suspenso` |
| AUT-024 | A página de login e a tela de consentimento são servidas pelo domínio do provedor, e nenhum endpoint aceita credenciais do paciente enviadas pelo cliente | `autorizacao.ts` | não verificável automaticamente: a origem real das páginas de login e de consentimento e a ausência de outra interface de credenciais pedem inspeção humana |  |
| AUT-025 | Não usa status 307 nos redirecionamentos da jornada de autorização | `autorizacao.ts` | aprovado | `redirecionamento-307` |
| AUT-026 | Os metadados trazem cada valor obrigatório da tabela da seção 5.2, com o valor exigido | `autorizacao.ts` | aprovado | `metadados-sem-iss` |
| AUT-027 | Aceita `client_credentials` com um único escopo de provedor, qualquer que seja | `autorizacao.ts` | aprovado | `recusa-schedule-read` |
| CNS-001 | `POST /consents` válido devolve 201 com `status` igual a `AWAITING_AUTHORISATION` | `consentimento.ts` | aprovado |  |
| CNS-002 | Recusa `scopes` vazio, com escopo de provedor (inclusive `schedule.read`) ou com escopo desconhecido, com 422 e `CONSENT_INVALID_SCOPES` | `consentimento.ts` | aprovado | `consentimento-aceita-escopo-de-provedor` |
| CNS-003 | Recusa `expiration_date_time` no passado ou a mais de 12 meses, com 422 e `CONSENT_INVALID_EXPIRATION` | `consentimento.ts` | aprovado | `consentimento-sem-limite-de-validade` |
| CNS-004 | Recusa criação sem `purpose` | `consentimento.ts` | aprovado | `purpose-opcional` |
| CNS-005 | Recusa criação com identificação de paciente ou outro campo desconhecido no corpo | `consentimento.ts` | aprovado | `consentimento-aceita-campo-desconhecido` |
| CNS-006 | Passa a `REJECTED` com `AUTHORISATION_TIMEOUT` 60 minutos depois da criação sem aprovação | `consentimento.ts`, fase relogio | aprovado | `consentimento-sem-prazo-de-autorizacao` |
| CNS-007 | Recusa PAR cujo `consent:{id}` aponta para consentimento inexistente, de outro cliente ou fora de `AWAITING_AUTHORISATION` | `consentimento.ts` | aprovado | `par-aceita-consentimento-de-outro` |
| CNS-008 | A tela de consentimento mostra o nome do receptor do registro, os escopos, a finalidade enviada e a data de expiração, e informa que o CPF será confirmado ao aplicativo | `consentimento.ts` | não verificável automaticamente: escopos em linguagem comum, data de expiração e aviso de confirmação do CPF admitem redação do provedor e pedem inspeção humana |  |
| CNS-009 | Recusa pelo paciente devolve `access_denied` e o consentimento passa a `REJECTED` com `PATIENT_REJECTED` | `consentimento.ts` | aprovado |  |
| CNS-010 | Aprovação passa o consentimento a `AUTHORISED` | `consentimento.ts` | aprovado |  |
| CNS-011 | Paciente sem CPF no cadastro: `access_denied` e `REJECTED` com `PATIENT_WITHOUT_CPF` | `consentimento.ts` | aprovado |  |
| CNS-012 | `GET /consents/{id}` com token de paciente devolve `patient.cpf` e `patient.fhir_id` do paciente que se autenticou | `consentimento.ts` | aprovado | `cpf-errado-na-leitura` |
| CNS-013 | `GET /consents/{id}` com token de provedor nunca devolve `patient` | `consentimento.ts` | aprovado | `cpf-com-token-de-provedor` |
| CNS-014 | `GET /consents/{id}` com token de paciente de outro consentimento devolve 404 | `consentimento.ts` | aprovado | `token-de-paciente-le-outro-consentimento` |
| CNS-015 | O token emitido não carrega escopo fora do consentimento | `consentimento.ts` | aprovado | `par-aceita-escopo-fora-do-consentimento` |
| CNS-016 | `DELETE /consents/{id}` em `AUTHORISED` devolve 204, passa a `REVOKED` e invalida os tokens de imediato | `consentimento.ts` | aprovado | `revogacao-nao-invalida-tokens` |
| CNS-017 | `DELETE` com `reason=PATIENT_MISMATCH` grava `status_reason.code` igual a `PATIENT_MISMATCH` e `ended_via` igual a `RECEIVER` | `consentimento.ts` | aprovado | `motivo-do-receptor-ignorado` |
| CNS-018 | `DELETE` em estado final devolve 422 `CONSENT_INVALID_STATE` | `consentimento.ts` | aprovado | `revogacao-repetida-aceita` |
| CNS-019 | Em `expiration_date_time`, passa a `EXPIRED` e invalida os tokens | `consentimento.ts`, fase relogio | aprovado | `consentimento-nao-expira` |
| CNS-020 | Revogação pela página do provedor passa a `REVOKED` com `ended_via` igual a `PROVIDER` e invalida os tokens | `consentimento.ts` | aprovado |  |
| CNS-021 | `GET /consents/{id}` de outro cliente devolve 404 | `consentimento.ts` | aprovado | `consentimento-de-outro-cliente-visivel` |
| CNS-022 | Estados finais não mudam | `consentimento.ts`, fase relogio | aprovado |  |
| CNS-023 | Oferece página de gestão de consentimentos em `consent_management_uri`, com revogação | `consentimento.ts` | não verificável automaticamente: listar os consentimentos AUTHORISED e revogar cada um pede inspeção humana da página |  |
| CNS-024 | `GET /consents/{id}` com token de provedor responde para consentimento em estado final | `consentimento.ts` | aprovado | `estado-final-ilegivel` |
| CNS-025 | Paciente cujo CPF no cadastro não é válido pela regra da seção 4.4 (dígitos verificadores errados, ou onze algarismos iguais) é tratado como paciente sem CPF: `access_denied` e `REJECTED` com `PATIENT_WITHOUT_CPF` | `consentimento.ts` | aprovado | `cpf-invalido-aceito` |
| CNS-026 | `DELETE` repetido ou concorrente do mesmo consentimento aplica a transição uma única vez, mantém o `status_reason` da primeira chamada e responde a cada uma com 204 ou 422 `CONSENT_INVALID_STATE`, nunca 409 nem 5xx | `consentimento.ts` | aprovado | `revogacao-repetida-aceita`, `revogacao-repetida-sobrescreve` |
| API-001 | Recusa requisição sem `x-fapi-interaction-id` com 400 e devolve o cabeçalho em toda resposta | `api.ts`, fase final | aprovado | `sem-interaction-id` |
| API-002 | Recusa token no parâmetro de consulta | `api.ts` | aprovado | `token-na-url` |
| API-003 | Recusa token sem o escopo do recurso com 403 e `insufficient_scope` | `api.ts` | aprovado | `escopo-nao-conferido` |
| API-004 | Recusa token de provedor em recurso de paciente e token de paciente em recurso de provedor | `api.ts` | aprovado | `escopo-nao-conferido` |
| API-005 | Recusa token ligado a consentimento `REVOKED` ou `EXPIRED` com 401 | `api.ts`, fase relogio | aprovado | `consentimento-nao-expira` |
| API-006 | Responde 400 `UNSUPPORTED_SEARCH_PARAMETER` a parâmetro de busca não suportado | `api.ts` | aprovado | `ignora-parametro-desconhecido` |
| API-007 | Pagina com `link` `next` e respeita `_count` até 100 | `api.ts` | aprovado | `count-ignorado` |
| API-008 | Todo recurso devolvido declara o perfil em `meta.profile` e valida contra ele | `api.ts` | não verificável automaticamente: a validação completa contra os perfis exige o validador FHIR com o guia de implementação; a suíte confere meta.profile e as cardinalidades mínimas de cada perfil | `sem-meta-profile` |
| API-009 | `GET /metadata` devolve `CapabilityStatement` com interações, parâmetros e perfis suportados | `api.ts` | aprovado | `capability-sem-perfis` |
| API-010 | Toda resposta 4xx e 5xx traz `OperationOutcome` com um código de `urn:open-labs-brasil:error-code` | `api.ts`, fase final | aprovado | `erro-sem-operation-outcome` |
| API-011 | Leitura por id de recurso de outro paciente devolve 404 | `api.ts` | aprovado | `paciente-de-outro-visivel` |
| API-012 | Todo `link` de paginação fica dentro do `fhir_base_url` do registro | `api.ts` | aprovado | `paginacao-fora-da-base` |
| API-013 | Todo `link` de paginação é URL absoluta com esquema `https` e sem componente de usuário | `api.ts` | aprovado | `paginacao-relativa`, `paginacao-com-usuario` |
| CAT-001 | Suporta `ActivityDefinition` com `status`, `url`, `_lastUpdated` | `catalogo-e-agenda.ts` | aprovado | `bundle-com-entry-vazio`, `busca-por-url-ignorada` |
| CAT-002 | Suporta `ChargeItemDefinition` com `status`, `url`, `jurisdiction`, `_lastUpdated` | `catalogo-e-agenda.ts` | aprovado | `busca-por-url-ignorada` |
| CAT-003 | Item retirado continua legível com `status` igual a `retired` e aparece na busca por `_lastUpdated` | `catalogo-e-agenda.ts` | aprovado | `retirado-invisivel` |
| CAT-004 | Todo `ChargeItemDefinition` ativo tem `code` igual ao de algum `ActivityDefinition` | `catalogo-e-agenda.ts` | aprovado | `preco-sem-exame` |
| CAT-005 | Em `ChargeItemDefinition.useContext`, usa só os contextos `venue` e `brand` da seção 5.5.2, cada um com `valueReference.reference` | `catalogo-e-agenda.ts` | aprovado | `contexto-de-preco-desconhecido` |
| UNI-001 | Suporta `Location` com `status`, `address-city`, `address-state`, `_lastUpdated` | `catalogo-e-agenda.ts` | aprovado | `busca-por-cidade-ignorada` |
| UNI-002 | Suporta `HealthcareService` com `location`, `active`, `_lastUpdated` | `catalogo-e-agenda.ts` | aprovado | `servicos-de-todas-as-unidades` |
| AGE-001 | Atende `Schedule` e `Slot` com token de provedor que tem `schedule.read`, sem consentimento e sem dado de paciente | `catalogo-e-agenda.ts` | aprovado | `agenda-exige-paciente` |
| AGE-002 | Suporta `Schedule` com `actor` e `active` | `catalogo-e-agenda.ts` | aprovado | `agenda-de-todas-as-unidades` |
| AGE-003 | Recusa busca de `Slot` sem `schedule` ou sem os dois limites de `start` | `catalogo-e-agenda.ts` | aprovado | `slot-sem-limites` |
| AGE-004 | Recusa janela maior que 31 dias | `catalogo-e-agenda.ts` | aprovado | `janela-de-agenda-sem-limite` |
| AGE-005 | Com `service-type` repetido, devolve só horários que atendem a todos os exames | `catalogo-e-agenda.ts` | aprovado | `cesta-com-ou` |
| AGE-006 | Com exame não coletado na unidade, devolve Bundle sem horários e `OperationOutcome` com `EXAM_NOT_AVAILABLE_AT_LOCATION` | `catalogo-e-agenda.ts` | aprovado | `exame-indisponivel-silencioso` |
| AGD-001 | Aceita `POST /Appointment` com `ServiceRequest` em `contained` referenciado por `basedOn`, e devolve 201 com o recurso, `Location` e `ETag` | `agendamento.ts` | aprovado | `criacao-sem-etag` |
| AGD-002 | Recusa `Appointment` sem pedido contido, com pedido contido não referenciado, ou com `basedOn` para fora do recurso, com 422 `INVALID_RESOURCE` | `agendamento.ts` | aprovado | `aceita-sem-pedido-contido` |
| AGD-003 | Recusa `POST /Appointment` sem `If-None-Exist` | `agendamento.ts` | aprovado | `criacao-nao-idempotente` |
| AGD-004 | Repetição da criação com o mesmo identificador devolve 200 e não cria segundo agendamento | `agendamento.ts` | aprovado | `criacao-nao-idempotente` |
| AGD-005 | Horário ocupado devolve 409 `SLOT_UNAVAILABLE` | `agendamento.ts` | aprovado | `horario-ocupado-aceito` |
| AGD-006 | Referência a paciente diferente do paciente do consentimento, no agendamento ou em pedido contido, devolve 422 `PATIENT_NOT_IN_CONSENT` | `agendamento.ts` | aprovado | `paciente-do-agendamento-livre` |
| AGD-007 | Quando há pagamento, devolve `pending` com link de pagamento `https` em domínio do provedor | `agendamento.ts` | aprovado | `link-de-pagamento-http` |
| AGD-008 | Depois do pagamento, o `Appointment` passa a `booked`. Sem pagamento no prazo, passa a `cancelled` | `agendamento.ts`, fase relogio | aprovado | `pagamento-nao-vence` |
| AGD-009 | `PUT` sem `If-Match` devolve 400. Com versão antiga, 412 | `agendamento.ts` | aprovado | `if-match-ignorado` |
| AGD-010 | Remarcação para horário livre devolve 200, mantém os pedidos contidos e libera o horário anterior | `agendamento.ts` | aprovado | `horario-nao-liberado` |
| AGD-011 | Cancelamento devolve 200 com `cancelled` e libera o horário | `agendamento.ts` | aprovado | `horario-nao-liberado` |
| AGD-012 | `PUT` que altera elemento não permitido, inclusive um pedido contido, devolve 422 `APPOINTMENT_FIELD_NOT_MODIFIABLE` | `agendamento.ts` | aprovado | `pedido-contido-alteravel` |
| AGD-013 | Só são visíveis agendamentos criados pelo mesmo receptor pelo protocolo | `agendamento.ts` | aprovado | `agendamento-de-outro-canal-visivel` |
| AGD-014 | Não expõe `ServiceRequest` como recurso endereçável | `agendamento.ts` | aprovado | `service-request-enderecavel` |
| AGD-015 | Aceita `If-None-Exist` na forma literal `identifier={system}\\|{value}` e na forma com `%7C` no lugar da barra vertical | `agendamento.ts` | aprovado | `if-none-exist-so-literal` |
| AGD-016 | Devolve o link de pagamento em `Appointment.extension` com a URL canônica `https://fhir-brasil.dev.br/ig/StructureDefinition/payment-link` e `valueUrl` com esquema `https`, e em nenhum outro lugar | `agendamento.ts` | aprovado | `link-de-pagamento-em-comment` |
| AGD-017 | Recusa `Appointment` cujo identificador do receptor tem caractere fora do conjunto permitido | `agendamento.ts` | aprovado | `aceita-identificador-invalido` |
| RES-001 | Suporta `DiagnosticReport` com `patient`, `_lastUpdated`, `date`, `status` e `_include=DiagnosticReport:result` | `resultados-e-erros.ts` | aprovado | `bundle-com-entry-vazio`, `include-ignorado` |
| RES-002 | Suporta `Observation` com `patient`, `code`, `date`, `_lastUpdated` | `resultados-e-erros.ts` | aprovado |  |
| RES-003 | Busca com `patient` diferente do paciente do consentimento devolve 403 `PATIENT_NOT_IN_CONSENT` | `resultados-e-erros.ts` | aprovado | `parametro-patient-ignorado` |
| RES-004 | Só devolve laudos `final`, `amended` ou `corrected` já liberados ao paciente | `resultados-e-erros.ts` | aprovado | `laudo-parcial-visivel` |
| RES-005 | Respeita `data_period` do consentimento | `resultados-e-erros.ts` | aprovado | `data-period-ignorado` |
| RES-006 | Laudo retificado mantém o id e aparece na busca por `_lastUpdated` | `resultados-e-erros.ts` | aprovado |  |
| RES-007 | Toda `Observation` tem código LOINC | `resultados-e-erros.ts` | aprovado | `observacao-sem-loinc` |
| RES-008 | `GET /Patient/{id}` funciona só para o paciente do consentimento | `resultados-e-erros.ts` | aprovado | `paciente-de-outro-visivel` |
| RES-009 | `GET /Consent?patient={id}` devolve só consentimentos entre aquele paciente e aquele receptor | `resultados-e-erros.ts` | aprovado | `consentimentos-de-outros-receptores` |
| ERR-001 | Erros do servidor de autorização usam somente códigos do OAuth listados na seção 6.2 | `resultados-e-erros.ts`, fase final | aprovado | `erro-oauth-inventado` |
| ERR-002 | 401 e 403 causados por token trazem `WWW-Authenticate` conforme o RFC 6750 | `resultados-e-erros.ts` | aprovado | `sem-www-authenticate` |
| ERR-003 | Erros de segurança têm precedência sobre os de conteúdo | `resultados-e-erros.ts` | aprovado | `conteudo-antes-da-seguranca` |
| ERR-004 | Nenhuma resposta de erro contém dado pessoal, CPF, token ou rastro de pilha | `resultados-e-erros.ts`, fase final | aprovado | `cpf-no-erro` |
| ERR-005 | 429 e 503 trazem `Retry-After` | `resultados-e-erros.ts` | aprovado | `sem-retry-after` |
| ERR-006 | Respostas de erro do endpoint de autorização trazem `iss` | `resultados-e-erros.ts` | aprovado | `iss-ausente-na-resposta` |
| ERR-007 | Nas respostas ao `DELETE` de consentimento e ao pedido de token `client_credentials` com `consent.manage`, `Retry-After` não passa de 86400 segundos | `resultados-e-erros.ts` | aprovado | `retry-after-longo` |

## Receptor

Os requisitos RCP são do receptor e ficam fora desta entrega: testá-los pede um provedor de teste controlado pela suíte, que devolva respostas erradas de propósito e observe o receptor. A coluna "Receptor mínimo" marca os que o receptor mínimo da jornada de ponta a ponta segue, conforme comentado no código. Isso não é verificação de conformidade de nenhum receptor.

| Id | Requisito | Situação | Receptor mínimo |
| --- | --- | --- | --- |
| RCP-001 | Abre a autorização em agente de usuário externo e nunca em WebView | fora desta entrega |  |
| RCP-002 | Não pede nem armazena credencial do paciente no provedor | fora desta entrega |  |
| RCP-003 | Envia ao endpoint de autorização somente `client_id` e `request_uri` | fora desta entrega |  |
| RCP-004 | Usa PKCE com `S256` e `code_verifier` novo a cada jornada | fora desta entrega | segue |
| RCP-005 | Recusa resposta de autorização com `state` diferente do enviado | fora desta entrega | segue |
| RCP-006 | Recusa resposta de autorização sem `iss` ou com `iss` diferente do `issuer` do provedor da jornada, e não troca o código | fora desta entrega | segue |
| RCP-007 | Usa o `issuer`, como texto simples, no `aud` da asserção | fora desta entrega | segue |
| RCP-008 | Recusa provedor cujo `issuer` nos metadados difere do registro | fora desta entrega | segue |
| RCP-009 | Usa `mtls_endpoint_aliases` quando presentes | fora desta entrega |  |
| RCP-010 | Aceita e passa a usar um refresh token novo quando a renovação devolve um | fora desta entrega | segue |
| RCP-011 | Não envia CPF nem outro identificador do paciente em `POST /consents` nem no PAR | fora desta entrega | segue |
| RCP-012 | Depois de receber os tokens, a primeira chamada a recurso é `GET /consents/{id}` com o token de paciente | fora desta entrega | segue |
| RCP-013 | Com `patient.cpf` diferente do CPF do paciente que iniciou a jornada, não chama a API FHIR, envia `DELETE` com `reason=PATIENT_MISMATCH` e descarta os tokens | fora desta entrega | segue |
| RCP-014 | *Retirado na 0.2.1.* Substituído por RCP-028, que limita a repetição automática e define a revogação pendente | (retirado) | |
| RCP-015 | Não grava CPF em log e não usa o CPF recebido para outra finalidade | fora desta entrega | segue |
| RCP-016 | Envia `x-fapi-interaction-id` novo a cada chamada | fora desta entrega | segue |
| RCP-017 | Envia `DELETE /consents/{id}` quando o paciente revoga no aplicativo e para de usar os tokens mesmo se a chamada falhar | fora desta entrega | segue |
| RCP-018 | Diante de `invalid_grant` na renovação, consulta o consentimento e reflete o estado para o paciente | fora desta entrega |  |
| RCP-019 | Consulta o estado de cada consentimento `AUTHORISED` ao menos a cada 24 horas | fora desta entrega |  |
| RCP-020 | Respeita `Retry-After` e não repete erros 4xx sem mudança | fora desta entrega |  |
| RCP-021 | Cria agendamento com `If-None-Exist` e identificador único, e trata o 200 da repetição como sucesso | fora desta entrega | segue |
| RCP-022 | Abre o link de pagamento no navegador do sistema, sem alterar a URL | fora desta entrega |  |
| RCP-023 | Mantém chaves privadas e refresh tokens somente no backend | fora desta entrega |  |
| RCP-024 | Oferece tela com os consentimentos do paciente e a opção de revogar | fora desta entrega |  |
| RCP-025 | Grava os resultados somente no registro do paciente que consentiu | fora desta entrega |  |
| RCP-026 | Ignora campos desconhecidos em respostas | fora desta entrega |  |
| RCP-027 | Quando a conferência do titular não pode ser feita (a leitura do consentimento falha depois das tentativas, ou vem sem `patient.cpf` válido), não conclui o vínculo, não chama a API FHIR, descarta os tokens e revoga com `reason=RECEIVER_TERMINATION` | fora desta entrega | segue |
| RCP-028 | Na revogação, faz no máximo três tentativas automáticas seguidas, respeitando `Retry-After`. Persistindo a falha, grava a revogação como pendente em armazenamento durável, repete conforme o calendário da seção 4.4 e mostra a pendência ao paciente com o endereço da página do provedor | fora desta entrega | segue |
| RCP-029 | Trata 404 `CONSENT_NOT_FOUND` e 422 `CONSENT_INVALID_STATE` na revogação como revogação concluída | fora desta entrega |  |
| RCP-030 | Não segue `link` de paginação fora do `fhir_base_url` do provedor e não envia token nem certificado para esse endereço | fora desta entrega | segue |
| RCP-031 | Recusa provedor cujos metadados não trazem, ou contradizem, um valor obrigatório da seção 5.2 | fora desta entrega | segue |
| RCP-032 | Pede `consent.manage` sempre sozinho, sem outro escopo no mesmo token | fora desta entrega | segue |
| RCP-033 | Com o registro local expirado, não inicia jornadas nem pede tokens de catálogo, unidades ou agenda, e continua tentando as revogações pendentes | fora desta entrega |  |
| RCP-034 | Não usa um token de acesso depois de decorrido o `expires_in` informado | fora desta entrega | segue |
| RCP-035 | Lê o link de pagamento somente da extensão de URL canônica `payment-link` e só o abre se o esquema for `https` | fora desta entrega | segue |
| RCP-036 | Envia `If-None-Exist` na forma literal `identifier={system}\\|{value}`, com `value` restrito ao conjunto de caracteres da seção 5.5.5 | fora desta entrega | segue |
| RCP-037 | Calcula a versão efetiva pela regra da seção 9.1 e não oferece ao paciente provedor sem versão efetiva | fora desta entrega | segue |
| RCP-038 | Grava a revogação em armazenamento durável no momento em que ela é decidida, antes da primeira tentativa, e um reinício durante as tentativas automáticas não a perde | fora desta entrega | segue |
| RCP-039 | Só trata um 404 da revogação como conclusão quando o `OperationOutcome` traz o código `CONSENT_NOT_FOUND`. Um 404 sem esse código mantém a revogação pendente | fora desta entrega | segue |
| RCP-040 | Diante de falha que não admite repetição na revogação (seção 4.4), encerra as tentativas automáticas na hora e mantém a revogação pendente | fora desta entrega | segue |
| RCP-041 | Não faz tentativa de revogação, automática ou do calendário, antes do instante indicado por `Retry-After`, contado até no máximo 24 horas (RCP-050), e encerra as tentativas automáticas quando a espera passa do próprio teto | fora desta entrega | segue |
| RCP-042 | Trata como inválido o CPF que não tem 11 dígitos com dígitos verificadores certos ou que tem onze algarismos iguais, tanto no `patient.cpf` recebido quanto no CPF do paciente que inicia a jornada. Com o CPF do paciente inválido, não inicia a jornada nem troca o código | fora desta entrega | segue |
| RCP-043 | Não segue `link` de paginação com componente de usuário e não faz requisição fora do `fhir_base_url` a partir de link relativo | fora desta entrega | segue |
| RCP-044 | Com mais de uma extensão `payment-link` no `Appointment`, não abre link nenhum | fora desta entrega | segue |
| RCP-045 | No agendamento, identifica o paciente só pela referência `Patient/{fhir_id}`, sem `identifier`, no participante e no `subject` de cada pedido contido | fora desta entrega |  |
| RCP-046 | Não oferece nem chama provedor cujo `api_base_url` não termina em `/v{M}` da versão efetiva | fora desta entrega | segue |
| RCP-047 | Com o registro local expirado, não troca código de autorização, nem de jornada aberta antes do vencimento | fora desta entrega | segue |
| RCP-048 | Não chama provedor que não está `active` no registro aceito, ou sem versão efetiva, nem para revogar. Mantém as revogações pendentes para ele à vista do paciente, com a página do provedor, e retoma o calendário quando ele volta a `active` | fora desta entrega | segue |
| RCP-049 | Não trata como geral um preço que traz contexto de uso que o receptor não reconhece | fora desta entrega | segue |
| RCP-050 | Na revogação, trata `Retry-After` maior que 24 horas como 24 horas e, passado esse prazo, retoma o calendário da seção 4.4 | fora desta entrega | segue |
| RCP-051 | Resolve `link` de paginação relativo contra a URL da requisição que devolveu o Bundle e o segue quando a URL resultante passa nas conferências da seção 5.1 | fora desta entrega | segue |
