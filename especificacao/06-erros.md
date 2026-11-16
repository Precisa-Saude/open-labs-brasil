# 6. Taxonomia de erros

Há duas famílias de erro, separadas pelo endpoint que responde.

| Onde | Formato | Códigos |
| --- | --- | --- |
| Servidor de autorização (PAR, autorização, token, revogação) | JSON do OAuth 2.0, ou parâmetros na consulta do redirecionamento | Os do OAuth, sem códigos novos (seção 6.2) |
| Endpoints de consentimento e API FHIR | `OperationOutcome` do FHIR R4 | Os deste protocolo (seção 6.3), mais `WWW-Authenticate` do [RFC6750] nos erros de token |

O protocolo não cria códigos de erro OAuth. Onde um detalhe a mais ajuda, ele vai em `error_description`, que é texto para diagnóstico e NÃO DEVE ser interpretado por programa.

Há ainda uma situação que não é erro HTTP de ninguém: o receptor constata que o paciente autenticado no provedor não é o que iniciou a jornada. Ela tem código próprio, `PATIENT_MISMATCH`, e está na seção 6.6.

## 6.1 Formato do erro nos endpoints de consentimento e na API FHIR

Toda resposta 4xx ou 5xx desses endpoints DEVE trazer um `OperationOutcome` com ao menos um `issue`. Isso vale também para os endpoints de consentimento, que não são FHIR: um formato só simplifica o cliente. O `Content-Type` do erro é `application/fhir+json` nos dois grupos.

```json
{
  "resourceType": "OperationOutcome",
  "issue": [
    {
      "severity": "error",
      "code": "conflict",
      "details": {
        "coding": [
          { "system": "urn:open-labs-brasil:error-code", "code": "SLOT_UNAVAILABLE" }
        ],
        "text": "O horário escolhido não está mais disponível."
      },
      "diagnostics": "Slot/slot-20261123-1000 passou a busy às 13:58:02Z."
    }
  ]
}
```

| Elemento | Regra |
| --- | --- |
| `issue.severity` | `error` em respostas 4xx e 5xx |
| `issue.code` | Código do conjunto `IssueType` do FHIR R4, conforme a tabela da seção 6.3 [FHIR-OO] |
| `issue.details.coding` | Exatamente um código deste protocolo, com `system` igual a `urn:open-labs-brasil:error-code` |
| `issue.details.text` | Frase em português que pode ser mostrada a uma pessoa da equipe técnica. NÃO DEVE conter dado pessoal |
| `issue.diagnostics` | Opcional. Detalhe técnico, sem dado pessoal e sem rastro de pilha |
| `issue.expression` | Opcional. Caminho FHIRPath do elemento com problema, em erros de validação |

O receptor decide o que fazer pelo código em `issue.details.coding` e pelo status HTTP, nunca pelo texto.

Nos status 401 e 403 causados pelo token, a resposta traz também o cabeçalho do [RFC6750], seção 3, como exige o FAPI 2.0 de servidores de recursos ([FAPI2-SP], seção 5.3.4):

```http
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer error="invalid_token", error_description="consent revoked"
Content-Type: application/fhir+json
x-fapi-interaction-id: 4b1f6a52-9c3d-4e7f-8a10-2d3c4b5a6f70
```

## 6.2 Erros do servidor de autorização

### 6.2.1 PAR e endpoint de token

Corpo JSON com `error` e, opcionalmente, `error_description` [RFC6749], seção 5.2; [RFC9126], seção 2.3.

| `error` | HTTP | Quando | Repetir? |
| --- | --- | --- | --- |
| `invalid_request` | 400 | Parâmetro ausente, repetido ou malformado. No PAR: `response_type` diferente de `code`, `redirect_uri` ausente ou fora do registro, `code_challenge` ausente ou método diferente de `S256`, `consent:{id}` ausente, desconhecido, de outro receptor ou fora de `AWAITING_AUTHORISATION` | Não. Corrigir a requisição |
| `invalid_client` | 401 | Sem autenticação do cliente. Asserção inválida ou expirada, assinada com algoritmo diferente de PS256, com `aud` diferente do `issuer` ou em forma de lista, com `iat` mais de 60 segundos no futuro, ou com `jti` repetido. `client_id` desconhecido. Receptor `suspended` ou `withdrawn` no registro. Certificado TLS que não está no registro | Não, até corrigir chaves ou situação no registro |
| `invalid_grant` | 400 | Código de autorização com mais de 60 segundos, já usado ou emitido para outro cliente. `code_verifier` que não confere. Refresh token inválido, emitido para outro cliente, ou ligado a consentimento que saiu de `AUTHORISED` | Não. Consultar o consentimento (seção 6.4) |
| `unauthorized_client` | 400 | O provedor não atende este receptor para a concessão ou o escopo pedido, por exemplo falta de acordo para `catalog.read`. Também quando o registro do provedor está expirado e o pedido não é `client_credentials` com `consent.manage` como único escopo | Não. No primeiro caso, questão comercial fora do protocolo. No segundo, até o provedor aceitar um registro novo |
| `unsupported_grant_type` | 400 | `grant_type` diferente dos três suportados, inclusive `password` | Não |
| `invalid_scope` | 400 | Escopo desconhecido. Escopo de paciente em `client_credentials`. Escopo de provedor em requisição de autorização. Escopo fora do consentimento. Escopo fora de `scopes_allowed` do receptor | Não |
| `server_error` | 500 | Falha interna | Sim, com recuo exponencial |
| `temporarily_unavailable` | 503 | Sobrecarga ou manutenção | Sim, depois de `Retry-After` |

`server_error` e `temporarily_unavailable` são definidos no [RFC6749] para a resposta de autorização. Este protocolo os usa também no corpo JSON do PAR e do token, com os status 500 e 503.

### 6.2.2 Endpoint de autorização

Devolvidos na consulta do `redirect_uri`, com `state` e `iss` [RFC6749], seção 4.1.2.1; [RFC9207], seção 2. O receptor confere `iss` também nas respostas de erro e ignora a resposta se o valor não for o do provedor da jornada.

| `error` | Quando | Estado do consentimento depois | O que o receptor faz |
| --- | --- | --- | --- |
| `access_denied` | O paciente recusou. Ou o paciente autenticado não tem CPF no cadastro do provedor. Ou o provedor barrou por segurança | `REJECTED` | Consulta o consentimento com token de provedor para ler o motivo e explica ao paciente. Para tentar de novo, cria outro consentimento |
| `server_error` | Falha interna do provedor | Continua `AWAITING_AUTHORISATION` | Novo PAR com o mesmo `consent_id` |
| `temporarily_unavailable` | Provedor indisponível | Continua `AWAITING_AUTHORISATION` | Novo PAR mais tarde |

Quando o `request_uri` está expirado ou já foi usado, ou o `client_id` é desconhecido, o servidor não tem um destino confiável para redirecionar: ele mostra uma página de erro ao paciente e o receptor não recebe resposta. O consentimento continua `AWAITING_AUTHORISATION`, e o receptor PODE fazer novo PAR com o mesmo `consent_id` dentro dos 60 minutos.

Quando o paciente fecha o navegador, também não há redirecionamento. O receptor fica sem resposta, e o consentimento vai a `REJECTED` por `AUTHORISATION_TIMEOUT` aos 60 minutos. Enquanto isso, o receptor PODE oferecer ao paciente retomar a jornada com um novo PAR.

Erro de login do paciente (senha errada, conta bloqueada) é tratado na página do provedor e não gera resposta ao receptor.

## 6.3 Erros dos endpoints de consentimento e da API FHIR

A coluna "Repetir?" diz se a mesma requisição, sem mudança, pode ter sucesso mais tarde.

### 6.3.1 Autenticação e autorização

| Código | HTTP | `issue.code` | `WWW-Authenticate` | Quando | Repetir? |
| --- | --- | --- | --- | --- | --- |
| `TOKEN_MISSING` | 401 | `login` | `Bearer` | Sem cabeçalho `Authorization` | Não |
| `TOKEN_INVALID` | 401 | `login` | `error="invalid_token"` | Token desconhecido, malformado ou expirado | Sim, depois de renovar o token |
| `TOKEN_CERTIFICATE_MISMATCH` | 401 | `security` | `error="invalid_token"` | O certificado da conexão não é o vinculado ao token [RFC8705], seção 3 | Não |
| `CONSENT_REVOKED` | 401 | `security` | `error="invalid_token"` | O consentimento do token está `REVOKED` | Não |
| `CONSENT_EXPIRED` | 401 | `expired` | `error="invalid_token"` | O consentimento do token está `EXPIRED` | Não |
| `SCOPE_INSUFFICIENT` | 403 | `forbidden` | `error="insufficient_scope"` | O token não tem o escopo que o recurso exige, ou é do tipo errado (provedor em recurso de paciente, ou o contrário) | Não |
| `PATIENT_NOT_IN_CONSENT` | 403 | `forbidden` | | Parâmetro `patient` de busca diferente do paciente do consentimento | Não |
| `RECEIVER_NOT_ALLOWED` | 403 | `forbidden` | | O provedor não atende este receptor, o receptor está `suspended`, ou não há versão de protocolo efetiva entre os dois | Não, até mudar a situação |
| `REGISTRY_EXPIRED` | 403 | `forbidden` | | `POST /consents` enquanto o registro de participantes do provedor está expirado. Nesse período o token de `consent.manage` só serve para consultar e revogar ([08-registro-de-participantes.md](08-registro-de-participantes.md), seção 8.3) | Não, até o provedor aceitar um registro novo |
| `CLIENT_CERTIFICATE_REQUIRED` | 401 | `security` | | Conexão sem certificado de cliente, ou com certificado fora do registro. Quando a recusa acontece no handshake TLS, não há resposta HTTP | Não |

### 6.3.2 Requisição

| Código | HTTP | `issue.code` | Quando | Repetir? |
| --- | --- | --- | --- | --- |
| `INVALID_REQUEST` | 400 | `invalid` | JSON malformado, campo obrigatório ausente, tipo errado, campo desconhecido em `POST /consents` (inclusive qualquer identificação de paciente), parâmetro obrigatório de busca ausente | Não |
| `INTERACTION_ID_MISSING` | 400 | `required` | Sem `x-fapi-interaction-id`, ou valor que não é UUID | Não |
| `UNSUPPORTED_SEARCH_PARAMETER` | 400 | `not-supported` | Parâmetro de busca que o provedor não suporta | Não |
| `SEARCH_WINDOW_TOO_LARGE` | 400 | `too-costly` | Janela de `start` maior que 31 dias na busca de Slot | Não |
| `IF_NONE_EXIST_REQUIRED` | 400 | `required` | `POST /Appointment` sem `If-None-Exist`, ou com busca que não seja por `identifier` | Não |
| `IF_MATCH_REQUIRED` | 400 | `required` | `PUT` sem `If-Match` | Não |
| `RESOURCE_NOT_FOUND` | 404 | `not-found` | Recurso inexistente, ou de outro paciente, ou fora do alcance do escopo | Não |
| `CONSENT_NOT_FOUND` | 404 | `not-found` | `consent_id` inexistente, de outro receptor, ou diferente do consentimento do token de paciente | Não |
| `METHOD_NOT_ALLOWED` | 405 | `not-supported` | Método não previsto para o recurso | Não |
| `NOT_ACCEPTABLE` | 406 | `not-supported` | `Accept` que o provedor não atende | Não |
| `UNSUPPORTED_MEDIA_TYPE` | 415 | `not-supported` | `Content-Type` diferente do previsto | Não |

### 6.3.3 Consentimento

| Código | HTTP | `issue.code` | Quando | Repetir? |
| --- | --- | --- | --- | --- |
| `CONSENT_INVALID_SCOPES` | 422 | `business-rule` | Lista vazia, escopo de provedor, escopo desconhecido, escopo que o provedor não suporta ou que o registro não permite ao receptor | Não |
| `CONSENT_INVALID_EXPIRATION` | 422 | `business-rule` | Data no passado ou a mais de 12 meses | Não |
| `CONSENT_INVALID_STATE` | 422 | `business-rule` | `DELETE` em consentimento que já está em estado final | Não |

### 6.3.4 Agenda e agendamento

| Código | HTTP | `issue.code` | Quando | Repetir? |
| --- | --- | --- | --- | --- |
| `EXAM_NOT_AVAILABLE_AT_LOCATION` | 200 na busca de Slot, 422 no agendamento | `business-rule` | Exame que a unidade não coleta. Na busca, vem como entrada informativa do Bundle, com `severity` igual a `information` | Não |
| `SLOT_UNAVAILABLE` | 409 | `conflict` | O horário deixou de estar livre | Não com o mesmo horário. Buscar horários de novo |
| `VERSION_CONFLICT` | 412 | `conflict` | `If-Match` não corresponde à versão atual | Sim, depois de ler de novo o recurso |
| `APPOINTMENT_NOT_MODIFIABLE` | 422 | `business-rule` | Agendamento em estado que não admite alteração, ou fora da política de alteração do provedor | Não |
| `APPOINTMENT_FIELD_NOT_MODIFIABLE` | 422 | `business-rule` | `PUT` que altera elemento que o receptor não pode alterar, inclusive os pedidos contidos | Não |
| `INVALID_RESOURCE` | 422 | `invariant` | Recurso que não valida contra o perfil: sem pedido contido, pedido contido sem `basedOn` correspondente, `basedOn` para fora do recurso, estado inicial diferente de `proposed`. `issue.expression` aponta o elemento | Não |
| `PATIENT_NOT_IN_CONSENT` | 422 | `business-rule` | Recurso enviado referencia paciente diferente do paciente do consentimento | Não |

`PATIENT_NOT_IN_CONSENT` aparece com 403 em leituras e com 422 em escritas. O código é o mesmo porque a causa é a mesma: a chamada aponta para um paciente que não é o do consentimento do token.

### 6.3.5 Operação

| Código | HTTP | `issue.code` | Quando | Repetir? |
| --- | --- | --- | --- | --- |
| `RATE_LIMITED` | 429 | `throttled` | Limite de chamadas excedido [RFC6585], seção 4 | Sim, depois de `Retry-After` |
| `INTERNAL_ERROR` | 500 | `exception` | Falha interna | Sim, com recuo exponencial, no máximo 3 tentativas |
| `PROVIDER_UNAVAILABLE` | 503 | `transient` | Manutenção ou sobrecarga | Sim, depois de `Retry-After` |
| `UPSTREAM_TIMEOUT` | 504 | `timeout` | Sistema interno do provedor não respondeu a tempo | Sim, com recuo exponencial |

## 6.4 Regras para o receptor

1. **Repetição segura.** `GET` e `DELETE` de consentimento PODEM ser repetidos. Na revogação, 404 `CONSENT_NOT_FOUND` e 422 `CONSENT_INVALID_STATE` contam como concluída: o consentimento já não vale no provedor. O código é lido do `OperationOutcome` (seção 6.1), e um 404 sem ele não conta como conclusão ([04-ciclo-de-vida-do-consentimento.md](04-ciclo-de-vida-do-consentimento.md), seção 4.4, "Revogação pendente", item 8). A criação de agendamento PODE ser repetida porque é condicional (`If-None-Exist`): a segunda tentativa recebe 200 e não cria outro. `PUT` de agendamento PODE ser repetido com o mesmo `If-Match`: se a primeira tentativa foi aplicada, a segunda recebe 412, e o receptor lê o recurso para conferir.
2. **Recuo e limite.** Em erros marcados "com recuo exponencial", o receptor espera ao menos 1 segundo antes da primeira repetição e dobra a espera a cada tentativa. Com `Retry-After`, espera ao menos o valor indicado. Se o valor passa do que o receptor aceita esperar, ele não repete. Nenhuma operação é repetida automaticamente mais de três vezes seguidas, contando a primeira tentativa. Depois disso a operação falha para quem a pediu, com uma exceção: a revogação de consentimento, que passa a pendente e continua sendo tentada em calendário próprio ([04-ciclo-de-vida-do-consentimento.md](04-ciclo-de-vida-do-consentimento.md), seção 4.4, "Revogação pendente"). As repetições desse calendário são a exceção prevista aqui e não contam como repetir um erro 4xx sem mudança, mesmo quando a última resposta foi um 4xx.
3. **401 em recurso.** O receptor tenta renovar o token uma vez. Se a renovação devolver `invalid_grant`, ele consulta `GET /consents/{consent_id}` com um token de provedor e age conforme o estado: `REVOKED` ou `EXPIRED` encerram o vínculo. `AUTHORISED` com `invalid_grant` indica que o refresh token foi revogado isoladamente, e só um novo consentimento devolve o acesso.
4. **403 `RECEIVER_NOT_ALLOWED` e `invalid_client`.** O receptor para de chamar aquele provedor e confere a própria situação no registro. Insistir não muda o resultado. A única chamada que continua é a repetição em calendário das revogações pendentes, uma por vencimento, enquanto o receptor e o provedor estiverem `active` no registro aceito pelo receptor.
5. **Erros desconhecidos.** Um código que o receptor não conhece é tratado pelo status HTTP: 4xx não se repete, 5xx se repete com recuo.
6. **Correlação.** Ao pedir suporte ao provedor, o receptor informa o `x-fapi-interaction-id` da chamada. Os dois lados DEVEM guardar esse valor em log por ao menos 90 dias.

## 6.5 Regras para o provedor

1. Erros de segurança são avaliados antes dos de negócio: certificado, token, escopo e consentimento primeiro, validação de conteúdo depois.
2. Uma resposta de erro NÃO DEVE revelar a existência de recursos de outro paciente. Por isso a leitura de recurso alheio devolve 404.
3. `diagnostics` e `error_description` NÃO DEVEM conter dado pessoal, CPF, resultado de exame, token ou segredo.
4. Toda resposta de erro traz `x-fapi-interaction-id`.

## 6.6 Divergência de titular: `PATIENT_MISMATCH`

`PATIENT_MISMATCH` não é devolvido por nenhum endpoint. É o código que o receptor usa quando, na conferência do titular ([02-fluxos.md](02-fluxos.md), fluxo 2.2, passos 10 e 11), o `patient.cpf` lido do consentimento é diferente do CPF do paciente que iniciou a jornada no aplicativo.

| Onde aparece | Forma |
| --- | --- |
| Na revogação que o receptor DEVE enviar | `DELETE /consents/{consent_id}?reason=PATIENT_MISMATCH` |
| No consentimento, depois da revogação | `status` igual a `REVOKED`, `status_reason.code` igual a `PATIENT_MISMATCH`, `ended_via` igual a `RECEIVER` |
| No registro de auditoria do receptor | Evento com o `consent_id` e o `x-fapi-interaction-id` da leitura, sem nenhum dos dois CPFs |

O que o receptor faz, nesta ordem:

1. Não chama a API FHIR com o token recebido.
2. Descarta o token de acesso, o refresh token e o CPF recebido.
3. Grava a revogação de forma durável e envia o `DELETE` com um token de provedor. Se falhar, aplica a regra da revogação pendente: até três tentativas, depois pendência repetida em calendário e visível ao paciente.
4. Explica ao paciente, sem mostrar o CPF recebido, que a conta usada no laboratório pertence a outra pessoa, e oferece recomeçar.

Não repetir: a mesma jornada não pode ter outro resultado. Uma nova tentativa é um novo consentimento, com novo login no laboratório.

**Quando a conferência não pôde ser feita.** Se a leitura do consentimento falha, ou vem sem um `patient.cpf` válido, não houve divergência observada, e `PATIENT_MISMATCH` seria uma afirmação falsa no histórico do consentimento. O receptor segue os mesmos quatro passos com duas diferenças: o motivo do `DELETE` é `RECEIVER_TERMINATION`, e a mensagem ao paciente diz que a conexão não pôde ser concluída, sem mencionar outra pessoa. As condições estão em [04-ciclo-de-vida-do-consentimento.md](04-ciclo-de-vida-do-consentimento.md), seção 4.4, "Conferência impossível".

O provedor não precisa agir além de processar o `DELETE`. Ele PODE usar a ocorrência de `PATIENT_MISMATCH` em seus controles de segurança, por exemplo para notar um receptor com taxa alta de divergência.
