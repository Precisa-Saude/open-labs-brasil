# 8. Registro de participantes

O registro diz quem participa, em que papel, com quais endereços e com quais chaves e certificados. Provedores o usam para decidir se aceitam uma conexão e uma asserção de cliente. Receptores o usam para descobrir provedores e confiar nos endereços deles.

No Open Finance Brasil esse papel é de um diretório central: uma plataforma que registra organizações, certificados e servidores de autorização, oferece APIs de consulta e assina as declarações de software usadas no registro dinâmico de clientes [OFB-DIR], [OFB-DCR]. No piloto do Open Labs Brasil, o diretório é um arquivo JSON assinado, publicado no repositório da especificação. O formato foi desenhado para que a passagem a um serviço de diretório troque o meio de distribuição sem mudar o conteúdo.

## 8.1 Arquivos

| Arquivo | Conteúdo |
| --- | --- |
| `participantes.json` | O registro |
| `participantes.json.jws` | Assinatura destacada do registro |
| `participantes.schema.json` | JSON Schema (rascunho 2020-12) do registro |

Nesta pasta, [registro/participantes.exemplo.json](registro/participantes.exemplo.json) e [registro/participantes.exemplo.json.jws](registro/participantes.exemplo.json.jws) são um exemplo com chave e certificado gerados só para ilustração, e [registro/participantes.schema.json](registro/participantes.schema.json) é o schema. A URL de publicação do registro real ainda não existe: depende de onde o repositório `open-labs-brasil` for publicado.

## 8.2 Formato

Campos do documento:

| Campo | Tipo | Regra |
| --- | --- | --- |
| `schema_version` | texto | Versão do formato, `1.x` |
| `environment` | texto | `pilot` ou `production` |
| `sequence` | inteiro | Cresce em 1 a cada publicação. Nunca se repete nem diminui |
| `issued_at` | data e hora | Instante da assinatura |
| `expires_at` | data e hora | No máximo 30 dias depois de `issued_at` |
| `registry_keys.keys` | lista de JWK | Chaves públicas aceitas para verificar o documento de `sequence` seguinte. De 1 a 4 chaves RSA com `alg` igual a `PS256` |
| `participants` | lista | Os participantes |

Campos comuns de cada participante:

| Campo | Tipo | Regra |
| --- | --- | --- |
| `participant_id` | UUID | Atribuído pelo mantenedor do registro. Nunca muda nem é reaproveitado |
| `role` | texto | `provider` ou `receiver`. Uma organização com os dois papéis tem duas entradas |
| `status` | texto | `active`, `suspended` ou `withdrawn` |
| `legal_name` | texto | Razão social |
| `display_name` | texto | Nome mostrado ao paciente |
| `cnpj` | texto | 14 caracteres, sem pontuação |
| `contacts.technical_email` | texto | Contato de integração |
| `contacts.security_email` | texto | Contato para incidentes |
| `protocol_versions` | lista de texto | Versões `MAJOR.MINOR` do protocolo que o participante implementa |
| `updated_at` | data e hora | Última alteração da entrada |

Bloco `provider`, presente quando `role` é `provider`:

| Campo | Regra |
| --- | --- |
| `issuer` | Identificador do servidor de autorização. O documento de metadados fica em `/.well-known/oauth-authorization-server`, conforme a seção 5.2 |
| `fhir_base_url` | Base da API FHIR R4 |
| `api_base_url` | Base dos endpoints de consentimento, já com a versão maior no caminho |
| `scopes_supported` | Escopos que o provedor implementa |
| `consent_management_uri` | Página em que o paciente vê e revoga consentimentos |
| `logo_uri` | Opcional |

Bloco `receiver`, presente quando `role` é `receiver`:

| Campo | Regra |
| --- | --- |
| `client_id` | Igual ao `participant_id`. Na versão 1 cada receptor tem um único cliente |
| `client_name` | Nome mostrado na tela de consentimento do provedor |
| `redirect_uris` | URLs `https` de retorno. A comparação é exata |
| `jwks_uri` | Endereço das chaves públicas de assinatura do receptor |
| `scopes_allowed` | Escopos que o receptor está admitido a pedir |
| `transport_certificates` | De 1 a 4 certificados de cliente TLS, cada um com `x5t#S256`, `x5c`, `not_before` e `not_after` |
| `policy_uri`, `tos_uri` | Política de privacidade e termos de uso do aplicativo |
| `logo_uri` | Opcional |
| `eligibility` | `patient_facing` igual a `true`, `health_plan_operator` igual a `false`, e `declared_at` com a data da declaração |

O schema recusa um receptor com `health_plan_operator` diferente de `false`. A regra de fundo é do mantenedor do registro, que confere a declaração na admissão (`GOVERNANCE.md`): o campo existe para que a conferência deixe rastro em cada versão do arquivo.

Exemplo resumido de uma entrada de receptor. O arquivo completo está em [registro/participantes.exemplo.json](registro/participantes.exemplo.json).

```json
{
  "participant_id": "c2b8f6a4-71de-4c0b-8f3a-9e5d2a7b6c31",
  "role": "receiver",
  "status": "active",
  "legal_name": "Receptor Exemplo Tecnologia Ltda.",
  "display_name": "App do Paciente Exemplo",
  "cnpj": "99999991000125",
  "contacts": {
    "technical_email": "integracao@app-paciente.example",
    "security_email": "seguranca@app-paciente.example"
  },
  "protocol_versions": ["1.0"],
  "updated_at": "2026-11-12T16:45:00Z",
  "receiver": {
    "client_id": "c2b8f6a4-71de-4c0b-8f3a-9e5d2a7b6c31",
    "client_name": "App do Paciente Exemplo",
    "redirect_uris": ["https://app-paciente.example/conexoes/retorno"],
    "jwks_uri": "https://app-paciente.example/.well-known/jwks.json",
    "scopes_allowed": ["catalog.read", "locations.read", "schedule.read", "consent.manage", "appointment.write", "results.read", "consent.read"],
    "transport_certificates": [
      {
        "x5t#S256": "5dqIfHirlno9crnlNeEkswfSxPsW9-Rm1k8wgbBVcU8",
        "x5c": ["MIID... (abreviado aqui, completo no arquivo de exemplo)"],
        "not_before": "2026-11-01T00:00:00Z",
        "not_after": "2027-11-01T00:00:00Z"
      }
    ],
    "policy_uri": "https://app-paciente.example/privacidade",
    "tos_uri": "https://app-paciente.example/termos",
    "eligibility": { "patient_facing": true, "health_plan_operator": false, "declared_at": "2026-11-01" }
  }
}
```

Os CNPJs do exemplo usam raízes escolhidas para parecer fictícias (`99999990` e `99999991`) e têm dígitos verificadores calculados. Não foi conferido se correspondem a alguma inscrição real.

## 8.3 Assinatura

O registro é assinado com JWS de conteúdo destacado, como descrito no [RFC7515], apêndice F.

1. O conteúdo assinado são os bytes exatos de `participantes.json`, como publicados. Não há canonicalização: quem verifica usa os bytes que baixou.
2. O cabeçalho protegido é `{"alg":"PS256","kid":"<kid>","typ":"JOSE"}`.
3. O mantenedor calcula o JWS em serialização compacta sobre `BASE64URL(cabeçalho) || '.' || BASE64URL(bytes do arquivo)`.
4. O arquivo `participantes.json.jws` contém o JWS compacto com o segundo campo vazio: `BASE64URL(cabeçalho)..BASE64URL(assinatura)`.
5. O `kid` de cada chave do registro é o thumbprint SHA-256 da chave, calculado conforme o [RFC7638].

Verificação por um participante que já aceitou o documento de `sequence` N e recebe um candidato:

1. Baixa `participantes.json` e `participantes.json.jws` por HTTPS.
2. Lê o `kid` do cabeçalho e procura a chave em `registry_keys` do documento N que já tem. Se não achar, recusa.
3. Reconstrói o JWS inserindo `BASE64URL(bytes baixados)` no segundo campo e verifica a assinatura PS256. Se falhar, recusa.
4. Valida o documento contra o schema. Se falhar, recusa.
5. Confere que `sequence` é maior que N, que `issued_at` não está mais de 60 segundos no futuro e que `expires_at` não passou. Se falhar, recusa.
6. Aceita o documento e passa a usar o `registry_keys` dele para o próximo.

Quando `sequence` é igual a N, o participante confere se os bytes são os mesmos que já tem e segue com o documento atual. O primeiro documento é verificado com o conjunto de chaves inicial, entregue a cada participante na admissão por canal separado e conferido pelo thumbprint.

Um participante que recusa um candidato continua usando o documento atual até ele expirar e DEVE avisar o mantenedor.

**Documento expirado.** Passado `expires_at` sem documento novo aceito, o participante DEVE deixar de aceitar novas autorizações e novas concessões `client_credentials` e DEVE avisar o mantenedor. Tokens de acesso já emitidos seguem até expirar. A renovação por refresh token de consentimentos já `AUTHORISED` PODE continuar por até 7 dias, para que uma falha de publicação do registro não interrompa a entrega de resultados a pacientes.

## 8.4 Atualização e cache

- O mantenedor publica um novo documento a cada mudança e, sem mudanças, ao menos a cada 7 dias, para renovar `expires_at`.
- Cada participante DEVE buscar o registro ao menos a cada 60 minutos e NÃO DEVERIA buscar mais de uma vez a cada 5 minutos.
- Uma mudança de `status` para `suspended` ou `withdrawn` vale a partir do momento em que o participante aceita o documento que a contém, ou seja, em até 60 minutos.

Efeito do `status` de um receptor no provedor:

| `status` | Novas autorizações | Tokens e renovações | Consentimentos existentes |
| --- | --- | --- | --- |
| `active` | Aceitas | Aceitos | Mantidos |
| `suspended` | Recusadas (`invalid_client`) | Recusados (`invalid_client`, 403 `RECEIVER_NOT_ALLOWED`) | Mantidos em `AUTHORISED`. Voltam a funcionar se o receptor voltar a `active` |
| `withdrawn` | Recusadas | Recusados | Passam a `REVOKED` com `RECEIVER_WITHDRAWN` |

Um provedor `suspended` ou `withdrawn` deixa de ser oferecido pelos receptores a novos pacientes. Os receptores param de chamá-lo.

## 8.5 Rotação

**Chaves de assinatura do receptor.** Ficam no `jwks_uri` e giram sem alterar o registro ([07-perfil-de-seguranca.md](07-perfil-de-seguranca.md), seção 7.6).

**Certificado de transporte do receptor.**

1. O receptor pede a inclusão do certificado novo, ao menos 15 dias antes de o atual vencer.
2. O mantenedor publica um documento com os dois certificados.
3. Depois de 60 minutos, tempo para todos os provedores buscarem o registro, o receptor passa a usar o novo.
4. O receptor pede a retirada do antigo, e o mantenedor publica.

Em comprometimento, o receptor pede a retirada imediata do certificado, e o mantenedor publica sem esperar a janela de 7 dias.

**Endereços do provedor.** Mudança de `issuer` equivale a um novo servidor de autorização: os consentimentos e tokens do anterior não migram. Mudança de `fhir_base_url` ou `api_base_url` é anunciada com 30 dias de antecedência, e o endereço antigo DEVE continuar respondendo nesse período.

**Chave de assinatura do registro.**

1. O mantenedor gera a chave nova e a inclui em `registry_keys` de um documento ainda assinado pela chave atual.
2. A chave nova fica anunciada por ao menos 30 dias antes de assinar qualquer documento.
3. O mantenedor passa a assinar com a nova e mantém a antiga em `registry_keys` por mais um documento.
4. A antiga sai de `registry_keys`.

Como cada documento carrega as chaves válidas para o seguinte, um participante que acompanha a sequência nunca precisa de canal separado depois da admissão. Um participante que ficou sem atualizar por mais tempo do que a sobreposição recomeça pelo conjunto de chaves inicial, obtido de novo com o mantenedor.

Em comprometimento da chave do registro, não há como revogar por dentro do próprio registro. O mantenedor avisa todos os contatos de segurança por canal separado e redistribui o conjunto inicial de chaves. Esse é o ponto mais frágil do desenho. A limitação foi aceita para o piloto, com o registro assinado como única raiz de confiança, e precisa ser resolvida antes da produção (`docs/NOTAS-DE-REVISAO.md`).

## 8.6 Admissão e alteração

Quem pode entrar, como pede, quem confere e em quanto tempo está em `GOVERNANCE.md`. Tecnicamente, toda mudança do registro é um novo documento com `sequence` maior, e o histórico do repositório guarda todas as versões.
