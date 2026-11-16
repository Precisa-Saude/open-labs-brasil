# Fontes

As fontes abaixo foram abertas em **2026-11-15**, salvo as marcadas com **(2026-11-16)**, abertas ou reabertas nessa data, para a revisão que trocou o perfil de segurança (0.2.0) e para os esclarecimentos da 0.2.1. A coluna "Usada para" diz o que foi conferido em cada uma. Os rótulos entre colchetes são os usados no texto da especificação.

Como foram abertas: as páginas do Open Finance Brasil pela API pública de conteúdo do Confluence da Área do Desenvolvedor (`/wiki/rest/api/content/{id}`), que devolve o corpo da página, e o OpenAPI de consentimentos direto do arquivo YAML. RFCs em texto puro no RFC Editor. Especificações da OpenID Foundation, páginas do FHIR R4, licenças e legislação em HTML, convertidas para texto para leitura e busca. Nada foi citado a partir de resumo de buscador.

O que não pôde ser aberto ou conferido está em `docs/NOTAS-DE-REVISAO.md`, seção "Não verificado".

## Open Finance Brasil

Publicador: Associação Open Finance Brasil, no espaço "Área do Desenvolvedor" (`OF`) do Confluence, salvo indicação.

| Rótulo | Título | URL | Versão ou data na fonte | Usada para |
| --- | --- | --- | --- | --- |
| [OFB-FAPI] | [EN] Open Finance Brasil Financial-grade API Security Profile - v2.2.1 | https://openfinancebrasil.atlassian.net/wiki/spaces/OF/pages/1957626009 | v2.2.1. Página na versão 3, editada em 2026-07-29 | Comparação com o Open Finance Brasil (seção 1.6 da especificação) e regras reaproveitadas: seções 1, 5.1, 5.1.1, 5.2, 6, 6.2, 7.1, 8.1 |
| | FAPI-BR v2.2.1 - Open Finance Brasil Financial-grade API Security Profile (índice e registro de mudanças) | https://openfinancebrasil.atlassian.net/wiki/spaces/OF/pages/1957625885 | Editada em 2026-07-07 | Confirmar que a v2.2.1 é a versão listada e ver o que mudou desde a v2.1.0 |
| | FAPI - Financial-grade API Security Profile (página-mãe) | https://openfinancebrasil.atlassian.net/wiki/spaces/OF/pages/1799421990 | Editada em 2026-05-19 | Confirmar qual versão a página-mãe aponta como atual |
| [OFB-DCR] | [EN] Open Finance Brasil Dynamic Client Registration - v2.1.0 | https://openfinancebrasil.atlassian.net/wiki/spaces/OF/pages/1334116474 | v2.1.0. Página na versão 2, editada em 2025-12-02 | Papel do diretório, declaração de software (SSA), mTLS com ICP-Brasil em produção e certificados do diretório em sandbox, `mtls_endpoint_aliases` |
| | DCR - Dynamic Client Registration (página-mãe) | https://openfinancebrasil.atlassian.net/wiki/spaces/OF/pages/240649257 | Editada em 2026-05-19 | Frase "O Dynamic Client Registration é mandatório para os participantes do Open Finance" e versão atual |
| | [EN] Open Finance Brasil Financial-grade API Dynamic Client Registration 1.0 Implementers Draft 3 | https://openfinancebrasil.atlassian.net/wiki/spaces/OF/pages/240649661 | Editada em 2023-12-15 | Aberta no início da pesquisa, lida só até as referências normativas. Não é citada: a v2.1.0 a substitui |
| [OFB-CERT] | [PT] Padrão de Certificados Open Finance Brasil 3.0 | https://openfinancebrasil.atlassian.net/wiki/spaces/OF/pages/2127298593 | v3.0. Editada em 2026-09-15 | Separação entre certificado de servidor, BRCAC e BRSeal, uso de ICP-Brasil, RSA 2048 e SHA-256, palavras-chave normativas em português |
| | v3.0 - Padrão de Certificados (índice) | https://openfinancebrasil.atlassian.net/wiki/spaces/OF/pages/2127298576 | Editada em 2026-09-15 | Confirmar a versão atual |
| [OFB-DIR] | Diretório de participantes | https://openfinancebrasil.atlassian.net/wiki/spaces/OF/pages/941818081 | Editada em 2025-05-03 | Descrição do diretório como plataforma centralizada, ambientes de produção e sandbox |
| | APIs do Diretório de participantes | https://openfinancebrasil.atlassian.net/wiki/spaces/OF/pages/941818334 | Editada em 2025-05-03 | APIs abertas e restritas do diretório |
| | 18. Listando as organizações cadastradas no Diretório via API (2) | https://openfinancebrasil.atlassian.net/wiki/spaces/OF/pages/941820148 | Editada em 2025-05-03 | Forma de consulta ao diretório |
| [OFB-CONSENT] | API Consents - Open Finance Brasil (OpenAPI 3.0), versão 3.3.1 | https://openbanking-brasil.github.io/openapi/swagger-apis/consents/3.3.1.yml | 3.3.1. Contato no arquivo: "Governança do Open Finance Brasil - Especificações" | Endpoints, estados, prazo de 60 minutos, motivos de rejeição, `rejectedBy`, uso de token `client_credentials`, prazo indeterminado, renovação, cabeçalhos `x-fapi-*` |
| | API Consents - Open Finance Brasil (OpenAPI 3.0), versão 3.2.0 | https://openbanking-brasil.github.io/openapi/swagger-apis/consents/3.2.0.yml | 3.2.0 | Versão apontada pela página do portal. Conferida para ver que as regras citadas são as mesmas da 3.3.1 |
| | Informações Gerais - [DC] Consentimento - v3.2.0 | https://openfinancebrasil.atlassian.net/wiki/spaces/OF/pages/714440726 | Editada em 2024-11-27 | Lista de operações da API |
| | Informações Técnicas - [DC] Consentimento - v3.2.0 | https://openfinancebrasil.atlassian.net/wiki/spaces/OF/pages/714440780 | Editada em 2024-11-27 | Localizar o arquivo OpenAPI |
| [OFB-CONSENT-ORIENT] | Orientações - [DC] Consentimento | https://openfinancebrasil.atlassian.net/wiki/spaces/OF/pages/219480491 | Página na versão 30, editada em 2026-01-16 | Máquina de estados em três estados, regras de transição, revogação na receptora ou na transmissora, validade de 60 minutos da intenção, renovação sem redirecionamento |
| [OFB-DC] | Dados Cadastrais e Transacionais - DC | https://openfinancebrasil.atlassian.net/wiki/spaces/OF/pages/17369300 | Página na versão 13, editada em 2024-07-12 | Compartilhamento só com autorização, finalidade determinada e prazo, cancelamento em qualquer das instituições |
| | Repositório `OpenBanking-Brasil/specs-seguranca` (listagem de arquivos) | https://api.github.com/repos/OpenBanking-Brasil/specs-seguranca/contents/ | Sem data na listagem | Só para localizar as especificações. O conteúdo citado vem do portal, que é mais recente |

A versão listada como atual no portal não foi cruzada com um ato do Banco Central que diga qual versão está em vigor por norma. Ver "Não verificado".

## OpenID Foundation

Publicador: OpenID Foundation.

| Rótulo | Título | URL | Data na fonte | Usada para |
| --- | --- | --- | --- | --- |
| [FAPI2-SP] | FAPI 2.0 Security Profile (Final) **(2026-11-16)** | https://openid.net/specs/fapi-security-profile-2_0-final.html | 22 de fevereiro de 2025 | É o perfil de segurança do protocolo. Lidas por inteiro as seções 5 (5.1 a 5.5) e 6.1. Baixada de novo em 2026-11-16 e comparada com a cópia de 2026-11-15: idênticas |
| [FAPI1-ADV] | Financial-grade API Security Profile 1.0 - Part 2: Advanced (Final) | https://openid.net/specs/openid-financial-api-part-2-1_0.html | 12 de março de 2021 | Base do perfil do Open Finance Brasil, para a comparação: seções 5.2.2, 5.2.2.1, 5.2.3, 8.5, 8.6 |
| [FAPI1-BASE] | Financial-grade API Security Profile 1.0 - Part 1: Baseline (Final) | https://openid.net/specs/openid-financial-api-part-1-1_0.html | 12 de março de 2021 | Definição do cabeçalho `x-fapi-interaction-id` (seção 6.2.1) |
| [OIDC] | OpenID Connect Core 1.0 incorporating errata set 2 (Final) | https://openid.net/specs/openid-connect-core-1_0.html | 15 de dezembro de 2023 | Seção 9 (`private_key_jwt`), que o FAPI 2.0 referencia. O protocolo não usa OpenID Connect além disso |
| [OIDD] | OpenID Connect Discovery 1.0 incorporating errata set 2 (Final) | https://openid.net/specs/openid-connect-discovery-1_0.html | 15 de dezembro de 2023 | Caminho `/.well-known/openid-configuration`, que o provedor pode publicar como alternativa. Não é o caminho exigido |
| [FAPI2-MS] | FAPI 2.0 Message Signing (Final) | https://openid.net/specs/fapi-message-signing-2_0.html | 25 de setembro de 2025 | Só título, data e situação. Não é usado na versão 1 |
| [JARM] | JWT Secured Authorization Response Mode for OAuth 2.0 (JARM) incorporating errata set 1 (Final) | https://openid.net/specs/oauth-v2-jarm.html | 17 de agosto de 2025 | Só título, data e situação. Não é usado |

## IETF

Publicador: IETF, pelo RFC Editor. URL de cada um: `https://www.rfc-editor.org/rfc/rfcNNNN.txt`.

| Rótulo | Título | Data | Usada para |
| --- | --- | --- | --- |
| [RFC2119] | Key words for use in RFCs to Indicate Requirement Levels | Março de 1997 | Linguagem normativa |
| [RFC8174] | Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words | Maio de 2017 | Linguagem normativa |
| [RFC3339] | Date and Time on the Internet: Timestamps | Julho de 2002 | Formato de data e hora. Só título e data conferidos |
| [RFC6585] | Additional HTTP Status Codes | Abril de 2012 | Status 429 (seção 4) |
| [RFC6749] | The OAuth 2.0 Authorization Framework | Outubro de 2012 | Concessões, erros (4.1.2.1 e 5.2), validade do código (4.1.2), ausência de refresh token em `client_credentials` (4.4.3), renovação (6) |
| [RFC6750] | The OAuth 2.0 Authorization Framework: Bearer Token Usage | Outubro de 2012 | Erros `invalid_request`, `invalid_token`, `insufficient_scope` e status (seção 3.1) |
| [RFC3986] | Uniform Resource Identifier (URI): Generic Syntax **(2026-11-16)** | Janeiro de 2005 | Seção 2.3: caracteres não reservados, usados para restringir o identificador do agendamento |
| [RFC7009] | OAuth 2.0 Token Revocation | Agosto de 2013 | Endpoint de revogação, resposta 200 para token desconhecido |
| [RFC7515] | JSON Web Signature (JWS) | Maio de 2015 | Apêndice F, conteúdo destacado |
| [RFC7517] | JSON Web Key (JWK) | Maio de 2015 | Formato das chaves, `x5c` |
| [RFC7519] | JSON Web Token (JWT) | Maio de 2015 | Claims `iss`, `aud`, `exp`, `nbf`, `iat`, `jti` |
| [RFC7523] | JSON Web Token (JWT) Profile for OAuth 2.0 Client Authentication and Authorization Grants | Maio de 2015 | Valor de `client_assertion_type` |
| [RFC7636] | Proof Key for Code Exchange by OAuth Public Clients | Setembro de 2015 | S256, tamanho do `code_verifier`, exemplo do apêndice B |
| [RFC7638] | JSON Web Key (JWK) Thumbprint | Setembro de 2015 | `kid` das chaves do registro |
| [RFC8252] | OAuth 2.0 for Native Apps | Outubro de 2017 | Seção 8.12 (agentes de usuário embutidos), seção 7.2 (redirecionamento `https` reivindicado) |
| [RFC8414] | OAuth 2.0 Authorization Server Metadata **(2026-11-16)** | Junho de 2018 | Seção 3: caminho `/.well-known/oauth-authorization-server` e regra de inserção entre host e caminho. Seção 2: definição e valor por omissão de `response_types_supported`, `grant_types_supported`, `token_endpoint_auth_methods_supported`, `token_endpoint_auth_signing_alg_values_supported` e `code_challenge_methods_supported` |
| [RFC8705] | OAuth 2.0 Mutual-TLS Client Authentication and Certificate-Bound Access Tokens | Fevereiro de 2020 | Seções 3, 3.1, 5, 7.1 |
| [RFC8725] | JSON Web Token Best Current Practices (BCP 225) **(2026-11-16)** | Fevereiro de 2020 | Exigido pelo FAPI 2.0. Conferidos título, data e a seção 3.1 sobre verificação de algoritmo |
| [RFC9207] | OAuth 2.0 Authorization Server Issuer Identification **(2026-11-16)** | Março de 2022 | Parâmetro `iss` na resposta de autorização: seções 2, 2.3, 2.4 e 3 |
| [RFC9325] | Recommendations for Secure Use of Transport Layer Security (TLS) and Datagram Transport Layer Security (DTLS) (BCP 195) **(2026-11-16)** | Novembro de 2022 | Seção 4.2: suítes recomendadas para TLS 1.2 |
| [RFC9110] | HTTP Semantics | Junho de 2022 | Só a existência das seções de `Retry-After` (10.2.3) e dos status 4xx (15.5) |
| [RFC9126] | OAuth 2.0 Pushed Authorization Requests | Setembro de 2021 | Seções 2, 2.2, 2.3, 4, 5 |
| [RFC9700] | Best Current Practice for OAuth 2.0 Security | Janeiro de 2025 | Referência geral, só título e data conferidos |

Abertos e não citados com rótulo no texto: RFC 9101 (objeto de requisição assinado, usado na primeira versão do rascunho e retirado), RFC 9449 (DPoP, alternativa não escolhida, só título e data, 2026-11-16), RFC 9525 (identidade de serviço em TLS, citado pelo FAPI 2.0, só título e data, 2026-11-16), RFC 5280 (perfil de certificados X.509), RFC 7591 e RFC 7592 (registro dinâmico de clientes), RFC 7662 (introspecção de token), RFC 8259 (JSON). Foram baixados para consulta. Os três de registro e introspecção aparecem como referências normativas das fontes do Open Finance Brasil.

## HL7 FHIR R4

Publicador: HL7 International. Versão 4.0.1 ("R4 - Mixed Normative and STU"), páginas geradas em 1º de novembro de 2019. URL de cada página: `https://hl7.org/fhir/R4/<página>.html`.

| Rótulo | Página | Usada para |
| --- | --- | --- |
| [FHIR-HTTP] | `http` | Interações REST, `create` e criação condicional com `If-None-Exist` (seção 3.1.0.8.1, de uso experimental, com o exemplo `identifier=http://my-lab-system|123`), links de paginação opacos para o cliente, status 409, 412 e 422, `If-Match`, `ETag`, `Prefer`, tipos MIME |
| [FHIR-REFS] | `references` **(2026-11-16)** | Seção 2.3.0.8, recursos contidos: sem existência independente, desaconselhados quando o conteúdo pode ser identificado, sem `meta.versionId` nem `meta.lastUpdated`, sem aninhamento, regra `ref-1` |
| [FHIR-SEARCH] | `search` | Parâmetros repetidos como "e", `_lastUpdated`, `_count`, `_include`, prefixos de data. Relida em 2026-11-16: sintaxe de token `sistema|código` e seção 3.1.1.4.19, escape de `# Fontes

As fontes abaixo foram abertas em **2026-11-15**, salvo as marcadas com **(2026-11-16)**, abertas ou reabertas nessa data, para a revisão que trocou o perfil de segurança (0.2.0) e para os esclarecimentos da 0.2.1. A coluna "Usada para" diz o que foi conferido em cada uma. Os rótulos entre colchetes são os usados no texto da especificação.

Como foram abertas: as páginas do Open Finance Brasil pela API pública de conteúdo do Confluence da Área do Desenvolvedor (`/wiki/rest/api/content/{id}`), que devolve o corpo da página, e o OpenAPI de consentimentos direto do arquivo YAML. RFCs em texto puro no RFC Editor. Especificações da OpenID Foundation, páginas do FHIR R4, licenças e legislação em HTML, convertidas para texto para leitura e busca. Nada foi citado a partir de resumo de buscador.

O que não pôde ser aberto ou conferido está em `docs/NOTAS-DE-REVISAO.md`, seção "Não verificado".

## Open Finance Brasil

Publicador: Associação Open Finance Brasil, no espaço "Área do Desenvolvedor" (`OF`) do Confluence, salvo indicação.

| Rótulo | Título | URL | Versão ou data na fonte | Usada para |
| --- | --- | --- | --- | --- |
| [OFB-FAPI] | [EN] Open Finance Brasil Financial-grade API Security Profile - v2.2.1 | https://openfinancebrasil.atlassian.net/wiki/spaces/OF/pages/1957626009 | v2.2.1. Página na versão 3, editada em 2026-07-29 | Comparação com o Open Finance Brasil (seção 1.6 da especificação) e regras reaproveitadas: seções 1, 5.1, 5.1.1, 5.2, 6, 6.2, 7.1, 8.1 |
| | FAPI-BR v2.2.1 - Open Finance Brasil Financial-grade API Security Profile (índice e registro de mudanças) | https://openfinancebrasil.atlassian.net/wiki/spaces/OF/pages/1957625885 | Editada em 2026-07-07 | Confirmar que a v2.2.1 é a versão listada e ver o que mudou desde a v2.1.0 |
| | FAPI - Financial-grade API Security Profile (página-mãe) | https://openfinancebrasil.atlassian.net/wiki/spaces/OF/pages/1799421990 | Editada em 2026-05-19 | Confirmar qual versão a página-mãe aponta como atual |
| [OFB-DCR] | [EN] Open Finance Brasil Dynamic Client Registration - v2.1.0 | https://openfinancebrasil.atlassian.net/wiki/spaces/OF/pages/1334116474 | v2.1.0. Página na versão 2, editada em 2025-12-02 | Papel do diretório, declaração de software (SSA), mTLS com ICP-Brasil em produção e certificados do diretório em sandbox, `mtls_endpoint_aliases` |
| | DCR - Dynamic Client Registration (página-mãe) | https://openfinancebrasil.atlassian.net/wiki/spaces/OF/pages/240649257 | Editada em 2026-05-19 | Frase "O Dynamic Client Registration é mandatório para os participantes do Open Finance" e versão atual |
| | [EN] Open Finance Brasil Financial-grade API Dynamic Client Registration 1.0 Implementers Draft 3 | https://openfinancebrasil.atlassian.net/wiki/spaces/OF/pages/240649661 | Editada em 2023-12-15 | Aberta no início da pesquisa, lida só até as referências normativas. Não é citada: a v2.1.0 a substitui |
| [OFB-CERT] | [PT] Padrão de Certificados Open Finance Brasil 3.0 | https://openfinancebrasil.atlassian.net/wiki/spaces/OF/pages/2127298593 | v3.0. Editada em 2026-09-15 | Separação entre certificado de servidor, BRCAC e BRSeal, uso de ICP-Brasil, RSA 2048 e SHA-256, palavras-chave normativas em português |
| | v3.0 - Padrão de Certificados (índice) | https://openfinancebrasil.atlassian.net/wiki/spaces/OF/pages/2127298576 | Editada em 2026-09-15 | Confirmar a versão atual |
| [OFB-DIR] | Diretório de participantes | https://openfinancebrasil.atlassian.net/wiki/spaces/OF/pages/941818081 | Editada em 2025-05-03 | Descrição do diretório como plataforma centralizada, ambientes de produção e sandbox |
| | APIs do Diretório de participantes | https://openfinancebrasil.atlassian.net/wiki/spaces/OF/pages/941818334 | Editada em 2025-05-03 | APIs abertas e restritas do diretório |
| | 18. Listando as organizações cadastradas no Diretório via API (2) | https://openfinancebrasil.atlassian.net/wiki/spaces/OF/pages/941820148 | Editada em 2025-05-03 | Forma de consulta ao diretório |
| [OFB-CONSENT] | API Consents - Open Finance Brasil (OpenAPI 3.0), versão 3.3.1 | https://openbanking-brasil.github.io/openapi/swagger-apis/consents/3.3.1.yml | 3.3.1. Contato no arquivo: "Governança do Open Finance Brasil - Especificações" | Endpoints, estados, prazo de 60 minutos, motivos de rejeição, `rejectedBy`, uso de token `client_credentials`, prazo indeterminado, renovação, cabeçalhos `x-fapi-*` |
| | API Consents - Open Finance Brasil (OpenAPI 3.0), versão 3.2.0 | https://openbanking-brasil.github.io/openapi/swagger-apis/consents/3.2.0.yml | 3.2.0 | Versão apontada pela página do portal. Conferida para ver que as regras citadas são as mesmas da 3.3.1 |
| | Informações Gerais - [DC] Consentimento - v3.2.0 | https://openfinancebrasil.atlassian.net/wiki/spaces/OF/pages/714440726 | Editada em 2024-11-27 | Lista de operações da API |
| | Informações Técnicas - [DC] Consentimento - v3.2.0 | https://openfinancebrasil.atlassian.net/wiki/spaces/OF/pages/714440780 | Editada em 2024-11-27 | Localizar o arquivo OpenAPI |
| [OFB-CONSENT-ORIENT] | Orientações - [DC] Consentimento | https://openfinancebrasil.atlassian.net/wiki/spaces/OF/pages/219480491 | Página na versão 30, editada em 2026-01-16 | Máquina de estados em três estados, regras de transição, revogação na receptora ou na transmissora, validade de 60 minutos da intenção, renovação sem redirecionamento |
| [OFB-DC] | Dados Cadastrais e Transacionais - DC | https://openfinancebrasil.atlassian.net/wiki/spaces/OF/pages/17369300 | Página na versão 13, editada em 2024-07-12 | Compartilhamento só com autorização, finalidade determinada e prazo, cancelamento em qualquer das instituições |
| | Repositório `OpenBanking-Brasil/specs-seguranca` (listagem de arquivos) | https://api.github.com/repos/OpenBanking-Brasil/specs-seguranca/contents/ | Sem data na listagem | Só para localizar as especificações. O conteúdo citado vem do portal, que é mais recente |

A versão listada como atual no portal não foi cruzada com um ato do Banco Central que diga qual versão está em vigor por norma. Ver "Não verificado".

## OpenID Foundation

Publicador: OpenID Foundation.

| Rótulo | Título | URL | Data na fonte | Usada para |
| --- | --- | --- | --- | --- |
| [FAPI2-SP] | FAPI 2.0 Security Profile (Final) **(2026-11-16)** | https://openid.net/specs/fapi-security-profile-2_0-final.html | 22 de fevereiro de 2025 | É o perfil de segurança do protocolo. Lidas por inteiro as seções 5 (5.1 a 5.5) e 6.1. Baixada de novo em 2026-11-16 e comparada com a cópia de 2026-11-15: idênticas |
| [FAPI1-ADV] | Financial-grade API Security Profile 1.0 - Part 2: Advanced (Final) | https://openid.net/specs/openid-financial-api-part-2-1_0.html | 12 de março de 2021 | Base do perfil do Open Finance Brasil, para a comparação: seções 5.2.2, 5.2.2.1, 5.2.3, 8.5, 8.6 |
| [FAPI1-BASE] | Financial-grade API Security Profile 1.0 - Part 1: Baseline (Final) | https://openid.net/specs/openid-financial-api-part-1-1_0.html | 12 de março de 2021 | Definição do cabeçalho `x-fapi-interaction-id` (seção 6.2.1) |
| [OIDC] | OpenID Connect Core 1.0 incorporating errata set 2 (Final) | https://openid.net/specs/openid-connect-core-1_0.html | 15 de dezembro de 2023 | Seção 9 (`private_key_jwt`), que o FAPI 2.0 referencia. O protocolo não usa OpenID Connect além disso |
| [OIDD] | OpenID Connect Discovery 1.0 incorporating errata set 2 (Final) | https://openid.net/specs/openid-connect-discovery-1_0.html | 15 de dezembro de 2023 | Caminho `/.well-known/openid-configuration`, que o provedor pode publicar como alternativa. Não é o caminho exigido |
| [FAPI2-MS] | FAPI 2.0 Message Signing (Final) | https://openid.net/specs/fapi-message-signing-2_0.html | 25 de setembro de 2025 | Só título, data e situação. Não é usado na versão 1 |
| [JARM] | JWT Secured Authorization Response Mode for OAuth 2.0 (JARM) incorporating errata set 1 (Final) | https://openid.net/specs/oauth-v2-jarm.html | 17 de agosto de 2025 | Só título, data e situação. Não é usado |

## IETF

Publicador: IETF, pelo RFC Editor. URL de cada um: `https://www.rfc-editor.org/rfc/rfcNNNN.txt`.

| Rótulo | Título | Data | Usada para |
| --- | --- | --- | --- |
| [RFC2119] | Key words for use in RFCs to Indicate Requirement Levels | Março de 1997 | Linguagem normativa |
| [RFC8174] | Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words | Maio de 2017 | Linguagem normativa |
| [RFC3339] | Date and Time on the Internet: Timestamps | Julho de 2002 | Formato de data e hora. Só título e data conferidos |
| [RFC6585] | Additional HTTP Status Codes | Abril de 2012 | Status 429 (seção 4) |
| [RFC6749] | The OAuth 2.0 Authorization Framework | Outubro de 2012 | Concessões, erros (4.1.2.1 e 5.2), validade do código (4.1.2), ausência de refresh token em `client_credentials` (4.4.3), renovação (6) |
| [RFC6750] | The OAuth 2.0 Authorization Framework: Bearer Token Usage | Outubro de 2012 | Erros `invalid_request`, `invalid_token`, `insufficient_scope` e status (seção 3.1) |
| [RFC3986] | Uniform Resource Identifier (URI): Generic Syntax **(2026-11-16)** | Janeiro de 2005 | Seção 2.3: caracteres não reservados, usados para restringir o identificador do agendamento |
| [RFC7009] | OAuth 2.0 Token Revocation | Agosto de 2013 | Endpoint de revogação, resposta 200 para token desconhecido |
| [RFC7515] | JSON Web Signature (JWS) | Maio de 2015 | Apêndice F, conteúdo destacado |
| [RFC7517] | JSON Web Key (JWK) | Maio de 2015 | Formato das chaves, `x5c` |
| [RFC7519] | JSON Web Token (JWT) | Maio de 2015 | Claims `iss`, `aud`, `exp`, `nbf`, `iat`, `jti` |
| [RFC7523] | JSON Web Token (JWT) Profile for OAuth 2.0 Client Authentication and Authorization Grants | Maio de 2015 | Valor de `client_assertion_type` |
| [RFC7636] | Proof Key for Code Exchange by OAuth Public Clients | Setembro de 2015 | S256, tamanho do `code_verifier`, exemplo do apêndice B |
| [RFC7638] | JSON Web Key (JWK) Thumbprint | Setembro de 2015 | `kid` das chaves do registro |
| [RFC8252] | OAuth 2.0 for Native Apps | Outubro de 2017 | Seção 8.12 (agentes de usuário embutidos), seção 7.2 (redirecionamento `https` reivindicado) |
| [RFC8414] | OAuth 2.0 Authorization Server Metadata **(2026-11-16)** | Junho de 2018 | Seção 3: caminho `/.well-known/oauth-authorization-server` e regra de inserção entre host e caminho. Seção 2: definição e valor por omissão de `response_types_supported`, `grant_types_supported`, `token_endpoint_auth_methods_supported`, `token_endpoint_auth_signing_alg_values_supported` e `code_challenge_methods_supported` |
| [RFC8705] | OAuth 2.0 Mutual-TLS Client Authentication and Certificate-Bound Access Tokens | Fevereiro de 2020 | Seções 3, 3.1, 5, 7.1 |
| [RFC8725] | JSON Web Token Best Current Practices (BCP 225) **(2026-11-16)** | Fevereiro de 2020 | Exigido pelo FAPI 2.0. Conferidos título, data e a seção 3.1 sobre verificação de algoritmo |
| [RFC9207] | OAuth 2.0 Authorization Server Issuer Identification **(2026-11-16)** | Março de 2022 | Parâmetro `iss` na resposta de autorização: seções 2, 2.3, 2.4 e 3 |
| [RFC9325] | Recommendations for Secure Use of Transport Layer Security (TLS) and Datagram Transport Layer Security (DTLS) (BCP 195) **(2026-11-16)** | Novembro de 2022 | Seção 4.2: suítes recomendadas para TLS 1.2 |
| [RFC9110] | HTTP Semantics | Junho de 2022 | Só a existência das seções de `Retry-After` (10.2.3) e dos status 4xx (15.5) |
| [RFC9126] | OAuth 2.0 Pushed Authorization Requests | Setembro de 2021 | Seções 2, 2.2, 2.3, 4, 5 |
| [RFC9700] | Best Current Practice for OAuth 2.0 Security | Janeiro de 2025 | Referência geral, só título e data conferidos |

Abertos e não citados com rótulo no texto: RFC 9101 (objeto de requisição assinado, usado na primeira versão do rascunho e retirado), RFC 9449 (DPoP, alternativa não escolhida, só título e data, 2026-11-16), RFC 9525 (identidade de serviço em TLS, citado pelo FAPI 2.0, só título e data, 2026-11-16), RFC 5280 (perfil de certificados X.509), RFC 7591 e RFC 7592 (registro dinâmico de clientes), RFC 7662 (introspecção de token), RFC 8259 (JSON). Foram baixados para consulta. Os três de registro e introspecção aparecem como referências normativas das fontes do Open Finance Brasil.

## HL7 FHIR R4

Publicador: HL7 International. Versão 4.0.1 ("R4 - Mixed Normative and STU"), páginas geradas em 1º de novembro de 2019. URL de cada página: `https://hl7.org/fhir/R4/<página>.html`.

| Rótulo | Página | Usada para |
| --- | --- | --- |
| [FHIR-HTTP] | `http` | Interações REST, `create` e criação condicional com `If-None-Exist` (seção 3.1.0.8.1, de uso experimental), status 409, 412 e 422, `If-Match`, `ETag`, `Prefer`, tipos MIME |
| [FHIR-REFS] | `references` **(2026-11-16)** | Seção 2.3.0.8, recursos contidos: sem existência independente, desaconselhados quando o conteúdo pode ser identificado, sem `meta.versionId` nem `meta.lastUpdated`, sem aninhamento, regra `ref-1` |
, `,` e `|` com `\` |
| [FHIR-CONSENT] | `consent` | Elementos e os seis códigos de `Consent.status` |
| [FHIR-OO] | `operationoutcome`, `valueset-issue-type` | Estrutura do erro e códigos de `issue.code` |
| [FHIR-CHARGEITEMDEF] | `chargeitemdefinition` | Elementos e lista de parâmetros de busca (sem `code` e sem contexto por referência) |
| [FHIR-LOCATION] | `location` | `position`, `hoursOfOperation`, parâmetros de busca |
| [FHIR-OBS-EX] | Exemplo `observation-example-f001-glucose.json` | Código LOINC `15074-8` e texto de exibição usados no exemplo de agendamento |
| | `appointment` | Estados, `basedOn`, `slot`, `participant`, parâmetros de busca |
| | `slot`, `schedule` | Elementos obrigatórios e parâmetros de busca |
| | `servicerequest` | `status`, `intent`, `subject` |
| | `activitydefinition`, `healthcareservice` | Elementos e parâmetros de busca |
| | `diagnosticreport`, `observation` | Estados e parâmetros de busca |
| | `bundle`, `capabilitystatement` | `search.mode`, `supportedProfile` |
| [FHIR-TERM] | `terminologies-systems` | URI do sistema LOINC, `http://loinc.org` |

Os códigos de estado de cada recurso foram conferidos na tabela de estrutura da página do recurso. As páginas dos conjuntos de valores correspondentes e a página `patient` foram baixadas e não foram lidas.

## Legislação e regulação

| Rótulo | Título | Publicador | URL | Data na fonte | Usada para |
| --- | --- | --- | --- | --- | --- |
| [LGPD] | Lei nº 13.709, de 14 de agosto de 2018 (Lei Geral de Proteção de Dados Pessoais), texto compilado | Presidência da República, Planalto | https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm | Texto compilado, com as redações da Lei nº 13.853, de 2019 | Citações literais dos arts. 5º, 8º, 11 e 18. Art. 40 lido e citado nas notas |
| [ICP-MP] | Medida Provisória nº 2.200-2, de 24 de agosto de 2001 | Presidência da República, Planalto | https://www.planalto.gov.br/ccivil_03/MPV/Antigas_2001/2200-2.htm | 24 de agosto de 2001 | Confirmar que o art. 1º institui a ICP-Brasil. Não é citada no texto da especificação |
| [ANPD-AGENDA] | Agenda Regulatória (acompanhamento da Agenda Regulatória 2025-2026) | ANPD, no portal gov.br. O site se identifica como "Agência Nacional de Proteção de Dados" | https://www.gov.br/anpd/pt-br/assuntos/processo_regulatorio/agenda-regulatoria-1 | "Tabela atualizada em 12/11/2026" | Situação da ação regulatória "Direitos dos titulares" |

## Licenças

| Rótulo | Título | Publicador | URL | Usada para |
| --- | --- | --- | --- | --- |
| [APACHE-2.0] | Apache License, Version 2.0, January 2004 **(2026-11-16)** | The Apache Software Foundation | https://www.apache.org/licenses/LICENSE-2.0.txt | Licença do código. Concessão de patentes (seção 3) e irrevogabilidade. O arquivo `LICENSE` é este texto, baixado em 2026-11-16, sem alteração |
| | Attribution 4.0 International, texto legal em inglês, formato texto **(2026-11-16)** | Creative Commons | https://creativecommons.org/licenses/by/4.0/legalcode.txt | O arquivo `LICENSE-spec` é este texto, sem alteração |
| [CC-BY-4.0] | Atribuição 4.0 Internacional, texto legal em português | Creative Commons | https://creativecommons.org/licenses/by/4.0/legalcode.pt | Licença do texto. Irrevogabilidade, e a cláusula de que direitos de patente e marca não são licenciados |

## Fontes locais, não publicadas

| Fonte | Onde | Usada para |
| --- | --- | --- |
| Perfis FHIR em elaboração (arquivos FSH do guia de implementação) | Árvore de trabalho local do guia, lida sem alteração em 2026-11-15 | Alinhar termos com os perfis: mapeamento de estados em `Consent.status`, escopos em `provision.action`, expiração obrigatória, link de pagamento como extensão do `Appointment`, `code` comum entre exame e preço. Relidos em 2026-11-16 os perfis de agendamento e de pedido de exame, para a decisão de usar recursos contidos |
| Guia de implementação, ramo principal do repositório no remoto, commit `8ffa7b9` (versão 3.1.0 do pacote) **(2026-11-16)** | Repositório do guia, lido com comandos de leitura do Git, sem alteração | Para a 0.2.1: extensão `PaymentLink` (id `payment-link`, contexto `Appointment`, valor `url`), canônica do guia em `sushi-config.yaml` (`https://fhir-brasil.dev.br/ig`), a constante que monta a URL da extensão, perfis de agendamento, pedido, consentimento e preço, conjunto de valores `lab-access-patient-scope-vs`, sistemas de códigos `lab-access-scope` e `lab-price-context`, exemplo de agendamento |
| Instruções de escrita e de verificação de fontes do ecossistema | Arquivo `AGENTS.md` do pacote de instruções compartilhadas | Estilo, integridade de dados, verificação de fontes |
