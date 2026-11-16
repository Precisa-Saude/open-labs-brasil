# Open Labs Brasil: especificação do protocolo

**Situação:** rascunho, fase de piloto. Versão 0.2.1, 2026-11-16. As mudanças de cada versão estão em `CHANGELOG.md`, na raiz. Nada aqui foi implementado ou testado contra um laboratório real.

O Open Labs Brasil define como um aplicativo voltado ao paciente obtém acesso a catálogo, unidades, agenda, agendamento e resultados de um laboratório. Catálogo, unidades e agenda dependem só de um acordo entre o aplicativo e o laboratório. Agendamento e resultados dependem do consentimento do paciente, dado na página do próprio laboratório. O modelo de consentimento vem do Open Finance Brasil, o perfil de segurança é o FAPI 2.0 Security Profile, e os dados trafegam como recursos FHIR R4.

Em identificadores, o nome do protocolo aparece como `open-labs-brasil` (por exemplo `urn:open-labs-brasil:error-code`).

## Como ler

| Arquivo | Conteúdo | Para quem |
| --- | --- | --- |
| [01-visao-geral-e-papeis.md](01-visao-geral-e-papeis.md) | Objetivo, propriedade central, papéis, relação com o Open Finance Brasil, base legal | Todos |
| [02-fluxos.md](02-fluxos.md) | Os oito fluxos, cada um com diagrama de sequência | Engenharia do laboratório e do receptor |
| [03-escopos.md](03-escopos.md) | Escopos, o que cada um libera e com qual tipo de token, e o que fica fora da versão 1 | Engenharia e jurídico |
| [04-ciclo-de-vida-do-consentimento.md](04-ciclo-de-vida-do-consentimento.md) | Estados, transições, prazos, conferência do titular | Engenharia do laboratório |
| [05-api.md](05-api.md) | Endpoints, métodos, parâmetros, corpos de requisição e resposta | Quem escreve o cliente ou o servidor |
| [06-erros.md](06-erros.md) | Códigos de erro, status HTTP, quando repetir a chamada | Quem escreve o cliente ou o servidor |
| [07-perfil-de-seguranca.md](07-perfil-de-seguranca.md) | FAPI 2.0, escolhas, tokens, mTLS, piloto e produção | Segurança |
| [08-registro-de-participantes.md](08-registro-de-participantes.md) | Formato, assinatura e rotação do registro | Segurança e operação |
| [09-versionamento-e-conformidade.md](09-versionamento-e-conformidade.md) | Versionamento e requisitos testáveis com identificadores estáveis | Quem for escrever a suíte de conformidade |
| [registro/participantes.schema.json](registro/participantes.schema.json) | JSON Schema do registro | Ferramentas |
| [registro/participantes.exemplo.json](registro/participantes.exemplo.json) | Exemplo de registro, com assinatura em `participantes.exemplo.json.jws` | Ferramentas |

Fora desta pasta: `GOVERNANCE.md` (quem decide mudanças), `docs/FONTES.md` (todas as fontes abertas, com URL e data de acesso) e `docs/NOTAS-DE-REVISAO.md` (decisões tomadas, pendências e itens não verificados). As referências entre colchetes neste texto, como [FAPI2-SP] ou [RFC9126], estão resolvidas em `docs/FONTES.md`.

## O que um laboratório precisa construir

Esta lista resume o trabalho do lado do provedor de dados. Os detalhes estão nos arquivos indicados.

1. Um servidor de autorização OAuth 2.0 configurado conforme [07-perfil-de-seguranca.md](07-perfil-de-seguranca.md): PAR, PKCE, autenticação de cliente por `private_key_jwt`, tokens vinculados ao certificado do cliente, parâmetro `iss` na resposta, concessões `authorization_code`, `refresh_token` e `client_credentials`. Não é preciso OpenID Connect.
2. Uma tela de autenticação e aprovação de consentimento no domínio do próprio laboratório, ligada ao login que o paciente já usa.
3. Três endpoints de consentimento (criar, consultar, revogar) e a máquina de estados de [04-ciclo-de-vida-do-consentimento.md](04-ciclo-de-vida-do-consentimento.md). A consulta com token de paciente devolve o CPF de quem se autenticou.
4. Uma página em que o paciente vê e revoga os consentimentos ativos.
5. Uma API FHIR R4 de leitura para catálogo, unidades, agenda, resultados e consentimentos, e de escrita para agendamento (um `Appointment` com os pedidos de exame contidos), com os perfis do guia de implementação referenciado em [03-escopos.md](03-escopos.md).
6. Terminação mTLS que valida o certificado do receptor contra o registro de participantes, e a leitura periódica desse registro.
7. Uma página de pagamento própria, aberta pelo link devolvido no agendamento.

## O que um receptor precisa construir

1. Um backend que guarda chaves e tokens. O aplicativo móvel ou a página web nunca falam diretamente com os endpoints protegidos do laboratório.
2. Um par de chaves de assinatura e um certificado de cliente TLS, publicados conforme [08-registro-de-participantes.md](08-registro-de-participantes.md).
3. O cliente dos fluxos de [02-fluxos.md](02-fluxos.md), incluindo a abertura do navegador do sistema para a jornada de autorização, a conferência do CPF do titular depois da autorização e o tratamento dos erros de [06-erros.md](06-erros.md).
4. Uma tela em que o paciente vê e revoga os consentimentos que deu.

Para os dois lados: JWT, JWK e JWS devem ser tratados com uma biblioteca JOSE estabelecida, e não com código próprio ([07-perfil-de-seguranca.md](07-perfil-de-seguranca.md), seção 7.11).
