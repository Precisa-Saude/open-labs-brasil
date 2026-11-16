// O registro de participantes do ponto de vista do provedor: documento aceito,
// busca periódica, verificação V1 a V14 e modo restrito (seção 8.3).

import { readFileSync } from 'node:fs';
import { rootCertificates } from 'node:tls';
import {
  baixarRegistro,
  verificarCandidato,
  versaoEfetiva,
  type ChaveDoRegistro,
  type DocumentoAceito,
  type DocumentoDoRegistro,
  type Participante,
  type PassoDeVerificacao,
} from '../comum/registro.ts';
import type { ConfiguracaoDoServidor, Relogio } from './configuracao.ts';

export type ModoDoRegistro = 'normal' | 'restrito' | 'bloqueado';

export interface ResultadoDaRecarga {
  aceito: boolean;
  inalterado?: boolean;
  passo?: PassoDeVerificacao;
  motivo?: string;
  sequencia: number;
}

const SETE_DIAS_MS = 7 * 24 * 3600_000;

export class RegistroDoProvedor {
  readonly cfg: ConfiguracaoDoServidor;
  readonly relogio: Relogio;
  atual: DocumentoAceito;
  ultimaBuscaMs: number;
  aoAceitar: (anterior: DocumentoDoRegistro, novo: DocumentoDoRegistro) => void = () => {};
  aoAvisar: (mensagem: string) => void = () => {};

  private constructor(cfg: ConfiguracaoDoServidor, relogio: Relogio, atual: DocumentoAceito) {
    this.cfg = cfg;
    this.relogio = relogio;
    this.atual = atual;
    this.ultimaBuscaMs = relogio.agoraMs();
  }

  /** Carrega o primeiro documento do arquivo, verificado com o conjunto inicial de chaves. */
  static async carregar(cfg: ConfiguracaoDoServidor, relogio: Relogio): Promise<RegistroDoProvedor> {
    const bytes = new Uint8Array(readFileSync(cfg.registro.arquivo));
    const jws = readFileSync(cfg.registro.assinatura, 'utf8');
    const iniciais = JSON.parse(readFileSync(cfg.registro.chavesIniciais, 'utf8')) as { keys: ChaveDoRegistro[] };
    const r = await verificarCandidato({
      bytes,
      jws,
      chavesConfiaveis: iniciais.keys,
      ambiente: cfg.registro.ambiente,
      agora: relogio.agora(),
    });
    if (!r.aceito) throw new Error(`O registro inicial não passou na verificação: ${r.passo} ${r.motivo}`);
    return new RegistroDoProvedor(cfg, relogio, { documento: r.documento, bytes });
  }

  get documento(): DocumentoDoRegistro {
    return this.atual.documento;
  }

  /** Busca o candidato (V1) e aplica V2 a V14. Mantém o documento atual se o candidato for recusado. */
  async recarregar(): Promise<ResultadoDaRecarga> {
    this.ultimaBuscaMs = this.relogio.agoraMs();
    let bytes: Uint8Array;
    let jws: string;
    if (this.cfg.registro.url) {
      const ca = [...rootCertificates, readFileSync(this.cfg.tls.caConfiavel, 'utf8')];
      const baixado = await baixarRegistro(this.cfg.registro.url, { ca: ca.join('\n') });
      if ('erro' in baixado) {
        this.aoAvisar(`Registro não baixado (${baixado.erro}). Mantido o documento ${this.documento.sequence}.`);
        return { aceito: false, passo: 'V1', motivo: baixado.erro, sequencia: this.documento.sequence };
      }
      bytes = baixado.bytes;
      jws = baixado.jws;
    } else {
      try {
        bytes = new Uint8Array(readFileSync(this.cfg.registro.arquivo));
        jws = readFileSync(this.cfg.registro.assinatura, 'utf8');
      } catch (e) {
        return { aceito: false, passo: 'V1', motivo: (e as Error).message, sequencia: this.documento.sequence };
      }
    }
    const pular: PassoDeVerificacao[] = [];
    if (this.cfg.violacoes.has('registro-sem-conferir-assinatura')) pular.push('V6');
    if (this.cfg.violacoes.has('registro-aceita-sequencia-menor')) pular.push('V9');
    if (this.cfg.violacoes.has('registro-sem-schema')) pular.push('V7');
    if (this.cfg.violacoes.has('registro-sem-conferir-ambiente')) pular.push('V8');
    const r = await verificarCandidato({
      bytes,
      jws,
      chavesConfiaveis: this.documento.registry_keys.keys,
      ambiente: this.cfg.registro.ambiente,
      atual: this.atual,
      agora: this.relogio.agora(),
      pular,
    });
    if (!r.aceito) {
      // Seção 8.3: quem recusa continua com o documento atual e avisa o mantenedor.
      this.aoAvisar(`Candidato recusado no passo ${r.passo}: ${r.motivo}. Avise o mantenedor do registro.`);
      return { aceito: false, passo: r.passo, motivo: r.motivo, sequencia: this.documento.sequence };
    }
    if (r.inalterado) return { aceito: true, inalterado: true, sequencia: this.documento.sequence };
    const anterior = this.documento;
    this.atual = { documento: r.documento, bytes };
    this.aoAceitar(anterior, r.documento);
    return { aceito: true, sequencia: r.documento.sequence };
  }

  /** Busca periódica: chamada a cada poucos segundos, busca se o intervalo passou no relógio do provedor. */
  async talvezRecarregar(): Promise<void> {
    const intervalo = this.cfg.registro.intervaloMinutos * 60_000;
    if (this.relogio.agoraMs() - this.ultimaBuscaMs >= intervalo) await this.recarregar();
  }

  /** Modo de operação conforme a validade do documento atual (seção 8.3, "Documento expirado"). */
  modo(): ModoDoRegistro {
    if (this.cfg.violacoes.has('registro-expirado-sem-modo-restrito')) return 'normal';
    const expiracao = Date.parse(this.documento.expires_at);
    const agora = this.relogio.agoraMs();
    if (agora < expiracao) return 'normal';
    if (agora < expiracao + SETE_DIAS_MS) return 'restrito';
    return 'bloqueado';
  }

  provedor(): Participante {
    const p = this.documento.participants.find((x) => x.participant_id === this.cfg.participantId && x.role === 'provider');
    if (!p?.provider) throw new Error('O provedor não está no registro');
    return p;
  }

  receptor(clientId: string): Participante | undefined {
    return this.documento.participants.find((p) => p.role === 'receiver' && p.receiver?.client_id === clientId);
  }

  /** Receptor dono do certificado, em qualquer situação, com o certificado dentro da validade. */
  receptorDoCertificado(x5t: string): Participante | undefined {
    const agora = this.relogio.agoraMs();
    return this.documento.participants.find(
      (p) =>
        p.role === 'receiver' &&
        p.receiver?.transport_certificates.some(
          (c) => c['x5t#S256'] === x5t && Date.parse(c.not_before) <= agora && agora <= Date.parse(c.not_after),
        ),
    );
  }

  /** O receptor pode ser atendido: ativo e com versão de protocolo efetiva em comum (seção 9.1). */
  receptorAtendivel(receptor: Participante): boolean {
    if (receptor.status !== 'active') return false;
    return versaoEfetiva(this.provedor().protocol_versions, receptor.protocol_versions) !== undefined;
  }
}
