# Governança do Open Labs Brasil

**Situação:** rascunho, fase de piloto, 2026-11-16.

Este documento diz quem decide mudanças no Open Labs Brasil hoje e como esse poder de decisão passa a outros se o protocolo ganhar implementadores ou for adotado por uma entidade de padronização. Ele existe desde o primeiro commit porque um laboratório que avalia implementar um protocolo criado por um receptor precisa saber, antes de investir, que o criador não controla as regras sozinho para sempre.

O protocolo se chama Open Labs Brasil. O nome e os identificadores (`open-labs-brasil`) não carregam o nome de nenhuma empresa. O mantenedor atual, que publica o repositório, é a Precisa Saúde.

## 1. Princípios

1. **Aberto.** A especificação, o registro de participantes, as propostas de mudança e as decisões são públicos. Implementar não exige licença, taxa nem autorização do mantenedor. Durante o piloto o repositório é privado: até a abertura, "público" neste documento significa visível a todos os participantes do piloto, e a abertura do repositório é condição para a versão 1.0.0.
2. **Neutro entre participantes.** As regras valem igualmente para qualquer provedor de dados e qualquer receptor, inclusive para o receptor operado pela Precisa Saúde.
3. **Centrado no paciente.** Nenhuma mudança pode criar um caminho de acesso sem consentimento do paciente, com credenciais do paciente, ou para um receptor que não seja um aplicativo do próprio paciente. Estas três restrições só mudam pelo processo da seção 6.
4. **Transferível.** A Precisa Saúde se compromete a transferir o controle de mudanças a uma entidade de padronização que o aceite, nas condições da seção 7.

## 2. Papéis

| Papel | Quem | O que faz |
| --- | --- | --- |
| Mantenedor | Precisa Saúde, na fase 0 | Publica o repositório, edita o texto, decide mudanças conforme a seção 4, opera o registro |
| Editor | Pessoa indicada pelo mantenedor | Redige, integra propostas aceitas, mantém o registro de mudanças |
| Implementador | Organização com entrada `active` no registro, ou que declarou publicamente estar implementando | Propõe, comenta, objeta. Vota a partir da fase 1 |
| Colaborador | Qualquer pessoa | Propõe e comenta |
| Operador do registro | O mantenedor, na fase 0 | Admite participantes, assina e publica o registro |

## 3. Fases

| Fase | Começa quando | Quem decide mudanças |
| --- | --- | --- |
| **0. Rascunho e piloto** | Agora | O mantenedor, por consenso preguiçoso (seção 4.2), com decisão final do editor |
| **1. Comitê de implementadores** | Existirem ao menos dois provedores de dados e dois receptores com entrada `active` no registro, sem controle societário comum entre si nem com o mantenedor | Um comitê técnico (seção 5) |
| **2. Entidade de padronização** | Uma entidade aceitar formalmente a especificação e o comitê aprovar a transferência | A entidade, pelas regras dela |

A passagem da fase 0 para a fase 1 é automática quando a condição se cumpre: o mantenedor convoca o comitê em até 30 dias. Ela não depende da vontade do mantenedor.

## 4. Como uma mudança acontece

### 4.1 Tipos de mudança

| Tipo | Exemplos | Processo |
| --- | --- | --- |
| Editorial | Correção de texto, exemplo, diagrama, sem efeito no comportamento | Pull request, aprovação do editor |
| Compatível | Escopo novo, campo opcional, código de erro novo | Proposta (4.2) |
| Incompatível | Remoção de endpoint, troca de algoritmo, mudança de estado | Proposta (4.2) com prazo de comentário dobrado e plano de transição |
| Protegida | Qualquer mudança nas restrições do princípio 3, na elegibilidade de receptores ou nesta governança | Seção 6 |
| Segurança urgente | Correção de falha explorável | Seção 4.3 |

A correspondência com `MAJOR.MINOR.PATCH` está em `especificacao/09-versionamento-e-conformidade.md`.

### 4.2 Proposta de mudança

1. Qualquer pessoa abre uma issue descrevendo o problema, a mudança proposta, o efeito sobre provedores e receptores já implementados e as alternativas consideradas.
2. O editor confirma em até 10 dias úteis que a proposta está completa, ou diz o que falta.
3. Abre-se o prazo de comentário: 21 dias corridos para mudança compatível, 42 para incompatível.
4. **Fase 0.** Sem objeção fundamentada de um implementador ao fim do prazo, a proposta é aceita. Havendo objeção, o editor decide e registra por escrito por que a objeção foi ou não acolhida.
5. **Fase 1.** O comitê vota (seção 5).
6. A decisão, com o resumo dos comentários, fica registrada na issue. O texto entra por pull request que referencia a issue.

Uma objeção é fundamentada quando aponta um dano concreto a pacientes, à segurança, ou a uma implementação existente. "Não queremos implementar isso" é um comentário legítimo e não é, sozinho, uma objeção fundamentada.

### 4.3 Segurança urgente

Falhas de segurança são comunicadas em privado ao contato de segurança do repositório, e não em issue pública. O editor PODE publicar uma correção sem prazo de comentário, avisando os contatos de segurança de todos os participantes do registro antes ou no momento da publicação. A correção passa pelo processo normal de forma retroativa em até 30 dias, e pode ser revertida por ele.

## 5. Comitê técnico (fase 1)

- **Composição.** Um assento por organização implementadora com entrada `active` no registro. Organizações sob controle comum dividem um assento. O mantenedor tem um assento como qualquer outro.
- **Equilíbrio.** Uma decisão exige maioria dos assentos de provedores de dados e maioria dos assentos de receptores, contadas em separado. Nenhum dos dois lados impõe uma mudança ao outro.
- **Quórum.** Metade dos assentos de cada lado.
- **Voto.** Público e registrado na issue. Abstenção não conta para nenhum lado.
- **Editor.** Escolhido pelo comitê, com mandato de 12 meses, renovável.
- **Assento de pacientes.** O comitê DEVERIA convidar ao menos uma entidade de defesa de pacientes ou de proteção de dados para um assento sem voto, com direito de registrar objeção fundamentada. Como escolher essa entidade é uma questão em aberto.

## 6. Mudanças protegidas

Mudanças nas restrições do princípio 3, na regra de elegibilidade de receptores (incluindo a exclusão de operadoras de planos de saúde e outras fontes pagadoras) e neste documento exigem:

- prazo de comentário de 60 dias, anunciado a todos os contatos do registro;
- na fase 0, ausência de objeção fundamentada de qualquer implementador;
- na fase 1, dois terços dos assentos de cada lado;
- registro escrito do motivo.

## 7. Transferência a uma entidade de padronização

### 7.1 Candidatas

O ticket que originou este trabalho cita quatro candidatas: HL7 Brasil, SBIS, ABRAMED e o Ministério da Saúde. Qual delas, ou se outra, é uma questão em aberto. Nenhuma foi consultada, e este documento não afirma nada sobre o interesse, o processo ou a competência de cada uma (ver `docs/NOTAS-DE-REVISAO.md`).

### 7.2 Condições para transferir

O mantenedor, na fase 0, ou o comitê, na fase 1, só aprova a transferência a uma entidade que aceite por escrito:

1. manter a especificação pública e de implementação livre, com licença não mais restritiva que a atual;
2. manter as restrições do princípio 3, ou alterá-las apenas por processo ao menos tão exigente quanto o da seção 6;
3. ter um processo de mudança aberto a implementadores que não sejam associados pagantes, ou oferecer associação em condições que não excluam laboratórios e aplicativos pequenos;
4. preservar o histórico de versões e de decisões.

### 7.3 O que é transferido

| Item | Depois da transferência |
| --- | --- |
| Controle de mudanças da especificação | Da entidade |
| Nome e eventuais marcas do protocolo | Cedidos à entidade, sem custo |
| Repositório e histórico | Transferidos ou espelhados, a critério da entidade, com o histórico íntegro |
| Operação do registro de participantes | Decidida em separado. Pode ir para a entidade, para um operador indicado por ela, ou ficar com um operador neutro escolhido pelo comitê |
| Suíte de conformidade, quando existir | Acompanha a especificação |
| Licenças do que já foi publicado | Não mudam. Apache 2.0 e CC BY 4.0 são irrevogáveis para o que foi publicado sob elas |

### 7.4 Procedimento

1. A entidade manifesta interesse por escrito, e o mantenedor publica a manifestação.
2. Prazo de comentário de 60 dias.
3. Aprovação conforme a seção 6.
4. Acordo de transferência publicado na íntegra.
5. A partir da data de vigência, este documento é substituído pelas regras da entidade, e o mantenedor passa a ser um implementador como os outros.

O mantenedor NÃO DEVE recusar uma transferência que cumpra as condições da seção 7.2 e tenha sido aprovada pelo comitê.

## 8. Registro de participantes

O registro é o ponto em que a governança tem efeito prático imediato: quem não está nele não participa.

### 8.1 Admissão

- **Provedor de dados.** Pessoa jurídica que realiza análises clínicas e é responsável pelos resultados que expõe. Apresenta CNPJ, contatos, endereços dos endpoints e declaração de conformidade com a versão implementada.
- **Receptor.** Pessoa jurídica que opera um aplicativo em que o paciente é o usuário. Apresenta CNPJ, contatos, política de privacidade, termos de uso, chaves e certificado, declaração de conformidade e a declaração de elegibilidade: o aplicativo é voltado ao paciente, e a organização não é operadora de plano privado de assistência à saúde nem outra fonte pagadora, e não é controlada por uma.
- O operador do registro confere os documentos e responde em até 15 dias úteis. Recusa é motivada por escrito e cita o critério não atendido.
- Os critérios são os deste documento. O operador não pode recusar por motivo comercial, nem cobrar pela admissão no piloto.
- A Precisa Saúde, quando pede admissão para o próprio receptor, passa pela mesma conferência, e o pedido e a decisão ficam públicos como os demais.

### 8.2 Suspensão e retirada

| Motivo | Ação | Prazo |
| --- | --- | --- |
| Pedido do próprio participante | `withdrawn` | Próxima publicação |
| Comprometimento de chave ou certificado | Retirada da chave ou do certificado. `suspended` se não houver outro válido | Imediato |
| Descumprimento de requisito DEVE, constatado e não corrigido | Notificação, 15 dias para corrigir, depois `suspended` | 15 dias |
| Uso de dados fora do consentimento, ou repasse a terceiros | `suspended` imediato, e `withdrawn` depois de apuração | Imediato |
| Perda de elegibilidade (por exemplo, aquisição do receptor por uma operadora) | `withdrawn` | 30 dias após a constatação |

O participante atingido pode recorrer. Na fase 0, o recurso é decidido pelo editor com parecer público. Na fase 1, pelo comitê, sem o voto do interessado. Suspensão por comprometimento de chave vale durante o recurso.

Nada do que o registro decide substitui as obrigações legais de cada participante, nem a atuação da ANPD ou de outros órgãos.

### 8.3 Custódia da chave do registro

Na fase 0, a chave de assinatura do registro fica com o mantenedor, em dispositivo ou serviço que não permita exportar a chave privada, e cada publicação é feita por uma pessoa e revista por outra. A partir da fase 1, o comitê define a custódia.

## 9. Conflito de interesses do mantenedor

A Precisa Saúde opera um receptor e, portanto, concorre com outros receptores e negocia com provedores. As salvaguardas são:

- a passagem automática à fase 1 (seção 3);
- o voto por lados em separado (seção 5), que impede receptores de impor regras a provedores;
- a publicidade de pedidos de admissão e de decisões do registro (seção 8.1);
- a proibição de recusar admissão por motivo comercial;
- o compromisso de transferência (seção 7.4).

O mantenedor NÃO DEVE usar a operação do registro para obter informação comercial sobre outros participantes além do que o próprio registro publica.

## 10. Questões comerciais

Um provedor de dados PODE cobrar de receptores pelo acesso. Preço, contrato e faturamento ficam fora do protocolo e fora desta governança. A governança só trata do caso em que uma condição comercial é usada para contornar a especificação, por exemplo oferecer a um receptor um acesso por credenciais em paralelo.

## 11. Licenças e contribuições

| O quê | Licença |
| --- | --- |
| Texto da especificação, diagramas, este documento | Creative Commons Atribuição 4.0 Internacional (CC BY 4.0) [CC-BY-4.0], arquivo `LICENSE-spec` |
| Código: schemas, exemplos executáveis, ferramentas, suíte de conformidade | Apache License 2.0 [APACHE-2.0], arquivo `LICENSE` |

- Quem contribui licencia a contribuição nos mesmos termos e declara ter o direito de fazê-lo. A forma dessa declaração (por exemplo, uma linha de assinatura em cada commit) é uma questão em aberto.
- A Apache 2.0 traz concessão de patentes para o código. A CC BY 4.0 não trata de patentes, então o texto da especificação não tem hoje uma promessa de não cobrança de patentes por parte de quem contribui. Se isso precisa de uma política própria é uma questão em aberto.
- O nome Open Labs Brasil pode ser usado por qualquer implementação para dizer que implementa o protocolo. Dizer que uma implementação é "conforme" exige cumprir `especificacao/09-versionamento-e-conformidade.md`.

As referências [CC-BY-4.0] e [APACHE-2.0] estão em `docs/FONTES.md`.

## 12. Alteração deste documento

Este documento é uma mudança protegida (seção 6). Na fase 0, antes de existir qualquer implementador além do mantenedor, o editor pode alterá-lo por pull request público com 14 dias de prazo de comentário.
