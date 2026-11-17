# Política de segurança

Vale para a especificação, para o servidor de exemplo, para a suíte de conformidade e para o registro de participantes do Open Labs Brasil.

## Como relatar uma falha

**Não abra issue pública.** Use um dos dois canais privados:

| Canal | Endereço |
| --- | --- |
| Relato privado de vulnerabilidade do GitHub | [Novo relato](https://github.com/Precisa-Saude/open-labs-brasil/security/advisories/new) |
| E-mail | security@precisa-saude.com.br |

Ajuda incluir:

- o que é afetado: um trecho da especificação (capítulo e seção), o servidor de exemplo, a suíte ou o registro;
- os passos para reproduzir, ou o raciocínio, quando a falha é de desenho;
- o impacto que você vê para pacientes, laboratórios ou aplicativos;
- a correção sugerida, se houver.

Não envie dado de paciente real em um relato.

## O que acontece depois

A correção de uma falha explorável segue a seção 4.3 do [GOVERNANCE.md](GOVERNANCE.md): o editor pode publicá-la sem prazo de comentário, avisando os contatos de segurança dos participantes do registro, e ela passa pelo processo normal de forma retroativa em até 30 dias.

## O que não é falha

O servidor de exemplo é um alvo de teste, com dados sintéticos, chaves geradas na máquina, uma interface de controle sem TLS e um modo que quebra regras de propósito ([docs/servidor-e-suite.md](docs/servidor-e-suite.md)). Nada nele é para produção, e essas características não são vulnerabilidades. Um erro em que o servidor de exemplo ou a suíte divergem da especificação é bem-vindo como issue comum.
