// Configuração do servidor de exemplo, lida de um arquivo JSON. Caminhos
// relativos são resolvidos a partir da pasta do arquivo.

import { readFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';

import { eViolacao, type Violacao } from './violacoes.ts';

export interface ConfiguracaoDoServidor {
  controle: { habilitado: boolean; token: string; enderecoDeEscuta: string };
  enderecoDeEscuta: string;
  /** Limite de chamadas por token de acesso por minuto. 0 desliga. */
  limitePorMinuto: number;
  /** participant_id do provedor no registro. Os endereços vêm do registro. */
  participantId: string;
  portas: { publica: number; mtls: number; controle: number };
  /** Tempo em que o horário fica reservado à espera do pagamento. */
  prazoDePagamentoMinutos: number;
  /** Mensagens de diagnóstico no console. */
  registrarEmLog: boolean;
  registro: {
    arquivo: string;
    assinatura: string;
    chavesIniciais: string;
    /** Endereço HTTPS do registro, consultado periodicamente. Sem ele, o arquivo é relido. */
    url?: string;
    ambiente: 'pilot' | 'production';
    intervaloMinutos: number;
  };
  tls: { certificado: string; chave: string; caConfiavel: string };
  violacoes: Set<Violacao>;
}

interface ArquivoDeConfiguracao {
  controle?: { habilitado?: boolean; token?: string; endereco_de_escuta?: string };
  endereco_de_escuta?: string;
  limite_por_minuto?: number;
  participant_id: string;
  portas?: { publica?: number; mtls?: number; controle?: number };
  prazo_de_pagamento_minutos?: number;
  registro: {
    arquivo: string;
    assinatura: string;
    chaves_iniciais: string;
    url?: string;
    ambiente?: 'pilot' | 'production';
    intervalo_minutos?: number;
  };
  tls: { certificado: string; chave: string; ca_confiavel: string };
  violacoes?: string[];
}

export function lerConfiguracao(
  caminho: string,
  sobreposicao: { violacoes?: string[]; registrarEmLog?: boolean } = {},
): ConfiguracaoDoServidor {
  const base = dirname(resolve(caminho));
  const bruto = JSON.parse(readFileSync(caminho, 'utf8')) as ArquivoDeConfiguracao;
  const r = (p: string) => (isAbsolute(p) ? p : resolve(base, p));
  const violacoes = new Set<Violacao>();
  for (const v of sobreposicao.violacoes ?? bruto.violacoes ?? []) {
    if (!eViolacao(v)) throw new Error(`Violação desconhecida: ${v}`);
    violacoes.add(v);
  }
  return {
    controle: {
      enderecoDeEscuta: bruto.controle?.endereco_de_escuta ?? '127.0.0.1',
      habilitado: bruto.controle?.habilitado ?? false,
      token: bruto.controle?.token ?? '',
    },
    enderecoDeEscuta: bruto.endereco_de_escuta ?? '127.0.0.1',
    limitePorMinuto: bruto.limite_por_minuto ?? 120,
    participantId: bruto.participant_id,
    portas: {
      controle: bruto.portas?.controle ?? 8445,
      mtls: bruto.portas?.mtls ?? 8444,
      publica: bruto.portas?.publica ?? 8443,
    },
    prazoDePagamentoMinutos: bruto.prazo_de_pagamento_minutos ?? 15,
    registrarEmLog: sobreposicao.registrarEmLog ?? true,
    registro: {
      arquivo: r(bruto.registro.arquivo),
      assinatura: r(bruto.registro.assinatura),
      chavesIniciais: r(bruto.registro.chaves_iniciais),
      ...(bruto.registro.url ? { url: bruto.registro.url } : {}),
      ambiente: bruto.registro.ambiente ?? 'pilot',
      intervaloMinutos: bruto.registro.intervalo_minutos ?? 30,
    },
    tls: {
      caConfiavel: r(bruto.tls.ca_confiavel),
      certificado: r(bruto.tls.certificado),
      chave: r(bruto.tls.chave),
    },
    violacoes,
  };
}

/** Relógio do provedor. A interface de controle de teste pode adiantá-lo. */
export class Relogio {
  deslocamentoMs = 0;
  agora(): Date {
    return new Date(Date.now() + this.deslocamentoMs);
  }
  agoraMs(): number {
    return Date.now() + this.deslocamentoMs;
  }
  avancar(segundos: number): void {
    if (!(segundos > 0)) throw new Error('Só é possível adiantar o relógio');
    this.deslocamentoMs += segundos * 1000;
  }
}

/** Data e hora RFC 3339 em UTC, sem fração de segundo. */
export function instante(ms: number | Date): string {
  const d = typeof ms === 'number' ? new Date(ms) : ms;
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
}
