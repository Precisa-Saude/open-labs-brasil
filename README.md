# Open Labs Brasil

Protocolo aberto para que um aplicativo escolhido pelo paciente acesse, com o consentimento dele, os serviços e os dados que esse paciente tem em um laboratório de análises clínicas: catálogo de exames e preços, unidades, horários, agendamento e resultados.

A regra que organiza todo o desenho: **a senha do paciente no laboratório nunca passa pelo aplicativo.** O paciente se autentica somente na página do próprio laboratório, aprova ali o que o aplicativo pode fazer, e pode revogar dos dois lados.

## Situação

**Rascunho, em fase de piloto.** Versão 0.2.1 da especificação, de 2026-11-16. O histórico está em [CHANGELOG.md](CHANGELOG.md).

- Nada foi implementado nem testado contra um laboratório real.
- Enquanto a versão começar com 0, qualquer mudança pode quebrar a anterior.
- Os perfis FHIR referenciados ficam em outro repositório, o do guia de implementação, e ainda podem mudar.
- Este repositório é privado durante o piloto. A abertura é condição para a versão 1.0.0.

## Em uma página

| Aspecto | Escolha |
| --- | --- |
| Modelo de consentimento | O do Open Finance Brasil: consentimento como recurso, criado pelo aplicativo, autorizado pelo paciente no laboratório, com escopos, validade de até 12 meses e revogação pelos dois lados |
| Perfil de segurança | FAPI 2.0 Security Profile: código de autorização com PAR e PKCE, cliente autenticado por `private_key_jwt`, tokens vinculados a certificado por mTLS |
| Dados | Recursos FHIR R4, com perfis publicados em guia de implementação separado |
| Quem participa | Laboratórios (provedores de dados) e aplicativos voltados ao paciente (receptores). Operadoras de planos de saúde e outras fontes pagadoras não são receptores elegíveis |
| Registro de participantes | No piloto, um arquivo JSON assinado neste repositório |
| Sem consentimento do paciente | Catálogo, unidades e agenda (`catalog.read`, `locations.read`, `schedule.read`) |
| Com consentimento do paciente | Agendamento, resultados e registros de consentimento (`appointment.write`, `results.read`, `consent.read`) |
| Fora da versão 1 | Coleta domiciliar, pagamento dentro do protocolo, notificações, exames de imagem |

## Como o repositório está organizado

```
README.md               este arquivo
GOVERNANCE.md           quem decide mudanças hoje e como isso se transfere
CHANGELOG.md            o que mudou em cada versão da especificação
LICENSE                 Apache License 2.0 (código)
LICENSE-spec            Creative Commons Atribuição 4.0 Internacional (texto)
especificacao/          a especificação
  00-indice.md          por onde começar
  01 a 09               capítulos
  registro/             schema e exemplo do registro de participantes
docs/
  FONTES.md             todas as fontes consultadas, com URL e data de acesso
  NOTAS-DE-REVISAO.md   decisões tomadas, pendências e itens não verificados
```

Comece por [especificacao/00-indice.md](especificacao/00-indice.md). Quem vai avaliar o custo de implementar em um laboratório encontra ali uma lista do que precisa ser construído.

| Capítulo | Conteúdo |
| --- | --- |
| [01](especificacao/01-visao-geral-e-papeis.md) | Visão geral, papéis, relação com o Open Finance Brasil, base legal |
| [02](especificacao/02-fluxos.md) | Fluxos, com diagramas de sequência |
| [03](especificacao/03-escopos.md) | Escopos |
| [04](especificacao/04-ciclo-de-vida-do-consentimento.md) | Ciclo de vida do consentimento |
| [05](especificacao/05-api.md) | Superfície da API |
| [06](especificacao/06-erros.md) | Erros |
| [07](especificacao/07-perfil-de-seguranca.md) | Perfil de segurança |
| [08](especificacao/08-registro-de-participantes.md) | Registro de participantes |
| [09](especificacao/09-versionamento-e-conformidade.md) | Versionamento e conformidade |

## Governança

O mantenedor atual é a Precisa Saúde. O nome do protocolo e os identificadores não carregam o nome de nenhuma empresa, e [GOVERNANCE.md](GOVERNANCE.md) descreve como o controle de mudanças passa a um comitê de implementadores e, depois, a uma entidade de padronização.

## Licenças

Duas licenças, conforme o tipo de conteúdo:

| Conteúdo | Licença | Arquivo |
| --- | --- | --- |
| **Texto da especificação e documentação**: tudo em `especificacao/*.md`, `docs/`, `README.md`, `GOVERNANCE.md`, incluindo os diagramas | Creative Commons Atribuição 4.0 Internacional (CC BY 4.0) | [LICENSE-spec](LICENSE-spec) |
| **Código e artefatos legíveis por máquina**: `especificacao/registro/` (schema e exemplos) e qualquer ferramenta, biblioteca ou suíte de conformidade que venha a ser acrescentada | Apache License 2.0 | [LICENSE](LICENSE) |

Trechos de código e exemplos JSON embutidos no texto da especificação podem ser usados sob a Apache License 2.0.

Os arquivos de licença trazem o texto oficial em inglês, sem alteração. As contribuições são licenciadas nos mesmos termos ([GOVERNANCE.md](GOVERNANCE.md), seção 11).
