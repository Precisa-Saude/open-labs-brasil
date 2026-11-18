import { ArrowUpRight } from 'lucide-react';

import { ENDERECOS } from '../dados/enderecos';
import { SUPERFICIE, TIPO } from '../lib/tipografia';
import { GRADE_INTERNA, SecaoEmGrade } from './marca/SecaoEmGrade';

interface Escopo {
  da: string;
  nome: string;
  recursos: string;
}

interface Grupo {
  escopos: readonly Escopo[];
  explicacao: string;
  titulo: string;
}

/** Tabelas das seções 3.1 e 3.2 da especificação, sem `consent.manage`. */
const GRUPOS: readonly Grupo[] = [
  {
    escopos: [
      {
        da: 'Exames que podem ser pedidos e seus preços, por unidade ou região',
        nome: 'catalog.read',
        recursos: 'ActivityDefinition, ChargeItemDefinition',
      },
      {
        da: 'Unidades, endereços, coordenadas e horários de funcionamento',
        nome: 'locations.read',
        recursos: 'Location, HealthcareService',
      },
      {
        da: 'Horários disponíveis para uma cesta de exames em uma unidade',
        nome: 'schedule.read',
        recursos: 'Schedule, Slot',
      },
    ],
    explicacao:
      'Não envolvem dados de paciente. Depende só de o laboratório aceitar atender o aplicativo, que pode mostrar preços e horários livres antes de o paciente se conectar.',
    titulo: 'Sem consentimento do paciente',
  },
  {
    escopos: [
      {
        da: 'Criar, remarcar e cancelar o agendamento do paciente que consentiu',
        nome: 'appointment.write',
        recursos: 'Appointment, com ServiceRequest contido',
      },
      {
        da: 'Resultados estruturados daquele paciente',
        nome: 'results.read',
        recursos: 'DiagnosticReport, Observation com LOINC',
      },
      {
        da: 'Os registros de consentimento do próprio paciente',
        nome: 'consent.read',
        recursos: 'Consent',
      },
    ],
    explicacao:
      'Exigem um consentimento autorizado que liste o escopo, e por isso só funcionam depois que o paciente passa pela página do laboratório.',
    titulo: 'Com consentimento do paciente',
  },
];

export function Escopos() {
  return (
    <SecaoEmGrade className={GRADE_INTERNA} id="escopos" tom="muted">
      <h2 className={`col-span-full ${TIPO.tituloDeSecao}`}>Escopos</h2>
      <p className={`col-span-full mb-8 max-w-[56ch] ${TIPO.abertura}`}>
        Cada escopo libera um conjunto de recursos FHIR R4, e o laboratório declara no registro de
        participantes quais deles implementa. Dá para começar um piloto só com resultados.
      </p>

      {GRUPOS.map((grupo) => (
        <div key={grupo.titulo} className="col-span-full md:col-span-6">
          <h3 className={TIPO.subtitulo}>{grupo.titulo}</h3>
          <p className="mt-2 mb-5 max-w-[48ch] leading-relaxed text-foreground/70">
            {grupo.explicacao}
          </p>
          <ul className="space-y-3">
            {grupo.escopos.map((escopo) => (
              <li key={escopo.nome} className={`p-5 ${SUPERFICIE}`}>
                <code className="font-mono text-sm font-semibold text-primary">{escopo.nome}</code>
                <p className="mt-2 leading-snug">{escopo.da}</p>
                <p className="mt-2 text-sm text-foreground/70">{escopo.recursos}</p>
              </li>
            ))}
          </ul>
        </div>
      ))}

      <div className="col-span-full mt-8 border-t pt-6">
        <p className={TIPO.rotulo}>Fora da versão 1</p>
        <p className="mt-2 leading-relaxed text-foreground/75">
          A versão 1 não trata de coleta domiciliar, pedido médico, pagamento nem exames de imagem.
          Para pagar, o agendamento devolve um link para a página do próprio laboratório, e nenhum
          escopo expõe valor cobrado, meio ou situação do pagamento.{' '}
          <a
            className="inline-flex items-center gap-0.5 font-medium text-primary underline-offset-4 hover:underline"
            href={ENDERECOS.escopos}
            rel="noopener noreferrer"
            target="_blank"
          >
            Capítulo 3
            <ArrowUpRight aria-hidden="true" className="size-3.5" />
          </a>
        </p>
      </div>
    </SecaoEmGrade>
  );
}
