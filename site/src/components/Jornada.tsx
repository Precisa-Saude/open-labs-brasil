import { ArrowUpRight } from 'lucide-react';

import { ENDERECOS } from '../dados/enderecos';
import { SUPERFICIE, TIPO } from '../lib/tipografia';
import { DiagramaDeSequencia, type Etapa, type Participante } from './DiagramaDeSequencia';
import { GRADE_INTERNA, SecaoEmGrade } from './marca/SecaoEmGrade';

const PARTICIPANTES: readonly Participante[] = [
  { nome: 'Paciente', papel: 'no celular' },
  { nome: 'Aplicativo', papel: 'servidor' },
  { nome: 'Laboratório', papel: 'login e aprovação' },
  { nome: 'Laboratório', papel: 'API' },
];

const PACIENTE = 0;
const APLICATIVO = 1;
const AUTORIZACAO = 2;
const API = 3;

/**
 * Resumo do diagrama da apresentação para laboratórios
 * (`docs/apresentacao-para-laboratorios.md`), com cada pedido e sua resposta
 * numa etapa só quando a resposta não acrescenta nada para quem lê a página.
 */
const ETAPAS: readonly Etapa[] = [
  { de: PACIENTE, para: APLICATIVO, rotulo: 'Pede para conectar o laboratório' },
  { de: APLICATIVO, para: API, rotulo: 'POST /consents, com token do aplicativo' },
  { de: APLICATIVO, para: AUTORIZACAO, rotulo: 'PAR com PKCE e o consentimento' },
  { de: APLICATIVO, para: PACIENTE, rotulo: 'Abre a página do laboratório' },
  { de: PACIENTE, destaque: true, para: AUTORIZACAO, rotulo: 'Login e aprovação dos escopos' },
  { em: AUTORIZACAO, nota: 'A senha só é digitada aqui' },
  {
    de: AUTORIZACAO,
    para: APLICATIVO,
    resposta: true,
    rotulo: 'Volta ao aplicativo com um código',
  },
  { de: APLICATIVO, para: AUTORIZACAO, rotulo: 'POST /token com o code_verifier' },
  { de: AUTORIZACAO, para: APLICATIVO, resposta: true, rotulo: 'Tokens vinculados ao certificado' },
  { de: APLICATIVO, para: API, rotulo: 'GET /consents/{consent_id}' },
  { de: API, para: APLICATIVO, resposta: true, rotulo: 'AUTHORISED e o CPF de quem entrou' },
  { em: APLICATIVO, nota: 'Compara o CPF e revoga se divergir' },
  { de: APLICATIVO, para: API, rotulo: 'Chamadas FHIR nos escopos aprovados' },
];

const DESCRICAO =
  'O paciente pede ao aplicativo para conectar o laboratório. O aplicativo cria um consentimento na API do laboratório, faz o pedido de autorização com PAR e PKCE e abre a página do laboratório no navegador. O paciente faz login e aprova os escopos ali, e a senha só é digitada nessa página. O navegador volta ao aplicativo com um código, que o aplicativo troca por tokens vinculados ao seu certificado. O aplicativo consulta o consentimento, recebe o estado AUTHORISED e o CPF de quem se autenticou, compara com o do seu usuário e revoga se divergir. Depois faz chamadas FHIR nos escopos aprovados.';

function textoDaEtapa(etapa: Etapa): string {
  if ('nota' in etapa) return etapa.nota;
  const de = PARTICIPANTES[etapa.de]!;
  const para = PARTICIPANTES[etapa.para]!;
  return `${de.nome} → ${para.nome} (${para.papel}): ${etapa.rotulo}`;
}

export function Jornada() {
  return (
    <SecaoEmGrade
      className={GRADE_INTERNA}
      fundo={{ cx: 1290, cy: 570, espelhado: true, menta: true, opacidade: 0.5 }}
      id="jornada"
      tom="muted"
    >
      <h2 className={`col-span-full mb-4 ${TIPO.tituloDeSecao}`}>A jornada do paciente</h2>

      <p className={`col-span-full mb-8 max-w-[60ch] md:col-span-6 ${TIPO.abertura}`}>
        O paciente digita a senha só na página do laboratório, no mesmo login do portal que ele já
        usa. O aplicativo recebe do navegador um código de autorização e o troca por tokens
        vinculados ao próprio certificado, de modo que um token copiado é recusado numa conexão com
        outro certificado.
      </p>
      <p className={`col-span-full mb-8 max-w-[60ch] md:col-span-6 ${TIPO.abertura}`}>
        O pedido de acesso não leva o CPF do paciente. Depois da aprovação, o laboratório informa ao
        aplicativo o CPF de quem se autenticou, e o aplicativo revoga o consentimento se esse CPF
        não for o do seu usuário.
      </p>

      <div className={`col-span-full hidden p-6 lg:block ${SUPERFICIE}`}>
        <DiagramaDeSequencia
          descricao={DESCRICAO}
          etapas={ETAPAS}
          participantes={PARTICIPANTES}
          titulo="Jornada de consentimento"
        />
      </div>

      <ol className={`col-span-full space-y-3 p-5 [counter-reset:etapa] lg:hidden ${SUPERFICIE}`}>
        {ETAPAS.map((etapa) => (
          <li
            key={textoDaEtapa(etapa)}
            className={
              'nota' in etapa
                ? 'ml-9 text-sm text-foreground/70 italic'
                : 'flex gap-3 leading-snug [counter-increment:etapa] before:flex before:size-6 before:shrink-0 before:items-center before:justify-center before:rounded-full before:bg-primary before:text-xs before:font-semibold before:text-primary-foreground before:content-[counter(etapa)]'
            }
          >
            <span className={'destaque' in etapa && etapa.destaque ? 'font-semibold' : undefined}>
              {textoDaEtapa(etapa)}
            </span>
          </li>
        ))}
      </ol>

      <a
        className="col-span-full mt-4 inline-flex items-center gap-1 justify-self-start text-sm font-medium text-primary underline-offset-4 hover:underline"
        href={ENDERECOS.fluxos}
        rel="noopener noreferrer"
        target="_blank"
      >
        Os oito fluxos, com erros e revogação, no capítulo 2
        <ArrowUpRight aria-hidden="true" className="size-4" />
      </a>
    </SecaoEmGrade>
  );
}
