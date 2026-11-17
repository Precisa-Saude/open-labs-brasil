// Executa o servidor de exemplo.
//
//   node servidor-de-exemplo/principal.ts --config ambiente-local/gerado/servidor.config.json
//   node servidor-de-exemplo/principal.ts --config ... --violacao par-sem-pkce
//
// Variáveis de ambiente equivalentes: SERVIDOR_CONFIG, SERVIDOR_VIOLACOES (lista
// separada por vírgula).

import { parseArgs } from 'node:util';
import { lerConfiguracao } from './configuracao.ts';
import { iniciarServidor } from './servidor.ts';
import { VIOLACOES } from './violacoes.ts';

const { values } = parseArgs({
  options: {
    config: { type: 'string' },
    violacao: { type: 'string', multiple: true },
    'listar-violacoes': { type: 'boolean' },
  },
});

if (values['listar-violacoes']) {
  for (const [nome, v] of Object.entries(VIOLACOES)) console.log(`${nome.padEnd(44)} ${v.requisitos.join(', ').padEnd(18)} ${v.descricao}`);
  process.exit(0);
}

const caminho = values.config ?? process.env.SERVIDOR_CONFIG ?? 'ambiente-local/gerado/servidor.config.json';
const violacoes = values.violacao ?? (process.env.SERVIDOR_VIOLACOES ? process.env.SERVIDOR_VIOLACOES.split(',').filter(Boolean) : undefined);
const servidor = await iniciarServidor(lerConfiguracao(caminho, violacoes ? { violacoes } : {}));

const encerrar = () => {
  servidor.fechar().then(() => process.exit(0));
};
process.on('SIGINT', encerrar);
process.on('SIGTERM', encerrar);
