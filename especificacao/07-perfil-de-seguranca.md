# 7. Perfil de segurança

O perfil de segurança do Open Labs Brasil é o **FAPI 2.0 Security Profile**, especificação final da OpenID Foundation publicada em 22 de fevereiro de 2025 [FAPI2-SP]. A regra de leitura é: tudo o que o FAPI 2.0 exige de servidores de autorização, clientes e servidores de recursos vale aqui. Este capítulo registra as escolhas feitas onde o FAPI 2.0 deixa alternativas, os valores fixados onde ele dá um limite, e os acréscimos próprios do protocolo.

O FAPI 2.0 permite esse tipo de perfil: sua seção 5.1.2 diz que um perfil pode reduzir as escolhas em aberto, e que não pode remover nem contrariar comportamentos obrigatórios. Nada aqui contraria o FAPI 2.0.

Cada linha das tabelas aponta a fonte. Onde a coluna "Origem" diz "escolha deste protocolo", a decisão está registrada em `docs/NOTAS-DE-REVISAO.md`.

## 7.1 Fluxo de autorização

| Item | Regra | Origem |
| --- | --- | --- |
| Concessão para dados de paciente | Código de autorização | [FAPI2-SP] 5.3.3.2; [RFC6749] 4.1 |
| `response_type` | `code`. Qualquer outro valor é recusado | [FAPI2-SP] 5.3.2.2 |
| PAR | Obrigatório, com cliente autenticado. Requisição de autorização sem PAR é recusada | [FAPI2-SP] 5.3.2.2; [RFC9126] |
| Parâmetros no endpoint de autorização | Somente `client_id` e `request_uri` | [FAPI2-SP] 5.3.3.2 |
| PKCE | Obrigatório, método `S256`, desafio novo a cada requisição | [FAPI2-SP] 5.3.2.2, 5.3.3.2; [RFC7636] |
| `redirect_uri` | Obrigatório no PAR. Esquema `https` | [FAPI2-SP] 5.3.2.2 |
| `redirect_uri` registrado | DEVE ser idêntico a um dos `redirect_uris` do receptor no registro | Escolha deste protocolo. O FAPI 2.0 dispensa o pré-registro quando há PAR com cliente autenticado (seção 5.5), e aqui o registro existe de qualquer forma |
| Parâmetro `iss` na resposta | O servidor devolve `iss`, e o cliente confere contra o `issuer` do provedor | [FAPI2-SP] 5.3.2.2, 5.3.3.2; [RFC9207] |
| Conteúdo da resposta de autorização | `code`, `state` e `iss`. Nenhum token e nenhum dado do paciente | [FAPI2-SP] 5.5: só o código na resposta, nenhum `id_token` no canal do navegador |
| `state` | O receptor DEVE enviar e conferir | Escolha deste protocolo. No FAPI 2.0 o `state` não é a proteção contra CSRF (essa função é do PKCE) e pode carregar estado da aplicação ([FAPI2-SP] 5.3.2.2, nota 4). Aqui ele liga o retorno à jornada aberta |
| Redirecionamentos do servidor | NÃO DEVE usar status 307 ao redirecionar requisição com credenciais. DEVERIA usar 303 | [FAPI2-SP] 5.3.2.2 |
| Endpoint de autorização | Sem suporte a CORS | [FAPI2-SP] 5.2.3 |
| Clientes públicos | Não suportados | [FAPI2-SP] 5.3.2.1 |
| Concessão `password` | Recusada | [FAPI2-SP] 5.3.2.1 |
| Concessão `implicit` | Não suportada | Decorre de `response_type` igual a `code` |
| Concessão para dados de provedor | `client_credentials`, sob os mesmos requisitos gerais | [RFC6749] 4.4. [FAPI2-SP] 5.3.2.1, nota 2, admite outras concessões sob os requisitos gerais e avisa que só o fluxo de código e o CIBA passaram por análise formal |
| Objeto de requisição assinado (JAR) | Não usado | [FAPI2-SP] 5.5: o PAR substitui o JAR na proteção de integridade da requisição |
| OpenID Connect | Não usado. Sem escopo `openid`, sem `id_token`, sem `nonce` | O FAPI 2.0 permite OpenID Connect e não o exige. Ver seção 7.7 |

## 7.2 Autenticação do cliente

| Item | Regra | Origem |
| --- | --- | --- |
| Método | `private_key_jwt` | [FAPI2-SP] 5.3.2.1 admite `private_key_jwt` ou mTLS. Escolha entre os dois: seção 7.8 |
| `aud` da asserção | O `issuer` do servidor de autorização, como texto simples, não como lista. O servidor só aceita esse valor | [FAPI2-SP] 5.3.2.1, 5.3.3.1 |
| Algoritmo | PS256 | Seção 7.3 |
| `jti` | Uso único dentro da validade | [OIDC] 9 |
| Validade da asserção | `exp` no máximo 60 segundos depois de `iat` | Escolha deste protocolo |
| Relógio | O servidor DEVE aceitar `iat` e `nbf` até 10 segundos no futuro e DEVE recusar mais de 60 segundos no futuro | [FAPI2-SP] 5.3.2.1 |
| PAR sem autenticação | Recusado | [FAPI2-SP] 5.3.2.2 |

## 7.3 Algoritmos e segredos

| Uso | Regra | Origem |
| --- | --- | --- |
| Assinatura de JWT (asserção do cliente, assinatura do registro) | PS256 | [FAPI2-SP] 5.4.1 admite PS256, ES256 ou EdDSA com Ed25519. Este protocolo fica só com PS256 (seção 7.8) |
| Algoritmo `none` | Nunca usado nem aceito | [FAPI2-SP] 5.4.1 |
| Chaves RSA | 2048 bits ou mais | [FAPI2-SP] 5.4.1 |
| Práticas de JWT | Quem cria ou processa JWT segue o [RFC8725] | [FAPI2-SP] 5.4.1 |
| Códigos, tokens de acesso e refresh tokens | Ao menos 128 bits de entropia | [FAPI2-SP] 5.4.1 |
| Hash do PKCE e do vínculo de certificado | SHA-256 | [RFC7636]; [RFC8705] 3.1 |
| Cifragem (JWE) | Não usada | Não há `id_token` nem objeto de requisição a cifrar |

## 7.4 Tokens e prazos

| Item | Valor | Origem |
| --- | --- | --- |
| Token de acesso | Sempre vinculado ao remetente | [FAPI2-SP] 5.3.2.1: "shall only issue sender-constrained access tokens" |
| Mecanismo de vínculo | mTLS, conforme o [RFC8705] | [FAPI2-SP] 5.3.2.1 admite mTLS ou DPoP. Escolha: seção 7.8 |
| Validade do token de acesso | `expires_in` entre 300 e 900 segundos | Escolha deste protocolo, igual à do Open Finance Brasil [OFB-FAPI] 5.1. O FAPI 2.0 não fixa número e recomenda tokens curtos com refresh token para concessões longas ([FAPI2-SP] 6.1) |
| Formato do token de acesso | Livre. O receptor o trata como texto opaco | Escolha deste protocolo |
| Refresh token | Emitido na concessão `authorization_code`. Não emitido em `client_credentials` | [RFC6749] 4.4.3 |
| Rotação de refresh token | O servidor NÃO DEVE usar, salvo em circunstâncias extraordinárias e dando ao cliente prazo para repetir com o token antigo. O cliente DEVE aceitar um refresh token novo quando vier | [FAPI2-SP] 5.3.2.1 e nota 1; 5.3.3.1 |
| Validade do refresh token | Até o fim do consentimento | Escolha deste protocolo, igual à regra do Open Finance Brasil [OFB-FAPI] 8.1 |
| Código de autorização | Validade máxima de 60 segundos. Recusado no segundo uso | [FAPI2-SP] 5.3.2.2 |
| `request_uri` | `expires_in` menor que 600 segundos | [FAPI2-SP] 5.3.2.2 |
| `request_uri` | `expires_in` de ao menos 120 segundos | Escolha deste protocolo. O FAPI 2.0 avisa que abrir o link pode levar mais de 30 segundos ([FAPI2-SP] 5.3.2.2, nota 2) |
| Uso do `request_uri` | Uso único, contado na autorização e não no carregamento da página | [FAPI2-SP] 5.3.2.2, nota 3, como recomendação. Aqui é obrigatório |
| Consentimento sem aprovação | Rejeitado em 60 minutos | [OFB-CONSENT] |
| Consentimento | No máximo 12 meses, sem renovação silenciosa | Escolha deste protocolo |
| Tolerância de relógio fora de JWT | 60 segundos | Escolha deste protocolo |

Regras do servidor de autorização ligadas ao consentimento:

- emitir e renovar token de paciente somente quando ligado a consentimento `AUTHORISED`;
- dar acesso a recursos somente com token ligado a consentimento `AUTHORISED`, e responder 401 a token inválido;
- invalidar refresh token e tokens de acesso quando o consentimento sai de `AUTHORISED`;
- guardar o histórico de consentimentos para trilha de auditoria.

As quatro regras têm o mesmo conteúdo das regras de ciclo de vida do perfil do Open Finance Brasil [OFB-FAPI] 8.1. O FAPI 2.0 não trata de consentimento como recurso.

## 7.5 TLS e mTLS

| Item | Regra | Origem |
| --- | --- | --- |
| TLS | Todos os endpoints. Versão 1.2 ou superior | [FAPI2-SP] 5.2.1 |
| Recomendações de TLS | As do BCP 195 | [FAPI2-SP] 5.2.1; [RFC9325] |
| Suítes no TLS 1.2, endpoints entre servidores | Somente as recomendadas pelo BCP 195: `TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256`, `TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384`, `TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256`, `TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384` | [FAPI2-SP] 5.2.2; lista em [RFC9325] 4.2 |
| Suítes no TLS 1.2, endpoint de autorização | Qualquer suíte permitida pelo BCP 195 | [FAPI2-SP] 5.2.3, nota 1 |
| Endpoint de autorização | Proteção contra rebaixamento para HTTP, por exemplo HSTS | [FAPI2-SP] 5.2.3 |
| Certificado do servidor | O cliente confere, conforme o RFC 9525 | [FAPI2-SP] 5.2.1 |
| DNSSEC | DEVERIA | [FAPI2-SP] 5.2.1 |
| mTLS | Obrigatório em todos os endpoints entre servidores: PAR, token, revogação, consentimento, API FHIR | Decisão do ticket. O FAPI 2.0 prevê ecossistemas com mTLS em todos os endpoints entre servidores e cita `private_key_jwt` junto com mTLS como exemplo ([FAPI2-SP] 5.2.2.1) |
| `mtls_endpoint_aliases` | O servidor PODE anunciar. O cliente DEVE suportar e usar quando presentes | [FAPI2-SP] 5.2.2.1, 5.3.3.1; [RFC8705] 5 |
| Vínculo do token | O servidor de autorização associa o token de acesso ao hash SHA-256 do certificado apresentado. Em token JWT ou em introspecção, o hash aparece em `cnf` com o membro `x5t#S256` | [RFC8705] 3 e 3.1 |
| Conferência no servidor de recursos | Valida integridade, validade, expiração e revogação do token, e confere que o certificado da conexão é o vinculado. Caso contrário, 401 com `invalid_token` | [FAPI2-SP] 5.3.4; [RFC8705] 3 |
| Token na requisição | Só no cabeçalho `Authorization`. Nunca em parâmetro de consulta | [FAPI2-SP] 5.3.3.1, 5.3.4; [RFC6750] |
| Refresh token | Ligado ao cliente por meio da autenticação `private_key_jwt`, não ao certificado. Cada token de acesso novo fica vinculado ao certificado apresentado na renovação | [RFC6749] 6; [RFC8705] 7.1 |

Consequência prática da última linha: quando o receptor troca de certificado, os tokens de acesso vinculados ao certificado antigo deixam de funcionar (duram no máximo 900 segundos), e a renovação seguinte emite tokens vinculados ao novo. Nenhum consentimento é perdido. O FAPI 2.0 aponta essa mesma vantagem dos refresh tokens ([FAPI2-SP] 6.1).

**Validação do certificado do cliente.** O provedor aceita a conexão mTLS somente quando o certificado apresentado é um dos `transport_certificates` de um receptor `active` no registro, está dentro da validade e, havendo asserção ou token na chamada, pertence ao mesmo `client_id`. No piloto a conferência é por igualdade do hash SHA-256 do certificado. A confiança vem do registro, e a cadeia de emissão do certificado não é avaliada. O FAPI 2.0 recomenda que ecossistemas com mTLS publiquem a lista de autoridades certificadoras confiáveis ([FAPI2-SP] 5.2.2.1). No piloto, a lista de certificados do registro cumpre esse papel.

**Certificado do servidor.** No piloto, certificado TLS de autoridade certificadora publicamente confiável.

## 7.6 Metadados e chaves

| Item | Regra | Origem |
| --- | --- | --- |
| Metadados do servidor de autorização | Publicados em documento de metadados. O cliente só usa endpoints vindos desse documento | [FAPI2-SP] 5.3.2.1, 5.3.3.1 |
| Caminho do documento | `/.well-known/oauth-authorization-server`, inserido entre o host e o caminho do `issuer` | [RFC8414] 3. Escolha deste protocolo entre os dois documentos que o FAPI 2.0 cita |
| Origem do `issuer` | O registro de participantes assinado. O cliente confere que o `issuer` do documento é o mesmo | [FAPI2-SP] 5.3.3.1: o `issuer` vem de fonte autoritativa por canal seguro, e o valor obtido deve coincidir |
| Suporte a `iss` | `authorization_response_iss_parameter_supported` igual a `true` | [RFC9207] 2.3 e 3 |
| Chaves do servidor | Em `jwks_uri`, servido só por TLS. O servidor NÃO DEVERIA publicar duas chaves com o mesmo `kid` | [FAPI2-SP] 5.4.2 |
| Chaves do cliente | Em `jwks_uri` do receptor, indicado no registro | [FAPI2-SP] 5.4.2 recomenda `jwks_uri` para clientes |

| Chave | Quem tem | Onde é publicada | Uso |
| --- | --- | --- | --- |
| Assinatura do receptor (`use: sig`, PS256) | Receptor | `jwks_uri` do receptor no registro | Asserção do cliente |
| Certificado de transporte do receptor | Receptor | `transport_certificates` no registro | mTLS e vínculo do token |
| Assinatura do registro | Mantenedor do registro | `registry_keys` no próprio registro | Assinatura do arquivo de participantes |

Um servidor de autorização que emite tokens de acesso em JWT publica a chave de assinatura no próprio `jwks_uri`. O receptor não precisa dela, porque trata o token como opaco.

Regras:

- A chave de assinatura e a chave do certificado de transporte DEVEM ser distintas.
- O servidor de autorização DEVE usar a chave do receptor indicada pelo `kid` e DEVE buscar o conjunto de novo, no máximo uma vez por minuto, quando o `kid` não estiver em cache.
- Rotação da chave de assinatura: o receptor publica a chave nova ao lado da antiga, passa a usar a nova e remove a antiga depois de 24 horas.
- Chaves privadas do receptor ficam no backend. NÃO DEVEM existir no aplicativo móvel nem no código da página.

## 7.7 Conferência do titular e onde o CPF trafega

O protocolo precisa garantir que os dados de quem se autenticou no laboratório vão para o registro da mesma pessoa no aplicativo. O mecanismo está em [02-fluxos.md](02-fluxos.md), fluxo 2.2, e em [04-ciclo-de-vida-do-consentimento.md](04-ciclo-de-vida-do-consentimento.md), seção 4.4. Esta seção justifica o canal escolhido.

| Canal possível | Decisão | Motivo |
| --- | --- | --- |
| Redirecionamento de autorização | Proibido | Passa pelo navegador e pelo histórico. O FAPI 2.0 reduz a resposta de autorização ao código ([FAPI2-SP] 5.5) |
| Resposta do endpoint de token | Não usado | O FAPI 2.0 diz que, quando se quer entregar ao cliente o identificador do usuário autenticado na resposta do token, o servidor de autorização deve suportar OpenID Connect ([FAPI2-SP] 5.3.2.3). Pôr o CPF em um membro próprio da resposta contornaria essa cláusula, e adotar OpenID Connect obrigaria todo laboratório a emitir `id_token` por causa de um único dado |
| Leitura do consentimento com token de provedor | Proibido | O token de provedor não prova que o paciente aprovou. O CPF só deve sair depois da aprovação, para quem recebeu a concessão |
| **Leitura do consentimento com token de paciente** | **Adotado** | É um recurso protegido como qualquer outro: exige token vinculado ao certificado, emitido a partir da aprovação do paciente. O servidor de autorização continua sendo OAuth puro. Não depende de quais escopos o consentimento tem nem do conteúdo de um perfil FHIR |

Pelo mesmo motivo, o id lógico do recurso Patient (`patient.fhir_id`) também vem nessa leitura e não na resposta do token.

Requisitos de segurança ligados à conferência:

- O provedor DEVE devolver o CPF que consta do próprio cadastro para o paciente autenticado, e não um valor informado pelo paciente durante a jornada.
- O receptor DEVE fazer a comparação no backend. O CPF recebido NÃO DEVE ser enviado ao aplicativo antes da comparação.
- Provedor e receptor NÃO DEVEM gravar o CPF em registros de log.
- A qualidade da conferência depende de o receptor saber quem é o seu usuário. Como o receptor obtém e valida o CPF do paciente no próprio cadastro fica fora do protocolo.

**Nível de autenticação.** O provedor autentica o paciente com os mecanismos que já usa no próprio portal e DEVE aplicar nível ao menos igual ao que exige para o paciente ver resultados lá. A versão 1 não informa ao receptor como o paciente se autenticou: isso exigiria OpenID Connect (`acr`).

## 7.8 Escolhas onde o FAPI 2.0 oferece alternativas

| Alternativas no FAPI 2.0 | Escolha | Motivo |
| --- | --- | --- |
| Vínculo do token por mTLS ou por DPoP ([FAPI2-SP] 5.3.2.1) | mTLS | O protocolo já exige mTLS entre servidores, então o vínculo por certificado não acrescenta infraestrutura. O FAPI 2.0 aponta como vantagem do DPoP a implantação mais fácil quando não há integração com a camada TLS (seção 5.5), o que não é o caso aqui. Custo conhecido: o provedor precisa fazer o certificado do cliente chegar até a aplicação que valida o token |
| Autenticação por `private_key_jwt` ou por mTLS ([FAPI2-SP] 5.3.2.1) | `private_key_jwt` | Separa a identidade do cliente (chave em `jwks_uri`, que o receptor gira sozinho) do certificado de transporte (no registro). É a combinação que o próprio FAPI 2.0 dá como exemplo para ecossistemas com mTLS (seção 5.2.2.1) e a mesma do Open Finance Brasil |
| PS256, ES256 ou EdDSA ([FAPI2-SP] 5.4.1) | Só PS256 | Um algoritmo só simplifica a interoperabilidade. O Open Finance Brasil ficou com PS256 porque a ICP-Brasil emite apenas certificados RSA [OFB-FAPI] 6, e a produção deste protocolo prevê ICP-Brasil |
| Metadados pelo OpenID Connect Discovery ou pelo RFC 8414 | RFC 8414 | Não há OpenID Connect. O provedor PODE publicar também `/.well-known/openid-configuration` |
| Com ou sem OpenID Connect | Sem | Seção 7.7 |
| `scope` ou RFC 9396 para autorização detalhada ([FAPI2-SP] 5.3.2.2, nota 5) | `scope` com `consent:{id}` | Mais simples, e é a forma do Open Finance Brasil |

O FAPI 2.0 Message Signing [FAPI2-MS], que acrescenta assinatura de requisições e respostas, não é usado na versão 1.

## 7.9 Acréscimos deste protocolo ao FAPI 2.0

Estes requisitos não vêm do FAPI 2.0. Todos restringem, e nenhum afrouxa.

| Acréscimo | Origem |
| --- | --- |
| Cabeçalho `x-fapi-interaction-id` obrigatório nos endpoints de consentimento e na API FHIR | O cabeçalho é definido no FAPI 1.0 Baseline [FAPI1-BASE] 6.2.1, e o Open Finance Brasil o exige [OFB-FAPI] 5.1. O FAPI 2.0 moveu os cabeçalhos `x-fapi-*` para um documento de orientação à parte ([FAPI2-SP] 5.5), que não foi consultado |
| Consentimento como recurso, ligado ao token pelo escopo `consent:{id}` | Modelo do Open Finance Brasil |
| `redirect_uris` registrados | Registro de participantes |
| Limites de validade do token de acesso e do `request_uri` | Seção 7.4 |
| `state` obrigatório | Seção 7.1 |
| mTLS em todos os endpoints entre servidores | Decisão do ticket |
| Conferência do titular pelo receptor | Seção 7.7 |

## 7.10 Piloto e produção

| Aspecto | Piloto | Produção |
| --- | --- | --- |
| Certificado de transporte do receptor | Certificado de cliente TLS comum, inclusive autoassinado, conferido por hash contra o registro | Certificado ICP-Brasil, validado por cadeia, validade e revogação, com atributos que identifiquem o participante |
| Certificado do servidor | Autoridade certificadora publicamente confiável | A definir junto com o perfil de certificados de produção |
| Chaves de assinatura | Par RSA gerado pelo participante, publicado em `jwks_uri` | Chave ligada a certificado ICP-Brasil de assinatura |
| Registro de participantes | Arquivo JSON assinado, no repositório da especificação. É a única raiz de confiança | Serviço de diretório, com processo de admissão formal |
| Registro de clientes | Estático, a partir do registro de participantes | A decidir: manter estático ou adotar registro dinâmico |
| Conformidade | Autodeclaração contra a lista de [09-versionamento-e-conformidade.md](09-versionamento-e-conformidade.md) | Suíte de conformidade executada antes da admissão |
| Dados | Pacientes reais somente com consentimento real. Não há modo de teste com dados reais | Igual |

No Open Finance Brasil, os certificados de produção são ICP-Brasil e os de sandbox são emitidos pelo diretório [OFB-DCR] 7.1. O padrão de certificados separa o certificado de servidor, o certificado de aplicação cliente (usado em mTLS) e o certificado de assinatura, e fixa RSA de 2048 bits com SHA-256 para os dois últimos [OFB-CERT]. A linha "Produção" acima segue essa separação. O perfil exato de certificado ICP-Brasil para o Open Labs Brasil não foi definido e está nas questões em aberto.

**Limitação conhecida do piloto.** Toda a confiança parte da chave que assina o registro. Se ela for comprometida, não há como revogá-la por dentro do próprio registro ([08-registro-de-participantes.md](08-registro-de-participantes.md), seção 8.5). Isso foi aceito para um piloto com poucos participantes e precisa ser resolvido antes da produção.

## 7.11 Orientações de implementação

- **Use bibliotecas estabelecidas.** O FAPI 2.0 recomenda construir sobre implementações existentes de OAuth 2.0 em vez de escrever do zero ([FAPI2-SP] 5.1.1). Na mesma linha, quem implementa qualquer um dos lados DEVERIA usar uma biblioteca JOSE estabelecida e mantida para criar e validar JWT, JWK e JWS (asserção do cliente, verificação da assinatura do registro, cálculo de thumbprint), e NÃO DEVERIA escrever código próprio de serialização, assinatura ou verificação. A biblioteca cliente de referência do receptor seguirá essa regra. Erros nessa camada costumam ser silenciosos: aceitar `alg` trocado, pular a conferência de `aud` ou comparar assinaturas em tempo variável.
- **Fixe o algoritmo.** Ao verificar um JWT, informe à biblioteca o algoritmo esperado (PS256) em vez de confiar no cabeçalho, como orienta o [RFC8725].
- **Servidor de autorização.** O laboratório DEVERIA usar um produto ou serviço de servidor de autorização que já implemente PAR, PKCE, `private_key_jwt` e tokens vinculados a certificado, e configurá-lo conforme este capítulo.
- **Redirecionamento em aplicativos nativos.** O `redirect_uri` é `https`, então o retorno ao aplicativo usa links `https` reivindicados pelo aplicativo no sistema operacional, como descreve o [RFC8252], seção 7.2. O receptor DEVE abrir a autorização em agente de usuário externo [RFC8252], seção 8.12.
- **Início da jornada.** O receptor DEVE iniciar a autorização somente por ação do paciente e proteger esse início contra requisições forjadas entre sites ([FAPI2-SP] 5.3.3.1). O `code_verifier` fica ligado à sessão do paciente em que a jornada começou ([FAPI2-SP] 5.3.3.2).
- **Redirecionadores abertos.** Nem o servidor de autorização nem o receptor expõem redirecionadores abertos ([FAPI2-SP] 5.3.2.1, 5.3.3.1).
- **Armazenamento de tokens.** Refresh tokens ficam cifrados em repouso no backend do receptor e NÃO DEVEM ser enviados ao aplicativo.
- **Relógio.** Servidores sincronizam o relógio. Um receptor com relógio pouco confiável PODE usar o cabeçalho `Date` das respostas do servidor para ajustar a emissão de asserções ([FAPI2-SP] 5.3.3.1, nota 1).
- **Registros de auditoria.** Provedor e receptor registram cada chamada com `x-fapi-interaction-id`, `client_id`, `consent_id` quando houver, recurso e resultado. Os registros NÃO DEVEM conter tokens, CPF nem conteúdo de resultados.
- **Limitação de chamadas.** O provedor PODE aplicar limites por receptor e por consentimento, respondendo 429.
- **Incidentes.** Chave privada ou refresh token comprometido: o participante avisa o contato de segurança da outra parte e o mantenedor do registro, que retira a chave ou o certificado do registro na publicação seguinte. O procedimento está em `GOVERNANCE.md`.
- **Leitura recomendada.** O [RFC9700] reúne as práticas de segurança atuais para OAuth 2.0, e o FAPI 2.0 declara segui-las ([FAPI2-SP] 5.1.1).
