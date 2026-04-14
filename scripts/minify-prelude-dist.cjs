const {readFile, writeFile} = require('node:fs/promises');
const path = require('node:path');
const {pathToFileURL} = require('node:url');

function isIdentifierChar(char) {
  return /[\p{L}\p{N}_$]/u.test(char);
}

function tokenize(source) {
  const tokens = [];
  let i = 0;

  while (i < source.length) {
    const char = source[i];
    const next = source[i + 1];

    if (/\s/u.test(char)) {
      let value = char;
      i += 1;
      while (i < source.length && /\s/u.test(source[i])) {
        value += source[i];
        i += 1;
      }
      tokens.push({type: 'whitespace', value});
      continue;
    }

    if (char === '(' && next === '*') {
      i += 2;
      let newlines = '';
      while (
        i < source.length &&
        !(source[i] === '*' && source[i + 1] === ')')
      ) {
        if (source[i] === '\n') {
          newlines += '\n';
        }
        i += 1;
      }
      i += 2;
      tokens.push({type: 'whitespace', value: newlines || ' '});
      continue;
    }

    if (char === '"' || char === "'") {
      const quote = char;
      let value = quote;
      i += 1;
      while (i < source.length) {
        const c = source[i];
        value += c;
        i += 1;
        if (c === '\\') {
          value += source[i] ?? '';
          i += 1;
          continue;
        }
        if (c === quote) {
          break;
        }
      }
      tokens.push({type: 'string', value});
      continue;
    }

    if (isIdentifierChar(char)) {
      let value = char;
      i += 1;
      while (i < source.length && isIdentifierChar(source[i])) {
        value += source[i];
        i += 1;
      }
      tokens.push({type: 'word', value: value === 'riff' ? 'fn' : value});
      continue;
    }

    tokens.push({type: 'symbol', value: char});
    i += 1;
  }

  return tokens;
}

function isWordLike(token) {
  return token.type === 'word' || token.type === 'string';
}

function needsLexicalSpace(prev, next) {
  if (isWordLike(prev) && isWordLike(next)) {
    return true;
  }
  if (next.type === 'word') {
    return prev.value === ')' || prev.value === ']' || prev.value === '}';
  }
  return false;
}

function canMergeNewline(prev) {
  return (
    prev.value === ';' ||
    prev.value === '{' ||
    prev.value === '}' ||
    prev.value === ','
  );
}

function minifyPrelude(source) {
  const tokens = tokenize(source);
  let output = '';
  let prev;
  let pendingGap = '';

  for (const token of tokens) {
    if (token.type === 'whitespace') {
      pendingGap += token.value;
      continue;
    }

    if (!prev) {
      output += token.value;
      prev = token;
      pendingGap = '';
      continue;
    }

    const hadNewline = pendingGap.includes('\n');
    if (hadNewline && !canMergeNewline(prev)) {
      output += '\n';
    } else if (needsLexicalSpace(prev, token)) {
      output += ' ';
    }

    output += token.value;
    prev = token;
    pendingGap = '';
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
