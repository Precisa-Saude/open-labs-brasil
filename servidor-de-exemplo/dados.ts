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
export const ORGANIZACAO = { reference: 'Organization/laboratorio-exemplo', display: 'Laboratório Exemplo (simulado)' };

export type Recurso = Record<string, unknown> & { resourceType: string; id: string };

export interface Registro {
  recurso: Recurso;
  versao: number;
  atualizadoEm: number;
  /** Paciente dono do recurso, para recursos de paciente. */
  pacienteId?: string;
  /** Laudo liberado ao paciente nos canais do provedor. */
  liberado?: boolean;
  /** client_id do receptor que criou o agendamento pelo protocolo. Ausente: outro canal. */
  donoClientId?: string;
}

export interface Unidade {
  id: string;
  nome: string;
  cidade: string;
  ibge: string;
  uf: string;
  cep: string;
  linha: string;
  latitude: number;
  longitude: number;
}

export const UNIDADES: Unidade[] = [
  { id: 'unidade-centro', nome: 'Laboratório Exemplo, unidade Centro', cidade: 'Porto Alegre', ibge: '4314902', uf: 'RS', cep: '90010-000', linha: 'Rua Exemplo, 100', latitude: -30.03, longitude: -51.23 },
  { id: 'unidade-zona-norte', nome: 'Laboratório Exemplo, unidade Zona Norte', cidade: 'Porto Alegre', ibge: '4314902', uf: 'RS', cep: '91000-000', linha: 'Avenida Fictícia, 2000', latitude: -30.0, longitude: -51.18 },
  { id: 'unidade-canoas', nome: 'Laboratório Exemplo, unidade Canoas', cidade: 'Canoas', ibge: '4304606', uf: 'RS', cep: '92000-000', linha: 'Rua Imaginária, 45', latitude: -29.92, longitude: -51.18 },
];

export interface Exame {
  id: string;
  titulo: string;
  loinc?: { code: string; display: string };
  codigoProprio: string;
  status: 'active' | 'retired';
  /** Unidades que coletam o exame. Ausente: todas. */
  unidades?: string[];
  /** Só pode ser coletado em horários que começam antes desta hora local. */
  antesDas?: string;
  /** Preço base em reais por município (código IBGE). */
  preco: number;
}

export const EXAMES: Exame[] = [
  { id: 'glicose', titulo: 'Glicose', loinc: { code: '2345-7', display: 'Glucose [Mass/volume] in Serum or Plasma' }, codigoProprio: 'GLI', status: 'active', preco: 14 },
  { id: 'hemograma', titulo: 'Hemograma completo', loinc: { code: '58410-2', display: 'CBC panel - Blood by Automated count' }, codigoProprio: 'HMG', status: 'active', preco: 22 },
  { id: 'colesterol-total', titulo: 'Colesterol total', loinc: { code: '2093-3', display: 'Cholesterol [Mass/volume] in Serum or Plasma' }, codigoProprio: 'COL', status: 'active', preco: 15 },
  { id: 'colesterol-hdl', titulo: 'Colesterol HDL', loinc: { code: '2085-9', display: 'Cholesterol in HDL [Mass/volume] in Serum or Plasma' }, codigoProprio: 'HDL', status: 'active', preco: 16 },
  { id: 'colesterol-ldl', titulo: 'Colesterol LDL (calculado)', loinc: { code: '13457-7', display: 'Cholesterol in LDL [Mass/volume] in Serum or Plasma by calculation' }, codigoProprio: 'LDL', status: 'active', preco: 16 },
  { id: 'triglicerideos', titulo: 'Triglicerídeos', loinc: { code: '2571-8', display: 'Triglyceride [Mass/volume] in Serum or Plasma' }, codigoProprio: 'TRI', status: 'active', preco: 15 },
  { id: 'creatinina', titulo: 'Creatinina', loinc: { code: '2160-0', display: 'Creatinine [Mass/volume] in Serum or Plasma' }, codigoProprio: 'CRE', status: 'active', preco: 13 },
  { id: 'tsh', titulo: 'TSH (hormônio tireoestimulante)', loinc: { code: '3016-3', display: 'Thyrotropin [Units/volume] in Serum or Plasma' }, codigoProprio: 'TSH', status: 'active', preco: 35 },
  { id: 't4-livre', titulo: 'T4 livre', loinc: { code: '3024-7', display: 'Thyroxine (T4) free [Mass/volume] in Serum or Plasma' }, codigoProprio: 'T4L', status: 'active', preco: 33 },
  { id: 'hemoglobina-glicada', titulo: 'Hemoglobina glicada (HbA1c)', loinc: { code: '4548-4', display: 'Hemoglobin A1c/Hemoglobin.total in Blood' }, codigoProprio: 'HBA1C', status: 'active', preco: 28 },
  { id: 'acido-urico', titulo: 'Ácido úrico', loinc: { code: '3084-1', display: 'Urate [Mass/volume] in Serum or Plasma' }, codigoProprio: 'AUR', status: 'active', preco: 14 },
  { id: 'tgo', titulo: 'TGO (AST)', loinc: { code: '1920-8', display: 'Aspartate aminotransferase [Enzymatic activity/volume] in Serum or Plasma' }, codigoProprio: 'TGO', status: 'active', preco: 14 },
  { id: 'tgp', titulo: 'TGP (ALT)', loinc: { code: '1742-6', display: 'Alanine aminotransferase [Enzymatic activity/volume] in Serum or Plasma' }, codigoProprio: 'TGP', status: 'active', preco: 14 },
  { id: 'gama-gt', titulo: 'Gama GT', loinc: { code: '2324-2', display: 'Gamma glutamyl transferase [Enzymatic activity/volume] in Serum or Plasma' }, codigoProprio: 'GGT', status: 'active', preco: 16 },
  { id: 'ferritina', titulo: 'Ferritina', loinc: { code: '2276-4', display: 'Ferritin [Mass/volume] in Serum or Plasma' }, codigoProprio: 'FER', status: 'active', preco: 38 },
  { id: 'vitamina-b12', titulo: 'Vitamina B12', loinc: { code: '2132-9', display: 'Cobalamin (Vitamin B12) [Mass/volume] in Serum or Plasma' }, codigoProprio: 'B12', status: 'active', preco: 42 },
  { id: 'proteina-c-reativa', titulo: 'Proteína C reativa', loinc: { code: '1988-5', display: 'C reactive protein [Mass/volume] in Serum or Plasma' }, codigoProprio: 'PCR', status: 'active', preco: 25 },
  { id: 'insulina', titulo: 'Insulina', loinc: { code: '20448-7', display: 'Insulin [Units/volume] in Serum or Plasma' }, codigoProprio: 'INS', status: 'active', preco: 36 },
  { id: 'potassio', titulo: 'Potássio', loinc: { code: '2823-3', display: 'Potassium [Moles/volume] in Serum or Plasma' }, codigoProprio: 'K', status: 'active', preco: 12 },
  { id: 'sodio', titulo: 'Sódio', loinc: { code: '2951-2', display: 'Sodium [Moles/volume] in Serum or Plasma' }, codigoProprio: 'NA', status: 'active', preco: 12 },
  { id: 'psa', titulo: 'PSA total', loinc: { code: '2857-1', display: 'Prostate specific Ag [Mass/volume] in Serum or Plasma' }, codigoProprio: 'PSA', status: 'active', preco: 40 },
  { id: 'urina-tipo-1', titulo: 'Urina tipo 1 (EAS)', loinc: { code: '24356-8', display: 'Urinalysis complete panel - Urine' }, codigoProprio: 'EAS', status: 'active', preco: 18 },
  // Sem LOINC: combo, curva com horário restrito, exame só em uma unidade, item gratuito.
  { id: 'curva-glicemica', titulo: 'Curva glicêmica (TOTG 75 g)', codigoProprio: 'TOTG', status: 'active', antesDas: '08:00', preco: 45 },
  { id: 'espermograma', titulo: 'Espermograma', codigoProprio: 'ESP', status: 'active', unidades: ['unidade-centro'], preco: 90 },
  { id: 'combo-check-up', titulo: 'Combo check-up básico', codigoProprio: 'COMBO-CHECKUP', status: 'active', preco: 99 },
  { id: 'glicemia-capilar-campanha', titulo: 'Glicemia capilar (campanha, sem custo)', codigoProprio: 'GLICAP', status: 'active', preco: 0 },
  // Retirado: continua legível com status retired.
  { id: 'mucoproteinas', titulo: 'Mucoproteínas (descontinuado)', codigoProprio: 'MUCO', status: 'retired', preco: 20 },
];

export function codingsDoExame(exame: Exame): Array<{ system: string; code: string; display: string }> {
  const lista: Array<{ system: string; code: string; display: string }> = [];
  if (exame.loinc) lista.push({ system: SISTEMA_LOINC, code: exame.loinc.code, display: exame.loinc.display });
  lista.push({ system: SISTEMA_PRODUTOS, code: exame.codigoProprio, display: exame.titulo });
  return lista;
}

export interface Paciente {
  id: string;
  usuario: string;
  nome: { given: string[]; family: string };
  cpf?: string;
  cns?: string;
  nascimento: string;
  sexo: 'female' | 'male';
}

export const SENHA_DE_TESTE = 'teste';

export const PACIENTES: Paciente[] = [
  { id: 'pac-ana', usuario: 'ana', nome: { given: ['Ana'], family: 'Exemplo Sintética' }, cpf: completarCpf('529982247'), nascimento: '1985-04-12', sexo: 'female' },
  { id: 'pac-bruno', usuario: 'bruno', nome: { given: ['Bruno'], family: 'Exemplo Sintético' }, cpf: completarCpf('111444777'), nascimento: '1979-09-30', sexo: 'male' },
  { id: 'pac-carla', usuario: 'carla', nome: { given: ['Carla'], family: 'Sem CPF Sintética' }, cns: completarCnsProvisorio('89800000000001'), nascimento: '1992-01-20', sexo: 'female' },
];

/** Identificadores que a configuração da suíte usa para os testes de resultados e agendamento. */
export const FIXTURAS = {
  laudosNaoLiberados: ['laudo-ana-2026-parcial', 'laudo-ana-2026-retido'],
  laudoAntigo: { id: 'laudo-ana-2020-glicemia', data: '2020-03-10' },
  laudoParaRetificar: 'laudo-ana-2026-rotina',
  agendamentoDeOutroCanal: 'ag-outro-canal-ana',
  unidadeDosTestes: 'unidade-centro',
  exameComum: `${SISTEMA_LOINC}|2345-7`,
  exameRestrito: `${SISTEMA_PRODUTOS}|TOTG`,
  exameIndisponivel: { unidade: 'unidade-canoas', exame: `${SISTEMA_PRODUTOS}|ESP` },
};

interface ResultadoSintetico {
  exame: string;
  loinc: string;
  nome: string;
  valor: number;
  unidade: string;
  ucum: string;
  baixo?: number;
  alto?: number;
}

interface LaudoSintetico {
  id: string;
  paciente: string;
  data: string;
  status: 'final' | 'amended' | 'corrected' | 'preliminary';
  liberado: boolean;
  titulo: string;
  codigo: { system: string; code: string; display: string };
  resultados: ResultadoSintetico[];
}

const LAUDOS: LaudoSintetico[] = [
  {
    id: 'laudo-ana-2020-glicemia', paciente: 'pac-ana', data: '2020-03-10T08:10:00-03:00', status: 'final', liberado: true,
    titulo: 'Glicemia de jejum', codigo: { system: SISTEMA_LOINC, code: '2345-7', display: 'Glucose [Mass/volume] in Serum or Plasma' },
    resultados: [{ exame: 'glicose', loinc: '2345-7', nome: 'Glicose', valor: 91, unidade: 'mg/dL', ucum: 'mg/dL', baixo: 70, alto: 99 }],
  },
  {
    id: 'laudo-ana-2024-lipidograma', paciente: 'pac-ana', data: '2024-05-20T07:40:00-03:00', status: 'final', liberado: true,
    titulo: 'Perfil lipídico', codigo: { system: SISTEMA_PRODUTOS, code: 'PERFIL-LIPIDICO', display: 'Perfil lipídico' },
    resultados: [
      { exame: 'col', loinc: '2093-3', nome: 'Colesterol total', valor: 182, unidade: 'mg/dL', ucum: 'mg/dL', alto: 190 },
      { exame: 'hdl', loinc: '2085-9', nome: 'Colesterol HDL', valor: 58, unidade: 'mg/dL', ucum: 'mg/dL', baixo: 40 },
      { exame: 'tri', loinc: '2571-8', nome: 'Triglicerídeos', valor: 110, unidade: 'mg/dL', ucum: 'mg/dL', alto: 150 },
    ],
  },
  {
    id: 'laudo-ana-2025-tireoide', paciente: 'pac-ana', data: '2025-08-02T08:00:00-03:00', status: 'amended', liberado: true,
    titulo: 'TSH', codigo: { system: SISTEMA_LOINC, code: '3016-3', display: 'Thyrotropin [Units/volume] in Serum or Plasma' },
    resultados: [{ exame: 'tsh', loinc: '3016-3', nome: 'TSH', valor: 2.1, unidade: 'mUI/L', ucum: 'm[IU]/L', baixo: 0.4, alto: 4.5 }],
  },
  {
    id: 'laudo-ana-2026-rotina', paciente: 'pac-ana', data: '2026-10-01T07:30:00-03:00', status: 'final', liberado: true,
    titulo: 'Exames de rotina', codigo: { system: SISTEMA_PRODUTOS, code: 'ROTINA', display: 'Exames de rotina' },
    resultados: [
      { exame: 'gli', loinc: '2345-7', nome: 'Glicose', valor: 96, unidade: 'mg/dL', ucum: 'mg/dL', baixo: 70, alto: 99 },
      { exame: 'hba1c', loinc: '4548-4', nome: 'Hemoglobina glicada', valor: 5.4, unidade: '%', ucum: '%', alto: 5.7 },
      { exame: 'cre', loinc: '2160-0', nome: 'Creatinina', valor: 0.8, unidade: 'mg/dL', ucum: 'mg/dL', baixo: 0.5, alto: 1.1 },
      { exame: 'hb', loinc: '718-7', nome: 'Hemoglobina', valor: 13.6, unidade: 'g/dL', ucum: 'g/dL', baixo: 12, alto: 16 },
    ],
  },
  {
    id: 'laudo-ana-2026-parcial', paciente: 'pac-ana', data: '2026-11-10T07:30:00-03:00', status: 'preliminary', liberado: false,
    titulo: 'Ferritina (parcial)', codigo: { system: SISTEMA_LOINC, code: '2276-4', display: 'Ferritin [Mass/volume] in Serum or Plasma' },
    resultados: [{ exame: 'fer', loinc: '2276-4', nome: 'Ferritina', valor: 85, unidade: 'ng/mL', ucum: 'ng/mL', baixo: 15, alto: 150 }],
  },
  {
    id: 'laudo-ana-2026-retido', paciente: 'pac-ana', data: '2026-11-12T07:30:00-03:00', status: 'final', liberado: false,
    titulo: 'Vitamina B12 (aguardando liberação)', codigo: { system: SISTEMA_LOINC, code: '2132-9', display: 'Cobalamin (Vitamin B12) [Mass/volume] in Serum or Plasma' },
    resultados: [{ exame: 'b12', loinc: '2132-9', nome: 'Vitamina B12', valor: 410, unidade: 'pg/mL', ucum: 'pg/mL', baixo: 200, alto: 900 }],
  },
  {
    id: 'laudo-bruno-2026-glicemia', paciente: 'pac-bruno', data: '2026-09-15T08:05:00-03:00', status: 'final', liberado: true,
    titulo: 'Glicemia de jejum', codigo: { system: SISTEMA_LOINC, code: '2345-7', display: 'Glucose [Mass/volume] in Serum or Plasma' },
    resultados: [{ exame: 'gli', loinc: '2345-7', nome: 'Glicose', valor: 102, unidade: 'mg/dL', ucum: 'mg/dL', baixo: 70, alto: 99 }],
  },
];

/** Data local (fuso de Brasília, UTC-3) com hora, em formato FHIR. */
function local(ano: number, mes: number, dia: number, hora: number, minuto: number): { texto: string; ms: number } {
  const p = (n: number) => String(n).padStart(2, '0');
  return {
    texto: `${ano}-${p(mes)}-${p(dia)}T${p(hora)}:${p(minuto)}:00-03:00`,
    ms: Date.UTC(ano, mes - 1, dia, hora + 3, minuto),
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
    const registro: Registro = { recurso, versao: 1, atualizadoEm: em, ...extra };
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
      resourceType: 'ActivityDefinition',
      id: exame.id,
      meta: { profile: [perfil('br-lab-activity-definition')] },
      url: `${BASE_CANONICA}/ActivityDefinition/${exame.id}`,
      status: exame.status,
      title: exame.titulo,
      kind: 'ServiceRequest',
      code: { coding: codingsDoExame(exame), text: exame.titulo },
    };
  }

  private chargeItemDefinition(id: string, exame: Exame, valor: number, alcance: Record<string, unknown>, status: string): Recurso {
    return {
      resourceType: 'ChargeItemDefinition',
      id,
      meta: { profile: [perfil('br-lab-charge-item-definition')] },
      url: `${BASE_CANONICA}/ChargeItemDefinition/${id}`,
      status,
      code: { coding: codingsDoExame(exame), text: exame.titulo },
      ...alcance,
      propertyGroup: [
        {
          priceComponent: [{ type: 'base', amount: { value: valor, currency: 'BRL' } }],
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
          this.chargeItemDefinition(`${exame.id}-${ibge}`, exame, valor, {
            jurisdiction: [{ coding: [{ system: SISTEMA_IBGE, code: ibge, display: cidade }] }],
          }, status),
          em,
        );
      }
    }
    // Preço por unidade: alguns exames na unidade Centro.
    for (const id of ['glicose', 'hemograma']) {
      const exame = this.exame(id)!;
      this.gravar(
        this.chargeItemDefinition(`${id}-unidade-centro`, exame, Math.round(exame.preco * 0.9 * 100) / 100, {
          useContext: [
            {
              code: { system: 'http://terminology.hl7.org/CodeSystem/usage-context-type', code: 'venue' },
              valueReference: { reference: 'Location/unidade-centro', type: 'Location' },
            },
          ],
        }, 'active'),
        em,
      );
    }
    // Preço por marca e região.
    for (const id of ['glicose', 'colesterol-total']) {
      const exame = this.exame(id)!;
      this.gravar(
        this.chargeItemDefinition(`${id}-marca-regiao-sul`, exame, Math.round(exame.preco * 0.85 * 100) / 100, {
          useContext: [
            {
              code: { system: SISTEMA_CONTEXTO_DE_PRECO, code: 'brand' },
              valueReference: { ...ORGANIZACAO, type: 'Organization' },
            },
            {
              code: { system: 'http://terminology.hl7.org/CodeSystem/usage-context-type', code: 'venue' },
              valueReference: { reference: 'Location/regiao-sul', type: 'Location' },
            },
          ],
        }, 'active'),
        em,
      );
    }
  }

  private gerarUnidades(em: number) {
    // Região de preço: agrupa as unidades de Porto Alegre.
    this.gravar(
      {
        resourceType: 'Location',
        id: 'regiao-sul',
        meta: { profile: [perfil('br-lab-location')] },
        identifier: [{ system: `${BASE_CANONICA}/regioes`, value: 'sul' }],
        status: 'active',
        name: 'Laboratório Exemplo, região de preço Sul',
        mode: 'kind',
        physicalType: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/location-physical-type', code: 'area', display: 'Area' }] },
        address: { city: 'Porto Alegre', state: 'RS', country: 'BR' },
        position: { latitude: -30.03, longitude: -51.2 },
        managingOrganization: ORGANIZACAO,
      },
      em,
    );
    for (const u of UNIDADES) {
      this.gravar(
        {
          resourceType: 'Location',
          id: u.id,
          meta: { profile: [perfil('br-lab-location')] },
          identifier: [{ system: `${BASE_CANONICA}/unidades`, value: u.id.replace('unidade-', '') }],
          status: 'active',
          name: u.nome,
          mode: 'instance',
          physicalType: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/location-physical-type', code: 'bu', display: 'Building' }] },
          address: { line: [u.linha], city: u.cidade, state: u.uf, postalCode: u.cep, country: 'BR' },
          position: { latitude: u.latitude, longitude: u.longitude },
          hoursOfOperation: [
            { daysOfWeek: ['mon', 'tue', 'wed', 'thu', 'fri'], openingTime: '06:30:00', closingTime: '17:00:00' },
            { daysOfWeek: ['sat'], openingTime: '07:00:00', closingTime: '12:00:00' },
          ],
          managingOrganization: ORGANIZACAO,
          ...(u.cidade === 'Porto Alegre' ? { partOf: { reference: 'Location/regiao-sul' } } : {}),
        },
        em,
      );
      this.gravar(
        {
          resourceType: 'HealthcareService',
          id: `coleta-${u.id.replace('unidade-', '')}`,
          meta: { profile: [perfil('br-lab-healthcare-service')] },
          active: true,
          name: 'Coleta de sangue e urina',
          providedBy: ORGANIZACAO,
          location: [{ reference: `Location/${u.id}` }],
          availableTime: [{ daysOfWeek: ['mon', 'tue', 'wed', 'thu', 'fri'], availableStartTime: '06:30:00', availableEndTime: '11:00:00' }],
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
      const data = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate() + d));
      const dow = data.getUTCDay();
      if (dow === 0 || dow === 6) continue;
      dias.push({ ano: data.getUTCFullYear(), mes: data.getUTCMonth() + 1, dia: data.getUTCDate() });
    }
    const chave = (d: { ano: number; mes: number; dia: number }) => `${d.ano}${String(d.mes).padStart(2, '0')}${String(d.dia).padStart(2, '0')}`;
    const novos = dias.filter((d) => !this.diasComHorarios.has(chave(d)));
    if (novos.length === 0) return;
    const primeiro = dias[0]!;
    const ultimo = dias[dias.length - 1]!;
    for (const u of UNIDADES) {
      const sufixo = u.id.replace('unidade-', '');
      const agendaId = `agenda-${sufixo}`;
      const agenda: Recurso = {
        resourceType: 'Schedule',
        id: agendaId,
        meta: { profile: [perfil('br-lab-schedule')] },
        active: true,
        actor: [
          { reference: `Location/${u.id}`, type: 'Location', display: u.nome },
          { reference: `HealthcareService/coleta-${sufixo}`, type: 'HealthcareService' },
        ],
        planningHorizon: { start: local(primeiro.ano, primeiro.mes, primeiro.dia, 0, 0).texto, end: local(ultimo.ano, ultimo.mes, ultimo.dia, 23, 59).texto },
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
          const fim = local(dia.ano, dia.mes, dia.dia, Math.floor((minutos + 15) / 60), (minutos + 15) % 60);
          const hhmm = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
          const examesDoHorario = exames.filter((e) => !e.antesDas || hhmm < e.antesDas);
          this.contadorDeHorarios++;
          this.gravar(
            {
              resourceType: 'Slot',
              id: `${agendaId}-${chave(dia)}-${hhmm.replace(':', '')}`,
              meta: { profile: [perfil('br-lab-slot')] },
              schedule: { reference: `Schedule/${agendaId}` },
              status: this.contadorDeHorarios % 7 === 0 ? 'busy' : 'free',
              start: inicio.texto,
              end: fim.texto,
              serviceType: examesDoHorario.map((e) => ({ coding: codingsDoExame(e), text: e.titulo })),
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
      resourceType: 'Patient',
      id: p.id,
      meta: { profile: [perfil('br-patient')] },
      identifier,
      name: [{ use: 'official', family: p.nome.family, given: p.nome.given }],
      gender: p.sexo,
      birthDate: p.nascimento,
    };
  }

  private gerarResultados(em: number) {
    for (const l of LAUDOS) {
      const resultados: string[] = [];
      for (const r of l.resultados) {
        const obsId = `${l.id.replace('laudo-', 'obs-')}-${r.exame}`;
        resultados.push(obsId);
        const faixa: Record<string, unknown> = {};
        if (r.baixo !== undefined) faixa.low = { value: r.baixo, unit: r.unidade, system: SISTEMA_UCUM, code: r.ucum };
        if (r.alto !== undefined) faixa.high = { value: r.alto, unit: r.unidade, system: SISTEMA_UCUM, code: r.ucum };
        this.gravar(
          {
            resourceType: 'Observation',
            id: obsId,
            meta: { profile: [perfil('br-lab-observation')] },
            status: l.status === 'preliminary' ? 'preliminary' : 'final',
            category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'laboratory' }] }],
            code: { coding: [{ system: SISTEMA_LOINC, code: r.loinc, display: r.nome }], text: r.nome },
            subject: { reference: `Patient/${l.paciente}` },
            effectiveDateTime: l.data,
            valueQuantity: { value: r.valor, unit: r.unidade, system: SISTEMA_UCUM, code: r.ucum },
            referenceRange: [faixa],
          },
          em,
          { pacienteId: l.paciente, liberado: l.liberado },
        );
      }
      this.gravar(
        {
          resourceType: 'DiagnosticReport',
          id: l.id,
          meta: { profile: [perfil('br-diagnostic-report')] },
          status: l.status,
          category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v2-0074', code: 'LAB' }] }],
          code: { coding: [l.codigo], text: l.titulo },
          subject: { reference: `Patient/${l.paciente}` },
          effectiveDateTime: l.data,
          issued: new Date(Date.parse(l.data) + 6 * 3600_000).toISOString(),
          performer: [ORGANIZACAO],
          result: resultados.map((id) => ({ reference: `Observation/${id}` })),
        },
        em,
        { pacienteId: l.paciente, liberado: l.liberado },
      );
    }
  }

  private gerarAgendamentoDeOutroCanal(em: number) {
    // Agendamento feito pelo portal do laboratório: não aparece para receptores.
    const slot = [...this.tipo('Slot').values()].find((s) => s.recurso.status === 'busy');
    if (!slot) return;
    this.gravar(
      {
        resourceType: 'Appointment',
        id: FIXTURAS.agendamentoDeOutroCanal,
        meta: { profile: [perfil('br-lab-appointment')] },
        status: 'booked',
        start: slot.recurso.start,
        end: slot.recurso.end,
        slot: [{ reference: `Slot/${slot.recurso.id}` }],
        contained: [
          {
            resourceType: 'ServiceRequest',
            id: 'exame-1',
            meta: { profile: [perfil('br-lab-service-request')] },
            status: 'active',
            intent: 'order',
            code: { coding: codingsDoExame(this.exame('hemograma')!) },
            subject: { reference: 'Patient/pac-ana', type: 'Patient' },
          },
        ],
        basedOn: [{ reference: '#exame-1' }],
        participant: [
          { actor: { reference: 'Patient/pac-ana', type: 'Patient' }, status: 'accepted' },
          { actor: { reference: 'Location/unidade-centro', type: 'Location' }, status: 'accepted' },
        ],
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
      .filter((c) => c.status === 'active' && (c.code as { coding: Array<{ system: string; code: string }> }).coding.some((x) => x.system === SISTEMA_PRODUTOS && x.code === exame.codigoProprio));
    const valor = (c: Recurso) =>
      ((c.propertyGroup as Array<{ priceComponent: Array<{ amount: { value: number } }> }>)[0]!.priceComponent[0]!.amount.value);
    const contexto = (c: Recurso) => (c.useContext as Array<{ valueReference?: { reference?: string } }> | undefined) ?? [];
    const daUnidade = precos.find((c) => contexto(c).some((u) => u.valueReference?.reference === `Location/${unidadeId}`));
    if (daUnidade) return valor(daUnidade);
    const regiao = (this.tipo('Location').get(unidadeId)?.recurso.partOf as { reference?: string } | undefined)?.reference;
    const daRegiao = regiao ? precos.find((c) => contexto(c).some((u) => u.valueReference?.reference === regiao)) : undefined;
    if (daRegiao) return valor(daRegiao);
    const doMunicipio = precos.find((c) =>
      (c.jurisdiction as Array<{ coding: Array<{ code: string }> }> | undefined)?.some((j) => j.coding.some((x) => x.code === unidade.ibge)),
    );
    return doMunicipio ? valor(doMunicipio) : undefined;
  }
}
