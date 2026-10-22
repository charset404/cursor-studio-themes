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

const LINK_RELATIONS = new Set(['requires', 'recommends']);
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const VERSION = /^\d+\.\d+\.\d+$/;
const ACCENT = /^#[0-9a-fA-F]{6}$/;
const CURSOR_EXT = /\.(ani|cur)$/i;
// Limites da Comunidade. A importação local do app tem outros (maiores) —
// nunca reutilize estes números para ela.
const MAX_FILE_BYTES = 4 * 1024 * 1024;
const MAX_THEME_BYTES = 32 * 1024 * 1024;
const MAX_PREVIEW_BYTES = 300 * 1024;
const MAX_DIMENSION = 128;
const MAX_FRAMES = 60;
const MAX_ICONS = 64;
/** Mesmos tetos do app para efeitos: 1 arquivo .bgra, quadros quadrados. */
const MAX_EFFECT_EDGE = 128;

/** Extensões que podem existir dentro de uma pasta de tema. */
const ALLOWED_EXT = new Set(['.ani', '.cur', '.json', '.png']);
/** E dentro de uma pasta de efeito. */
const EFFECT_EXT = new Set(['.bgra', '.json', '.png']);

/** `effect`/`effects` valem como efeito; todo o resto é cursor (a mesma regra do app). */
const kindOf = (item) => (/^effects?$/i.test(String(item?.kind ?? '')) ? 'effect' : 'cursor');
const linksOf = (item) =>
  [...(item?.links ?? []), ...(item?.related ?? [])].map((link) =>
    typeof link === 'string' ? { slug: link } : link
  );

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

// ── Conteúdo dos cursores ───────────────────────────────────────────────────
//
// Extensão não prova formato: um `.ani` truncado ou um RIFF com offset fora do
// arquivo passariam por qualquer checagem de nome. As funções abaixo leem a
// estrutura de verdade (diretório do `.cur`, blocos RIFF/`ACON` do `.ani`) e
// recusam com uma frase que diz o motivo.

const ascii = (bytes, start, end) => bytes.toString('latin1', start, end);

function readU16(bytes, offset, what) {
  if (offset + 2 > bytes.length) throw `${what} truncado`;
  return bytes.readUInt16LE(offset);
}

function readU32(bytes, offset, what) {
  if (offset + 4 > bytes.length) throw `${what} truncado`;
  return bytes.readUInt32LE(offset);
}

function readI32(bytes, offset, what) {
  if (offset + 4 > bytes.length) throw `${what} truncado`;
  return bytes.readInt32LE(offset);
}

function checkDimensions(width, height) {
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    throw `${width}×${height} passa do máximo ${MAX_DIMENSION}×${MAX_DIMENSION}`;
  }
}

/** DIB (BITMAPINFOHEADER) ou PNG: as duas formas de imagem dentro de um `.cur`. */
function probeImage(bytes) {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    if (bytes.length < 8 + 25 + 12) throw 'PNG da imagem truncado';
    if (ascii(bytes, 12, 16) !== 'IHDR') throw 'PNG sem bloco IHDR';
    if (readU32(bytes, 8, 'PNG') !== 13) throw 'IHDR com tamanho inválido';
    const width = readU32(bytes, 16, 'PNG');
    const height = readU32(bytes, 20, 'PNG');
    if (!width || !height) throw 'PNG sem dimensões';
    if (ascii(bytes, bytes.length - 8, bytes.length - 4) !== 'IEND') throw 'PNG sem IEND';
    return { width, height };
  }

  if (bytes.length < 40) throw 'imagem menor que o cabeçalho DIB';
  const headerSize = readU32(bytes, 0, 'DIB');
  if (headerSize < 40 || headerSize > bytes.length) throw 'cabeçalho DIB com tamanho inválido';
  const width = readI32(bytes, 4, 'DIB');
  const storedHeight = readI32(bytes, 8, 'DIB');
  const planes = readU16(bytes, 12, 'DIB');
  const bitCount = readU16(bytes, 14, 'DIB');
  const compression = readU32(bytes, 16, 'DIB');

  if (width <= 0 || storedHeight === 0) throw 'imagem com dimensões inválidas';
  if (planes !== 1) throw 'imagem com número de planos inválido';
  if (![1, 4, 8, 16, 24, 32].includes(bitCount)) throw `imagem com ${bitCount} bpp (não suportado)`;
  if (compression !== 0 && !(compression === 3 && bitCount === 32)) {
    throw `imagem com compressão ${compression} (não suportada)`;
  }

  const height = Math.max(1, Math.abs(storedHeight) >> 1);
  const stride = Math.ceil((width * bitCount) / 32) * 4;
  if (headerSize + stride * height > bytes.length) throw 'pixels da imagem passam do bloco';
  return { width, height };
}

/** Diretório de um `.cur`/`.ico`: cabeçalho, entradas e cada imagem. */
function probeIconDirectory(bytes) {
  if (bytes.length < 22) throw 'pequeno demais para um .cur';
  if (readU16(bytes, 0, '.cur') !== 0) throw 'não é um .cur (reservado != 0)';

  const type = readU16(bytes, 2, '.cur');
  if (type !== 1 && type !== 2) throw `tipo de imagem desconhecido (${type})`;

  const count = readU16(bytes, 4, '.cur');
  if (count < 1) throw 'não tem nenhuma imagem';
  if (count > MAX_ICONS) throw `${count} imagens (máximo ${MAX_ICONS})`;

  const directoryEnd = 6 + count * 16;
  if (directoryEnd > bytes.length) throw 'diretório de imagens passa do arquivo';

  let width = 0;
  let height = 0;
  for (let index = 0; index < count; index += 1) {
    const entry = 6 + index * 16;
    const length = readU32(bytes, entry + 8, '.cur');
    const offset = readU32(bytes, entry + 12, '.cur');

    if (!length) throw `imagem ${index} está vazia`;
    if (offset < directoryEnd) throw `imagem ${index} se sobrepõe ao diretório`;
    if (offset + length > bytes.length) throw `imagem ${index} passa do fim do arquivo`;

    const image = probeImage(bytes.subarray(offset, offset + length));
    width = Math.max(width, image.width);
    height = Math.max(height, image.height);
  }

  return { width, height };
}

/** Valida um cursor pelo **conteúdo** e devolve tamanho e quadros. */
function probeCursor(bytes, ext) {
  if (bytes.length === 0) throw 'arquivo vazio';
  if (bytes.length > MAX_FILE_BYTES) {
    throw `${KB(bytes.length)} (máximo ${KB(MAX_FILE_BYTES)})`;
  }

  const riff = bytes.length >= 12 && ascii(bytes, 0, 4) === 'RIFF';

  if (ext === '.cur') {
    if (riff) throw 'o conteúdo é uma animação (.ani), mas a extensão é .cur';
    const image = probeIconDirectory(bytes);
    checkDimensions(image.width, image.height);
    return { width: image.width, height: image.height, frames: 1 };
  }

  if (!riff) throw 'o conteúdo não é um RIFF/ACON';
  if (ascii(bytes, 8, 12) !== 'ACON') throw 'RIFF que não é uma animação de cursor (ACON)';

  const riffEnd = 8 + readU32(bytes, 4, 'RIFF');
  if (riffEnd > bytes.length) throw 'RIFF declara mais bytes do que o arquivo tem';

  let offset = 12;
  let chunks = 0;
  let frames = 0;
  let declaredFrames = 0;
  let width = 0;
  let height = 0;
  const sequence = [];

  while (offset + 8 <= riffEnd) {
    if ((chunks += 1) > 4096) throw 'blocos demais para uma animação';

    const id = ascii(bytes, offset, offset + 4);
    const size = readU32(bytes, offset + 4, 'bloco');
    const body = offset + 8;
    const end = body + size;
    if (end > riffEnd) throw `bloco "${id}" passa do fim do arquivo`;

    if (id === 'anih') {
      if (size < 36) throw 'cabeçalho anih truncado';
      if (readU32(bytes, body, 'anih') !== 36) throw 'anih declara tamanho diferente de 36';
      declaredFrames = readU32(bytes, body + 4, 'anih');
      if (declaredFrames > MAX_FRAMES) throw `declara ${declaredFrames} quadros (máximo ${MAX_FRAMES})`;
    } else if (id === 'seq ') {
      if (size % 4 !== 0) throw 'sequência (seq) com tamanho inválido';
      for (let index = 0; index < size / 4; index += 1) {
        sequence.push(readU32(bytes, body + index * 4, 'seq'));
      }
    } else if (id === 'LIST' && size >= 4 && ascii(bytes, body, body + 4) === 'fram') {
      let inner = body + 4;
      while (inner + 8 <= end) {
        const iconId = ascii(bytes, inner, inner + 4);
        const iconSize = readU32(bytes, inner + 4, 'quadro');
        const iconBody = inner + 8;
        const iconEnd = iconBody + iconSize;
        if (iconEnd > end) throw 'quadro passa do fim da lista';

        if (iconId === 'icon') {
          frames += 1;
          if (frames > MAX_FRAMES) throw `mais de ${MAX_FRAMES} quadros (máximo ${MAX_FRAMES})`;
          const image = probeIconDirectory(bytes.subarray(iconBody, iconEnd));
          width = Math.max(width, image.width);
          height = Math.max(height, image.height);
        }

        inner = iconEnd + (iconSize % 2);
      }
    }

    offset = end + (size % 2);
  }

  if (frames === 0) throw 'não tem nenhum quadro (icon)';
  if (declaredFrames && declaredFrames !== frames) {
    throw `anih declara ${declaredFrames} quadros, mas a lista tem ${frames}`;
  }
  for (const index of sequence) {
    if (index >= frames) throw `sequência aponta para o quadro ${index}, mas a animação tem ${frames}`;
  }

  checkDimensions(width, height);
  return { width, height, frames };
}

// ── Efeitos ─────────────────────────────────────────────────────────────────
//
// Um efeito é UM arquivo .bgra (quadros BGRA pré-multiplicados, quadrados, sem
// cabeçalho) em effects/<slug>/. O tamanho do arquivo precisa fechar exatamente
// com frames × lado × lado × 4: é a única "estrutura" que o formato tem.

function checkEffect(slug, entry) {
  const where = `effects/${slug}`;
  const dir = join(ROOT, 'effects', slug);

  if (!existsSync(dir)) {
    fail(where, 'pasta do efeito não existe');
    return;
  }

  const meta = readJson(join(dir, 'effect.json'), where);
  if (meta) {
    if (meta.slug !== slug) fail(where, `"slug" do effect.json (${JSON.stringify(meta.slug)}) difere do registry`);
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
    if (meta.name !== entry.name) {
      fail(where, `"name" difere do registry (${JSON.stringify(meta.name)} vs ${JSON.stringify(entry.name)})`);
    }
    if (meta.version !== entry.version) {
      fail(where, `"version" difere do registry (${JSON.stringify(meta.version)} vs ${JSON.stringify(entry.version)})`);
    }
    for (const key of ['file', 'frames', 'width', 'height']) {
      if (meta.effect?.[key] !== entry.effect?.[key]) {
        fail(where, `"effect.${key}" difere do registry (${JSON.stringify(meta.effect?.[key])} vs ${JSON.stringify(entry.effect?.[key])})`);
      }
    }

    const preview = meta.preview ?? 'preview.png';
    const previewPath = join(dir, preview);
    if (!existsSync(previewPath)) fail(where, `preview ausente: ${preview}`);
    else if (statSync(previewPath).size > MAX_PREVIEW_BYTES) {
      fail(where, `preview com ${KB(statSync(previewPath).size)} (máximo ${KB(MAX_PREVIEW_BYTES)})`);
    }
  }

  for (const file of readdirSync(dir)) {
    if (!EFFECT_EXT.has(extname(file).toLowerCase())) {
      fail(where, `arquivo não permitido: ${file} (só .bgra, .json, .png)`);
    }
  }

  const file = String(entry.effect?.file ?? '');
  const path = join(dir, file);
  if (!file || file.includes('/') || file.includes('\\')) {
    fail(where, '"effect.file" precisa ser só o nome do arquivo, dentro da pasta do efeito');
    return;
  }
  if (!existsSync(path)) {
    fail(where, `arquivo do efeito ausente: ${file}`);
    return;
  }

  const bytes = statSync(path).size;
  if (bytes > MAX_FILE_BYTES) fail(where, `${file} com ${KB(bytes)} (máximo ${KB(MAX_FILE_BYTES)})`);
  const frameBytes = (entry.effect?.width ?? 0) * (entry.effect?.height ?? 0) * 4;
  if (!frameBytes || bytes % frameBytes !== 0) {
    fail(where, `${file} (${bytes} bytes) não fecha com quadros de ${entry.effect?.width}×${entry.effect?.height} BGRA`);
  } else if (bytes / frameBytes !== entry.effect?.frames) {
    fail(where, `"effect.frames" é ${entry.effect?.frames}, mas o arquivo tem ${bytes / frameBytes} quadros`);
  }
}

// ── Registry ────────────────────────────────────────────────────────────────

const registry = readJson(join(ROOT, 'registry.json'), 'registry.json');
const listed = new Map();

if (registry) {
  if (![1, 2].includes(registry.schemaVersion)) {
    fail('registry.json', `"schemaVersion" deve ser 1 ou 2 (é ${JSON.stringify(registry.schemaVersion)})`);
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

      if (kindOf(theme) === 'effect') {
        const edge = theme.effect?.width;
        if (!theme.effect || typeof theme.effect.file !== 'string' || !/\.bgra$/i.test(theme.effect.file)) {
          fail(where, '"effect.file" precisa apontar para um arquivo .bgra');
        }
        if (!Number.isInteger(edge) || edge < 1 || edge > MAX_EFFECT_EDGE || theme.effect?.height !== edge) {
          fail(where, `"effect.width"/"effect.height" precisam ser iguais, entre 1 e ${MAX_EFFECT_EDGE}`);
        }
        if (!Number.isInteger(theme.effect?.frames) || theme.effect.frames < 8 || theme.effect.frames > MAX_FRAMES) {
          fail(where, `"effect.frames" precisa estar entre 8 e ${MAX_FRAMES}`);
        }
        if (theme.size !== edge) fail(where, `"size" (${JSON.stringify(theme.size)}) precisa ser o lado do quadro (${edge})`);
        continue;
      }

      if (
        typeof theme.size !== 'number' ||
        !Number.isInteger(theme.size) ||
        theme.size < 1 ||
        theme.size > MAX_DIMENSION
      ) {
        fail(
          where,
          `"size" precisa ser inteiro entre 1 e ${MAX_DIMENSION} (é ${JSON.stringify(theme.size)})`
        );
      }

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
const effectsRoot = join(ROOT, 'effects');
const subfolders = (root) =>
  existsSync(root) ? readdirSync(root).filter((name) => statSync(join(root, name)).isDirectory()) : [];
const folders = subfolders(themesRoot);
const effectFolders = subfolders(effectsRoot);

for (const folder of folders) {
  if (!listed.has(folder) || kindOf(listed.get(folder)) !== 'cursor') {
    fail(`themes/${folder}`, 'pasta não está listada no registry.json como tema de cursor');
  }
}
for (const folder of effectFolders) {
  if (!listed.has(folder) || kindOf(listed.get(folder)) !== 'effect') {
    fail(`effects/${folder}`, 'pasta não está listada no registry.json como efeito (kind "effect")');
  }
}

for (const [slug, entry] of listed) {
  if (kindOf(entry) === 'effect') {
    checkEffect(slug, entry);
    continue;
  }

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
    if (
      typeof meta.size !== 'number' ||
      !Number.isInteger(meta.size) ||
      meta.size < 1 ||
      meta.size > MAX_DIMENSION
    ) {
      fail(
        where,
        `"size" precisa ser inteiro entre 1 e ${MAX_DIMENSION} (é ${JSON.stringify(meta.size)})`
      );
    } else if (meta.size !== entry.size) {
      fail(where, `"size" difere do registry (${meta.size} vs ${JSON.stringify(entry.size)})`);
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
  let detected = 0;

  for (const file of files) {
    const path = join(cursorsDir, file);
    const ext = extname(file).toLowerCase();

    if (!ALLOWED_EXT.has(ext)) {
      fail(where, `arquivo não permitido: cursors/${file} (só .ani, .cur, .json, .png)`);
      continue;
    }
    if (!CURSOR_EXT.test(file)) continue;

    const bytes = readFileSync(path);
    const size = bytes.length;
    total += size;
    if (size > MAX_FILE_BYTES) {
      fail(where, `cursors/${file} com ${KB(size)} (máximo ${KB(MAX_FILE_BYTES)})`);
    }

    try {
      const info = probeCursor(bytes, ext);
      detected = Math.max(detected, info.width, info.height);
    } catch (error) {
      fail(where, `cursors/${file}: ${error}`);
    }
  }

  if (total > MAX_THEME_BYTES) {
    fail(where, `tema com ${KB(total)} no total (máximo ${KB(MAX_THEME_BYTES)})`);
  }

  // O `size` declarado precisa ser o que os arquivos realmente têm — um catálogo
  // que mente aqui faria o selo do app mentir também.
  if (meta && typeof meta.size === 'number' && detected > 0 && meta.size !== detected) {
    fail(where, `"size" ${meta.size} não bate com o maior cursor (${detected}×${detected})`);
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

// ── Categorias ──────────────────────────────────────────────────────────────

const categoriesPath = join(ROOT, 'categories.json');
if (existsSync(categoriesPath)) {
  let doc = null;
  try {
    doc = JSON.parse(readFileSync(categoriesPath, 'utf8'));
  } catch (error) {
    fail('categories.json', `JSON invalido (${error.message})`);
  }

  const ids = new Set();
  for (const entry of doc?.categories ?? []) {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(entry.id ?? '')) {
      fail('categories.json', `id invalido: ${JSON.stringify(entry.id)}`);
      continue;
    }
    if (ids.has(entry.id)) fail('categories.json', `id repetido: ${entry.id}`);
    ids.add(entry.id);
    if (!entry.label) fail('categories.json', `categoria ${entry.id} sem label`);
    if (entry.cover && !existsSync(join(ROOT, entry.cover))) {
      fail('categories.json', `cover ausente: ${entry.cover}`);
    }
  }

  for (const theme of registry?.themes ?? []) {
    if (theme.category && !ids.has(theme.category)) {
      fail(`themes/${theme.slug}`, `category "${theme.category}" nao existe em categories.json`);
    }
  }
}

// ── Vínculos cursor ↔ efeito ────────────────────────────────────────────────
//
// Opcionais, e basta um lado declarar. Só valem entre tipos diferentes e entre
// itens que existem; o app apenas OFERECE instalar o que falta.

for (const [slug, item] of listed) {
  const where = `registry.json → ${slug}`;
  for (const link of linksOf(item)) {
    if (!link?.slug) {
      fail(where, 'vínculo sem slug');
    } else if (link.slug === slug) {
      fail(where, 'vínculo para si mesmo');
    } else if (!listed.has(link.slug)) {
      fail(where, `vínculo aponta para "${link.slug}", que não existe no catálogo`);
    } else if (kindOf(listed.get(link.slug)) === kindOf(item)) {
      fail(where, `vínculo com "${link.slug}" é do mesmo tipo (só cursor ↔ efeito)`);
    }
    if (link?.relation !== undefined && !LINK_RELATIONS.has(link.relation)) {
      fail(where, `"relation" inválida: ${JSON.stringify(link.relation)} (use requires ou recommends)`);
    }
  }
}

try {
  const { currentBlock, expectedBlock } = await import('./readme.mjs');
  const readme = readFileSync(join(ROOT, 'README.md'), 'utf8');
  const block = currentBlock(readme);
  if (block === null) {
    fail('README.md', 'faltam os marcadores THEMES:START / THEMES:END');
  } else if (registry && block.replace(/\r\n/g, '\n').trim() !== expectedBlock(registry).replace(/\r\n/g, '\n').trim()) {
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

console.log(
  `✓ ${listed.size} item(ns) válido(s): ${folders.length} tema(s) de cursor, ${effectFolders.length} efeito(s).`
);
