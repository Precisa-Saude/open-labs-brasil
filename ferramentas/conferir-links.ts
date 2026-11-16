// Confere que todo link relativo dos arquivos Markdown do repositório aponta
// para um arquivo que existe, e que âncoras para arquivos Markdown existem
// como título no destino. Links externos (http, https, mailto) não são
// seguidos.
//
//   node ferramentas/conferir-links.ts

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const RAIZ = resolve(dirname(new URL(import.meta.url).pathname), '..');
const IGNORAR = new Set(['node_modules', '.git', 'gerado', 'relatorios']);

function markdowns(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    if (IGNORAR.has(nome)) return [];
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) return markdowns(caminho);
    return nome.endsWith('.md') ? [caminho] : [];
  });
}

/** Âncora no estilo do GitHub para um título. */
function ancora(titulo: string): string {
  return titulo
    .trim()
    .toLowerCase()
    .replace(/[`*_]/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s/g, '-');
}

function ancorasDe(arquivo: string): Set<string> {
  const texto = readFileSync(arquivo, 'utf8').replace(/```[\s\S]*?```/g, '');
  return new Set([...texto.matchAll(/^#{1,6} (.+)$/gm)].map((m) => ancora(m[1]!)));
}

const problemas: string[] = [];
let conferidos = 0;
for (const arquivo of markdowns(RAIZ)) {
  const texto = readFileSync(arquivo, 'utf8').replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
  for (const m of texto.matchAll(/\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
    const alvo = m[1]!;
    if (/^(https?:|mailto:)/.test(alvo)) continue;
    conferidos++;
    const [caminho, fragmento] = alvo.split('#') as [string, string | undefined];
    const destino = caminho ? resolve(dirname(arquivo), decodeURIComponent(caminho)) : arquivo;
    const origem = relative(RAIZ, arquivo);
    if (!existsSync(destino)) {
      problemas.push(`${origem}: ${alvo} não existe`);
      continue;
    }
    if (fragmento && destino.endsWith('.md') && !ancorasDe(destino).has(decodeURIComponent(fragmento))) {
      problemas.push(`${origem}: âncora #${fragmento} não existe em ${relative(RAIZ, destino)}`);
    }
  }
}

if (problemas.length) {
  console.error(`${problemas.length} link(s) quebrado(s):`);
  for (const p of problemas) console.error(`  ${p}`);
  process.exit(1);
}
console.log(`${conferidos} links relativos conferidos, todos resolvem.`);
