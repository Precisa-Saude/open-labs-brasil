// Dados sintéticos do servidor de exemplo, no formato dos perfis do guia de
// implementação (https://fhir-brasil.dev.br/ig/StructureDefinition/...).
//
// Tudo aqui é fictício: laboratório, unidades, endereços, pessoas, CPFs, preços
// e resultados. Os CPFs têm dígitos verificadores válidos só para passar nas
// conferências de formato. Os códigos LOINC são os publicados pelo LOINC para
// cada exame, com nome em português no texto.

import { completarCnsProvisorio, completarCpf } from '../comum/cpf.ts';

export const BASE_DOS_PERFIS = 'https://fhir-brasil.dev.br/ig/StructureDefinition/';
export const perfil = (id: string) => `${BASE_DOS_PERFIS}${id}`;

export const SISTEMA_LOINC = 'http://loinc.org';
export const SISTEMA_UCUM = 'http://unitsofmeasure.org';
export const SISTEMA_CPF = 'http://rnds.saude.gov.br/fhir/r4/NamingSystem/cpf';
export const SISTEMA_CNS = 'http://rnds.saude.gov.br/fhir/r4/NamingSystem/cns';
export const SISTEMA_IBGE = 'https://fhir-brasil.dev.br/CodeSystem/ibge-municipio';
export const SISTEMA_ESCOPOS = 'https://fhir-brasil.dev.br/CodeSystem/lab-access-scope';
export const SISTEMA_CONTEXTO_DE_PRECO = 'https://fhir-brasil.dev.br/CodeSystem/lab-price-context';
export const URL_PAYMENT_LINK = 'https://fhir-brasil.dev.br/ig/StructureDefinition/payment-link';
/** Sistema de códigos próprio do laboratório fictício. */
export const SISTEMA_PRODUTOS = 'https://laboratorio.example/fhir/produtos';
export const BASE_CANONICA = 'https://laboratorio.example/fhir';
export const ORGANIZACAO = {
  display: 'Laboratório Exemplo (simulado)',
  reference: 'Organization/laboratorio-exemplo',
};

export type Recurso = Record<string, unknown> & { resourceType: string; id: string };

export interface Registro {
  atualizadoEm: number;
  /** client_id do receptor que criou o agendamento pelo protocolo. Ausente: outro canal. */
  donoClientId?: string;
  /** Laudo liberado ao paciente nos canais do provedor. */
  liberado?: boolean;
  /** Paciente dono do recurso, para recursos de paciente. */
  pacienteId?: string;
  recurso: Recurso;
  versao: number;
}

export interface Unidade {
  cep: string;
  cidade: string;
  ibge: string;
  id: string;
  latitude: number;
  linha: string;
  longitude: number;
  nome: string;
  uf: string;
}

export const UNIDADES: Unidade[] = [
  {
    cep: '90010-000',
    cidade: 'Porto Alegre',
    ibge: '4314902',
    id: 'unidade-centro',
    latitude: -30.03,
    linha: 'Rua Exemplo, 100',
    longitude: -51.23,
    nome: 'Laboratório Exemplo, unidade Centro',
    uf: 'RS',
  },
  {
    cep: '91000-000',
    cidade: 'Porto Alegre',
    ibge: '4314902',
    id: 'unidade-zona-norte',
    latitude: -30.0,
    linha: 'Avenida Fictícia, 2000',
    longitude: -51.18,
    nome: 'Laboratório Exemplo, unidade Zona Norte',
    uf: 'RS',
  },
  {
    cep: '92000-000',
    cidade: 'Canoas',
    ibge: '4304606',
    id: 'unidade-canoas',
    latitude: -29.92,
    linha: 'Rua Imaginária, 45',
    longitude: -51.18,
    nome: 'Laboratório Exemplo, unidade Canoas',
    uf: 'RS',
  },
];

export interface Exame {
  /** Só pode ser coletado em horários que começam antes desta hora local. */
  antesDas?: string;
  codigoProprio: string;
  id: string;
  loinc?: { code: string; display: string };
  /** Preço base em reais por município (código IBGE). */
  preco: number;
  status: 'active' | 'retired';
  titulo: string;
  /** Unidades que coletam o exame. Ausente: todas. */
  unidades?: string[];
}

export const EXAMES: Exame[] = [
  {
    codigoProprio: 'GLI',
    id: 'glicose',
    loinc: { code: '2345-7', display: 'Glucose [Mass/volume] in Serum or Plasma' },
    preco: 14,
    status: 'active',
    titulo: 'Glicose',
  },
  {
    codigoProprio: 'HMG',
    id: 'hemograma',
    loinc: { code: '58410-2', display: 'CBC panel - Blood by Automated count' },
    preco: 22,
    status: 'active',
    titulo: 'Hemograma completo',
  },
  {
    codigoProprio: 'COL',
    id: 'colesterol-total',
    loinc: { code: '2093-3', display: 'Cholesterol [Mass/volume] in Serum or Plasma' },
    preco: 15,
    status: 'active',
    titulo: 'Colesterol total',
  },
  {
    codigoProprio: 'HDL',
    id: 'colesterol-hdl',
    loinc: { code: '2085-9', display: 'Cholesterol in HDL [Mass/volume] in Serum or Plasma' },
    preco: 16,
    status: 'active',
    titulo: 'Colesterol HDL',
  },
  {
    codigoProprio: 'LDL',
    id: 'colesterol-ldl',
    loinc: {
      code: '13457-7',
      display: 'Cholesterol in LDL [Mass/volume] in Serum or Plasma by calculation',
    },
    preco: 16,
    status: 'active',
    titulo: 'Colesterol LDL (calculado)',
  },
  {
    codigoProprio: 'TRI',
    id: 'triglicerideos',
    loinc: { code: '2571-8', display: 'Triglyceride [Mass/volume] in Serum or Plasma' },
    preco: 15,
    status: 'active',
    titulo: 'Triglicerídeos',
  },
  {
    codigoProprio: 'CRE',
    id: 'creatinina',
    loinc: { code: '2160-0', display: 'Creatinine [Mass/volume] in Serum or Plasma' },
    preco: 13,
    status: 'active',
    titulo: 'Creatinina',
  },
  {
    codigoProprio: 'TSH',
    id: 'tsh',
    loinc: { code: '3016-3', display: 'Thyrotropin [Units/volume] in Serum or Plasma' },
    preco: 35,
    status: 'active',
    titulo: 'TSH (hormônio tireoestimulante)',
  },
  {
    codigoProprio: 'T4L',
    id: 't4-livre',
    loinc: { code: '3024-7', display: 'Thyroxine (T4) free [Mass/volume] in Serum or Plasma' },
    preco: 33,
    status: 'active',
    titulo: 'T4 livre',
  },
  {
    codigoProprio: 'HBA1C',
    id: 'hemoglobina-glicada',
    loinc: { code: '4548-4', display: 'Hemoglobin A1c/Hemoglobin.total in Blood' },
    preco: 28,
    status: 'active',
    titulo: 'Hemoglobina glicada (HbA1c)',
  },
  {
    codigoProprio: 'AUR',
    id: 'acido-urico',
    loinc: { code: '3084-1', display: 'Urate [Mass/volume] in Serum or Plasma' },
    preco: 14,
    status: 'active',
    titulo: 'Ácido úrico',
  },
  {
    codigoProprio: 'TGO',
    id: 'tgo',
    loinc: {
      code: '1920-8',
      display: 'Aspartate aminotransferase [Enzymatic activity/volume] in Serum or Plasma',
    },
    preco: 14,
    status: 'active',
    titulo: 'TGO (AST)',
  },
  {
    codigoProprio: 'TGP',
    id: 'tgp',
    loinc: {
      code: '1742-6',
      display: 'Alanine aminotransferase [Enzymatic activity/volume] in Serum or Plasma',
    },
    preco: 14,
    status: 'active',
    titulo: 'TGP (ALT)',
  },
  {
    codigoProprio: 'GGT',
    id: 'gama-gt',
    loinc: {
      code: '2324-2',
      display: 'Gamma glutamyl transferase [Enzymatic activity/volume] in Serum or Plasma',
    },
    preco: 16,
    status: 'active',
    titulo: 'Gama GT',
  },
  {
    codigoProprio: 'FER',
    id: 'ferritina',
    loinc: { code: '2276-4', display: 'Ferritin [Mass/volume] in Serum or Plasma' },
    preco: 38,
    status: 'active',
    titulo: 'Ferritina',
  },
  {
    codigoProprio: 'B12',
    id: 'vitamina-b12',
    loinc: { code: '2132-9', display: 'Cobalamin (Vitamin B12) [Mass/volume] in Serum or Plasma' },
    preco: 42,
    status: 'active',
    titulo: 'Vitamina B12',
  },
  {
    codigoProprio: 'PCR',
    id: 'proteina-c-reativa',
    loinc: { code: '1988-5', display: 'C reactive protein [Mass/volume] in Serum or Plasma' },
    preco: 25,
    status: 'active',
    titulo: 'Proteína C reativa',
  },
  {
    codigoProprio: 'INS',
    id: 'insulina',
    loinc: { code: '20448-7', display: 'Insulin [Units/volume] in Serum or Plasma' },
    preco: 36,
    status: 'active',
    titulo: 'Insulina',
  },
  {
    codigoProprio: 'K',
    id: 'potassio',
    loinc: { code: '2823-3', display: 'Potassium [Moles/volume] in Serum or Plasma' },
    preco: 12,
    status: 'active',
    titulo: 'Potássio',
  },
  {
    codigoProprio: 'NA',
    id: 'sodio',
    loinc: { code: '2951-2', display: 'Sodium [Moles/volume] in Serum or Plasma' },
    preco: 12,
    status: 'active',
    titulo: 'Sódio',
  },
  {
    codigoProprio: 'PSA',
    id: 'psa',
    loinc: { code: '2857-1', display: 'Prostate specific Ag [Mass/volume] in Serum or Plasma' },
    preco: 40,
    status: 'active',
    titulo: 'PSA total',
  },
  {
    codigoProprio: 'EAS',
    id: 'urina-tipo-1',
    loinc: { code: '24356-8', display: 'Urinalysis complete panel - Urine' },
    preco: 18,
    status: 'active',
    titulo: 'Urina tipo 1 (EAS)',
  },
  // Sem LOINC: combo, curva com horário restrito, exame só em uma unidade, item gratuito.
  {
    antesDas: '08:00',
    codigoProprio: 'TOTG',
    id: 'curva-glicemica',
    preco: 45,
    status: 'active',
    titulo: 'Curva glicêmica (TOTG 75 g)',
  },
  {
    codigoProprio: 'ESP',
    id: 'espermograma',
    preco: 90,
    status: 'active',
    titulo: 'Espermograma',
    unidades: ['unidade-centro'],
  },
  {
    codigoProprio: 'COMBO-CHECKUP',
    id: 'combo-check-up',
    preco: 99,
    status: 'active',
    titulo: 'Combo check-up básico',
  },
  {
    codigoProprio: 'GLICAP',
    id: 'glicemia-capilar-campanha',
    preco: 0,
    status: 'active',
    titulo: 'Glicemia capilar (campanha, sem custo)',
  },
  // Retirado: continua legível com status retired.
  {
    codigoProprio: 'MUCO',
    id: 'mucoproteinas',
    preco: 20,
    status: 'retired',
    titulo: 'Mucoproteínas (descontinuado)',
  },
];

export function codingsDoExame(
  exame: Exame,
): Array<{ system: string; code: string; display: string }> {
  const lista: Array<{ system: string; code: string; display: string }> = [];
  if (exame.loinc)
    lista.push({ code: exame.loinc.code, display: exame.loinc.display, system: SISTEMA_LOINC });
  lista.push({ code: exame.codigoProprio, display: exame.titulo, system: SISTEMA_PRODUTOS });
  return lista;
}

export interface Paciente {
  cns?: string;
  cpf?: string;
  id: string;
  nascimento: string;
  nome: { given: string[]; family: string };
  sexo: 'female' | 'male';
  usuario: string;
}

export const SENHA_DE_TESTE = 'teste';

export const PACIENTES: Paciente[] = [
  {
    cpf: completarCpf('529982247'),
    id: 'pac-ana',
    nascimento: '1985-04-12',
    nome: { family: 'Exemplo Sintética', given: ['Ana'] },
    sexo: 'female',
    usuario: 'ana',
  },
  {
    cpf: completarCpf('111444777'),
    id: 'pac-bruno',
    nascimento: '1979-09-30',
    nome: { family: 'Exemplo Sintético', given: ['Bruno'] },
    sexo: 'male',
    usuario: 'bruno',
  },
  {
    cns: completarCnsProvisorio('89800000000001'),
    id: 'pac-carla',
    nascimento: '1992-01-20',
    nome: { family: 'Sem CPF Sintética', given: ['Carla'] },
    sexo: 'female',
    usuario: 'carla',
  },
  // CPF de preenchimento no cadastro: passa no cálculo dos dígitos e é inválido pela seção 4.4 (CNS-025).
  {
    cpf: '00000000000',
    id: 'pac-diego',
    nascimento: '1988-07-03',
    nome: { family: 'CPF Inválido Sintético', given: ['Diego'] },
    sexo: 'male',
    usuario: 'diego',
  },
];

/** Identificadores que a configuração da suíte usa para os testes de resultados e agendamento. */
export const FIXTURAS = {
  agendamentoDeOutroCanal: 'ag-outro-canal-ana',
  exameComum: `${SISTEMA_LOINC}|2345-7`,
  exameIndisponivel: { exame: `${SISTEMA_PRODUTOS}|ESP`, unidade: 'unidade-canoas' },
  exameRestrito: `${SISTEMA_PRODUTOS}|TOTG`,
  laudoAntigo: { data: '2020-03-10', id: 'laudo-ana-2020-glicemia' },
  laudoParaRetificar: 'laudo-ana-2026-rotina',
  laudosNaoLiberados: ['laudo-ana-2026-parcial', 'laudo-ana-2026-retido'],
  unidadeDosTestes: 'unidade-centro',
};

interface ResultadoSintetico {
  alto?: number;
  baixo?: number;
  exame: string;
  loinc: string;
  nome: string;
  ucum: string;
  unidade: string;
  valor: number;
}

interface LaudoSintetico {
  codigo: { system: string; code: string; display: string };
  data: string;
  id: string;
  liberado: boolean;
  paciente: string;
  resultados: ResultadoSintetico[];
  status: 'final' | 'amended' | 'corrected' | 'preliminary';
  titulo: string;
}

const LAUDOS: LaudoSintetico[] = [
  {
    codigo: {
      code: '2345-7',
      display: 'Glucose [Mass/volume] in Serum or Plasma',
      system: SISTEMA_LOINC,
    },
    data: '2020-03-10T08:10:00-03:00',
    id: 'laudo-ana-2020-glicemia',
    liberado: true,
    paciente: 'pac-ana',
    resultados: [
      {
        alto: 99,
        baixo: 70,
        exame: 'glicose',
        loinc: '2345-7',
        nome: 'Glicose',
        ucum: 'mg/dL',
        unidade: 'mg/dL',
        valor: 91,
      },
    ],
    status: 'final',
    titulo: 'Glicemia de jejum',
  },
  {
    codigo: { code: 'PERFIL-LIPIDICO', display: 'Perfil lipídico', system: SISTEMA_PRODUTOS },
    data: '2024-05-20T07:40:00-03:00',
    id: 'laudo-ana-2024-lipidograma',
    liberado: true,
    paciente: 'pac-ana',
    resultados: [
      {
        alto: 190,
        exame: 'col',
        loinc: '2093-3',
        nome: 'Colesterol total',
        ucum: 'mg/dL',
        unidade: 'mg/dL',
        valor: 182,
      },
      {
        baixo: 40,
        exame: 'hdl',
        loinc: '2085-9',
        nome: 'Colesterol HDL',
        ucum: 'mg/dL',
        unidade: 'mg/dL',
        valor: 58,
      },
      {
        alto: 150,
        exame: 'tri',
        loinc: '2571-8',
        nome: 'Triglicerídeos',
        ucum: 'mg/dL',
        unidade: 'mg/dL',
        valor: 110,
      },
    ],
    status: 'final',
    titulo: 'Perfil lipídico',
  },
  {
    codigo: {
      code: '3016-3',
      display: 'Thyrotropin [Units/volume] in Serum or Plasma',
      system: SISTEMA_LOINC,
    },
    data: '2025-08-02T08:00:00-03:00',
    id: 'laudo-ana-2025-tireoide',
    liberado: true,
    paciente: 'pac-ana',
    resultados: [
      {
        alto: 4.5,
        baixo: 0.4,
        exame: 'tsh',
        loinc: '3016-3',
        nome: 'TSH',
        ucum: 'm[IU]/L',
        unidade: 'mUI/L',
        valor: 2.1,
      },
    ],
    status: 'amended',
    titulo: 'TSH',
  },
  {
    codigo: { code: 'ROTINA', display: 'Exames de rotina', system: SISTEMA_PRODUTOS },
    data: '2026-10-01T07:30:00-03:00',
    id: 'laudo-ana-2026-rotina',
    liberado: true,
    paciente: 'pac-ana',
    resultados: [
      {
        alto: 99,
        baixo: 70,
        exame: 'gli',
        loinc: '2345-7',
        nome: 'Glicose',
        ucum: 'mg/dL',
        unidade: 'mg/dL',
        valor: 96,
      },
      {
        alto: 5.7,
        exame: 'hba1c',
        loinc: '4548-4',
        nome: 'Hemoglobina glicada',
        ucum: '%',
        unidade: '%',
        valor: 5.4,
      },
      {
        alto: 1.1,
        baixo: 0.5,
        exame: 'cre',
        loinc: '2160-0',
        nome: 'Creatinina',
        ucum: 'mg/dL',
        unidade: 'mg/dL',
        valor: 0.8,
      },
      {
        alto: 16,
        baixo: 12,
        exame: 'hb',
        loinc: '718-7',
        nome: 'Hemoglobina',
        ucum: 'g/dL',
        unidade: 'g/dL',
        valor: 13.6,
      },
    ],
    status: 'final',
    titulo: 'Exames de rotina',
  },
  {
    codigo: {
      code: '2276-4',
      display: 'Ferritin [Mass/volume] in Serum or Plasma',
      system: SISTEMA_LOINC,
    },
    data: '2026-11-10T07:30:00-03:00',
    id: 'laudo-ana-2026-parcial',
    liberado: false,
    paciente: 'pac-ana',
    resultados: [
      {
        alto: 150,
        baixo: 15,
        exame: 'fer',
        loinc: '2276-4',
        nome: 'Ferritina',
        ucum: 'ng/mL',
        unidade: 'ng/mL',
        valor: 85,
      },
    ],
    status: 'preliminary',
    titulo: 'Ferritina (parcial)',
  },
  {
    codigo: {
      code: '2132-9',
      display: 'Cobalamin (Vitamin B12) [Mass/volume] in Serum or Plasma',
      system: SISTEMA_LOINC,
    },
    data: '2026-11-12T07:30:00-03:00',
    id: 'laudo-ana-2026-retido',
    liberado: false,
    paciente: 'pac-ana',
    resultados: [
      {
        alto: 900,
        baixo: 200,
        exame: 'b12',
        loinc: '2132-9',
        nome: 'Vitamina B12',
        ucum: 'pg/mL',
        unidade: 'pg/mL',
        valor: 410,
      },
    ],
    status: 'final',
    titulo: 'Vitamina B12 (aguardando liberação)',
  },
  {
    codigo: {
      code: '2345-7',
      display: 'Glucose [Mass/volume] in Serum or Plasma',
      system: SISTEMA_LOINC,
    },
    data: '2026-09-15T08:05:00-03:00',
    id: 'laudo-bruno-2026-glicemia',
    liberado: true,
    paciente: 'pac-bruno',
    resultados: [
      {
        alto: 99,
        baixo: 70,
        exame: 'gli',
        loinc: '2345-7',
        nome: 'Glicose',
        ucum: 'mg/dL',
        unidade: 'mg/dL',
        valor: 102,
      },
    ],
    status: 'final',
    titulo: 'Glicemia de jejum',
  },
];

/** Data local (fuso de Brasília, UTC-3) com hora, em formato FHIR. */
function local(
  ano: number,
  mes: number,
  dia: number,
  hora: number,
  minuto: number,
): { texto: string; ms: number } {
  const p = (n: number) => String(n).padStart(2, '0');
  return {
    ms: Date.UTC(ano, mes - 1, dia, hora + 3, minuto),
    texto: `${ano}-${p(mes)}-${p(dia)}T${p(hora)}:${p(minuto)}:00-03:00`,
  };
}

export class DadosSinteticos {
  /** Recursos por tipo e id. */
  readonly recursos = new Map<string, Map<string, Registro>>();
  /** Exames que cada unidade coleta. */
  readonly examesPorUnidade = new Map<string, Exame[]>();

  constructor(referenciaMs: number) {
    const inicioDosDados = referenciaMs - 24 * 3600_000;
    for (const exame of EXAMES) this.gravar(this.activityDefinition(exame), inicioDosDados);
    this.gerarPrecos(inicioDosDados);
    this.gerarUnidades(inicioDosDados);
    this.garantirAgendas(referenciaMs);
    for (const p of PACIENTES) this.gravar(this.paciente(p), inicioDosDados, { pacienteId: p.id });
    this.gerarResultados(inicioDosDados);
    this.gerarAgendamentoDeOutroCanal(inicioDosDados);
  }

  tipo(tipo: string): Map<string, Registro> {
    let m = this.recursos.get(tipo);
    if (!m) {
      m = new Map();
      this.recursos.set(tipo, m);
    }
    return m;
  }

  gravar(recurso: Recurso, em: number, extra: Partial<Registro> = {}): Registro {
    const registro: Registro = { atualizadoEm: em, recurso, versao: 1, ...extra };
    this.tipo(recurso.resourceType).set(recurso.id, registro);
    return registro;
  }

  /** Nova versão do recurso (atualização). */
  atualizar(registro: Registro, recurso: Recurso, em: number): void {
    registro.recurso = recurso;
    registro.versao += 1;
    registro.atualizadoEm = em;
  }

  exame(id: string): Exame | undefined {
    return EXAMES.find((e) => e.id === id);
  }

  private activityDefinition(exame: Exame): Recurso {
    return {
      code: { coding: codingsDoExame(exame), text: exame.titulo },
      id: exame.id,
      kind: 'ServiceRequest',
      meta: { profile: [perfil('br-lab-activity-definition')] },
      resourceType: 'ActivityDefinition',
      status: exame.status,
      title: exame.titulo,
      url: `${BASE_CANONICA}/ActivityDefinition/${exame.id}`,
    };
  }

  private chargeItemDefinition(
    id: string,
    exame: Exame,
    valor: number,
    alcance: Record<string, unknown>,
    status: string,
  ): Recurso {
    return {
      code: { coding: codingsDoExame(exame), text: exame.titulo },
      id,
      meta: { profile: [perfil('br-lab-charge-item-definition')] },
      resourceType: 'ChargeItemDefinition',
      status,
      url: `${BASE_CANONICA}/ChargeItemDefinition/${id}`,
      ...alcance,
      propertyGroup: [
        {
          priceComponent: [{ amount: { currency: 'BRL', value: valor }, type: 'base' }],
        },
      ],
    };
  }

  private gerarPrecos(em: number) {
    for (const exame of EXAMES) {
      const status = exame.status === 'retired' ? 'retired' : 'active';
      for (const [ibge, cidade, fator] of [
        ['4314902', 'Porto Alegre', 1],
        ['4304606', 'Canoas', 0.95],
      ] as const) {
        const valor = Math.round(exame.preco * fator * 100) / 100;
        this.gravar(
          this.chargeItemDefinition(
            `${exame.id}-${ibge}`,
            exame,
            valor,
            {
              jurisdiction: [{ coding: [{ code: ibge, display: cidade, system: SISTEMA_IBGE }] }],
            },
            status,
          ),
          em,
        );
      }
    }
    // Preço por unidade: alguns exames na unidade Centro.
    for (const id of ['glicose', 'hemograma']) {
      const exame = this.exame(id)!;
      this.gravar(
        this.chargeItemDefinition(
          `${id}-unidade-centro`,
          exame,
          Math.round(exame.preco * 0.9 * 100) / 100,
          {
            useContext: [
              {
                code: {
                  code: 'venue',
                  system: 'http://terminology.hl7.org/CodeSystem/usage-context-type',
                },
                valueReference: { reference: 'Location/unidade-centro', type: 'Location' },
              },
            ],
          },
          'active',
        ),
        em,
      );
    }
    // Preço por marca e região.
    for (const id of ['glicose', 'colesterol-total']) {
      const exame = this.exame(id)!;
      this.gravar(
        this.chargeItemDefinition(
          `${id}-marca-regiao-sul`,
          exame,
          Math.round(exame.preco * 0.85 * 100) / 100,
          {
            useContext: [
              {
                code: { code: 'brand', system: SISTEMA_CONTEXTO_DE_PRECO },
                valueReference: { ...ORGANIZACAO, type: 'Organization' },
              },
              {
                code: {
                  code: 'venue',
                  system: 'http://terminology.hl7.org/CodeSystem/usage-context-type',
                },
                valueReference: { reference: 'Location/regiao-sul', type: 'Location' },
              },
            ],
          },
          'active',
        ),
        em,
      );
    }
  }

  private gerarUnidades(em: number) {
    // Região de preço: agrupa as unidades de Porto Alegre.
    this.gravar(
      {
        address: { city: 'Porto Alegre', country: 'BR', state: 'RS' },
        id: 'regiao-sul',
        identifier: [{ system: `${BASE_CANONICA}/regioes`, value: 'sul' }],
        managingOrganization: ORGANIZACAO,
        meta: { profile: [perfil('br-lab-location')] },
        mode: 'kind',
        name: 'Laboratório Exemplo, região de preço Sul',
        physicalType: {
          coding: [
            {
              code: 'area',
              display: 'Area',
              system: 'http://terminology.hl7.org/CodeSystem/location-physical-type',
            },
          ],
        },
        position: { latitude: -30.03, longitude: -51.2 },
        resourceType: 'Location',
        status: 'active',
      },
      em,
    );
    for (const u of UNIDADES) {
      this.gravar(
        {
          address: {
            city: u.cidade,
            country: 'BR',
            line: [u.linha],
            postalCode: u.cep,
            state: u.uf,
          },
          hoursOfOperation: [
            {
              closingTime: '17:00:00',
              daysOfWeek: ['mon', 'tue', 'wed', 'thu', 'fri'],
              openingTime: '06:30:00',
            },
            { closingTime: '12:00:00', daysOfWeek: ['sat'], openingTime: '07:00:00' },
          ],
          id: u.id,
          identifier: [
            { system: `${BASE_CANONICA}/unidades`, value: u.id.replace('unidade-', '') },
          ],
          managingOrganization: ORGANIZACAO,
          meta: { profile: [perfil('br-lab-location')] },
          mode: 'instance',
          name: u.nome,
          physicalType: {
            coding: [
              {
                code: 'bu',
                display: 'Building',
                system: 'http://terminology.hl7.org/CodeSystem/location-physical-type',
              },
            ],
          },
          position: { latitude: u.latitude, longitude: u.longitude },
          resourceType: 'Location',
          status: 'active',
          ...(u.cidade === 'Porto Alegre' ? { partOf: { reference: 'Location/regiao-sul' } } : {}),
        },
        em,
      );
      this.gravar(
        {
          active: true,
          availableTime: [
            {
              availableEndTime: '11:00:00',
              availableStartTime: '06:30:00',
              daysOfWeek: ['mon', 'tue', 'wed', 'thu', 'fri'],
            },
          ],
          id: `coleta-${u.id.replace('unidade-', '')}`,
          location: [{ reference: `Location/${u.id}` }],
          meta: { profile: [perfil('br-lab-healthcare-service')] },
          name: 'Coleta de sangue e urina',
          providedBy: ORGANIZACAO,
          resourceType: 'HealthcareService',
        },
        em,
      );
      this.examesPorUnidade.set(
        u.id,
        EXAMES.filter((e) => e.status === 'active' && (!e.unidades || e.unidades.includes(u.id))),
      );
    }
  }

  private readonly diasComHorarios = new Set<string>();
  private contadorDeHorarios = 0;

  /**
   * Agendas e horários: dias úteis do dia seguinte até 21 dias à frente do
   * relógio do provedor, de 15 em 15 minutos. Chamada de novo quando o relógio
   * anda, para que a agenda acompanhe o tempo simulado.
   */
  garantirAgendas(agoraMs: number) {
    const ref = new Date(agoraMs - 3 * 3600_000); // data local
    const dias: Array<{ ano: number; mes: number; dia: number }> = [];
    for (let d = 1; d <= 21; d++) {
      const data = new Date(
        Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate() + d),
      );
      const dow = data.getUTCDay();
      if (dow === 0 || dow === 6) continue;
      dias.push({
        ano: data.getUTCFullYear(),
        dia: data.getUTCDate(),
        mes: data.getUTCMonth() + 1,
      });
    }
    const chave = (d: { ano: number; mes: number; dia: number }) =>
      `${d.ano}${String(d.mes).padStart(2, '0')}${String(d.dia).padStart(2, '0')}`;
    const novos = dias.filter((d) => !this.diasComHorarios.has(chave(d)));
    if (novos.length === 0) return;
    const primeiro = dias[0]!;
    const ultimo = dias[dias.length - 1]!;
    for (const u of UNIDADES) {
      const sufixo = u.id.replace('unidade-', '');
      const agendaId = `agenda-${sufixo}`;
      const agenda: Recurso = {
        active: true,
        actor: [
          { display: u.nome, reference: `Location/${u.id}`, type: 'Location' },
          { reference: `HealthcareService/coleta-${sufixo}`, type: 'HealthcareService' },
        ],
        id: agendaId,
        meta: { profile: [perfil('br-lab-schedule')] },
        planningHorizon: {
          end: local(ultimo.ano, ultimo.mes, ultimo.dia, 23, 59).texto,
          start: local(primeiro.ano, primeiro.mes, primeiro.dia, 0, 0).texto,
        },
        resourceType: 'Schedule',
      };
      const existente = this.tipo('Schedule').get(agendaId);
      if (existente) this.atualizar(existente, agenda, agoraMs);
      else this.gravar(agenda, agoraMs - 24 * 3600_000);
      const exames = this.examesPorUnidade.get(u.id) ?? [];
      for (const dia of novos) {
        for (let minutos = 6 * 60 + 30; minutos <= 10 * 60 + 45; minutos += 15) {
          const h = Math.floor(minutos / 60);
          const m = minutos % 60;
          const inicio = local(dia.ano, dia.mes, dia.dia, h, m);
          const fim = local(
            dia.ano,
            dia.mes,
            dia.dia,
            Math.floor((minutos + 15) / 60),
            (minutos + 15) % 60,
          );
          const hhmm = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
          const examesDoHorario = exames.filter((e) => !e.antesDas || hhmm < e.antesDas);
          this.contadorDeHorarios++;
          this.gravar(
            {
              end: fim.texto,
              id: `${agendaId}-${chave(dia)}-${hhmm.replace(':', '')}`,
              meta: { profile: [perfil('br-lab-slot')] },
              resourceType: 'Slot',
              schedule: { reference: `Schedule/${agendaId}` },
              serviceType: examesDoHorario.map((e) => ({
                coding: codingsDoExame(e),
                text: e.titulo,
              })),
              start: inicio.texto,
              status: this.contadorDeHorarios % 7 === 0 ? 'busy' : 'free',
            },
            agoraMs - 24 * 3600_000,
          );
        }
      }
    }
    for (const d of novos) this.diasComHorarios.add(chave(d));
  }

  private paciente(p: Paciente): Recurso {
    const identifier = [];
    if (p.cpf) identifier.push({ system: SISTEMA_CPF, value: p.cpf });
    if (p.cns) identifier.push({ system: SISTEMA_CNS, value: p.cns });
    return {
      birthDate: p.nascimento,
      gender: p.sexo,
      id: p.id,
      identifier,
      meta: { profile: [perfil('br-patient')] },
      name: [{ family: p.nome.family, given: p.nome.given, use: 'official' }],
      resourceType: 'Patient',
    };
  }

  private gerarResultados(em: number) {
    for (const l of LAUDOS) {
      const resultados: string[] = [];
      for (const r of l.resultados) {
        const obsId = `${l.id.replace('laudo-', 'obs-')}-${r.exame}`;
        resultados.push(obsId);
        const faixa: Record<string, unknown> = {};
        if (r.baixo !== undefined)
          faixa.low = { code: r.ucum, system: SISTEMA_UCUM, unit: r.unidade, value: r.baixo };
        if (r.alto !== undefined)
          faixa.high = { code: r.ucum, system: SISTEMA_UCUM, unit: r.unidade, value: r.alto };
        this.gravar(
          {
            category: [
              {
                coding: [
                  {
                    code: 'laboratory',
                    system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                  },
                ],
              },
            ],
            code: {
              coding: [{ code: r.loinc, display: r.nome, system: SISTEMA_LOINC }],
              text: r.nome,
            },
            effectiveDateTime: l.data,
            id: obsId,
            meta: { profile: [perfil('br-lab-observation')] },
            referenceRange: [faixa],
            resourceType: 'Observation',
            status: l.status === 'preliminary' ? 'preliminary' : 'final',
            subject: { reference: `Patient/${l.paciente}` },
            valueQuantity: { code: r.ucum, system: SISTEMA_UCUM, unit: r.unidade, value: r.valor },
          },
          em,
          { liberado: l.liberado, pacienteId: l.paciente },
        );
      }
      this.gravar(
        {
          category: [
            { coding: [{ code: 'LAB', system: 'http://terminology.hl7.org/CodeSystem/v2-0074' }] },
          ],
          code: { coding: [l.codigo], text: l.titulo },
          effectiveDateTime: l.data,
          id: l.id,
          issued: new Date(Date.parse(l.data) + 6 * 3600_000).toISOString(),
          meta: { profile: [perfil('br-diagnostic-report')] },
          performer: [ORGANIZACAO],
          resourceType: 'DiagnosticReport',
          result: resultados.map((id) => ({ reference: `Observation/${id}` })),
          status: l.status,
          subject: { reference: `Patient/${l.paciente}` },
        },
        em,
        { liberado: l.liberado, pacienteId: l.paciente },
      );
    }
  }

  private gerarAgendamentoDeOutroCanal(em: number) {
    // Agendamento feito pelo portal do laboratório: não aparece para receptores.
    const slot = [...this.tipo('Slot').values()].find((s) => s.recurso.status === 'busy');
    if (!slot) return;
    this.gravar(
      {
        basedOn: [{ reference: '#exame-1' }],
        contained: [
          {
            code: { coding: codingsDoExame(this.exame('hemograma')!) },
            id: 'exame-1',
            intent: 'order',
            meta: { profile: [perfil('br-lab-service-request')] },
            resourceType: 'ServiceRequest',
            status: 'active',
            subject: { reference: 'Patient/pac-ana', type: 'Patient' },
          },
        ],
        end: slot.recurso.end,
        id: FIXTURAS.agendamentoDeOutroCanal,
        meta: { profile: [perfil('br-lab-appointment')] },
        participant: [
          { actor: { reference: 'Patient/pac-ana', type: 'Patient' }, status: 'accepted' },
          { actor: { reference: 'Location/unidade-centro', type: 'Location' }, status: 'accepted' },
        ],
        resourceType: 'Appointment',
        slot: [{ reference: `Slot/${slot.recurso.id}` }],
        start: slot.recurso.start,
        status: 'booked',
      },
      em,
      { pacienteId: 'pac-ana' },
    );
  }

  /** Preço do exame na unidade: preço da unidade, senão da marca e região, senão do município. */
  precoNaUnidade(exame: Exame, unidadeId: string): number | undefined {
    const unidade = UNIDADES.find((u) => u.id === unidadeId);
    if (!unidade) return undefined;
    const precos = [...this.tipo('ChargeItemDefinition').values()]
      .map((r) => r.recurso)
      .filter(
        (c) =>
          c.status === 'active' &&
          (c.code as { coding: Array<{ system: string; code: string }> }).coding.some(
            (x) => x.system === SISTEMA_PRODUTOS && x.code === exame.codigoProprio,
          ),
      );
    const valor = (c: Recurso) =>
      (c.propertyGroup as Array<{ priceComponent: Array<{ amount: { value: number } }> }>)[0]!
        .priceComponent[0]!.amount.value;
    const contexto = (c: Recurso) =>
      (c.useContext as Array<{ valueReference?: { reference?: string } }> | undefined) ?? [];
    const daUnidade = precos.find((c) =>
      contexto(c).some((u) => u.valueReference?.reference === `Location/${unidadeId}`),
    );
    if (daUnidade) return valor(daUnidade);
    const regiao = (
      this.tipo('Location').get(unidadeId)?.recurso.partOf as { reference?: string } | undefined
    )?.reference;
    const daRegiao = regiao
      ? precos.find((c) => contexto(c).some((u) => u.valueReference?.reference === regiao))
      : undefined;
    if (daRegiao) return valor(daRegiao);
    const doMunicipio = precos.find((c) =>
      (c.jurisdiction as Array<{ coding: Array<{ code: string }> }> | undefined)?.some((j) =>
        j.coding.some((x) => x.code === unidade.ibge),
      ),
    );
    return doMunicipio ? valor(doMunicipio) : undefined;
  }
}
