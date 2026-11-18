import { ENDERECOS, REPOSITORIO } from '../dados/enderecos';
import { ESPECIFICACAO } from '../dados/situacao';
import { TIPO } from '../lib/tipografia';
import { GRADE_INTERNA, SecaoEmGrade } from './marca/SecaoEmGrade';

/**
 * Os botões do encerramento em contorno, com o mesmo hover do botão GitHub do
 * cabeçalho: preenchem de menta e o texto vira roxo.
 */
const CLASSE_DO_BOTAO =
  'inline-flex h-12 items-center justify-center rounded-full border border-white bg-transparent px-8 text-sm font-medium text-white transition-colors hover:border-ps-mint hover:bg-ps-mint hover:text-primary';

function formatarData(iso: string): string {
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}

export function Situacao() {
  const blocos = [
    {
      texto: `A versão ${ESPECIFICACAO.versao}, de ${formatarData(ESPECIFICACAO.data)}, ainda não foi testada contra um laboratório real. Enquanto o número começar com 0, uma versão nova pode quebrar a anterior, e quem implementa declara a própria conformidade.`,
      titulo: 'Rascunho',
    },
    {
      texto:
        'Por enquanto a Precisa Saúde mantém o protocolo e decide as mudanças. Quando houver dois laboratórios e dois aplicativos ativos, sem controle societário comum, um comitê de implementadores assume, e mais adiante a especificação pode passar a uma entidade de padronização.',
      titulo: 'Governança',
    },
    {
      texto:
        'Qualquer laboratório ou aplicativo pode implementar sem pedir licença nem pagar taxa. O texto da especificação está sob CC BY 4.0 e o código sob Apache 2.0.',
      titulo: 'Licença',
    },
    {
      texto:
        'Dúvidas, trechos ambíguos e resultados da suíte entram como issue no repositório público. Falhas de segurança vão em privado, pelos canais do SECURITY.md.',
      titulo: 'Retorno',
    },
  ];

  return (
    // Encerramento em roxo, como no site do fhir-brasil.
    <SecaoEmGrade
      className={GRADE_INTERNA}
      fundo={{ cx: 1210, cy: 470, menta: true, opacidade: 0.6 }}
      id="situacao"
      tom="roxo"
    >
      <h2 className={`col-span-full ${TIPO.tituloDeSecao}`}>Situação e governança</h2>
      <p className="col-span-full mb-8 max-w-[56ch] text-lg leading-relaxed text-pretty text-primary-foreground/80">
        O roteiro do piloto descreve como um laboratório testa o protocolo em homologação, começando
        só por resultados (<code>results.read</code> e <code>consent.read</code>).
      </p>

      {blocos.map((bloco) => (
        <div
          key={bloco.titulo}
          className="col-span-full border-t border-primary-foreground/20 py-6 md:col-span-6"
        >
          <h3 className={TIPO.subtitulo}>{bloco.titulo}</h3>
          <p className="mt-1 max-w-[54ch] leading-relaxed text-primary-foreground/80">
            {bloco.texto}
          </p>
        </div>
      ))}

      <div className="col-span-full mt-8 flex flex-col gap-3 sm:flex-row">
        <a
          className={CLASSE_DO_BOTAO}
          href={ENDERECOS.piloto}
          rel="noopener noreferrer"
          target="_blank"
        >
          Roteiro do piloto →
        </a>
        <a
          className={`gap-2 ${CLASSE_DO_BOTAO}`}
          href={REPOSITORIO}
          rel="noopener noreferrer"
          target="_blank"
        >
          <svg aria-hidden="true" className="h-5 w-5 fill-current" viewBox="0 0 24 24">
            <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2Z" />
          </svg>
          Ver no GitHub
        </a>
        <a
          className={CLASSE_DO_BOTAO}
          href={ENDERECOS.issues}
          rel="noopener noreferrer"
          target="_blank"
        >
          Abrir uma issue
        </a>
      </div>
    </SecaoEmGrade>
  );
}
