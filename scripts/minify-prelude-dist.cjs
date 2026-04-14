const {readFile, writeFile} = require('node:fs/promises');
const path = require('node:path');
const {pathToFileURL} = require('node:url');

function isIdentifierChar(char) {
  return /[\p{L}\p{N}_$]/u.test(char);
}

function minifyPrelude(source) {
  let i = 0;
  let output = '';

  while (i < source.length) {
    const char = source[i];
    const next = source[i + 1];

    if (char === '(' && next === '*') {
      i += 2;
      while (
        i < source.length &&
        !(source[i] === '*' && source[i + 1] === ')')
      ) {
        if (source[i] === '\n') {
          output += '\n';
        }
        i += 1;
      }
      i += 2;
      continue;
    }

    if (char === '"' || char === "'") {
      const quote = char;
      output += quote;
      i += 1;
      while (i < source.length) {
        const c = source[i];
        output += c;
        i += 1;
        if (c === '\\') {
          output += source[i] ?? '';
          i += 1;
          continue;
        }
        if (c === quote) {
          break;
        }
      }
      continue;
    }

    if (isIdentifierChar(char)) {
      let token = char;
      i += 1;
      while (i < source.length && isIdentifierChar(source[i])) {
        token += source[i];
        i += 1;
      }
      output += token === 'riff' ? 'fn' : token;
      continue;
    }

    output += char;
    i += 1;
  }

  return output.trim();
}

async function minifyDistPrelude() {
  const root = globalThis.process.cwd();
  const preludePath = path.join(root, 'dist/stdlib/prelude.js');
  const moduleUrl = `${pathToFileURL(preludePath).href}?t=${Date.now()}`;
  const {PRELUDE_SOURCE, PRELUDE_VOLATILES} = await import(moduleUrl);

  const minifiedSource = minifyPrelude(PRELUDE_SOURCE);
  const minifiedVolatiles = minifyPrelude(PRELUDE_VOLATILES);

  const fileContent = await readFile(preludePath, 'utf8');
  const replacedVolatiles = fileContent.replace(
    /export const PRELUDE_VOLATILES = `[\s\S]*?`;/,
    `export const PRELUDE_VOLATILES = ${JSON.stringify(minifiedVolatiles)};`,
  );
  const replaced = replacedVolatiles.replace(
    /export const PRELUDE_SOURCE = `[\s\S]*?`;/,
    `export const PRELUDE_SOURCE = ${JSON.stringify(minifiedSource)};`,
  );

  if (replaced === fileContent) {
    throw new Error(
      'Failed to replace prelude constants in dist/stdlib/prelude.js',
    );
  }

  await writeFile(preludePath, replaced);
}

void minifyDistPrelude();
