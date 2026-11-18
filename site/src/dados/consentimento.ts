import escopos from '../../../especificacao/03-escopos.md?raw';
import api from '../../../especificacao/05-api.md?raw';
import registro from '../../../especificacao/registro/participantes.exemplo.json';

/**
 * Dados da tela de consentimento desenhada na abertura, lidos na compilação
 * dos exemplos da especificação: nome e endereço do laboratório no registro de exemplo,
 * textos dos escopos da seção 3.4, finalidade e validade do exemplo da seção
 * 5.4.1. São os elementos que a seção 4.4 manda a tela mostrar. Se algum
 * sumir, a compilação falha.
 */

function exigir<T>(valor: T | null | undefined, descricao: string): T {
  if (valor === null || valor === undefined) {
    throw new Error(`Não achei ${descricao}. O exemplo da especificação mudou?`);
  }
  return valor;
}

const provedor = exigir(
  registro.participants.find((p) => p.role === 'provider'),
  'o provedor no registro de exemplo',
);

/** Linhas da tabela da seção 3.4: escopo entre crases e o texto sugerido. */
const textosDosEscopos = new Map(
  [
    ...exigir(
      escopos.match(/## 3\.4[\s\S]*?(?=\n## )/)?.[0],
      'a seção 3.4 em especificacao/03-escopos.md',
    ).matchAll(/^\| `([a-z.]+)` \| ([^|]+?) \|$/gm),
  ].map(([, escopo, texto]) => [escopo!, texto!]),
);

const pedido = JSON.parse(
  exigir(
    api.match(/### 5\.4\.1[\s\S]*?```json\n([\s\S]*?)\n```/)?.[1],
    'o exemplo de criação na seção 5.4.1 de especificacao/05-api.md',
  ),
) as { expiration_date_time: string; purpose: string; scopes: string[] };

export const TELA_DE_CONSENTIMENTO = {
  /** O que o paciente vê como endereço: o servidor de autorização do laboratório. */
  endereco: new URL(
    exigir('provider' in provedor ? provedor.provider?.issuer : undefined, 'o issuer do provedor'),
  ).host,
  escopos: pedido.scopes.map((escopo) =>
    exigir(textosDosEscopos.get(escopo), `o texto do escopo ${escopo} na seção 3.4`),
  ),
  finalidade: pedido.purpose,
  laboratorio: provedor.display_name,
  validade: new Date(pedido.expiration_date_time).toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
  }),
};
