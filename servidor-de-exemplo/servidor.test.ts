// Testes próprios do servidor de exemplo: dados sintéticos contra os perfis e
// as páginas do paciente, que a suíte marca como dependentes de inspeção
// (CNS-008, CNS-023) e aqui são conferidas no HTML.

import { describe, expect, it } from 'vitest';
import { cnsValido, cpfValido } from '../comum/cpf.ts';
import type { Contexto } from '../suite-de-conformidade/contexto.ts';
import { comServidorDeExemplo } from '../suite-de-conformidade/local.ts';
import { conferirPerfil } from '../suite-de-conformidade/requisitos/api.ts';
import { DadosSinteticos, PACIENTES, type Registro } from './dados.ts';

describe('dados sintéticos', () => {
  it('pacientes com CPF ou CNS fictícios de dígitos válidos', () => {
    for (const p of PACIENTES) {
      if (p.cpf) expect(cpfValido(p.cpf)).toBe(true);
      else expect(cnsValido(p.cns!)).toBe(true);
    }
    expect(PACIENTES.some((p) => !p.cpf)).toBe(true);
  });

  it('todo recurso servível declara o perfil e tem as cardinalidades mínimas', () => {
    const dados = new DadosSinteticos(Date.now());
    const servivel = (r: Registro) => r.liberado !== false && !['preliminary'].includes(String(r.recurso.status));
    const problemas: string[] = [];
    let total = 0;
    for (const [, mapa] of dados.recursos) {
      for (const reg of mapa.values()) {
        if (!servivel(reg)) continue;
        total++;
        problemas.push(...conferirPerfil(reg.recurso as never));
      }
    }
    expect(problemas).toEqual([]);
    expect(total).toBeGreaterThan(800);
  });
});

interface Pagina {
  status: number;
  html: string;
  location?: string;
}

async function pedir(ctx: Contexto, url: string, form?: Record<string, string>): Promise<Pagina> {
  const r = await ctx.http.requisitar(url, {
    metodo: form ? 'POST' : 'GET',
    credencial: null,
    ...(form ? { cabecalhos: { 'content-type': 'application/x-www-form-urlencoded' }, corpo: new URLSearchParams(form).toString() } : {}),
  });
  const location = r.cabecalhos.location;
  return { status: r.status, html: r.texto, ...(typeof location === 'string' ? { location } : {}) };
}

function formulario(html: string, base: string): { acao: string; campos: Record<string, string> } {
  const acao = /<form method="post" action="([^"]+)"/.exec(html)![1]!;
  const campos: Record<string, string> = {};
  for (const m of html.matchAll(/<input type="hidden" name="([^"]+)" value="([^"]*)">/g)) campos[m[1]!] = m[2]!;
  return { acao: new URL(acao, base).toString(), campos };
}

async function abrirJornada(ctx: Contexto): Promise<{ url: string; consentId: string; state: string }> {
  const c = ctx.cliente('principal');
  const consentId = await ctx.novoConsentimento(c);
  const { resposta, state } = await ctx.par(c, consentId);
  const ru = (resposta.json as { request_uri: string }).request_uri;
  return { url: ctx.urlDeAutorizacao(c.clientId, ru), consentId, state };
}

describe('páginas do paciente', () => {
  it('tela de consentimento com receptor, escopos, finalidade, validade e aviso do CPF; recusa com access_denied e iss', async () => {
    await comServidorDeExemplo(async (ctx) => {
      const { url, consentId, state } = await abrirJornada(ctx);
      const login = await pedir(ctx, url);
      expect(login.status).toBe(200);
      expect(login.html).toContain('Página de teste');
      const f = formulario(login.html, url);
      const tela = await pedir(ctx, f.acao, { ...f.campos, usuario: 'ana', senha: 'teste' });
      for (const texto of [
        'Aplicativo de Teste A',
        'Agendar, remarcar e cancelar exames em seu nome',
        'Receber os resultados dos seus exames',
        'Ver as autorizações que você deu a este aplicativo',
        'Teste de conformidade do Open Labs Brasil com dados sintéticos.',
        'Válido até',
        'O laboratório vai confirmar ao aplicativo o CPF de quem está autorizando',
        'Página de teste',
      ]) expect(tela.html).toContain(texto);
      const f2 = formulario(tela.html, url);
      const fim = await pedir(ctx, f2.acao, { ...f2.campos, decisao: 'recusar' });
      expect(fim.status).toBe(303);
      const retorno = new URL(fim.location!);
      expect(retorno.searchParams.get('error')).toBe('access_denied');
      expect(retorno.searchParams.get('iss')).toBe(ctx.issuer);
      expect(retorno.searchParams.get('state')).toBe(state);
      const c = (await ctx.lerConsentimento(ctx.cliente('principal'), consentId)).json as { status: string };
      expect(c.status).toBe('REJECTED');
    });
  });

  it('senha errada fica na página do laboratório; paciente sem CPF recebe access_denied', async () => {
    await comServidorDeExemplo(async (ctx) => {
      const { url, consentId } = await abrirJornada(ctx);
      const login = await pedir(ctx, url);
      const f = formulario(login.html, url);
      const errada = await pedir(ctx, f.acao, { ...f.campos, usuario: 'ana', senha: 'errada' });
      expect(errada.status).toBe(200);
      expect(errada.html).toContain('Usuário ou senha incorretos.');
      const semCpf = await pedir(ctx, f.acao, { ...f.campos, usuario: 'carla', senha: 'teste' });
      expect(semCpf.status).toBe(303);
      expect(new URL(semCpf.location!).searchParams.get('error')).toBe('access_denied');
      const c = (await ctx.lerConsentimento(ctx.cliente('principal'), consentId)).json as { status: string; status_reason: { code: string } };
      expect(c.status_reason.code).toBe('PATIENT_WITHOUT_CPF');
    });
  });

  it('página de compartilhamentos lista e revoga consentimentos AUTHORISED', async () => {
    await comServidorDeExemplo(async (ctx) => {
      const c = ctx.cliente('principal');
      const a = await ctx.autorizar(c);
      const uri = ctx.provedor.provider!.consent_management_uri;
      const login = await pedir(ctx, uri);
      const f = formulario(login.html, uri);
      const lista = await pedir(ctx, f.acao, { ...f.campos, usuario: 'ana', senha: 'teste' });
      expect(lista.html).toContain('Aplicativo de Teste A');
      expect(lista.html).toContain(a.consentId);
      const sessao = /name="sessao" value="([^"]+)"/.exec(lista.html)![1]!;
      const depois = await pedir(ctx, new URL(`${new URL(uri).pathname}/revogar`, uri).toString(), { sessao, consent_id: a.consentId });
      expect(depois.html).not.toContain(a.consentId);
      const lido = (await ctx.lerConsentimento(c, a.consentId)).json as { status: string; status_reason: { code: string; ended_via: string } };
      expect(lido.status).toBe('REVOKED');
      expect(lido.status_reason).toMatchObject({ code: 'PATIENT_REQUEST', ended_via: 'PROVIDER' });
    });
  });
});
