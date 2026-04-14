import {readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

function isIdentifierChar(char) {
  return /[\p{L}\p{N}_$]/u.test(char);
}

function transformPrelude(source) {
  let i = 0;
  let output = '';

  while (i < source.length) {
    const char = source[i];
    const next = source[i + 1];

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

    if (char === '(' && next === '*') {
      i += 2;
      while (i < source.length && !(source[i] === '*' && source[i + 1] === ')')) {
        if (source[i] === '\n') {
          output += '\n';
        }
        i += 1;
      }
      i += 2;
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

  return output;
}

function minifyPrelude(source) {
  return transformPrelude(source)
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .join('\n');
}

async function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const preludePath = path.join(root, 'dist/stdlib/prelude.js');
  const moduleUrl = `${pathToFileURL(preludePath).href}?t=${Date.now()}`;
  const {PRELUDE_SOURCE} = await import(moduleUrl);
  const minifiedPrelude = minifyPrelude(PRELUDE_SOURCE);

  const fileContent = await readFile(preludePath, 'utf8');
  const replacement = `export const PRELUDE_SOURCE = ${JSON.stringify(minifiedPrelude)};`;
  const replaced = fileContent.replace(
    /export const PRELUDE_SOURCE = `[\s\S]*?`;/,
    replacement
  );

  if (replaced === fileContent) {
    throw new Error('Failed to locate PRELUDE_SOURCE in dist/stdlib/prelude.js');
  }

  await writeFile(preludePath, replaced);
}

main();
