// Interface de controle de teste. Não faz parte do protocolo: é o que a suíte
// de conformidade usa para fazer, num ambiente de homologação, o que a
// especificação descreve como "no ambiente de teste" (adiantar o relógio,
// concluir a jornada do paciente, pagar, retirar um item do catálogo, retificar
// um laudo, recarregar o registro). Escuta só em HTTP local e exige um token.
// O formato está em docs/servidor-e-suite.md.

import { timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

import { confirmarPagamento } from './agendamento.ts';
import {
  autenticarPaciente,
  concluirAutorizacao,
  ErroDePagina,
  iniciarAutorizacaoPorControle,
} from './autorizacao.ts';
import { instante } from './configuracao.ts';
import { PACIENTES } from './dados.ts';
import { enviarJson, lerCorpo } from './http.ts';
import type { Provedor } from './provedor.ts';

function autorizado(provedor: Provedor, req: IncomingMessage): boolean {
  const esperado = Buffer.from(`Bearer ${provedor.cfg.controle.token}`);
  const recebido = Buffer.from(req.headers.authorization ?? '');
  return (
    provedor.cfg.controle.token.length > 0 &&
    esperado.length === recebido.length &&
    timingSafeEqual(esperado, recebido)
  );
}

export async function tratarControle(
  provedor: Provedor,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  if (!autorizado(provedor, req))
    return enviarJson(res, 401, { erro: 'token de controle ausente ou inválido' });
  const url = new URL(req.url ?? '/', 'http://controle');
  let corpo: Record<string, unknown> = {};
  if (req.method === 'POST') {
    const bruto = await lerCorpo(req);
    if (bruto.length) {
      try {
        corpo = JSON.parse(bruto.toString('utf8')) as Record<string, unknown>;
      } catch {
        return enviarJson(res, 400, { erro: 'corpo não é JSON' });
      }
    }
  }
  const texto = (k: string) => (typeof corpo[k] === 'string' ? (corpo[k] as string) : '');
  const estado = () => ({
    agora: instante(provedor.relogio.agora()),
    agora_ms: provedor.relogio.agoraMs(),
    modo_do_registro: provedor.registro.modo(),
    registro_expira_em: provedor.registro.documento.expires_at,
    sequencia_do_registro: provedor.registro.documento.sequence,
  });

  switch (`${req.method} ${url.pathname}`) {
    case 'GET /_controle/estado':
      return enviarJson(res, 200, estado());

    case 'POST /_controle/relogio': {
      const s = Number(corpo.avancar_segundos);
      if (!(s > 0)) return enviarJson(res, 400, { erro: 'avancar_segundos precisa ser positivo' });
      provedor.relogio.avancar(s);
      provedor.varrer();
      return enviarJson(res, 200, estado());
    }

    case 'POST /_controle/registro/recarregar': {
      const r = await provedor.registro.recarregar();
      return enviarJson(res, 200, { ...r, ...estado() });
    }

    case 'POST /_controle/jornada': {
      // Faz o papel do paciente: login e decisão na tela de consentimento.
      const paciente = PACIENTES.find((p) => p.usuario === texto('usuario'));
      const decisao = texto('decisao') || 'aprovar';
      if (!paciente || !autenticarPaciente(paciente.usuario, texto('senha') || 'teste'))
        return enviarJson(res, 400, { erro: 'paciente de teste desconhecido' });
      if (decisao !== 'aprovar' && decisao !== 'recusar')
        return enviarJson(res, 400, { erro: 'decisao precisa ser aprovar ou recusar' });
      try {
        const par = iniciarAutorizacaoPorControle(
          provedor,
          texto('client_id'),
          texto('request_uri'),
        );
        const r = concluirAutorizacao(provedor, par, paciente, decisao);
        return enviarJson(res, 200, { location: r.location, status: r.status });
      } catch (e) {
        if (e instanceof ErroDePagina)
          return enviarJson(res, 200, { pagina_de_erro: e.message, status: 400 });
        throw e;
      }
    }

    case 'POST /_controle/indisponibilidade':
      provedor.emManutencao = corpo.ativo === true;
      return enviarJson(res, 200, { em_manutencao: provedor.emManutencao });

    case 'POST /_controle/revogar-pelo-paciente':
      return enviarJson(res, provedor.revogarPeloPaciente(texto('consent_id')) ? 200 : 404, {});

    case 'POST /_controle/pagamento':
      return enviarJson(res, confirmarPagamento(provedor, texto('appointment_id')) ? 200 : 404, {});

    case 'POST /_controle/catalogo/retirar': {
      const reg = provedor.dados.tipo('ActivityDefinition').get(texto('id'));
      if (!reg) return enviarJson(res, 404, {});
      provedor.dados.atualizar(
        reg,
        { ...reg.recurso, status: 'retired' },
        provedor.relogio.agoraMs(),
      );
      return enviarJson(res, 200, { last_updated: new Date(reg.atualizadoEm).toISOString() });
    }

    case 'POST /_controle/resultados/retificar': {
      const reg = provedor.dados.tipo('DiagnosticReport').get(texto('id'));
      if (!reg) return enviarJson(res, 404, {});
      provedor.dados.atualizar(
        reg,
        { ...reg.recurso, conclusion: 'Laudo retificado (simulado).', status: 'corrected' },
        provedor.relogio.agoraMs(),
      );
      return enviarJson(res, 200, {
        last_updated: new Date(reg.atualizadoEm).toISOString(),
        version_id: String(reg.versao),
      });
    }

    default:
      return enviarJson(res, 404, { erro: 'operação de controle desconhecida' });
  }
}
