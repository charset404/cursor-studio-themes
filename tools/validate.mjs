#!/usr/bin/env node
// Valida o catálogo inteiro: registry, metadados, cursores e previews.
//
//   node tools/validate.mjs
//
// Roda sem dependências e é o mesmo comando da CI, então o que passa aqui passa
// no Pull Request. Cada regra recusa o arquivo *e* diz onde está o problema.

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, extname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const problems = [];
const fail = (where, message) => problems.push(`${where}: ${message}`);

const ROLES = new Set([
  'Arrow', 'Help', 'AppStarting', 'Wait', 'Crosshair', 'IBeam', 'NWPen', 'No',
  'SizeNS', 'SizeWE', 'SizeNWSE', 'SizeNESW', 'SizeAll', 'UpArrow', 'Hand',
  'Pin', 'Person'
]);

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const VERSION = /^\d+\.\d+\.\d+$/;
const ACCENT = /^#[0-9a-fA-F]{6}$/;
const CURSOR_EXT = /\.(ani|cur)$/i;
const MAX_FILE_BYTES = 512 * 1024;
const MAX_THEME_BYTES = 4 * 1024 * 1024;
const MAX_PREVIEW_BYTES = 300 * 1024;

/** Extensões que podem existir dentro de uma pasta de tema. */
const ALLOWED_EXT = new Set(['.ani', '.cur', '.json', '.png']);

const KB = (bytes) => `${Math.round(bytes / 1024)} KB`;

function readJson(path, where) {
  if (!existsSync(path)) {
    fail(where, `arquivo ausente: ${relative(ROOT, path)}`);
    return null;
  }
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    fail(where, `JSON inválido em ${relative(ROOT, path)}: ${error.message}`);
    return null;
  }
}

function checkString(value, where, field, { min = 1, max = Infinity } = {}) {
  if (typeof value !== 'string') return fail(where, `"${field}" precisa ser texto`);
  const trimmed = value.trim();
  if (trimmed.length < min || trimmed.length > max) {
    fail(where, `"${field}" precisa ter entre ${min} e ${max} caracteres (tem ${trimmed.length})`);
  }
  return trimmed;
}

// ── Registry ────────────────────────────────────────────────────────────────

const registry = readJson(join(ROOT, 'registry.json'), 'registry.json');
const listed = new Map();

if (registry) {
  if (registry.schemaVersion !== 1) {
    fail('registry.json', `"schemaVersion" deve ser 1 (é ${JSON.stringify(registry.schemaVersion)})`);
  }
  for (const field of ['repository', 'branch', 'rawBase']) {
    checkString(registry[field], 'registry.json', field);
  }
  if (!Array.isArray(registry.themes)) {
    fail('registry.json', '"themes" precisa ser uma lista');
  } else {
    if (registry.themes.length === 0) {
      fail('registry.json', '"themes" está vazio');
    }
    for (const [index, theme] of registry.themes.entries()) {
      const where = `registry.json → themes[${index}]`;
      const slug = theme?.slug;
      if (typeof slug !== 'string' || !SLUG.test(slug)) {
        fail(where, `"slug" inválido: ${JSON.stringify(slug)} (use letras minúsculas e hífen)`);
        continue;
      }
      if (listed.has(slug)) fail(where, `slug duplicado: "${slug}"`);
      listed.set(slug, theme);

      if (!Array.isArray(theme.cursors) || theme.cursors.length === 0) {
        fail(where, '"cursors" precisa listar pelo menos um arquivo');
      } else {
        for (const entry of theme.cursors) {
          if (!CURSOR_EXT.test(String(entry?.file ?? ''))) {
            fail(where, `cursor "${entry?.file}" não termina em .ani ou .cur`);
          }
          if (!ROLES.has(entry?.role)) {
            fail(where, `cursor "${entry?.file}" tem papel desconhecido: ${JSON.stringify(entry?.role)}`);
          }
        }
      }
    }
  }
}

// ── Cada tema ───────────────────────────────────────────────────────────────

const themesRoot = join(ROOT, 'themes');
const folders = existsSync(themesRoot)
  ? readdirSync(themesRoot).filter((name) => statSync(join(themesRoot, name)).isDirectory())
  : [];

for (const folder of folders) {
  if (!listed.has(folder)) {
    fail(`themes/${folder}`, 'pasta não está listada no registry.json');
  }
}

for (const [slug, entry] of listed) {
  const where = `themes/${slug}`;
  const dir = join(themesRoot, slug);

  if (!existsSync(dir)) {
    fail(where, 'pasta do tema não existe');
    continue;
  }

  const meta = readJson(join(dir, 'theme.json'), where);
  if (meta) {
    if (meta.slug !== slug) {
      fail(where, `"slug" do theme.json (${JSON.stringify(meta.slug)}) difere do registry`);
    }
    checkString(meta.name, where, 'name', { min: 2, max: 48 });
    checkString(meta.author, where, 'author', { min: 2, max: 64 });
    const description = checkString(meta.description, where, 'description', { min: 10, max: 200 });
    if (typeof description === 'string' && /[\r\n]/.test(description)) {
      fail(where, '"description" não pode ter quebra de linha');
    }
    if (!VERSION.test(String(meta.version))) {
      fail(where, `"version" inválida: ${JSON.stringify(meta.version)} (use MAIOR.MENOR.CORREÇÃO)`);
    }
    if (meta.accent !== undefined && !ACCENT.test(String(meta.accent))) {
      fail(where, `"accent" inválida: ${JSON.stringify(meta.accent)} (use #rrggbb)`);
    }
    if (meta.tags !== undefined) {
      if (!Array.isArray(meta.tags)) fail(where, '"tags" precisa ser uma lista');
      else if (meta.tags.length > 6) fail(where, `"tags" tem ${meta.tags.length} itens (máximo 6)`);
    }
    // O registry é o que o app lê; divergir dele é o erro que mais engana.
    if (meta.name !== entry.name) {
      fail(where, `"name" difere do registry (${JSON.stringify(meta.name)} vs ${JSON.stringify(entry.name)})`);
    }

    const preview = meta.preview ?? 'preview.png';
    const previewPath = join(dir, preview);
    if (!existsSync(previewPath)) {
      fail(where, `preview ausente: ${preview}`);
    } else if (statSync(previewPath).size > MAX_PREVIEW_BYTES) {
      fail(where, `preview com ${KB(statSync(previewPath).size)} (máximo ${KB(MAX_PREVIEW_BYTES)})`);
    }
  }

  const cursorsDir = join(dir, 'cursors');
  const files = existsSync(cursorsDir) ? readdirSync(cursorsDir) : [];
  let total = 0;

  for (const file of files) {
    const path = join(cursorsDir, file);
    const ext = extname(file).toLowerCase();

    if (!ALLOWED_EXT.has(ext)) {
      fail(where, `arquivo não permitido: cursors/${file} (só .ani, .cur, .json, .png)`);
      continue;
    }
    if (!CURSOR_EXT.test(file)) continue;

    const size = statSync(path).size;
    total += size;
    if (size > MAX_FILE_BYTES) {
      fail(where, `cursors/${file} com ${KB(size)} (máximo ${KB(MAX_FILE_BYTES)})`);
    }
    if (size === 0) fail(where, `cursors/${file} está vazio`);

    // Um .cur/.ani começa com o diretório de ícones: tipo 1 (.cur) ou 2 (.ani).
    const head = readFileSync(path).subarray(0, 4);
    const type = head.readUInt16LE(2);
    const expected = ext === '.ani' ? 2 : 1;
    if (head.readUInt16LE(0) !== 0 || type !== expected) {
      fail(where, `cursors/${file} não parece um ${ext} válido`);
    }
  }

  if (total > MAX_THEME_BYTES) {
    fail(where, `tema com ${KB(total)} no total (máximo ${KB(MAX_THEME_BYTES)})`);
  }

  // Todo arquivo citado no registry precisa existir na pasta.
  for (const entryItem of entry.cursors ?? []) {
    const file = String(entryItem?.file ?? '');
    const name = file.split('/').pop();
    if (name && !existsSync(join(cursorsDir, name))) {
      fail(where, `registry cita "${file}", que não está em cursors/`);
    }
  }
}

// ── README em sincronia com o índice ────────────────────────────────────────

try {
  const { currentBlock, expectedBlock } = await import('./readme.mjs');
  const readme = readFileSync(join(ROOT, 'README.md'), 'utf8');
  const block = currentBlock(readme);
  if (block === null) {
    fail('README.md', 'faltam os marcadores THEMES:START / THEMES:END');
  } else if (registry && block.trim() !== expectedBlock(registry).trim()) {
    fail('README.md', 'a tabela de temas está fora de sincronia (rode: node tools/readme.mjs)');
  }
} catch (error) {
  fail('README.md', `não foi possível conferir a tabela: ${error.message}`);
}

// ── Resultado ───────────────────────────────────────────────────────────────

if (problems.length) {
  console.error(`\n${problems.length} problema(s) encontrado(s):\n`);
  for (const problem of problems) console.error(`  ✗ ${problem}`);
  console.error('\nConsulte docs/FORMATO.md antes de abrir o Pull Request.\n');
  process.exit(1);
}

console.log(`✓ ${listed.size} tema(s) válido(s), ${folders.length} pasta(s) conferida(s).`);
