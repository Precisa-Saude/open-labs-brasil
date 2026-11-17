# Roteiro do piloto para laboratórios

2026-11-17, especificação 0.2.2. Para a equipe de um laboratório que quer experimentar o protocolo em homologação. O resumo do desenho está em [apresentacao-para-laboratorios.md](apresentacao-para-laboratorios.md), e o detalhe das ferramentas, em [servidor-e-suite.md](servidor-e-suite.md).

## Contato

| Assunto | Canal |
| --- | --- |
| Dúvidas, ambiguidades do texto, resultado da suíte | [Issue](https://github.com/Precisa-Saude/open-labs-brasil/issues) neste repositório, que é público |
| O que não cabe em issue pública | open-labs@precisa-saude.com.br |
| Falha de segurança | Em privado, pelos canais do [SECURITY.md](../SECURITY.md) |

## O que existe e o que não existe hoje

| Existe | Não existe ainda |
| --- | --- |
| Especificação 0.2.2, com requisitos numerados | Teste contra um laboratório real |
| Servidor de exemplo com dados sintéticos | Registro de participantes real. O piloto usa um registro de teste, gerado na máquina de quem testa |
| Suíte de conformidade do lado do provedor, com 132 requisitos | Ambiente de teste hospedado |
| Receptor mínimo, que faz a jornada de ponta a ponta contra o servidor de exemplo | Suíte do lado do receptor (requisitos RCP) |
| Perfis FHIR em FSH, no [guia de implementação](https://github.com/Precisa-Saude/fhir-brasil/tree/main/ig) | Perfis publicados nas URLs canônicas ou em registro de pacotes. Por ora, compile o guia como diz o README dele |
| Leitura da LGPD que orientou o desenho ([capítulo 1](../especificacao/01-visao-geral-e-papeis.md), seção 1.7) | Parecer jurídico e modelo de contrato entre laboratório e aplicativo |

O piloto roda só em homologação, com pacientes de teste. Paciente real, só com consentimento real ([capítulo 7](../especificacao/07-perfil-de-seguranca.md), seção 7.10).

## O menor piloto: só resultados

Um provedor declara no registro os escopos que implementa (`scopes_supported`), então o piloto pode começar por `results.read` e `consent.read`, mais `consent.manage`, que todo fluxo com paciente exige. Catálogo, unidades, agenda, agendamento e página de pagamento ficam para depois.

| O laboratório constrói | Onde está |
| --- | --- |
| Servidor de autorização com PAR, PKCE, `private_key_jwt` e tokens vinculados ao certificado, nas concessões `authorization_code`, `refresh_token` e `client_credentials` | [Capítulo 7](../especificacao/07-perfil-de-seguranca.md), [capítulo 5](../especificacao/05-api.md), seções 5.2 e 5.3 |
| Tela de aprovação depois do login que o paciente já usa, e página em que ele vê e revoga | [Capítulo 4](../especificacao/04-ciclo-de-vida-do-consentimento.md), seção 4.4 |
| `POST`, `GET` e `DELETE /consents`, com os cinco estados | Capítulo 4 e capítulo 5, seção 5.4 |
| Leitura FHIR R4 de `DiagnosticReport`, `Observation`, `Patient/{id}` e `Consent`, e o `/metadata` | Capítulo 5, seções 5.5.1 e 5.5.6 a 5.5.8 |
| Terminação mTLS que confere o certificado do aplicativo contra o registro, e a leitura periódica do registro | Capítulo 7, seção 7.5, e [capítulo 8](../especificacao/08-registro-de-participantes.md) |

## Antes de começar

Quatro perguntas decidem o custo. Vale responder antes de escrever código, e a resposta ajuda a especificação mesmo quando é "não".

- [ ] **LOINC.** Todo resultado sai com código LOINC e unidade UCUM? A especificação exige LOINC em toda `Observation` (RES-007).
- [ ] **CPF.** Todo paciente do cadastro tem CPF válido? Quem não tem não consegue autorizar (transição T5).
- [ ] **Certificado do cliente.** A terminação TLS repassa o certificado do cliente até a aplicação que valida o token?
- [ ] **Servidor de autorização.** O produto em uso faz PAR, PKCE, `private_key_jwt` e token vinculado a certificado, ou será preciso outro?

## Passos

1. **Rode tudo na sua máquina.** Com Node 22.18 ou mais novo, pnpm 10 e openssl:

   ```sh
   pnpm install
   pnpm conformidade:local
   pnpm jornada
   ```

   O primeiro comando termina com 128 requisitos aprovados e 4 que pedem conferência humana. O segundo mostra a jornada do paciente passo a passo.

2. **Avise que vai testar**, pelo contato acima, dizendo quais escopos pretende implementar.

3. **Gere o registro de teste** com os endereços da sua homologação:

   ```sh
   node ambiente-local/gerar.ts --forcar --host hml.laboratorio.example \
     --porta-publica 443 --porta-mtls 8444
   ```

   O comando grava em `ambiente-local/gerado/` o registro assinado, as chaves iniciais em que o seu provedor precisa confiar, os clientes de teste com chaves e certificados, e um `suite.config.json`.

4. **Prepare a homologação**: os pacientes de teste (um com CPF, outro com CPF diferente, um sem CPF) e, se puder, a interface de controle de teste. A lista completa está em [servidor-e-suite.md](servidor-e-suite.md), seção "Como um laboratório aponta a suíte para o próprio provedor". Troque em `suite.config.json` os pacientes e os laudos sintéticos pelos seus.

5. **Rode a suíte** contra o seu provedor e guarde o relatório:

   ```sh
   pnpm suite --config ambiente-local/gerado/suite.config.json --relatorio relatorio.json
   ```

   `--somente RES-001,RES-007` roda só os requisitos listados.

6. **Mande o resultado**: o `relatorio.json` e os pontos em que o texto deixou dúvida. Cada ambiguidade encontrada vira um item de [pontos-da-especificacao.md](pontos-da-especificacao.md).

## Limites conhecidos das ferramentas

- **Um host, caminhos fixos.** O gerador descreve um provedor com um host, duas portas e os caminhos do servidor de exemplo (`/fhir/r4`, `/acesso/v0`, `/minha-conta/compartilhamentos`), e declara os sete escopos. Para outros endereços, ou para declarar só parte dos escopos, altere a entrada do provedor em `ambiente-local/gerar.ts` antes de gerar.
- **A suíte supõe os sete escopos.** Ela executa os 132 requisitos sem olhar `scopes_supported`. Num provedor só de resultados, os grupos CAT, UNI, AGE e AGD não se aplicam, e convém filtrar com `--somente`. A suíte ainda não foi rodada contra um provedor que implementa parte dos escopos.
- **Relógio e login.** Sem a interface de controle, os testes que adiantam o relógio ou recarregam o registro terminam como não verificáveis. Login com JavaScript ou segundo fator também pede a interface de controle para concluir a jornada.
- **Efeitos colaterais.** A suíte cria consentimentos, agendamentos e revogações no provedor e, com a interface de controle, adianta o relógio dele. Rode só em homologação.
