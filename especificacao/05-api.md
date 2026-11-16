# 5. Superfície da API

O provedor de dados expõe três grupos de endpoints. A distinção importa para quem implementa, porque cada grupo segue uma norma diferente.

| Grupo | Norma | Base | Corpo de erro |
| --- | --- | --- | --- |
| **Servidor de autorização** | OAuth 2.0 no perfil FAPI 2.0, sem alteração de sintaxe | Endpoints anunciados no documento de metadados do `issuer` | JSON do OAuth (`error`, `error_description`) |
| **Endpoints de consentimento** | Definidos por este protocolo | `{api_base_url}` do registro | `OperationOutcome` |
| **API FHIR** | Interações REST do FHIR R4, sem operações próprias | `{fhir_base_url}` do registro | `OperationOutcome` |

Nos exemplos, o provedor é `laboratorio.example` e o receptor é `app-paciente.example`. Os valores de tokens e assinaturas estão abreviados.

## 5.1 Convenções

**Transporte.** Todos os endpoints usam HTTPS. Todos, menos o endpoint de autorização, o documento de metadados e o `jwks_uri`, exigem mTLS com o certificado do receptor ([07-perfil-de-seguranca.md](07-perfil-de-seguranca.md), seção 7.5).

**Cabeçalhos nos endpoints de consentimento e na API FHIR.**

| Cabeçalho | Requisição | Resposta | Regra |
| --- | --- | --- | --- |
| `Authorization: Bearer {access_token}` | Obrigatório | | O token vai somente no cabeçalho, nunca na URL [RFC6750] |
| `x-fapi-interaction-id` | Obrigatório | Obrigatório | UUID gerado pelo receptor a cada chamada. O provedor devolve o mesmo valor e o grava em log. Sem o cabeçalho, 400 com `INTERACTION_ID_MISSING` |
| `Accept` | Obrigatório | | `application/fhir+json` na API FHIR, `application/json` nos endpoints de consentimento |
| `Content-Type` | Quando há corpo | Quando há corpo | Os mesmos tipos de `Accept`, em UTF-8 |
| `If-None-Exist` | Obrigatório em `POST /Appointment` | | Busca pelo identificador do receptor (seção 5.5.5) |
| `If-Match` | Obrigatório em `PUT` | | Valor do `ETag` lido, por exemplo `W/"3"` |
| `ETag` | | Em leituras e escritas de recurso FHIR | Versão do recurso [FHIR-HTTP] |
| `Retry-After` | | Em 429 e 503 | Segundos a esperar |

A origem do cabeçalho `x-fapi-interaction-id` está em [07-perfil-de-seguranca.md](07-perfil-de-seguranca.md), seção 7.9.

**Formato.** JSON apenas. O provedor NÃO precisa suportar XML.

**Datas.** Nos endpoints de consentimento, `date-time` em UTC com sufixo `Z` e sem fração de segundo (`2027-05-15T03:00:00Z`). Na API FHIR, os tipos do FHIR.

**Paginação na API FHIR.** Buscas devolvem `Bundle` do tipo `searchset`. O receptor PODE enviar `_count` (padrão 20, máximo 100). Quando há mais resultados, o Bundle traz `link` com `relation` igual a `next`, e o receptor segue essa URL sem alterá-la. O FHIR trata esses links como opacos para o cliente [FHIR-HTTP], e por isso o protocolo limita para onde eles podem apontar:

- O provedor DEVE emitir todo `link` de paginação dentro do seu `fhir_base_url` do registro: mesmo esquema, mesmo host, mesma porta, e caminho que começa pelo caminho da base, em fronteira de segmento.
- Antes de seguir um `link`, o receptor DEVE conferir essas quatro condições contra o `fhir_base_url` do registro. Se alguma falha, ele NÃO DEVE fazer a requisição, nem com token nem sem ele, e trata a busca como erro do provedor. Assim um token de acesso e o certificado do cliente nunca são apresentados a outro endereço.
- A comparação é feita depois de interpretar a URL, sem seguir redirecionamentos. O receptor NÃO DEVE seguir redirecionamento HTTP em chamadas à API FHIR ou aos endpoints de consentimento.

**Identificador do paciente.** O receptor obtém o id lógico do recurso Patient em `patient.fhir_id`, na leitura do consentimento com token de paciente (seção 5.4.2), e o usa no parâmetro `patient` das buscas e nas referências `Patient/{id}`.

## 5.2 Descoberta

O receptor lê o registro de participantes e, para cada provedor ativo, busca o documento de metadados do servidor de autorização, no caminho definido pelo [RFC8414], seção 3:

```http
GET /.well-known/oauth-authorization-server HTTP/1.1
Host: auth.laboratorio.example
```

Quando o `issuer` tem caminho (por exemplo `https://laboratorio.example/auth`), o trecho `/.well-known/oauth-authorization-server` entra entre o host e o caminho. O `issuer` do documento DEVE ser idêntico ao `issuer` do registro, e o receptor DEVE recusar o provedor se não for.

Exemplo de documento:

```json
{
  "issuer": "https://auth.laboratorio.example",
  "authorization_endpoint": "https://auth.laboratorio.example/authorize",
  "token_endpoint": "https://mtls.auth.laboratorio.example/token",
  "pushed_authorization_request_endpoint": "https://mtls.auth.laboratorio.example/par",
  "jwks_uri": "https://auth.laboratorio.example/jwks",
  "require_pushed_authorization_requests": true,
  "authorization_response_iss_parameter_supported": true,
  "response_types_supported": ["code"],
  "grant_types_supported": ["authorization_code", "refresh_token", "client_credentials"],
  "scopes_supported": ["catalog.read", "locations.read", "schedule.read", "consent.manage", "appointment.write", "results.read", "consent.read"],
  "token_endpoint_auth_methods_supported": ["private_key_jwt"],
  "token_endpoint_auth_signing_alg_values_supported": ["PS256"],
  "code_challenge_methods_supported": ["S256"],
  "tls_client_certificate_bound_access_tokens": true
}
```

**Valores obrigatórios.** O documento DEVE trazer cada campo abaixo com o valor indicado. O receptor DEVE conferir todos e DEVE recusar o provedor se algum faltar ou tiver valor diferente. A recusa é necessária porque vários desses campos têm, por omissão, um valor incompatível com o perfil.

| Campo | Valor exigido | Origem | Valor por omissão, se o campo faltar |
| --- | --- | --- | --- |
| `issuer` | Idêntico ao `issuer` do registro | [RFC8414] 2 e 3; [FAPI2-SP] 5.3.3.1 | (obrigatório no RFC) |
| `authorization_endpoint` | URL `https` | [RFC8414] 2 | |
| `token_endpoint` | URL `https` | [RFC8414] 2 | |
| `pushed_authorization_request_endpoint` | URL `https` | [RFC9126] 5; [FAPI2-SP] 5.3.2.2 | |
| `jwks_uri` | URL `https` | [RFC8414] 2; [FAPI2-SP] 5.4.2 | |
| `require_pushed_authorization_requests` | `true` | [RFC9126] 5; [FAPI2-SP] 5.3.2.2 (recusar requisição sem PAR) | `false` |
| `authorization_response_iss_parameter_supported` | `true` | [RFC9207] 2.3 e 3; [FAPI2-SP] 5.3.2.2 | `false` |
| `tls_client_certificate_bound_access_tokens` | `true` | [RFC8705] 3.3; [FAPI2-SP] 5.3.2.1 | `false` |
| `response_types_supported` | Exatamente `["code"]` | [RFC8414] 2; [FAPI2-SP] 5.3.2.2 | (obrigatório no RFC) |
| `grant_types_supported` | Contém `authorization_code`, `refresh_token` e `client_credentials`. Não contém `password` nem `implicit` | [RFC8414] 2; [FAPI2-SP] 5.3.2.1 | `["authorization_code", "implicit"]` |
| `token_endpoint_auth_methods_supported` | Exatamente `["private_key_jwt"]` | [RFC8414] 2; [FAPI2-SP] 5.3.2.1 | `client_secret_basic` |
| `token_endpoint_auth_signing_alg_values_supported` | Exatamente `["PS256"]` | [RFC8414] 2, que o exige quando `private_key_jwt` é anunciado; [FAPI2-SP] 5.4.1 | Nenhum algoritmo |
| `code_challenge_methods_supported` | Exatamente `["S256"]` | [RFC8414] 2; [FAPI2-SP] 5.3.2.2 | Sem suporte a PKCE |
| `scopes_supported` | Contém todos os escopos de `scopes_supported` do provedor no registro | [RFC8414] 2 (recomendado lá, obrigatório aqui) | |

Campos além desses são ignorados pelo receptor.

O provedor PODE anunciar `mtls_endpoint_aliases` e `revocation_endpoint`. Quando `mtls_endpoint_aliases` existir, o receptor DEVE usar os endereços dele para os endpoints que exigem mTLS [RFC8705], seção 5. Os caminhos do exemplo (`/authorize`, `/token`, `/par`) são ilustrativos: o receptor usa sempre os valores do documento.

O receptor PODE guardar o documento em cache por até 24 horas.

## 5.3 Endpoints do servidor de autorização

### 5.3.1 Autenticação do cliente

Em toda chamada ao PAR, ao endpoint de token e ao de revogação, o receptor se autentica com `private_key_jwt` [OIDC], seção 9, enviando dois parâmetros de formulário:

| Parâmetro | Valor |
| --- | --- |
| `client_assertion_type` | `urn:ietf:params:oauth:client-assertion-type:jwt-bearer` |
| `client_assertion` | JWT assinado com PS256 pela chave de assinatura do receptor |

Conteúdo do JWT:

| Campo | Onde | Valor |
| --- | --- | --- |
| `alg` | cabeçalho | `PS256` |
| `kid` | cabeçalho | Identificador da chave no `jwks_uri` do receptor |
| `iss` | corpo | `client_id` do receptor |
| `sub` | corpo | `client_id` do receptor |
| `aud` | corpo | `issuer` do provedor, como texto simples e não como lista |
| `jti` | corpo | Valor único. O servidor recusa `jti` repetido dentro da validade |
| `iat` | corpo | Instante de emissão |
| `exp` | corpo | No máximo 60 segundos depois de `iat` |

O servidor só aceita o próprio `issuer` em `aud`. A URL do endpoint de token ou do PAR em `aud` é recusada ([FAPI2-SP], seção 5.3.2.1).

### 5.3.2 PAR: `POST {pushed_authorization_request_endpoint}`

Requisição, `Content-Type: application/x-www-form-urlencoded`. Os parâmetros de autorização vão como campos do formulário, sem objeto de requisição assinado.

| Parâmetro | Obrigatório | Valor |
| --- | --- | --- |
| `client_assertion_type` | Sim | Seção 5.3.1 |
| `client_assertion` | Sim | Seção 5.3.1 |
| `client_id` | Sim | `client_id` do receptor |
| `response_type` | Sim | `code` |
| `redirect_uri` | Sim | Um dos `redirect_uris` do receptor no registro, idêntico caractere a caractere |
| `scope` | Sim | `consent:{consent_id}` mais um ou mais escopos do consentimento, separados por espaço |
| `state` | Sim | Valor aleatório gerado pelo receptor para esta jornada |
| `code_challenge` | Sim | `BASE64URL(SHA256(code_verifier))` [RFC7636] |
| `code_challenge_method` | Sim | `S256` |

Exemplo, com quebras de linha só para leitura:

```http
POST /par HTTP/1.1
Host: mtls.auth.laboratorio.example
Content-Type: application/x-www-form-urlencoded

client_assertion_type=urn%3Aietf%3Aparams%3Aoauth%3Aclient-assertion-type%3Ajwt-bearer
&client_assertion=eyJhbGciOiJQUzI1NiIsImtpZCI6Ii4uLiJ9...
&client_id=c2b8f6a4-71de-4c0b-8f3a-9e5d2a7b6c31
&response_type=code
&redirect_uri=https%3A%2F%2Fapp-paciente.example%2Fconexoes%2Fretorno
&scope=consent%3A7c1d5f0a-2b3e-4a6c-8d9e-0f1a2b3c4d5e%20appointment.write%20results.read%20consent.read
&state=Zk3vP0qLr8sT
&code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM
&code_challenge_method=S256
```

O valor de `code_challenge` acima é o do exemplo do [RFC7636], apêndice B.

Resposta de sucesso, 201:

```json
{
  "request_uri": "urn:ietf:params:oauth:request_uri:6esc_11ACC5bwc014ltc14eY22c",
  "expires_in": 300
}
```

`expires_in` DEVE ser de ao menos 120 e menor que 600 segundos. O `request_uri` é de uso único, e o uso é contado na autorização, não no carregamento da página.

Erros: 400 com `invalid_request`, `invalid_scope`, `unauthorized_client`; 401 com `invalid_client`. Ver [06-erros.md](06-erros.md), seção 6.2.

### 5.3.3 Autorização: `GET {authorization_endpoint}`

É a única URL do provedor aberta no navegador do paciente pelo receptor.

```
https://auth.laboratorio.example/authorize
  ?client_id=c2b8f6a4-71de-4c0b-8f3a-9e5d2a7b6c31
  &request_uri=urn%3Aietf%3Aparams%3Aoauth%3Arequest_uri%3A6esc_11ACC5bwc014ltc14eY22c
```

Apenas `client_id` e `request_uri` são enviados ([FAPI2-SP], seção 5.3.3.2). O servidor DEVE recusar requisições de autorização que não venham de um PAR.

Resposta de sucesso: redirecionamento para o `redirect_uri` com os parâmetros na consulta da URL.

```
https://app-paciente.example/conexoes/retorno
  ?code=SplxlOBeZQQYbYS6WxSbIA
  &state=Zk3vP0qLr8sT
  &iss=https%3A%2F%2Fauth.laboratorio.example
```

| Parâmetro | Conferência pelo receptor |
| --- | --- |
| `state` | Igual ao enviado no PAR desta jornada |
| `iss` | Igual, por comparação simples de texto, ao `issuer` do provedor para o qual a jornada foi aberta. Resposta sem `iss` ou com valor diferente é recusada, e o código não é trocado [RFC9207], seção 2.4 |
| `code` | Trocado uma única vez, em até 60 segundos |

A resposta de autorização NÃO DEVE conter token, CPF, nome nem qualquer outro dado do paciente.

Resposta de erro: redirecionamento com `error`, `error_description` (opcional), `state` e `iss`. Quando o `client_id` ou o `request_uri` são inválidos, o servidor mostra uma página de erro e não redireciona.

### 5.3.4 Token: `POST {token_endpoint}`

`Content-Type: application/x-www-form-urlencoded`. Sempre com `client_assertion_type` e `client_assertion` (seção 5.3.1).

**Concessão `client_credentials`** (token de provedor)

| Parâmetro | Obrigatório | Valor |
| --- | --- | --- |
| `grant_type` | Sim | `client_credentials` |
| `scope` | Sim | Um ou mais de `catalog.read`, `locations.read`, `schedule.read`, `consent.manage` |

```json
{
  "access_token": "2YotnFZFEjr1zCsicMWpAA",
  "token_type": "Bearer",
  "expires_in": 600,
  "scope": "catalog.read locations.read schedule.read"
}
```

A resposta não traz `refresh_token` [RFC6749], seção 4.4.3.

**Concessão `authorization_code`** (token de paciente)

| Parâmetro | Obrigatório | Valor |
| --- | --- | --- |
| `grant_type` | Sim | `authorization_code` |
| `code` | Sim | O código recebido no redirecionamento |
| `redirect_uri` | Sim | O mesmo enviado no PAR |
| `code_verifier` | Sim | O valor que gerou o `code_challenge`, de 43 a 128 caracteres [RFC7636] |

```json
{
  "access_token": "SlAV32hkKG",
  "token_type": "Bearer",
  "expires_in": 600,
  "refresh_token": "8xLOxBtZp8",
  "scope": "consent:7c1d5f0a-2b3e-4a6c-8d9e-0f1a2b3c4d5e appointment.write results.read consent.read"
}
```

A resposta contém apenas membros do OAuth 2.0. Ela NÃO DEVE conter CPF, id de paciente nem `id_token`. O receptor obtém a identificação do paciente na leitura do consentimento (seção 5.4.2), pelas razões de [07-perfil-de-seguranca.md](07-perfil-de-seguranca.md), seção 7.7.

O código de autorização vale por no máximo 60 segundos e uma única troca. Um código apresentado pela segunda vez DEVE ser recusado com `invalid_grant`.

**Concessão `refresh_token`**

| Parâmetro | Obrigatório | Valor |
| --- | --- | --- |
| `grant_type` | Sim | `refresh_token` |
| `refresh_token` | Sim | O refresh token do consentimento |
| `scope` | Não | Subconjunto dos escopos originais. Pedir um subconjunto limita só o token desta resposta e não reduz o que o refresh token alcança |

A resposta tem o mesmo formato. Em operação normal o servidor não devolve `refresh_token`, ou devolve o mesmo. Se devolver um diferente, o receptor DEVE passar a usar o novo e PODE repetir com o antigo caso não tenha conseguido gravar a resposta ([07-perfil-de-seguranca.md](07-perfil-de-seguranca.md), seção 7.4).

**Regras comuns**

- `expires_in` DEVE ficar entre 300 e 900.
- **Um token por escopo.** O servidor DEVE aceitar um pedido `client_credentials` com um único escopo de provedor, qualquer que seja. O receptor DEVERIA pedir um token por escopo, para que cada chamada leve só o privilégio de que precisa, como o FAPI 2.0 recomenda ([FAPI2-SP], seção 5.3.3.1). O receptor PODE combinar `catalog.read`, `locations.read` e `schedule.read` em um token. O receptor DEVE pedir `consent.manage` sempre sozinho: é o único escopo aceito com o registro expirado ([08-registro-de-participantes.md](08-registro-de-participantes.md), seção 8.3), e um token que só gerencia consentimentos não deve carregar acesso a mais nada.
- **Tempo de uso do token.** O receptor NÃO DEVE usar um token de acesso depois de decorrido o `expires_in` informado, contado do recebimento da resposta pelo próprio relógio. O receptor DEVERIA parar de usá-lo antes, com margem de ao menos 30 segundos, e PODE adotar margem maior. O receptor NÃO DEVE guardar tokens de provedor em armazenamento durável: eles são baratos de obter de novo.
- O token de acesso DEVE estar vinculado ao certificado apresentado na conexão ([07-perfil-de-seguranca.md](07-perfil-de-seguranca.md), seção 7.5).
- O receptor trata o token como texto opaco.
- Erros: 400 com `invalid_request`, `invalid_grant`, `invalid_scope`, `unauthorized_client`, `unsupported_grant_type`; 401 com `invalid_client`.

### 5.3.5 Revogação de token: `POST {revocation_endpoint}` (opcional)

O provedor PODE oferecer o endpoint do [RFC7009]. O caminho normal para encerrar o acesso é revogar o consentimento (seção 5.4.3), que invalida os tokens. O endpoint de revogação serve para o receptor descartar um token específico, por exemplo depois de suspeitar de vazamento, sem encerrar o consentimento.

O receptor não é obrigado a chamar este endpoint em nenhum fluxo, e um receptor que nunca o chama é conforme. Em particular, a revogação de consentimento NÃO DEVE ser feita por aqui: ela é sempre o `DELETE` do consentimento, que é o que muda o estado e deixa registro do motivo. Depois de um `DELETE` bem-sucedido, chamar a revogação de token é desnecessário, porque o provedor já invalidou os tokens.

| Parâmetro | Obrigatório | Valor |
| --- | --- | --- |
| `token` | Sim | O token a revogar |
| `token_type_hint` | Não | `refresh_token` ou `access_token` |

Resposta 200 sem corpo, inclusive para token desconhecido [RFC7009], seção 2.2. Revogar o refresh token deixa o consentimento `AUTHORISED` mas sem acesso: para voltar a ter tokens, o receptor precisa de um novo consentimento.

### 5.3.6 Chaves: `GET {jwks_uri}`

Devolve o conjunto de chaves públicas do servidor de autorização em formato JWK Set [RFC7517]. Na versão 1 o receptor não valida nenhum JWT emitido pelo provedor, então não precisa deste endpoint. Ele existe porque o FAPI 2.0 recomenda `jwks_uri` para servidores de autorização e serve a provedores que emitem tokens de acesso em JWT.

## 5.4 Endpoints de consentimento

Base: `{api_base_url}`, por exemplo `https://api.laboratorio.example/acesso/v0`. Só alcançam consentimentos criados pelo mesmo `client_id`.

| Endpoint | Token aceito |
| --- | --- |
| `POST /consents` | Provedor, com `consent.manage` |
| `GET /consents/{consent_id}` | Provedor, com `consent.manage`, ou paciente, ligado àquele consentimento |
| `DELETE /consents/{consent_id}` | Provedor, com `consent.manage` |

### 5.4.1 Criar: `POST {api_base_url}/consents`

Requisição:

```json
{
  "scopes": ["appointment.write", "results.read", "consent.read"],
  "purpose": "Reunir seus resultados de exames no seu histórico de saúde e agendar novos exames quando você pedir.",
  "expiration_date_time": "2027-05-15T03:00:00Z",
  "data_period": { "start": "2022-01-01" }
}
```

| Campo | Tipo | Obrigatório | Regra |
| --- | --- | --- | --- |
| `scopes` | lista de texto | Sim | Um ou mais escopos de paciente, sem repetição |
| `purpose` | texto, 10 a 300 caracteres | Sim | Finalidade, em português, mostrada ao paciente sem alteração |
| `expiration_date_time` | data e hora | Sim | No futuro, a no máximo 12 meses |
| `data_period.start` | data | Não | Só resultados com data clínica a partir deste dia. Ausente: sem limite inferior |
| `data_period.end` | data | Não | Só resultados com data clínica até este dia. Ausente: até o fim do consentimento |

A requisição não identifica o paciente. Um corpo com `patient`, `cpf` ou qualquer outro campo fora da tabela DEVE ser recusado com 400 `INVALID_REQUEST`.

Resposta 201, com cabeçalho `Location: {api_base_url}/consents/{consent_id}`:

```json
{
  "consent_id": "7c1d5f0a-2b3e-4a6c-8d9e-0f1a2b3c4d5e",
  "status": "AWAITING_AUTHORISATION",
  "creation_date_time": "2026-11-16T14:00:00Z",
  "status_update_date_time": "2026-11-16T14:00:00Z",
  "expiration_date_time": "2027-05-15T03:00:00Z",
  "scopes": ["appointment.write", "results.read", "consent.read"],
  "purpose": "Reunir seus resultados de exames no seu histórico de saúde e agendar novos exames quando você pedir.",
  "data_period": { "start": "2022-01-01" }
}
```

| Campo | Tipo | Regra |
| --- | --- | --- |
| `consent_id` | texto, 1 a 128 caracteres | Apenas `A-Z`, `a-z`, `0-9`, `-`, `.`, `_`, `~`. Imprevisível. O provedor DEVERIA usar UUID versão 4 |
| `status` | texto | Um dos cinco estados de [04-ciclo-de-vida-do-consentimento.md](04-ciclo-de-vida-do-consentimento.md) |
| `creation_date_time` | data e hora | Instante da criação |
| `status_update_date_time` | data e hora | Instante da última transição |
| `status_reason` | objeto | Presente apenas em estados finais (seção 5.4.2) |
| `patient` | objeto | Presente apenas na leitura com token de paciente (seção 5.4.2) |

Erros: 400 `INVALID_REQUEST`; 403 `RECEIVER_NOT_ALLOWED`; 422 `CONSENT_INVALID_SCOPES`, `CONSENT_INVALID_EXPIRATION`.

### 5.4.2 Consultar: `GET {api_base_url}/consents/{consent_id}`

A resposta depende do token.

**Com token de paciente** ligado ao consentimento. É a leitura da conferência do titular. O consentimento está necessariamente `AUTHORISED`, e a resposta inclui `patient`:

```json
{
  "consent_id": "7c1d5f0a-2b3e-4a6c-8d9e-0f1a2b3c4d5e",
  "status": "AUTHORISED",
  "creation_date_time": "2026-11-16T14:00:00Z",
  "status_update_date_time": "2026-11-16T14:03:41Z",
  "expiration_date_time": "2027-05-15T03:00:00Z",
  "scopes": ["appointment.write", "results.read", "consent.read"],
  "purpose": "Reunir seus resultados de exames no seu histórico de saúde e agendar novos exames quando você pedir.",
  "data_period": { "start": "2022-01-01" },
  "patient": {
    "cpf": "52998224725",
    "fhir_id": "pac-8842"
  }
}
```

| Campo de `patient` | Tipo | Regra |
| --- | --- | --- |
| `cpf` | texto, 11 dígitos | CPF que consta do cadastro do provedor para o paciente que se autenticou e aprovou. Sem pontuação |
| `fhir_id` | texto | Id lógico do recurso Patient desse paciente na API FHIR do provedor |

O CPF do exemplo tem dígitos verificadores válidos e está aqui só como ilustração de formato.

O receptor DEVE fazer esta leitura antes de qualquer chamada à API FHIR e comparar `patient.cpf` com o CPF do paciente que iniciou a jornada. Em caso de diferença, revoga com `reason=PATIENT_MISMATCH` (seção 5.4.3). As regras completas estão em [04-ciclo-de-vida-do-consentimento.md](04-ciclo-de-vida-do-consentimento.md), seção 4.4.

Se o `consent_id` do caminho não é o do token, 404 `CONSENT_NOT_FOUND`.

**Com token de provedor.** Serve para acompanhar o estado. A resposta nunca inclui `patient`. Em estado final, inclui `status_reason`:

```json
{
  "consent_id": "7c1d5f0a-2b3e-4a6c-8d9e-0f1a2b3c4d5e",
  "status": "REVOKED",
  "creation_date_time": "2026-11-16T14:00:00Z",
  "status_update_date_time": "2027-01-20T18:22:10Z",
  "expiration_date_time": "2027-05-15T03:00:00Z",
  "scopes": ["appointment.write", "results.read", "consent.read"],
  "purpose": "Reunir seus resultados de exames no seu histórico de saúde e agendar novos exames quando você pedir.",
  "data_period": { "start": "2022-01-01" },
  "status_reason": {
    "code": "PATIENT_REQUEST",
    "ended_via": "PROVIDER",
    "additional_information": "Revogado pelo paciente na página de compartilhamentos."
  }
}
```

| Campo de `status_reason` | Valores |
| --- | --- |
| `code` | `PATIENT_REJECTED`, `AUTHORISATION_TIMEOUT`, `PATIENT_WITHOUT_CPF`, `PATIENT_MISMATCH`, `PATIENT_REQUEST`, `RECEIVER_TERMINATION`, `RECEIVER_WITHDRAWN`, `PROVIDER_SECURITY`, `TECHNICAL_ISSUE`, `MAX_DATE_REACHED` |
| `ended_via` | `RECEIVER`, `PROVIDER`, `SYSTEM` |
| `additional_information` | Texto livre opcional, até 140 caracteres, sem dado pessoal |

Erros: 404 `CONSENT_NOT_FOUND` (também quando o consentimento é de outro receptor).

### 5.4.3 Revogar: `DELETE {api_base_url}/consents/{consent_id}`

| Parâmetro de consulta | Obrigatório | Valor |
| --- | --- | --- |
| `reason` | Não | `PATIENT_REQUEST` (padrão), `RECEIVER_TERMINATION` ou `PATIENT_MISMATCH` |

`PATIENT_MISMATCH` é o motivo que o receptor envia quando o CPF devolvido na conferência do titular não é o do paciente que iniciou a jornada.

Resposta 204 sem corpo. Efeitos: transição T6, T8, T9 ou T11 de [04-ciclo-de-vida-do-consentimento.md](04-ciclo-de-vida-do-consentimento.md) e invalidação imediata dos tokens.

Erros: 400 `INVALID_REQUEST` para `reason` desconhecido; 404 `CONSENT_NOT_FOUND`; 422 `CONSENT_INVALID_STATE` quando o consentimento já está em estado final.

## 5.5 API FHIR

Base: `{fhir_base_url}`, por exemplo `https://api.laboratorio.example/fhir/r4`. Versão do FHIR: R4 (4.0.1). Todas as interações abaixo são as interações REST padrão do FHIR [FHIR-HTTP]: `read`, `search-type`, `create` e `update`. O protocolo não define operações `$` próprias e não usa `transaction`.

O provedor DEVE suportar todas as interações e todos os parâmetros de busca marcados como obrigatórios. Parâmetros não listados PODEM ser suportados. Diante de um parâmetro que não suporta, o provedor DEVE responder 400 com `UNSUPPORTED_SEARCH_PARAMETER`, em vez de ignorá-lo, para que o receptor não receba um resultado mais amplo do que pediu.

### 5.5.1 Declaração de capacidades: `GET {fhir_base_url}/metadata`

Devolve um `CapabilityStatement` com as interações e os parâmetros suportados e os perfis em `rest.resource.supportedProfile`. Exige mTLS e não exige token.

### 5.5.2 Catálogo (`catalog.read`, token de provedor)

| Interação | Requisição |
| --- | --- |
| Buscar exames | `GET /ActivityDefinition?status=active` |
| Ler exame | `GET /ActivityDefinition/{id}` |
| Buscar preços | `GET /ChargeItemDefinition?status=active` |
| Ler preço | `GET /ChargeItemDefinition/{id}` |

Parâmetros de busca:

| Recurso | Parâmetro | Tipo | Suporte |
| --- | --- | --- | --- |
| ActivityDefinition | `status` | token | DEVE |
| ActivityDefinition | `url` | uri | DEVE |
| ActivityDefinition | `title` | string | DEVERIA |
| ActivityDefinition | `_lastUpdated` | date | DEVE |
| ChargeItemDefinition | `status` | token | DEVE |
| ChargeItemDefinition | `url` | uri | DEVE |
| ChargeItemDefinition | `jurisdiction` | token | DEVE |
| ChargeItemDefinition | `effective` | date | DEVERIA |
| ChargeItemDefinition | `_lastUpdated` | date | DEVE |

O uso esperado é de sincronização. O receptor baixa o catálogo inteiro uma vez, paginando, e depois pede só o que mudou com `_lastUpdated=gt{instante}`. O preço se liga ao exame pelo código: o `code` do ChargeItemDefinition é o mesmo do ActivityDefinition correspondente, conforme os perfis.

O FHIR R4 não define parâmetro de busca para `ChargeItemDefinition.code` nem para contexto de uso com valor de referência, que é onde o perfil registra a unidade em que o preço vale [FHIR-CHARGEITEMDEF]. Por isso a versão 1 não oferece busca de preço por exame ou por unidade: o receptor filtra localmente depois de sincronizar. A busca por município usa `jurisdiction`.

O perfil `br-lab-charge-item-definition` prevê três alcances para um preço, todos em elementos do próprio recurso: uma unidade ou região em `useContext` (contexto `venue`, com referência a um `Location`), uma marca em `useContext` (contexto `brand` do sistema de códigos `https://fhir-brasil.dev.br/CodeSystem/lab-price-context`, com referência à `Organization` da marca) e um ou mais municípios em `jurisdiction`. O preço por marca e região leva os dois contextos. O receptor que sincroniza o catálogo DEVE ler os três e NÃO DEVE supor que um preço vale para todas as unidades quando ele traz contexto.

Um exame que deixa de ser oferecido passa a `status=retired` e continua legível, para que a sincronização incremental o enxergue. O mesmo vale para preços.

### 5.5.3 Unidades (`locations.read`, token de provedor)

| Interação | Requisição |
| --- | --- |
| Buscar unidades | `GET /Location?status=active` |
| Ler unidade | `GET /Location/{id}` |
| Buscar serviços de uma unidade | `GET /HealthcareService?location=Location/{id}&active=true` |
| Ler serviço | `GET /HealthcareService/{id}` |

| Recurso | Parâmetro | Tipo | Suporte |
| --- | --- | --- | --- |
| Location | `status` | token | DEVE |
| Location | `address-city` | string | DEVE |
| Location | `address-state` | string | DEVE |
| Location | `address-postalcode` | string | DEVERIA |
| Location | `near` | special | PODE |
| Location | `_lastUpdated` | date | DEVE |
| HealthcareService | `location` | reference | DEVE |
| HealthcareService | `active` | token | DEVE |
| HealthcareService | `_lastUpdated` | date | DEVE |

Coordenadas ficam em `Location.position` e horário de funcionamento em `Location.hoursOfOperation`, elementos do recurso base [FHIR-LOCATION].

### 5.5.4 Agenda (`schedule.read`, token de provedor)

| Interação | Requisição |
| --- | --- |
| Buscar agendas de uma unidade | `GET /Schedule?actor=Location/{id}&active=true` |
| Ler agenda | `GET /Schedule/{id}` |
| Buscar horários | `GET /Slot?schedule=Schedule/{id}&status=free&start=ge{data}&start=lt{data}` |
| Ler horário | `GET /Slot/{id}` |

| Recurso | Parâmetro | Tipo | Suporte |
| --- | --- | --- | --- |
| Schedule | `actor` | reference | DEVE |
| Schedule | `active` | token | DEVE |
| Slot | `schedule` | reference | DEVE (obrigatório na requisição) |
| Slot | `start` | date | DEVE (obrigatório na requisição, com limite inferior e superior) |
| Slot | `status` | token | DEVE |
| Slot | `service-type` | token | DEVE |

Regras:

- A busca não leva nenhum dado de paciente, e o provedor NÃO DEVE exigir um.
- Sem `schedule` ou sem os dois limites de `start`, 400 com `INVALID_REQUEST`.
- Janela maior que 31 dias: 400 com `SEARCH_WINDOW_TOO_LARGE`.
- Cesta de exames: um `service-type` por exame, com o código do catálogo no formato `sistema|código`. Como parâmetros repetidos se combinam com "e" [FHIR-SEARCH], o resultado contém apenas horários em que todos os exames podem ser coletados.
- Exame da cesta que a unidade não coleta: 200 com Bundle sem horários e uma entrada `OperationOutcome` (`search.mode` igual a `outcome`) com o código `EXAM_NOT_AVAILABLE_AT_LOCATION` e a lista dos exames não atendidos em `diagnostics`.
- O provedor NÃO DEVERIA devolver horários que já sabe ocupados. Um horário devolvido como `free` pode deixar de estar livre antes do agendamento, e isso é tratado como conflito no fluxo 2.4.
- A agenda cobre atendimento em unidade. Coleta domiciliar está fora da versão 1 ([03-escopos.md](03-escopos.md), seção 3.6).

**Depende do guia de implementação:** o perfil `br-lab-slot` ainda não fixa o sistema de códigos de `Slot.serviceType`. Este texto supõe o mesmo código de `ActivityDefinition.code`.

### 5.5.5 Agendamento (`appointment.write`, token de paciente)

| Interação | Requisição |
| --- | --- |
| Criar agendamento | `POST /Appointment` com `If-None-Exist` |
| Ler agendamento | `GET /Appointment/{id}` |
| Buscar agendamentos do paciente | `GET /Appointment?patient={id}` (aceita também `status`, `date` e `identifier`) |
| Remarcar ou cancelar | `PUT /Appointment/{id}` com `If-Match` |

**Um recurso só.** O agendamento é um único `Appointment`. Os pedidos de exame são recursos `ServiceRequest` dentro dele, em `contained`, um por exame, e `Appointment.basedOn` aponta para cada um com referência local (`#id`). Os pedidos não têm endereço próprio: não existe `GET /ServiceRequest/{id}`, e eles só são lidos e alterados junto com o agendamento.

O FHIR diz que recursos contidos não têm existência independente do recurso que os contém e desaconselha o uso quando o conteúdo pode ser identificado por conta própria [FHIR-REFS]. Aqui o uso é deliberado: neste protocolo o pedido de exame só existe como parte de um agendamento, e a contrapartida é criar tudo em uma chamada, sem transação.

```json
{
  "resourceType": "Appointment",
  "meta": { "profile": ["https://fhir-brasil.dev.br/ig/StructureDefinition/br-lab-appointment"] },
  "contained": [
    {
      "resourceType": "ServiceRequest",
      "id": "exame-1",
      "meta": { "profile": ["https://fhir-brasil.dev.br/ig/StructureDefinition/br-lab-service-request"] },
      "status": "active",
      "intent": "order",
      "code": {
        "coding": [
          { "system": "http://loinc.org", "code": "15074-8", "display": "Glucose [Moles/volume] in Blood" }
        ]
      },
      "subject": { "reference": "Patient/pac-8842", "type": "Patient" }
    }
  ],
  "identifier": [
    { "system": "https://app-paciente.example/agendamentos", "value": "a41c9d7e-0b52-4f3a-9c8d-2e1f0a9b8c7d" }
  ],
  "status": "proposed",
  "start": "2026-11-23T10:00:00-03:00",
  "end": "2026-11-23T10:15:00-03:00",
  "slot": [{ "reference": "Slot/slot-20261123-1000" }],
  "basedOn": [{ "reference": "#exame-1" }],
  "participant": [
    { "actor": { "reference": "Patient/pac-8842", "type": "Patient" }, "status": "accepted" },
    { "actor": { "reference": "Location/unidade-centro", "type": "Location" }, "status": "needs-action" }
  ]
}
```

Enviado com:

```http
POST /fhir/r4/Appointment HTTP/1.1
Host: api.laboratorio.example
Authorization: Bearer SlAV32hkKG
Content-Type: application/fhir+json
Accept: application/fhir+json
Prefer: return=representation
If-None-Exist: identifier=https://app-paciente.example/agendamentos|a41c9d7e-0b52-4f3a-9c8d-2e1f0a9b8c7d
x-fapi-interaction-id: 4b1f6a52-9c3d-4e7f-8a10-2d3c4b5a6f70
```

O exemplo é ilustrativo e os perfis prevalecem sobre ele. O código LOINC e o texto de exibição são os do exemplo de Observation publicado com o FHIR R4 [FHIR-OBS-EX].

Regras da criação:

- O `Appointment` DEVE chegar com `status` igual a `proposed` e DEVE cumprir as três invariantes do perfil `br-lab-appointment`: há ao menos um `ServiceRequest` em `contained` (`br-lab-appointment-contained-request`), cada `basedOn` é uma referência local a um `ServiceRequest` contido (`br-lab-appointment-based-on-contained`), e o `subject` de cada pedido contido repete o paciente do agendamento (`br-lab-appointment-request-subject`). O protocolo acrescenta que todo pedido contido DEVE ter um `basedOn` que aponte para ele.
- **Participantes.** O perfil distingue o paciente e a unidade por `participant.actor.type`, sem resolver a referência. Por isso `actor.type` é obrigatório: `Patient` no participante do paciente e `Location` no da unidade. Sem ele o recurso não valida.
- **Paciente.** O receptor identifica o paciente pela referência `Patient/{fhir_id}`, com o `fhir_id` lido do consentimento. O `subject` de cada pedido contido DEVE trazer a mesma referência literal do participante, caractere a caractere: a invariante compara o texto da referência. O perfil admite também identificar o paciente só pelo CPF, e o provedor DEVE aceitar essa forma se o CPF for o do paciente do consentimento.
- **Pedidos.** Cada `ServiceRequest` contido leva `status` igual a `active`, `intent` igual a `order` e `code` com ao menos um `coding`. O código LOINC é o esperado para um exame avulso e não é obrigatório: um item do catálogo sem LOINC, como um combo, leva o código próprio do laboratório. O receptor DEVE copiar para o pedido os `coding` do `ActivityDefinition` correspondente, sem acrescentar nem retirar, e PODE preencher `instantiatesCanonical` com a URL canônica desse item. Recursos contidos não levam `meta.versionId` nem `meta.lastUpdated` [FHIR-REFS].
- O `Appointment` DEVE trazer exatamente um `identifier` do receptor, cujo `system` pertence ao receptor e cujo `value` é único. O mesmo par vai no cabeçalho `If-None-Exist`, no formato definido abaixo. É a criação condicional do FHIR [FHIR-HTTP]: se não há agendamento com aquele identificador, o provedor cria e responde 201. Se já há um, o provedor não cria outro e responde 200. Assim o receptor pode repetir a chamada depois de uma falha de rede. Sem o cabeçalho, 400 com `IF_NONE_EXIST_REQUIRED`.
- Depois de um 200 na criação condicional, o receptor lê o agendamento existente com `GET /Appointment?identifier={system}|{value}`.
- As referências ao paciente DEVEM apontar para o paciente do consentimento. Caso contrário, 422 com `PATIENT_NOT_IN_CONSENT`.
- O receptor DEVE enviar `Prefer: return=representation`, e o provedor DEVE devolver o recurso gravado no corpo do 201, com `Location` e `ETag`.
- O provedor define o estado resultante: `pending` quando falta pagamento ou confirmação, `booked` quando está confirmado.
- Quando falta pagamento, o `Appointment` devolvido DEVE trazer o link de pagamento na extensão `payment-link` (ver "Link de pagamento").

O FHIR classifica a criação condicional como de uso experimental e observa que nem todo servidor a implementa [FHIR-HTTP]. Aqui ela é obrigatória apenas para `Appointment` e apenas com o parâmetro `identifier`.

**Formato de `If-None-Exist` e do identificador.** O FHIR diz que o cabeçalho contém os parâmetros de busca, isto é, o que viria na URL depois do `?`, e dá como exemplo `If-None-Exist: identifier=http://my-lab-system|123` [FHIR-HTTP]. Na busca por token, a barra vertical separa sistema e valor, os caracteres `$`, `,` e `|` dentro de um valor precisam ser precedidos de `\`, e a codificação por `%` da URL continua valendo por cima disso [FHIR-SEARCH]. Para que nenhuma dessas regras de escape chegue a ser necessária, o protocolo restringe os caracteres:

| Parte | Regra |
| --- | --- |
| `identifier.system` | URL `https` em domínio do receptor, só com letras, dígitos e `-`, `.`, `_`, `~`, `:`, `/`. Sem consulta, sem fragmento, sem `%`. No máximo 200 caracteres. Fixo por receptor |
| `identifier.value` | De 1 a 64 caracteres do conjunto `A-Z`, `a-z`, `0-9`, `-`, `.`, `_`, `~`. São os caracteres não reservados do [RFC3986], seção 2.3, que nunca precisam de codificação. O receptor DEVERIA usar um UUID |
| Cabeçalho | Exatamente `identifier=`, o `system`, uma barra vertical e o `value`. Um único parâmetro, sem espaços, sem `&` |

- O receptor DEVE enviar o cabeçalho na forma literal, com a barra vertical sem codificação, como no exemplo do FHIR.
- O provedor DEVE aceitar a forma literal e DEVE aceitar também a forma em que a barra vertical vem como `%7C` e os dois pontos e as barras do `system` vêm codificados por `%`, tratando as duas como iguais.
- A comparação de `system` e de `value` é exata, sensível a maiúsculas e minúsculas.
- Um `Appointment` cujo identificador do receptor foge dessas regras é recusado com 422 `INVALID_RESOURCE`. Um cabeçalho com outro parâmetro, com mais de um parâmetro ou que não corresponde ao `identifier` do corpo é recusado com 400 `IF_NONE_EXIST_REQUIRED`.

**Link de pagamento.**

- O link trafega em um único lugar: uma extensão no nível raiz do `Appointment`, com `url` igual a `https://fhir-brasil.dev.br/ig/StructureDefinition/payment-link` e o endereço em `valueUrl`. É a extensão `PaymentLink` do guia de implementação, de contexto `Appointment`, que o perfil `br-lab-appointment` admite no máximo uma vez. O protocolo a referencia pela URL canônica e não a redefine.

```json
{
  "resourceType": "Appointment",
  "id": "ag-55120",
  "status": "pending",
  "extension": [
    {
      "url": "https://fhir-brasil.dev.br/ig/StructureDefinition/payment-link",
      "valueUrl": "https://www.laboratorio.example/pagamento/9f2c1b7e"
    }
  ]
}
```

- O exemplo mostra só os elementos que importam aqui. O recurso real traz os demais.
- O provedor NÃO DEVE pôr o link em outro elemento (`comment`, `patientInstruction`, `description`, outra extensão), e o receptor NÃO DEVE procurar link de pagamento fora dessa extensão.
- A extensão aparece nas respostas de `POST`, `GET` e `PUT` enquanto houver pagamento a fazer. O provedor DEVERIA retirá-la quando o agendamento passa a `booked` ou `cancelled`.
- O receptor NÃO DEVE enviar a extensão na criação. Em `PUT`, ele devolve o recurso como leu, com a extensão se ela estava lá, e o provedor ignora o valor recebido: o link é sempre definido pelo provedor.
- É uma URL `https` em domínio do provedor, específica daquele agendamento. O receptor NÃO DEVE abrir um link com outro esquema.
- O receptor DEVE abri-la no navegador do sistema, sem acrescentar parâmetros, e NÃO DEVE carregá-la em WebView nem buscá-la pelo backend.
- O protocolo não transporta valor cobrado, meio de pagamento nem situação do pagamento. O receptor acompanha o resultado pelo `status` do `Appointment`.
- O provedor define por quanto tempo segura o horário à espera do pagamento. Passado esse tempo, o `Appointment` vai a `cancelled`.
- O receptor NÃO DEVERIA consultar o mesmo `Appointment` mais de uma vez a cada 10 segundos enquanto espera o pagamento, nem por mais de 30 minutos seguidos.

**Remarcar.** `PUT /Appointment/{id}` com o recurso completo lido antes, incluindo os `ServiceRequest` contidos sem alteração, mudando apenas `slot`, `start` e `end`, e com `If-Match` igual ao `ETag` da leitura. O provedor PODE devolver o agendamento a `pending` se a remarcação gerar diferença a pagar, com novo link.

**Cancelar.** `PUT /Appointment/{id}` com `status` igual a `cancelled` e `If-Match`. O receptor PODE preencher `cancelationReason`. O provedor DEVERIA passar os `ServiceRequest` contidos a `revoked`.

Regras de alteração:

- O receptor só altera `slot`, `start`, `end`, `status` (apenas para `cancelled`) e `cancelationReason`. Qualquer outra diferença em relação à versão do provedor, inclusive nos pedidos contidos: 422 com `APPOINTMENT_FIELD_NOT_MODIFIABLE`. Para trocar exames, o receptor cancela e cria outro agendamento.
- `PUT` sem `If-Match`: 400 com `IF_MATCH_REQUIRED`. Versão diferente: 412 com `VERSION_CONFLICT`. O FHIR prevê os dois comportamentos [FHIR-HTTP].
- Novo horário ocupado: 409 com `SLOT_UNAVAILABLE`.
- Agendamento em `cancelled`, `fulfilled` ou `noshow`, ou fora da política de alteração do provedor: 422 com `APPOINTMENT_NOT_MODIFIABLE`.
- `DELETE` em `Appointment` não é suportado: 405.

### 5.5.6 Resultados (`results.read`, token de paciente)

| Interação | Requisição |
| --- | --- |
| Buscar laudos | `GET /DiagnosticReport?patient={id}` |
| Ler laudo | `GET /DiagnosticReport/{id}` |
| Buscar resultados | `GET /Observation?patient={id}` |
| Ler resultado | `GET /Observation/{id}` |

| Recurso | Parâmetro | Tipo | Suporte |
| --- | --- | --- | --- |
| DiagnosticReport | `patient` | reference | DEVE (obrigatório na requisição) |
| DiagnosticReport | `_lastUpdated` | date | DEVE |
| DiagnosticReport | `date` | date | DEVE |
| DiagnosticReport | `status` | token | DEVE |
| DiagnosticReport | `code` | token | DEVERIA |
| DiagnosticReport | `_include=DiagnosticReport:result` | | DEVE |
| Observation | `patient` | reference | DEVE (obrigatório na requisição) |
| Observation | `code` | token | DEVE |
| Observation | `date` | date | DEVE |
| Observation | `_lastUpdated` | date | DEVE |

Regras:

- `patient` diferente do paciente do consentimento: 403 com `PATIENT_NOT_IN_CONSENT`. Leitura por id de recurso de outro paciente: 404.
- O provedor devolve laudos nos estados `final`, `amended` e `corrected`. Laudos parciais ou ainda não liberados ao paciente não aparecem.
- Um laudo liberado ao paciente no portal do provedor DEVERIA estar disponível pela API em até 1 hora.
- Laudo retificado mantém o mesmo id, muda de versão e aparece na busca incremental por `_lastUpdated`.
- O provedor PODE incluir o laudo em PDF em `DiagnosticReport.presentedForm`.
- Cada `Observation` leva código LOINC, conforme o perfil `br-lab-observation`.

### 5.5.7 Paciente (qualquer token de paciente)

`GET /Patient/{id}`, somente para o `fhir_id` devolvido na leitura do consentimento. Não há busca de pacientes. Qualquer outro id: 404.

### 5.5.8 Registros de consentimento (`consent.read`, token de paciente)

| Interação | Requisição |
| --- | --- |
| Buscar consentimentos | `GET /Consent?patient={id}` (aceita também `status`) |
| Ler consentimento | `GET /Consent/{id}` |

Devolve, como recursos `Consent` no perfil `br-lab-access-consent`, os consentimentos entre aquele paciente e aquele receptor, em qualquer estado. O `consent_id` do protocolo aparece em `Consent.identifier`. Não há escrita: criar e revogar são feitos pelos endpoints da seção 5.4.

Esta é a visão FHIR do registro, para compor o histórico do paciente. A conferência do titular não depende dela nem do escopo `consent.read`: usa o endpoint do protocolo (seção 5.4.2).

Correspondência informativa entre o consentimento do protocolo e o recurso FHIR. O perfil é a fonte normativa.

| Campo do protocolo | Elemento FHIR R4 |
| --- | --- |
| `consent_id` | `Consent.identifier` |
| `status` | `Consent.status` (tabela da seção 4.1) |
| `scopes` | `Consent.provision.action` |
| `expiration_date_time` | `Consent.provision.period.end` |
| `data_period` | `Consent.provision.dataPeriod` |
| `creation_date_time` | `Consent.dateTime` |
| receptor | `Consent.provision.actor` |
| provedor | `Consent.organization` |
| `patient` | `Consent.patient` |

## 5.6 Resumo: o que é FHIR e o que é do protocolo

| Endpoint | Método | Tipo | Token |
| --- | --- | --- | --- |
| `/.well-known/oauth-authorization-server` do `issuer` | GET | Metadados OAuth (RFC 8414) | Nenhum |
| `{pushed_authorization_request_endpoint}` | POST | OAuth (RFC 9126) | Asserção do cliente |
| `{authorization_endpoint}` | GET | OAuth, no navegador | Nenhum |
| `{token_endpoint}` | POST | OAuth (RFC 6749) | Asserção do cliente |
| `{revocation_endpoint}` | POST | OAuth (RFC 7009), opcional | Asserção do cliente |
| `{jwks_uri}` | GET | JWK Set (RFC 7517) | Nenhum |
| `{api_base_url}/consents` | POST | **Protocolo** | Provedor, `consent.manage` |
| `{api_base_url}/consents/{consent_id}` | GET | **Protocolo** | Provedor, `consent.manage`, ou paciente |
| `{api_base_url}/consents/{consent_id}` | DELETE | **Protocolo** | Provedor, `consent.manage` |
| `{fhir_base_url}/metadata` | GET | FHIR `capabilities` | Nenhum (mTLS) |
| `{fhir_base_url}/ActivityDefinition`, `/ChargeItemDefinition` | GET | FHIR `read`, `search-type` | Provedor, `catalog.read` |
| `{fhir_base_url}/Location`, `/HealthcareService` | GET | FHIR `read`, `search-type` | Provedor, `locations.read` |
| `{fhir_base_url}/Schedule`, `/Slot` | GET | FHIR `read`, `search-type` | Provedor, `schedule.read` |
| `{fhir_base_url}/Appointment` | POST | FHIR `create` condicional | Paciente, `appointment.write` |
| `{fhir_base_url}/Appointment` | GET, PUT | FHIR `read`, `search-type`, `update` | Paciente, `appointment.write` |
| `{fhir_base_url}/DiagnosticReport`, `/Observation` | GET | FHIR `read`, `search-type` | Paciente, `results.read` |
| `{fhir_base_url}/Patient/{id}` | GET | FHIR `read` | Paciente, qualquer escopo |
| `{fhir_base_url}/Consent` | GET | FHIR `read`, `search-type` | Paciente, `consent.read` |

O link de pagamento e a página de gestão de consentimentos do provedor são páginas para o paciente, não endpoints de API.
