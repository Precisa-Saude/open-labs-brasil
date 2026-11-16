# 1. Visão geral e papéis

## 1.1 Objetivo

Hoje, quando um aplicativo quer mostrar ao paciente os exames que ele fez em um laboratório, os caminhos disponíveis são o envio manual de PDFs ou integrações em que o aplicativo pede ao paciente o usuário e a senha do portal do laboratório. O Open Labs Brasil substitui os dois por acesso delegado: o paciente autoriza, na página do próprio laboratório, que um aplicativo específico leia ou agende em seu nome, por um prazo definido e com possibilidade de revogação.

O protocolo cobre cinco capacidades: consultar o catálogo de exames e preços, consultar unidades, consultar horários disponíveis, agendar (com remarcação e cancelamento) e obter resultados estruturados. Cada capacidade corresponde a um escopo descrito em [03-escopos.md](03-escopos.md). As três primeiras não envolvem dados de paciente. O paciente só se conecta ao laboratório para agendar, receber resultados ou ver os próprios registros de consentimento.

## 1.2 Propriedade central

**A senha do paciente no laboratório nunca passa pelo receptor.** O paciente se autentica somente em uma página servida pelo domínio do laboratório, aberta no navegador do sistema ou no aplicativo do próprio laboratório. O receptor recebe apenas um código de autorização e, depois, tokens.

Essa propriedade se traduz em requisitos:

- O receptor NÃO DEVE pedir, receber, transmitir ou armazenar qualquer credencial que o paciente usa no provedor de dados (senha, código de uso único, resposta a pergunta de segurança, cookie de sessão).
- O receptor NÃO DEVE abrir o endpoint de autorização em um componente de navegação embutido que ele controle (WebView). Em aplicativos nativos, a requisição de autorização DEVE usar um agente de usuário externo, como exige o [RFC8252], seção 8.12, que descreve como o aplicativo hospedeiro de um navegador embutido consegue registrar o que o usuário digita.
- O provedor de dados DEVE autenticar o paciente apenas em páginas do seu próprio domínio e NÃO DEVE oferecer nenhuma interface que aceite credenciais do paciente enviadas por um receptor. O servidor de autorização DEVE recusar a concessão `password` do OAuth 2.0, como exige o [FAPI2-SP], seção 5.3.2.1.
- A mesma regra vale para o pagamento: o link de pagamento devolvido no agendamento é aberto no navegador do sistema, e os dados de pagamento ficam entre o paciente e o provedor de dados.

Não existe, em nenhuma versão deste protocolo, um modo de acesso baseado em credenciais do paciente.

## 1.3 Linguagem normativa

Este documento usa as palavras-chave do [RFC2119], com o esclarecimento do [RFC8174], nesta tradução:

| Neste texto | RFC 2119 | Significado |
| --- | --- | --- |
| DEVE | MUST, SHALL, REQUIRED | Requisito absoluto |
| NÃO DEVE | MUST NOT, SHALL NOT | Proibição absoluta |
| DEVERIA | SHOULD, RECOMMENDED | Recomendação: pode ser descumprida por motivo válido e conhecido |
| NÃO DEVERIA | SHOULD NOT | Recomendação negativa |
| PODE | MAY, OPTIONAL | Opcional |

As palavras só têm esse sentido quando escritas em maiúsculas. A mesma correspondência (deve, deveria, pode) é usada pelo padrão de certificados do Open Finance Brasil em português [OFB-CERT].

Identificadores do protocolo (nomes de escopo, caminhos, campos JSON, códigos de erro) ficam em inglês. Em URNs e outros identificadores, o nome do protocolo aparece como `open-labs-brasil`. Datas e horas seguem o [RFC3339], em UTC, com sufixo `Z`.

## 1.4 Papéis

| Papel | Quem é | O que opera |
| --- | --- | --- |
| **Provedor de dados** | O laboratório | Servidor de autorização, tela de login e consentimento, endpoints de consentimento, API FHIR, página de pagamento |
| **Receptor** | Um aplicativo voltado ao paciente | Cliente OAuth confidencial com backend próprio |
| **Paciente** | A pessoa natural titular dos dados | Navegador ou aplicativo, onde se autentica no provedor e aprova o consentimento |
| **Mantenedor do registro** | Hoje, a Precisa Saúde, nas condições de `GOVERNANCE.md` | Registro de participantes assinado |

Regras de elegibilidade:

- Um receptor DEVE ser um aplicativo em que o próprio paciente é o usuário, e todo fluxo com dados do paciente DEVE começar com o consentimento desse paciente e terminar no registro do próprio paciente dentro do aplicativo.
- Operadoras de planos privados de assistência à saúde e outras fontes pagadoras não são receptores elegíveis. Nenhum escopo deste protocolo dá a uma operadora acesso a resultados. O mantenedor do registro NÃO DEVE admitir um receptor desse tipo, e o formato do registro carrega a declaração correspondente ([08-registro-de-participantes.md](08-registro-de-participantes.md)).
- Um provedor de dados PODE cobrar pelo acesso. Preço, contrato e faturamento entre provedor e receptor são assunto comercial e ficam fora do protocolo. O protocolo só enxerga o resultado: o provedor aceita ou recusa emitir tokens para aquele receptor.

Na versão 1 o consentimento é dado pelo próprio titular, maior de idade, com CPF. Consentimento dado por responsável legal está nas questões em aberto de `docs/NOTAS-DE-REVISAO.md`.

## 1.5 O que foi mantido do modelo de agregador

- A experiência de vinculação é a mesma para qualquer provedor de dados: o paciente escolhe o laboratório, é levado à página dele, aprova e volta.
- O acesso é delegado no estilo OAuth desde a primeira versão.
- Não há acesso por credenciais.

## 1.6 Relação com o Open Finance Brasil

O Open Labs Brasil toma do Open Finance Brasil o modelo de consentimento e a jornada, e não o perfil de segurança. Não é uma extensão do Open Finance, não usa a infraestrutura dele e não é compatível com ela em nível de protocolo. As duas listas abaixo foram conferidas nas especificações publicadas pela Associação Open Finance Brasil e na especificação FAPI 2.0 da OpenID Foundation.

**O que é igual**

| Elemento | No Open Finance Brasil | Fonte |
| --- | --- | --- |
| Consentimento como recurso | Criado pela receptora com `POST /consents`, consultado com `GET`, revogado com `DELETE`, com um token `client_credentials`. Nasce em `AWAITING_AUTHORISATION` e só passa a `AUTHORISED` depois de autenticação e confirmação do usuário na transmissora | [OFB-CONSENT] |
| Prazo para autorizar | Sem confirmação em 60 minutos, o consentimento é rejeitado | [OFB-CONSENT], [OFB-CONSENT-ORIENT] |
| Revogação pelos dois lados | O cliente revoga na receptora ou na transmissora | [OFB-CONSENT-ORIENT], [OFB-DC] |
| Jornada por redirecionamento | O usuário sai da receptora, se autentica na transmissora, aprova e volta | [OFB-CONSENT-ORIENT] |
| Ligação entre autorização e consentimento | Escopo dinâmico `consent:<id>` na requisição de autorização | [OFB-FAPI] 7.1 |
| PAR e PKCE | Obrigatórios | [OFB-FAPI] 5.1 |
| Autenticação do cliente | `private_key_jwt` | [OFB-FAPI] 5.1 |
| mTLS e token vinculado ao certificado | Obrigatórios | [OFB-FAPI] 5.1, por [FAPI1-ADV] 5.2.2 |
| Algoritmo de assinatura | PS256 | [OFB-FAPI] 6.2 |
| Token de acesso curto, refresh token sem rotação | 300 a 900 segundos. Rotação proibida | [OFB-FAPI] 5.1 |
| Registro de participantes | Um diretório lista organizações, certificados e servidores de autorização | [OFB-DIR] |
| ICP-Brasil em produção | Certificados ICP-Brasil em produção, certificados do diretório em sandbox | [OFB-DCR] 7.1, [OFB-CERT] |

**O que é diferente**

| Elemento | No Open Finance Brasil | No Open Labs Brasil |
| --- | --- | --- |
| Geração do perfil de segurança | Implementação do FAPI 1.0 Advanced [OFB-FAPI] 1 | FAPI 2.0 Security Profile [FAPI2-SP] |
| Fluxo | Híbrido do OpenID Connect: `response_type` igual a `code id_token`, resposta no fragmento, `id_token` cifrado [OFB-FAPI] 5.1, 5.1.1 | Código de autorização puro: `response_type` igual a `code`. Nenhum `id_token` passa pelo navegador, e não há cifragem |
| Requisição de autorização | Objeto de requisição assinado, enviado por PAR | Parâmetros simples enviados por PAR com cliente autenticado, sem objeto assinado |
| OpenID Connect | Obrigatório, com `userinfo` e `acr` | Não usado |
| Resposta de autorização | `code`, `id_token` e `state` | `code`, `state` e `iss` [RFC9207] |
| Conferência do titular | A transmissora compara o CPF do usuário autenticado com o informado pela receptora na criação do consentimento [OFB-FAPI] 8.1 | A receptora não envia CPF. O provedor devolve o CPF do paciente autenticado por canal de servidor, e o receptor compara ([02-fluxos.md](02-fluxos.md), fluxo 2.2) |
| Estados do consentimento | Três: revogação e vencimento são `REJECTED` com motivo [OFB-CONSENT-ORIENT] | Cinco: `REVOKED` e `EXPIRED` separados de `REJECTED` |
| Validade do consentimento | Admite prazo indeterminado e renovação sem redirecionamento [OFB-CONSENT] | No máximo 12 meses, sem renovação silenciosa |
| Diretório | Serviço central com APIs, que também assina as declarações de software do registro dinâmico de clientes, obrigatório [OFB-DIR], [OFB-DCR] | Arquivo JSON assinado, sem registro dinâmico |
| Conteúdo trafegado | APIs próprias em JSON | Recursos FHIR R4 |

O FAPI 2.0 descreve as mesmas diferenças em relação ao FAPI 1.0 na sua seção 5.5: PAR no lugar do objeto de requisição assinado, apenas `code` na resposta, PKCE no lugar de `s_hash`, e nenhum `id_token` no canal do navegador [FAPI2-SP].

Na prática, um laboratório ou um aplicativo que já implementou o Open Finance Brasil reconhece o modelo e reaproveita a experiência, mas não o servidor de autorização configurado para o perfil brasileiro do FAPI 1.0.

## 1.7 Base legal

Esta seção cita a Lei nº 13.709, de 2018 (LGPD), no texto compilado do Planalto [LGPD]. Ela registra a leitura que orientou o desenho e não substitui parecer jurídico.

Resultados de exames são dado pessoal sensível. O art. 5º, II, inclui na definição o "dado referente à saúde ou à vida sexual, dado genético ou biométrico, quando vinculado a uma pessoa natural".

**Consentimento específico (art. 11).** O caput e o inciso I dizem:

> Art. 11. O tratamento de dados pessoais sensíveis somente poderá ocorrer nas seguintes hipóteses:
>
> I - quando o titular ou seu responsável legal consentir, de forma específica e destacada, para finalidades específicas;

Por isso cada consentimento do Open Labs Brasil lista escopos nominais, traz uma finalidade em texto mostrada ao paciente e é aprovado em uma tela dedicada.

O § 4º do mesmo artigo, na redação dada pela Lei nº 13.853, de 2019, trata do compartilhamento de dados de saúde entre controladores:

> § 4º É vedada a comunicação ou o uso compartilhado entre controladores de dados pessoais sensíveis referentes à saúde com objetivo de obter vantagem econômica, exceto nas hipóteses relativas a prestação de serviços de saúde, de assistência farmacêutica e de assistência à saúde, desde que observado o § 5º deste artigo, incluídos os serviços auxiliares de diagnose e terapia, em benefício dos interesses dos titulares de dados, e para permitir:
>
> I - a portabilidade de dados quando solicitada pelo titular; ou
>
> II - as transações financeiras e administrativas resultantes do uso e da prestação dos serviços de que trata este parágrafo.

E o § 5º:

> § 5º É vedado às operadoras de planos privados de assistência à saúde o tratamento de dados de saúde para a prática de seleção de riscos na contratação de qualquer modalidade, assim como na contratação e exclusão de beneficiários.

A exclusão de operadoras como receptoras (seção 1.4) é uma decisão de desenho mais restritiva que o § 5º, que proíbe um uso específico e não todo tratamento por operadoras.

**Portabilidade e revogação (art. 18).** O caput e os incisos usados aqui:

> Art. 18. O titular dos dados pessoais tem direito a obter do controlador, em relação aos dados do titular por ele tratados, a qualquer momento e mediante requisição:
>
> II - acesso aos dados;
>
> V - portabilidade dos dados a outro fornecedor de serviço ou produto, mediante requisição expressa, de acordo com a regulamentação da autoridade nacional, observados os segredos comercial e industrial;
>
> IX - revogação do consentimento, nos termos do § 5º do art. 8º desta Lei.

O inciso V remete à regulamentação da autoridade nacional. Na página de acompanhamento da Agenda Regulatória da ANPD, com tabela atualizada em 12/11/2026, a ação "Direitos dos titulares" (arts. 9º, 18, 19 e 20) aparece como "Em andamento", sem consulta à sociedade realizada [ANPD-AGENDA]. O efeito disso sobre o modelo de consentimento está em `docs/NOTAS-DE-REVISAO.md`.

**Efeito da revogação (art. 8º, § 5º).**

> § 5º O consentimento pode ser revogado a qualquer momento mediante manifestação expressa do titular, por procedimento gratuito e facilitado, ratificados os tratamentos realizados sob amparo do consentimento anteriormente manifestado enquanto não houver requerimento de eliminação, nos termos do inciso VI do caput do art. 18 desta Lei.

No protocolo, revogar encerra o acesso futuro: tokens são invalidados e nenhuma nova leitura é possível. Os resultados que já estão no registro do paciente dentro do aplicativo receptor continuam lá até que o paciente peça a eliminação ao receptor, o que é uma relação entre os dois e não passa pelo provedor de dados.

**Finalidade determinada (art. 8º, § 4º).**

> § 4º O consentimento deverá referir-se a finalidades determinadas, e as autorizações genéricas para o tratamento de dados pessoais serão nulas.

Daí o campo obrigatório `purpose` na criação do consentimento.

## 1.8 Fora de escopo na versão 1

- Coleta domiciliar. Os escopos de agenda e agendamento tratam de atendimento em unidade ([03-escopos.md](03-escopos.md), seção 3.6).
- Pagamento dentro do protocolo. O agendamento devolve um link, e o paciente paga no provedor.
- Notificações do provedor para o receptor (webhooks). O receptor consulta.
- Renovação de consentimento sem nova jornada de autorização.
- Registro dinâmico de clientes (DCR).
- OpenID Connect: não há `id_token`, `userinfo` nem escopo `openid`.
- Envio de dados do receptor para o provedor além do que o agendamento exige.
- Acesso por profissionais de saúde, por operadoras ou por qualquer terceiro que não seja o aplicativo escolhido pelo paciente.
- Imagens e laudos de diagnóstico por imagem. Os escopos tratam de análises clínicas.

## 1.9 Termos

| Termo | Significado |
| --- | --- |
| Servidor de autorização | Componente do provedor que autentica o paciente e emite tokens |
| Servidor de recursos | Componente do provedor que serve os endpoints de consentimento e a API FHIR |
| Consentimento | O recurso do protocolo descrito em [04-ciclo-de-vida-do-consentimento.md](04-ciclo-de-vida-do-consentimento.md). Não se confunde com o consentimento que o receptor colhe do paciente para tratar os dados dentro do aplicativo |
| Token de provedor | Token de acesso obtido com `client_credentials`, sem paciente |
| Token de paciente | Token de acesso obtido com `authorization_code` ou `refresh_token`, ligado a um consentimento |
| Guia de implementação | O conjunto de perfis FHIR publicado separadamente, referenciado por URL canônica em [03-escopos.md](03-escopos.md) |
