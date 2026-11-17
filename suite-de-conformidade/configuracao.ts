// Configuração da suíte de conformidade. Um laboratório aponta a suíte para o
// próprio provedor preenchendo este arquivo: registro e chaves iniciais,
// clientes de teste registrados (chave de assinatura e certificados TLS),
// pacientes de teste e, se tiver, a interface de controle de teste. O formato
// completo está em docs/servidor-e-suite.md.

import { readFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';

export type PapelDoCliente = 'principal' | 'secundario' | 'sentinela' | 'suspenso' | 'retirado';

export interface ParDeCertificado {
  certificado: string;
  chave: string;
}

export interface ClienteConfigurado {
  client_id: string;
  chave_de_assinatura: string;
  jwks_publico?: string;
  certificados: ParDeCertificado[];
}

export interface PacienteDeTeste {
  usuario: string;
  senha?: string;
  cpf?: string;
  fhir_id?: string;
  laudos_nao_liberados?: string[];
  laudo_antigo?: { id: string; data: string };
  laudo_para_retificar?: string;
  agendamento_de_outro_canal?: string;
}

export interface ConfiguracaoDaSuite {
  base: string;
  registro: {
    documento: string;
    assinatura: string;
    chaves_iniciais: string;
    ambiente: 'pilot' | 'production';
    /** Chave privada que assina o registro de teste. Sem ela, os testes de candidatos do registro não rodam. */
    chave_privada_para_candidatos?: string;
    /** Caminho em que a hospedagem publica o registro que o provedor busca. */
    caminho_de_publicacao?: string;
  };
  provedor: { participant_id: string; ca_confiavel?: string };
  hospedagem?: { endereco_de_escuta: string; porta: number; certificado: string; chave: string };
  clientes: Partial<Record<PapelDoCliente, ClienteConfigurado>> & { principal: ClienteConfigurado };
  certificado_nao_registrado?: ParDeCertificado;
  pacientes: { principal: PacienteDeTeste; outro?: PacienteDeTeste; sem_cpf?: PacienteDeTeste; cpf_invalido?: PacienteDeTeste };
  agenda?: {
    unidade?: string;
    exame_comum?: string;
    exame_restrito?: string;
    exame_indisponivel?: { unidade: string; exame: string };
    /** Prazo do provedor para o pagamento, em minutos. Sem ele, AGD-008 adianta o relógio em 24 horas. */
    prazo_de_pagamento_minutos?: number;
  };
  catalogo?: { item_para_retirar?: string };
  controle_de_teste?: { url: string; token: string };
  /**
   * Jornada do paciente pelas páginas reais do provedor, quando login e
   * consentimento são formulários HTML simples (sem JavaScript). Tem
   * precedência sobre a interface de controle para concluir a jornada.
   */
  jornada_por_formulario?: { campo_usuario: string; campo_senha: string; campo_decisao: string; valor_aprovar: string; valor_recusar: string };
}

export function lerConfiguracaoDaSuite(caminho: string): ConfiguracaoDaSuite {
  const base = dirname(resolve(caminho));
  const cfg = JSON.parse(readFileSync(caminho, 'utf8')) as Omit<ConfiguracaoDaSuite, 'base'>;
  return { ...cfg, base };
}

/** Resolve um caminho da configuração em relação à pasta do arquivo. */
export function caminhoDe(cfg: ConfiguracaoDaSuite, p: string): string {
  return isAbsolute(p) ? p : resolve(cfg.base, p);
}

export function lerArquivo(cfg: ConfiguracaoDaSuite, p: string): Buffer {
  return readFileSync(caminhoDe(cfg, p));
}
