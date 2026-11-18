import type { ReactNode } from 'react';

import type { Linguagem } from '../dados/exemplos';

/**
 * Realce de sintaxe mínimo para os exemplos de HTTP e JSON, sem biblioteca.
 * Cores do tema de código do site do fhir-brasil, sobre o roxo #463C6D: todas
 * passam de 4,5:1 de contraste.
 */
export const COR = {
  chave: '#C8C6F2',
  metodo: '#9EF2E2',
  numero: '#E7B459',
  pontuacao: '#D9D5E6',
  texto: '#E5D7CA',
} as const;

const TOKEN_JSON =
  /("(?:[^"\\]|\\.)*")(\s*:)?|(-?\b\d+(?:\.\d+)?\b)|\b(true|false|null)\b|([{}[\],])/g;

function realcarJson(linha: string): ReactNode[] {
  const pedacos: ReactNode[] = [];
  let ultimo = 0;
  for (const achado of linha.matchAll(TOKEN_JSON)) {
    const [inteiro, texto, doisPontos, numero, literal, pontuacao] = achado;
    const inicio = achado.index;
    if (inicio > ultimo) pedacos.push(linha.slice(ultimo, inicio));
    if (texto) {
      pedacos.push(
        <span key={inicio} style={{ color: doisPontos ? COR.chave : COR.texto }}>
          {texto}
        </span>,
      );
      if (doisPontos) pedacos.push(doisPontos);
    } else if (numero || literal) {
      pedacos.push(
        <span key={inicio} style={{ color: COR.numero }}>
          {numero ?? literal}
        </span>,
      );
    } else if (pontuacao) {
      pedacos.push(
        <span key={inicio} style={{ color: COR.pontuacao }}>
          {pontuacao}
        </span>,
      );
    }
    ultimo = inicio + inteiro.length;
  }
  if (ultimo < linha.length) pedacos.push(linha.slice(ultimo));
  return pedacos;
}

function realcarHttp(linha: string, indice: number): ReactNode[] {
  // Linha de requisição: método, alvo e, às vezes, a versão do HTTP.
  const requisicao = indice === 0 ? linha.match(/^([A-Z]+)( .*)$/) : null;
  if (requisicao) {
    return [
      <span key="metodo" style={{ color: COR.metodo }}>
        {requisicao[1]}
      </span>,
      requisicao[2],
    ];
  }
  // Cabeçalho, como `Host: api.laboratorio.example`.
  const cabecalho = linha.match(/^([A-Za-z-]+)(:)(.*)$/);
  if (cabecalho) {
    return [
      <span key="nome" style={{ color: COR.chave }}>
        {cabecalho[1]}
      </span>,
      cabecalho[2],
      <span key="valor" style={{ color: COR.texto }}>
        {cabecalho[3]}
      </span>,
    ];
  }
  // Campo de formulário, como `&client_id=...`.
  const campo = linha.match(/^(&?)([\w.]+)(=)(.*)$/);
  if (campo) {
    return [
      campo[1],
      <span key="nome" style={{ color: COR.chave }}>
        {campo[2]}
      </span>,
      campo[3],
      <span key="valor" style={{ color: COR.texto }}>
        {campo[4]}
      </span>,
    ];
  }
  return [linha];
}

export function realcar(codigo: string, linguagem: Linguagem): ReactNode {
  return codigo.split('\n').map((linha, i) => (
    <span key={i} className="block min-h-[1.65em]">
      {linguagem === 'json' ? realcarJson(linha) : realcarHttp(linha, i)}
    </span>
  ));
}
