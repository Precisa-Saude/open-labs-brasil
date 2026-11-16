// Páginas do paciente no domínio do provedor simulado: login, tela de
// consentimento, erro, pagamento e gestão de consentimentos. São páginas de
// teste e dizem isso em destaque.

import { escaparHtml as e } from './http.ts';
import { PACIENTES, SENHA_DE_TESTE } from './dados.ts';

const TEXTO_DOS_ESCOPOS: Record<string, string> = {
  'appointment.write': 'Agendar, remarcar e cancelar exames em seu nome',
  'results.read': 'Receber os resultados dos seus exames',
  'consent.read': 'Ver as autorizações que você deu a este aplicativo',
};

export function textoDoEscopo(escopo: string): string {
  return TEXTO_DOS_ESCOPOS[escopo] ?? escopo;
}

function pagina(titulo: string, corpo: string): string {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(titulo)} | Laboratório Exemplo (simulado)</title>
<style>
body { font-family: system-ui, sans-serif; max-width: 40rem; margin: 2rem auto; padding: 0 1rem; color: #1b1b1b; }
.teste { background: #fff3cd; border: 2px solid #b8860b; padding: .75rem 1rem; margin-bottom: 1.5rem; }
fieldset { border: 1px solid #ccc; padding: 1rem; }
label { display: block; margin: .5rem 0 .25rem; }
input[type=text], input[type=password] { width: 100%; padding: .4rem; box-sizing: border-box; }
button { margin: 1rem .5rem 0 0; padding: .5rem 1rem; }
table { border-collapse: collapse; width: 100%; } td, th { border: 1px solid #ccc; padding: .3rem .5rem; text-align: left; }
</style>
</head>
<body>
<div class="teste" role="note"><strong>Página de teste.</strong> Este é o servidor de exemplo do Open Labs Brasil. Nenhum laboratório real, nenhum paciente real. Os dados são sintéticos.</div>
${corpo}
</body>
</html>`;
}

function listaDePacientesDeTeste(): string {
  const linhas = PACIENTES.map(
    (p) => `<tr><td><code>${e(p.usuario)}</code></td><td>${e(`${p.nome.given.join(' ')} ${p.nome.family}`)}</td><td>${p.cpf ? 'com CPF' : '<strong>sem CPF</strong>'}</td></tr>`,
  ).join('');
  return `<details><summary>Pacientes sintéticos disponíveis (senha <code>${e(SENHA_DE_TESTE)}</code>)</summary>
<table><thead><tr><th>Usuário</th><th>Nome</th><th>Cadastro</th></tr></thead><tbody>${linhas}</tbody></table></details>`;
}

export function paginaDeLogin(acao: string, campos: Record<string, string>, erro?: string): string {
  const ocultos = Object.entries(campos)
    .map(([k, v]) => `<input type="hidden" name="${e(k)}" value="${e(v)}">`)
    .join('');
  return pagina(
    'Entrar',
    `<h1>Entrar no Laboratório Exemplo</h1>
<p>Use o login do portal do laboratório. A senha é digitada só nesta página, no domínio do laboratório, e não passa pelo aplicativo.</p>
${erro ? `<p role="alert"><strong>${e(erro)}</strong></p>` : ''}
<form method="post" action="${e(acao)}">
${ocultos}
<label for="usuario">Usuário</label><input id="usuario" name="usuario" type="text" autocomplete="username" required>
<label for="senha">Senha</label><input id="senha" name="senha" type="password" autocomplete="current-password" required>
<button type="submit">Entrar</button>
</form>
${listaDePacientesDeTeste()}`,
  );
}

export function telaDeConsentimento(dados: {
  acao: string;
  transacao: string;
  nomeDoReceptor: string;
  escopos: string[];
  finalidade: string;
  expiracao: string;
  nomeDoPaciente: string;
}): string {
  const itens = dados.escopos.map((s) => `<li>${e(textoDoEscopo(s))}</li>`).join('');
  const data = new Date(dados.expiracao).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'long', timeStyle: 'short' });
  return pagina(
    'Autorizar aplicativo',
    `<h1>Autorizar o aplicativo ${e(dados.nomeDoReceptor)}</h1>
<p>Você entrou como ${e(dados.nomeDoPaciente)}.</p>
<p>O aplicativo <strong>${e(dados.nomeDoReceptor)}</strong> pede para:</p>
<ul>${itens}</ul>
<p><strong>Finalidade informada pelo aplicativo:</strong></p>
<blockquote>${e(dados.finalidade)}</blockquote>
<p><strong>Válido até:</strong> ${e(data)} (<time datetime="${e(dados.expiracao)}">${e(dados.expiracao)}</time>)</p>
<p>O laboratório vai confirmar ao aplicativo o CPF de quem está autorizando, para que os dados cheguem à pessoa certa.</p>
<p>Você aprova ou recusa o pedido inteiro. Você pode revogar a autorização depois, aqui no laboratório ou no aplicativo.</p>
<form method="post" action="${e(dados.acao)}">
<input type="hidden" name="transacao" value="${e(dados.transacao)}">
<button type="submit" name="decisao" value="aprovar">Aprovar</button>
<button type="submit" name="decisao" value="recusar">Recusar</button>
</form>`,
  );
}

export function paginaDeErro(mensagem: string): string {
  return pagina('Não foi possível continuar', `<h1>Não foi possível continuar</h1><p>${e(mensagem)}</p><p>Volte ao aplicativo e tente de novo.</p>`);
}

export function paginaDePagamento(acao: string, descricao: string, situacao: string): string {
  return pagina(
    'Pagamento',
    `<h1>Pagamento do agendamento (simulado)</h1>
<p>${e(descricao)}</p>
<p>Situação: <strong>${e(situacao)}</strong></p>
${situacao === 'aguardando pagamento' ? `<form method="post" action="${e(acao)}"><button type="submit" name="acao" value="pagar">Pagar (simulado)</button></form>` : ''}`,
  );
}

export function paginaDeCompartilhamentos(acao: string, sessao: string, nome: string, linhas: Array<{ consentId: string; receptor: string; escopos: string[]; finalidade: string; expiracao: string }>): string {
  const corpo = linhas.length
    ? `<table><thead><tr><th>Aplicativo</th><th>Acesso</th><th>Finalidade</th><th>Válido até</th><th></th></tr></thead><tbody>${linhas
        .map(
          (l) => `<tr><td>${e(l.receptor)}</td><td>${l.escopos.map((s) => e(textoDoEscopo(s))).join('<br>')}</td><td>${e(l.finalidade)}</td><td>${e(l.expiracao)}</td>
<td><form method="post" action="${e(acao)}"><input type="hidden" name="sessao" value="${e(sessao)}"><input type="hidden" name="consent_id" value="${e(l.consentId)}"><button type="submit">Revogar</button></form></td></tr>`,
        )
        .join('')}</tbody></table>`
    : '<p>Nenhum aplicativo tem autorização ativa.</p>';
  return pagina('Compartilhamentos', `<h1>Aplicativos autorizados</h1><p>Olá, ${e(nome)}. Revogar é gratuito e vale na hora.</p>${corpo}`);
}
