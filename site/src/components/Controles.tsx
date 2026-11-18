import {
  CalendarClock,
  FileSignature,
  KeyRound,
  type LucideIcon,
  Undo2,
  UserRound,
} from 'lucide-react';

import { TIPO } from '../lib/tipografia';
import { GRADE_INTERNA, SecaoEmGrade } from './marca/SecaoEmGrade';

interface Controle {
  descricao: string;
  icone: LucideIcon;
  titulo: string;
}

/** "Base legal e controles" da apresentação para laboratórios. */
const CONTROLES: readonly Controle[] = [
  {
    descricao:
      'Todo fluxo com dados do paciente começa no aplicativo dele. Operadoras de planos de saúde e outras fontes pagadoras não podem ser receptores, e mudar essa regra exige 60 dias de comentário e, enquanto não houver comitê, nenhuma objeção fundamentada de implementador.',
    icone: UserRound,
    titulo: 'Iniciativa do paciente',
  },
  {
    descricao:
      'O consentimento vale por até 12 meses e não se renova sem uma nova aprovação do paciente.',
    icone: CalendarClock,
    titulo: 'Prazo',
  },
  {
    descricao:
      'O paciente pode revogar no aplicativo ou na página do laboratório, que continua no ar mesmo quando o aplicativo cai. Revogar não custa nada e derruba todos os tokens daquele consentimento.',
    icone: Undo2,
    titulo: 'Revogação pelos dois lados',
  },
  {
    descricao:
      'O laboratório verifica a assinatura PS256 de um arquivo JSON que lista, para cada aplicativo, certificados, chaves, endereços de retorno, escopos e a declaração de que não é operadora.',
    icone: FileSignature,
    titulo: 'Registro de participantes',
  },
  {
    descricao:
      'No piloto basta um certificado TLS comum, conferido por hash. Para produção a ideia é usar ICP-Brasil, mas o perfil do certificado ainda não foi definido.',
    icone: KeyRound,
    titulo: 'Certificados',
  },
];

export function Controles() {
  return (
    <SecaoEmGrade
      className={GRADE_INTERNA}
      fundo={{ cx: 1260, cy: 530, opacidade: 0.72 }}
      id="controles"
      tom="muted"
    >
      <h2 className={`col-span-full ${TIPO.tituloDeSecao}`}>Base legal e controles</h2>
      <p className={`col-span-full mb-8 max-w-[60ch] md:col-span-7 ${TIPO.abertura}`}>
        Resultado de exame é dado pessoal sensível (LGPD, art. 5º, II), e o protocolo se apoia no
        consentimento “de forma específica e destacada” do art. 11, I, com os escopos nomeados um a
        um numa tela que mostra a finalidade ao paciente. A leitura da lei que orientou o desenho
        está no capítulo 1, seção 1.7, e não substitui um parecer jurídico.
      </p>

      {CONTROLES.map((controle) => {
        const Icone = controle.icone;
        return (
          <div
            key={controle.titulo}
            className="col-span-full flex gap-4 border-t py-6 md:col-span-6"
          >
            <span aria-hidden="true" className="mt-0.5 shrink-0 text-primary">
              <Icone className="h-5 w-5" />
            </span>
            <div>
              <h3 className={TIPO.subtitulo}>{controle.titulo}</h3>
              <p className="mt-1 max-w-[54ch] leading-relaxed text-foreground/75">
                {controle.descricao}
              </p>
            </div>
          </div>
        );
      })}

      {/* Limitação dita na apresentação para laboratórios; fica à vista aqui
          também, no mesmo tom das demais. */}
      <div className="col-span-full flex gap-4 border-t py-6 md:col-span-6">
        <span aria-hidden="true" className="mt-1.5 size-3 shrink-0 rounded-full bg-[#F47A5C]" />
        <div>
          <h3 className={TIPO.subtitulo}>Limitação conhecida</h3>
          <p className="mt-1 max-w-[54ch] leading-relaxed text-foreground/75">
            No piloto, toda a confiança parte da chave que assina o registro. Quem a guarda é o
            mantenedor, que também opera um aplicativo, e hoje não há como revogá-la por dentro do
            próprio registro. Isso precisa mudar antes de produção.
          </p>
        </div>
      </div>
    </SecaoEmGrade>
  );
}
