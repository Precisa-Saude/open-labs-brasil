# 3. Escopos

Um escopo é a unidade de permissão do protocolo. Ele aparece em três lugares: no pedido de token, na lista `scopes` do consentimento e no token emitido. O servidor de recursos confere o escopo em toda chamada.

## 3.1 Escopos de provedor

Não envolvem dados de paciente e não exigem consentimento. São obtidos com `client_credentials` ([02-fluxos.md](02-fluxos.md), fluxos 2.1 e 2.3) e dependem apenas de o provedor aceitar atender o receptor.

| Escopo | O que dá ao receptor | Recursos FHIR | Perfis |
| --- | --- | --- | --- |
| `catalog.read` | Exames que podem ser pedidos e seus preços, por unidade ou região | ActivityDefinition, ChargeItemDefinition | `br-lab-activity-definition`, `br-lab-charge-item-definition` |
| `locations.read` | Unidades, endereços, coordenadas, horários de funcionamento | Location, HealthcareService | `br-lab-location`, `br-lab-healthcare-service` |
| `schedule.read` | Horários disponíveis para uma cesta de exames em uma unidade | Schedule, Slot | `br-lab-schedule`, `br-lab-slot` |
| `consent.manage` | Criar, consultar e revogar consentimentos nos endpoints de consentimento | (nenhum: endpoints do protocolo) | (não se aplica) |

`schedule.read` é escopo de provedor porque horário livre de uma unidade não é dado pessoal. O aplicativo pode mostrar disponibilidade antes de o paciente se conectar ao laboratório. O provedor controla o uso por acordo e por limite de chamadas.

`consent.manage` foi acrescentado aos seis escopos de negócio porque a criação do consentimento acontece antes de existir um token de paciente e precisa de alguma autorização. O Open Finance Brasil resolve o mesmo problema da mesma forma: a criação, a consulta e a revogação do consentimento usam um token `client_credentials` [OFB-CONSENT]. `consent.manage` dá acesso somente aos consentimentos criados pelo próprio receptor e não dá acesso a nenhum dado de saúde nem ao CPF do paciente.

## 3.2 Escopos de paciente

Exigem um consentimento `AUTHORISED` que os liste. São obtidos com `authorization_code` ([02-fluxos.md](02-fluxos.md), fluxo 2.2) e mantidos com `refresh_token`. O paciente só passa pela jornada no laboratório quando o aplicativo precisa de um destes três.

| Escopo | O que dá ao receptor | Recursos FHIR | Perfis |
| --- | --- | --- | --- |
| `appointment.write` | Criar, remarcar e cancelar agendamento do paciente que consentiu | Appointment, com ServiceRequest contido | `br-lab-appointment`, `br-lab-service-request` |
| `results.read` | Resultados estruturados daquele paciente | DiagnosticReport, Observation com LOINC | `br-diagnostic-report`, `br-lab-observation` |
| `consent.read` | Os registros de consentimento do próprio paciente | Consent | `br-lab-access-consent` |

Qualquer token de paciente, com qualquer conjunto de escopos, também permite:

- ler o próprio consentimento em `GET {api_base_url}/consents/{consent_id}`, incluindo o CPF e o id FHIR do paciente autenticado, para a conferência do titular ([02-fluxos.md](02-fluxos.md), fluxo 2.2);
- ler o recurso Patient do paciente do consentimento (`br-patient`).

## 3.3 Regras

1. O token de provedor NÃO DEVE carregar escopos de paciente, e o token de paciente NÃO DEVE carregar escopos de provedor. Um receptor que precisa dos dois tipos mantém dois tokens. Entre os escopos de provedor, o receptor DEVERIA pedir um token por escopo e DEVE pedir `consent.manage` sempre sozinho ([05-api.md](05-api.md), seção 5.3.4).
2. O consentimento lista apenas escopos de paciente. A lista `scopes` da criação DEVE ter ao menos um. No recurso FHIR `Consent`, os escopos ficam em `provision.action`, ligado de forma obrigatória ao conjunto de valores `lab-access-patient-scope-vs` do guia de implementação, que contém exatamente os três escopos de paciente. Os códigos vêm do sistema `https://fhir-brasil.dev.br/CodeSystem/lab-access-scope`.
3. O token de paciente carrega, além dos escopos do consentimento, o escopo dinâmico `consent:{consent_id}`. O formato é o que o Open Finance Brasil usa: a palavra `consent`, dois pontos e o identificador devolvido na criação [OFB-FAPI], seção 7.1. O FAPI 2.0 recomenda outro mecanismo, o RFC 9396, quando o parâmetro `scope` não basta [FAPI2-SP], seção 5.3.2.2, nota 5. A versão 1 fica com o escopo dinâmico por ser mais simples de implementar.
4. Um token de paciente só alcança dados do paciente do consentimento a que está ligado. O servidor de recursos DEVE recusar qualquer tentativa de ler ou gravar dados de outro paciente, mesmo com escopo correto.
5. `appointment.write` permite ler e alterar somente agendamentos criados pelo mesmo receptor por meio do protocolo. Agendamentos que o paciente fez por outros canais do laboratório não são visíveis.
6. `consent.read` devolve somente consentimentos entre aquele paciente e aquele receptor. Consentimentos que o paciente deu a outros aplicativos não são visíveis.
7. `results.read` devolve somente resultados já liberados ao paciente nos canais do próprio provedor. Quando o consentimento tem `data_period`, somente resultados com data clínica dentro do período.
8. Não existe escopo de escrita de resultados, nem escopo que dê acesso a dados de mais de um paciente por token.
9. Nenhum escopo dá a uma operadora ou outra fonte pagadora acesso a resultados: elas não são receptores elegíveis ([01-visao-geral-e-papeis.md](01-visao-geral-e-papeis.md), seção 1.4).

## 3.4 Como cada escopo aparece para o paciente

A tela de consentimento do provedor DEVE descrever cada escopo em linguagem comum. Os textos abaixo são sugestões, e o provedor PODE adaptá-los sem mudar o sentido.

| Escopo | Texto sugerido |
| --- | --- |
| `appointment.write` | Agendar, remarcar e cancelar exames em seu nome |
| `results.read` | Receber os resultados dos seus exames |
| `consent.read` | Ver as autorizações que você deu a este aplicativo |

A tela DEVE informar também que o laboratório vai confirmar ao aplicativo o CPF de quem está autorizando, para que os dados cheguem à pessoa certa.

## 3.5 Perfis FHIR

Os perfis são publicados em um guia de implementação separado. Esta especificação os referencia pela URL canônica e não copia o conteúdo deles:

```
https://fhir-brasil.dev.br/ig/StructureDefinition/<id>
```

| `<id>` | Recurso base (FHIR R4) |
| --- | --- |
| `br-lab-access-consent` | Consent |
| `br-lab-appointment` | Appointment |
| `br-lab-slot` | Slot |
| `br-lab-schedule` | Schedule |
| `br-lab-service-request` | ServiceRequest |
| `br-lab-charge-item-definition` | ChargeItemDefinition |
| `br-lab-activity-definition` | ActivityDefinition |
| `br-lab-location` | Location |
| `br-lab-healthcare-service` | HealthcareService |
| `br-patient` | Patient |
| `br-diagnostic-report` | DiagnosticReport |
| `br-lab-observation` | Observation |

Os nove primeiros perfis foram incorporados ao guia de implementação depois da versão 0.2.0 desta especificação, e a versão 0.2.1 foi conferida contra eles. A 0.2.2 releu os perfis de agendamento, pedido de exame, consentimento e preço. Em dois pontos o protocolo restringe mais do que o perfil, e a restrição está no texto desta especificação, sem mudança no guia: o paciente do agendamento vai só por referência ([05-api.md](05-api.md), seção 5.5.5), e o preço só usa os contextos `venue` e `brand` ([05-api.md](05-api.md), seção 5.5.2). Onde esta especificação ainda depende de uma decisão do guia (por exemplo, em qual sistema de códigos fica o exame em `Slot.serviceType`), o ponto está marcado em [05-api.md](05-api.md) e listado em `docs/NOTAS-DE-REVISAO.md`.

Além dos perfis, o protocolo referencia do guia a extensão `https://fhir-brasil.dev.br/ig/StructureDefinition/payment-link` ([05-api.md](05-api.md), seção 5.5.5).

Todo recurso devolvido pelo provedor DEVE declarar o perfil correspondente em `meta.profile` e DEVE ser válido contra ele.

## 3.6 Fora do alcance dos escopos na versão 1

- **Coleta domiciliar.** `schedule.read` e `appointment.write` tratam de atendimento presencial em uma unidade do laboratório. Não há, na versão 1, como consultar disponibilidade nem agendar coleta no endereço do paciente. Um provedor NÃO DEVE usar os recursos destes escopos para representar coleta domiciliar: isso exigiria endereço do paciente, área de cobertura e janelas de visita, que os fluxos atuais não transportam.
- **Pedido médico.** O agendamento não transporta o documento do pedido médico.
- **Pagamento.** Nenhum escopo expõe valor cobrado, meio de pagamento ou situação do pagamento.
- **Exames de imagem.**
