#!/usr/bin/env node
// Regenera a tabela de temas do README a partir do registry.json.
//
//   node tools/readme.mjs          # reescreve o README
//   node tools/readme.mjs --check  # só confere (usado pela validação)
//
// A tabela é a vitrine do repositório; escrita à mão, ela desmente o índice no
// primeiro tema que entra e o último que sai.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const START = '<!-- THEMES:START -->';
const END = '<!-- THEMES:END -->';

export function renderTable(registry) {
  const rows = registry.themes.map((theme) => {
    const effect = /^effects?$/i.test(String(theme.kind ?? ''));
    const preview = theme.preview ?? `${effect ? 'effects' : 'themes'}/${theme.slug}/preview.png`;
    const count = effect ? `${theme.effect?.frames ?? '—'} quadros` : (theme.cursors?.length ?? 0);
    const size = Number.isFinite(Number(theme.size)) ? `${theme.size}×${theme.size}` : '—';
    return `| **${theme.name}** | ${effect ? 'Efeito' : 'Cursor'} | ${theme.author} | ${count} | ${size} | ${theme.license} | [ver](${preview}) |`;
  });

  return [
    START,
    '',
    '| Item | Tipo | Autor | Cursores / quadros | Tamanho | Licença | Prévia |',
    '| :--- | :---: | :--- | :---: | :---: | :---: | :---: |',
    ...rows,
    '',
    END
  ].join('\n');
}

export function currentBlock(readme) {
  const start = readme.indexOf(START);
  const end = readme.indexOf(END);
  if (start === -1 || end === -1) return null;
  return readme.slice(start, end + END.length);
}

export function expectedBlock(registry) {
  return renderTable(registry);
}

function main() {
  const check = process.argv.includes('--check');
  const registry = JSON.parse(readFileSync(join(ROOT, 'registry.json'), 'utf8'));
  const readmePath = join(ROOT, 'README.md');
  const readme = readFileSync(readmePath, 'utf8');

  const block = currentBlock(readme);
  if (block === null) {
    console.error('README.md não tem os marcadores THEMES:START / THEMES:END.');
    process.exit(1);
  }

  const expected = expectedBlock(registry);

  if (check) {
    // O checkout do Windows pode trocar LF por CRLF; a comparação não pode
    // depender do fim de linha, só do conteúdo.
    const normalize = (text) => text.replace(/\r\n/g, '\n');
    if (normalize(block).trim() !== normalize(expected).trim()) {
      console.error('README.md está fora de sincronia com o registry.json.');
      console.error('Rode: node tools/readme.mjs');
      process.exit(1);
    }
    console.log(`✓ README em sincronia com ${registry.themes.length} tema(s).`);
    return;
  }

  writeFileSync(readmePath, readme.replace(block, expected), 'utf8');
  console.log(`✓ README atualizado com ${registry.themes.length} tema(s).`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
